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
  const characterNames = availableCharacters.map(char => char.characterName.toLowerCase());
  const detectedCharacters: string[] = [];
  
  // Convert content to lowercase for case-insensitive matching
  const contentLower = sceneContent.toLowerCase();
  
  console.log(`[CharacterDetection] Analyzing scene content:`, sceneContent.substring(0, 200) + '...');
  console.log(`[CharacterDetection] Available characters:`, availableCharacters.map(c => c.characterName));
  
  // Always check for narrator first - if there's content that looks like narration
  const narratorExists = availableCharacters.some(char => 
    char.characterName.toLowerCase() === 'narrator'
  );
  
  if (narratorExists) {
    // Check if content contains narrator dialogue or narration patterns
    const narratorPatterns = [
      /narrator\s*:/i,                    // Direct "Narrator:" dialogue
      /^[^:]*[.!?]\s*$/m,                // Sentences without character dialogue (likely narration)
      /\b(she|he|they|it)\s+(said|went|walked|looked|saw|felt|thought)/i, // Third person narration
      /\b(the|a|an)\s+\w+\s+(was|were|is|are)/i, // Descriptive narration
    ];
    
    const hasNarration = narratorPatterns.some(pattern => {
      const match = pattern.test(sceneContent);
      if (match) {
        console.log(`[CharacterDetection] Found narrator pattern:`, pattern.toString());
      }
      return match;
    });
    
    if (hasNarration) {
      detectedCharacters.push('Narrator');
      console.log(`[CharacterDetection] Added Narrator to detected characters`);
    }
  }
  
  // Look for other character names in the content
  characterNames.forEach((charName, index) => {
    const originalName = availableCharacters[index].characterName;
    
    // Skip narrator as we handled it above
    if (originalName.toLowerCase() === 'narrator') {
      return;
    }
    
    // Check if character name appears in content
    // Look for patterns like "CharacterName:" (dialogue) or just the name mentioned
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
 * Extracts setting/location context from scene content
 */
export function extractSettingFromScene(sceneContent: string): string {
  // Look for location indicators
  const locationPatterns = [
    /(?:at|in|inside|outside|near|by)\s+(?:the\s+)?([^.!?]+)/gi,
    /(?:setting|location|place):\s*([^.!?]+)/gi,
    /(?:they|he|she|it)\s+(?:went|walked|moved|traveled)\s+(?:to|into|towards)\s+([^.!?]+)/gi,
  ];
  
  const settings: string[] = [];
  
  locationPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(sceneContent)) !== null) {
      const setting = match[1]?.trim();
      if (setting && setting.length > 2 && setting.length < 100) {
        settings.push(setting);
      }
    }
  });
  
  // Also look for narrator descriptions that might contain setting info
  const narratorPattern = /narrator:\s*([^.!?]*(?:at|in|inside|outside|near|by)[^.!?]*)/gi;
  let narratorMatch;
  while ((narratorMatch = narratorPattern.exec(sceneContent)) !== null) {
    const narratorText = narratorMatch[1]?.trim();
    if (narratorText) {
      settings.push(narratorText);
    }
  }
  
  // Return the most descriptive setting found, or empty string
  return settings.length > 0 ? settings[0] : '';
}

/**
 * Analyzes previous scenes to build context for the current scene
 */
export function buildContextFromPreviousScenes(
  currentSceneId: string,
  allScenes: Scene[],
  connections: any[]
): string {
  // Find scenes that lead to the current scene
  const incomingConnections = connections.filter(conn => conn.toSceneId === currentSceneId);
  
  if (incomingConnections.length === 0) {
    return '';
  }
  
  // Get the most recent previous scene(s)
  const previousSceneIds = incomingConnections.map(conn => conn.fromSceneId);
  const previousScenes = allScenes.filter(scene => previousSceneIds.includes(scene.id));
  
  // Extract setting context from previous scenes
  const contextParts: string[] = [];
  
  previousScenes.forEach(scene => {
    if (scene.settingContext) {
      contextParts.push(scene.settingContext);
    } else {
      const extractedSetting = extractSettingFromScene(scene.content);
      if (extractedSetting) {
        contextParts.push(extractedSetting);
      }
    }
  });
  
  // Return the most recent context, or combine if multiple
  if (contextParts.length === 1) {
    return contextParts[0];
  } else if (contextParts.length > 1) {
    // Take the most recent one, but could be enhanced to merge contexts
    return contextParts[contextParts.length - 1];
  }
  
  return '';
}

/**
 * Gets character physical descriptions for prompt generation using OpenAI Vision API
 */
