import { allocateCourseByServer } from '../../utils/discordUtils'
import { getUserData } from '../../utils/firebaseUtils'
import { Request, Response, NextFunction } from 'express';

export async function allocateToJoinedServer(req: Request, res: Response){
  const client = req.client;
  const { discordId, courses } = req.body;
  if (!discordId || !courses || !Array.isArray(courses)) {
    return res.status(400).json({ error: "Missing or invalid discordId or courses" });
  }
  try {
    await getUserData(discordId)

    let allocated = 0;
    const servers = client.guilds.cache;

    for (const server of servers.values()) {
      const member = await server.members.fetch(discordId).catch(() => null);
      if (!member) {
        console.log(`⚠️ Member ${discordId} not found in ${server.name}`);
        continue;
      }

      await allocateCourseByServer(courses, server, member.user);
      console.log(`✅ Allocated courses in ${server.name}`);
      allocated++;
    }

    if (allocated === 0) {
      console.log(`❌ No servers processed successfully for ${discordId}`);
      return res.status(404).json({ error: "No servers processed successfully" });
    }

    res.json({ success: true, allocated });

  } catch (err: unknown) {
    if (err instanceof Error && err.message === "not-found") {
      console.log(`❌ User with Discord ID ${discordId} not found in Firestore`);
      return res.status(404).json({ error: "User not found" });
    } else {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error("❌ Bot /bot/allocate error:", err);
      res.status(500).json({
        error: "Failed to allocate courses",
        details: errorMessage
      });
    }
  }
};


