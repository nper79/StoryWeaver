/**
 * Deepseek API Service for word translation
 */

interface DeepseekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface TranslationResult {
  word: string;
  translation: string;
  lemma?: string;
  grammarClass?: string;
  error?: string;
}

/**
 * Translate a word using Deepseek API
 */
export async function translateWord(word: string): Promise<TranslationResult> {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
  
  if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
    return {
      word,
      translation: 'API key not configured',
      error: 'Deepseek API key not found in environment variables'
    };
  }

  try {
    const prompt = `Provide me with the following meaning of the following word: ${word}

- Translation into Portuguese
- Lemma
- Grammar class

Reply format should be:

Original word
- Translation (this should be in Portuguese):
- Lemma:
- Grammar class:

Example:

Dog
- Translation: Cão, cachorro
- Lemma: Dog
- Grammar class: Substantivo`;

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`Deepseek API error: ${response.status} ${response.statusText}`);
    }

    const data: DeepseekResponse = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from Deepseek API');
    }

    const content = data.choices[0].message.content.trim();
    
    // Parse the structured text response
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let translation = 'Translation not found';
    let lemma = '';
    let grammarClass = '';
    
    for (const line of lines) {
      if (line.startsWith('- Translation:') || line.startsWith('- Tradução:')) {
        translation = line.replace(/^- (Translation|Tradução):\s*/, '');
      } else if (line.startsWith('- Lemma:')) {
        lemma = line.replace(/^- Lemma:\s*/, '');
      } else if (line.startsWith('- Grammar class:') || line.startsWith('- Classe gramatical:')) {
        grammarClass = line.replace(/^- (Grammar class|Classe gramatical):\s*/, '');
      }
    }
    
    return {
      word,
      translation,
      lemma: lemma || undefined,
      grammarClass: grammarClass || undefined
    };

  } catch (error) {
    console.error('Error translating word:', error);
    return {
      word,
      translation: 'Translation failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Enhanced cache with localStorage persistence
 */
const translationCache = new Map<string, TranslationResult>();
const CACHE_KEY = 'deepseek_translations';
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
 * Translate word with caching
 */
export async function translateWordCached(word: string): Promise<TranslationResult> {
  // Check cache first
  if (translationCache.has(word)) {
    return translationCache.get(word)!;
  }
  
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
}
