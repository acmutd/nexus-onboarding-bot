require('dotenv/config');
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const { getUserData, makeUserByDiscord } = require('./firebase_utils/firebaseUtils.js');
const { allocateCourseByServer } = require('./discord_utils/discordUtils.js');
const discordRoutes = require('./api/routes/discord.routes.js');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');

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

// Bot client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});
client.commands = new Collection();

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
    const event = require(filePath);
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
/*
// Expose bot guilds
app.get('/bot/guilds', (req, res) => {
  const guilds = client.guilds.cache.map(g => ({
    id: g.id,
    name: g.name
  }));
  res.json({ guilds });
});

// Handle /bot/allocate POST
app.post('/bot/allocate', async (req, res) => {
  try {
    const { discordId, courses } = req.body;
    console.log("👉 Bot /bot/allocate request received:", req.body);

    if (!discordId || !courses || !Array.isArray(courses)) {
      return res.status(400).json({ error: "Missing or invalid discordId or courses" });
    }

    const userQuery = await admin.firestore().collection("users").where("discordId", "==", discordId).get();

    if (userQuery.empty) {
      console.log(`❌ User with Discord ID ${discordId} not found in Firestore`);
      return res.status(404).json({ error: "User not found" });
    }

    const userDoc = userQuery.docs[0].data();
    const servers = userDoc.servers || [];
    console.log(`✅ Found servers from Firestore: ${servers}`);
    console.log("🔍 Bot's guild cache:", client.guilds.cache.map(g => `${g.name} (${g.id})`));

    let allocated = 0;
    for (const serverId of servers) {
      const guild = await fetchGuildById(client, serverId);
      if (!guild) {
        console.log(`⚠️ Guild ${serverId} not found or could not be fetched`);
        continue;
      }

      const member = await fetchMemberWithRetry(guild, discordId);
      if (!member) {
        console.log(`⚠️ Member ${discordId} not found in ${guild.name} after retries`);
        continue;
      }

      await allocateCourseByServer(courses, guild, member.user);
      console.log(`✅ Allocated courses in ${guild.name}`);
      allocated++;
    }

    if (allocated === 0) {
      console.log(`❌ No servers processed successfully for ${discordId}`);
      return res.status(404).json({ error: "No servers processed successfully" });
    }

    res.json({ success: true, allocated });
  } catch (err) {
    console.error("❌ Bot /bot/allocate error:", err);
    res.status(500).json({ error: "Failed to allocate courses", details: err.message || err });
  }
});
*/
// Attach Discord routes
app.use('/bot', (req, res, next) => {
  req.client = client;
  next();
}, discordRoutes);

// Start server
app.listen(PORT, () => console.log(`✅ Bot server running at http://localhost:${PORT}`));

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
    if (err.code === 'not-found') {
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
  .then(() => console.log(`✅ Bot logged in successfully as ${client.user.tag}`))
  .catch(err => console.error('❌ Bot login failed:', err));