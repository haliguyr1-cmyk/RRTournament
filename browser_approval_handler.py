"""browser_approval_handler.py - Handle approval buttons from browser registrations"""

import discord
from discord.ext import commands
import database as db

class BrowserApprovalHandler(commands.Cog):
    """Handle approval/rejection buttons from browser registrations"""
    
    def __init__(self, bot):
        self.bot = bot
        
        # Register the persistent view on startup
        self.bot.add_view(BrowserApprovalView())
    
    @commands.Cog.listener()
    async def on_ready(self):
        """Re-register persistent views when bot restarts"""
        print("✅ Browser Approval Handler loaded")


class BrowserApprovalView(discord.ui.View):
    """Persistent view for browser registration approval buttons"""
    
    def __init__(self):
        super().__init__(timeout=None)  # Persistent view
    
    @discord.ui.button(
        label="✅ Approve Registration",
        style=discord.ButtonStyle.success,
        custom_id="approve_browser_reg"
    )
    async def approve_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Handle approval of browser registration"""
        await self.handle_approval(interaction, approved=True)
    
    @discord.ui.button(
        label="❌ Reject Registration",
        style=discord.ButtonStyle.danger,
        custom_id="reject_browser_reg"
    )
    async def reject_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Handle rejection of browser registration"""
        await self.handle_approval(interaction, approved=False)
    
    @discord.ui.button(
        label="📋 Copy Export Code",
        style=discord.ButtonStyle.primary,
        custom_id="copy_export_code"
    )
    async def copy_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Extract and show export code"""
        try:
            # Find the export code in the embed
            embed = interaction.message.embeds[0]
            export_code = None
            
            for field in embed.fields:
                if "Export Code" in field.name:
                    # Extract code from ```code``` format
                    export_code = field.value.strip('`').strip()
                    break
            
            if export_code:
                await interaction.response.send_message(
                    f"📋 **Export Code:**\n```{export_code}```\n\nYou can copy this code for future use!",
                    ephemeral=True
                )
            else:
                await interaction.response.send_message(
                    "❌ Could not find export code in this registration.",
                    ephemeral=True
                )
                
        except Exception as e:
            print(f"❌ Error copying export code: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while copying the code.",
                ephemeral=True
            )
    
    async def handle_approval(self, interaction: discord.Interaction, approved: bool):
        """Handle approval or rejection"""
        try:
            await interaction.response.defer()
            
            # Get the registration data from the embed
            embed = interaction.message.embeds[0]
            
            # Extract discord_id from the embed
            discord_id = None
            for field in embed.fields:
                if field.name == "Discord User":
                    # Extract ID from <@123456789> format
                    mention = field.value
                    discord_id = int(mention.strip('<@!>'))
                    break
            
            if not discord_id:
                # Try footer
                footer_text = embed.footer.text
                if "User ID:" in footer_text:
                    discord_id = int(footer_text.split("User ID:")[1].split("|")[0].strip())
            
            if not discord_id:
                await interaction.followup.send(
                    "❌ Could not find user ID in registration!",
                    ephemeral=True
                )
                return
            
            # Get the user
            try:
                user = await self.bot.fetch_user(discord_id)
            except:
                await interaction.followup.send(
                    f"❌ Could not find user with ID {discord_id}",
                    ephemeral=True
                )
                return
            
            # Extract registration data from embed
            registration_data = self.extract_registration_data(embed, discord_id)
            
            if approved:
                # APPROVE: Add to database
                success = await self.approve_registration(
                    interaction,
                    user,
                    registration_data
                )
                
                if success:
                    # Update embed
                    new_embed = embed.copy()
                    new_embed.title = "✅ Registration APPROVED"
                    new_embed.color = discord.Color.green()
                    new_embed.set_footer(
                        text=f"{embed.footer.text} | Approved by {interaction.user.name}"
                    )
                    
                    # Update message (remove buttons)
                    await interaction.message.edit(
                        content=f"✅ **Registration APPROVED** by {interaction.user.mention}",
                        embed=new_embed,
                        view=None
                    )
                    
                    # Send DM to user
                    try:
                        await user.send(
                            embed=discord.Embed(
                                title="✅ Tournament Registration Approved!",
                                description=f"Your registration for **{interaction.guild.name}** has been approved!",
                                color=discord.Color.green()
                            ).add_field(
                                name="Division",
                                value=registration_data.get('division', 'N/A')
                            ).add_field(
                                name="Next Steps",
                                value="You're all set! Watch for tournament announcements."
                            )
                        )
                    except:
                        print(f"Could not DM user {discord_id}")
                    
                    await interaction.followup.send(
                        f"✅ Registration approved! {user.mention} has been added to the tournament.",
                        ephemeral=True
                    )
                else:
                    await interaction.followup.send(
                        "❌ Error saving registration to database.",
                        ephemeral=True
                    )
            
            else:
                # REJECT
                new_embed = embed.copy()
                new_embed.title = "❌ Registration REJECTED"
                new_embed.color = discord.Color.red()
                new_embed.set_footer(
                    text=f"{embed.footer.text} | Rejected by {interaction.user.name}"
                )
                
                await interaction.message.edit(
                    content=f"❌ **Registration REJECTED** by {interaction.user.mention}",
                    embed=new_embed,
                    view=None
                )
                
                # Send DM
                try:
                    await user.send(
                        embed=discord.Embed(
                            title="❌ Tournament Registration Rejected",
                            description=f"Your registration for **{interaction.guild.name}** was not approved.",
                            color=discord.Color.red()
                        ).add_field(
                            name="What to do",
                            value="Please contact a moderator if you have questions."
                        )
                    )
                except:
                    print(f"Could not DM user {discord_id}")
                
                await interaction.followup.send(
                    f"❌ Registration rejected.",
                    ephemeral=True
                )
        
        except Exception as e:
            print(f"❌ Error in handle_approval: {e}")
            import traceback
            traceback.print_exc()
            
            try:
                await interaction.followup.send(
                    f"❌ An error occurred: {str(e)}",
                    ephemeral=True
                )
            except:
                pass
    
    def extract_registration_data(self, embed: discord.Embed, discord_id: int) -> dict:
        """Extract registration data from the embed fields"""
        data = {
            'discord_id': discord_id,
            'cards': []
        }
        
        for field in embed.fields:
            name = field.name.lower()
            value = field.value
            
            if "game username" in name:
                data['game_username'] = value
            elif "game id" in name:
                data['game_id'] = value
            elif "community" in name:
                data['community'] = value
            elif "timezone" in name:
                data['timezone'] = value
            elif "hero" in name and "item" not in name:
                # Extract hero and level from "HeroName (Lv 50)"
                if "(Lv" in value:
                    hero_parts = value.split("(Lv")
                    data['hero'] = hero_parts[0].strip()
                    data['hero_level'] = int(hero_parts[1].strip(")").strip())
            elif "hero item" in name:
                if value and value != "None":
                    if "(Lv" in value:
                        item_parts = value.split("(Lv")
                        data['hero_item'] = item_parts[0].strip()
                        data['hero_item_level'] = int(item_parts[1].strip(")").strip())
                    else:
                        data['hero_item'] = value
            elif "perks" in name:
                data['perks_level'] = int(value)
            elif "deck" in name or "card" in name:
                # Parse deck: "1. CardName - Lv 15\n2. CardName - Lv 14..."
                lines = value.split('\n')
                for line in lines:
                    if ". " in line and " - Lv " in line:
                        card_name = line.split(". ")[1].split(" - Lv ")[0]
                        card_level = line.split(" - Lv ")[1].strip()
                        data['cards'].append({
                            'name': card_name,
                            'level': card_level
                        })
            elif "calculated strength" in name or "strength" in name:
                # Parse strength info
                if "Base Crit:" in value:
                    for line in value.split('\n'):
                        if "Base Crit:" in line:
                            data['crit_level'] = int(line.split(":")[1].replace("%", "").strip())
                        elif "Legendarity:" in line:
                            data['legendarity'] = int(line.split(":")[1].strip())
                        elif "Perks:" in line and "**Perks:**" in line:
                            data['perks_level'] = int(line.split(":")[1].strip())
                        elif "Division:" in line:
                            data['division'] = line.split(":")[1].strip()
        
        return data
    
    async def approve_registration(self, interaction: discord.Interaction, user: discord.User, data: dict) -> bool:
        """Add the approved registration to the database"""
        try:
            guild_id = interaction.guild.id
            discord_id = user.id
            
            # Add participant to database
            db.add_participant(
                guild_id=guild_id,
                discord_id=discord_id,
                username=user.name,
                game_username=data.get('game_username', ''),
                game_id=data.get('game_id', ''),
                crit_level=data.get('crit_level', 0),
                legendarity=data.get('legendarity', 0),
                perks_level=data.get('perks_level', 0),
                division=data.get('division', 'Unknown'),
                timezone=data.get('timezone', 'UTC'),
                community=data.get('community', ''),
                hero=data.get('hero', ''),
                hero_level=data.get('hero_level', 1),
                hero_item=data.get('hero_item'),
                hero_item_level=data.get('hero_item_level'),
                cards=data.get('cards', [])
            )
            
            # Mark as approved
            db.approve_participant(discord_id, guild_id)
            
            # Assign Participant role
            try:
                participant_role = discord.utils.get(interaction.guild.roles, name="Participant")
                if participant_role:
                    member = interaction.guild.get_member(discord_id)
                    if member:
                        await member.add_roles(participant_role)
            except Exception as e:
                print(f"Could not assign role: {e}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error approving registration: {e}")
            import traceback
            traceback.print_exc()
            return False


async def setup(bot):
    """Setup function to load the cog"""
    await bot.add_cog(BrowserApprovalHandler(bot))