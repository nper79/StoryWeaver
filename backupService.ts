import JSZip from 'jszip';
import { StoryData, VoiceAssignment, Scene, Translation, Beat } from './types';
import { getImageFromStorage } from './fileStorageService';

/**
 * Check localStorage usage and available space
 */
function getLocalStorageUsage() {
  let totalSize = 0;
  let audioSize = 0;
  let audioCount = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        const itemSize = key.length + value.length;
        totalSize += itemSize;
        
        if (key.startsWith('audio_') || key.startsWith('alignment_')) {
          audioSize += itemSize;
          audioCount++;
        }
      }
    }
  }
  
  return {
    totalSize,
    audioSize,
    audioCount,
    totalSizeMB: totalSize / (1024 * 1024),
    audioSizeMB: audioSize / (1024 * 1024)
  };
}

/**
 * Clean up old audio/alignment files to free space
 */
function cleanupOldAudioFiles(keepRecentCount: number = 50) {
  console.log('[Storage] Starting cleanup of old audio files...');
  
  const audioKeys: Array<{key: string, timestamp: number, size: number}> = [];
  
  // Collect all audio/alignment keys with timestamps
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('audio_') || key.startsWith('alignment_'))) {
      const value = localStorage.getItem(key);
      if (value) {
        // Extract timestamp from key (usually at the end)
        const timestampMatch = key.match(/_([0-9]{13})_/);
        const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : 0;
        
        audioKeys.push({
          key,
          timestamp,
          size: key.length + value.length
        });
      }
    }
  }
  
  // Sort by timestamp (newest first)
  audioKeys.sort((a, b) => b.timestamp - a.timestamp);
  
  // Remove old files beyond keepRecentCount
  let removedCount = 0;
  let freedSpace = 0;
  
  for (let i = keepRecentCount; i < audioKeys.length; i++) {
    const item = audioKeys[i];
    localStorage.removeItem(item.key);
    removedCount++;
    freedSpace += item.size;
    console.log(`[Storage] Removed old audio: ${item.key} (${Math.round(item.size / 1024)}KB)`);
  }
  
  console.log(`[Storage] Cleanup complete: removed ${removedCount} files, freed ${Math.round(freedSpace / 1024)}KB`);
  return { removedCount, freedSpace };
}

/**
 * Attempt to store data in localStorage with quota handling
 */
function safeLocalStorageSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn(`[Storage] Quota exceeded when storing ${key}. Attempting cleanup...`);
      
      // Try cleanup and retry
      const cleanup = cleanupOldAudioFiles(30);
      
      if (cleanup.removedCount > 0) {
        try {
          localStorage.setItem(key, value);
          console.log(`[Storage] Successfully stored ${key} after cleanup`);
          return true;
        } catch (retryError) {
          console.error(`[Storage] Still failed to store ${key} after cleanup:`, retryError);
        }
      }
    } else {
      console.error(`[Storage] Failed to store ${key}:`, error);
    }
    return false;
  }
}

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

    // 🔍 DEBUG: Check what translations are being passed to export
    console.log('🔍 [Export] DEBUG - StoryData received:');
    console.log('🔍 [Export] - Scenes count:', storyData.scenes?.length || 0);
    console.log('🔍 [Export] - Connections count:', storyData.connections?.length || 0);
    console.log('🔍 [Export] - Translations count:', storyData.translations?.length || 0);
    console.log('🔍 [Export] - Connection translations count:', storyData.connectionTranslations?.length || 0);
    console.log('🔍 [Export] - Current language:', storyData.currentLanguage);
    
    if (storyData.translations && storyData.translations.length > 0) {
      console.log('🔍 [Export] - Translation languages:', [...new Set(storyData.translations.map(t => t.language))]);
    } else {
      console.log('🔍 [Export] - ❌ NO TRANSLATIONS FOUND IN STORY DATA!');
    }
    
    if (storyData.connectionTranslations && storyData.connectionTranslations.length > 0) {
      console.log('🔍 [Export] - Connection translation languages:', [...new Set(storyData.connectionTranslations.map(ct => ct.language))]);
    } else {
      console.log('🔍 [Export] - ❌ NO CONNECTION TRANSLATIONS FOUND IN STORY DATA!');
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
        
        // Create language-specific story data
        const translatedStoryData = {
          ...storyData,
          scenes: storyData.scenes.map(scene => {
            const translation = storyData.translations?.find(
              t => t.sceneId === scene.id && t.language === language
            );
            if (translation) {
              return {
                ...scene,
                title: translation.title,
                content: translation.content,
                beats: translation.beats ? translation.beats.map((beat, index) => ({
                  ...beat,
                  order: (beat as any).order ?? index
                } as Beat)) : scene.beats
              };
            }
            return scene;
          }),
          connections: storyData.connections.map(connection => connection),
          // Include connection translations in the language-specific data
          connectionTranslations: storyData.connectionTranslations?.filter(
            ct => ct.language === language
          ) || []
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

    // Export alignment data (timing files)
    console.log('[Export] Collecting alignment data from localStorage...');
    let exportedAlignmentCount = 0;
    
    // Create alignment folder in ZIP
    const alignmentFolder = zip.folder('alignment');
    
    // Get all localStorage keys that start with 'alignment_'
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('alignment_')) {
        try {
          const alignmentData = localStorage.getItem(key);
          if (alignmentData && alignmentFolder) {
            // Store as JSON file
            alignmentFolder.file(`${key}.json`, alignmentData);
            exportedAlignmentCount++;
            console.log(`[Export] Successfully exported alignment: ${key}.json`);
          }
        } catch (error) {
          console.warn(`[Export] Failed to export alignment ${key}:`, error);
        }
      }
    }
    
    console.log(`[Export] Successfully exported ${exportedAlignmentCount} alignment files`);

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
    const oldToNewConnectionIds = new Map<string, string>();

    // Import images
    const imagesFolder = zipContent.folder('images');
    if (imagesFolder) {
      const imageFiles = Object.keys(imagesFolder.files).filter(name => 
        name.startsWith('images/') && !name.endsWith('/') && 
        (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.gif') || name.endsWith('.webp'))
      );
      
      console.log(`[Import] Found ${imageFiles.length} image files:`, imageFiles);

      for (const imagePath of imageFiles) {
        const imageFile = zipContent.file(imagePath);
        if (imageFile) {
          const imageBlob = await imageFile.async('blob');
          // Extract ID from filename more robustly
          const filename = imagePath.split('/')[1]; // Get filename after 'images/'
          const oldImageId = filename.split('.')[0]; // Remove extension
          const newImageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          console.log(`[Import] Processing image: ${imagePath}`);
          console.log(`[Import] - Old ID: ${oldImageId}`);
          console.log(`[Import] - New ID: ${newImageId}`);
          
          // Store image in IndexedDB with new ID
          await saveImageBlobToStorage(newImageId, imageBlob);
          oldToNewImageIds.set(oldImageId, newImageId);
          
          console.log(`[Import] ✅ Image imported successfully: ${oldImageId} -> ${newImageId}`);
        }
      }
    }
    
    console.log(`[Import] Image ID mapping:`, Object.fromEntries(oldToNewImageIds));

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
        // Extract ID from filename more robustly
        const filename = videoPath.split('/')[1]; // Get filename after 'videos/'
        const oldVideoId = filename.split('.')[0]; // Remove extension
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

    // Create scene ID mapping FIRST (before importing audio/alignment)
    console.log('[Import] Creating scene ID mapping...');
    const oldToNewSceneIds = new Map<string, string>();
    
    // First, create mappings for scenes that exist in the story
    backupData.story.scenes.forEach((scene: Scene) => {
      const newSceneId = `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      oldToNewSceneIds.set(scene.id, newSceneId);
      console.log(`[Import] Scene mapping: ${scene.id} -> ${newSceneId}`);
    });
    
    // Scan audio files to find additional old scene IDs that need mapping
    console.log('[Import] Scanning audio files for additional scene IDs...');
    const audioFolder = zipContent.folder('audio');
    const additionalSceneIds = new Set<string>();
    
    if (audioFolder) {
      const audioFiles = Object.keys(audioFolder.files).filter(name => 
        name.startsWith('audio/') && !name.endsWith('/') && name.endsWith('.mp3')
      );
      
      for (const audioPath of audioFiles) {
        const filename = audioPath.split('/')[1];
        const localStorageKey = filename.replace('.mp3', '');
        
        if (localStorageKey.startsWith('audio_')) {
          const keyParts = localStorageKey.split('_');
          const sceneIndex = keyParts.indexOf('scene');
          
          if (sceneIndex !== -1 && sceneIndex + 2 < keyParts.length) {
            const oldSceneId = keyParts[sceneIndex] + '_' + keyParts[sceneIndex + 1] + '_' + keyParts[sceneIndex + 2];
            if (!oldToNewSceneIds.has(oldSceneId)) {
              additionalSceneIds.add(oldSceneId);
            }
          } else if (keyParts.length >= 2) {
            // Handle format like audio_mcqxjx5tqb2h442_beat_... (without scene_ prefix)
            const possibleSceneId = keyParts[1];
            if (!oldToNewSceneIds.has(possibleSceneId)) {
              additionalSceneIds.add(possibleSceneId);
            }
          }
        }
      }
    }
    
    // Map additional scene IDs to the first available new scene (or create new ones)
    const currentScenes = Array.from(oldToNewSceneIds.values());
    const targetSceneId = currentScenes.length > 0 ? currentScenes[0] : `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    additionalSceneIds.forEach(oldSceneId => {
      oldToNewSceneIds.set(oldSceneId, targetSceneId);
      console.log(`[Import] Additional scene mapping: ${oldSceneId} -> ${targetSceneId}`);
    });
    
    console.log(`[Import] Created ${oldToNewSceneIds.size} scene ID mappings total`);
    console.log(`[Import] All mappings:`, Array.from(oldToNewSceneIds.entries()));

    // Import audio files (now that scene mapping exists)
    console.log('[Import] Processing audio files...');
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
              let oldSceneId: string | null = null;
              
              // Handle two formats:
              // 1. audio_scene_TIMESTAMP_RANDOMSTRING_beat_...
              // 2. audio_SCENEID_beat_...
              const sceneIndex = keyParts.indexOf('scene');
              if (sceneIndex !== -1 && sceneIndex + 2 < keyParts.length) {
                // Format 1: scene_TIMESTAMP_RANDOMSTRING
                oldSceneId = keyParts[sceneIndex] + '_' + keyParts[sceneIndex + 1] + '_' + keyParts[sceneIndex + 2];
              } else if (keyParts.length >= 2) {
                // Format 2: direct scene ID (like mcqxjx5tqb2h442)
                oldSceneId = keyParts[1];
              }
              
              if (oldSceneId) {
                const newSceneId = oldToNewSceneIds.get(oldSceneId);
                console.log(`[Import] Audio key mapping: ${oldSceneId} -> ${newSceneId}`);
                console.log(`[Import] Original audio key: ${localStorageKey}`);
                
                if (newSceneId) {
                  // Create new localStorage key with the new scene ID
                  const newKey = localStorageKey.replace(oldSceneId, newSceneId);
                  
                  // Convert blob to data URL and store in localStorage with quota handling
                  const dataURL = await blobToDataURL(audioBlob);
                  const stored = safeLocalStorageSetItem(newKey, dataURL);
                  
                  if (stored) {
                    console.log(`[Import] ✅ Successfully imported audio:`);
                    console.log(`[Import]   - Old key: ${localStorageKey}`);
                    console.log(`[Import]   - New key: ${newKey}`);
                    console.log(`[Import]   - Scene mapping: ${oldSceneId} -> ${newSceneId}`);
                  } else {
                    console.error(`[Import] ❌ Failed to store audio ${newKey} - storage quota exceeded`);
                  }
                } else {
                  console.warn(`[Import] ❌ No new scene ID found for old scene ID: ${oldSceneId}`);
                  console.warn(`[Import] Available mappings:`, Array.from(oldToNewSceneIds.keys()));
                }
              } else {
                console.warn(`[Import] ❌ Could not extract scene ID from audio key: ${localStorageKey}`);
              }
            }
          } catch (error) {
            console.warn(`[Import] Failed to import audio file ${audioPath}:`, error);
          }
        }
      }
    }

    // Update story with new IDs
    const updatedStory: StoryData = { ...backupData.story };

    // Generate new scene IDs and update scenes
    updatedStory.scenes = updatedStory.scenes.map((scene: Scene) => {
      const newSceneId = oldToNewSceneIds.get(scene.id) || `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Update beat images and videos with new IDs if scene has beats
      let updatedBeats = scene.beats;
      if (scene.beats && Array.isArray(scene.beats)) {
        console.log(`[Import] Processing ${scene.beats.length} beats for scene: ${scene.title}`);
        updatedBeats = scene.beats.map((beat, beatIndex) => {
          const oldVideoId = beat.videoId;
          const oldImageId = beat.imageId;
          
          console.log(`[Import] 🔍 Processing Beat ${beatIndex + 1}:`, {
            beatId: beat.id,
            originalImageId: oldImageId,
            originalVideoId: oldVideoId
          });
          
          // Map image ID if it exists and has a mapping
          let newImageId = beat.imageId;
          if (beat.imageId && oldToNewImageIds.has(beat.imageId)) {
            newImageId = oldToNewImageIds.get(beat.imageId)!;
            console.log(`[Import] ✅ Beat ${beatIndex + 1} image mapping: ${beat.imageId} -> ${newImageId}`);
          } else if (beat.imageId) {
            console.log(`[Import] ❌ Beat ${beatIndex + 1} image ID not found in mapping: ${beat.imageId}`);
            console.log(`[Import] Available image mappings:`, Array.from(oldToNewImageIds.keys()));
            // Keep original ID if no mapping found
            newImageId = beat.imageId;
          }
          
          // Map video ID if it exists and has a mapping
          let newVideoId = beat.videoId;
          if (beat.videoId && oldToNewVideoIds.has(beat.videoId)) {
            newVideoId = oldToNewVideoIds.get(beat.videoId)!;
            console.log(`[Import] ✅ Beat ${beatIndex + 1} video mapping: ${beat.videoId} -> ${newVideoId}`);
          } else if (beat.videoId) {
            console.log(`[Import] ❌ Beat ${beatIndex + 1} video ID not found in mapping: ${beat.videoId}`);
            console.log(`[Import] Available video mappings:`, Array.from(oldToNewVideoIds.keys()));
            // Keep original ID if no mapping found
            newVideoId = beat.videoId;
          }
          
          const updatedBeat = {
            ...beat,
            imageId: newImageId,
            videoId: newVideoId
          };
          
          console.log(`[Import] 📋 Beat ${beatIndex + 1} final result:`, {
            beatId: beat.id,
            originalImageId: oldImageId,
            finalImageId: newImageId,
            originalVideoId: oldVideoId,
            finalVideoId: newVideoId,
            imageWasMapped: oldImageId !== newImageId,
            videoWasMapped: oldVideoId !== newVideoId,
            updatedBeat: {
              id: updatedBeat.id,
              imageId: updatedBeat.imageId,
              videoId: updatedBeat.videoId
            }
          });
          
          return updatedBeat;
        });
      }
      
      const finalScene = {
        ...scene,
        id: newSceneId,
        generatedImageId: scene.generatedImageId && oldToNewImageIds.has(scene.generatedImageId)
          ? oldToNewImageIds.get(scene.generatedImageId)
          : scene.generatedImageId,
        beats: updatedBeats
      };
      
      console.log(`[Import] 📝 Final scene "${scene.title}" created:`, {
        sceneId: finalScene.id,
        beatsCount: finalScene.beats?.length || 0,
        firstBeatImageId: finalScene.beats?.[0]?.imageId,
        firstBeatVideoId: finalScene.beats?.[0]?.videoId
      });
      
      return finalScene;
    });

    // Update connections with new scene IDs and populate connection ID mapping
    updatedStory.connections = updatedStory.connections.map(conn => {
      const newConnectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      oldToNewConnectionIds.set(conn.id, newConnectionId);
      
      return {
        ...conn,
        id: newConnectionId,
        fromSceneId: oldToNewSceneIds.get(conn.fromSceneId) || conn.fromSceneId,
        toSceneId: oldToNewSceneIds.get(conn.toSceneId) || conn.toSceneId
      };
    });

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



    // Import alignment data (timing files)
    console.log('[Import] Processing alignment data...');
    const alignmentFolder = zipContent.folder('alignment');
    if (alignmentFolder) {
      const alignmentFiles = Object.keys(alignmentFolder.files).filter(name => 
        name.startsWith('alignment/') && !name.endsWith('/') && name.endsWith('.json')
      );
      
      console.log(`[Import] Found ${alignmentFiles.length} alignment files`);

      for (const alignmentPath of alignmentFiles) {
        const alignmentFile = zipContent.file(alignmentPath);
        if (alignmentFile) {
          try {
            const alignmentText = await alignmentFile.async('text');
            const alignmentData = JSON.parse(alignmentText);
            
            // Extract the localStorage key from the filename
            // Format: alignment/alignment_sceneId_beatId_language_speaker_timestamp.json
            const filename = alignmentPath.split('/')[1]; // Remove 'alignment/' prefix
            const localStorageKey = filename.replace('.json', ''); // Remove .json extension
            
            // Check if this is one of our alignment files (starts with 'alignment_')
            if (localStorageKey.startsWith('alignment_')) {
              // Extract the old scene ID from the key to map to new scene ID
              const keyParts = localStorageKey.split('_');
              let oldSceneId: string | null = null;
              
              // Handle two formats:
              // 1. alignment_audio_scene_TIMESTAMP_RANDOMSTRING_beat_...
              // 2. alignment_audio_SCENEID_beat_...
              const sceneIndex = keyParts.indexOf('scene');
              if (sceneIndex !== -1 && sceneIndex + 2 < keyParts.length) {
                // Format 1: scene_TIMESTAMP_RANDOMSTRING
                oldSceneId = keyParts[sceneIndex] + '_' + keyParts[sceneIndex + 1] + '_' + keyParts[sceneIndex + 2];
              } else if (keyParts.length >= 3) {
                // Format 2: direct scene ID (like alignment_audio_mcqxjx5tqb2h442_beat_...)
                oldSceneId = keyParts[2];
              }
              
              if (oldSceneId) {
                const newSceneId = oldToNewSceneIds.get(oldSceneId);
                console.log(`[Import] Alignment key mapping: ${oldSceneId} -> ${newSceneId}`);
                
                if (newSceneId) {
                  // Update the alignment data with new scene ID
                  alignmentData.sceneId = newSceneId;
                  
                  // Create new localStorage key with the new scene ID
                  const newKey = localStorageKey.replace(oldSceneId, newSceneId);
                  
                  // Store alignment data in localStorage with quota handling
                  const stored = safeLocalStorageSetItem(newKey, JSON.stringify(alignmentData));
                  
                  if (stored) {
                    console.log(`[Import] ✅ Successfully imported alignment: ${newKey}`);
                  } else {
                    console.error(`[Import] ❌ Failed to store alignment ${newKey} - storage quota exceeded`);
                  }
                } else {
                  console.warn(`[Import] ❌ No new scene ID found for old scene ID in alignment: ${oldSceneId}`);
                }
              } else {
                console.warn(`[Import] ❌ Could not extract scene ID from alignment key: ${localStorageKey}`);
              }
            }
          } catch (error) {
            console.warn(`[Import] Failed to import alignment file ${alignmentPath}:`, error);
          }
        }
      }
    }

    // Process translations from language folders
    const translations: Translation[] = [];
    const connectionTranslations: any[] = [];
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
                  version: 1.0
                });
              }
            });
          }
          
          // Extract connection translations from the language-specific data
          if (langBackupData.story && langBackupData.story.connectionTranslations) {
            langBackupData.story.connectionTranslations.forEach((connTranslation: any) => {
              // Map old connection ID to new connection ID
              const newConnectionId = oldToNewConnectionIds.get(connTranslation.connectionId) || connTranslation.connectionId;
              
              connectionTranslations.push({
                id: `conn_trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                connectionId: newConnectionId,
                language: language,
                label: connTranslation.label
              });
              
              console.log(`[Import] Found connection translation: ${connTranslation.connectionId} -> ${connTranslation.label} (${language})`);
            });
          }
          
          // Set the detected language (use the first non-English language found)
          if (language !== 'en' && detectedLanguage === 'en') {
            detectedLanguage = language;
          }
        } catch (error) {
          console.error(`[Import] Failed to process language ${language}:`, error);
        }
      }
    }
    
    console.log(`[Import] Processed ${translations.length} translations for ${detectedLanguage}`);
    
    // Add translations and language info to the story data
    console.log(`[Import] 🔧 Creating final story data object...`);
    console.log(`[Import] - updatedStory scenes count: ${updatedStory.scenes.length}`);
    console.log(`[Import] - First scene beats:`, updatedStory.scenes[0]?.beats?.slice(0, 2).map(b => ({ id: b.id, imageId: b.imageId, videoId: b.videoId })));
    
    const finalStoryData = {
      ...updatedStory,
      translations,
      connectionTranslations,
      currentLanguage: detectedLanguage,
      narratorVoiceAssignments: backupData.story.narratorVoiceAssignments || {}
    };
    
    console.log(`[Import] 🔧 Final story data created!`);
    console.log(`[Import] - finalStoryData scenes count: ${finalStoryData.scenes.length}`);
    console.log(`[Import] - First scene beats after final creation:`, finalStoryData.scenes[0]?.beats?.slice(0, 2).map(b => ({ id: b.id, imageId: b.imageId, videoId: b.videoId })));
    
    console.log(`[Import] Imported ${translations.length} scene translations and ${connectionTranslations.length} connection translations`);
    
    // Log final story data for debugging
    console.log(`[Import] 🚀 FINAL STORY DATA SUMMARY:`);
    console.log(`[Import] - Total scenes: ${finalStoryData.scenes.length}`);
    finalStoryData.scenes.forEach((scene, index) => {
      if (scene.beats && scene.beats.length > 0) {
        console.log(`[Import] - Scene ${index + 1} "${scene.title}":`, {
          sceneId: scene.id,
          beatsCount: scene.beats.length,
          firstBeatIds: {
            imageId: scene.beats[0]?.imageId,
            videoId: scene.beats[0]?.videoId
          }
        });
      }
    });
    
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
    reader.onload = () => {
      let result = reader.result as string;
      // Fix content type for MP3 audio files
      if (result.startsWith('data:application/octet-stream;base64,')) {
        result = result.replace('data:application/octet-stream;base64,', 'data:audio/mp3;base64,');
        console.log('[Import] 🔧 Fixed audio content type to audio/mp3');
      }
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
