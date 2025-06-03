import JSZip from 'jszip';
import { StoryData, VoiceAssignment, Scene } from './types';
import { getImageFromStorage } from './fileStorageService';

export interface StoryBackup {
  story: StoryData;
  metadata: {
    exportDate: string;
    version: string;
    appName: string;
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

    // Add the story data as JSON
    zip.file('story.json', JSON.stringify(backupData, null, 2));

    // Create folders for assets
    const imagesFolder = zip.folder('images');
    const audioFolder = zip.folder('audio');

    // Collect all image IDs from the story
    const imageIds = new Set<string>();
    
    // Add scene images
    storyData.scenes.forEach((scene: Scene) => {
      if (scene.generatedImageId) {
        imageIds.add(scene.generatedImageId);
      }
    });

    // Add character images from voice assignments
    const voiceAssignments = storyData.voiceAssignments || [];
    voiceAssignments.forEach((va: VoiceAssignment) => {
      if (va.imageId) {
        imageIds.add(va.imageId);
      }
    });

    // Export all images
    for (const imageId of imageIds) {
      try {
        const imageDataUrl = await getImageFromStorage(imageId);
        if (imageDataUrl && imagesFolder) {
          // Convert data URL to blob for ZIP storage
          const imageBlob = dataURLToBlob(imageDataUrl);
          // Determine file extension based on data URL
          const extension = imageDataUrl.includes('data:image/png') ? 'png' : 'jpg';
          imagesFolder.file(`${imageId}.${extension}`, imageBlob);
        }
      } catch (error) {
        console.warn(`Failed to export image ${imageId}:`, error);
      }
    }

    // Export audio files (if they exist in localStorage)
    storyData.scenes.forEach((scene: Scene) => {
      const audioData = localStorage.getItem(`audio_${scene.id}`);
      if (audioData && audioFolder) {
        try {
          const audioBlob = dataURLToBlob(audioData);
          audioFolder.file(`${scene.id}.mp3`, audioBlob);
        } catch (error) {
          console.warn(`Failed to export audio for scene ${scene.id}:`, error);
        }
      }
    });

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
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

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
          await saveImageToStorage(newImageId, imageBlob);
          oldToNewImageIds.set(oldImageId, newImageId);
        }
      }
    }

    // Update story with new IDs
    const updatedStory: StoryData = { ...backupData.story };

    // Generate new scene IDs and update scenes
    updatedStory.scenes = updatedStory.scenes.map((scene: Scene) => {
      const newSceneId = `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      oldToNewSceneIds.set(scene.id, newSceneId);
      
      return {
        ...scene,
        id: newSceneId,
        generatedImageId: scene.generatedImageId && oldToNewImageIds.has(scene.generatedImageId)
          ? oldToNewImageIds.get(scene.generatedImageId)
          : scene.generatedImageId
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
    const audioFolder = zipContent.folder('audio');
    if (audioFolder) {
      const audioFiles = Object.keys(audioFolder.files).filter(name => 
        name.startsWith('audio/') && !name.endsWith('/')
      );

      for (const audioPath of audioFiles) {
        const audioFile = zipContent.file(audioPath);
        if (audioFile) {
          const audioBlob = await audioFile.async('blob');
          const oldSceneId = audioPath.split('/')[1].split('.')[0];
          
          // Find the corresponding new scene ID
          const newSceneId = oldToNewSceneIds.get(oldSceneId);
          if (newSceneId) {
            // Convert blob to data URL and store in localStorage
            const dataURL = await blobToDataURL(audioBlob);
            localStorage.setItem(`audio_${newSceneId}`, dataURL);
          }
        }
      }
    }

    console.log('Story imported successfully');
    return updatedStory;
  } catch (error) {
    console.error('Failed to import story:', error);
    throw error;
  }
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

// Import the saveImageToStorage function from fileStorageService
async function saveImageToStorage(imageId: string, blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ImageStorage', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      
      const imageData = {
        id: imageId,
        blob: blob,
        timestamp: Date.now()
      };
      
      const addRequest = store.put(imageData);
      addRequest.onsuccess = () => resolve();
      addRequest.onerror = () => reject(addRequest.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('images')) {
        const store = db.createObjectStore('images', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}
