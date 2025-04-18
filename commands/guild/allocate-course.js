const { SlashCommandBuilder, MessageFlags , PermissionsBitField} = require('discord.js');
const {makeTextChannel} = require('../../discord_utils/makeTextChannel'); 
const {makeTextThread} = require('../../discord_utils/makeTextThread');

module.exports = {
    data: new SlashCommandBuilder()
		.setName('add-course')
		.setDescription("dd your course to get access to your class's chat!")
        .addStringOption(option =>
            option.setName('course-code')
                .setDescription("Enter branch of your class i.e MATH CS")
        )   
        .addStringOption(option =>
            option.setName('course-number')
                .setDescription("Enter the number of your course i.e 3345 2304")
        ) 
        .addStringOption(option =>
            option.setName('course-section')
                .setDescription("Enter the section number of your course i.e 030 123 etc")
        ),    
	async execute(interaction) {

        const courseCode = await interaction.options.getString('course-code');
        const courseNumber = await interaction.options.getString('course-number');
        const courseSection = await interaction.options.getString('course-section');
        
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
        
        //make and or set permission to course channel
        const channel = await makeTextChannel(interaction,courseCode,courseNumber); 
        /** add chanel permission handeling if u wish */ 
        await channel.permissionOverwrites.edit(userId, {
            ViewChannel: true, 
            SendMessages: true,
          });
        
        //make and or set permission to section thread 
        const thread = await makeTextThread(interaction,channel,courseSection); 
        // Set thread permissions for the user
        console.log("Thread data:",thread);
        await thread.members.add(userId);
        //await thread.send(channel.name+'-'+courseSection);
		//Make and or set permissions for superdoc thread 
        const sdthread = await makeTextThread(interaction,channel,'superdoc-'+courseSection);
        await sdthread.members.add(userId);
        
        await interaction.reply({
            content: "Succesfully logged into course: "+courseCode+"-"+courseNumber+"-"+courseSection, 
            flags: MessageFlags.Ephemeral,
        });

	},
}
