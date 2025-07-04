// Simple beat migration function for testing
function migrateBeatToAnnotatedFormat(beatText, characters = []) {
    // Simple heuristic-based migration without AI
    let result = beatText;
    
    // Find quoted dialogue
    const dialogueRegex = /"([^"]*)"/g;
    const dialogues = [];
    let match;
    
    while ((match = dialogueRegex.exec(beatText)) !== null) {
        dialogues.push({
            text: match[1],
            fullMatch: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length
        });
    }
    
    if (dialogues.length === 0) {
        // No dialogue, all narration
        return `[Narrator]${beatText}`;
    }
    
    // Process from end to beginning to maintain indices
    for (let i = dialogues.length - 1; i >= 0; i--) {
        const dialogue = dialogues[i];
        const beforeDialogue = beatText.substring(0, dialogue.startIndex);
        
        // Simple speaker detection
        let speaker = 'Unknown';
        
        // Look for character names before the dialogue
        const lastSentence = beforeDialogue.split('.').pop() || '';
        for (const char of characters) {
            if (lastSentence.toLowerCase().includes(char.toLowerCase())) {
                speaker = char;
                break;
            }
        }
        
        // If no character found, use context clues
        if (speaker === 'Unknown') {
            if (lastSentence.includes('mother') || lastSentence.includes('mom')) {
                speaker = 'Mother';
            } else if (lastSentence.includes('father') || lastSentence.includes('dad')) {
                speaker = 'Father';
            } else if (characters.length > 0) {
                speaker = characters[0]; // Default to first character
            }
        }
        
        // Replace the dialogue with annotated version
        result = result.substring(0, dialogue.startIndex) + 
                `[${speaker}]${dialogue.fullMatch}` + 
                result.substring(dialogue.endIndex);
    }
    
    // Add [Narrator] to the beginning if it doesn't start with an annotation
    if (!result.startsWith('[')) {
        result = `[Narrator]${result}`;
    }
    
    // Add [Narrator] before any text that doesn't have an annotation
    result = result.replace(/(\][^[]*?)([A-Z][^[]*?)(?=\[|$)/g, '$1[Narrator]$2');
    
    return result;
}

// Test the migration
const testBeat = 'Lucy walks into the kitchen. "Mom, have you seen Whiskers?" she asks. Her mother looks up from cooking. "No dear, I haven\'t seen him today."';
const characters = ['Lucy', 'Mother', 'Whiskers'];

console.log('Original:', testBeat);
console.log('Migrated:', migrateBeatToAnnotatedFormat(testBeat, characters));

// Test with no dialogue
const testBeat2 = 'Lucy walks through the empty house, calling for her cat.';
console.log('\nOriginal:', testBeat2);
console.log('Migrated:', migrateBeatToAnnotatedFormat(testBeat2, characters));
