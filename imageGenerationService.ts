// Image generation service using OpenAI Images API

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
  size: '1024x1024' | '1536x1024' | '1024x1536' = '1024x1024',
  quality: 'low' | 'medium' | 'high' | 'auto' = 'auto'
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
