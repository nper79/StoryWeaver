import { Scene, StoryData, Connection } from './types';
import { extractLocationKey } from './locationConsistencyService';

interface SceneSequenceInfo {
  previousScene: Scene | null;
  isSameLocation: boolean;
  locationKey: string | null;
  shouldUseImageToImage: boolean;
  baseImageId: string | null;
  sequenceType: 'new_location' | 'same_location' | 'continuation';
}

/**
 * Analyzes the sequence of scenes to determine location consistency
 * and whether to use image-to-image generation
 */
export function analyzeSceneSequence(
  currentScene: Scene,
  storyData: StoryData
): SceneSequenceInfo {
  const { scenes, connections } = storyData;
  
  // Find the previous scene in the story flow
  const previousScene = findPreviousScene(currentScene, scenes, connections);
  
  // Extract location keys
  const currentLocationKey = extractLocationKey(currentScene);
  const previousLocationKey = previousScene ? extractLocationKey(previousScene) : null;
  
  // Determine if it's the same location
  const isSameLocation = Boolean(
    currentLocationKey && 
    previousLocationKey && 
    currentLocationKey === previousLocationKey
  );
  
  // Determine if we should use image-to-image generation
  const shouldUseImageToImage = isSameLocation && 
    Boolean(previousScene?.generatedImageId) && 
    previousScene !== null &&
    isSequentialScene(currentScene, previousScene, connections);
  
  // Get base image ID for image-to-image generation
  const baseImageId = shouldUseImageToImage ? previousScene?.generatedImageId || null : null;
  
  // Determine sequence type
  let sequenceType: 'new_location' | 'same_location' | 'continuation' = 'new_location';
  if (isSameLocation) {
    sequenceType = shouldUseImageToImage ? 'continuation' : 'same_location';
  }
  
  return {
    previousScene,
    isSameLocation,
    locationKey: currentLocationKey,
    shouldUseImageToImage,
    baseImageId,
    sequenceType
  };
}

/**
 * Finds the previous scene in the story flow
 */
function findPreviousScene(
  currentScene: Scene,
  scenes: Scene[],
  connections: Connection[]
): Scene | null {
  // Find connections that lead to the current scene
  const incomingConnections = connections.filter(conn => conn.toSceneId === currentScene.id);
  
  if (incomingConnections.length === 0) {
    return null;
  }
  
  // For simplicity, take the first incoming connection
  // In a more complex scenario, you might want to track the actual path taken
  const fromSceneId = incomingConnections[0].fromSceneId;
  return scenes.find(scene => scene.id === fromSceneId) || null;
}

/**
 * Checks if the current scene is a direct sequential continuation of the previous scene
 */
function isSequentialScene(
  currentScene: Scene,
  previousScene: Scene,
  connections: Connection[]
): boolean {
  // Check if there's a direct connection from previous to current
  const directConnection = connections.find(
    conn => conn.fromSceneId === previousScene.id && conn.toSceneId === currentScene.id
  );
  
  return Boolean(directConnection);
}

/**
 * Generates an enhanced prompt for same-location scenes
 */
export function generateSameLocationPrompt(
  basePrompt: string,
  sequenceInfo: SceneSequenceInfo
): string {
  if (!sequenceInfo.isSameLocation || !sequenceInfo.previousScene) {
    return basePrompt;
  }
  
  if (sequenceInfo.shouldUseImageToImage) {
    // For image-to-image generation, focus on what changes
    return `${basePrompt}

IMAGE-TO-IMAGE MODIFICATION: Use the previous scene image as a base and modify it with the following changes:
- Keep the same location, background, and overall composition
- Modify character positions, poses, or expressions as needed
- Add subtle motion or changes to indicate scene progression
- Maintain lighting and atmosphere consistency
- Focus on the new action or dialogue while preserving the established setting

This is a continuation of the previous scene in the same location "${sequenceInfo.locationKey}".`;
  } else {
    // For same location but different composition
    return `${basePrompt}

SAME LOCATION CONTINUATION: This scene takes place in the same location as the previous scene ("${sequenceInfo.locationKey}"). 
- Maintain the same background, architecture, and environmental details
- Keep consistent lighting, color scheme, and atmosphere
- You may change character positions and camera angle for variety
- Ensure the location feels familiar while allowing for new scene dynamics`;
  }
}

/**
 * Determines the optimal image generation strategy for a scene
 */
export function getImageGenerationStrategy(
  scene: Scene,
  storyData: StoryData
): {
  strategy: 'text_to_image' | 'image_to_image';
  baseImageId: string | null;
  enhancedPrompt: string;
  sequenceInfo: SceneSequenceInfo;
} {
  const sequenceInfo = analyzeSceneSequence(scene, storyData);
  const basePrompt = scene.generatedImagePrompt || '';
  
  if (sequenceInfo.shouldUseImageToImage && sequenceInfo.baseImageId) {
    return {
      strategy: 'image_to_image',
      baseImageId: sequenceInfo.baseImageId,
      enhancedPrompt: generateSameLocationPrompt(basePrompt, sequenceInfo),
      sequenceInfo
    };
  } else {
    return {
      strategy: 'text_to_image',
      baseImageId: null,
      enhancedPrompt: generateSameLocationPrompt(basePrompt, sequenceInfo),
      sequenceInfo
    };
  }
}
