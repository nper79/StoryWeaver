// Quick implementation for App.tsx - Beat Migration Function

// Add these imports to App.tsx:
// import { BeatMigrationService } from './services/beatMigrationService';

// Add these state variables:
// const [isMigratingBeats, setIsMigratingBeats] = useState(false);

// Add this function to App.tsx:
const handleMigrateBeats = async () => {
  setIsMigratingBeats(true);
  
  try {
    console.log('🔄 Starting beat migration...');
    
    let totalBeatsUpdated = 0;
    const updatedScenes = scenes.map(scene => {
      if (scene.beats && scene.beats.length > 0) {
        const beatsNeedingMigration = BeatMigrationService.countBeatsNeedingMigration(scene.beats);
        
        if (beatsNeedingMigration > 0) {
          console.log(`📝 Migrating ${beatsNeedingMigration} beats in scene "${scene.title}"`);
          const migratedBeats = BeatMigrationService.migrateSceneBeats(scene.beats);
          totalBeatsUpdated += beatsNeedingMigration;
          
          return {
            ...scene,
            beats: migratedBeats
          };
        }
      }
      return scene;
    });
    
    if (totalBeatsUpdated > 0) {
      setScenes(updatedScenes);
      console.log(`✅ Migration complete! Updated ${totalBeatsUpdated} beats.`);
      alert(`Beat migration completed successfully!\n\n${totalBeatsUpdated} beats were updated with speaker annotations.\n\nYour beats now use the format [Speaker] for better voice assignment.`);
    } else {
      console.log('ℹ️ No beats needed migration.');
      alert('No beats needed migration.\n\nAll your beats already have speaker annotations or no beats were found.');
    }
    
  } catch (error) {
    console.error('❌ Error during beat migration:', error);
    alert(`Error during beat migration: ${error.message}\n\nPlease try again or check the console for details.`);
  } finally {
    setIsMigratingBeats(false);
  }
};

// Add these props to the Toolbar component:
// onMigrateBeats={handleMigrateBeats}
// isMigratingBeats={isMigratingBeats}

console.log('📋 Implementation ready for App.tsx');
console.log('1. Add the imports');
console.log('2. Add the state variable');
console.log('3. Add the handleMigrateBeats function');
console.log('4. Add the props to Toolbar component');
console.log('5. The "Migrate Beats" button will appear in the toolbar!');
