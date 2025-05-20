require('dotenv/config');
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const {getUser} = require('./firebase_utils/getUserByDiscordId');
const {makeTextChannel} = require('./discord_utils/makeTextChannel')
const fs = require('node:fs');
const path = require('node:path');


const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}




client.login(process.env.DISCORD_BOT_TOKEN);


client.on(Events, async(interaction)=>{
	const userId = interaction.userid; 
	const guild = await client.guilds.fetch(interaction.guildId); 
	const guildMember = await guild.members.fetch(userid);
	try{
		const userData = await getUser(userid);
		const courses = userData.courses 
		courses.array.forEach(course => async()=>{
			const courseCode = course.id.split(" ");
			await makeTextChannel(interaction,courseCode[0],courseCode[1]);
		});
	}catch(error){
		if(error.code === 'not-found'){
			guildMember.send("Please make a nexus account to link with discord:(link)"); 
			guildMember.kick("After you have linked with nexus, you will have the abilty to join again");
		}
	}
});

