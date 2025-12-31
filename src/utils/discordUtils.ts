import { Guild, User, Interaction, TextChannel, BaseGuildTextChannel, GuildMember } from "discord.js";
import { PermissionsBitField, PermissionOverwriteManager } from "discord.js";
const fs = require("fs").promises;  // Use promises API for cleaner await
import { readFile, writeFile } from 'fs/promises';
import * as fsSync from 'fs';

interface Course {
  course_id: string
}
interface Admins {
  admins: string[]
}
export class AdminError extends Error {
    constructor(mssg:string){
        super(mssg)
    }
}

const ADMIN_FILE = "data/admin.json"

// Cache prefix_map.json in memory (loaded once at startup)
const prefixMap: Record<string, string> = JSON.parse(
  fsSync.readFileSync("data/prefix_map.json", "utf-8")
);
console.log("Loaded prefix_map.json into memory");

/**
 * Remove all course channel permissions for a user when they unlink Discord
 * @param user - The Discord user
 * @param guild - The Discord guild
 */
export async function removeAllCourseAccess(user: User, guild: Guild) {
  try {
    // Use cached prefix_map instead of reading from disk
    
    // Get all course prefixes that belong to this guild
    const guildPrefixes = Object.keys(prefixMap).filter(prefix => 
      prefixMap[prefix].toLowerCase() === guild.name.toLowerCase()
    );
    
    console.log(` Removing course access for ${user.username} in guild ${guild.name}`);
    
    // Find all channels that might be course channels
    const channels = guild.channels.cache.filter(channel => 
      channel.type === 0 && // Text channel
      guildPrefixes.some(prefix => 
        channel.name.toLowerCase().startsWith(prefix.toLowerCase())
      )
    );
    
    for (const [channelId, channel] of channels) {
      if (channel instanceof TextChannel) {
        try {
          // Check if user has permissions on this channel
          const userOverwrite = channel.permissionOverwrites.cache.get(user.id);
          if (userOverwrite) {
            await channel.permissionOverwrites.delete(user.id);
          }
        } catch (err) {
          console.warn(` Could not remove permissions from channel ${channel.name}:`, err);
        }
      }
    }
    
    console.log(` Removed course access from ${user.username}`);
  } catch (err) {
    console.error("removeAllCourseAccess error:", err);
  }
}

export async function addAdmin(target:unknown, guild: Guild) {
    if (!(target instanceof GuildMember)) {
        throw new AdminError("Can only promote Guild Members")
    }
    
    // Look for admin role by name, not by ID
    let adminRole = guild.roles.cache.find(role => role.name.toLowerCase() === "admin");
    
    if (!adminRole) {
        // Create admin role if it doesn't exist
        console.log(`Creating admin role in guild ${guild.name}`);
        adminRole = await guild.roles.create({
            name: "Admin",
            permissions: [
                PermissionsBitField.Flags.Administrator
            ],
            color: 0x0052CC, // Role color
            hoist: true, // Show separately in member list
            mentionable: true,
            reason: "Auto-created admin role for promotion command"
        });
        console.log(`Admin role created with ID: ${adminRole.id}`);
    }
    
    await addAdminJson(target.id);
    
    if (target.roles.cache.has(adminRole.id)) {
        throw new AdminError(`${target.displayName} is already an Admin`)
    }

    await target.roles.add(adminRole)
    
}

export async function removeAdmin(target:unknown, guild: Guild) {
    if (!(target instanceof GuildMember)) {
        throw new AdminError("Can only demote Guild Members")
    }
    
    // Look for admin role by name
    const adminRole = guild.roles.cache.find(role => role.name.toLowerCase() === "admin");
    
    if (!adminRole) {
        throw new AdminError("Admin role not found in this server")
    }
    
    if (!target.roles.cache.has(adminRole.id)) {
        throw new AdminError(`${target.displayName} is not an Admin`)
    }

    // Remove from JSON file first
    await removeAdminJson(target.id);
    
    // Remove admin role
    await target.roles.remove(adminRole)
    
}

