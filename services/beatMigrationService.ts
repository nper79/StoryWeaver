import { Beat } from '../types';

/**
 * Simple beat migration service that adds speaker annotations without using external APIs
 */
export class BeatMigrationService {
  
  /**
   * Migrate a single beat to include speaker annotations
   */
  static migrateBeatToAnnotatedFormat(beatText: string): string {
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
      
      // Simple speaker detection based on common patterns
      if (contextBefore.includes('lucy')) {
        speaker = 'Lucy';
      } else if (contextBefore.includes('mother') || contextBefore.includes('mom')) {
        speaker = 'Mother';
      } else if (contextBefore.includes('father') || contextBefore.includes('dad')) {
        speaker = 'Father';
      } else if (contextBefore.includes('teacher')) {
        speaker = 'Teacher';
      } else if (contextBefore.includes('friend')) {
        speaker = 'Friend';
      } else {
        // Look for capitalized names in the context
        const words = contextBefore.split(/\s+/);
        for (let i = words.length - 1; i >= 0; i--) {
          const word = words[i].replace(/[.,!?:;]$/, '');
          if (/^[A-Z][a-zA-Z]{1,20}$/.test(word) && 
              !['The', 'She', 'He', 'They', 'It', 'This', 'That', 'Her', 'His'].includes(word)) {
            speaker = word;
            break;
          }
        }
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
  
  /**
   * Migrate all beats in a scene to include speaker annotations
   */
  static migrateSceneBeats(beats: Beat[]): Beat[] {
    return beats.map(beat => ({
      ...beat,
      text: this.migrateBeatToAnnotatedFormat(beat.text)
    }));
  }
  
  /**
   * Count how many beats need migration (don't have annotations)
   */
  static countBeatsNeedingMigration(beats: Beat[]): number {
    return beats.filter(beat => 
      !beat.text.includes('[') || !beat.text.includes(']')
    ).length;
  }
}

export const beatMigrationService = new BeatMigrationService();
