// Create a text channel with specific permissions

const{ChannelType, PermissionsBitField} = require('discord.js'); 

const makeTextChannel =  async(interaction, courseCode, courseNumber)=>{
    
    //If channel is already made then it applies user perms to channel and continues
    const assumingChannel = interaction.guild.channels.cache.find(c => c.name === courseCode.toLowerCase()+'-'+courseNumber.toLowerCase());
    if(assumingChannel){
        return assumingChannel; 

    }
    try{
        const channel = await interaction.guild.channels.create({
            name: courseCode+'-'+courseNumber,
            type: 0, // 0 = Text channel
            permissionOverwrites: [
                {
                    id: interaction.guild.id, // Default @everyone role
                    deny: [PermissionsBitField.Flags.ViewChannel], // Hide the channel from everyone
                },
                {
                    id: interaction.user.id, // Grant access to the command user
                    allow: [PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages],
                },
                {
                    id: interaction.guild.members.me.id, // Bot
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.ManageChannels,
                        //PermissionsBitField.Flags.ManageRoles,
                    ],
                }
            ],
        }); 
        //figure out a way to only reply to the user who used the command
        //await interaction.reply(`Created channel: ${channel.name}`);
        return channel;

    } catch(error){
        console.log("Error creating channel: ",error);
        await interaction.reply(`Sorry there was an error creating a channel`); 
    }
    

    return undefined; 

    
     

}
module.exports = {makeTextChannel}
