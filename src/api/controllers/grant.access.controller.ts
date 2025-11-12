import { Request, Response } from 'express';
import { allocateCourseByServer } from '../../utils/discordUtils';

interface GuildResult {
  guild: string;
  guildId: string;
  status: 'success' | 'error';
  message: string;
  coursesGranted?: number;
}

export const grantUserAccess = async (req: Request, res: Response) => {
  try {
    const { discordId, courses } = req.body;
    
    if (!discordId) {
      return res.status(400).json({ error: 'Discord ID is required' });
    }
    
    if (!courses || !Array.isArray(courses)) {
      return res.status(400).json({ error: 'Courses array is required' });
    }
    
    const client = req.client;
    if (!client) {
      return res.status(500).json({ error: 'Discord client not available' });
    }
    
    // Get all guilds the bot is in
    const guilds = await client.guilds.fetch();
    const results: GuildResult[] = [];
    
    for (const [guildId, guild] of guilds) {
      try {
        // Fetch full guild to get members
        const fullGuild = await client.guilds.fetch(guildId);
        
        // Try to find the user in this guild
        let user;
        try {
          const member = await fullGuild.members.fetch(discordId);
          user = member.user;
        } catch (err) {
          // User not in this guild, skip
          results.push({
            guild: guild.name,
            guildId: guildId,
            status: 'error',
            message: 'User not found in this guild'
          });
          continue;
        }
        
        if (user) {
          // Count courses before allocation
          const coursesBefore = courses.length;
          
          await allocateCourseByServer(courses, fullGuild, user);
          
          results.push({
            guild: fullGuild.name,
            guildId: guildId,
            status: 'success',
            message: `Granted access for ${user.username}`,
            coursesGranted: coursesBefore
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          guild: guild.name,
          guildId: guildId,
          status: 'error',
          message: errorMessage
        });
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${results.length} guilds`,
      results: results
    });
    
  } catch (error) {
    console.error('Grant user access error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Failed to grant user access',
      details: errorMessage 
    });
  }
};