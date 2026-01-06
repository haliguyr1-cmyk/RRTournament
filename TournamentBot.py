"""TournamentBot.py - Main bot file (No Firebase needed!)"""
"""Main bot file for Rush Royale Tournament Bot with strength-based matchmaking"""

import discord
from discord.ext import commands
import os
import asyncio
import database as db

# ============================================================================
# LOAD ENVIRONMENT VARIABLES FROM .env FILE
# ============================================================================
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Environment variables loaded from .env file")
except ImportError:
    print("⚠️ python-dotenv not installed. Install with: pip install python-dotenv")
    print("   Falling back to system environment variables only")
except Exception as e:
    print(f"⚠️ Error loading .env file: {e}")

#debug
print(f"Discord.py version: {discord.__version__}")

# ============================================================================
# BOT CONFIGURATION
# ============================================================================

intents = discord.Intents.default()
intents.message_content = True
intents.members = True
intents.guilds = True

bot = commands.Bot(command_prefix="!", intents=intents)

# ============================================================================
# BOT EVENTS
# ============================================================================

@bot.event
async def on_ready():
    """Initialize bot when ready"""
    print(f"✅ {bot.user} is now online!")
    print(f"   Connected to {len(bot.guilds)} guild(s)")
    
    # Initialize database
    db.init_db()
    print("✅ Database initialized")
    
    # Sync slash commands
    try:
        synced = await bot.tree.sync()
        print(f"✅ Synced {len(synced)} slash command(s)")
    except Exception as e:
        print(f"❌ Failed to sync commands: {e}")
    
    # Set bot status
    await bot.change_presence(
        activity=discord.Activity(
            type=discord.ActivityType.watching,
            name="🏆 Tournament Battles"
        )
    )
    
    # Register persistent views so they work after bot restarts
    try:
        from views import (
            RegistrationTypeView, 
            ParticipantRegistrationMethodView,
            AdvancedRegistrationView,
            AdvancedRegistrationConfirmView,
            HeroItemQuestionView,
            HeroItemSelectView
        )
        from approval_views import (
            PersistentDivisionView,
            ExportSettingsView,
            ParticipantApprovalView
        )
        from registration_modals import HeroItemLevelTriggerView
        from dashboard_views import TournamentDashboardView
        from browser_approval_handler import BrowserApprovalView
        
        # Add persistent views
        bot.add_view(RegistrationTypeView())
        bot.add_view(ParticipantRegistrationMethodView())
        bot.add_view(AdvancedRegistrationView())
        bot.add_view(AdvancedRegistrationConfirmView())
        bot.add_view(PersistentDivisionView())
        bot.add_view(ExportSettingsView())
        bot.add_view(TournamentDashboardView())
        bot.add_view(BrowserApprovalView())  # Add browser approval view
        
        print("✅ Persistent views registered")
        
    except Exception as e:
        print(f"⚠️ Error loading persistent views: {e}")
        import traceback
        traceback.print_exc()
    
    # Start web dashboard if enabled
    try:
        import web_app
        web_app.start_web_dashboard(bot)
        print("✅ Web dashboard started on http://localhost:5000")
    except Exception as e:
        print(f"⚠️ Web dashboard not started: {e}")
    
    print("=" * 60)
    print("🎮 Rush Royale Tournament Bot Ready!")
    print("🌐 Browser registrations: ENABLED with approval buttons")
    print("=" * 60)

@bot.event
async def on_guild_join(guild):
    """Handle bot joining a new guild"""
    print(f"✅ Joined new guild: {guild.name} (ID: {guild.id})")
    
    # Initialize tournament state for new guild
    try:
        db.init_db()
        print(f"   Database initialized for {guild.name}")
    except Exception as e:
        print(f"   Error initializing database: {e}")

@bot.event
async def on_command_error(ctx, error):
    """Handle command errors"""
    if isinstance(error, commands.CommandNotFound):
        return
    
    if isinstance(error, commands.MissingPermissions):
        await ctx.send("❌ You don't have permission to use this command!")
        return
    
    print(f"❌ Command error: {error}")
    import traceback
    traceback.print_exc()

# ============================================================================
# LOAD COGS (Command Modules)
# ============================================================================

async def load_cogs():
    """Load all command cogs"""
    cogs = [
        'admin_commands',           # Admin configuration commands
        'tournament_commands',      # Tournament management
        'bracket_commands',         # Bracket generation and matches
        'setup_commands',           # Server setup
        'webhook_commands',         # Browser registration webhook setup
        'browser_approval_handler', # Browser registration approval buttons
    ]
    
    for cog in cogs:
        try:
            await bot.load_extension(cog)
            print(f"✅ Loaded cog: {cog}")
        except Exception as e:
            print(f"❌ Failed to load {cog}: {e}")
            import traceback
            traceback.print_exc()

# ============================================================================
# MAIN BOT STARTUP
# ============================================================================

async def main():
    """Main bot startup sequence"""
    async with bot:
        # Load all cogs
        await load_cogs()
        
        # Get token from environment
        token = os.getenv('DISCORD_TOKEN')
        
        if not token:
            print("\n" + "=" * 60)
            print("❌ ERROR: DISCORD_TOKEN not found!")
            print("=" * 60)
            print("\n📝 To fix this issue:")
            print("\n1. Make sure you have a .env file in the same directory as this script")
            print("2. The .env file should contain:")
            print("   DISCORD_TOKEN=your_bot_token_here")
            print("\n3. Install python-dotenv if not already installed:")
            print("   pip install python-dotenv")
            print("\n4. Get your bot token from:")
            print("   https://discord.com/developers/applications")
            print("=" * 60 + "\n")
            
            # Wait for user input before closing
            input("Press Enter to exit...")
            return
        
        print(f"✅ Discord token found (length: {len(token)} chars)")
        await bot.start(token)

# ============================================================================
# RUN THE BOT
# ============================================================================

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⚠️ Bot stopped by user (Ctrl+C)")
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        input("\nPress Enter to exit...")