import { Beat } from '../types';

export interface BeatSubdivisionRequest {
  sceneContent: string;
  sceneTitle: string;
  storyContext?: string;
  detectedCharacters?: string[];
}

export interface BeatSubdivisionResponse {
  success: boolean;
  beats?: Beat[];
  error?: string;
}

class BeatSubdivisionService {
  private async callOpenAI(prompt: string, apiKey: string): Promise<any> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert story analyst specializing in visual novel and interactive fiction structure. Your task is to subdivide story scenes into narrative "beats" - small, coherent segments that each deserve their own visual representation.

Guidelines for creating beats:
1. Each beat should be a complete narrative SEGMENT, not individual lines
2. A beat can contain multiple dialogue lines, narration, and actions that form one cohesive moment
3. Beats should be 2-6 sentences long typically, representing a complete scene moment
4. Each beat should have a clear visual component that can be illustrated with ONE image
5. Think of beats as "panels" in a visual novel - each needs enough content to warrant its own illustration
6. Group related dialogue and actions together in the same beat
7. Create vivid, specific image prompts that capture the essence of the entire beat segment
8. CRITICAL: Every image prompt MUST include the phrase 'no speech bubbles' to ensure clean visual novel style images

**SPEAKER ANNOTATION REQUIREMENT:**
9. IMPORTANT: You MUST annotate who speaks each part of the text using [SpeakerName] tags
10. Use [Narrator] for narrative text, action descriptions, and scene setting
11. Use [CharacterName] for dialogue and character-specific actions
12. Example format: "[Narrator]Lucy walks into the room. [Lucy]\"Hello everyone!\" [Narrator]she says with a smile."
13. This ensures proper voice assignment for audio playback in any story with any characters

Return your response as a JSON object with this structure:
{
  "beats": [
    {
      "text": "The complete text content for this beat segment with [Speaker] annotations (can include multiple sentences, dialogue lines, and narration)",
      "imagePrompt": "Detailed visual description for image generation that captures the essence of this entire beat segment"
    }
  ]
}

Note: The speaker annotations [SpeakerName] will be used for voice assignment but hidden from the user interface.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async subdivideSceneIntoBeats(
    request: BeatSubdivisionRequest,
    apiKey: string
  ): Promise<BeatSubdivisionResponse> {
    try {
      const charactersInfo = request.detectedCharacters?.length 
        ? `\nKnown characters in this story: ${request.detectedCharacters.join(', ')}`
        : '';

      const contextInfo = request.storyContext 
        ? `\nStory context: ${request.storyContext}`
        : '';

      const prompt = `Please subdivide the following scene into narrative beats suitable for a visual novel format.

Scene Title: "${request.sceneTitle}"
${contextInfo}${charactersInfo}

Scene Content:
"${request.sceneContent}"

Instructions:
- Break this scene into 3-6 beats (depending on content length and complexity)
- Each beat should be a substantial narrative segment that warrants its own illustration
- Group related dialogue, actions, and narration together in the same beat
- A beat might contain: multiple dialogue lines + narration, or a sequence of related actions
- Create detailed image prompts that capture the visual essence of the entire beat segment
- Image prompts should include: character descriptions, setting details, mood/atmosphere, and specific visual elements
- IMPORTANT: Always include 'no speech bubbles' in every image prompt
- Maintain the original story's tone and style
- Ensure beats flow naturally from one to the next
- Think "visual novel panel" - each beat should have enough content to fill one illustrated scene`;

      const response = await this.callOpenAI(prompt, apiKey);
      
      if (!response.choices || !response.choices[0]?.message?.content) {
        throw new Error('Invalid response from OpenAI API');
      }

      const content = response.choices[0].message.content.trim();
      let parsedResponse;
      
      try {
        // Try to parse the JSON response
        parsedResponse = JSON.parse(content);
      } catch (parseError) {
        // If JSON parsing fails, try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse AI response as JSON');
        }
      }

      if (!parsedResponse.beats || !Array.isArray(parsedResponse.beats)) {
        throw new Error('AI response does not contain valid beats array');
      }

      // Convert the AI response to our Beat interface
      const beats: Beat[] = parsedResponse.beats.map((beat: any, index: number) => ({
        id: `beat_${Date.now()}_${index}`,
        text: beat.text || '',
        imagePrompt: beat.imagePrompt || '',
        speaker: undefined, // Beats can contain multiple speakers, so we don't specify one
        order: index,
        imageId: undefined // Will be populated when images are generated
      }));

      return {
        success: true,
        beats
      };

    } catch (error) {
      console.error('Error subdividing scene into beats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

export const beatSubdivisionService = new BeatSubdivisionService();
