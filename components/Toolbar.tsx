
import React, { useRef } from 'react';
import type { StoryData } from '../types';

interface ToolbarProps {
  onAddScene: () => void;
  onSave: () => void;
  onLoad: (data: StoryData) => void;
  onSetStartScene: () => void;
  isStartSceneSet: boolean; // True if the currently selectedSceneId is the start scene
  selectedSceneId: string | null; // The ID of the currently selected scene (for 'Set Start' button)
  onOrganizeFlow?: () => void;
  onPlayStory: () => void; 
  canPlayStory: boolean;
  onOpenSettings: () => void; // Changed from onOpenVoiceSettings
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  onAddScene, 
  onSave, 
  onLoad, 
  onSetStartScene, 
  isStartSceneSet, 
  selectedSceneId,
  onOrganizeFlow,
  onPlayStory,
  canPlayStory,
  onOpenSettings, // Changed from onOpenVoiceSettings
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const commonButtonClass = "px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-opacity-50 flex items-center space-x-2";
  const primaryButtonClass = `${commonButtonClass} bg-sky-500 hover:bg-sky-600 text-white focus:ring-sky-400`;
  const secondaryButtonClass = `${commonButtonClass} bg-slate-600 hover:bg-slate-500 text-slate-100 focus:ring-slate-400`;
  
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
      <button onClick={onSave} className={secondaryButtonClass}>
        Save Story
      </button>
      <button onClick={triggerFileInput} className={secondaryButtonClass}>
        Load Story
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />
    </div>
  );
};

export default Toolbar;