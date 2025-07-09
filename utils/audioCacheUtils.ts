/**
 * Utility functions for managing audio cache in localStorage
 */

/**
 * Clear all audio files from localStorage
 * Audio files are stored with keys that start with 'audio_'
 */
export function clearAllAudioCache(): void {
  try {
    const keysToRemove: string[] = [];
    
    // Find all localStorage keys that start with 'audio_'
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('audio_')) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all audio keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`[Audio Cache] Cleared ${keysToRemove.length} audio files from localStorage`);
    
    return;
  } catch (error) {
    console.error('[Audio Cache] Error clearing audio cache:', error);
    throw error;
  }
}

/**
 * Get information about audio cache usage
 */
export function getAudioCacheInfo(): { count: number; estimatedSize: number; keys: string[] } {
  const audioKeys: string[] = [];
  let estimatedSize = 0;
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('audio_')) {
        audioKeys.push(key);
        const value = localStorage.getItem(key);
        if (value) {
          // Estimate size (base64 strings are roughly 4/3 the size of original data)
          estimatedSize += value.length;
        }
      }
    }
  } catch (error) {
    console.error('[Audio Cache] Error getting cache info:', error);
  }
  
  return {
    count: audioKeys.length,
    estimatedSize,
    keys: audioKeys
  };
}
