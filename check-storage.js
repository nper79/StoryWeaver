// Check localStorage usage
function checkLocalStorageUsage() {
  let totalSize = 0;
  let count = 0;
  let audioCount = 0;
  let audioSize = 0;
  
  console.log('=== LocalStorage Usage Analysis ===');
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        const keySize = key.length;
        const valueSize = value.length;
        const itemSize = keySize + valueSize;
        
        totalSize += itemSize;
        count++;
        
        if (key.startsWith('audio_') || key.startsWith('alignment_')) {
          audioCount++;
          audioSize += itemSize;
          console.log(`${key}: ${Math.round(itemSize / 1024)}KB`);
        }
      }
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Total items: ${count}`);
  console.log(`Audio/alignment items: ${audioCount}`);
  console.log(`Total size: ${Math.round(totalSize / 1024)}KB (${Math.round(totalSize / 1024 / 1024 * 100) / 100}MB)`);
  console.log(`Audio/alignment size: ${Math.round(audioSize / 1024)}KB (${Math.round(audioSize / 1024 / 1024 * 100) / 100}MB)`);
  console.log(`Estimated quota: ~5-10MB`);
  
  // Check if we're near quota
  const quotaUsagePercent = (totalSize / (5 * 1024 * 1024)) * 100;
  console.log(`Estimated quota usage: ${Math.round(quotaUsagePercent)}%`);
  
  if (quotaUsagePercent > 80) {
    console.log('⚠️  WARNING: LocalStorage is near quota limit!');
  }
}

// Run the check
checkLocalStorageUsage();
