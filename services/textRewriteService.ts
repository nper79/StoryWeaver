import { aiStoryService } from './aiStoryService';

export type LanguageLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

interface RewriteResult {
  success: boolean;
  rewrittenText?: string;
  error?: string;
}

/**
 * Service for rewriting scene text at different language complexity levels
 */
class TextRewriteService {
  private levelDescriptions: Record<LanguageLevel, string> = {
    'A1': 'Beginner level - Use only very simple words and short sentences. Present tense only.',
    'A2': 'Elementary level - Use simple vocabulary and basic sentence structures. Simple past and present tenses.',
    'B1': 'Intermediate level - Use everyday vocabulary and clear sentence structures. Mix of tenses as appropriate.',
    'B2': 'Upper-intermediate level - Use varied vocabulary and more complex sentences. Natural flow with appropriate tenses.',
    'C1': 'Advanced level - Use sophisticated vocabulary and complex sentence structures. Rich, nuanced language.',
    'C2': 'Mastery level - Use highly sophisticated language with literary quality. Complex ideas and subtle nuances.'
  };

  /**
   * Rewrite scene text at the specified language level
   */
  async rewriteSceneText(
    currentText: string,
    level: LanguageLevel,
    storyContext: string,
    openaiApiKey: string
  ): Promise<RewriteResult> {
    try {
      console.log(`[TextRewrite] Rewriting text at level ${level}`);
      
      const prompt = this.buildRewritePrompt(currentText, level, storyContext);
      
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
              content: 'You are a skilled writer who can adapt text to different language complexity levels while maintaining the story and emotional content.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[TextRewrite] API Error:', response.status, errorData);
        return {
          success: false,
          error: `API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
        };
      }

      const data = await response.json();
      const rewrittenText = data.choices[0]?.message?.content?.trim();

      if (!rewrittenText) {
        return {
          success: false,
          error: 'No rewritten text received from API'
        };
      }

      console.log(`[TextRewrite] Successfully rewrote text at level ${level}`);
      return {
        success: true,
        rewrittenText
      };

    } catch (error) {
      console.error('[TextRewrite] Error rewriting text:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private buildRewritePrompt(currentText: string, level: LanguageLevel, storyContext: string): string {
    return `
STORY CONTEXT:
${storyContext}

CURRENT SCENE TEXT TO REWRITE:
${currentText}

TASK:
Rewrite the above scene text at ${level} level (${this.levelDescriptions[level]}).

IMPORTANT REQUIREMENTS:
1. Maintain all story facts, characters, and plot points
2. Keep the same narrative perspective
3. Preserve the emotional tone and atmosphere
4. Adjust only the language complexity, vocabulary, and sentence structure
5. The rewritten text should feel natural at the ${level} level
6. If the original is very short, you may expand it slightly to better convey the scene
7. Do not add new plot elements or change the story

Please provide only the rewritten text, without any explanations or metadata.`;
  }
}

export const textRewriteService = new TextRewriteService();
