require('dotenv/config');
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const { getUserData, makeUserByDiscord, manUser } = require('./firebase_utils/firebaseUtils.js');
const { allocateCourseByServer } = require('./discord_utils/discordUtils.js');
const discordRoutes = require('./api/routes/discord.routes.js');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');

// ✅ Initialize Firebase Admin (if not already)
if (!admin.apps.length) {
  const serviceAccount = require('./service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
  console.log("✅ Firebase Admin initialized");
}

// ✅ Setup Express
const app = express();
const PORT = 3000;
app.use(cors());
app.use(bodyParser.json());

// ✅ Bot client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});
client.commands = new Collection();

// ✅ Load commands
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

// ✅ Load events
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

// ✅ Handle /bot/allocate POST
app.post('/bot/allocate', async (req, res) => {
  try {
    const { discordId, courses } = req.body;
    console.log("👉 Bot /bot/allocate request received:", req.body);

    if (!discordId || !courses || !Array.isArray(courses)) {
      return res.status(400).json({ error: "Missing or invalid discordId or courses" });
    }

    const userQuery = await admin.firestore().collection("users").where("discordId", "==", discordId).get();

    if (userQuery.empty) {
      return res.status(404).json({ error: "User not found" });
    }

    const userDoc = userQuery.docs[0].data();
    const servers = userDoc.servers || [];
    console.log(`✅ Found servers: ${servers}`);

    let allocated = 0;
    for (const serverId of servers) {
      const guild = client.guilds.cache.get(serverId);
      if (!guild) {
        console.log(`⚠️ Guild ${serverId} not found`);
        continue;
      }

      const member = await guild.members.fetch(discordId).catch(() => null);
      if (!member) {
        console.log(`⚠️ Member ${discordId} not found in ${guild.name}`);
        continue;
      }

      await allocateCourseByServer(courses, guild, member.user);
      console.log(`✅ Allocated courses in ${guild.name}`);
      allocated++;
    }

    if (allocated === 0) {
      return res.status(404).json({ error: "No servers processed successfully" });
    }

    res.json({ success: true, allocated });
  } catch (err) {
    console.error("❌ Bot /bot/allocate error:", err);
    res.status(500).json({ error: "Failed to allocate courses", details: err.message || err });
  }
});

// ✅ Attach Discord routes (optional)
app.use('/discord', (req, res, next) => {
  req.client = client;
  next();
}, discordRoutes);

// ✅ Start server
app.listen(PORT, () => console.log(`✅ Bot server running at http://localhost:${PORT}`));

// ✅ Handle GuildCreate
client.on(Events.GuildCreate, async (guild) => {
  await guild.members.fetch().catch(console.error);
});

// ✅ Handle GuildMemberAdd
client.on(Events.GuildMemberAdd, async (member) => {
  console.log(`New guild member joined: ${member.user.tag} (${member.user.id})`);
  // Your existing GuildMemberAdd logic unchanged
  // ...
});

// ✅ Bot login
console.log('Attempting bot login...');
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log(`✅ Bot logged in successfully as ${client.user.tag}`))
  .catch(err => console.error('❌ Bot login failed:', err));
