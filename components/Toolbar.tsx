import React, { useRef } from 'react';
import type { StoryData } from '../types';

interface ToolbarProps {
  onAddScene: () => void;
  onSave: () => void;
  onExportZip: () => Promise<void>;
  onLoad: (data: StoryData) => void;
  onImportZip: (file: File) => Promise<void>;
  onSetStartScene: () => void;
  isStartSceneSet: boolean; // True if the currently selectedSceneId is the start scene
  selectedSceneId: string | null; // The ID of the currently selected scene (for 'Set Start' button)
  onOrganizeFlow?: () => void;
  onPlayStory: () => void; 
  canPlayStory: boolean;
  onOpenSettings: () => void; // Changed from onOpenVoiceSettings
  onGenerateAllSceneImages: () => void;
  isBulkGeneratingImages: boolean;
  bulkImageProgress: number;
  onMigrateBeats?: () => void; // New prop for beat migration
  isMigratingBeats?: boolean; // New prop for migration loading state
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  onAddScene, 
  onSave, 
  onExportZip, 
  onLoad, 
  onImportZip, 
  onSetStartScene, 
  isStartSceneSet, 
  selectedSceneId,
  onOrganizeFlow,
  onPlayStory,
  canPlayStory,
  onOpenSettings,
  onGenerateAllSceneImages,
  isBulkGeneratingImages,
  bulkImageProgress,
  onMigrateBeats,
  isMigratingBeats,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          // Basic validation, could be more robust with a schema validator
          if (json && typeof json === 'object' && Array.isArray(json.scenes) && Array.isArray(json.connections)) {
            onLoad(json as StoryData);
          } else {
            alert('Invalid story file format.');
          }
        } catch (error) {
          alert('Error reading story file: ' + (error as Error).message);
        }
      };
      reader.readAsText(file);
      if(fileInputRef.current) { 
        fileInputRef.current.value = "";
      }
    }
  };

  const handleZipFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportZip(file);
      if(zipInputRef.current) { 
        zipInputRef.current.value = "";
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const triggerZipInput = () => {
    zipInputRef.current?.click();
  };

  const commonButtonClass = "px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-opacity-50 flex items-center space-x-2";
  const primaryButtonClass = `${commonButtonClass} bg-sky-500 hover:bg-sky-600 text-white focus:ring-sky-400`;
  const secondaryButtonClass = `${commonButtonClass} bg-slate-600 hover:bg-slate-500 text-slate-100 focus:ring-slate-400`;
  const exportButtonClass = `${commonButtonClass} bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-400`;
  const importButtonClass = `${commonButtonClass} bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-400`;
  
  const startSceneButtonClass = selectedSceneId 
    ? (isStartSceneSet ? `${commonButtonClass} bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500` : `${commonButtonClass} bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-400`) 
    : `${commonButtonClass} bg-slate-500 text-slate-300 cursor-not-allowed`;

  const playButtonClass = canPlayStory
    ? `${commonButtonClass} bg-green-500 hover:bg-green-600 text-white focus:ring-green-400`
    : `${commonButtonClass} bg-slate-500 text-slate-300 cursor-not-allowed`;

  return (
    <div className="fixed top-0 left-0 right-0 bg-slate-800 shadow-lg p-3 flex items-center space-x-3 z-40 border-b border-slate-700">
      <h1 className="text-xl font-semibold text-sky-300 mr-auto">Story Weaver</h1>
      <button 
        onClick={onPlayStory} 
        className={playButtonClass}
        disabled={!canPlayStory}
        title={canPlayStory ? "Play the story from the start scene" : "Set a start scene to play the story"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
        </svg>
        <span>Play Story</span>
      </button>
      <button onClick={onAddScene} className={primaryButtonClass}>
        Add Scene
      </button>
      {onOrganizeFlow && (
         <button onClick={onOrganizeFlow} className={secondaryButtonClass} title="Automatically arrange scenes vertically">
          Organize Flow
        </button>
      )}
       <button 
        onClick={onOpenSettings} 
        className={secondaryButtonClass} 
        title="Configure settings (voices, images, AI prompts)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-1">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
        <span>Settings</span>
      </button>
      <button 
        onClick={onSetStartScene} 
        className={startSceneButtonClass}
        disabled={!selectedSceneId} 
        title={!selectedSceneId ? "Select a scene first" : (isStartSceneSet ? "This is the start scene (click to unset)" : "Set selected as Start Scene")}
      >
        {isStartSceneSet ? "Start Scene ✓" : "Set Start"}
      </button>
      
      {/* Export/Import Section */}
      <div className="border-l border-slate-600 pl-3 flex items-center space-x-3">
        <button 
          onClick={onExportZip} 
          className={exportButtonClass}
          title="Export story with all images and audio as ZIP file"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v5.59l1.95-2.1a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0L6.2 7.26a.75.75 0 111.1-1.02l1.95 2.1V2.75A.75.75 0 0110 2z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M5.404 14.596A6.5 6.5 0 1115.596 5.404 6.5 6.5 0 015.404 14.596zM4.25 18a.75.75 0 01-.75-.75v-8.5a.75.75 0 011.5 0v7.75h11.5v-7.75a.75.75 0 011.5 0v8.5a.75.75 0 01-.75.75H4.25z" clipRule="evenodd" />
          </svg>
          <span>Export ZIP</span>
        </button>
        
        <button 
          onClick={triggerZipInput} 
          className={importButtonClass}
          title="Import story from ZIP file with all assets"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M10 18a.75.75 0 01-.75-.75v-5.59l-1.95 2.1a.75.75 0 11-1.1-1.02l3.25-3.5a.75.75 0 011.1 0l3.25 3.5a.75.75 0 11-1.1 1.02l-1.95-2.1v5.59A.75.75 0 0110 18z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M14.596 5.404A6.5 6.5 0 015.404 14.596 6.5 6.5 0 0114.596 5.404zM15.75 2a.75.75 0 01.75.75v8.5a.75.75 0 01-1.5 0V3.5H3.5v7.75a.75.75 0 01-1.5 0V2.75A.75.75 0 012.75 2h13z" clipRule="evenodd" />
          </svg>
          <span>Import ZIP</span>
        </button>
      </div>
      
      {/* Beat Migration */}
      {onMigrateBeats && (
        <div className="border-l border-slate-600 pl-3 flex items-center space-x-3">
          <button 
            onClick={onMigrateBeats}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center space-x-2 ${
              isMigratingBeats 
                ? 'bg-yellow-400 text-yellow-900 cursor-not-allowed' 
                : 'bg-yellow-600 hover:bg-yellow-500 text-white'
            }`}
            disabled={isMigratingBeats}
            title="Migrate existing beats to use speaker annotations [Speaker] for better voice assignment"
          >
            {isMigratingBeats ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Migrating...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
                </svg>
                <span>Migrate Beats</span>
              </>
            )}
          </button>
        </div>
      )}
      
      {/* Legacy JSON Import/Export */}
      <div className="border-l border-slate-600 pl-3 flex items-center space-x-3">
        <button onClick={onSave} className={secondaryButtonClass}>
          Save Story
        </button>
        <button onClick={triggerFileInput} className={secondaryButtonClass}>
          Load Story
        </button>
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />
      <input
        type="file"
        ref={zipInputRef}
        onChange={handleZipFileChange}
        accept=".zip"
        className="hidden"
      />
    </div>
  );
};

export default Toolbar;