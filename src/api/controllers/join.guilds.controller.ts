import { Request, Response } from 'express';
import axios from 'axios';

const DISCORD_API = 'https://discord.com/api/v10';

type JoinStatus = 'joined' | 'already_member' | 'error';

interface JoinResult {
  guildId: string;
  status: JoinStatus;
  httpStatus: number;
  message?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchDiscordUserId(accessToken: string): Promise<string> {
  const res = await axios.get(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    validateStatus: () => true,
  });

  if (res.status !== 200 || !res.data?.id) {
    throw new Error(`Failed to fetch Discord user id (status ${res.status})`);
  }

  return res.data.id as string;
}

async function joinOneGuild(
  guildId: string,
  userId: string,
  userAccessToken: string,
  botToken: string,
): Promise<JoinResult> {
  const res = await axios.put(
    `${DISCORD_API}/guilds/${guildId}/members/${userId}`,
    { access_token: userAccessToken },
    {
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    },
  );

  if (res.status === 201 || res.status === 204) {
    return { guildId, status: 'joined', httpStatus: res.status };
  }

  if (res.status === 409) {
    return {
      guildId,
      status: 'already_member',
      httpStatus: res.status,
      message: res.data?.message || 'User already in guild',
    };
  }

  if (res.status === 403) {
    return {
      guildId,
      status: 'error',
      httpStatus: res.status,
      message: res.data?.message || 'Missing permissions or bot not in guild',
    };
  }

  if (res.status === 429 && res.data?.retry_after) {
    // Respect rate limit then retry once
    const retryMs = Math.ceil(Number(res.data.retry_after) * 1000);
    await sleep(retryMs);
    return joinOneGuild(guildId, userId, userAccessToken, botToken);
  }

  return {
    guildId,
    status: 'error',
    httpStatus: res.status,
    message: res.data?.message || 'Unknown error',
  };
}

async function resolveInvitesToGuilds(invites: string[], botToken: string): Promise<{ code: string; guildId: string }[]> {
  const mappings: { code: string; guildId: string }[] = [];

  for (const code of invites) {
    const inviteRes = await axios.get(`${DISCORD_API}/invites/${code}`, {
      headers: { Authorization: `Bot ${botToken}` },
      validateStatus: () => true,
    });

    if (inviteRes.status === 200 && inviteRes.data?.guild?.id) {
      mappings.push({ code, guildId: inviteRes.data.guild.id });
    } else {
      console.warn('[join-guilds] failed to resolve invite', code, 'status', inviteRes.status);
    }

    await sleep(200);
  }

  return mappings;
}

export const joinGuilds = async (req: Request, res: Response) => {
  const { discordId, userAccessToken, guildIds, invites } = req.body as {
    discordId?: string;
    userAccessToken?: string;
    guildIds?: string[];
    invites?: string[];
  };

  console.log('[join-guilds] incoming', {
    guildCount: Array.isArray(guildIds) ? guildIds.length : 0,
    inviteCount: Array.isArray(invites) ? invites.length : 0,
    hasUserAccessToken: Boolean(userAccessToken),
    providedDiscordId: Boolean(discordId),
  });

  if (!userAccessToken) {
    return res.status(400).json({ error: 'userAccessToken is required' });
  }

  const botToken = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
  if (!botToken) {
    return res.status(500).json({ error: 'Bot token is not configured' });
  }

  try {
    let targetGuilds: { guildId: string; inviteCode?: string }[] = [];

    if (Array.isArray(guildIds) && guildIds.length > 0) {
      targetGuilds = guildIds.map(g => ({ guildId: g }));
    }

    if (Array.isArray(invites) && invites.length > 0) {
      const mappings = await resolveInvitesToGuilds(invites, botToken);
      targetGuilds.push(...mappings.map(m => ({ guildId: m.guildId, inviteCode: m.code })));
    }

    // dedupe by guildId, keep first inviteCode if present
    const seen = new Map<string, { guildId: string; inviteCode?: string }>();
    for (const tg of targetGuilds) {
      if (!seen.has(tg.guildId)) {
        seen.set(tg.guildId, tg);
      }
    }
    targetGuilds = Array.from(seen.values());

    if (targetGuilds.length === 0) {
      return res.status(400).json({ error: 'Provide guildIds or invites' });
    }

    const userId = discordId || (await fetchDiscordUserId(userAccessToken));
    console.log('[join-guilds] resolved userId', userId);
    const results: JoinResult[] = [];

    for (const tg of targetGuilds) {
      console.log('[join-guilds] joining', { guildId: tg.guildId, inviteCode: tg.inviteCode });
      const result = await joinOneGuild(tg.guildId, userId, userAccessToken, botToken);
      if (tg.inviteCode) {
        result.message = `via invite ${tg.inviteCode}${result.message ? `: ${result.message}` : ''}`;
      }
      results.push(result);
      console.log('[join-guilds] result', result);
      await sleep(300); // gentle pacing for rate limits
    }

    console.log('[join-guilds] complete', { userId, total: results.length });
    return res.json({
      userId,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[join-guilds] error', message);
    return res.status(500).json({ error: message });
  }
};
