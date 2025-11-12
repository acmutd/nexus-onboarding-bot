// scripts/deploy-commands.ts
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { REST, Routes } from 'discord.js';

const clientId = process.env.DISCORD_CLIENT_ID!;
const guildId  = process.env.DISCORD_GUILD_ID!;
const token    = process.env.DISCORD_BOT_TOKEN!;

if (!clientId || !guildId || !token) {
  throw new Error('Missing one of DISCORD_CLIENT_ID, DISCORD_GUILD_ID, DISCORD_BOT_TOKEN in .env');
}

// Collect command JSON from src/commands/**/*
const commands: any[] = [];
const foldersPath = path.join(__dirname, '../src/commands');

if (!fs.existsSync(foldersPath)) {
  throw new Error(`Commands folder not found at ${foldersPath}`);
}

for (const folder of fs.readdirSync(foldersPath)) {
  const commandsPath = path.join(foldersPath, folder);
  if (!fs.statSync(commandsPath).isDirectory()) continue;

  for (const file of fs.readdirSync(commandsPath)) {
    if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;
    const filePath = path.join(commandsPath, file);
    const mod = require(filePath);
    const cmd = mod?.data ?? mod?.default?.data;
    if (cmd && typeof cmd.toJSON === 'function') {
      commands.push(cmd.toJSON());
      console.log(`→ loaded for deploy: ${cmd.name}`);
    } else {
      console.warn(`(skip) ${filePath} is missing "data" with toJSON()`);
    }
  }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(`🔧 Registering ${commands.length} guild command(s) to ${guildId}...`);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('Guild commands registered successfully.');
  } catch (err) {
    console.error('Failed to register commands:', err);
    process.exit(1);
  }
})();