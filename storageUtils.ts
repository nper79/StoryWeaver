// Storage utility functions to handle localStorage quota issues

export const getStorageUsage = (): { used: number; total: number; percentage: number } => {
  let used = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      used += localStorage[key].length + key.length;
    }
  }
  
  // Estimate total storage (usually 5-10MB, we'll use 5MB as conservative estimate)
  const total = 5 * 1024 * 1024; // 5MB in bytes
  const percentage = (used / total) * 100;
  
  return { used, total, percentage };
};

export const clearCharacterImages = (): void => {
  try {
    const storyData = localStorage.getItem('interactiveStoryData');
    if (storyData) {
      const parsed = JSON.parse(storyData);
      if (parsed.voiceAssignments) {
        parsed.voiceAssignments = parsed.voiceAssignments.map((assignment: any) => ({
          ...assignment,
          imageUrl: undefined
        }));
        localStorage.setItem('interactiveStoryData', JSON.stringify(parsed));
        console.log('Character images cleared from storage');
      }
    }
  } catch (error) {
    console.error('Failed to clear character images:', error);
  }
};

export const clearGeneratedImages = (): void => {
  try {
    const storyData = localStorage.getItem('interactiveStoryData');
    if (storyData) {
      const parsed = JSON.parse(storyData);
      if (parsed.scenes) {
        parsed.scenes = parsed.scenes.map((scene: any) => ({
          ...scene,
          generatedImageUrl: undefined
        }));
        localStorage.setItem('interactiveStoryData', JSON.stringify(parsed));
        console.log('Generated scene images cleared from storage');
      }
    }
  } catch (error) {
    console.error('Failed to clear generated images:', error);
  }
};

export const clearAllImages = (): void => {
  clearCharacterImages();
  clearGeneratedImages();
};

export const compressStorageData = (): boolean => {
  try {
    const storyData = localStorage.getItem('interactiveStoryData');
    if (storyData) {
      const parsed = JSON.parse(storyData);
      
      // Remove any undefined values and compress
      const compressed = JSON.stringify(parsed, (_key, value) => {
        if (value === undefined) return null;
        return value;
      });
      
      localStorage.setItem('interactiveStoryData', compressed);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to compress storage data:', error);
    return false;
  }
};

export const handleStorageQuotaExceeded = (): void => {
  const usage = getStorageUsage();
  console.warn(`Storage usage: ${usage.percentage.toFixed(1)}% (${usage.used} / ${usage.total} bytes)`);
  
  // Create a more sophisticated dialog with multiple options
  const choice = prompt(
    `Storage quota exceeded! Your data is using ${usage.percentage.toFixed(1)}% of available space.\n\n` +
    `This is usually caused by large generated images. Choose an option:\n\n` +
    `1 - Clear ALL images (character + generated images)\n` +
    `2 - Clear only generated scene images\n` +
    `3 - Clear only character reference images\n` +
    `4 - Cancel (manually manage storage)\n\n` +
    `Enter your choice (1-4):`,
    "1"
  );
  
  switch (choice) {
    case "1":
      clearAllImages();
      alert('All images have been cleared. You can re-upload smaller images if needed.');
      break;
    case "2":
      clearGeneratedImages();
      alert('Generated scene images have been cleared. Character reference images are preserved.');
      break;
    case "3":
      clearCharacterImages();
      alert('Character reference images have been cleared. Generated scene images are preserved.');
      break;
    case "4":
    default:
      alert('Please manually remove some images or use smaller image files to free up space.\n\nTip: Generated images are very large. Consider clearing them first.');
      break;
  }
};
