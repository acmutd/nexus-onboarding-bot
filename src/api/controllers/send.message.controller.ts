import { Request, Response } from 'express';
import { sendMessageToAllGuilds, sendMessageToGuildChannelByName } from '../../utils/sendMessage';

type Body = {
  server: string;
  channel: string;
  message: string;
};

export async function sendMessage(req: Request, res: Response) {
  const { server, channel, message } = (req.body || {}) as Partial<Body>;

  if (!server || typeof server !== 'string') return res.status(400).json({ error: 'Missing or invalid "server"' });
  if (!channel || typeof channel !== 'string') return res.status(400).json({ error: 'Missing or invalid "channel"' });
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or invalid "message"' });
  }

  try {
    if (server === 'all') {
      const summary = await sendMessageToAllGuilds(req.client, channel, message);
      return res.json({ ok: true, mode: 'all', ...summary });
    }

    const result = await sendMessageToGuildChannelByName(req.client, server, channel, message);
    if (!result.ok) return res.status(404).json({ ok: false, error: result.reason });

    return res.json({ ok: true, mode: 'single' });
  } catch (e) {
    console.error('sendMessage controller error:', e);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

