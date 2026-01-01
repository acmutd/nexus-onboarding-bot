/// <reference path="./@types/express.d.ts" />
require('dotenv/config');

import {
  Client,
  Events,
  GatewayIntentBits,
  Collection,
  ClientOptions,
  MessageFlags,
  ChatInputCommandInteraction,
  REST,
  Routes,
  TextChannel,
  ChannelType,
} from 'discord.js';

import { getUserData } from './utils/firebaseUtils';
import { allocateCourseByServer, findAdminJson, addAdmin, AdminError, removeAllCourseAccess } from './utils/discordUtils';
import discordRoutes from './api/routes/discord.routes';

import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import admin from 'firebase-admin';

// ---------- Firebase Admin ----------
if (!admin.apps.length) {
  const serviceAccount = require('../service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
  console.log(' Firebase Admin initialized');
}

// ---------- Firestore Listener for Discord Unlinks ----------
const db = admin.firestore();

// Debouncing: Store pending unlink operations to prevent redundant processing
const pendingUnlinks = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_DELAY = 2000; // 2 seconds

// cascade into a function
async function handleDiscordUnlink(discordId: string) {
  try {
    console.log(`Processing unlink for ${discordId}`);
    
    // Get all guilds and remove access
    const guilds = await client.guilds.fetch();
    for (const [guildId, guild] of guilds) {
      try {
        const fullGuild = await client.guilds.fetch(guildId);
        const member = await fullGuild.members.fetch(discordId).catch(() => null);
        
        if (member) {
          await removeAllCourseAccess(member.user, fullGuild);
          console.log(`Removed course access for ${member.user.username} in ${fullGuild.name}`);
        }
      } catch (err) {
        // User not in this guild or other error, continue
      }
    }
  } catch (error) {
    console.error('Error removing course access on unlink:', error);
  }
}

db.collection('users').onSnapshot((snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'modified') {
      const before = change.doc.data();
      const after = change.doc.data();
      
      // Check if Discord was unlinked (had discord.id before, doesn't now)
      if (before.discord?.id && !after.discord?.id) {
        const discordId = before.discord.id;
        console.log(` Discord unlink detected for user ${discordId}`);
        
        // If there's already a pending operation for this user, cancel it
        if (pendingUnlinks.has(discordId)) {
          clearTimeout(pendingUnlinks.get(discordId)!);
          console.log(`  Reset debounce timer for ${discordId}`);
        }
        
        // Schedule the operation after the delay
        const timeoutId = setTimeout(async () => {
          await handleDiscordUnlink(discordId);
          
          // Clean up
          pendingUnlinks.delete(discordId);
        }, DEBOUNCE_DELAY);
        
        // Store the timeout so we can cancel it if needed
        pendingUnlinks.set(discordId, timeoutId);
        console.log(` Scheduled unlink processing for ${discordId} in ${DEBOUNCE_DELAY}ms`);
      }
    }
  });
});

// ---------- Express ----------
const app = express();
const PORT = process.env.PORT || 3001; // Use environment variable or default to 3001
app.use(cors());
app.use(bodyParser.json());

// Shape of a command module we expect
type Command = {
  data: { name: string; toJSON: () => any };
  execute: (interaction: ChatInputCommandInteraction) => Promise<any>;
  autocomplete?: (interaction: any) => Promise<void>; // Add optional autocomplete function
};

class ModClient extends Client {
  public commands: Collection<string, Command>;
  constructor(options: ClientOptions) {
    super(options);
    this.commands = new Collection();
  }
}

// ---------- Discord Client ----------
const client = new ModClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Attach client to all requests
app.use((req, _res, next) => {
  req.client = client;
  next();
});

// Attach Discord routes
app.use('/api/discord', discordRoutes);

// Start HTTP server
app.listen(PORT, () => console.log(` Bot server running at http://localhost:${PORT}`));

// ---------- Load Commands (TS + JS) ----------
const commandsDir = path.join(__dirname, 'commands');

