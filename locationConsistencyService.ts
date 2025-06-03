import { Scene, StoryData } from './types';
import { getImageFromStorage } from './fileStorageService';

interface LocationInfo {
  locationKey: string;
  baseImageId: string;
  description: string;
  scenes: string[]; // Scene IDs that use this location
}

/**
 * Extracts a location key from scene content and setting context
 */
export function extractLocationKey(scene: Scene): string | null {
  const content = scene.content.toLowerCase();
  const settingContext = scene.settingContext?.toLowerCase() || '';
  
  // Common location patterns
  const locationPatterns = [
    /(?:in|at|inside|outside)\s+(?:the\s+)?([a-zA-Z\s]+?)(?:\s|,|\.|\n|$)/g,
    /(?:cafe|coffee shop|restaurant|bar|school|office|home|house|apartment|park|street|mall|store|library|hospital|hotel)/gi,
    /(?:kitchen|bedroom|living room|bathroom|classroom|hallway|garden|balcony|rooftop)/gi
  ];
  
  const allText = `${content} ${settingContext}`;
  
  for (const pattern of locationPatterns) {
    const matches = [...allText.matchAll(pattern)];
    if (matches.length > 0) {
      // Use the first significant location match
      const location = matches[0][1] || matches[0][0];
      return location.trim().replace(/[^a-zA-Z\s]/g, '').toLowerCase();
    }
  }
  
  // Fallback: try to extract from setting context
  if (settingContext) {
    const words = settingContext.split(/\s+/).filter(word => word.length > 3);
    if (words.length > 0) {
      return words.slice(0, 2).join(' ').toLowerCase();
    }
  }
  
  return null;
}

/**
 * Gets or creates location information for a scene
 */
export async function getLocationInfo(
  scene: Scene,
  storyData: StoryData
): Promise<LocationInfo | null> {
  const locationKey = scene.locationKey || extractLocationKey(scene);
  
  if (!locationKey) {
    return null;
  }
  
  // Check if we already have a base image for this location
  const existingLocationScene = storyData.scenes.find(s => 
    s.locationKey === locationKey && s.baseLocationImageId
  );
  
  if (existingLocationScene && existingLocationScene.baseLocationImageId) {
    return {
      locationKey,
      baseImageId: existingLocationScene.baseLocationImageId,
      description: existingLocationScene.settingContext || '',
      scenes: storyData.scenes
        .filter(s => s.locationKey === locationKey)
        .map(s => s.id)
    };
  }
  
  return {
    locationKey,
    baseImageId: '',
    description: scene.settingContext || '',
    scenes: [scene.id]
  };
}

/**
 * Updates a scene with location information after image generation
 */
export function updateSceneWithLocationInfo(
  scene: Scene,
  locationKey: string,
  imageId: string
): Scene {
  return {
    ...scene,
    locationKey,
    baseLocationImageId: imageId
  };
}

/**
 * Enhances image prompt with location consistency information
 */
export async function enhancePromptWithLocationConsistency(
  basePrompt: string,
  scene: Scene,
  storyData: StoryData
): Promise<string> {
  const locationInfo = await getLocationInfo(scene, storyData);
  
  if (!locationInfo || !locationInfo.baseImageId) {
    // First image for this location - just add location consistency instruction
    if (locationInfo?.locationKey) {
      return `${basePrompt}

LOCATION CONSISTENCY NOTE: This is the first image for location "${locationInfo.locationKey}". Establish a clear, distinctive visual style for this location that can be referenced in future images. Pay attention to architectural details, lighting, color scheme, and overall atmosphere.`;
    }
    return basePrompt;
  }
  
  // We have a reference image for this location
  try {
    const baseLocationImage = await getImageFromStorage(locationInfo.baseImageId);
    if (baseLocationImage) {
      return `${basePrompt}

LOCATION CONSISTENCY CRITICAL: This scene takes place in the same location as previous scenes. The location "${locationInfo.locationKey}" has an established visual style. MUST maintain the same:
- Architectural style and layout
- Color scheme and lighting
- Background elements and details
- Overall atmosphere and mood
- Furniture and decorative elements (if indoor)
- Landscape and environmental features (if outdoor)

Reference the established visual style of this location while incorporating the new scene elements.`;
    }
  } catch (error) {
    console.warn('Failed to load base location image:', error);
  }
  
  return basePrompt;
}

/**
 * Updates all scenes in the story data with location keys
 */
export function updateStoryWithLocationKeys(storyData: StoryData): StoryData {
  const updatedScenes = storyData.scenes.map(scene => {
    if (!scene.locationKey) {
      const locationKey = extractLocationKey(scene);
      if (locationKey) {
        return { ...scene, locationKey };
      }
    }
    return scene;
  });
  
  return {
    ...storyData,
    scenes: updatedScenes
  };
}
