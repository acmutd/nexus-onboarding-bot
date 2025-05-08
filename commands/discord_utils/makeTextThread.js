const { SlashCommandBuilder } = require("discord.js");

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
        console.log("makeTextThread Error:",error);

    }
    return undefined;
    //If the thread already exists, return it      
};

const execute = async (interaction, channel, courseSection) => {
    return await makeTextThread(interaction, channel, courseSection);
};

module.exports = { 
    data: new SlashCommandBuilder()
        .setName('makethread')
        .setDescription('Creates a thread in the specified channel.')
        .addStringOption(option => 
            option.setName('channel')
                .setDescription('The channel to create the thread in.')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('section')
                .setDescription('The section of the course.')
                .setRequired(true)),
    async execute(interaction) {
        const channelName = interaction.options.getString('channel');
        const courseSection = interaction.options.getString('section');
        const channel = interaction.guild.channels.cache.find(c => c.name === channelName && c.type === 0); // 0 = GUILD_TEXT

        if (!channel) {
            await interaction.reply(`Channel ${channelName} not found.`);
            return;
        }

        const thread = await execute(interaction, channel, courseSection);
        if (thread) {
            await interaction.reply(`Thread created: ${thread.name}`);
        } else {
            await interaction.reply(`Failed to create thread.`);
        }
    }
    //execute: execute, 
}; 
