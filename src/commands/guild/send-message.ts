import { SlashCommandBuilder, MessageFlags, PermissionFlagsBits, ChannelType, AttachmentBuilder, OAuth2Guild } from 'discord.js'
import { ChatInputCommandInteraction, TextChannel } from 'discord.js'
import { findAdminJson } from '../../utils/discordUtils'
import https from 'https'
import http from 'http'

module.exports = {
    data: new SlashCommandBuilder()
        .setName('send-message')
        .setDescription("Send a message to a specific channel")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('server')
                .setDescription('The server to send the message in')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option
                .setName('channel')
                .setDescription('The channel name to send the message to')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('input-type')
                .setDescription('How to provide the message content')
                .setRequired(true)
                .addChoices(
                    { name: 'Type Message', value: 'text' },
                    { name: 'Upload .txt File', value: 'file' }
                )
        )
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('The message to send (required if Type Message is selected)')
                .setRequired(false)
        )
        .addAttachmentOption(option =>
            option
                .setName('file')
                .setDescription('A .txt file containing the message content (required if Upload File is selected)')
                .setRequired(false)
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

            const serverId = interaction.options.getString('server', true);
            const channelName = interaction.options.getString('channel', true);
            const inputType = interaction.options.getString('input-type', true);
            const messageText = interaction.options.getString('message');
            const attachment = interaction.options.getAttachment('file');

            // Validate input based on type
            if (inputType === 'text') {
                if (!messageText) {
                    return await interaction.reply({
                        content: "Please provide a message when using 'Type Message' option.",
                        flags: MessageFlags.Ephemeral,
                    });
                }
            } else if (inputType === 'file') {
                if (!attachment) {
                    return await interaction.reply({
                        content: "Please upload a .txt file when using 'Upload File' option.",
                        flags: MessageFlags.Ephemeral,
                    });
                }
                if (!attachment.name.endsWith('.txt')) {
                    return await interaction.reply({
                        content: "Please upload a .txt file.",
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }

            // Defer reply since we may need to download the file
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // Get message content based on input type
            let messageContent: string;
            if (inputType === 'text') {
                messageContent = messageText!;
            } else {
                messageContent = await downloadTextFile(attachment!.url);
            }

            if (!messageContent || messageContent.trim().length === 0) {
                return await interaction.editReply({
                    content: "The message content is empty.",
                });
            }

            let successCount = 0;
            let failedServers: string[] = [];

            // If "all" is selected, send to all servers
            if (serverId === 'all') {
                const guilds = await interaction.client.guilds.fetch();
                
                for (const [guildId, guildData] of guilds) {
                    try {
                        const guild = await interaction.client.guilds.fetch(guildId);
                        const channels = await guild.channels.fetch();
                        const targetChannel = channels.find(
                            (c) => c && c.type === ChannelType.GuildText && c.name.toLowerCase() === channelName.toLowerCase()
                        ) as TextChannel | undefined;

                        if (targetChannel) {
                            await targetChannel.send(messageContent);
                            successCount++;
                        } else {
                            failedServers.push(`${guild.name} (channel not found)`);
                        }
                    } catch (error) {
                        failedServers.push(`${guildData.name} (error)`);
                    }
                }

                let message = `Sent message to ${successCount} server(s).`;
                if (failedServers.length > 0) {
                    message += `\n\nFailed in:\n${failedServers.join('\n')}`;
                }

                return await interaction.editReply({ content: message });
            } else {
                // Send to a single server
                const guild = await interaction.client.guilds.fetch(serverId).catch(() => null);
                if (!guild) {
                    return await interaction.editReply({
                        content: "Could not find the selected server.",
                    });
                }

                // Find the channel by name
                const channels = await guild.channels.fetch();
                const targetChannel = channels.find(
                    (c) => c && c.type === ChannelType.GuildText && c.name.toLowerCase() === channelName.toLowerCase()
                ) as TextChannel | undefined;

                if (!targetChannel) {
                    return await interaction.editReply({
                        content: `Could not find channel "${channelName}" in ${guild.name}.`,
                    });
                }

                // Send the message to the target channel
                await targetChannel.send(messageContent);

                await interaction.editReply({
                    content: `Successfully sent message to #${targetChannel.name} in ${guild.name}`,
                });
            }

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

    // Autocomplete handler for server selection
    async autocomplete(interaction: any) {
        try {
            const focused = interaction.options.getFocused(true);
            if (focused.name !== 'server') return;

            // Get all guilds the bot is in
            const guilds = await interaction.client.guilds.fetch();
            const query = String(focused.value || '').toLowerCase();

            // All servers option at the top
            const options = [{ name: 'All Servers', value: 'all' }];

            const guildArray = Array.from(guilds.values()) as OAuth2Guild[];
            const filtered = guildArray
                .filter((guild) => guild && guild.name && guild.name.toLowerCase().includes(query))
                .slice(0, 24) 
                .map((guild) => ({ name: guild.name || 'Unknown', value: guild.id }));

            await interaction.respond([...options, ...filtered]);
        } catch (e) {
            console.error('autocomplete error:', e);
            await interaction.respond([]);
        }
    },
}

// Helper function to download text file from Discord CDN
async function downloadTextFile(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        protocol.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download file: ${res.statusCode}`));
                return;
            }

            let data = '';
            res.setEncoding('utf8');
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve(data);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}
