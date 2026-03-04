import { ChannelType, Client } from 'discord.js';

export type SendMessageFailure = {
  guildId: string;
  guildName: string;
  reason: string;
};

export type SendMessageSummary = {
  successCount: number;
  failures: SendMessageFailure[];
};

function normalizeName(name: string) {
  return String(name || '').trim().toLowerCase();
}

export async function sendMessageToGuildChannelByName(
  client: Client,
  guildId: string,
  channelName: string,
  messageContent: string
): Promise<{ ok: true } | { ok: false; guildName: string; reason: string }> {
  const guild = await client.guilds.fetch(guildId);
  const channels = await guild.channels.fetch();

  const target = channels.find((c) => {
    if (!c) return false;
    if (normalizeName(c.name) !== normalizeName(channelName)) return false;
    return c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement;
  });

  if (!target) {
    return { ok: false, guildName: guild.name, reason: 'channel not found' };
  }

  // Both GuildText and GuildAnnouncement channels support send()
  await (target as any).send(messageContent);
  return { ok: true };
}

export async function sendMessageToAllGuilds(
  client: Client,
  channelName: string,
  messageContent: string
): Promise<SendMessageSummary> {
  const guilds = await client.guilds.fetch();

  let successCount = 0;
  const failures: SendMessageFailure[] = [];

  for (const [guildId, guildData] of guilds) {
    try {
      const res = await sendMessageToGuildChannelByName(client, guildId, channelName, messageContent);
      if (res.ok) {
        successCount++;
      } else {
        failures.push({ guildId, guildName: res.guildName, reason: res.reason });
      }
    } catch {
      failures.push({ guildId, guildName: guildData.name || 'Unknown', reason: 'error' });
    }
  }

  return { successCount, failures };
}

