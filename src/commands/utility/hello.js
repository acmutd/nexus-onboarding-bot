const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('hello')
		.setDescription('Replies with Hello! How do you do!'),
	async execute(interaction) {
		await interaction.reply('Hello There!');
	},
};