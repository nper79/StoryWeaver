const XI_API_KEY_HEADER = 'xi-api-key';
const API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

/**
 * Generates audio from text using the ElevenLabs API.
 * Legacy function name for compatibility with PlayModal
 */
export async function generateSpeech(text: string, voiceId: string, apiKey: string): Promise<Blob> {
  const result = await generateAudioWithAlignment(text, voiceId, apiKey);
  return result.audio;
}

/**
 * Interface for ElevenLabs API response with alignment data
 */
export interface ElevenLabsResponse {
  audio: Blob;
  alignment?: WordAlignment[];
}

export interface WordAlignment {
  word: string;
  start: number;
  end: number;
}

/**
 * Generates audio from text using the ElevenLabs API.
 *
 * @param {string} text The text to convert to speech.
 * @param {string} voiceId The ID of the voice to use.
 * @param {string} apiKey The ElevenLabs API key.
 * @returns {Promise<Blob>} A promise that resolves with the audio data as a Blob.
 * @throws {Error} If the API request fails.
 */
export async function generateAudio(text: string, voiceId: string, apiKey: string): Promise<Blob> {
  const result = await generateAudioWithAlignment(text, voiceId, apiKey);
  return result.audio;
}

/**
 * Generates audio with word-level alignment data from text using the ElevenLabs API.
 *
 * @param {string} text The text to convert to speech.
 * @param {string} voiceId The ID of the voice to use.
 * @param {string} apiKey The ElevenLabs API key.
 * @returns {Promise<ElevenLabsResponse>} A promise that resolves with audio and alignment data.
 * @throws {Error} If the API request fails.
 */
export async function generateAudioWithAlignment(text: string, voiceId: string, apiKey: string): Promise<ElevenLabsResponse> {
  if (!text || !voiceId || !apiKey) {
    throw new Error('Text, voice ID, and API key are required.');
  }

  console.log('🎯 [ELEVENLABS] Generating audio with alignment for text:', text.substring(0, 50) + '...');

  const url = `${API_URL}/${voiceId}/with-timestamps`;

  const headers = new Headers();
  headers.append('Accept', 'application/json'); // Changed to JSON to receive alignment data
  headers.append(XI_API_KEY_HEADER, apiKey);
  headers.append('Content-Type', 'application/json');

  const body = JSON.stringify({
    text: text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true,
    },
    with_alignment: true, // This is the key parameter!
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: body,
    });

    if (!response.ok) {
      let errorDetails = `Status: ${response.status}`;
      try {
        const errorJson = await response.json();
        errorDetails += `, Message: ${JSON.stringify(errorJson)}`;
      } catch (e) {
        const errorText = await response.text();
        errorDetails += `, Body: ${errorText}`;
      }
      throw new Error(`ElevenLabs API request failed. ${errorDetails}`);
    }

    const responseData = await response.json();
    console.log('🎯 [ELEVENLABS] API Response received:', typeof responseData);
    
    // Convert base64 audio to Blob
    let audioBlob: Blob;
    if (responseData.audio_base64) {
      console.log('🎵 [ELEVENLABS] Converting base64 audio to blob');
      const audioData = atob(responseData.audio_base64);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
    } else {
      throw new Error('No audio data received from ElevenLabs API');
    }

    // Extract alignment data
    const alignment: WordAlignment[] = responseData.alignment || [];
    console.log('📊 [TIMESTAMPS] Extracted', alignment.length, 'word timestamps:', alignment);

    return {
      audio: audioBlob,
      alignment: alignment
    };

  } catch (error) {
    console.error('❌ [ELEVENLABS] Error in generateAudioWithAlignment:', error);
    throw error; 
  }
}

/**
 * Fetches the list of available voices from the ElevenLabs API.
 * Legacy function name for compatibility with VoiceSettingsModal
 */
export async function fetchAvailableElevenLabsVoices(apiKey: string): Promise<any> {
    return getVoices(apiKey);
}

/**
 * Fetches the list of available voices from the ElevenLabs API.
 *
 * @param {string} apiKey The ElevenLabs API key.
 * @returns {Promise<any>} A promise that resolves with the list of voices.
 * @throws {Error} If the API request fails.
 */
export async function getVoices(apiKey: string): Promise<any> {
    if (!apiKey) {
        throw new Error('API key is required.');
    }

    const url = 'https://api.elevenlabs.io/v1/voices';
    const headers = new Headers();
    headers.append(XI_API_KEY_HEADER, apiKey);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) {
            let errorDetails = `Status: ${response.status}`;
            try {
                const errorJson = await response.json();
                errorDetails += `, Message: ${JSON.stringify(errorJson)}`;
            } catch (e) {
                const errorText = await response.text();
                errorDetails += `, Body: ${errorText}`;
            }
            throw new Error(`ElevenLabs API request to get voices failed. ${errorDetails}`);
        }

        const voicesData = await response.json();
        return voicesData.voices;

    } catch (error) {
        console.error('Error in getVoices:', error);
        throw error;
    }
}
