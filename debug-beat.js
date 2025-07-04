// Quick test of the beat parsing logic
const text = 'Lucy walks into the kitchen. "Mom, have you seen Whiskers?" she asks. Her mother looks up from cooking. "No dear, I haven\'t seen him today."';

console.log('Testing beat parsing...');
console.log('Text:', text);

// Find the second quote
const secondQuoteMatch = text.match(/"No dear, I haven't seen him today."/);
if (secondQuoteMatch) {
    const dialogueStartIndex = secondQuoteMatch.index;
    const contextStart = Math.max(0, dialogueStartIndex - 150);
    const context = text.substring(contextStart, dialogueStartIndex);
    
    console.log('\nContext before second quote:', context);
    
    // Test the pattern that should catch "Her mother looks up"
    const responsePattern = /(?:her|his|the)\s+(mother|father|mom|dad|teacher|friend|\w+)\s+(?:looks?|turns?|responds?|replies?|says?|speaks?)/i;
    const match = context.match(responsePattern);
    
    console.log('Pattern match:', match);
    
    if (match) {
        console.log('Found speaker:', match[1]);
        
        // Test normalization
        const speakerName = match[1];
        const normalized = speakerName.toLowerCase();
        const mappings = {
            'mom': 'Mother',
            'mother': 'Mother',
            'dad': 'Father',
            'father': 'Father'
        };
        
        const finalSpeaker = mappings[normalized] || speakerName;
        console.log('Final speaker should be:', finalSpeaker);
    } else {
        console.log('❌ Pattern did not match - this is the problem!');
    }
}