export async function getCharacterDescriptions(
  characterNames: string[],
  voiceAssignments: VoiceAssignment[],
  openaiApiKey: string
): Promise<Record<string, string>> {
  const descriptions: Record<string, string> = {};
  
  console.log(`[CharacterAnalysis] Getting descriptions for characters:`, characterNames);
  console.log(`[CharacterAnalysis] Available voice assignments:`, voiceAssignments.map(va => ({ name: va.characterName, hasImage: !!va.imageId })));
  
  for (const charName of characterNames) {
    const assignment = voiceAssignments.find(va => va.characterName === charName);
    console.log(`[CharacterAnalysis] Processing character "${charName}", found assignment:`, !!assignment, assignment?.imageId ? 'with image' : 'no image');
    
    if (assignment?.imageId) {
      try {
        console.log(`[CharacterAnalysis] Loading image for ${charName} from storage...`);
        
        // Load image from IndexedDB storage
        const imageUrl = await getImageFromStorage(assignment.imageId);
        
        if (!imageUrl) {
          console.warn(`[CharacterAnalysis] No image found in storage for ${charName} with imageId: ${assignment.imageId}`);
          descriptions[charName] = `${charName} (no visual description available)`;
          continue;
        }
        
        console.log(`[CharacterAnalysis] Analyzing image for ${charName} using OpenAI Vision API...`);
        
        // Use OpenAI Vision API to analyze the character image
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini', // Use the vision-capable model
            messages: [
              {
                role: 'system',
                content: 'You are an expert at describing character appearances for image generation. Provide a detailed but concise physical description focusing on: hair color/style, facial features, age appearance, clothing, and any distinctive characteristics. Keep it under 50 words and suitable for image generation prompts.'
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Describe this character's physical appearance for an image generation prompt:`
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageUrl
                    }
                  }
                ]
              }
            ],
            max_tokens: 150
          })
        });

        if (response.ok) {
          const data = await response.json();
          const description = data.choices?.[0]?.message?.content?.trim();
          if (description) {
            descriptions[charName] = description;
            console.log(`[CharacterAnalysis] Generated description for ${charName}: ${description}`);
          } else {
            descriptions[charName] = `character with the appearance shown in their reference image`;
            console.log(`[CharacterAnalysis] No description returned for ${charName}, using fallback`);
          }
        } else {
          const errorText = await response.text();
          console.warn(`[CharacterAnalysis] Failed to analyze image for ${charName}:`, response.status, errorText);
          descriptions[charName] = `character with the appearance shown in their reference image`;
        }
      } catch (error) {
        console.error(`[CharacterAnalysis] Error analyzing image for ${charName}:`, error);
        descriptions[charName] = `character with the appearance shown in their reference image`;
      }
    } else {
      // Fallback description for characters without images
      descriptions[charName] = `character named ${charName}`;
      console.log(`[CharacterAnalysis] No image found for ${charName}, using name fallback`);
    }
  }
  
  console.log(`[CharacterAnalysis] Final descriptions:`, descriptions);
  return descriptions;
}

/**
 * Generates an enhanced image prompt using character descriptions and context
 */
export async function generateEnhancedImagePrompt(
  scene: Scene,
  detectedCharacters: string[],
  settingContext: string,
  voiceAssignments: VoiceAssignment[],
  openaiApiKey: string
): Promise<EnhancedPromptResult> {
  
  console.log(`[CharacterAnalysis] Getting character descriptions for detected characters:`, detectedCharacters);
  const characterDescriptions = await getCharacterDescriptions(detectedCharacters, voiceAssignments, openaiApiKey);
  
  // Build context prompt with character descriptions and scene content
  let contextPrompt = `Scene Content: ${scene.content}\n\n`;
  
  // Add specific instructions for narrator content
  const hasNarrator = detectedCharacters.some(char => char.toLowerCase() === 'narrator');
  if (hasNarrator) {
    contextPrompt += `Note: This scene contains narrator content. When the narrator speaks or describes the scene, focus on the visual elements, setting, and atmosphere they describe. The narrator provides the scene description and context.\n\n`;
  }
  
  if (Object.keys(characterDescriptions).length > 0) {
    contextPrompt += `Character Descriptions (use these EXACT physical descriptions when these characters appear in the scene):\n`;
    for (const [charName, description] of Object.entries(characterDescriptions)) {
      if (charName.toLowerCase() === 'narrator') {
        contextPrompt += `- ${charName}: Use narrator content to describe the scene, setting, mood, and atmosphere\n`;
      } else {
        contextPrompt += `- ${charName}: ${description}\n`;
      }
    }
    contextPrompt += '\n';
  }
  
  if (settingContext) {
    contextPrompt += `Setting/Location Context: ${settingContext}\n\n`;
  }
  
  console.log(`[CharacterAnalysis] Context prompt being sent to OpenAI:`, contextPrompt);
  
  contextPrompt += `IMPORTANT: Create a detailed image generation prompt that:
1. Uses the physical descriptions provided for characters when they appear in the scene
2. When narrator content is present, focuses on the visual scene, setting, and atmosphere described
3. Incorporates the setting/location context when provided  
4. Creates vivid visual descriptions suitable for anime-style image generation
5. If multiple characters are present, show them interacting or positioned naturally in the scene
6. MUST include "in anime style" - this is mandatory for all generated images
7. Focus on visual elements that would make an engaging anime scene

The prompt should be 2-4 sentences and highly detailed for best results with image generation models in anime style.`;
  
  try {
    console.log(`[CharacterAnalysis] Sending context prompt to OpenAI for enhanced prompt generation...`);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert at creating detailed image generation prompts for interactive stories. Create a vivid, descriptive prompt that:

1. Uses the physical descriptions provided for characters when they appear in the scene
2. When narrator content is present, focuses on the visual scene, setting, and atmosphere described
3. Incorporates the setting/location context when provided  
4. Creates vivid visual descriptions suitable for anime-style image generation
5. If multiple characters are present, show them interacting or positioned naturally in the scene
6. MUST include "in anime style" - this is mandatory for all generated images
7. Focus on visual elements that would make an engaging anime scene

The prompt should be 2-4 sentences and highly detailed for best results with image generation models in anime style.`
          },
          {
            role: 'user',
            content: contextPrompt
          }
        ],
        max_tokens: 400
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    const prompt = data.choices[0]?.message?.content?.trim() || '';
    
    console.log(`[CharacterAnalysis] Received enhanced prompt from OpenAI:`, prompt);
    
    return {
      prompt,
      charactersInScene: detectedCharacters,
      settingUsed: settingContext
    };
    
  } catch (error) {
    console.error('Error generating enhanced prompt:', error);
    throw error;
  }
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
