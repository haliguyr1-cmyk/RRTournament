// api/register.js - Vercel Serverless Function for Registration Submission
import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}

const db = admin.database();

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const registrationData = req.body;
        const { guild_id, discord_id } = registrationData;
        
        // Validate required fields
        if (!guild_id || !discord_id) {
            return res.status(400).json({ 
                error: 'Missing required fields: guild_id and discord_id' 
            });
        }
        
        // Check if user already has a pending or approved registration
        const existingRef = db.ref(`registrations/${guild_id}/${discord_id}`);
        const existingSnapshot = await existingRef.once('value');
        
        if (existingSnapshot.exists()) {
            const existing = existingSnapshot.val();
            if (existing.status === 'approved') {
                return res.status(409).json({ 
                    error: 'You are already registered and approved!' 
                });
            }
        }
        
        // Save registration to Firebase
        const registrationRef = db.ref(`registrations/${guild_id}/${discord_id}`);
        await registrationRef.set({
            ...registrationData,
            timestamp: Date.now(),
            status: 'pending',
            source: 'browser'
        });
        
        // Add to pending queue for Discord bot to process
        const queueRef = db.ref(`pending_registrations/${guild_id}`);
        await queueRef.push({
            discord_id,
            timestamp: Date.now(),
            source: 'browser'
        });
        
        // Send webhook notification to Discord (if configured)
        if (process.env.DISCORD_WEBHOOK_URL) {
            try {
                await fetch(process.env.DISCORD_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: `🌐 New browser registration from **${registrationData.game_username}**!`,
                        embeds: [{
                            title: 'Web Registration Received',
                            color: 0x00ff00,
                            fields: [
                                { name: 'Discord User', value: `<@${discord_id}>`, inline: true },
                                { name: 'Game Username', value: registrationData.game_username, inline: true },
                                { name: 'Community', value: registrationData.community, inline: true },
                                { name: 'Division', value: registrationData.strength.division, inline: true },
                                { name: 'Total Strength', value: registrationData.strength.totalStrength.toString(), inline: true },
                                { name: 'Hero', value: `${registrationData.hero} (Lv ${registrationData.hero_level})`, inline: true }
                            ],
                            timestamp: new Date().toISOString()
                        }]
                    })
                });
            } catch (webhookError) {
                console.error('Webhook error:', webhookError);
                // Don't fail registration if webhook fails
            }
        }
        
        return res.status(200).json({ 
            success: true, 
            message: 'Registration submitted successfully',
            data: {
                discord_id,
                guild_id,
                division: registrationData.strength.division,
                total_strength: registrationData.strength.totalStrength
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}
