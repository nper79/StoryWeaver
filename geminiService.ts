/**
 * Gemini API Service for Word Translation
 * Provides Portuguese translations with lemma and grammar class information
 */

interface TranslationResult {
  translation: string;
  lemma: string;
  grammarClass: string;
  error?: string;
}

/**
 * Enhanced cache with localStorage persistence
 */
const translationCache = new Map<string, TranslationResult>();
const CACHE_KEY = 'gemini_translations';
const CACHE_EXPIRY_HOURS = 24; // Cache for 24 hours

// Load cache from localStorage on startup
const loadCacheFromStorage = () => {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      Object.entries(data).forEach(([key, value]: [string, any]) => {
        if (value.timestamp && Date.now() - value.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
          translationCache.set(key, value.result);
        }
      });
    }
  } catch (error) {
    console.warn('Failed to load translation cache from localStorage:', error);
  }
};

// Save cache to localStorage
const saveCacheToStorage = () => {
  try {
    const cacheData: Record<string, { result: TranslationResult; timestamp: number }> = {};
    translationCache.forEach((result, key) => {
      cacheData[key] = { result, timestamp: Date.now() };
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to save translation cache to localStorage:', error);
  }
};

// Initialize cache
loadCacheFromStorage();

/**
 * Translate a word using Google Gemini API
 */
async function translateWord(word: string): Promise<TranslationResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('Gemini API key not found in environment variables');
    return {
      translation: 'API key not configured',
      lemma: '',
      grammarClass: '',
      error: 'API key not found'
    };
  }

  const prompt = `Translate the Spanish word "${word}" to English and provide the following information in this exact format:

Translation: [English translation]
Lemma: [base form of the original Spanish word with accents preserved]
Grammar Class: [noun/verb/adjective/adverb/etc.]

Example:
Translation: house
Lemma: está
Grammar Class: verb

Please respond only with the requested format, no additional text.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.0,
          topK: 1,
          topP: 0.95,
          maxOutputTokens: 50,
          candidateCount: 1
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response format from Gemini API');
    }

    const text = data.candidates[0].content.parts[0].text;
    console.log('🤖 [Gemini] Raw response:', text);

    // Parse the response
    const lines = text.split('\n').map((line: string) => line.trim()).filter((line: string) => line);
    let translation = '';
    let lemma = '';
    let grammarClass = '';

    for (const line of lines as string[]) {
      if (line.toLowerCase().startsWith('translation:')) {
        translation = line.substring(line.indexOf(':') + 1).trim();
      } else if (line.toLowerCase().startsWith('lemma:')) {
        lemma = line.substring(line.indexOf(':') + 1).trim();
      } else if (line.toLowerCase().startsWith('grammar class:')) {
        grammarClass = line.substring(line.indexOf(':') + 1).trim();
      }
    }

    const result = {
      translation: translation || 'Translation not found',
      lemma: lemma || word,
      grammarClass: grammarClass || 'unknown'
    };

    console.log('✅ [Gemini] Parsed result:', result);
    return result;

  } catch (error) {
    console.error('❌ [Gemini] Translation error:', error);
    return {
      translation: 'Translation failed',
      lemma: word,
      grammarClass: 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Translate word with caching
 */
export async function translateWordCached(word: string): Promise<TranslationResult> {
  // Check cache first
  if (translationCache.has(word)) {
    console.log('💾 [Cache] Found cached translation for:', word);
    return translationCache.get(word)!;
  }
  
  console.log('🔍 [Gemini] Translating word:', word);
  
  // Translate and cache result
  const result = await translateWord(word);
  translationCache.set(word, result);
  
  // Save to localStorage for persistence
  saveCacheToStorage();
  
  return result;
}

/**
 * Clear translation cache
 */
export function clearTranslationCache(): void {
  translationCache.clear();
  localStorage.removeItem(CACHE_KEY);
}

export default { translateWordCached, clearTranslationCache };