function loadRuntimeCommands() {
  if (!fs.existsSync(commandsDir)) {
    console.warn(`[WARN] Commands folder not found at ${commandsDir}`);
    return;
  }
  const folders = fs.readdirSync(commandsDir);
  for (const folder of folders) {
    const commandsPath = path.join(commandsDir, folder);
    if (!fs.statSync(commandsPath).isDirectory()) continue;

    const files = fs
      .readdirSync(commandsPath)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

    for (const file of files) {
      const filePath = path.join(commandsPath, file);
      const mod = require(filePath);
      const command: Command | undefined = mod?.default ?? mod;

      if (command?.data?.name && typeof command.execute === 'function') {
        client.commands.set(command.data.name, command);
        console.log(` loaded command: ${command.data.name}`);
      } else {
        console.warn(`[WARN] ${filePath} is missing "data" (with name) or "execute"`);
      }
    }
  }
}

async function collectCommandJSON(): Promise<any[]> {
  const out: any[] = [];
  if (!fs.existsSync(commandsDir)) return out;

  for (const folder of fs.readdirSync(commandsDir)) {
    const commandsPath = path.join(commandsDir, folder);
    if (!fs.statSync(commandsPath).isDirectory()) continue;

    for (const file of fs.readdirSync(commandsPath)) {
      if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;
      const filePath = path.join(commandsPath, file);
      const mod = require(filePath);
      const data = mod?.data ?? mod?.default?.data;
      if (data && typeof data.toJSON === 'function') {
        out.push(data.toJSON());
        console.log(` queued for deploy: ${data.name}`);
      } else {
        console.warn(`(skip) ${filePath} missing "data" with toJSON()`);
      }
    }
  }
  return out;
}

// Load runtime commands now
loadRuntimeCommands();

// ---------- Load Events (TS + JS) ----------
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
    console.log(` loaded event: ${event.name}`);
  }
}

// ---------- Memory Monitoring Helper ----------
function logMemoryStats() {
  const mem = process.memoryUsage();
  const formatMB = (bytes: number) => `${Math.round(bytes / 1024 / 1024)}MB`;
  
  console.log('\nMemory Stats:');
  console.log(`RSS (Total): ${formatMB(mem.rss)}`);
  console.log(`Heap Used: ${formatMB(mem.heapUsed)}`);
  console.log(`Heap Total: ${formatMB(mem.heapTotal)}`);
  console.log(`External: ${formatMB(mem.external)}`);
}

// ---------- Periodic Member Cache Clearing (Memory Optimization) ----------
// Clears member cache every hour to free RAM
// Safe because: member data can be refetched, Firestore has all critical data
const CACHE_CLEAR_INTERVAL = 60 * 60 * 1000; // 1 hour

function clearMemberCache() {
  let totalCleared = 0;
  let totalMemoryFreed = 0;
  
  client.guilds.cache.forEach(guild => {
    const memberCount = guild.members.cache.size;
    totalCleared += memberCount;
    totalMemoryFreed += memberCount * 30; // ~30KB per member
    
    guild.members.cache.clear();
  });
  
  if (totalCleared > 0) {
    console.log(` Cleared ${totalCleared} cached members, freed ~${Math.round(totalMemoryFreed / 1024)}MB`);
  }
}

