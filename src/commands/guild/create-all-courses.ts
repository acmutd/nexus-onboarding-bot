import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionsBitField,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { findAdminJson } from '../../utils/discordUtils';

// paths
// JSONs live in:   ./data/alternate_schools/*.json
// Prefix map: try ./data/prefix_map.json, then ./api/data/prefix_map.json (fallback)
const ALT_DIR = path.resolve(process.cwd(), 'data', 'alternate_schools');
const PREFIX_MAP_CANDIDATES = [
  path.resolve(process.cwd(), 'data', 'prefix_map.json'),
  path.resolve(process.cwd(), 'api', 'data', 'prefix_map.json'),
];

// types
type Course = {
  course_number: string;       // e.g., "CS 2305", "CS2305", or "7v86"
  course_prefixes?: string[];  // e.g., ["eesc"] (preferred if present)
  instructors?: string[];      // e.g., ["Faris Mismar"]
};

// ===== Helpers =====
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function loadPrefixMap(): Promise<Record<string, string>> {
  for (const p of PREFIX_MAP_CANDIDATES) {
    try {
      const raw = await fsp.readFile(p, 'utf-8');
      return JSON.parse(raw);
    } catch (_) {
      /* continue */
    }
  }
  return {}; // no map -> fallback to lowercasing prefix
}

function sanitizeToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-_]/g, '');
}

// Priority:
//  1) prefix: course.course_prefixes[0] (if present) -> mapped via prefixMap (case-insensitive)
//  2) else prefix: leading letters of course_number (e.g., "CS" from "CS 2305")
//  number: remainder of course_number after the chosen prefix (e.g., "2305", or "7v86")
function splitCourseParts(course: Course, prefixMap: Record<string, string>): { prefix: string; number: string } {
  const rawNumber = (course.course_number ?? '').toString().trim();
  const cleaned = rawNumber.replace(/\s+/g, ''); // "CS 2305" -> "CS2305"

  // Resolve prefix
  let prefix = '';
  if (course.course_prefixes && course.course_prefixes.length > 0) {
    const p0 = course.course_prefixes[0].trim();
    const key = p0.toUpperCase();
    prefix = sanitizeToken(prefixMap[key] ?? p0);
  } else {
    const leadLetters = cleaned.match(/^[A-Za-z]+/);
    if (leadLetters) {
      const key = leadLetters[0].toUpperCase();
      prefix = sanitizeToken(prefixMap[key] ?? leadLetters[0]);
    }
  }

  // Resolve number (everything after the prefix if we found one; else the whole cleaned token)
  let number = '';
  if (prefix) {
    const prefLen = cleaned.toLowerCase().startsWith(prefix) ? prefix.length
                    : cleaned.toUpperCase().startsWith(prefix.toUpperCase()) ? prefix.length
                    : cleaned.match(/^[A-Za-z]+/)?.[0]?.length ?? 0; // if mapped prefix differs in case
    number = cleaned.slice(prefLen);
  } else {
    number = cleaned; // no prefix found; just use the entire cleaned course_number (handles "7v86")
  }

  // Final sanitization & fallbacks
  prefix = sanitizeToken(prefix);
  number = sanitizeToken(number);

  // If number ended up empty, try to salvage digits/letters from the original
  if (!number) {
    const salvage = rawNumber.replace(/\s+/g, '').toLowerCase();
    number = sanitizeToken(salvage);
  }

  if (!prefix) prefix = 'course'; // last-resort prefix

  return { prefix, number };
}

function profLastName(instructors?: string[]): string {
  if (!instructors) return 'staff';
  const firstNonEmpty = instructors.find((n) => n && n.trim().length > 0);
  if (!firstNonEmpty) return 'staff';
  const parts = firstNonEmpty.trim().split(/\s+/);
  return sanitizeToken(parts[parts.length - 1] || 'staff');
}

// Build channel name: "<prefix>-<number>-<prof>"
function buildChannelName(course: Course, prefixMap: Record<string, string>): string {
  const { prefix, number } = splitCourseParts(course, prefixMap);
  const last = profLastName(course.instructors);
  const name = `${prefix}-${number}-${last}`.slice(0, 100);
  return name;
}

