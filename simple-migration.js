// Simple and effective beat migration
function migrateBeat(beatText) {
    // If already has annotations, don't migrate
    if (beatText.includes('[') && beatText.includes(']')) {
        return beatText;
    }
    
    let result = '';
    let currentIndex = 0;
    
    // Find all quoted dialogue
    const quoteRegex = /"([^"]*)"/g;
    let match;
    
    while ((match = quoteRegex.exec(beatText)) !== null) {
        const beforeQuote = beatText.substring(currentIndex, match.index);
        const quote = match[0];
        
        // Add narration before quote
        if (beforeQuote.trim()) {
            result += `[Narrator]${beforeQuote.trim()} `;
        }
        
        // Determine speaker based on context
        let speaker = 'Character';
        const contextBefore = beatText.substring(Math.max(0, match.index - 50), match.index).toLowerCase();
        
        if (contextBefore.includes('lucy')) {
            speaker = 'Lucy';
        } else if (contextBefore.includes('mother') || contextBefore.includes('mom')) {
            speaker = 'Mother';
        } else if (contextBefore.includes('father') || contextBefore.includes('dad')) {
            speaker = 'Father';
        }
        
        result += `[${speaker}]${quote} `;
        currentIndex = match.index + match[0].length;
    }
    
    // Add remaining text as narration
    const remaining = beatText.substring(currentIndex).trim();
    if (remaining) {
        result += `[Narrator]${remaining}`;
    }
    
    // If no quotes found, treat all as narration
    if (!result) {
        result = `[Narrator]${beatText}`;
    }
    
    return result.trim();
}

// Test cases
const tests = [
    'Lucy walks into the kitchen. "Mom, have you seen Whiskers?" she asks. Her mother looks up from cooking. "No dear, I haven\'t seen him today."',
    'Lucy comes home from school, she lost her cat. "Whiskers, I need to find you!" she calls out desperately.',
    'The cat is nowhere to be found. Lucy searches everywhere.',
    '[Narrator]Already annotated text [Lucy]"Should not change"'
];

tests.forEach((test, i) => {
    console.log(`\nTest ${i + 1}:`);
    console.log('Original:', test);
    console.log('Migrated:', migrateBeat(test));
});
