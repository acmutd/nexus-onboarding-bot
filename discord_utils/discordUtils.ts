import { Guild, User, Interaction, TextChannel } from "discord.js";
import { PermissionsBitField, PermissionOverwriteManager } from "discord.js";
const fs = require("fs").promises;  // Use promises API for cleaner await

interface Course {
  course_id: string
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
        console.log(` Match found for prefix ${prefix} in guild ${guild.name}, creating/updating ${courseCode}`);
        await makeTextChannel(courseCode, user, guild);
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
export async function provideUserAccess(courseCode:string, user:User, guild:Guild){
  const channel: TextChannel = guild.channels.cache.find(c => c.name === courseCode.toLowerCase()) as TextChannel;
  if (channel) {
    console.log(` Channel ${courseCode} already exists. Updating permissions for ${user.username}`);
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

export async function makeTextChannel(courseCode: string, user: User, guild: Guild) {
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
