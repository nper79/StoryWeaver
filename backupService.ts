import JSZip from 'jszip';
import { StoryData, VoiceAssignment, Scene } from './types';
import { getImageFromStorage } from './fileStorageService';

export interface StoryBackup {
  story: StoryData;
  metadata: {
    exportDate: string;
    version: string;
    appName: string;
    language?: string;
  };
}

/**
 * Export a story with all its assets (images, audio) to a ZIP file
 */
export async function exportStoryToZip(storyData: StoryData): Promise<void> {
  try {
    if (!storyData || !storyData.scenes || storyData.scenes.length === 0) {
      throw new Error('No story data to export');
    }

    const zip = new JSZip();

    // Create the backup data structure
    const backupData: StoryBackup = {
      story: storyData,
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0.0',
        appName: 'Interactive Story Weaver'
      }
    };

    // Add the main story data (English) as JSON
    zip.file('story.json', JSON.stringify(backupData, null, 2));
    
    // Create language-specific folders if translations exist
    if (storyData.translations && storyData.translations.length > 0) {
      // Group translations by language
      const translationsByLanguage = storyData.translations.reduce((acc, translation) => {
        if (!acc[translation.language]) {
          acc[translation.language] = [];
        }
        acc[translation.language].push(translation);
        return acc;
      }, {} as Record<string, typeof storyData.translations>);
      
      // Create a folder for each language
      Object.entries(translationsByLanguage).forEach(([language, translations]) => {
        const languageFolder = zip.folder(language);
        
        // Create translated story data for this language
        const translatedStoryData = {
          ...storyData,
          scenes: storyData.scenes.map(scene => {
            const sceneTranslation = translations.find(t => t.sceneId === scene.id);
            if (sceneTranslation) {
              return {
                ...scene,
                title: sceneTranslation.title,
                content: sceneTranslation.content,
                beats: sceneTranslation.beats || scene.beats
              };
            }
            return scene;
          })
        };
        
        const translatedBackupData: StoryBackup = {
          story: translatedStoryData,
          metadata: {
            ...backupData.metadata,
            language: language
          }
        };
        
        languageFolder?.file('story.json', JSON.stringify(translatedBackupData, null, 2));
      });
    }

    // Create folders for assets
    const imagesFolder = zip.folder('images');
    const videosFolder = zip.folder('videos');
    const audioFolder = zip.folder('audio');

    // Collect all image IDs and video IDs from the story
    const imageIds = new Set<string>();
    const videoIds = new Set<string>();
    
    // Add scene images
    storyData.scenes.forEach((scene: Scene) => {
      if (scene.generatedImageId) {
        console.log(`[Export] Found scene image: ${scene.title} -> ${scene.generatedImageId}`);
        imageIds.add(scene.generatedImageId);
      }
      
      // Add beat images and videos if scene has beats
      if (scene.beats && Array.isArray(scene.beats)) {
        scene.beats.forEach((beat, beatIndex) => {
          if (beat.imageId) {
            console.log(`[Export] Found beat image: ${scene.title} beat ${beatIndex + 1} -> ${beat.imageId}`);
            imageIds.add(beat.imageId);
          }
          if (beat.videoId) {
            console.log(`[Export] Found beat video: ${scene.title} beat ${beatIndex + 1} -> ${beat.videoId}`);
            videoIds.add(beat.videoId);
          }
        });
      }
    });

    // Add character images from voice assignments
    const voiceAssignments = storyData.voiceAssignments || [];
    voiceAssignments.forEach((va: VoiceAssignment) => {
      if (va.imageId) {
        console.log(`[Export] Found character image: ${va.characterName} -> ${va.imageId}`);
        imageIds.add(va.imageId);
      }
    });

    console.log(`[Export] Total images to export: ${imageIds.size}`);
    console.log(`[Export] Total videos to export: ${videoIds.size}`);

    // Export all images
    let exportedImageCount = 0;
    for (const imageId of imageIds) {
      try {
        console.log(`[Export] Attempting to export image: ${imageId}`);
        const imageDataUrl = await getImageFromStorage(imageId);
        if (imageDataUrl && imagesFolder) {
          // Convert data URL to blob for ZIP storage
          const imageBlob = dataURLToBlob(imageDataUrl);
          // Determine file extension based on data URL
          const extension = imageDataUrl.includes('data:image/png') ? 'png' : 'jpg';
          imagesFolder.file(`${imageId}.${extension}`, imageBlob);
          exportedImageCount++;
          console.log(`[Export] Successfully exported image: ${imageId}.${extension}`);
        } else {
          console.warn(`[Export] Image not found in storage: ${imageId}`);
        }
      } catch (error) {
        console.warn(`Failed to export image ${imageId}:`, error);
      }
    }
    
    console.log(`[Export] Successfully exported ${exportedImageCount} out of ${imageIds.size} images`);

    // Export all videos
    let exportedVideoCount = 0;
    for (const videoId of videoIds) {
      try {
        console.log(`[Export] Attempting to export video: ${videoId}`);
        const videoDataUrl = await getImageFromStorage(videoId); // Reuse storage system
        if (videoDataUrl && videosFolder) {
          // Convert data URL to blob for ZIP storage
          const videoBlob = dataURLToBlob(videoDataUrl);
          // Determine file extension based on data URL (videos are typically mp4)
          const extension = videoDataUrl.includes('data:video/mp4') ? 'mp4' : 
                           videoDataUrl.includes('data:video/webm') ? 'webm' : 
                           videoDataUrl.includes('data:video/avi') ? 'avi' : 'mp4';
          videosFolder.file(`${videoId}.${extension}`, videoBlob);
          exportedVideoCount++;
          console.log(`[Export] Successfully exported video: ${videoId}.${extension}`);
        } else {
          console.warn(`[Export] Video not found in storage: ${videoId}`);
        }
      } catch (error) {
        console.warn(`Failed to export video ${videoId}:`, error);
      }
    }
    
    console.log(`[Export] Successfully exported ${exportedVideoCount} out of ${videoIds.size} videos`);

    // Export audio files (collect all audio from localStorage)
    console.log('[Export] Collecting audio files from localStorage...');
    let exportedAudioCount = 0;
    
    // Get all localStorage keys that start with 'audio_'
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('audio_')) {
        try {
          const audioData = localStorage.getItem(key);
          if (audioData && audioFolder) {
            const audioBlob = dataURLToBlob(audioData);
            // Use the full key as filename to preserve the structure
            // Format: audio_sceneId_beatId_language_speaker_timestamp.mp3
            audioFolder.file(`${key}.mp3`, audioBlob);
            exportedAudioCount++;
            console.log(`[Export] Successfully exported audio: ${key}.mp3`);
          }
        } catch (error) {
          console.warn(`[Export] Failed to export audio ${key}:`, error);
        }
      }
    }
    
    console.log(`[Export] Successfully exported ${exportedAudioCount} audio files`);

    // Generate the ZIP file
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Download the ZIP file
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `story_backup_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Story exported successfully');
  } catch (error) {
    console.error('Failed to export story:', error);
    throw error;
  }
}

/**
 * Import a story from a ZIP file
 */
export async function importStoryFromZip(file: File): Promise<StoryData> {
  try {
    console.log(`[Import] Starting ZIP import process for file: ${file.name} (${file.size} bytes)`);
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);
    
    // Debug: List all files in the ZIP
    const allFiles = Object.keys(zipContent.files);
    console.log(`[Import] ZIP contains ${allFiles.length} files:`, allFiles);

    // Read the story data
    const storyFile = zipContent.file('story.json');
    if (!storyFile) {
      throw new Error('Invalid backup file: story.json not found');
    }

    const storyDataText = await storyFile.async('text');
    const backupData: StoryBackup = JSON.parse(storyDataText);

    // Validate backup data
    if (!backupData.story || !backupData.story.scenes) {
      throw new Error('Invalid backup file: missing required data');
    }

    // Generate new IDs to avoid conflicts
    const oldToNewImageIds = new Map<string, string>();
    const oldToNewVideoIds = new Map<string, string>();
    const oldToNewSceneIds = new Map<string, string>();

    // Import images
    const imagesFolder = zipContent.folder('images');
    if (imagesFolder) {
      const imageFiles = Object.keys(imagesFolder.files).filter(name => 
        name.startsWith('images/') && !name.endsWith('/')
      );

      for (const imagePath of imageFiles) {
        const imageFile = zipContent.file(imagePath);
        if (imageFile) {
          const imageBlob = await imageFile.async('blob');
          const oldImageId = imagePath.split('/')[1].split('.')[0]; // Extract ID from filename
          const newImageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Store image in IndexedDB with new ID
          await saveImageBlobToStorage(newImageId, imageBlob);
          oldToNewImageIds.set(oldImageId, newImageId);
        }
      }
    }

    // Import videos - Use direct file enumeration
    console.log(`[Import] Searching for video files in ZIP...`);
    const videoFiles = allFiles.filter(name => 
      name.startsWith('videos/') && !name.endsWith('/') && 
      (name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.avi') || name.endsWith('.mov'))
    );
    
    console.log(`[Import] Found ${videoFiles.length} video files:`, videoFiles);

    for (const videoPath of videoFiles) {
      const videoFile = zipContent.file(videoPath);
      if (videoFile) {
        const videoBlob = await videoFile.async('blob');
        const oldVideoId = videoPath.split('/')[1].split('.')[0]; // Extract ID from filename
        const newVideoId = `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Fix MIME type if missing
        const fileExtension = videoPath.split('.').pop()?.toLowerCase();
        let correctedBlob = videoBlob;
        if (!videoBlob.type || videoBlob.type === 'application/octet-stream') {
          const mimeType = fileExtension === 'mp4' ? 'video/mp4' : 
                          fileExtension === 'webm' ? 'video/webm' : 
                          fileExtension === 'avi' ? 'video/avi' : 'video/mp4';
          correctedBlob = new Blob([videoBlob], { type: mimeType });
          console.log(`[Import] Corrected MIME type from '${videoBlob.type}' to '${mimeType}'`);
        }
        
        console.log(`[Import] Processing video: ${videoPath}`);
        console.log(`[Import] - Old ID: ${oldVideoId}`);
        console.log(`[Import] - New ID: ${newVideoId}`);
        console.log(`[Import] - Blob size: ${correctedBlob.size} bytes`);
        console.log(`[Import] - Blob type: ${correctedBlob.type}`);
        
        // Store video in IndexedDB with new ID (reuse image storage system)
        await saveImageBlobToStorage(newVideoId, correctedBlob);
        oldToNewVideoIds.set(oldVideoId, newVideoId);
        
        console.log(`[Import] ✅ Video imported successfully: ${oldVideoId} -> ${newVideoId}`);
      }
    }
    
    console.log(`[Import] Video ID mapping:`, Object.fromEntries(oldToNewVideoIds));

    // Update story with new IDs
    const updatedStory: StoryData = { ...backupData.story };

    // Generate new scene IDs and update scenes
    updatedStory.scenes = updatedStory.scenes.map((scene: Scene) => {
      const newSceneId = `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      oldToNewSceneIds.set(scene.id, newSceneId);
      
      // Update beat images and videos with new IDs if scene has beats
      let updatedBeats = scene.beats;
      if (scene.beats && Array.isArray(scene.beats)) {
        console.log(`[Import] Processing ${scene.beats.length} beats for scene: ${scene.title}`);
        updatedBeats = scene.beats.map((beat, beatIndex) => {
          const oldVideoId = beat.videoId;
          const oldImageId = beat.imageId;
          
          const newImageId = beat.imageId && oldToNewImageIds.has(beat.imageId)
            ? oldToNewImageIds.get(beat.imageId)
            : beat.imageId;
            
          const newVideoId = beat.videoId && oldToNewVideoIds.has(beat.videoId)
            ? oldToNewVideoIds.get(beat.videoId)
            : beat.videoId;
          
          console.log(`[Import] Beat ${beatIndex + 1}:`, {
            oldImageId,
            newImageId,
            oldVideoId,
            newVideoId,
            hasVideoMapping: oldVideoId ? oldToNewVideoIds.has(oldVideoId) : false
          });
          
          return {
            ...beat,
            imageId: newImageId,
            videoId: newVideoId
          };
        });
      }
      
      return {
        ...scene,
        id: newSceneId,
        generatedImageId: scene.generatedImageId && oldToNewImageIds.has(scene.generatedImageId)
          ? oldToNewImageIds.get(scene.generatedImageId)
          : scene.generatedImageId,
        beats: updatedBeats
      };
    });

    // Update connections with new scene IDs
    updatedStory.connections = updatedStory.connections.map(conn => ({
      ...conn,
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromSceneId: oldToNewSceneIds.get(conn.fromSceneId) || conn.fromSceneId,
      toSceneId: oldToNewSceneIds.get(conn.toSceneId) || conn.toSceneId
    }));

    // Update start scene ID
    if (updatedStory.startSceneId && oldToNewSceneIds.has(updatedStory.startSceneId)) {
      updatedStory.startSceneId = oldToNewSceneIds.get(updatedStory.startSceneId) || null;
    }

    // Update voice assignments with new image IDs
    if (updatedStory.voiceAssignments) {
      updatedStory.voiceAssignments = updatedStory.voiceAssignments.map((va: VoiceAssignment) => ({
        ...va,
        imageId: va.imageId && oldToNewImageIds.has(va.imageId)
          ? oldToNewImageIds.get(va.imageId)
          : va.imageId
      }));
    }

    // Import audio files
    console.log('[Import] Processing audio files...');
    const audioFolder = zipContent.folder('audio');
    if (audioFolder) {
      const audioFiles = Object.keys(audioFolder.files).filter(name => 
        name.startsWith('audio/') && !name.endsWith('/') && name.endsWith('.mp3')
      );
      
      console.log(`[Import] Found ${audioFiles.length} audio files`);

      for (const audioPath of audioFiles) {
        const audioFile = zipContent.file(audioPath);
        if (audioFile) {
          try {
            const audioBlob = await audioFile.async('blob');
            // Extract the localStorage key from the filename
            // Format: audio/audio_sceneId_beatId_language_speaker_timestamp.mp3
            const filename = audioPath.split('/')[1]; // Remove 'audio/' prefix
            const localStorageKey = filename.replace('.mp3', ''); // Remove .mp3 extension
            
            // Check if this is one of our audio files (starts with 'audio_')
            if (localStorageKey.startsWith('audio_')) {
              // Extract the old scene ID from the key to map to new scene ID
              const keyParts = localStorageKey.split('_');
              if (keyParts.length >= 2) {
                const oldSceneId = keyParts[1]; // audio_SCENEID_...
                const newSceneId = oldToNewSceneIds.get(oldSceneId);
                
                if (newSceneId) {
                  // Create new localStorage key with the new scene ID
                  const newKey = localStorageKey.replace(`_${oldSceneId}_`, `_${newSceneId}_`);
                  
                  // Convert blob to data URL and store in localStorage
                  const dataURL = await blobToDataURL(audioBlob);
                  localStorage.setItem(newKey, dataURL);
                  console.log(`[Import] Successfully imported audio: ${newKey}`);
                } else {
                  console.warn(`[Import] No new scene ID found for old scene ID: ${oldSceneId}`);
                }
              }
            }
          } catch (error) {
            console.warn(`[Import] Failed to import audio file ${audioPath}:`, error);
          }
        }
      }
    }

    // Process translations from language folders
    const translations: Translation[] = [];
    let detectedLanguage = 'en';
    
    // Check for language folders (es, pt, ja, etc.)
    const languageFolders = allFiles.filter(path => 
      path.includes('/story.json') && path !== 'story.json'
    );
    
    console.log(`[Import] Found ${languageFolders.length} language folders:`, languageFolders);
    
    for (const langPath of languageFolders) {
      const language = langPath.split('/')[0];
      console.log(`[Import] Processing language: ${language}`);
      
      const langStoryFile = zipContent.file(langPath);
      if (langStoryFile) {
        try {
          const langStoryText = await langStoryFile.async('text');
          const langBackupData: StoryBackup = JSON.parse(langStoryText);
          
          // Extract translations from the translated story
          if (langBackupData.story && langBackupData.story.scenes) {
            langBackupData.story.scenes.forEach((translatedScene, index) => {
              const originalScene = backupData.story.scenes[index];
              if (originalScene && translatedScene) {
                // Map old scene ID to new scene ID
                const newSceneId = oldToNewSceneIds.get(originalScene.id) || originalScene.id;
                
                translations.push({
                  id: `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  sceneId: newSceneId,
                  language: language,
                  title: translatedScene.title,
                  content: translatedScene.content,
                  beats: translatedScene.beats || [],
                  createdAt: new Date().toISOString(),
                  version: '1.0'
                });
              }
            });
            
            // Set the detected language (use the first non-English language found)
            if (language !== 'en' && detectedLanguage === 'en') {
              detectedLanguage = language;
            }
          }
        } catch (error) {
          console.error(`[Import] Failed to process language ${language}:`, error);
        }
      }
    }
    
    console.log(`[Import] Processed ${translations.length} translations for ${detectedLanguage}`);
    
    // Add translations and language info to the story data
    const finalStoryData = {
      ...updatedStory,
      translations,
      currentLanguage: detectedLanguage,
      narratorVoiceAssignments: backupData.story.narratorVoiceAssignments || {}
    };
    
    console.log('Story imported successfully with translations');
    return finalStoryData;
  } catch (error) {
    console.error('Failed to import story:', error);
    throw error;
  }
}

