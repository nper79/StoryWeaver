// Full test of the beat parsing logic with all patterns
const text = 'Lucy walks into the kitchen. "Mom, have you seen Whiskers?" she asks. Her mother looks up from cooking. "No dear, I haven\'t seen him today."';

console.log('🧪 Full Beat Parsing Test');
console.log('Text:', text);

// Simulate the full identifySpeaker logic
function identifySpeaker(text, dialogueStartIndex, detectedCharacters = ['Lucy', 'Whiskers', 'Mother']) {
    const contextStart = Math.max(0, dialogueStartIndex - 150);
    const context = text.substring(contextStart, dialogueStartIndex);
    
    // Get text after the dialogue to check for attribution patterns
    const afterDialogueStart = dialogueStartIndex;
    const afterDialogueEnd = Math.min(text.length, dialogueStartIndex + 200);
    const afterContext = text.substring(afterDialogueStart, afterDialogueEnd);
    
    console.log('\n📍 Context before dialogue:', context);
    console.log('📍 Context after dialogue:', afterContext);
    
    // First, check for explicit attribution patterns AFTER the dialogue
    const postDialoguePatterns = [
        /"[^"]*"\s*,?\s*(\w+)\s+(?:says?|said|asks?|asked|responds?|responded|replies?|replied|calls?|called|shouts?|shouted|whispers?|whispered)/i,
        /"[^"]*"\s*,?\s*(?:she|he)\s+(?:says?|said|asks?|asked|responds?|responded|replies?|replied)/i
    ];
    
    console.log('\n🔍 Testing post-dialogue patterns...');
    for (const pattern of postDialoguePatterns) {
        const match = afterContext.match(pattern);
        if (match) {
            console.log('✅ Post-dialogue match:', match);
            if (match[1] && isValidCharacterName(match[1])) {
                console.log('🎯 Found explicit name attribution:', match[1]);
                return match[1];
            } else {
                console.log('🔄 Found pronoun attribution, looking for recent character...');
                const recentCharacter = findRecentCharacter(context, detectedCharacters);
                if (recentCharacter) {
                    console.log('🎯 Found recent character:', recentCharacter);
                    return recentCharacter;
                }
            }
        }
    }
    
    // Check for patterns indicating who is being addressed or responding
    const responsePatterns = [
        /(?:her|his|the)\s+(mother|father|mom|dad|teacher|friend|\w+)\s+(?:looks?|turns?|responds?|replies?|says?|speaks?)/i,
        /(mother|father|mom|dad|teacher|friend|\w+)\s+(?:looks?|turns?|responds?|replies?|says?|speaks?)/i
    ];
    
    console.log('\n🔍 Testing response patterns...');
    for (const pattern of responsePatterns) {
        const match = context.match(pattern);
        if (match) {
            console.log('✅ Response pattern match:', match);
            const potentialSpeaker = match[1];
            const normalizedSpeaker = normalizeSpeakerName(potentialSpeaker, detectedCharacters);
            if (normalizedSpeaker) {
                console.log('🎯 Found normalized speaker:', normalizedSpeaker);
                return normalizedSpeaker;
            }
        }
    }
    
    console.log('❌ No patterns matched, returning Unknown Speaker');
    return 'Unknown Speaker';
}

function normalizeSpeakerName(speakerName, detectedCharacters = []) {
    const normalized = speakerName.toLowerCase();
    
    const mappings = {
        'mom': 'Mother',
        'mother': 'Mother',
        'dad': 'Father',
        'father': 'Father',
        'teacher': 'Teacher',
        'friend': 'Friend'
    };
    
    if (mappings[normalized]) {
        return mappings[normalized];
    }
    
    const properName = speakerName.charAt(0).toUpperCase() + speakerName.slice(1).toLowerCase();
    if (isValidCharacterName(properName) && 
        (detectedCharacters.length === 0 || detectedCharacters.includes(properName))) {
        return properName;
    }
    
    return null;
}

function isValidCharacterName(name) {
    return /^[A-Z][a-zA-Z]{1,20}$/.test(name) && 
           !['The', 'She', 'He', 'They', 'It', 'This', 'That'].includes(name);
}

function findRecentCharacter(context, detectedCharacters = []) {
    const words = context.split(/\s+/);
    
    for (let i = words.length - 1; i >= 0; i--) {
        const word = words[i].replace(/[.,!?:;]$/, '');
        if (isValidCharacterName(word) && 
            (detectedCharacters.length === 0 || detectedCharacters.includes(word))) {
            return word;
        }
    }
    
    return null;
}

// Test both quotes
const quotes = [];
const regex = /"([^"]*)"/g;
let match;

while ((match = regex.exec(text)) !== null) {
    quotes.push({
        text: match[1],
        startIndex: match.index
    });
}

quotes.forEach((quote, index) => {
    console.log(`\n\n🎭 TESTING QUOTE ${index + 1}: "${quote.text}"`);
    const speaker = identifySpeaker(text, quote.startIndex);
    console.log(`🎯 FINAL RESULT: ${speaker}`);
});
