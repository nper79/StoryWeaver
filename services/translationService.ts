import type { Translation, Scene, Beat, Connection, ConnectionTranslation } from '../types';

export interface TranslationRequest {
  sceneId: string;
  title: string;
  content: string;
  beats?: Beat[];
  targetLanguage: string;
}

export interface TranslationResponse {
  translation: Translation;
  success: boolean;
  error?: string;
}

export interface BatchTranslationRequest {
  scenes: Scene[];
  connections: Connection[];
  targetLanguages: string[];
  apiKey?: string;
}

export interface BatchTranslationProgress {
  currentScene: number;
  totalScenes: number;
  currentLanguage: string;
  completed: Translation[];
  errors: string[];
}

export interface BatchTranslationResult {
  translations: Translation[];
  connectionTranslations: ConnectionTranslation[];
}

export class TranslationService {
  private static readonly SUPPORTED_LANGUAGES = {
    'en': 'English',
    'es': 'Spanish',
    'pt': 'Portuguese',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese'
  };

  static getSupportedLanguages(): Record<string, string> {
    return this.SUPPORTED_LANGUAGES;
  }

  static getLanguageName(code: string): string {
    return this.SUPPORTED_LANGUAGES[code as keyof typeof this.SUPPORTED_LANGUAGES] || code;
  }

  static async translateScene(request: TranslationRequest): Promise<TranslationResponse> {
    try {
      // For now, we'll create a manual translation structure
      // In the future, this could integrate with Google Translate API or similar
      const translation: Translation = {
        id: `translation_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        language: request.targetLanguage,
        sceneId: request.sceneId,
        title: `[${request.targetLanguage.toUpperCase()}] ${request.title}`,
        content: `[${request.targetLanguage.toUpperCase()}] ${request.content}`,
        beats: request.beats?.map(beat => ({
          id: beat.id,
          text: `[${request.targetLanguage.toUpperCase()}] ${beat.text}`,
          imagePrompt: beat.imagePrompt
        })),
        createdAt: new Date().toISOString(),
        version: 1
      };

      return {
        translation,
        success: true
      };
    } catch (error) {
      return {
        translation: {} as Translation,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  static async translateWithAI(request: TranslationRequest, apiKey?: string): Promise<TranslationResponse> {
    if (!apiKey) {
      return {
        translation: {} as Translation,
        success: false,
        error: 'OpenAI API key is required for AI translation'
      };
    }

    try {
      const targetLanguageName = this.getLanguageName(request.targetLanguage);
      
      // Translate title
      const translatedTitle = await this.translateTextWithOpenAI(
        request.title,
        targetLanguageName,
        apiKey,
        'title'
      );
      
      // Translate content
      const translatedContent = await this.translateTextWithOpenAI(
        request.content,
        targetLanguageName,
        apiKey,
        'content'
      );
      
      // Translate beats if present
      let translatedBeats: Beat[] | undefined;
      if (request.beats && request.beats.length > 0) {
        translatedBeats = await this.translateBeats(request.beats, targetLanguageName, apiKey);
      }
      
      const translation: Translation = {
        id: `ai_translation_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        language: request.targetLanguage,
        sceneId: request.sceneId,
        title: translatedTitle,
        content: translatedContent,
        beats: translatedBeats,
        createdAt: new Date().toISOString(),
        version: 1
      };
      
      return {
        translation,
        success: true
      };
    } catch (error) {
      return {
        translation: {} as Translation,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during AI translation'
      };
    }
  }

  static validateTranslation(translation: Translation): boolean {
    return !!(
      translation.id &&
      translation.language &&
      translation.sceneId &&
      translation.title &&
      translation.content
    );
  }

  static exportTranslations(translations: Translation[]): string {
    return JSON.stringify(translations, null, 2);
  }