export async function addAdminJson(userId: string) {
  try {
    // 1. Read the JSON file
    const data = await readFile(ADMIN_FILE, 'utf8');
    let json: Admins = JSON.parse(data);
    // 2. If the user is not already in the list, add them
    if (!json.admins) {
      json = { admins: [] };
    }
    if (!json.admins.includes(userId)) {
      json.admins.push(userId);
    }

    // 3. Save back to file
    await writeFile(ADMIN_FILE, JSON.stringify(json, null, 2));
    console.log(` Added ${userId} to admins list`);
  } catch (err) {
    if (!(err instanceof Error))
      throw new Error(`Unkown Error:${err}`);
    if (!err.message.includes("no such file or directory")) {
      console.error('Error adding admin:', err);
      throw err;
    }
    //If file is not found, write to a file with new admin info 
    const json = { admins: [userId] };
    await writeFile(ADMIN_FILE, JSON.stringify(json, null, 2))

  }

}
export async function findAdminJson(userId: string): Promise<boolean> {
  // 1. Read the JSON file
  try {
    const data = await readFile(ADMIN_FILE, 'utf8');
    let json: Admins = JSON.parse(data);
    // 2. If the user is not already in the list, add them
    if (!json.admins) {
      throw new Error("Admins not found")
    }
    if (json.admins.includes(userId)) {
      return true;
    }
    return false;
  } catch (err) {
    if (!(err instanceof Error))
      throw new Error(`Unkown Error:${err}`);
    if (!err.message.includes("no such file or directory")) {
      console.error('Error adding admin:', err);
      throw err;
    }
    //If file is not found, write to a file with new admin info 
    const json = { admins: [] };
    await writeFile(ADMIN_FILE, JSON.stringify(json, null, 2))
    return false;
  }


}

export async function removeAdminJson(userId: string) {
  try {
    // 1. Read the JSON file
    const data = await readFile(ADMIN_FILE, 'utf8');
    const json: Admins = JSON.parse(data);
    const admins = json.admins;
    // 2. If the user is not already in the list, add them
    if (!admins) {
      throw new Error("Admins not found")
    }
    if (!admins.includes(userId)) {
      throw new Error(`${userId} isn't in admins`)
    }
    admins.splice(admins.indexOf(userId), 1)

    await writeFile(ADMIN_FILE, JSON.stringify(json, null, 2));
    console.log(` Removed ${userId} from admins list`);
  } catch (err) {
    if (!(err instanceof Error))
      throw new Error(`Unkown Error:${err}`);
    if (!err.message.includes("no such file or directory")) {
      console.error('Error adding admin:', err);
      throw err;
    }
    //If file is not found, write to a file with new admin info 
    const json = { admins: [] };
    await writeFile(ADMIN_FILE, JSON.stringify(json, null, 2))

  }

}


/**
 * 
 * @param courses 
 * @param guild 
 * @param user 
 * 
 * What: Provides users access to their courses based on if the courses are available to them in those servers.
 * Why: Used in the bot.js file and course.allocator.controller.js, so when given a list of courses and a guild, we can
 *      provide user access to those channels
 */
export async function allocateCourseByServer(courses: Course[], guild: Guild, user: User) {
  try {
    // Use cached prefix_map instead of reading from disk
    
    console.log(` Processing ${courses.length} courses for ${user.username} in guild "${guild.name}"`);

    for (const course of courses) {
      const parts = course.course_id.split('-');
      
      if (parts.length < 3) {
        console.warn(`   Invalid course format: ${course.course_id} (expected format: prefix-code-professor)`);
        continue;
      }
      
      const prefix = parts[0].toLowerCase();
      const courseNumber = parts[1];
      const professorName = parts.slice(2).join(' ');
      
      // Extract last name from professor (same logic as create-all-courses)
      const profParts = professorName.trim().split(/\s+/);
      const profLastName = profParts[profParts.length - 1] || 'staff';
      
      // Sanitize professor name (remove non-alphanumeric characters, lowercase)
      const sanitizedProf = profLastName.toLowerCase().replace(/[^a-z0-9-_]/g, '');
      
      // Build channel name in same format as create-all-courses: prefix-number-prof
      const channelName = `${prefix}-${courseNumber}-${sanitizedProf}`;
      
      if (prefixMap[prefix] && prefixMap[prefix].toLowerCase() === guild.name.toLowerCase()) {
        console.log(`   Granted access to ${channelName}`);
        
        try {
          await provideUserAccess(channelName, user, guild);
        } catch (accessErr) {
          // If channel doesn't exist, try to create it in the correct guild
          try {
            await makeTextChannel(channelName, user, guild, prefix, prefixMap);
            console.log(`   Created new channel: ${channelName}`);
          } catch (createErr) {
            console.warn(`   Could not create/access channel ${channelName}:`, createErr);
          }
        }
      }
    }
  } catch (err) {
    console.error(" allocateCourseByServer error:", err);
  }
}


