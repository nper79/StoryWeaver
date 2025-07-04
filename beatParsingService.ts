import type { Beat, BeatPart } from './types';

interface ParsedDialogue {
  speaker: string;
  text: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Service for intelligently parsing beats into speaker parts
 */
export class BeatParsingService {
  
  /**
   * Parse a beat text into multiple BeatParts with speaker detection
   * Supports explicit speaker annotations like [Lucy] or [Narrator]
   */
  static parseBeatIntoParts(beat: Beat, detectedCharacters: string[] = []): BeatPart[] {
    const text = beat.text;
    const parts: BeatPart[] = [];
    
    // Use proper narrator speaker for beats
    const testMode = false; // Disabled test mode to use proper narrator voice
    
    if (testMode) {
      const cleanText = text.replace(/\[([^\]]+)\]/g, ''); // Remove any existing annotations
      console.log('🎵 [BeatParsing TEST MODE] Processing beat:', {
        originalText: text,
        cleanText: cleanText,
        speaker: 'Narrator'
      });
      return [{
        text: cleanText,
        speaker: 'Narrator' // Use proper Narrator speaker
      }];
    }
    
    // First, check if the text uses explicit speaker annotations [Name]
    const annotatedParts = this.parseAnnotatedText(text);
    if (annotatedParts.length > 0) {
      return annotatedParts;
    }
    
    // Fallback to original dialogue-based parsing
    const dialogues = this.extractDialogues(text, detectedCharacters);
    
    if (dialogues.length === 0) {
      // No dialogue found, entire text is narration
      return [{
        speaker: 'Narrator',
        text: text.trim()
      }];
    }
    
    let currentIndex = 0;
    
    for (const dialogue of dialogues) {
      // Add narration before this dialogue (if any)
      if (dialogue.startIndex > currentIndex) {
        const narrationText = text.substring(currentIndex, dialogue.startIndex).trim();
        if (narrationText) {
          parts.push({
            speaker: 'Narrator',
            text: narrationText
          });
        }
      }
      
      // Add the dialogue part
      parts.push({
        speaker: dialogue.speaker,
        text: dialogue.text
      });
      
      currentIndex = dialogue.endIndex;
    }
    
    // Add any remaining narration after the last dialogue
    if (currentIndex < text.length) {
      const remainingText = text.substring(currentIndex).trim();
      if (remainingText) {
        parts.push({
          speaker: 'Narrator',
          text: remainingText
        });
      }
    }
    
    return parts;
  }
  
  /**
   * Parse text with explicit speaker annotations like [Lucy] or [Narrator]
   * Returns empty array if no annotations are found
   */
  private static parseAnnotatedText(text: string): BeatPart[] {
    const parts: BeatPart[] = [];
    
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
    
    // If no annotations found, return empty array to use fallback parsing
    if (annotations.length === 0) {
      return [];
    }
    
    let currentIndex = 0;
    
    for (let i = 0; i < annotations.length; i++) {
      const annotation = annotations[i];
      const nextAnnotation = annotations[i + 1];
      
      // Skip any text before the first annotation (shouldn't happen in well-formed text)
      if (i === 0 && annotation.startIndex > 0) {
        currentIndex = annotation.endIndex;
        continue;
      }
      
      // Get the text for this speaker (from end of annotation to start of next annotation or end of text)
      const textStart = annotation.endIndex;
      const textEnd = nextAnnotation ? nextAnnotation.startIndex : text.length;
      const speakerText = text.substring(textStart, textEnd).trim();
      
      if (speakerText) {
        parts.push({
          speaker: annotation.speaker,
          text: speakerText
        });
      }
      
      currentIndex = textEnd;
    }
    
    return parts;
  }
  
  /**
   * Extract all dialogue segments from text with speaker detection
   */
  private static extractDialogues(text: string, detectedCharacters: string[] = []): ParsedDialogue[] {
    const dialogues: ParsedDialogue[] = [];
    
    // Simple and reliable approach to find quoted text
    
    // Find all quoted segments using a more reliable method
    const findQuotedText = (text: string) => {
      const results = [];
      let i = 0;
      
      while (i < text.length) {
        const char = text[i];
        
        // Found opening quote (single or double)
        if (char === '"' || char === "'") {
          const quoteChar = char;
          const startIndex = i;
          let endIndex = -1;
          
          // Look for closing quote
          for (let j = i + 1; j < text.length; j++) {
            if (text[j] === quoteChar) {
              endIndex = j;
              break;
            }
          }
          
          // If we found a complete quoted segment
          if (endIndex !== -1) {
            const fullMatch = text.substring(startIndex, endIndex + 1);
            const quoteContent = text.substring(startIndex + 1, endIndex);
            
            results.push({
              fullMatch,
              quoteContent,
              startIndex,
              endIndex: endIndex + 1
            });
            
            i = endIndex + 1; // Skip past this quote
          } else {
            i++; // No closing quote found, continue
          }
        } else {
          i++;
        }
      }
      
      return results;
    };
    
    const quotedSegments = findQuotedText(text);
    
    for (const segment of quotedSegments) {
      const { quoteContent, startIndex, endIndex } = segment;
      
      // Try to identify the speaker from the context before the quote
      const speaker = this.identifySpeaker(text, startIndex, detectedCharacters);
      
      dialogues.push({
        speaker,
        text: quoteContent,
        startIndex,
        endIndex
      });
    }
    
    return dialogues;
  }
  
