// Create a text channel with specific permissions

const{ChannelType, PermissionsBitField} = require('discord.js'); 

const makeTextChannelByCourse = async(guild,user,courseCode)=>{
//If channel is already made then early return
//courseCode.toLowerCase()+'-'+courseNumber.toLowerCase()
    const assumingChannel = guild.channels.cache.find(c => c.name === courseCode.toLowerCase());
    if(assumingChannel)
        return {channel:assumingChannel,hasExisted:true}; 
    
    try{
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
                    allow: [PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages],
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
        return {channel:channel,hasExisted:false};

    } catch(error){
        console.log("Error creating channel: ",error);
        throw error; 
    }
    

    return undefined; 
}
const makeTextChannel =  async(interaction, courseName)=>{
    
    //If channel is already made then it applies user perms to channel and continues
    const assumingChannel = interaction.guild.channels.cache.find(c => c.name === courseName.toLowerCase());
    if(assumingChannel){
        return assumingChannel; 

    }
    try{
        const channel = await interaction.guild.channels.create({
            name: courseName,
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
module.exports = {makeTextChannel,makeTextChannelByCourse}
