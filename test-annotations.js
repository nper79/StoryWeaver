// Test the new speaker annotation system
console.log('🧪 Testing Speaker Annotations System\n');

// Mock the parseAnnotatedText function
function parseAnnotatedText(text) {
    const parts = [];
    
    // Regex to find speaker annotations: [SpeakerName]
    const annotationRegex = /\[([^\]]+)\]/g;
    const annotations = [];
    let match;
    
    // Find all speaker annotations
    while ((match = annotationRegex.exec(text)) !== null) {
        annotations.push({
            speaker: match[1].trim(),
            startIndex: match.index,
            endIndex: match.index + match[0].length
        });
    }
    
    // If no annotations found, return empty array
    if (annotations.length === 0) {
        return [];
    }
    
    for (let i = 0; i < annotations.length; i++) {
        const annotation = annotations[i];
        const nextAnnotation = annotations[i + 1];
        
        // Get the text for this speaker
        const textStart = annotation.endIndex;
        const textEnd = nextAnnotation ? nextAnnotation.startIndex : text.length;
        const speakerText = text.substring(textStart, textEnd).trim();
        
        if (speakerText) {
            parts.push({
                speaker: annotation.speaker,
                text: speakerText
            });
        }
    }
    
    return parts;
}

// Test cases
const testCases = [
    {
        name: "Beat 1 with annotations",
        text: '[Narrator]Lucy comes home from school, she lost her cat. [Lucy]"Whiskers, I need to find you!" [Narrator]she calls out desperately.',
        expected: [
            { speaker: 'Narrator', text: 'Lucy comes home from school, she lost her cat.' },
            { speaker: 'Lucy', text: '"Whiskers, I need to find you!"' },
            { speaker: 'Narrator', text: 'she calls out desperately.' }
        ]
    },
    {
        name: "Beat 2 with annotations - Fixed version",
        text: '[Narrator]Lucy walks into the kitchen. [Lucy]"Mom, have you seen Whiskers?" [Narrator]she asks. Her mother looks up from cooking. [Mother]"No dear, I haven\'t seen him today."',
        expected: [
            { speaker: 'Narrator', text: 'Lucy walks into the kitchen.' },
            { speaker: 'Lucy', text: '"Mom, have you seen Whiskers?"' },
            { speaker: 'Narrator', text: 'she asks. Her mother looks up from cooking.' },
            { speaker: 'Mother', text: '"No dear, I haven\'t seen him today."' }
        ]
    },
    {
        name: "Text without annotations (should return empty)",
        text: 'Lucy walks into the kitchen. "Mom, have you seen Whiskers?" she asks.',
        expected: []
    }
];

testCases.forEach((testCase, index) => {
    console.log(`\n📝 Test ${index + 1}: ${testCase.name}`);
    console.log(`Input: ${testCase.text}`);
    
    const result = parseAnnotatedText(testCase.text);
    
    console.log('\n🎭 Results:');
    if (result.length === 0) {
        console.log('  No annotations found (will use fallback parsing)');
    } else {
        result.forEach((part, i) => {
            console.log(`  Part ${i + 1}: [${part.speaker}] "${part.text}"`);
        });
    }
    
    // Check if matches expected
    const matches = JSON.stringify(result) === JSON.stringify(testCase.expected);
    console.log(`\n${matches ? '✅' : '❌'} Test ${matches ? 'PASSED' : 'FAILED'}`);
    
    if (!matches && testCase.expected.length > 0) {
        console.log('\n📋 Expected:');
        testCase.expected.forEach((part, i) => {
            console.log(`  Part ${i + 1}: [${part.speaker}] "${part.text}"`);
        });
    }
});

console.log('\n\n🎯 Summary:');
console.log('The annotation system allows explicit speaker marking in beat text:');
console.log('- Use [SpeakerName] to mark who speaks the following text');
console.log('- Example: [Lucy]"Hello!" [Narrator]she said happily.');
console.log('- This eliminates guesswork and works with any story/characters');
console.log('- Falls back to original parsing if no annotations are found');