  /**
   * Identify the speaker based on context before the dialogue
   */
  private static identifySpeaker(text: string, dialogueStartIndex: number, detectedCharacters: string[] = []): string {
    // Get the text before the dialogue (up to 150 characters back for better context)
    const contextStart = Math.max(0, dialogueStartIndex - 150);
    const context = text.substring(contextStart, dialogueStartIndex);
    
    // Get text after the dialogue to check for attribution patterns
    const afterDialogueStart = dialogueStartIndex;
    const afterDialogueEnd = Math.min(text.length, dialogueStartIndex + 200);
    const afterContext = text.substring(afterDialogueStart, afterDialogueEnd);
    
    // First, check for explicit attribution patterns AFTER the dialogue
    const postDialoguePatterns = [
      // "she says", "he asks", "Lucy responds", etc.
      /"[^"]*"\s*,?\s*(\w+)\s+(?:says?|said|asks?|asked|responds?|responded|replies?|replied|calls?|called|shouts?|shouted|whispers?|whispered)/i,
      // "she says" without name - look for recent character
      /"[^"]*"\s*,?\s*(?:she|he)\s+(?:says?|said|asks?|asked|responds?|responded|replies?|replied)/i
    ];
    
    for (const pattern of postDialoguePatterns) {
      const match = afterContext.match(pattern);
      if (match) {
        if (match[1] && this.isValidCharacterName(match[1])) {
          // Found explicit name attribution
          return match[1];
        } else {
          // Found pronoun attribution, look for recent character
          const recentCharacter = this.findRecentCharacter(context, detectedCharacters);
          if (recentCharacter) {
            return recentCharacter;
          }
        }
      }
    }
    
    // Check for patterns indicating who is being addressed or responding
    const responsePatterns = [
      // "Her mother looks up" -> mother is likely the next speaker
      /(?:her|his|the)\s+(mother|father|mom|dad|teacher|friend|\w+)\s+(?:looks?|turns?|responds?|replies?|says?|speaks?)/i,
      // "Mother responds" or "Mom says"
      /(mother|father|mom|dad|teacher|friend|\w+)\s+(?:looks?|turns?|responds?|replies?|says?|speaks?)/i
    ];
    
    for (const pattern of responsePatterns) {
      const match = context.match(pattern);
      if (match) {
        const potentialSpeaker = match[1];
        // Convert common terms to proper names
        const normalizedSpeaker = this.normalizeSpeakerName(potentialSpeaker, detectedCharacters);
        if (normalizedSpeaker) {
          return normalizedSpeaker;
        }
      }
    }
    
    // Original patterns for speaker identification BEFORE the dialogue
    const preDialoguePatterns = [
      // "Lucy says:" or "Lucy said:"
      /(\w+)\s+(?:says?|said|asks?|asked|calls?|called|shouts?|shouted|whispers?|whispered)[\s:]/i,
      // "Lucy:" (direct format)
      /(\w+):\s*$/,
      // "Lucy calls her cat" -> Lucy is likely the speaker
      /(\w+)\s+(?:calls?|tells?|says?|asks?|shouts?|whispers?)/i,
    ];
    
    for (const pattern of preDialoguePatterns) {
      const match = context.match(pattern);
      if (match) {
        const potentialSpeaker = match[1];
        // Validate that this looks like a character name and is in detected characters
        if (this.isValidCharacterName(potentialSpeaker) && 
            (detectedCharacters.length === 0 || detectedCharacters.includes(potentialSpeaker))) {
          return potentialSpeaker;
        }
      }
    }
    
    // If no clear speaker found, try to find the most recently mentioned character
    const recentCharacter = this.findRecentCharacter(context, detectedCharacters);
    if (recentCharacter) {
      return recentCharacter;
    }
    
    // Default fallback
    return 'Unknown Speaker';
  }
  
  /**
   * Normalize speaker names (convert mom -> Mother, etc.)
   */
  private static normalizeSpeakerName(speakerName: string, detectedCharacters: string[] = []): string | null {
    const normalized = speakerName.toLowerCase();
    
    // Common mappings
    const mappings: { [key: string]: string } = {
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
    
    // If it's a proper name and in detected characters, use it
    const properName = speakerName.charAt(0).toUpperCase() + speakerName.slice(1).toLowerCase();
    if (this.isValidCharacterName(properName) && 
        (detectedCharacters.length === 0 || detectedCharacters.includes(properName))) {
      return properName;
    }
    
    return null;
  }
  
  /**
   * Check if a string looks like a valid character name
   */
  private static isValidCharacterName(name: string): boolean {
    // Must be capitalized, reasonable length, no numbers or special chars
    return /^[A-Z][a-zA-Z]{1,20}$/.test(name) && 
           !['The', 'She', 'He', 'They', 'It', 'This', 'That'].includes(name);
  }
  
  /**
   * Find the most recently mentioned character in the context
   */
  private static findRecentCharacter(context: string, detectedCharacters: string[] = []): string | null {
    // Look for capitalized words that could be character names
    const words = context.split(/\s+/);
    
    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i].replace(/[.,!?:;]$/, ''); // Remove punctuation
      if (this.isValidCharacterName(word) && 
          (detectedCharacters.length === 0 || detectedCharacters.includes(word))) {
        return word;
      }
    }
    
    return null;
  }
  
  /**
   * Convert existing beats to use the new parts structure
   */
  static migrateBeatToParts(beat: Beat, detectedCharacters: string[] = []): Beat {
    if (beat.parts && beat.parts.length > 0) {
      // Already has parts, no migration needed
      return beat;
    }
    
    const parts = this.parseBeatIntoParts(beat, detectedCharacters);
    
    return {
      ...beat,
      parts
    };
  }
  
  /**
   * Batch migrate multiple beats
   */
  static migrateBeats(beats: Beat[], detectedCharacters: string[] = []): Beat[] {
    return beats.map(beat => this.migrateBeatToParts(beat, detectedCharacters));
  }
}
