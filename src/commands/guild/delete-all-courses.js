
const { SlashCommandBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const fs = require("fs");
module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-all-courses')
        .setDescription("delete all courses"),
    async execute(interaction) {
        const userId = interaction.user.id;
        //const member = await interaction.guild.members.fetch(userId); 
        if (!interaction.guild.members.me.permissions.has([
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.ManageRoles,
        ])) {
            return await interaction.reply({
                content: "I don't have permission to create channels or manage roles!",
                flags: MessageFlags.Ephemeral,
            });
        }

        interaction.guild.channels.cache.forEach(async(channel)=>{
            if(channel.name.toLowerCase() != "general")
                interaction.guild.channels.delete(channel.id)
        })
        //make and or set permission to course channel
        await interaction.reply({
            content: "Succesfully logged into all courses",
            flags: MessageFlags.Ephemeral,
        });

    },

}
