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
            console.log('Available env vars:', Object.keys(process.env).filter(k => k.startsWith('WEBHOOK_URL_')));
            
            // Still return success - user can use export code
            return res.status(200).json({
                success: true,
                message: 'Registration received! Use the export code to complete in Discord.',
                use_export_code: true
            });
        }
        
        // Validate webhook URL format
        if (!webhookUrl.startsWith('https://discord.com/api/webhooks/') && 
            !webhookUrl.startsWith('https://discordapp.com/api/webhooks/')) {
            console.error('Invalid webhook URL format:', webhookUrl.substring(0, 30) + '...');
            return res.status(200).json({
                success: true,
                message: 'Registration received! Webhook configuration error - please use export code.',
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
        
        // Add export code to embed (bot will extract and DM to user)
        fields.push({
            name: "📋 Export Code",
            value: `\`\`\`${data.export_code}\`\`\``,
            inline: false
        });
        
        console.log('Total fields:', fields.length);
        console.log('Deck text length:', deckText.length);
        console.log('Strength text length:', strengthText.length);
        console.log('Export code length:', data.export_code.length);
        
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
        
        // Create approval buttons
        const components = [
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 3,
                        label: "✅ Approve Registration",
                        custom_id: "approve_browser_reg"
                    },
                    {
                        type: 2,
                        style: 4,
                        label: "❌ Reject Registration",
                        custom_id: "reject_browser_reg"
                    },
                    {
                        type: 2,
                        style: 1,
                        label: "📋 Copy Export Code",
                        custom_id: "copy_export_code"
                    }
                ]
            }
        ];
        
        console.log('Sending embed with', fields.length, 'fields');
        console.log('Webhook URL (first 50 chars):', webhookUrl.substring(0, 50) + '...');
        
        // Send main registration to Discord webhook
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
            console.error('Response status:', webhookResponse.status);
            
            let errorDetail = 'Unknown error';
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.code === 10015) {
                    errorDetail = 'Webhook not found or deleted. Please recreate the webhook in Discord.';
                } else if (errorJson.code === 50027) {
                    errorDetail = 'Invalid webhook token. Please recreate the webhook in Discord.';
                } else {
                    errorDetail = errorJson.message || errorText;
                }
            } catch (e) {
                errorDetail = errorText;
            }
            
            console.error('Error detail:', errorDetail);
            
            return res.status(200).json({
                success: true,
                message: 'Registration received! Discord webhook error - please use the export code to complete registration.',
                use_export_code: true,
                webhook_error: errorDetail
            });
        }
        
        console.log('✅ Sent main registration to Discord successfully');
        
        return res.status(200).json({
            success: true,
            message: 'Registration submitted successfully! Check your Discord DMs for your export code.'
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        console.error('Error stack:', error.stack);
        
        return res.status(200).json({ 
            success: true,
            message: 'Registration received! Please use the export code due to a technical issue.',
            use_export_code: true,
            error: error.message 
        });
    }
}