import type { Scene, VoiceAssignment } from './types';
import { getImageFromStorage } from './fileStorageService';

export interface CharacterDetectionResult {
  detectedCharacters: string[];
  settingContext: string;
}

export interface EnhancedPromptResult {
  prompt: string;
  charactersInScene: string[];
  settingUsed: string;
}

/**
 * Detects characters mentioned in a scene's content
 */
export function detectCharactersInScene(
  sceneContent: string, 
  availableCharacters: VoiceAssignment[]
): string[] {
  const detectedCharacters: string[] = [];
  
  console.log(`[CharacterDetection] Analyzing scene content:`, sceneContent.substring(0, 200) + '...');
  console.log(`[CharacterDetection] Available characters:`, availableCharacters.map(c => c.characterName));
  
  // Look for character names in the content (EXCLUDING Narrator)
  availableCharacters.forEach(character => {
    const charName = character.characterName.toLowerCase();
    const originalName = character.characterName;
    
    // Skip narrator - it's never a visual character in scenes
    if (charName === 'narrator') {
      console.log(`[CharacterDetection] Skipping Narrator - not a visual character`);
      return;
    }
    
    // Check if character name appears in content
    const contentLower = sceneContent.toLowerCase();
    const patterns = [
      new RegExp(`\\b${charName}\\s*:`, 'i'),                    // "CharacterName:"
      new RegExp(`\\b${charName}\\b`, 'i'),                      // Just the name mentioned
      new RegExp(`\\b${charName.replace(/\s+/g, '\\s+')}\\b`, 'i'), // Handle names with spaces
    ];
    
    const isFound = patterns.some(pattern => {
      const match = pattern.test(contentLower);
      if (match) {
        console.log(`[CharacterDetection] Found character "${originalName}" using pattern:`, pattern.toString());
      }
      return match;
    });
    
    if (isFound && !detectedCharacters.includes(originalName)) {
      detectedCharacters.push(originalName);
      console.log(`[CharacterDetection] Added "${originalName}" to detected characters`);
    }
  });
  
  console.log(`[CharacterDetection] Final detected characters:`, detectedCharacters);
  return detectedCharacters;
}

/**
 * Extracts setting/location information from scene content
 */
export function extractSettingFromScene(sceneContent: string): string {
  const content = sceneContent.toLowerCase();
  
  // Look for common location indicators
  const locationPatterns = [
    /(?:in|at|inside|outside)\s+(?:the\s+)?([^.!?]+)/gi,
    /(?:cafe|coffee shop|restaurant|bar|school|office|home|house|apartment|park|street|mall|store|library|hospital|hotel|madrid|spain)/gi,
  ];
  
  for (const pattern of locationPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      return matches[0].trim();
    }
  }
  
  return '';
}

/**
 * Builds context from previous scenes in the story
 */
export function buildContextFromPreviousScenes(
  currentSceneId: string,
  allScenes: Scene[],
  connections: any[]
): string {
  // Simple implementation - just return empty for now
  // Could be enhanced to trace back through connected scenes
  return '';
}

/**
 * Generates a simple scene-based image prompt
 */
export async function generateSimpleImagePrompt(
  scene: Scene,
  detectedCharacters: string[],
  settingContext: string
): Promise<EnhancedPromptResult> {
  
  console.log(`[CharacterAnalysis] Generating simple prompt for scene:`, scene.title);
  console.log(`[CharacterAnalysis] Detected characters:`, detectedCharacters);
  
  // Create ultra-simple, objective prompt
  let prompt = "";
  
  if (detectedCharacters.length === 0) {
    // No characters - just describe the setting
    prompt = `Anime style scene in ${settingContext || 'a location'}`;
  } else if (detectedCharacters.length === 1) {
    // Single character
    prompt = `This character in ${settingContext || 'a location'}`;
  } else {
    // Multiple characters  
    prompt = `These ${detectedCharacters.length} characters in ${settingContext || 'a location'}`;
  }
  
  // Add simple action based on scene content
  const content = scene.content.toLowerCase();
  if (content.includes('smiling') || content.includes('happy')) {
    prompt += ', smiling';
  } else if (content.includes('talking') || content.includes('conversation')) {
    prompt += ', talking';
  } else if (content.includes('walking')) {
    prompt += ', walking';
  } else if (content.includes('sitting')) {
    prompt += ', sitting';
  } else if (content.includes('looking')) {
    prompt += ', looking around';
  }
  
  console.log(`[CharacterAnalysis] Generated simple prompt:`, prompt);
  
  return {
    prompt,
    charactersInScene: detectedCharacters,
    settingUsed: settingContext
  };
}

/**
 * Analyzes a scene to detect characters and extract context
 */
export function analyzeScene(
  scene: Scene,
  allScenes: Scene[],
  connections: any[],
  voiceAssignments: VoiceAssignment[]
): CharacterDetectionResult {
  
  // Detect characters in the current scene
  const detectedCharacters = detectCharactersInScene(scene.content, voiceAssignments);
  
  // Extract setting from current scene
  let settingContext = extractSettingFromScene(scene.content);
  
  // If no setting found in current scene, look at previous scenes
  if (!settingContext) {
    settingContext = buildContextFromPreviousScenes(scene.id, allScenes, connections);
  }
  
  return {
    detectedCharacters,
    settingContext
  };
}
