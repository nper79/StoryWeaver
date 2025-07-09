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
 * Translate a word using Google Gemini API with sentence context
 */
async function translateWord(word: string, sentenceContext?: string): Promise<TranslationResult> {
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

  const prompt = sentenceContext 
    ? `In the sentence:
"${sentenceContext}"
What is the meaning of the word:
"${word}"

Please answer with focus only on the WORD, not on the whole sentence.

Provide:

English translation of the word (based on its usage in this sentence)

Lemma (dictionary form)

Grammatical class (e.g. noun, verb, adjective)

Do not translate or explain the whole sentence. Focus strictly on the single word.

Response format:
Translation: [word translation]
Lemma: [base form]
Grammar Class: [class]`
    : `What is the meaning of the word:
"${word}"

Please provide:

English translation

Lemma (dictionary form)

Grammatical class (e.g. noun, verb, adjective)

Do not assume sentence context. Focus only on the word.

Response format:
Translation: [word translation]
Lemma: [base form]
Grammar Class: [class]`;

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
 * Translate word with caching (includes sentence context)
 */
export async function translateWordCached(word: string, sentenceContext?: string): Promise<TranslationResult> {
  // Create cache key that includes context for more accurate caching
  const cacheKey = sentenceContext ? `${word}|${sentenceContext}` : word;
  
  // Check cache first
  if (translationCache.has(cacheKey)) {
    console.log('💾 [Cache] Found cached translation for:', word, sentenceContext ? 'with context' : 'without context');
    return translationCache.get(cacheKey)!;
  }
  
  console.log('🔍 [Gemini] Translating word:', word, sentenceContext ? 'with context' : 'without context');
  
  // Translate and cache result
  const result = await translateWord(word, sentenceContext);
  translationCache.set(cacheKey, result);
  
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
