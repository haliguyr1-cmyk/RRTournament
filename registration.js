// registration.js - UPDATED: Dynamic Pantheon from TournamentBot API

// ============================================================================
// DYNAMIC PANTHEON
// ============================================================================

let PANTHEON_BONUSES = {
    "Twilight Ranger": 0.15,
    "Franky & Stein":  0.15,
    "Twins":           0.15,
    "Valkerie":        0.15,
    "Wukong":          0.30,
};

async function loadPantheonBonuses(guild_id) {
    try {
        const botUrl = window._BOT_API_URL || null;
        if (!botUrl) return;

        const url = `${botUrl}/api/pantheon?guild_id=${guild_id || 0}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.pantheon && data.pantheon.length > 0) {
            const map = {};
            data.pantheon.forEach(u => { map[u.name] = u.boost; });
            PANTHEON_BONUSES = map;
            console.log('✅ Pantheon loaded from bot API:', PANTHEON_BONUSES);
        }
    } catch (e) {
        console.log('⚠️ Pantheon fetch failed, using hardcoded fallback:', e.message);
    }
}

const LEGENDARY_CARDS = [
    "Banshee", "Bard", "Bruiser", "Blade Dancer", "Boreas", "Corsair", "Cultist",
    "Demon Hunter", "Demonologist", "Spirit Master", "Dryad", "Franky & Stein",
    "Frost", "Gun Slinger", "Harlequin", "Inquisitor", "Genie", "Hex",
    "Knight Statue", "Kobold", "Twilight Ranger", "Clock", "Meteor", "Minotaur",
    "Monk", "Swords", "Phoenix", "Riding Hood", "Robot", "Scrapper", "Stasis",
    "Summoner", "Tesla", "Trapper", "Treant", "Sea Dog", "Twins", "Witch", "Shaman",
    "Valkerie", "Wukong"
];

const ALL_CARDS = [
    ...LEGENDARY_CARDS,
    "Catapult", "Clown", "Crystalmancer", "Earth Elemental", "Cold Elemental",
    "Engineer", "Gargoyle", "Executioner", "Mime", "Plague Doctor", "Ivy",
    "Portal Keeper", "Pyrotechnic", "Reaper", "Portal Mage", "Thunderer",
    "Vampire", "Wind Archer", "Alchemist", "Banner", "Magic Cauldron", "Chemist",
    "Grindstone", "Priestess", "Sentry", "Sharpshooter", "Zealot",
    "Archer", "Bombardier", "Cold Mage", "Fire Mage", "Hunter",
    "Lightning Mage", "Poisoner", "Rogue", "Thrower"
].sort();

const HERO_ITEMS_MAP = {
    "Lucia (Legendary)":       "Shadow Blade",
    "Necromancer (Legendary)": "Ethereal Phylactery",
    "Fortuna (Legendary)":     "Lucky Coin",
    "Zeus (Legendary)":        "Star Gaze",
    "Gadget (Epic)":           "Rhandumization Key",
    "Mari (Epic)":             "Unstable Jelly",
    "Snowflake (Epic)":        "Ice Reflection",
    "Flicker (Epic)":          "Royal Duck",
    "Jake Paul (Epic)":        "RR Champion Belt",
    "Mermaid (Epic)":          "Bubble Wand",
    "Trickster (Rare)":        "Mana Power-up Flask",
    "Elementalist (Rare)":     "Scroll of the Elements",
    "Jay (Rare)":              "Ring of Rhandum",
    "Captain (Common)":        "Treasure Compass",
    "Bestie (Common)":         "Favorite Horn"
};

const ALL_HERO_ITEMS = [
    "Shadow Blade", "Ethereal Phylactery", "Lucky Coin", "Star Gaze",
    "Rhandumization Key", "Unstable Jelly", "Ice Reflection", "Royal Duck",
    "RR Champion Belt", "Bubble Wand", "Mana Power-up Flask",
    "Scroll of the Elements", "Ring of Rhandum", "Treasure Compass", "Favorite Horn"
];

const DEFAULT_WEIGHTS = { crit: 0.40, legendarity: 0.40, perks: 0.20 };
const DEFAULT_THRESHOLDS = {
    "Lightweight":       [0,    499],
    "Cruiserweight":     [500,  999],
    "Middleweight":      [1000, 1499],
    "Heavyweight":       [1500, 1999],
    "Super Heavyweight": [2000, 2499],
    "Champion":          [2500, 10000]
};

let formData = {
    discord_id: '', username: '', guild_id: '',
    game_username: '', game_id: '',
    crit_level: '', legendarity: '', perks_level: '',
    timezone: 'UTC-05:00', community: '',
    hero: '', hero_level: '', hero_item: '', hero_item_level: '',
    cards: Array(5).fill(null).map(() => ({ name: '', level: '' }))
};

let calculatedStrength = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Page loaded, initializing...');
    populateURLParams();
    initializeForm();
    loadCommunities();
    generateCardInputs();
    populateHeroItems();
    attachEventListeners();
    if (formData.guild_id) {
        await loadPantheonBonuses(formData.guild_id);
    }
});

function populateURLParams() {
    const params     = new URLSearchParams(window.location.search);
    const discord_id = params.get('discord_id');
    const username   = params.get('username');
    const guild_id   = params.get('guild_id');

    if (discord_id) {
        document.getElementById('discord_id').value = discord_id;
        formData.discord_id = discord_id;
        const input = document.getElementById('discord_id');
        input.style.backgroundColor = '#e8f5e9';
        input.style.borderColor     = '#4caf50';
        input.readOnly = true;
    }
    if (username) {
        document.getElementById('username').value = decodeURIComponent(username);
        formData.username = decodeURIComponent(username);
    }
    if (guild_id) {
        formData.guild_id = guild_id;
        document.getElementById('server-status').classList.remove('hidden');
        document.getElementById('server-id').textContent = `Server ID: ${guild_id}`;
    }
}

function initializeForm() {
    document.getElementById('discord_id').addEventListener('input', function() {
        const original = this.value;
        this.value = this.value.replace(/[^0-9]/g, '');
        if (original !== this.value) showAlert('Discord ID can only contain numbers!', 'error');
        if (this.value.length > 0 && this.value.length < 17) {
            this.setCustomValidity('Discord ID must be at least 17 digits');
        } else if (this.value.length > 20) {
            this.setCustomValidity('Discord ID is too long (max 20 digits)');
            this.value = this.value.substring(0, 20);
        } else {
            this.setCustomValidity('');
        }
        formData.discord_id = this.value;
    });
}

function populateHeroItems() {
    const sel = document.getElementById('hero_item');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select hero item...</option>';
    const none = document.createElement('option');
    none.value = 'None'; none.textContent = '❌ No Hero Item';
    sel.appendChild(none);
    ALL_HERO_ITEMS.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item; opt.textContent = item;
        sel.appendChild(opt);
    });
}

function generateCardInputs() {
    for (let i = 0; i < 5; i++) {
        const nameSelect  = document.getElementById(`card${i}_name`);
        const levelSelect = document.getElementById(`card${i}_level`);
        if (!nameSelect || !levelSelect) continue;

        nameSelect.innerHTML = '<option value="">Select card...</option>';
        ALL_CARDS.forEach(card => {
            const opt = document.createElement('option');
            opt.value = card;
            opt.textContent = `${card} ${LEGENDARY_CARDS.includes(card) ? '⭐' : ''}`;
            nameSelect.appendChild(opt);
        });

        levelSelect.innerHTML = '<option value="">Level...</option>';
        for (let j = 1; j <= 15; j++) {
            const opt = document.createElement('option');
            opt.value = j; opt.textContent = `Level ${j}`;
            levelSelect.appendChild(opt);
        }

        nameSelect.addEventListener('change', function() {
            formData.cards[i].name = this.value;
            updateCardLevelOptions(i, this.value);
            updateDisabledCards();
            calculateAndDisplayStrength();
        });
        levelSelect.addEventListener('change', function() {
            formData.cards[i].level = this.value;
            calculateAndDisplayStrength();
        });
    }
}

function updateCardLevelOptions(cardIndex, cardName) {
    const levelSelect = document.getElementById(`card${cardIndex}_level`);
    const currentValue = levelSelect.value;
    let options = '<option value="">Level...</option>';
    for (let i = 1; i <= 15; i++) options += `<option value="${i}">Level ${i}</option>`;
    if (LEGENDARY_CARDS.includes(cardName)) {
        options += `<option value="16">Reincarnated I (16)</option>`;
        options += `<option value="17">Reincarnated II (17)</option>`;
        options += `<option value="18">Reincarnated III (18)</option>`;
    }
    levelSelect.innerHTML = options;
    if (currentValue) levelSelect.value = currentValue;
}

function updateDisabledCards() {
    const selected = formData.cards.map(c => c.name).filter(Boolean);
    for (let i = 0; i < 5; i++) {
        const sel = document.getElementById(`card${i}_name`);
        const cur = sel.value;
        Array.from(sel.options).forEach(opt => {
            opt.disabled = opt.value && selected.includes(opt.value) && opt.value !== cur;
        });
    }
}

function loadCommunities() {
    const communitySelect = document.getElementById('community');
    const communities = [
        { name: 'Shining Stars',  emoji: '🌟' },
        { name: 'Empires Gaming', emoji: '🦁' },
        { name: 'Apoc4lipse',     emoji: '🔥' },
        { name: 'Quack Pack',     emoji: '🦆' },
        { name: 'Lord Gunko',     emoji: '⚔️' },
        { name: 'LRT',            emoji: '🚀' },
        { name: 'Nompies',        emoji: '🎮' },
        { name: 'Moes Tavern',    emoji: '🍺' },
        { name: 'SE7ENS',         emoji: '7️⃣' },
        { name: 'Smile & Wave',   emoji: '👋' },
    ];
    communitySelect.innerHTML = '<option value="">Select community...</option>';
    communities.forEach(comm => {
        const opt = document.createElement('option');
        opt.value = comm.name;
        opt.textContent = `${comm.emoji} ${comm.name}`;
        communitySelect.appendChild(opt);
    });
    const other = document.createElement('option');
    other.value = '__OTHER__'; other.textContent = '✏️ Other (Type your community)'; other.style.fontStyle = 'italic';
    communitySelect.appendChild(other);
}

function handleCommunityChange() {
    const select    = document.getElementById('community');
    const container = document.getElementById('community-container');
    const existing  = document.getElementById('custom-community-input');
    const helper    = document.getElementById('custom-community-helper');
    if (existing) existing.remove();
    if (helper)   helper.remove();

    if (select.value === '__OTHER__') {
        const input       = document.createElement('input');
        input.type        = 'text'; input.id = 'custom-community-input';
        input.placeholder = 'Enter your community name';
        input.className   = 'w-full p-3 border-2 rounded-lg focus:border-blue-500 outline-none mt-2';
        input.required    = true; input.maxLength = 50;
        const helperEl    = document.createElement('p');
        helperEl.id       = 'custom-community-helper';
        helperEl.className = 'text-xs text-gray-500 mt-1';
        helperEl.textContent = 'Your community will be added to the list automatically';
        container.appendChild(input);
        container.appendChild(helperEl);
        input.focus();
        input.addEventListener('input', function() { formData.community = this.value.trim(); });
        formData.community = '';
    } else {
        formData.community = select.value;
    }
}

function handleHeroChange() {
    const hero = document.getElementById('hero').value;
    const sel  = document.getElementById('hero_item');
    if (hero && HERO_ITEMS_MAP[hero]) {
        sel.value = HERO_ITEMS_MAP[hero];
        formData.hero_item = HERO_ITEMS_MAP[hero];
    }
}

function attachEventListeners() {
    ['crit_level', 'legendarity', 'perks_level'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', function() { formData[id] = this.value; calculateAndDisplayStrength(); });
    });
    const comm = document.getElementById('community');
    if (comm) comm.addEventListener('change', handleCommunityChange);
    const hero = document.getElementById('hero');
    if (hero) hero.addEventListener('change', function() { formData.hero = this.value; handleHeroChange(); });
    ['username','game_username','game_id','timezone','hero_level','hero_item','hero_item_level'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', function() { formData[id] = this.value; });
        if (el.tagName === 'INPUT') el.addEventListener('input', function() { formData[id] = this.value; });
    });
    const form = document.getElementById('registration-form');
    if (form) form.addEventListener('submit', handleFormSubmit);
}

function calculateAndDisplayStrength() {
    const baseCrit    = parseInt(formData.crit_level)  || 0;
    const legendarity = parseInt(formData.legendarity)  || 0;
    const perks       = parseInt(formData.perks_level) || 0;
    if (!baseCrit || !legendarity) return;

    let pantheonBonus = 0;
    const pantheonCards = [];
    formData.cards.forEach(card => {
        if (card.name && PANTHEON_BONUSES[card.name]) {
            pantheonBonus += PANTHEON_BONUSES[card.name];
            pantheonCards.push({ name: card.name, bonus: PANTHEON_BONUSES[card.name] });
        }
    });

    const adjustedCrit  = Math.floor(baseCrit * (1 + pantheonBonus));
    const totalStrength = Math.floor(
        (adjustedCrit   * DEFAULT_WEIGHTS.crit) +
        (legendarity    * DEFAULT_WEIGHTS.legendarity) +
        (perks          * DEFAULT_WEIGHTS.perks)
    );

    let division = null;
    for (const [div, [min, max]] of Object.entries(DEFAULT_THRESHOLDS)) {
        if (totalStrength >= min && totalStrength <= max) { division = div; break; }
    }

    calculatedStrength = { baseCrit, adjustedCrit, legendarity, perks, totalStrength, division, pantheonCards };
    displayStrength();
}

function displayStrength() {
    if (!calculatedStrength || !calculatedStrength.division) return;
    const display = document.getElementById('strength-display');
    display.classList.remove('hidden');
    document.getElementById('display-base-crit').textContent    = calculatedStrength.baseCrit + '%';
    document.getElementById('display-adj-crit').textContent     = calculatedStrength.adjustedCrit + '%';
    document.getElementById('display-legendarity').textContent  = calculatedStrength.legendarity;
    document.getElementById('display-perks').textContent        = calculatedStrength.perks;
    document.getElementById('display-total-strength').textContent = calculatedStrength.totalStrength;
    document.getElementById('display-division').textContent     = calculatedStrength.division;

    const pd = document.getElementById('pantheon-display');
    if (calculatedStrength.pantheonCards.length > 0) {
        pd.classList.remove('hidden');
        pd.innerHTML = `
            <p class="font-semibold text-purple-900 mb-2">🔮 Pantheon Bonuses:</p>
            <div class="flex flex-wrap gap-2">
                ${calculatedStrength.pantheonCards.map(c =>
                    `<span class="bg-purple-200 text-purple-900 px-3 py-1 rounded-full text-sm font-semibold">
                        ${c.name}: +${Math.floor(c.bonus * 100)}%
                    </span>`
                ).join('')}
            </div>`;
    } else {
        pd.classList.add('hidden');
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!formData.guild_id) {
        showAlert('Please use the registration link from Discord to ensure your server is identified.', 'error');
        return;
    }
    const customInput = document.getElementById('custom-community-input');
    if (customInput) {
        const v = customInput.value.trim();
        if (!v || v.length < 2) { showAlert('Please enter a valid community name (at least 2 characters).', 'error'); customInput.focus(); return; }
        formData.community = v;
    }
    if (!formData.community) { showAlert('Please select or enter your community!', 'error'); return; }
    if (formData.cards.some(c => !c.name || !c.level)) { showAlert('Please complete all 5 cards in your deck!', 'error'); return; }
    if (!calculatedStrength || !calculatedStrength.division) { showAlert('Invalid stats! Please check your values.', 'error'); return; }

    await loadPantheonBonuses(formData.guild_id);
    calculateAndDisplayStrength();

    const parts = [
        formData.game_username, formData.game_id, formData.crit_level,
        formData.legendarity, formData.perks_level, formData.timezone,
        formData.community, formData.hero, formData.hero_level,
        formData.hero_item || 'None', formData.hero_item_level || '0'
    ];
    formData.cards.forEach(card => { parts.push(card.name || ''); parts.push(card.level || ''); });
    const exportString = parts.join(',');

    const submissionData = {
        discord_id:      formData.discord_id,
        username:        formData.username,
        guild_id:        formData.guild_id,
        game_username:   formData.game_username,
        game_id:         formData.game_id,
        crit_level:      parseInt(formData.crit_level),
        legendarity:     parseInt(formData.legendarity),
        perks_level:     parseInt(formData.perks_level),
        timezone:        formData.timezone,
        community:       formData.community,
        hero:            formData.hero,
        hero_level:      parseInt(formData.hero_level),
        hero_item:       formData.hero_item || null,
        hero_item_level: formData.hero_item_level ? parseInt(formData.hero_item_level) : null,
        cards:           formData.cards,
        strength:        calculatedStrength,
        export_code:     exportString
    };

    try {
        const btn = document.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = 'Submitting... ⏳';
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submissionData)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Submission failed');
        showSuccessModal(exportString);
    } catch (error) {
        showAlert(`Error: ${error.message}`, 'error');
        const btn = document.querySelector('button[type="submit"]');
        btn.disabled = false; btn.textContent = 'Submit Registration 🚀';
    }
}

function showSuccessModal(exportCode) {
    const modal     = document.getElementById('success-modal');
    const statsDiv  = document.getElementById('success-stats');
    const exportDiv = document.getElementById('export-code');
    statsDiv.innerHTML = `
        <div><p class="opacity-80 text-sm">Base Crit</p><p class="text-xl font-bold">${calculatedStrength.baseCrit}%</p></div>
        <div><p class="opacity-80 text-sm">Adjusted Crit</p><p class="text-xl font-bold">${calculatedStrength.adjustedCrit}%</p></div>
        <div><p class="opacity-80 text-sm">Legendarity</p><p class="text-xl font-bold">${calculatedStrength.legendarity}</p></div>
        <div><p class="opacity-80 text-sm">Perks</p><p class="text-xl font-bold">${calculatedStrength.perks}</p></div>
        <div class="col-span-2 border-t border-white/30 pt-4"><p class="opacity-80 text-sm">Total Strength</p><p class="text-4xl font-bold">${calculatedStrength.totalStrength}</p></div>
        <div class="col-span-2 pt-4 border-t border-white/30"><p class="opacity-80 text-sm">Division</p><p class="text-3xl font-bold">${calculatedStrength.division}</p></div>`;
    exportDiv.textContent = exportCode;
    modal.classList.remove('hidden');
}

function copyExportCode() {
    navigator.clipboard.writeText(document.getElementById('export-code').textContent)
        .then(() => showAlert('Export code copied to clipboard!', 'success'))
        .catch(() => showAlert('Failed to copy. Please select and copy manually.', 'error'));
}

function clearFormAndRestart() {
    formData = { ...formData, game_username:'', game_id:'', crit_level:'', legendarity:'', perks_level:'', timezone:'UTC-05:00', community:'', hero:'', hero_level:'', hero_item:'', hero_item_level:'', cards: Array(5).fill(null).map(() => ({name:'',level:''})) };
    calculatedStrength = null;
    document.getElementById('registration-form').reset();
    if (formData.discord_id) document.getElementById('discord_id').value = formData.discord_id;
    if (formData.username)   document.getElementById('username').value   = formData.username;
    document.getElementById('strength-display').classList.add('hidden');
    document.getElementById('success-modal').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadCommunities();
    generateCardInputs();
}

function showAlert(message, type) {
    const container = document.getElementById('alert-container');
    const div = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    div.className = `${bgColor} p-4 rounded-lg flex items-center gap-3 mb-4`;
    div.innerHTML = `<span class="text-2xl">${type === 'success' ? '✓' : '✕'}</span><p>${message}</p>`;
    container.appendChild(div);
    setTimeout(() => div.remove(), 5000);
}

function showImportModal()  { document.getElementById('import-modal').classList.remove('hidden'); }
function hideImportModal()  { document.getElementById('import-modal').classList.add('hidden'); document.getElementById('import-code-input').value = ''; }

function importCode() {
    const code = document.getElementById('import-code-input').value.trim();
    if (!code) { showAlert('Please paste an export code first!', 'error'); return; }
    try {
        const parts = code.split(',').map(p => p.trim());
        if (parts.length < 21) { showAlert('Invalid export code format!', 'error'); return; }
        document.getElementById('game_username').value = parts[0]; formData.game_username = parts[0];
        document.getElementById('game_id').value       = parts[1]; formData.game_id       = parts[1];
        document.getElementById('crit_level').value    = parts[2]; formData.crit_level    = parts[2];
        document.getElementById('legendarity').value   = parts[3]; formData.legendarity   = parts[3];
        document.getElementById('perks_level').value   = parts[4]; formData.perks_level   = parts[4];
        document.getElementById('timezone').value      = parts[5]; formData.timezone      = parts[5];

        const commSel = document.getElementById('community');
        let found = false;
        for (let opt of commSel.options) {
            if (opt.value === parts[6]) { commSel.value = parts[6]; formData.community = parts[6]; found = true; break; }
        }
        if (!found) {
            commSel.value = '__OTHER__'; handleCommunityChange();
            setTimeout(() => { const ci = document.getElementById('custom-community-input'); if (ci) { ci.value = parts[6]; formData.community = parts[6]; } }, 100);
        }

        document.getElementById('hero').value       = parts[7]; formData.hero       = parts[7]; handleHeroChange();
        document.getElementById('hero_level').value = parts[8]; formData.hero_level = parts[8];
        if (parts[9] && parts[9] !== 'None') {
            document.getElementById('hero_item').value = parts[9]; formData.hero_item = parts[9];
            if (parts[10] && parts[10] !== '0') { document.getElementById('hero_item_level').value = parts[10]; formData.hero_item_level = parts[10]; }
        }

        for (let i = 0; i < 5; i++) {
            const ni = 11 + (i * 2), li = 12 + (i * 2);
            if (ni < parts.length && parts[ni]) {
                document.getElementById(`card${i}_name`).value  = parts[ni];  formData.cards[i].name  = parts[ni];
                updateCardLevelOptions(i, parts[ni]);
                document.getElementById(`card${i}_level`).value = parts[li]; formData.cards[i].level = parts[li];
            }
        }
        updateDisabledCards();
        calculateAndDisplayStrength();
        hideImportModal();
        window.scrollTo({ top: 200, behavior: 'smooth' });
        showAlert('✅ Export code imported successfully! Review and submit.', 'success');
    } catch (error) {
        showAlert('Error importing code: ' + error.message, 'error');
    }
}