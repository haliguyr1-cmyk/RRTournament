class CardSelect(Select):
    """Card selection dropdown - FIXED"""
    
    def __init__(self, options, menu_number):
        super().__init__(
            placeholder=f"Select a card (Menu {menu_number})",
            options=options,
            min_values=1,
            max_values=1,
            custom_id=f"card_select_{menu_number}"
        )
        self.menu_number = menu_number
    
    async def callback(self, interaction: discord.Interaction):
        # CRITICAL: Defer IMMEDIATELY before any logic
        await interaction.response.defer(ephemeral=True)
        
        print(f"🔍 Card selected: {self.values[0]}")
        
        try:
            import registration_modals
            
            if interaction.user.id not in registration_modals.registration_data:
                await interaction.followup.send(
                    "❌ Registration expired.",
                    ephemeral=True
                )
                return
            
            if 'cards' not in registration_modals.registration_data[interaction.user.id]:
                registration_modals.registration_data[interaction.user.id]['cards'] = []
            
            current_cards = registration_modals.registration_data[interaction.user.id]['cards']
            selected_card = self.values[0]
            
            # Check if already in deck
            if any(c['name'] == selected_card for c in current_cards):
                await interaction.followup.send(
                    f"❌ {selected_card} is already in your deck!",
                    ephemeral=True
                )
                return
            
            if len(current_cards) >= 5:
                await interaction.followup.send(
                    "❌ Deck is full (5 cards max)!",
                    ephemeral=True
                )
                return
            
            # Check if card is legendary
            from config import LEGENDARY_CARDS
            is_legendary = selected_card in LEGENDARY_CARDS
            
            # Show level selection
            await interaction.followup.send(
                f"✅ Added **{selected_card}** to deck!\n"
                f"Now select its level:",
                view=CardLevelSelectView(selected_card, is_legendary),
                ephemeral=True
            )
            
        except Exception as e:
            print(f"❌ ERROR: {e}")
            import traceback
            traceback.print_exc()
            try:
                await interaction.followup.send(
                    f"❌ An error occurred: {str(e)}",
                    ephemeral=True
                )
            except:
                pass