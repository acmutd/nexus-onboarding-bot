// Create a text channel with specific permissions

const { ChannelType, PermissionsBitField } = require('discord.js');

const makeTextChannel = async (courseCode, medium, user=undefined)=>{
    let guild = medium
    //Checks if we are passing an interaction or guild to the function 
    if (medium.type){
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

module.exports = { makeTextChannel }
