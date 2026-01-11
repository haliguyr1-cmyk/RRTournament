// api/register.js - Send registration to Discord webhook with approval buttons

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
        
        // Get webhook URL from environment variable
        const webhookUrl = process.env[`WEBHOOK_URL_${guild_id}`];
        
        if (!webhookUrl) {
            console.log(`No webhook configured for guild ${guild_id}`);
            
            // Still return success - user can use export code
            return res.status(200).json({
                success: true,
                message: 'Registration received! Use the export code to complete in Discord.',
                use_export_code: true
            });
        }
        
        // Create embed for Discord
        const embed = {
            title: "🌐 New Browser Registration - PENDING APPROVAL",
            description: `Registration from <@${discord_id}>`,
            color: 0xFFA500, // Orange for pending
            fields: [],
            timestamp: new Date().toISOString(),
            footer: {
                text: `User ID: ${discord_id} | Source: Browser | Status: Pending`
            }
        };

        // Add basic fields
        embed.fields.push(
            { name: "👤 Discord User", value: `<@${discord_id}>`, inline: true },
            { name: "🎮 Game Username", value: data.game_username, inline: true },
            { name: "🆔 Game ID", value: data.game_id, inline: true },
            { name: "🏛️ Community", value: data.community, inline: true },
            { name: "🕐 Timezone", value: data.timezone, inline: true },
            { name: "\u200b", value: "\u200b", inline: true } // Spacer
        );

        // Add hero info
        embed.fields.push(
            { name: "🦸 Hero", value: `${data.hero} (Lv ${data.hero_level})`, inline: true }
        );

        // Add hero item if present
        if (data.hero_item && data.hero_item !== 'None') {
            embed.fields.push({
                name: "⭐ Hero Item",
                value: `${data.hero_item} (Lv ${data.hero_item_level || 0})`,
                inline: true
            });
        }

        embed.fields.push(
            { name: "🎯 Perks Level", value: data.perks_level.toString(), inline: true }
        );

        // Build deck text
        const deckText = data.cards.map((c, i) => 
            `${i+1}. ${c.name} - Lv ${c.level}`
        ).join('\n');

        embed.fields.push({
            name: "🃏 Deck (5 Cards)",
            value: deckText,
            inline: false
        });

        // Build strength calculation
        const strength = data.strength;
        let pantheonText = '';
        if (strength.pantheonCards && strength.pantheonCards.length > 0) {
            const bonuses = strength.pantheonCards.map(c => 
                `${c.name}: +${Math.floor(c.bonus * 100)}%`
            ).join(', ');
            pantheonText = `\n**Pantheon Bonuses:** ${bonuses}`;
        }

        const strengthText = [
            `**Base Crit:** ${strength.baseCrit}%`,
            `**Adjusted Crit:** ${strength.adjustedCrit}%${pantheonText}`,
            `**Legendarity:** ${strength.legendarity}`,
            `**Perks:** ${strength.perks}`,
            `**Total Strength:** ${strength.totalStrength}`,
            `**Division:** ${strength.division}`
        ].join('\n');

        embed.fields.push({
            name: "📊 Calculated Strength",
            value: strengthText,
            inline: false
        });

        // Add export code
        embed.fields.push({
            name: "📋 Export Code",
            value: `\`\`\`${data.export_code}\`\`\``,
            inline: false
        });
        
        // Create approval buttons - MUST match Python bot's custom_ids
        const components = [
            {
                type: 1, // Action Row
                components: [
                    {
                        type: 2, // Button
                        style: 3, // Green/Success
                        label: "✅ Approve Registration",
                        custom_id: "approve_browser_reg"  // Matches Python handler
                    },
                    {
                        type: 2, // Button
                        style: 4, // Red/Danger
                        label: "❌ Reject Registration",
                        custom_id: "reject_browser_reg"  // Matches Python handler
                    },
                    {
                        type: 2, // Button
                        style: 1, // Blue/Primary
                        label: "📋 Copy Export Code",
                        custom_id: "copy_export_code"  // Matches Python handler
                    }
                ]
            }
        ];
        
        // Send to Discord webhook
        console.log('Sending to Discord webhook...');
        const webhookResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: `🌐 **New Browser Registration** - <@${discord_id}> - ⏳ **PENDING APPROVAL**`,
                embeds: [embed],
                components: components
            })
        });
        
        if (!webhookResponse.ok) {
            const errorText = await webhookResponse.text();
            console.error('Webhook error:', errorText);
            throw new Error('Failed to send to Discord');
        }
        
        console.log('✅ Sent to Discord successfully');
        
        return res.status(200).json({
            success: true,
            message: 'Registration submitted successfully! Waiting for moderator approval in Discord.'
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ 
            success: false,
            error: 'Internal server error',
            message: error.message 
        });
    }
}