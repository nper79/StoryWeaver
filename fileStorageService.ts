// Browser-compatible file storage service for generated images
// Uses IndexedDB for efficient binary storage and download API for file saving

const DB_NAME = 'StoryWeaverImages';
const DB_VERSION = 1;
const IMAGES_STORE = 'images';

interface StoredImage {
  id: string;
  filename: string;
  data: Blob;
  type: 'scene' | 'character';
  timestamp: number;
}

/**
 * Initialize IndexedDB for image storage
 */
async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        const store = db.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Convert base64 to Blob for efficient storage
 */
function base64ToBlob(base64Data: string): Blob {
  // Remove data URL prefix if present
  const base64String = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  const byteCharacters = atob(base64String);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: 'image/png' });
}

/**
 * Store image in IndexedDB and return a reference ID
 */
export async function saveImageToStorage(
  base64Data: string,
  filename: string,
  type: 'scene' | 'character'
): Promise<string> {
  try {
    const db = await initDB();
    const blob = base64ToBlob(base64Data);
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    const imageData: StoredImage = {
      id,
      filename,
      data: blob,
      type,
      timestamp: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([IMAGES_STORE], 'readwrite');
      const store = transaction.objectStore(IMAGES_STORE);
      const request = store.add(imageData);
      
      request.onsuccess = () => {
        console.log(`[FileStorage] Saved ${type} image: ${filename} (ID: ${id})`);
        resolve(id);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[FileStorage] Failed to save image:', error);
    throw error;
  }
}

/**
 * Retrieve image from IndexedDB and convert to data URL
 */
export async function getImageFromStorage(id: string): Promise<string | null> {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([IMAGES_STORE], 'readonly');
      const store = transaction.objectStore(IMAGES_STORE);
      const request = store.get(id);
      
      request.onsuccess = () => {
        const result = request.result as StoredImage;
        if (result) {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(result.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[FileStorage] Failed to retrieve image:', error);
    return null;
  }
}

/**
 * Save a generated scene image
 */
export async function saveGeneratedImage(base64Data: string, sceneId: string): Promise<string> {
  const timestamp = Date.now();
  const filename = `scene-${sceneId}-${timestamp}.png`;
  return saveImageToStorage(base64Data, filename, 'scene');
}

/**
 * Save a character reference image
 * @param imageData - Either a base64 string or a Blob object
 * @param characterName - Name of the character
 * @returns Promise with the unique ID for the stored image
 */
export async function saveCharacterImage(imageData: string | Blob, characterName: string): Promise<string> {
  const timestamp = Date.now();
  const safeCharName = characterName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const filename = `${safeCharName}-${timestamp}.png`;
  
  // Handle blob vs base64 input
  if (imageData instanceof Blob) {
    return saveImageToBlob(imageData, filename, 'character');
  } else {
    return saveImageToStorage(imageData, filename, 'character');
  }
}

/**
 * Store image blob in IndexedDB and return a reference ID
 */
async function saveImageToBlob(
  blob: Blob,
  filename: string,
  type: 'scene' | 'character'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const db = initDB();
    db.then(database => {
      const id = `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      const transaction = database.transaction(IMAGES_STORE, 'readwrite');
      const store = transaction.objectStore(IMAGES_STORE);
      
      const storedImage: StoredImage = {
        id,
        filename,
        data: blob,
        type,
        timestamp: Date.now()
      };
      
      const request = store.add(storedImage);
      
      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    }).catch(reject);
  });
}

/**
 * Download an image to the user's computer
 */
export async function downloadImage(id: string, suggestedFilename?: string): Promise<void> {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([IMAGES_STORE], 'readonly');
      const store = transaction.objectStore(IMAGES_STORE);
      const request = store.get(id);
      
      request.onsuccess = () => {
        const result = request.result as StoredImage;
        if (result) {
          const url = URL.createObjectURL(result.data);
          const a = document.createElement('a');
          a.href = url;
          a.download = suggestedFilename || result.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve();
        } else {
          reject(new Error('Image not found'));
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[FileStorage] Failed to download image:', error);
    throw error;
  }
}

/**
 * Clear all stored images to free up space
 */
export async function clearAllImages(): Promise<void> {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([IMAGES_STORE], 'readwrite');
      const store = transaction.objectStore(IMAGES_STORE);
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('[FileStorage] All images cleared');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[FileStorage] Failed to clear images:', error);
    throw error;
  }
}

/**
 * Get storage usage statistics
 */
export async function getStorageStats(): Promise<{ count: number; estimatedSize: string }> {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([IMAGES_STORE], 'readonly');
      const store = transaction.objectStore(IMAGES_STORE);
      const request = store.count();
      
      request.onsuccess = () => {
        const count = request.result;
        // Estimate size (each image is roughly 1-3MB)
        const estimatedMB = count * 2; // Conservative estimate
        const estimatedSize = estimatedMB > 1024 
          ? `${(estimatedMB / 1024).toFixed(1)} GB` 
          : `${estimatedMB} MB`;
        
        resolve({ count, estimatedSize });
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[FileStorage] Failed to get storage stats:', error);
    return { count: 0, estimatedSize: '0 MB' };
  }
}
