import { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js'
import { ChatInputCommandInteraction } from 'discord.js'
import { findAdminJson } from '../../utils/discordUtils'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'

const ALT_DIR = path.resolve(process.cwd(), 'data', 'alternate_schools');

// List JSON files for autocomplete
function listAltJsonFiles(): string[] {
  if (!fsSync.existsSync(ALT_DIR)) return [];
  return fsSync.readdirSync(ALT_DIR).filter((f) => f.toLowerCase().endsWith('.json'));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reload-json')
        .setDescription("Reload course JSON files without restarting the bot")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Choose which course JSONs to reload')
                .setRequired(true)
                .addChoices(
                    { name: 'Single Course JSON', value: 'single' },
                    { name: 'All Course JSONs', value: 'all' }
                )
        )
        .addStringOption(opt =>
            opt
                .setName('file')
                .setDescription('Select course JSON file (required for Single Course JSON)')
                .setRequired(false)
                .setAutocomplete(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            // Check if user is admin
            const isAdmin = await findAdminJson(interaction.user.id);
            if (!isAdmin) {
                return await interaction.reply({
                    content: "You must be an admin to use this command.",
                    flags: MessageFlags.Ephemeral,
                });
            }

            const type = interaction.options.getString('type', true);
            const file = interaction.options.getString('file');

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            let reloadedItems: string[] = [];
            let errors: string[] = [];

            // Reload based on type
            if (type === 'single') {
                if (!file) {
                    return await interaction.editReply({
                        content: 'Please specify a file when reloading a single course JSON.'
                    });
                }
                try {
                    await reloadCourseJson(file);
                    reloadedItems.push(`SUCCESS: ${file}`);
                } catch (error) {
                    errors.push(`FAILED: ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            if (type === 'all') {
                const files = listAltJsonFiles();
                if (files.length === 0) {
                    return await interaction.editReply({
                        content: 'No course JSON files found in alternate_schools folder.'
                    });
                }
                for (const f of files) {
                    try {
                        await reloadCourseJson(f);
                        reloadedItems.push(`SUCCESS: ${f}`);
                    } catch (error) {
                        errors.push(`FAILED: ${f}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            }

            // Build response message
            let message = '**JSON Reload Results**\n\n';
            
            if (reloadedItems.length > 0) {
                message += reloadedItems.join('\n');
            }
            
            if (errors.length > 0) {
                if (reloadedItems.length > 0) message += '\n\n';
                message += '**Errors:**\n' + errors.join('\n');
            }

            if (reloadedItems.length === 0 && errors.length === 0) {
                message += 'No files were reloaded.';
            }

            await interaction.editReply({ content: message });

        } catch (error) {
            if (error instanceof Error) {
                const errorMessage = `Error: ${error.message}`;
                
                if (interaction.deferred) {
                    await interaction.editReply({ content: errorMessage });
                } else {
                    await interaction.reply({ 
                        content: errorMessage,
                        flags: MessageFlags.Ephemeral 
                    });
                }
            }
        }
    },

    // Autocomplete handler for file selection
    async autocomplete(interaction: any) {
        try {
            const focused = interaction.options.getFocused(true);
            if (focused.name !== 'file') return;
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
}

// Helper function to reload and validate a course JSON
async function reloadCourseJson(filename: string): Promise<void> {
    const filePath = path.join(ALT_DIR, filename);
    
    // Check if file exists
    try {
        await fs.access(filePath);
    } catch {
        throw new Error(`File not found: ${filename}`);
    }
    
    // Read and validate the JSON
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Validate it's an array
    if (!Array.isArray(parsed)) {
        throw new Error(`Invalid format: ${filename} must contain an array`);
    }
    
    console.log(`Validated course JSON: ${filename} (${parsed.length} courses)`);
}