// ---------- Auto-deploy to ALL joined guilds on Ready ----------
client.once(Events.ClientReady, async (c) => {
  await c.application?.fetch();
  console.log(` Ready as ${c.user.tag} (app id: ${c.application?.id})`);
  
  // Log initial memory usage
   logMemoryStats();
  
  // Log memory every 5 minutes 
   setInterval(logMemoryStats, 5 * 60 * 1000);
  
  // Clear member cache every hour to keep memory usage low
  setInterval(clearMemberCache, CACHE_CLEAR_INTERVAL);
  console.log(`Member cache clearing scheduled every ${CACHE_CLEAR_INTERVAL / 60000} minutes`);

  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
  const clientId = c.application?.id;
  if (!token || !clientId) {
    console.error(' Missing DISCORD_TOKEN or DISCORD_BOT_TOKEN or client/application ID');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const body = await collectCommandJSON();

  const guilds = await c.guilds.fetch(); // fetch to ensure cache is populated
  console.log(` Deploying ${body.length} command(s) to ${guilds.size} guild(s)...`);

  for (const [guildId, guild] of guilds) {
    try {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
      
      // Try to create an invite link
      let inviteInfo = '';
      try {
        // Get the first available text channel to create an invite
        const fullGuild = await c.guilds.fetch(guildId);
        const channels = await fullGuild.channels.fetch();
        const textChannel = channels.find(channel => 
          channel?.type === ChannelType.GuildText &&
          channel.permissionsFor(fullGuild.members.me!)?.has('CreateInstantInvite')
        ) as TextChannel;
        
        if (textChannel) {
          const invite = await textChannel.createInvite({
            maxAge: 0, // Never expires
            maxUses: 0, // Unlimited uses
            reason: 'Bot deployment logging'
          });
          inviteInfo = ` | Invite: ${invite.url}`;
        }
      } catch (inviteError) {
        // If we can't create an invite, just continue without it
        inviteInfo = ' | No invite permissions';
      }
      
      console.log(` Deployed to guild "${guild.name}" (${guildId})${inviteInfo}`);
    } catch (e) {
      console.error(` Failed to deploy to guild "${guild.name}" (${guildId}):`, e);
    }
  }
});

// ---------- Interaction handling ----------
client.on(Events.InteractionCreate, async (interaction) => {
  // Handle autocomplete interactions
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found for autocomplete.`);
      return;
    }

    try {
      if (command.autocomplete) {
        await command.autocomplete(interaction);
      }
    } catch (error) {
      console.error('Error handling autocomplete:', error);
    }
    return;
  }

  // Handle slash command interactions
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    console.log(`\nCommand triggered: ${interaction.commandName}`);
    // logMemoryStats();
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const payload = {
      content: 'There was an error while executing this command!',
      flags: MessageFlags.Ephemeral,
    } as const;

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
});

// ---------- Member events ----------
client.on(Events.GuildCreate, async (guild) => {
  console.log(`\nBot added to new guild: ${guild.name}`);
  // logMemoryStats();
  await guild.members.fetch().catch(console.error);
});

client.on(Events.GuildMemberAdd, async (member) => {
  console.log(`\nNew guild member joined: ${member.user.tag} (${member.user.id}) in guild: ${member.guild.name}`);
  // logMemoryStats();
  const guild = member.guild;
  const userId = member.user.id;

  try {
    const userData = await getUserData(userId);
    console.log(` User data found for ${userId}:`, JSON.stringify(userData, null, 2));

    if (await findAdminJson(userId)) {
      console.log(` User ${userId} is an admin, promoting...`);
      try {
        await addAdmin(member, guild).catch((error) => {
          if (error instanceof AdminError) return;
        });
      } catch (err) {
        if (err instanceof AdminError) return;
      }
    }

    if (!userData.discord || !userData.discord.id) {
      console.log(` User ${userId} has no Discord linked.`);
    } else if (!userData.courses || userData.courses.length === 0) {
      console.log(` User ${userId} has Discord linked but no courses.`);
    } else {
      console.log(` Allocating ${userData.courses.length} courses for ${userId} in guild ${guild.name}`);
      console.log(` Courses:`, userData.courses);
      await allocateCourseByServer(userData.courses, guild, member.user);
    }
  } catch (err: any) {
    if (err instanceof Error && err.message === 'User not found') {
      console.log(` User not found in Firestore (no account yet).`);
    } else {
      console.error(` GuildMemberAdd error for ${userId}:`, err);
    }
  }
});

// ---------- Login ----------
const TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
  console.error(' Missing DISCORD_TOKEN in .env');
  process.exit(1);
}

console.log('Attempting bot login...');
client
  .login(TOKEN)
  .then(() => console.log(` Bot logged in as ${client.user?.tag}`))
  .catch((err) => console.error(' Bot login failed:', err));