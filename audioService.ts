// Simple audio service for ElevenLabs TTS
// Clean implementation starting from scratch

export interface AudioGenerationOptions {
  text: string;
  voiceId: string;
  apiKey: string;
}

export class AudioService {
  private static readonly BASE_URL = 'https://api.elevenlabs.io/v1';
  
  /**
   * Generate audio using ElevenLabs TTS API
   */
  static async generateSpeech(options: AudioGenerationOptions): Promise<Blob> {
    const { text, voiceId, apiKey } = options;
    
    if (!text || !voiceId || !apiKey) {
      throw new Error('Missing required parameters: text, voiceId, or apiKey');
    }

    console.log('🎵 Generating audio:', { 
      textLength: text.length, 
      voiceId, 
      apiKeyPrefix: apiKey.substring(0, 8) + '...' 
    });

    const url = `${this.BASE_URL}/text-to-speech/${voiceId}`;
    
    const requestBody = {
      text: text.trim(),
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    };

    console.log('📤 Request URL:', url);
    console.log('📤 Request body:', requestBody);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const audioBlob = await response.blob();
      console.log('✅ Audio generated successfully, size:', audioBlob.size, 'bytes');
      
      return audioBlob;
      
    } catch (error) {
      console.error('❌ Audio generation failed:', error);
      throw error;
    }
  }

  /**
   * Get available voices from ElevenLabs
   */
  static async getVoices(apiKey: string): Promise<any[]> {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    console.log('🎭 Fetching voices...');

    try {
      const response = await fetch(`${this.BASE_URL}/voices`, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Voices API Error:', errorText);
        throw new Error(`Failed to fetch voices: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Voices fetched:', data.voices?.length || 0, 'voices');
      
      return data.voices || [];
      
    } catch (error) {
      console.error('❌ Failed to fetch voices:', error);
      throw error;
    }
  }

  /**
   * Test API key validity
   */
  static async testApiKey(apiKey: string): Promise<boolean> {
    try {
      await this.getVoices(apiKey);
      return true;
    } catch (error) {
      console.error('❌ API key test failed:', error);
      return false;
    }
  }
}
