const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const { ChannelType, PermissionsBitField } = require('discord.js');
const fs = require("fs");


const allocateCourseByServer = async (courses, guild, user) => {
    fs.readFile("data/prefix_map.json", "utf-8", async (err, data) => {
        if (err) {
            console.log("File read failed:", err)
            return;
        }
        const prefixMap = JSON.parse(data);
        courses.forEach(async(course)=>{
            const prefix = course.split('-')[0].toLowerCase();
            const courseCode = course.split('-')[1]+course.split('-')[2].toLowerCase();
            if(prefixMap[prefix]==guild.name)
                makeTextChannel(courseCode,guild,user);
        })
    })
}

const makeTextChannel = async (courseCode, medium, user = undefined) => {
    let guild = medium
    //Checks if we are passing an interaction or guild to the function 
    if (medium.type) {
        guild = medium.guild
        user = medium.user
    }

    const assumingChannel = guild.channels.cache.find(c => c.name === courseCode.toLowerCase());
    if (assumingChannel)
        return { channel: assumingChannel, hasExisted: true };

    const channel = await guild.channels.create({
        name: courseCode,
        type: 0, // 0 = Text channel
        permissionOverwrites: [
            {
                id: guild.id, // Default everyone role
                deny: [PermissionsBitField.Flags.ViewChannel], // Hide the channel from everyone
            },
            {
                id: user.id, // Grant access to the command user
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
            },
            {
                id: guild.members.me.id, // Bot
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.ManageChannels,
                    //PermissionsBitField.Flags.ManageRoles,
                ],
            }
        ],
    });
    //await interaction.reply(`Created channel: ${channel.name}`);
    return { channel: channel, hasExisted: false };
}

const makeTextThread = async (interaction, channel, courseSection) => {

    //If there is a channel
    if (!channel) {
        console.log("makeTextThread: undefined channel");
        return;
    }
    try {
        const activeThreads = await channel.threads.fetchActive();
        console.log("Active Threads in Channel: ", activeThreads.threads);
        const assumingThread = channel.threads.cache.find(x => x.name === courseSection);// 

        if (assumingThread)
            return assumingThread;

        //else make thread  
        const thread = await channel.threads.create({
            name: courseSection,
            autoArchiveDuration: 60, // Auto-archive after 60 minutes of inactivity
            type: 11, // 11 = Public thread
            reason: 'Discussion for the course',
        });
        //await interaction.reply(`Thread created: ${thread.name}`);
        return thread;
    } catch (error) {
        console.log("makeTextThread Error:", error);

    }
    return undefined;
    //If the thread already exists, return it      
}

module.exports = {makeTextChannel, makeTextThread, allocateCourseByServer}