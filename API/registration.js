// registration.js - Complete Registration Logic with API Integration

const PANTHEON_BONUSES = {
    "Twins": 0.20,
    "Valkerie": 0.40,
    "Phoenix": 0.20,
    "Twilight Ranger": 0.20,
    "Franky & Stein": 0.20
};

const LEGENDARY_CARDS = [
    "Banshee", "Bard", "Bruiser", "Blade Dancer", "Boreas", "Corsair", "Cultist",
    "Demon Hunter", "Demonologist", "Spirit Master", "Dryad", "Franky & Stein",
    "Frost", "Gun Slinger", "Harlequin", "Inquisitor", "Genie", "Hex",
    "Knight Statue", "Kobold", "Twilight Ranger", "Clock", "Meteor", "Minotaur",
    "Monk", "Swords", "Phoenix", "Riding Hood", "Robot", "Scrapper", "Stasis",
    "Summoner", "Tesla", "Trapper", "Treant", "Sea Dog", "Twins", "Witch", "Shaman",
    "Valkerie"
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

const DEFAULT_WEIGHTS = { crit: 0.40, legendarity: 0.40, perks: 0.20 };
const DEFAULT_THRESHOLDS = {
    "Lightweight": [0, 499],
    "Cruiserweight": [500, 999],
    "Middleweight": [1000, 1499],
    "Heavyweight": [1500, 1999],
    "Super Heavyweight": [2000, 2499],
    "Champion": [2500, 10000]
};

let formData = {
    discord_id: '',
    username: '',
    guild_id: '',
    game_username: '',
    game_id: '',
    crit_level: '',
    legendarity: '',
    perks_level: '',
    timezone: 'UTC-05:00',
    community: '',
    hero: '',
    hero_level: '',
    hero_item: '',
    hero_item_level: '',
    cards: [
        { name: '', level: '' },
        { name: '', level: '' },
        { name: '', level: '' },
        { name: '', level: '' },
        { name: '', level: '' }
    ]
};

let calculatedStrength = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeForm();
    populateURLParams();
    generateCardInputs();
    attachEventListeners();
    loadCommunities();
});

