require('dotenv/config');
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const {getUserData,makeUserByDiscord} = require('./firebase_utils/firebaseUtils.js');
const {allocateCourseByServer} = require('./discord_utils/discordUtils.js');
const discordRoutes = require('./api/routes/discord.routes.js');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express(); 

app.use(cors()); 
app.use(bodyParser.json());

const PORT = 3000; 
app.listen(PORT,()=> console.log(`Endpoint opened on port ${PORT}`));




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

client.on(Events.GuildMemberAdd, async(member)=>{
	console.log('New guild memeber joined');
	try{
		const userData = await getUserData(member.user.id);
		const courses = userData.courses; 
		//If no courses found means that they aren't fully registerd
		if(!courses)
			//Adds current server to the list of servers to unlock courses later
			await manUser(member.user.id,async(userRef)=>{
				let servers = userRef.data().servers;
				if(!servers)
					servers = [];
				if(!servers.includes(member.guild.id))
					servers.append(member.guild.id);
				await userRef.update({"servers":servers})
			})
		else
			//Else if user is registered fully, then provides them all the courses for this current server
			await allocateCourseByServer(courses,member.guild,member.user);
	}catch(error){
		//If user was found and there was an error then console log the error
		if(error.code != 'not-found'){
			console.error(error);
		}
		//If user was not found, make a new user in UserDb for it
		else{
			//Make guest discord user
			await makeUserByDiscord(member);
		}

	}
});


client.login(process.env.DISCORD_BOT_TOKEN);

//custom endpoint 


app.use('/discord',(req,res,next)=>{
	req.client = client; //attach discord client to the request
	next();//proceed to routes
},discordRoutes);