// List JSON files for autocomplete
function listAltJsonFiles(): string[] {
  if (!fs.existsSync(ALT_DIR)) return [];
  return fs.readdirSync(ALT_DIR).filter((f) => f.toLowerCase().endsWith('.json'));
}

async function readCoursesFromFile(filename: string): Promise<Course[]> {
  const filePath = path.join(ALT_DIR, filename);
  const raw = await fsp.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as Course[];
}

module.exports = {
  // === Command with dynamic autocomplete ===
  data: new SlashCommandBuilder()
    .setName('create-all-courses')
    .setDescription('Create text channels for all courses from a chosen JSON (in data/alternate_schools).')
    .addStringOption((opt) =>
      opt
        .setName('json')
        .setDescription('JSON filename from data/alternate_schools')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addBooleanOption((opt) =>
      opt
        .setName('dryrun')
        .setDescription('Preview without creating channels')
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // === Main execution ===
  async execute(interaction: ChatInputCommandInteraction) {
    // Check if user is admin
    const isAdmin = await findAdminJson(interaction.user.id);
    if (!isAdmin) {
      return await interaction.reply({
        content: "You must be an admin to use this command.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.guild) {
      return interaction.reply({
        content: 'This command can only be used inside a server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const me = interaction.guild.members.me;
    if (
      !me ||
      !me.permissions.has([
        PermissionsBitField.Flags.ManageChannels,
        // Add ManageRoles if you later set channel overwrites per course role
      ])
    ) {
      return interaction.reply({
        content: "I don't have permission to create channels.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const filename = interaction.options.getString('json', true);
    const dryRun = interaction.options.getBoolean('dryrun') ?? false;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // Validate selection
      const files = listAltJsonFiles();
      if (!files.includes(filename)) {
        return await interaction.editReply({
          content:
            `File "${filename}" not found in data/alternate_schools.\n` +
            `Available: ${files.map((f) => `\`${f}\``).join(', ') || '(none found)'}`,
        });
      }

      const prefixMap = await loadPrefixMap();
      const courses = await readCoursesFromFile(filename);

      let created = 0;
      let skipped = 0;

      for (const course of courses) {
        const channelName = buildChannelName(course, prefixMap);

        const exists = interaction.guild.channels.cache.find(
          (c) => c.type === ChannelType.GuildText && c.name === channelName,
        );
        if (exists) {
          skipped++;
          continue;
        }

        if (!dryRun) {
          await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            reason: `Created by /create-all-courses using ${filename}`,
            permissionOverwrites: [
              {
                id: interaction.guild.id, // @everyone role
                deny: [PermissionFlagsBits.ViewChannel],
              },
              {
                id: interaction.guild.members.me?.id!, // Bot permissions
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.SendMessages,
                ],
              },
            ],
          });
          await sleep(150); // gentle pacing for rate limits
        }

        created++;
      }

      await interaction.editReply({
        content:
          `Done for **${filename}**\n` +
          `Total in JSON: **${courses.length}**\n` +
          `Created: **${created}** | Skipped (exists): **${skipped}**\n` +
          (dryRun ? `Mode: **DRY RUN** (no changes made)` : ''),
      });
    } catch (err: any) {
      console.error('create-all-courses error:', err);
      await interaction.editReply({
        content: `Error: ${err?.message ?? 'Unknown error.'}`,
      });
    }
  },

  // === Autocomplete handler (Discord calls this as the user types) ===
  async autocomplete(interaction: any) {
    try {
      const focused = interaction.options.getFocused(true);
      if (focused.name !== 'json') return;
      const all = listAltJsonFiles();
      const query = String(focused.value || '').toLowerCase();
      const filtered = all
        .filter((f) => f.toLowerCase().includes(query))
        .slice(0, 25)
        .map((f) => ({ name: f, value: f }));
      await interaction.respond(filtered);
    } catch (e) {
      console.error('autocomplete error:', e);
      await interaction.respond([]);
    }
  },
};