/**
 * 
 * @param courseCode 
 * @param user 
 * @param guild 
 * 
 * What: Overwrites default("private-channel/can't see") permissions for the specific user
 * Why: So we can provide user's access to their proper channels after they have been verifed 
 */
export async function provideUserAccess(courseCode: string, user: User, guild: Guild) {
  const channel: TextChannel = guild.channels.cache.find(c => c.name === courseCode.toLowerCase()) as TextChannel;
  if (channel) {
    await channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true
    });
  } else {
    throw new Error(`Channel ${courseCode} not found`);
  }
}


/**
 * 
 * @param courseCode 
 * @param user 
 * @param guild 
 * @param prefix - Course prefix (e.g., "cs", "math")
 * @param prefixMap - Map of prefixes to guild names
 * 
 * What: Makes a text channel in the guild if it has not already been made 
 * Why: Utility method so it's easier to make channels when needed
 */

export async function makeTextChannel(
  courseCode: string, 
  user: User, 
  guild: Guild | null,
  prefix?: string,
  prefixMap?: Record<string, string>
): Promise<BaseGuildTextChannel> {
  if (!guild)
    throw new Error(`Guild Not Found!`)
  
  // If prefix and prefixMap are provided, verify we're creating in the correct guild
  if (prefix && prefixMap) {
    const expectedGuildName = prefixMap[prefix.toLowerCase()];
    if (expectedGuildName && expectedGuildName.toLowerCase() !== guild.name.toLowerCase()) {
      throw new Error(`Channel ${courseCode} belongs to guild "${expectedGuildName}", but attempted to create in "${guild.name}"`);
    }
  }
  
  let channel = guild.channels.cache.find(c => c.name === courseCode.toLowerCase());
  if (channel) {
    console.log(`   Channel ${courseCode} already exists. Providing access to ${user.username}`);
    await provideUserAccess(courseCode, user, guild);
    return channel as BaseGuildTextChannel;
  }

  console.log(`   Creating new channel: ${courseCode} in guild: ${guild.name}`);
  channel = await guild.channels.create({
    name: courseCode,
    type: 0,  // GUILD_TEXT
    permissionOverwrites: [
      {
        id: guild.id, // @everyone role
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: user.id, // Specific user who gets access
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      },
      {
        id: guild.members.me?.id ?? user.id, // Bot permissions
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.ManageChannels,
        ]
      }
    ]
  });
  return channel as BaseGuildTextChannel;
}

/*
const makeTextThread = async (interaction, channel, courseSection) => {
  if (!channel) {
    console.log(" makeTextThread: undefined channel");
    return;
  }

  try {
    const activeThreads = await channel.threads.fetchActive();
    const existingThread = activeThreads.threads.find(x => x.name === courseSection);

    if (existingThread) {
      console.log(` Thread ${courseSection} already exists`);
      return existingThread;
    }

    console.log(` Creating thread: ${courseSection}`);
    const thread = await channel.threads.create({
      name: courseSection,
      autoArchiveDuration: 60,
      type: 11,  // PUBLIC_THREAD
      reason: 'Discussion for the course',
    });

    return thread;
  } catch (err) {
    console.error(" makeTextThread error:", err);
    return undefined;
  }
};

*/