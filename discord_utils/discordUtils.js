const { PermissionsBitField } = require('discord.js');
const fs = require("fs").promises;  // Use promises API for cleaner await

const allocateCourseByServer = async (courses, guild, user) => {
  try {
    const data = await fs.readFile("data/prefix_map.json", "utf-8");
    const prefixMap = JSON.parse(data);

    for (const course of courses) {
      const parts = course.course_id.split('-');
      const prefix = parts[0].toLowerCase();
      const courseCode = (parts[1] + parts[2]).toLowerCase();

      if (prefixMap[prefix] === guild.name) {
        console.log(` Match found for prefix ${prefix} in guild ${guild.name}, creating/updating ${courseCode}`);
        await makeTextChannel(courseCode, guild, user);
      }
    }
  } catch (err) {
    console.error(" allocateCourseByServer error:", err);
  }
};

const makeTextChannel = async (courseCode, medium, user = undefined) => {
  let guild = medium;
  if (medium.type) {
    guild = medium.guild;
    user = medium.user;
  }

  let channel = guild.channels.cache.find(c => c.name === courseCode.toLowerCase());
  if (channel) {
    console.log(` Channel ${courseCode} already exists. Updating permissions for ${user.username}`);
    await channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true
    });
    return { channel, hasExisted: true };
  }

  console.log(` Creating channel: ${courseCode}`);
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
        id: guild.members.me.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.ManageChannels,
        ]
      }
    ]
  });

  return { channel, hasExisted: false };
};

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

module.exports = { makeTextChannel, makeTextThread, allocateCourseByServer };
