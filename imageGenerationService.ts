// Image generation service using OpenAI Images API

import { getImageFromStorage } from './fileStorageService';

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

/**
 * Generates an image using OpenAI's Images API (GPT Image 1)
 */
export async function generateSceneImage(
  prompt: string,
  openaiApiKey: string,
  size: '1024x1024' | '1536x1024' | '1024x1536' = '1024x1536',
  quality: 'low' | 'medium' | 'high' | 'auto' = 'medium'
): Promise<ImageGenerationResult> {
  try {
    console.log('[ImageGeneration] Generating image with prompt:', prompt);
    
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-image-1', // Using GPT Image 1 model
        prompt: prompt,
        n: 1,
        size: size,
        quality: quality
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[ImageGeneration] API Error:', response.status, errorData);
      return {
        success: false,
        error: `API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      };
    }

    const data = await response.json();
    
    // Log response structure without the full base64 to avoid overwhelming the console
    const logData = JSON.parse(JSON.stringify(data)); // Deep copy
    if (logData.data && logData.data[0] && logData.data[0].b64_json) {
      const originalLength = logData.data[0].b64_json.length;
      logData.data[0].b64_json = `[BASE64 DATA - ${originalLength} characters]`;
    }
    console.log('[ImageGeneration] API response:', JSON.stringify(logData, null, 2));
    
    if (data.data && data.data.length > 0) {
      const imageData = data.data[0];
      
      if (imageData.url) {
        // Handle URL response
        const imageUrl = imageData.url;
        console.log('[ImageGeneration] Successfully generated image URL:', imageUrl);
        
        return {
          success: true,
          imageUrl: imageUrl
        };
      } else if (imageData.b64_json) {
        // Handle base64 response (default for GPT Image 1)
        const base64Image = imageData.b64_json;
        const dataUrl = `data:image/png;base64,${base64Image}`;
        console.log('[ImageGeneration] Successfully generated image as base64 (length:', base64Image.length, 'characters)');
        
        return {
          success: true,
          imageUrl: dataUrl
        };
      } else {
        console.error('[ImageGeneration] No image URL or base64 data in response:', imageData);
        return {
          success: false,
          error: 'No image data received from API'
        };
      }
    } else {
      console.error('[ImageGeneration] No image data in response:', data);
      console.error('[ImageGeneration] Response structure check:');
      console.error('- data exists:', !!data.data);
      console.error('- data.length:', data.data?.length);
      return {
        success: false,
        error: 'No image data received from API'
      };
    }
  } catch (error) {
    console.error('[ImageGeneration] Error generating image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Downloads an image from URL and converts it to base64 data URL for storage
 */
export async function downloadImageAsDataUrl(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to convert image to data URL'));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[ImageGeneration] Error downloading image:', error);
    return null;
  }
}

/**
 * Generates an image using OpenAI's Images API with character reference images
 */
export async function generateSceneImageWithReference(
  prompt: string,
  characterImages: string[], // Array of base64 image data URLs
  openaiApiKey: string,
  size: '1024x1024' | '1536x1024' | '1024x1536' = '1024x1536',
  quality: 'low' | 'medium' | 'high' | 'auto' = 'medium'
): Promise<ImageGenerationResult> {
  try {
    console.log('[ImageGeneration] Generating image with reference images');
    console.log('[ImageGeneration] Prompt:', prompt);
    console.log('[ImageGeneration] Number of reference images:', characterImages.length);
    console.log('[ImageGeneration] Using size:', size, 'quality:', quality);
    
    // For now, use the existing text-based generation
    // TODO: Implement proper reference image support when available
    return await generateSceneImage(prompt, openaiApiKey, size, quality);
    
  } catch (error) {
    console.error('[ImageGeneration] Error generating image with reference:', error);
    return {
      success: false,
      error: `Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Generates an image with character reference images using GPT Image 1 Edit API
 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function generateSceneImageWithCharacterReferences(
  prompt: string,
  characterNames: string[],
  voiceAssignments: any[],
  openaiApiKey: string,
  size: '1024x1024' | '1536x1024' | '1024x1536' = '1024x1536',
  quality: 'low' | 'medium' | 'high' | 'auto' = 'medium'
): Promise<ImageGenerationResult> {
  try {
    console.log('[ImageGeneration] Attempting to generate image with character references using GPT Image 1.');
    console.log('[ImageGeneration] Prompt:', prompt);
    console.log('[ImageGeneration] Characters in scene:', characterNames);

    // Collect all available character reference images
    const referenceImages: Blob[] = [];
    const availableCharacters: string[] = [];
    
    console.log(`[ImageGeneration] DEBUG - Character analysis:`);
    console.log(`[ImageGeneration] DEBUG - Characters in scene:`, characterNames);
    console.log(`[ImageGeneration] DEBUG - Voice assignments:`, voiceAssignments.map(va => ({
      name: va.characterName,
      hasImageId: !!va.imageId,
      imageId: va.imageId
    })));
    
    for (const charName of characterNames) {
      const assignment = voiceAssignments.find(va => va.characterName === charName);
      console.log(`[ImageGeneration] DEBUG - Processing character: ${charName}`);
      console.log(`[ImageGeneration] DEBUG - Assignment found:`, !!assignment);
      console.log(`[ImageGeneration] DEBUG - Has imageId:`, !!assignment?.imageId);
      
      if (assignment?.imageId) {
        try {
          console.log(`[ImageGeneration] DEBUG - Attempting to load image for ${charName} with ID: ${assignment.imageId}`);
          const referenceImageDataUrl = await getImageFromStorage(assignment.imageId);
          if (referenceImageDataUrl) {
            const imageBlob = await dataUrlToBlob(referenceImageDataUrl);
            referenceImages.push(imageBlob);
            availableCharacters.push(charName);
            console.log(`[ImageGeneration] ✅ Successfully loaded reference image for ${charName} (size: ${imageBlob.size} bytes)`);
          } else {
            console.warn(`[ImageGeneration] ❌ No reference image data found in storage for ${charName} with ID: ${assignment.imageId}`);
          }
        } catch (error) {
          console.error(`[ImageGeneration] ❌ Failed to load image for ${charName}:`, error);
        }
      } else {
        console.log(`[ImageGeneration] ⚠️ No image assignment found for character: ${charName}`);
      }
    }

    let response;
    let apiEndpointType = '';

    if (referenceImages.length > 0) {
      // Use the GPT Image 1 Edit API with multiple reference images.
      apiEndpointType = 'GPT Image 1 Edit API with multiple images (/v1/images/edits)';
      console.log(`[ImageGeneration] ✅ Using ${apiEndpointType} with ${referenceImages.length} reference image(s) for characters: ${availableCharacters.join(', ')}`);
      
      // Enhance the prompt with character reference information
      const enhancedPrompt = `${prompt}\n\nIMPORTANT: Use the provided reference images to maintain character consistency. The characters ${availableCharacters.join(', ')} should match their reference images exactly, especially hair color, facial features, and clothing style.`;
      
      // Create FormData with all reference images and parameters
      const formData = new FormData();
      
      // Add all reference images to the FormData
      // For the edit endpoint, we provide multiple images in the 'image' array
      referenceImages.forEach((imageBlob, index) => {
        const imageFile = new File([imageBlob], `reference_${index}.png`, { type: 'image/png' });
        formData.append('image[]', imageFile);
        console.log(`[ImageGeneration] DEBUG - Added reference image ${index + 1}/${referenceImages.length} for ${availableCharacters[index]} (${imageBlob.size} bytes)`);
      });
      
      // Add other parameters
      formData.append('model', 'gpt-image-1');
      formData.append('prompt', enhancedPrompt);
      formData.append('size', size);
      formData.append('quality', quality);
      formData.append('n', '1');
      
      console.log(`[ImageGeneration] DEBUG - Enhanced prompt:`, enhancedPrompt);
      console.log(`[ImageGeneration] Sending request to OpenAI with ${referenceImages.length} images`);
      
      // Call OpenAI API directly
      response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: formData
      });

    } else {
      // Fallback to the Generations API if no reference images are available.
      apiEndpointType = 'DALL-E 3 Generations API (/v1/images/generations)';
      console.warn(`[ImageGeneration] ⚠️ No reference images available, falling back to ${apiEndpointType}`);
      
      const characterDescriptions = characterNames.map(name => {
        return `${name} (maintain consistent appearance from previous scenes)`;
      }).join(', ');

      const enhancedPrompt = characterNames.length > 0
        ? `${prompt}\n\nCharacters in scene: ${characterDescriptions}. IMPORTANT: Maintain consistent character appearance throughout the story.`
        : prompt;

      console.log(`[ImageGeneration] DEBUG - Enhanced fallback prompt:`, enhancedPrompt);

      return await generateSceneImage(enhancedPrompt, openaiApiKey, size, quality);
    }

    // --- Common Response Handling ---

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ImageGeneration] ${apiEndpointType} Error ${response.status}:`, errorText);
      let errorMessage = `API Error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage += ` - ${errorJson.error?.message || 'Unknown error'}`;
      } catch (e) {
        errorMessage += ` - ${errorText}`;
      }
      return { success: false, error: errorMessage };
    }

    const data = await response.json();
    
    const logData = JSON.parse(JSON.stringify(data));
    if (logData.data && logData.data[0] && logData.data[0].b64_json) {
      logData.data[0].b64_json = `[BASE64 DATA - OMITTED]`;
    }
    console.log(`[ImageGeneration] ${apiEndpointType} response:`, JSON.stringify(logData, null, 2));
    
    if (data.data && data.data.length > 0) {
      const imageData = data.data[0];
      const dataUrl = `data:image/png;base64,${imageData.b64_json}`;
      console.log('[ImageGeneration] Successfully generated image from edit.');
      return { success: true, imageUrl: dataUrl };
    } else {
      console.error('[ImageGeneration] No image data in response:', data);
      return { success: false, error: 'No image data received from API' };
    }
    
  } catch (error) {
    console.error('[ImageGeneration] Error generating image with reference:', error);
    return {
      success: false,
      error: `Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
