const XI_API_KEY_HEADER = 'xi-api-key';
const API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

/**
 * Generates audio from text using the ElevenLabs API.
 * Legacy function name for compatibility with PlayModal
 */
export async function generateSpeech(text: string, voiceId: string, apiKey: string): Promise<Blob> {
  return generateAudio(text, voiceId, apiKey);
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
  if (!text || !voiceId || !apiKey) {
    throw new Error('Text, voice ID, and API key are required.');
  }

  const url = `${API_URL}/${voiceId}`;

  const headers = new Headers();
  headers.append('Accept', 'audio/mpeg');
  headers.append(XI_API_KEY_HEADER, apiKey);
  headers.append('Content-Type', 'application/json');

  const body = JSON.stringify({
    text: text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0, // Default style
      use_speaker_boost: true,
    },
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

    const audioBlob = await response.blob();
    return audioBlob;

  } catch (error) {
    console.error('Error in generateAudio:', error);
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
