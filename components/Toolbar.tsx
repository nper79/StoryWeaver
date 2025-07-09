import React, { useRef } from 'react';
import type { StoryData, Translation } from '../types';

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
  onDownloadAllAudio?: () => void; // New prop for audio download
  isDownloadingAudio?: boolean; // New prop for audio download loading state
  onClearAudio?: () => void; // New prop for clearing audio cache
  currentLanguage: string; // Current selected language
  translations: Translation[]; // Available translations
  onLanguageChange: (language: string) => void; // Callback when language changes
  hasUnsavedChanges?: boolean; // Indicates if there are unsaved changes
  isAutoSaving?: boolean; // Indicates if auto-save is in progress
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
  onDownloadAllAudio,
  isDownloadingAudio,
  onClearAudio,
  currentLanguage,
  translations,
  onLanguageChange,
  hasUnsavedChanges = false,
  isAutoSaving = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Get available languages from translations
  const getAvailableLanguages = () => {
    const languages = new Set(['en']); // Always include English
    translations.forEach(translation => {
      languages.add(translation.language);
    });
    return Array.from(languages);
  };

  const getLanguageName = (code: string) => {
    const languageNames: Record<string, string> = {
      'en': 'English',
      'es': 'Español',
      'pt': 'Português',
      'fr': 'Français',
      'de': 'Deutsch',
      'it': 'Italiano',
      'ja': '日本語',
      'ko': '한국어',
      'zh': '中文',
      'ru': 'Русский'
    };
    return languageNames[code] || code.toUpperCase();
  };

  const availableLanguages = getAvailableLanguages();
  
  // Debug logs for language selector
  console.log('🌐 Language Selector Debug:');
  console.log('- Available languages:', availableLanguages);
  console.log('- Current language:', currentLanguage);
  console.log('- Translations count:', translations.length);

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
      {/* Language Selector - Always show for debugging */}
      <div className="flex items-center space-x-2">
        <span className="text-sm text-slate-300 whitespace-nowrap">Language:</span>
        <select
          value={currentLanguage}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="px-3 py-2 rounded-md text-sm bg-slate-700 border border-slate-600 text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 min-w-0"
          title="Switch between available story languages"
        >
          {availableLanguages.map(lang => (
            <option key={lang} value={lang}>
              {getLanguageName(lang)} ({lang.toUpperCase()})
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">({availableLanguages.length} langs)</span>
      </div>
      
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
      
      {/* Auto-save Status Indicator */}
      <div className="border-l border-slate-600 pl-3 flex items-center space-x-2">
        {isAutoSaving ? (
          <div className="flex items-center space-x-2 text-blue-400">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm">Saving...</span>
          </div>
        ) : hasUnsavedChanges ? (
          <div className="flex items-center space-x-2 text-yellow-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">Unsaved changes</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-green-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">Saved</span>
          </div>
        )}
      </div>
      
      {/* Beat Migration */}
      {onDownloadAllAudio && (
        <div className="border-l border-slate-600 pl-3 flex items-center space-x-3">
          <button 
            onClick={onDownloadAllAudio}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center space-x-2 ${
              isDownloadingAudio 
                ? 'bg-blue-400 text-blue-900 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
            disabled={isDownloadingAudio}
            title="Download and cache all audio for all languages to avoid streaming delays"
          >
            {isDownloadingAudio ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Downloading Audio...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
                </svg>
                <span>Download All Audio</span>
              </>
            )}
          </button>
          {onClearAudio && (
            <button 
              onClick={onClearAudio}
              className="px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center space-x-2 bg-red-600 hover:bg-red-500 text-white"
              title="Clear all cached audio files"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Clear Audio</span>
            </button>
          )}
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