  // Connection translation methods
  static async translateConnection(connection: Connection, targetLanguage: string, apiKey?: string): Promise<ConnectionTranslation | null> {
    if (!apiKey) {
      return null;
    }

    try {
      const targetLanguageName = this.getLanguageName(targetLanguage);
      const translatedLabel = await this.translateTextWithOpenAI(
        connection.label,
        targetLanguageName,
        apiKey,
        'title' // Use title mode for short labels
      );

      return {
        id: `conn_translation_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        language: targetLanguage,
        connectionId: connection.id,
        label: translatedLabel
      };
    } catch (error) {
      console.error('Connection translation error:', error);
      return null;
    }
  }

  private static prepareContentForTranslation(content: string): string {
    // Preserve speaker tags and formatting
    return content;
  }

  private static async translateTextWithOpenAI(
    text: string,
    targetLanguageName: string,
    apiKey: string,
    type: 'title' | 'content'
  ): Promise<string> {
    const prompt = type === 'title'
      ? `Translate this title to ${targetLanguageName}: "${text}"`
      : `Translate to ${targetLanguageName}, preserve speaker tags: ${text}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  }

  private static async translateBeats(beats: Beat[], targetLanguageName: string, apiKey: string): Promise<Beat[]> {
    const translatedBeats: Beat[] = [];
    for (const beat of beats) {
      const translatedText = await this.translateTextWithOpenAI(beat.text, targetLanguageName, apiKey, 'content');
      translatedBeats.push({ ...beat, text: translatedText });
    }
    return translatedBeats;
  }

  static async batchTranslateStory(
    request: BatchTranslationRequest,
    onProgress?: (progress: BatchTranslationProgress) => void
  ): Promise<BatchTranslationResult> {
    console.log('🔍 TranslationService.batchTranslateStory - Starting...');
    console.log('- Scenes count:', request.scenes.length);
    console.log('- Connections count:', request.connections.length);
    console.log('- Target languages:', request.targetLanguages);
    console.log('- API key present:', !!request.apiKey);
    
    const completed: Translation[] = [];
    const connectionTranslations: ConnectionTranslation[] = [];
    const errors: string[] = [];
    const totalScenes = request.scenes.length;
    
    // Translate scenes
    for (let sceneIndex = 0; sceneIndex < request.scenes.length; sceneIndex++) {
      const scene = request.scenes[sceneIndex];
      
      for (const targetLanguage of request.targetLanguages) {
        try {
          console.log(`🔄 Translating scene ${sceneIndex + 1}/${totalScenes} to ${targetLanguage}`);
          console.log('- Scene ID:', scene.id);
          console.log('- Scene title:', scene.title);
          console.log('- Scene content length:', scene.content?.length || 0);
          
          // Report progress
          if (onProgress) {
            onProgress({
              currentScene: sceneIndex + 1,
              totalScenes,
              currentLanguage: this.getLanguageName(targetLanguage),
              completed: [...completed],
              errors: [...errors]
            });
          }
          
          const translationRequest: TranslationRequest = {
            sceneId: scene.id,
            title: scene.title,
            content: this.prepareContentForTranslation(scene.content),
            beats: scene.beats,
            targetLanguage
          };
          
          console.log('📝 Translation request:', translationRequest);
          
          const response = request.apiKey 
            ? await this.translateWithAI(translationRequest, request.apiKey)
            : await this.translateScene(translationRequest);
          
          console.log('📝 Translation response:', response);
          
          if (response.success) {
            completed.push(response.translation);
            console.log('✅ Translation successful for scene:', scene.id);
          } else {
            const errorMsg = `Failed to translate scene "${scene.title}" to ${this.getLanguageName(targetLanguage)}: ${response.error}`;
            errors.push(errorMsg);
            console.error('❌ Translation failed:', errorMsg);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          const errorMessage = `Error translating scene "${scene.title}" to ${this.getLanguageName(targetLanguage)}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMessage);
        }
      }
    }
    
    // Translate connections
    for (const connection of request.connections) {
      for (const targetLanguage of request.targetLanguages) {
        try {
          const connectionTranslation = await this.translateConnection(connection, targetLanguage, request.apiKey);
          if (connectionTranslation) {
            connectionTranslations.push(connectionTranslation);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          errors.push(`Error translating connection "${connection.label}" to ${this.getLanguageName(targetLanguage)}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    
    // Final progress report
    if (onProgress) {
      onProgress({
        currentScene: totalScenes,
        totalScenes,
        currentLanguage: 'Completed',
        completed,
        errors
      });
    }
    
    return {
      translations: completed,
      connectionTranslations
    };
  }

  static importTranslations(jsonString: string): Translation[] {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) {
        return parsed.filter(t => this.validateTranslation(t));
      }
      return [];
    } catch {
      return [];
    }
  }
}