function populateURLParams() {
    const params = new URLSearchParams(window.location.search);
    const discord_id = params.get('discord_id');
    const username = params.get('username');
    const guild_id = params.get('guild_id');
    
    if (discord_id) {
        document.getElementById('discord_id').value = discord_id;
        formData.discord_id = discord_id;
        const input = document.getElementById('discord_id');
        input.style.backgroundColor = '#e8f5e9';
        input.style.borderColor = '#4caf50';
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
    document.getElementById('discord_id').addEventListener('input', function(e) {
        const original = this.value;
        this.value = this.value.replace(/[^0-9]/g, '');
        
        if (original !== this.value) {
            showAlert('Discord ID can only contain numbers!', 'error');
        }
        
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

function generateCardInputs() {
    for (let i = 0; i < 5; i++) {
        const nameSelect = document.getElementById(`card${i}_name`);
        const levelSelect = document.getElementById(`card${i}_level`);
        
        nameSelect.innerHTML = '<option value="">Select card...</option>';
        ALL_CARDS.forEach(card => {
            const option = document.createElement('option');
            option.value = card;
            option.textContent = `${card} ${LEGENDARY_CARDS.includes(card) ? '⭐' : ''}`;
            nameSelect.appendChild(option);
        });
        
        levelSelect.innerHTML = '<option value="">Level...</option>';
        for (let j = 1; j <= 15; j++) {
            const option = document.createElement('option');
            option.value = j;
            option.textContent = `Level ${j}`;
            levelSelect.appendChild(option);
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
    for (let i = 1; i <= 15; i++) {
        options += `<option value="${i}">Level ${i}</option>`;
    }
    
    if (LEGENDARY_CARDS.includes(cardName)) {
        options += `<option value="16">Reincarnated I (16)</option>`;
        options += `<option value="17">Reincarnated II (17)</option>`;
        options += `<option value="18">Reincarnated III (18)</option>`;
    }
    
    levelSelect.innerHTML = options;
    if (currentValue) {
        levelSelect.value = currentValue;
    }
}

function updateDisabledCards() {
    const selectedCards = formData.cards.map(c => c.name).filter(Boolean);
    
    for (let i = 0; i < 5; i++) {
        const select = document.getElementById(`card${i}_name`);
        const currentValue = select.value;
        
        Array.from(select.options).forEach(option => {
            if (option.value && selectedCards.includes(option.value) && option.value !== currentValue) {
                option.disabled = true;
            } else {
                option.disabled = false;
            }
        });
    }
}

async function loadCommunities() {
    const communitySelect = document.getElementById('community');
    
    try {
        communitySelect.innerHTML = '<option value="">Loading communities...</option>';
        
        if (formData.guild_id) {
            // Try to fetch from API
            const response = await fetch(`/api/communities?guild_id=${formData.guild_id}`);
            
            if (response.ok) {
                const data = await response.json();
                const communities = data.communities || [];
                
                if (communities.length > 0) {
                    populateCommunityDropdown(communities);
                    return;
                }
            }
        }
        
        // Fallback to default communities
        useDefaultCommunities();
        
    } catch (error) {
        console.error('Error loading communities:', error);
        useDefaultCommunities();
    }
}

function useDefaultCommunities() {
    const communities = [
        { name: 'Shinning Stars', emoji: '🌟' },
        { name: 'Empires Gaming', emoji: '🦁' },
        { name: 'Ronin Gaming', emoji: '🥷' }
    ];
    populateCommunityDropdown(communities);
}

function populateCommunityDropdown(communities) {
    const select = document.getElementById('community');
    select.innerHTML = '<option value="">Select community...</option>';
    
    communities.forEach(comm => {
        const option = document.createElement('option');
        option.value = comm.name;
        option.textContent = `${comm.emoji} ${comm.name}`;
        select.appendChild(option);
    });
    
    const otherOption = document.createElement('option');
    otherOption.value = '__OTHER__';
    otherOption.textContent = '✏️ Other (Type your community)';
    otherOption.style.fontStyle = 'italic';
    select.appendChild(otherOption);
}

function handleCommunityChange() {
    const select = document.getElementById('community');
    const container = document.getElementById('community-container');
    const existingInput = document.getElementById('custom-community-input');
    const existingHelper = document.getElementById('custom-community-helper');
    
    if (existingInput) existingInput.remove();
    if (existingHelper) existingHelper.remove();
    
    if (select.value === '__OTHER__') {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'custom-community-input';
        input.placeholder = 'Enter your community name';
        input.className = 'w-full p-3 border-2 rounded-lg focus:border-blue-500 outline-none mt-2';
        input.required = true;
        input.maxLength = 50;
        
        const helper = document.createElement('p');
        helper.id = 'custom-community-helper';
        helper.className = 'text-xs text-gray-500 mt-1';
        helper.textContent = 'Your community will be added to the list automatically';
        
        container.appendChild(input);
        container.appendChild(helper);
        input.focus();
        
        input.addEventListener('input', function() {
            formData.community = this.value.trim();
        });
        
        formData.community = '';
    } else {
        formData.community = select.value;
    }
}

function attachEventListeners() {
    ['crit_level', 'legendarity', 'perks_level'].forEach(id => {
        document.getElementById(id).addEventListener('input', function() {
            formData[id] = this.value;
            calculateAndDisplayStrength();
        });
    });
    
    document.getElementById('community').addEventListener('change', function() {
        handleCommunityChange();
    });
    
    ['username', 'game_username', 'game_id', 'timezone', 'hero', 'hero_level', 'hero_item', 'hero_item_level'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', function() {
                formData[id] = this.value;
            });
            if (element.tagName === 'INPUT') {
                element.addEventListener('input', function() {
                    formData[id] = this.value;
                });
            }
        }
    });
    
    document.getElementById('registration-form').addEventListener('submit', handleFormSubmit);
}

function calculateAndDisplayStrength() {
    const baseCrit = parseInt(formData.crit_level) || 0;
    const legendarity = parseInt(formData.legendarity) || 0;
    const perks = parseInt(formData.perks_level) || 0;
    
    if (!baseCrit || !legendarity || perks === '') return;
    
    let pantheonBonus = 0;
    const pantheonCards = [];
    
    formData.cards.forEach(card => {
        if (card.name && PANTHEON_BONUSES[card.name]) {
            pantheonBonus += PANTHEON_BONUSES[card.name];
            pantheonCards.push({
                name: card.name,
                bonus: PANTHEON_BONUSES[card.name]
            });
        }
    });
    
    const adjustedCrit = Math.floor(baseCrit * (1 + pantheonBonus));
    
    const totalStrength = Math.floor(
        (adjustedCrit * DEFAULT_WEIGHTS.crit) +
        (legendarity * DEFAULT_WEIGHTS.legendarity) +
        (perks * DEFAULT_WEIGHTS.perks)
    );
    
    let division = null;
    for (const [div, [min, max]] of Object.entries(DEFAULT_THRESHOLDS)) {
        if (totalStrength >= min && totalStrength <= max) {
            division = div;
            break;
        }
    }
    
    calculatedStrength = {
        baseCrit,
        adjustedCrit,
        legendarity,
        perks,
        totalStrength,
        division,
        pantheonCards
    };
    
    displayStrength();
}

function displayStrength() {
    if (!calculatedStrength || !calculatedStrength.division) return;
    
    const display = document.getElementById('strength-display');
    display.classList.remove('hidden');
    
    document.getElementById('display-base-crit').textContent = calculatedStrength.baseCrit + '%';
    document.getElementById('display-adj-crit').textContent = calculatedStrength.adjustedCrit + '%';
    document.getElementById('display-legendarity').textContent = calculatedStrength.legendarity;
    document.getElementById('display-perks').textContent = calculatedStrength.perks;
    document.getElementById('display-total-strength').textContent = calculatedStrength.totalStrength;
    document.getElementById('display-division').textContent = calculatedStrength.division;
    
    const pantheonDisplay = document.getElementById('pantheon-display');
    if (calculatedStrength.pantheonCards.length > 0) {
        pantheonDisplay.classList.remove('hidden');
        pantheonDisplay.innerHTML = `
            <p class="font-semibold text-purple-900 mb-2">🔮 Pantheon Bonuses:</p>
            <div class="flex flex-wrap gap-2">
                ${calculatedStrength.pantheonCards.map(c => 
                    `<span class="bg-purple-200 text-purple-900 px-3 py-1 rounded-full text-sm font-semibold">
                        ${c.name}: +${Math.floor(c.bonus * 100)}%
                    </span>`
                ).join('')}
            </div>
        `;
    } else {
        pantheonDisplay.classList.add('hidden');
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
        const customName = customInput.value.trim();
        if (!customName || customName.length < 2) {
            showAlert('Please enter a valid community name (at least 2 characters).', 'error');
            customInput.focus();
            return;
        }
        formData.community = customName;
    }
    
    if (!formData.community) {
        showAlert('Please select or enter your community!', 'error');
        document.getElementById('community').focus();
        return;
    }
    
    if (formData.cards.some(c => !c.name || !c.level)) {
        showAlert('Please complete all 5 cards in your deck!', 'error');
        return;
    }
    
    if (!calculatedStrength || !calculatedStrength.division) {
        showAlert('Invalid stats! Please check your values.', 'error');
        return;
    }
    
    // Generate export code
    const parts = [
        formData.game_username,
        formData.game_id,
        formData.crit_level,
        formData.legendarity,
        formData.perks_level,
        formData.timezone,
        formData.community,
        formData.hero,
        formData.hero_level,
        formData.hero_item || 'None',
        formData.hero_item_level || '0'
    ];
    
    formData.cards.forEach(card => {
        parts.push(card.name || '');
        parts.push(card.level || '');
    });
    
    const exportString = parts.join(',');
    
    const submissionData = {
        discord_id: formData.discord_id,
        username: formData.username,
        guild_id: formData.guild_id,
        game_username: formData.game_username,
        game_id: formData.game_id,
        crit_level: parseInt(formData.crit_level),
        legendarity: parseInt(formData.legendarity),
        perks_level: parseInt(formData.perks_level),
        timezone: formData.timezone,
        community: formData.community,
        hero: formData.hero,
        hero_level: parseInt(formData.hero_level),
        hero_item: formData.hero_item || null,
        hero_item_level: formData.hero_item_level ? parseInt(formData.hero_item_level) : null,
        cards: formData.cards,
        strength: calculatedStrength,
        export_code: exportString
    };
    
    try {
        const submitButton = document.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting... ⏳';
        
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submissionData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Submission failed');
        }
        
        showSuccessModal(exportString);
        
    } catch (error) {
        console.error('Submission error:', error);
        showAlert(`Error: ${error.message}`, 'error');
        
        const submitButton = document.querySelector('button[type="submit"]');
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Registration 🚀';
    }
}

function showSuccessModal(exportCode) {
    const modal = document.getElementById('success-modal');
    const statsDiv = document.getElementById('success-stats');
    const exportDiv = document.getElementById('export-code');
    
    statsDiv.innerHTML = `
        <div>
            <p class="opacity-80 text-sm">Base Crit</p>
            <p class="text-xl font-bold">${calculatedStrength.baseCrit}%</p>
        </div>
        <div>
            <p class="opacity-80 text-sm">Adjusted Crit</p>
            <p class="text-xl font-bold">${calculatedStrength.adjustedCrit}%</p>
        </div>
        <div>
            <p class="opacity-80 text-sm">Legendarity</p>
            <p class="text-xl font-bold">${calculatedStrength.legendarity}</p>
        </div>
        <div>
            <p class="opacity-80 text-sm">Perks</p>
            <p class="text-xl font-bold">${calculatedStrength.perks}</p>
        </div>
        <div class="col-span-2 border-t border-white/30 pt-4">
            <p class="opacity-80 text-sm">Total Strength</p>
            <p class="text-4xl font-bold">${calculatedStrength.totalStrength}</p>
        </div>
        <div class="col-span-2 pt-4 border-t border-white/30">
            <p class="opacity-80 text-sm">Division</p>
            <p class="text-3xl font-bold">${calculatedStrength.division}</p>
        </div>
    `;
    
    exportDiv.textContent = exportCode;
    modal.classList.remove('hidden');
}

function copyExportCode() {
    const exportCode = document.getElementById('export-code').textContent;
    navigator.clipboard.writeText(exportCode).then(() => {
        showAlert('Export code copied to clipboard!', 'success');
    }).catch(() => {
        showAlert('Failed to copy. Please select and copy manually.', 'error');
    });
}

function showAlert(message, type) {
    const container = document.getElementById('alert-container');
    const alertDiv = document.createElement('div');
    
    const bgColor = type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    const icon = type === 'success' ? '✓' : '✕';
    
    alertDiv.className = `${bgColor} p-4 rounded-lg flex items-center gap-3 mb-4`;
    alertDiv.innerHTML = `
        <span class="text-2xl">${icon}</span>
        <p>${message}</p>
    `;
    
    container.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}
