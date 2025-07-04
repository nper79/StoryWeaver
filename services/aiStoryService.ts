interface AIStoryResponse {
  content: string;
  choices?: string[];
}

interface AIGenerationOptions {
  storyContext: string;
  currentScene: string;
  numberOfChoices?: number;
}

export class AIStoryService {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1/chat/completions';

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!this.apiKey) {
      throw new Error('OpenAI API key not found in environment variables');
    }
  }

  async generateStoryContinuation(options: AIGenerationOptions): Promise<AIStoryResponse> {
    const { storyContext, currentScene, numberOfChoices = 0 } = options;

    let prompt = this.buildPrompt(storyContext, currentScene, numberOfChoices);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a creative writing assistant specializing in interactive stories for English language learning. 

CRITICAL RULES:
- ONLY use information that already exists in the story context provided
- DO NOT invent new details, objects, or events not mentioned in the story
- DO NOT add new characters or locations not already established
- Stay strictly within the established narrative facts
- Continue the story logically from exactly where it left off
- Use clear, accessible language for English learners`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 800,
          temperature: 0.3,
          top_p: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from OpenAI API');
      }

      return this.parseAIResponse(content, numberOfChoices);
    } catch (error) {
      console.error('[AIStoryService] Error generating story:', error);
      throw error;
    }
  }

  private buildPrompt(storyContext: string, currentScene: string, numberOfChoices: number): string {
    const basePrompt = `
STORY CONTEXT (everything that has happened so far):
${storyContext}

CURRENT SCENE (where the story is now):
${currentScene}

TASK: Continue this interactive story for English language learners. 

STRICT REQUIREMENTS:
- Base your continuation ONLY on the facts and details already established in the story context above
- DO NOT introduce new characters, objects, or locations not already mentioned
- DO NOT contradict any existing story details
- Continue logically from the current scene using only established elements
- Use clear, accessible language appropriate for intermediate English learners
- Keep the same tone and style as the existing story

`;

    if (numberOfChoices === 0) {
      return basePrompt + `
Please write a single story continuation (2-3 sentences) that naturally follows from the current scene. Focus on advancing the plot while maintaining the established tone and setting.

Format your response as plain text with no special formatting.`;
    } else {
      return basePrompt + `
Please write:
1. A story continuation (2-3 sentences) that sets up a decision point
2. ${numberOfChoices} distinct choice options for what the protagonist could do next

Each choice should:
- Be clearly different from the others
- Lead to interesting story developments
- Use vocabulary appropriate for English learners
- Be 1-2 sentences long

Format your response as:
CONTINUATION: [your story continuation]

CHOICE 1: [first choice]
CHOICE 2: [second choice]${numberOfChoices === 3 ? '\nCHOICE 3: [third choice]' : ''}`;
    }
  }

  private parseAIResponse(content: string, numberOfChoices: number): AIStoryResponse {
    if (numberOfChoices === 0) {
      return { content: content.trim() };
    }

    // Parse the structured response
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let continuation = '';
    const choices: string[] = [];

    for (const line of lines) {
      if (line.startsWith('CONTINUATION:')) {
        continuation = line.replace('CONTINUATION:', '').trim();
      } else if (line.startsWith('CHOICE 1:')) {
        choices[0] = line.replace('CHOICE 1:', '').trim();
      } else if (line.startsWith('CHOICE 2:')) {
        choices[1] = line.replace('CHOICE 2:', '').trim();
      } else if (line.startsWith('CHOICE 3:')) {
        choices[2] = line.replace('CHOICE 3:', '').trim();
      }
    }

    // Fallback parsing if the structured format wasn't followed
    if (!continuation && choices.length === 0) {
      const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
      if (paragraphs.length > 0) {
        continuation = paragraphs[0].trim();
        // Try to extract choices from remaining paragraphs
        for (let i = 1; i < Math.min(paragraphs.length, numberOfChoices + 1); i++) {
          choices.push(paragraphs[i].trim());
        }
      }
    }

    return {
      content: continuation || 'The story continues...',
      choices: choices.slice(0, numberOfChoices)
    };
  }
}

export const aiStoryService = new AIStoryService();
