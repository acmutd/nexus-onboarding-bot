
const { SlashCommandBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const fs = require("fs");
module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-all-servers')
        .setDescription("delete all servers"),
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
        const guilds = interaction.client.guilds.cache
        guilds.forEach(async(guild) =>{if(!guild.name.includes('server')) guild.delete()})
        //make and or set permission to course channel
        await interaction.reply({
            content: "Succesfully Deleted all servers",
            flags: MessageFlags.Ephemeral,
        });

    },

}
