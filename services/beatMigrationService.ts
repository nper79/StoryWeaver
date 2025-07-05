import { Beat } from '../types';

/**
 * Simple beat migration service that adds speaker annotations without using external APIs
 */
export class BeatMigrationService {
  
  /**
   * Migrate a single beat to include speaker annotations
   */
  static migrateBeatToAnnotatedFormat(beatText: string): string {
    return beatText || '';
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
  
  /**
   * Add speaker annotations to a beat text
   */
  static addSpeakerAnnotations(beatText: string): string {
    // Return text as-is without any speaker annotations
    // This function is kept for compatibility but no longer adds formatting
    return beatText || '';
  }
}

export const beatMigrationService = new BeatMigrationService();
