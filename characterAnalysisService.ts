import type { Scene, VoiceAssignment } from './types';

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
export function buildContextFromPreviousScenes(): string {
  // Simple implementation - just return empty for now
  // Could be enhanced to trace back through connected scenes
  return '';
}

/**
 * Generates a simple scene-based image prompt using the format:
 * [character(s)][setting][action][expression/mood]
 */
export async function generateSimpleImagePrompt(
  scene: Scene,
  detectedCharacters: string[],
  settingContext: string
): Promise<EnhancedPromptResult> {
  
  console.log(`[CharacterAnalysis] Generating simple prompt for scene:`, scene.title);
  console.log(`[CharacterAnalysis] Detected characters:`, detectedCharacters);
  console.log(`[CharacterAnalysis] Setting context:`, settingContext);
  
  // Extract location from setting context
  let location = "a location";
  if (settingContext) {
    const content = settingContext.toLowerCase();
    if (content.includes('madrid')) {
      location = "Madrid, Spain";
    } else if (content.includes('cafe') || content.includes('coffee')) {
      location = "a café";
    } else if (content.includes('street')) {
      location = "the street";
    } else if (content.includes('restaurant')) {
      location = "a restaurant";
    } else if (content.includes('park')) {
      location = "a park";
    } else if (content.includes('home') || content.includes('house')) {
      location = "at home";
    } else {
      // Try to extract a clean location name
      const match = content.match(/(?:in|at)\s+([^,.\n]+)/);
      if (match) {
        location = match[1].trim();
      }
    }
  }
  
  // Analyze scene content for actions and expressions
  const content = scene.content.toLowerCase();
  
  // Extract action
  let action = "standing";
  if (content.includes('talking') || content.includes('conversation') || content.includes('como estas') || content.includes('speaking')) {
    action = "talking to each other";
  } else if (content.includes('walking')) {
    action = "walking";
  } else if (content.includes('sitting')) {
    action = "sitting";
  } else if (content.includes('looking')) {
    action = "looking around";
  } else if (content.includes('met') || content.includes('meeting')) {
    action = "meeting";
  } else if (content.includes('eating') || content.includes('drinking')) {
    action = "having a meal";
  } else if (content.includes('working')) {
    action = "working";
  } else if (content.includes('reading')) {
    action = "reading";
  }
  
  // Extract expression/mood
  let mood = "neutral expression";
  if (content.includes('smiling') || content.includes('happy') || content.includes('joy') || content.includes('laugh')) {
    mood = "having a good time";
  } else if (content.includes('sad') || content.includes('crying') || content.includes('upset')) {
    mood = "looking sad";
  } else if (content.includes('angry') || content.includes('mad') || content.includes('frustrated')) {
    mood = "looking frustrated";
  } else if (content.includes('surprised') || content.includes('shocked')) {
    mood = "looking surprised";
  } else if (content.includes('worried') || content.includes('concerned')) {
    mood = "looking concerned";
  } else if (content.includes('excited') || content.includes('enthusiastic')) {
    mood = "looking excited";
  } else if (content.includes('relaxed') || content.includes('calm')) {
    mood = "looking relaxed";
  }
  
  // Build a more descriptive prompt using character names
  let characterPart = "";
  if (detectedCharacters.length === 0) {
    characterPart = `A scene shows ${location}`;
  } else if (detectedCharacters.length === 1) {
    characterPart = `${detectedCharacters[0]} is`;
  } else if (detectedCharacters.length === 2) {
    characterPart = `${detectedCharacters[0]} and ${detectedCharacters[1]} are`;
  } else {
    const allButLast = detectedCharacters.slice(0, -1).join(', ');
    const last = detectedCharacters[detectedCharacters.length - 1];
    characterPart = `${allButLast} and ${last} are`;
  }

  // Add a style prefix for consistency
  const style = "Anime style.";
  
  // Construct a more natural-sounding prompt
  const prompt = `${style} ${characterPart} ${action} in ${location}. Mood: ${mood}.`;
  
  console.log(`[CharacterAnalysis] Generated structured prompt:`, prompt);
  
  return {
    prompt,
    charactersInScene: detectedCharacters,
    settingUsed: location
  };
}

/**
 * Analyzes a scene to detect characters and extract context
 */
export function analyzeScene(
  scene: Scene,
  voiceAssignments: VoiceAssignment[]
): CharacterDetectionResult {
  
  // Detect characters in the current scene
  const detectedCharacters = detectCharactersInScene(scene.content, voiceAssignments);
  
  // Extract setting from current scene
  let settingContext = extractSettingFromScene(scene.content);
  
  // If no setting found in current scene, look at previous scenes
  if (!settingContext) {
    settingContext = buildContextFromPreviousScenes();
  }
  
  return {
    detectedCharacters,
    settingContext
  };
}
