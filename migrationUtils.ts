// Migration utilities to transition from localStorage base64 storage to IndexedDB storage

import { saveGeneratedImage, saveCharacterImage } from './fileStorageService';
import type { Scene, VoiceAssignment } from './types';

/**
 * Migrate a scene's generatedImageUrl to the new storage system
 */
export async function migrateSceneImage(scene: Scene): Promise<Partial<Scene>> {
  if ((scene as any).generatedImageUrl && !scene.generatedImageId) {
    try {
      console.log(`[Migration] Migrating scene image for: ${scene.title}`);
      const imageId = await saveGeneratedImage((scene as any).generatedImageUrl, scene.id);
      
      // Return updates to apply to the scene
      return {
        generatedImageId: imageId,
        // Remove the old property by setting it to undefined
        ...(delete (scene as any).generatedImageUrl, {})
      };
    } catch (error) {
      console.error(`[Migration] Failed to migrate scene image for ${scene.title}:`, error);
      return {};
    }
  }
  return {};
}

/**
 * Migrate a character's imageUrl to the new storage system
 */
export async function migrateCharacterImage(assignment: VoiceAssignment): Promise<Partial<VoiceAssignment>> {
  if ((assignment as any).imageUrl && !assignment.imageId) {
    try {
      console.log(`[Migration] Migrating character image for: ${assignment.characterName}`);
      const imageId = await saveCharacterImage((assignment as any).imageUrl, assignment.characterName);
      
      // Return updates to apply to the assignment
      return {
        imageId: imageId,
        // Remove the old property by setting it to undefined
        ...(delete (assignment as any).imageUrl, {})
      };
    } catch (error) {
      console.error(`[Migration] Failed to migrate character image for ${assignment.characterName}:`, error);
      return {};
    }
  }
  return {};
}

/**
 * Check if migration is needed for scenes
 */
export function needsSceneMigration(scenes: Scene[]): boolean {
  return scenes.some(scene => (scene as any).generatedImageUrl && !scene.generatedImageId);
}

/**
 * Check if migration is needed for voice assignments
 */
export function needsCharacterMigration(assignments: VoiceAssignment[]): boolean {
  return assignments.some(assignment => (assignment as any).imageUrl && !assignment.imageId);
}
