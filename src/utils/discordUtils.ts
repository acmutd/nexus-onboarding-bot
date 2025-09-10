import { Guild, User, Interaction, TextChannel, BaseGuildTextChannel, GuildMember } from "discord.js";
import { PermissionsBitField, PermissionOverwriteManager } from "discord.js";
const fs = require("fs").promises;  // Use promises API for cleaner await
import { readFile, writeFile } from 'fs/promises';

interface Course {
  course_id: string
}
interface Admins {
  admins: string[]
}
export class AdminError extends Error{
    constructor(mssg:string){
        super(mssg)
    }
}

const ADMIN_FILE = "data/admin.json"

export async function addAdmin(target:unknown, guild: Guild) {
    if (!(target instanceof GuildMember)) {
        throw new AdminError("Can only promote Guild Members")
    }
    const adminRole = guild?.roles.cache.get("admin");
    if (!adminRole) {
        throw new AdminError("admin role not found")
    }
    await addAdminJson(target.id);
    if (target.roles.cache.has("admin")) {
        throw new AdminError(`${target.displayName} is already an Admin`)
    }

    await target.roles.add(adminRole)
    
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
    console.log(`✅ Added ${userId} to admins list`);
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
    console.log(`✅ Added ${userId} to admins list`);
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
    const data = await fs.readFile("data/prefix_map.json", "utf-8");
    const prefixMap = JSON.parse(data);

    for (const course of courses) {
      const parts = course.course_id.split('-');
      const prefix = parts[0].toLowerCase();
      const courseCode = (parts[1] + parts[2]).toLowerCase();

      if (prefixMap[prefix] === guild.name) {
        console.log(`✅ Match found for prefix ${prefix} in guild ${guild.name}, creating/updating ${courseCode}`);
        await makeTextChannel(courseCode, user, guild);
      }
    }
  } catch (err) {
    console.error("❌ allocateCourseByServer error:", err);
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
    console.log(`ℹ️ Channel ${courseCode} already exists. Updating permissions for ${user.username}`);
    await channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true
    });
  }
}


/**
 * 
 * @param courseCode 
 * @param user 
 * @param guild 
 * 
 * What: Makes a text channel in the guild if it has not already been made 
 * Why: Utility method so it's easier to make channels when needed
 */

export async function makeTextChannel(courseCode: string, user: User, guild: Guild | null): Promise<BaseGuildTextChannel> {
  if (!guild)
    throw new Error(`Guild Not Found!`)
  let channel = guild.channels.cache.find(c => c.name === courseCode.toLowerCase());
  if (channel) {
    throw new Error(`${channel.name} already exists`);
  }

  console.log(`Creating channel: ${courseCode}`);
  channel = await guild.channels.create({
    name: courseCode,
    type: 0,  // GUILD_TEXT
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: user.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      },
      {
        id: guild.members.me?.id ?? user.id,
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
    console.log("❌ makeTextThread: undefined channel");
    return;
  }

  try {
    const activeThreads = await channel.threads.fetchActive();
    const existingThread = activeThreads.threads.find(x => x.name === courseSection);

    if (existingThread) {
      console.log(`ℹ️ Thread ${courseSection} already exists`);
      return existingThread;
    }

    console.log(`✅ Creating thread: ${courseSection}`);
    const thread = await channel.threads.create({
      name: courseSection,
      autoArchiveDuration: 60,
      type: 11,  // PUBLIC_THREAD
      reason: 'Discussion for the course',
    });

    return thread;
  } catch (err) {
    console.error("❌ makeTextThread error:", err);
    return undefined;
  }
};

*/
