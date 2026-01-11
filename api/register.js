// api/register.js - Create ticket channel directly and post registration there

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const data = req.body;
        const { discord_id, username, guild_id } = data;
        
        console.log('Registration received:', { discord_id, username, guild_id });
        
        if (!discord_id || !guild_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Get bot token from environment variable
        const botToken = process.env.DISCORD_TOKEN;
        
        if (!botToken) {
            console.log('No bot token configured');
            return res.status(200).json({
                success: true,
                message: 'Registration received! Use the export code to complete in Discord.',
                use_export_code: true
            });
        }
        
        // Build deck text
        const deckText = data.cards.map((c, i) => 
            `${i+1}. ${c.name} - Lv ${c.level}`
        ).join('\n');
        
        // Build pantheon text
        let pantheonText = '';
        if (data.strength.pantheonCards && data.strength.pantheonCards.length > 0) {
            const bonuses = data.strength.pantheonCards.map(c => 
                `${c.name}: +${Math.floor(c.bonus * 100)}%`
            ).join(', ');
            pantheonText = ` Pantheon Bonuses: ${bonuses}`;
        }
        
        // Build strength text
        const strength = data.strength;
        const strengthText = 
            `Base Crit: ${strength.baseCrit}% ` +
            `Adjusted Crit: ${strength.adjustedCrit}%${pantheonText} ` +
            `Legendarity: ${strength.legendarity} ` +
            `Perks: ${strength.perks} ` +
            `Total Strength: ${strength.totalStrength} ` +
            `Division: ${strength.division}`;
        
        // Build fields array
        const fields = [];
        
        fields.push({ name: "👤 Discord User", value: `<@${discord_id}>`, inline: true });
        fields.push({ name: "📝 Username", value: username || 'N/A', inline: true });
        fields.push({ name: "🎮 Game Username", value: data.game_username, inline: true });
        fields.push({ name: "🆔 Game ID", value: data.game_id, inline: true });
        fields.push({ name: "🏛️ Community", value: data.community, inline: true });
        fields.push({ name: "🕐 Timezone", value: data.timezone, inline: true });
        fields.push({ name: "🦸 Hero", value: `${data.hero} (Lv ${data.hero_level})`, inline: true });
        fields.push({ name: "🎯 Perks Level", value: data.perks_level.toString(), inline: true });
        
        // Add hero item if present
        if (data.hero_item && data.hero_item !== 'None') {
            fields.push({
                name: "⭐ Hero Item",
                value: `${data.hero_item} (Lv ${data.hero_item_level || 0})`,
                inline: true
            });
        }
        
        // Add deck
        fields.push({
            name: "🃏 Deck (5 Cards)",
            value: deckText,
            inline: false
        });
        
        // Add calculated strength
        fields.push({
            name: "📊 Calculated Strength",
            value: strengthText,
            inline: false
        });
        
        console.log('Total fields:', fields.length);
        
        // Create embed for Discord
        const embed = {
            title: "🌐 Browser Registration - PENDING APPROVAL",
            description: "Please review the participant information below:",
            color: 0xFFA500,
            fields: fields,
            timestamp: new Date().toISOString(),
            footer: {
                text: `User ID: ${discord_id} | Source: Browser | Status: Pending`
            }
        };
        
        // Step 1: Find the REGISTRATIONS category (exact match preferred)
        console.log('Fetching guild channels...');
        const channelsResponse = await fetch(`https://discord.com/api/v10/guilds/${guild_id}/channels`, {
            headers: {
                'Authorization': `Bot ${botToken}`
            }
        });
        
        if (!channelsResponse.ok) {
            throw new Error('Failed to fetch guild channels');
        }
        
        const channels = await channelsResponse.json();
        console.log(`Found ${channels.length} channels`);
        
        // Find REGISTRATIONS category - prioritize exact match
        let registrationCategory = channels.find(ch => 
            ch.type === 4 && ch.name === "REGISTRATIONS"
        );
        
        // Fallback to case-insensitive match
        if (!registrationCategory) {
            registrationCategory = channels.find(ch => 
                ch.type === 4 && 
                (ch.name.toLowerCase().includes('registration') || 
                 ch.name.toLowerCase().includes('pending'))
            );
        }
        
        if (!registrationCategory) {
            console.log('No registration category found');
            return res.status(200).json({
                success: false,
                message: 'Registration category not found. Please contact an administrator.',
                use_export_code: true
            });
        }
        
        console.log(`Found registration category: ${registrationCategory.name}`);
        
        // Step 2: Get roles for permissions
        const rolesResponse = await fetch(`https://discord.com/api/v10/guilds/${guild_id}/roles`, {
            headers: {
                'Authorization': `Bot ${botToken}`
            }
        });
        
        const roles = rolesResponse.ok ? await rolesResponse.json() : [];
        const modRole = roles.find(r => r.name === "Moderator");
        const adminRole = roles.find(r => r.name === "Administrator");
        
        // Step 3: Create ticket channel
        const channelName = `web-${data.game_username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        
        const permissionOverwrites = [
            {
                id: guild_id, // @everyone role
                type: 0,
                deny: "1024" // VIEW_CHANNEL
            },
            {
                id: discord_id, // The user
                type: 1,
                allow: "3072" // VIEW_CHANNEL + SEND_MESSAGES
            }
        ];
        
        // Add mod role if exists
        if (modRole) {
            permissionOverwrites.push({
                id: modRole.id,
                type: 0,
                allow: "3072"
            });
        }
        
        // Add admin role if exists
        if (adminRole) {
            permissionOverwrites.push({
                id: adminRole.id,
                type: 0,
                allow: "3072"
            });
        }
        
        console.log(`Creating ticket channel: ${channelName}`);
        
        const createChannelResponse = await fetch(`https://discord.com/api/v10/guilds/${guild_id}/channels`, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: channelName,
                type: 0, // Text channel
                parent_id: registrationCategory.id,
                permission_overwrites: permissionOverwrites
            })
        });
        
        if (!createChannelResponse.ok) {
            const error = await createChannelResponse.text();
            console.error('Failed to create channel:', error);
            throw new Error('Failed to create ticket channel');
        }
        
        const ticketChannel = await createChannelResponse.json();
        console.log(`✅ Created ticket channel: ${ticketChannel.name} (${ticketChannel.id})`);
        
        // Step 4: Post registration to ticket channel with buttons
        const components = [
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 3,
                        label: "Approve",
                        custom_id: "approve_browser_reg"
                    },
                    {
                        type: 2,
                        style: 4,
                        label: "Deny",
                        custom_id: "reject_browser_reg"
                    }
                ]
            },
            {
                type: 1,
                components: [
                    {
                        type: 3, // Select menu
                        custom_id: "division_override_browser",
                        placeholder: "Override Division (optional)",
                        options: [
                            { label: "Keep Current Division", value: "none", default: true },
                            { label: "Lightweight", value: "Lightweight" },
                            { label: "Cruiserweight", value: "Cruiserweight" },
                            { label: "Middleweight", value: "Middleweight" },
                            { label: "Heavyweight", value: "Heavyweight" },
                            { label: "Super Heavyweight", value: "Super Heavyweight" },
                            { label: "Champion", value: "Champion" }
                        ]
                    }
                ]
            }
        ];
        
        const postMessageResponse = await fetch(`https://discord.com/api/v10/channels/${ticketChannel.id}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: `<@${discord_id}>`,
                embeds: [embed],
                components: components
            })
        });
        
        if (!postMessageResponse.ok) {
            const error = await postMessageResponse.text();
            console.error('Failed to post message:', error);
        } else {
            console.log('✅ Posted registration to ticket channel');
        }
        
        // Add "Export My Settings" button
        await fetch(`https://discord.com/api/v10/channels/${ticketChannel.id}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: "📤 **Your Registration Settings:**",
                components: [{
                    type: 1,
                    components: [{
                        type: 2,
                        style: 1,
                        label: "Export My Settings",
                        custom_id: "export_settings_persistent",
                        emoji: { name: "📤" }
                    }]
                }]
            })
        });
        
        // Step 5: Ping moderators/admins
        let pingMessage = '🔔 New browser registration to review!';
        if (modRole) pingMessage += ` <@&${modRole.id}>`;
        if (adminRole) pingMessage += ` <@&${adminRole.id}>`;
        
        await fetch(`https://discord.com/api/v10/channels/${ticketChannel.id}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: pingMessage
            })
        });
        
        // Step 6: DM the user with export code
        try {
            const dmChannelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
                method: 'POST',
                headers: {
                    'Authorization': `Bot ${botToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    recipient_id: discord_id
                })
            });
            
            if (dmChannelResponse.ok) {
                const dmChannel = await dmChannelResponse.json();
                
                await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bot ${botToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        embeds: [{
                            title: "✅ Registration Submitted!",
                            description: "Your registration has been submitted and is pending approval.",
                            color: 0x5865F2,
                            fields: [
                                {
                                    name: "📋 Your Export Code",
                                    value: `Keep this safe in case you need it:\n\`\`\`${data.export_code}\`\`\``,
                                    inline: false
                                }
                            ],
                            footer: {
                                text: "You'll be notified once your registration is approved!"
                            }
                        }]
                    })
                });
                
                console.log('✅ Sent DM to user with export code');
            }
        } catch (error) {
            console.log('⚠️ Could not send DM to user:', error.message);
        }
        
        return res.status(200).json({
            success: true,
            message: 'Registration submitted successfully! Check your DMs and your private ticket channel.',
            channel_id: ticketChannel.id
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        console.error('Error stack:', error.stack);
        
        return res.status(500).json({ 
            success: false,
            message: 'Registration failed. Please try again or use the export code.',
            use_export_code: true,
            error: error.message 
        });
    }
}