// Helper function to save blob as image/video in the same IndexedDB structure
async function saveImageBlobToStorage(imageId: string, blob: Blob): Promise<void> {
  const DB_NAME = 'StoryWeaverImages';
  const DB_VERSION = 1;
  const IMAGES_STORE = 'images';
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([IMAGES_STORE], 'readwrite');
      const store = transaction.objectStore(IMAGES_STORE);
      
      // Determine file type and extension based on blob type or imageId prefix
      const isVideo = imageId.startsWith('vid_') || blob.type.startsWith('video/');
      const isImage = imageId.startsWith('img_') || blob.type.startsWith('image/');
      
      let filename: string;
      let type: string;
      
      if (isVideo) {
        // For videos, determine extension from blob type
        const extension = blob.type.includes('mp4') ? 'mp4' : 
                         blob.type.includes('webm') ? 'webm' : 
                         blob.type.includes('avi') ? 'avi' : 'mp4';
        filename = `${imageId}.${extension}`;
        type = 'video';
      } else {
        // For images, determine extension from blob type
        const extension = blob.type.includes('png') ? 'png' : 'jpg';
        filename = `${imageId}.${extension}`;
        type = 'scene';
      }
      
      console.log(`[Storage] Saving ${type}: ${filename} (${blob.type})`);
      
      const imageData = {
        id: imageId,
        filename: filename,
        data: blob,
        type: type,
        timestamp: Date.now()
      };
      
      const addRequest = store.put(imageData);
      addRequest.onsuccess = () => {
        console.log(`[Storage] Successfully saved ${type}: ${filename}`);
        resolve();
      };
      addRequest.onerror = () => {
        console.error(`[Storage] Failed to save ${type}: ${filename}`, addRequest.error);
        reject(addRequest.error);
      };
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        const store = db.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Helper functions
function dataURLToBlob(dataURL: string): Blob {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
