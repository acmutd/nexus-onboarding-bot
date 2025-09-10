require('dotenv/config');
import { Client, ClientApplication, Events, GatewayIntentBits, Collection, ClientOptions, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getUserData, makeUserByDiscord } from './utils/firebaseUtils';
import { allocateCourseByServer, findAdminJson, addAdmin, AdminError } from './utils/discordUtils';
import discordRoutes from './api/routes/discord.routes';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('./service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
  console.log("✅ Firebase Admin initialized");
}

// Setup Express
const app = express();
const PORT = 3000;
app.use(cors());
app.use(bodyParser.json());

class ModClient extends Client {
  public commands: Collection<string, Command>;

  constructor(options: ClientOptions) {
    super(options);
    this.commands = new Collection(); // Initialize the Collection
  }
}


// Bot client
const client = new ModClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

app.use((req, res, next) => {
  req.client = client; // Attach client to all requests
  next();
});


// Load commands
const foldersPath = path.join(__dirname, 'commands');
if (fs.existsSync(foldersPath)) {
  const commandFolders = fs.readdirSync(foldersPath);
  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`${command.data.name} is processed`)
      } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    }
  }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath)
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}

async function sendWelcomeMessage(guild, userId) {
  const welcomeChannel = guild.channels.cache.find(c => c.name === 'welcome' && c.isTextBased());
  if (welcomeChannel) {
    await welcomeChannel.send({
      content: `👋 <@${userId}> Please verify your account here: [http://localhost:5173/home](http://localhost:5173/home)`,
      allowedMentions: { users: [userId] }
    });
    console.log(`✅ Sent welcome message to ${userId}`);
  } else {
    console.log(`⚠️ No welcome channel found in ${guild.name}`);
  }
}

// Attach Discord routes
app.use('/bot', discordRoutes);

// Start server
app.listen(PORT, () => console.log(`✅ Bot server running at http://localhost:${PORT}`));

client.once('ready', async () => {
  console.log('Ready!');
  try {
    const guild = await client.guilds.create({ name: 'TestGuild' });
    console.log('Created guild:', guild.id);
  } catch (e) {
    console.error('Error creating guild:', e);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
    }
  }
});


// Handle GuildCreate
client.on(Events.GuildCreate, async (guild) => {
  await guild.members.fetch().catch(console.error);
});

// Handle GuildMemberAdd
client.on(Events.GuildMemberAdd, async (member) => {
  console.log(`New guild member joined: ${member.user.tag} (${member.user.id})`);
  const guild = member.guild;
  const userId = member.user.id;

  try {
    const userData = await getUserData(userId);
    console.log(`User data found for ${userId}:`, userData);
    if (await findAdminJson(userId)) {
      try {
        await addAdmin(member, guild).catch(error => {
          if (error instanceof AdminError)
            return;
        });
      }
      catch (err) {if(err instanceof AdminError) return;}
    }
    if (!userData.discordId) {
      console.log(`User ${userId} has no Discord linked. Sending welcome message.`);
      await sendWelcomeMessage(guild, userId);
    } else if (!userData.courses || userData.courses.length === 0) {
      console.log(`User ${userId} has Discord linked but no courses. Sending welcome message.`);
      await sendWelcomeMessage(guild, userId);
    } else {
      console.log(`Allocating courses for ${userId}`);
      await allocateCourseByServer(userData.courses, guild, member.user);
    }
  } catch (err) {
    if (err instanceof Error && err.message === "User not found") {
      console.log(`User not found in Firestore. Creating guest record.`);
      await makeUserByDiscord(member);
      await sendWelcomeMessage(guild, userId);
    } else {
      console.error(` GuildMemberAdd error:`, err);
    }
  }
});

// Bot login
console.log('Attempting bot login...');
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log(`✅ Bot logged in successfully as ${client.user?.tag}`))
  .catch(err => console.error('❌ Bot login failed:', err));