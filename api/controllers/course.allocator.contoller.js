const {allocateCourseByServer} = require('../../discord_utils/discordUtils.js'); 

const allocateToJoinedServer = async (req, res) => {
  try {
    const client = req.client;
    const { servers, discordId, courses } = req.body;

    // Validate required fields
    if (!servers || !discordId || !courses) {
      return res.status(400).json({ 
        success: false,
        error: "Missing required fields: servers, discordId, or courses" 
      });
    }

    // Validate servers is an array
    if (!Array.isArray(servers)) {
      return res.status(400).json({ 
        success: false,
        error: "servers must be an array" 
      });
    }

    // Process each server
    const allocationResults = await Promise.all(
      servers.map(async (serverId) => {
        try {
          const server = await client.guilds.fetch(serverId);
          const user = await server.members.fetch(discordId);
          await allocateCourseByServer(courses, server, user);
          return { serverId, success: true };
        } catch (error) {
          console.error(`Failed to allocate in server ${serverId}:`, error);
          return { serverId, success: false, error: error.message };
        }
      })
    );

    // Check for partial failures
    const failedAllocations = allocationResults.filter(r => !r.success);
    if (failedAllocations.length > 0) {
      return res.status(207).json({ // 207 = Multi-Status
        success: false,
        message: "Partial allocation completed",
        results: allocationResults,
        failed: failedAllocations.map(f => f.serverId)
      });
    }

    // Success response
    res.status(200).json({
      success: true,
      message: `Successfully allocated courses to user ${discordId}`,
      serversAllocated: servers
    });

  } catch (error) {
    console.error("Error allocating to joined servers:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error.message
    });
  }
};


module.exports = [allocateCourseByServer]