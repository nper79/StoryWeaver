import React, { useState, useRef, useEffect } from 'react';
import type { Scene, Connection } from '../types';
import EditableText from './EditableText';
import BeatDisplay from './BeatDisplay';
import { DEFAULT_SCENE_MIN_HEIGHT, DEFAULT_SCENE_WIDTH } from '../constants';
import { getImageFromStorage } from '../fileStorageService';
import type { LanguageLevel } from '../services/textRewriteService';

interface SceneBlockProps {
  scene: Scene;
  allConnections: Connection[]; // All connections to filter outgoing ones
  onUpdate: (id: string, updates: Partial<Omit<Scene, 'id'>>) => void;
  onDelete: (id: string) => void;
  onBodyMouseDown: (e: React.MouseEvent, sceneId: string) => void;
  onClick: (e: React.MouseEvent, sceneId: string) => void;
  onPortMouseDown: (e: React.MouseEvent, sceneId: string, portElement: HTMLElement) => void;
  isPrimarySelection: boolean;
  isConnectionDragTarget: boolean;
  isStartScene: boolean;
  onAddMultipleOptions?: (sceneId: string) => void;
  onAddTwoOptions?: (sceneId: string) => void;
  onAddOneOption?: (sceneId: string) => void;
  onAddInlineChoice: (sourceSceneId: string, choiceLabel: string) => void; // For new inline choice
  onUpdateConnectionLabel: (connectionId: string, newLabel: string) => void;
  onDeleteConnection: (connectionId: string) => void;
  onGenerateSceneImage?: (sceneId: string) => void; // New prop for image generation
  generatingImageForScene: string | null; // New prop for loading state
  onContinueWithAI?: (sceneId: string) => void; // AI continuation with single path
  onContinueWithAI2Options?: (sceneId: string) => void; // AI continuation with 2 choices
  onContinueWithAI3Options?: (sceneId: string) => void; // AI continuation with 3 choices
  generatingContinuationForScene: string | null; // New prop for AI generation loading state
  onRewriteText?: (sceneId: string, level: LanguageLevel) => void; // New prop for text rewriting
  rewritingTextForScene: string | null; // New prop for rewriting loading state
  onSubdivideIntoBeats?: (sceneId: string) => void; // New prop for beat subdivision
  subdividingSceneIntoBeats: string | null; // New prop for beat subdivision loading state
  onGenerateBeatImage?: (sceneId: string, beatId: string) => void; // New prop for beat image generation
  onGenerateAllBeatImages?: (sceneId: string) => void; // New prop for bulk beat image generation
  onUploadBeatVideo?: (sceneId: string, beatId: string, videoFile: File) => void; // New prop for beat video upload
  generatingBeatImageFor: { sceneId: string; beatId: string } | null; // New prop for beat image loading state
}

const SceneBlock: React.FC<SceneBlockProps> = ({
  scene,
  allConnections,
  onUpdate,
  onDelete,
  onBodyMouseDown,
  onClick,
  onPortMouseDown,
  isPrimarySelection,
  isConnectionDragTarget,
  isStartScene,
  onAddMultipleOptions,
  onAddTwoOptions,
  onAddOneOption,
  onAddInlineChoice,
  onUpdateConnectionLabel,
  onDeleteConnection,
  onGenerateSceneImage, // New prop for image generation
  generatingImageForScene, // New prop for loading state
  onContinueWithAI, // AI continuation with single path
  onContinueWithAI2Options, // AI continuation with 2 choices
  onContinueWithAI3Options, // AI continuation with 3 choices
  generatingContinuationForScene, // New prop for AI generation loading state
  onRewriteText, // New prop for text rewriting
  rewritingTextForScene, // New prop for rewriting loading state
  onSubdivideIntoBeats, // New prop for beat subdivision
  subdividingSceneIntoBeats, // New prop for beat subdivision loading state
  onGenerateBeatImage, // New prop for beat image generation
  onGenerateAllBeatImages, // New prop for bulk beat image generation
  onUploadBeatVideo, // New prop for beat video upload
  generatingBeatImageFor, // New prop for beat image loading state
}) => {
  const [isAddingNewChoice, setIsAddingNewChoice] = useState(false);
  const [newChoiceInputText, setNewChoiceInputText] = useState('');
  const newChoiceInputRef = useRef<HTMLInputElement>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [storedImage, setStoredImage] = useState<string | null>(null);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(scene.generatedImagePrompt || '');
  const [editingCharacters, setEditingCharacters] = useState(false);
  const [tempCharacters, setTempCharacters] = useState<string[]>([]);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [showRewriteDropdown, setShowRewriteDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadStoredImage = async () => {
      console.log(`[SceneBlock] Loading image for scene ${scene.title}, generatedImageId:`, scene.generatedImageId);
      if (scene.generatedImageId) {
        setImageLoading(true);
        try {
          const imageData = await getImageFromStorage(scene.generatedImageId);
          console.log(`[SceneBlock] Image loaded for ${scene.title}:`, imageData ? 'SUCCESS' : 'FAILED');
          setStoredImage(imageData);
        } catch (error) {
          console.error(`[SceneBlock] Error loading image for ${scene.title}:`, error);
          setStoredImage(null);
        }
        setImageLoading(false);
      } else {
        console.log(`[SceneBlock] No generatedImageId for scene ${scene.title}`);
        setStoredImage(null);
      }
    };
    loadStoredImage();
  }, [scene.generatedImageId, scene.title]);

  // Sync editedPrompt when scene.generatedImagePrompt changes
  useEffect(() => {
    if (!isEditingPrompt) {
      setEditedPrompt(scene.generatedImagePrompt || '');
    }
  }, [scene.generatedImagePrompt, isEditingPrompt]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRewriteDropdown(false);
      }
    };

    if (showRewriteDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRewriteDropdown]);

  const handleTitleSave = (newTitle: string) => {
    onUpdate(scene.id, { title: newTitle });
  };

  const handleContentSave = (newContent: string) => {
    onUpdate(scene.id, { content: newContent });
  };

  const blockStyle: React.CSSProperties = {
    left: scene.x,
    top: scene.y,
    width: scene.width || DEFAULT_SCENE_WIDTH,
    minHeight: scene.height || DEFAULT_SCENE_MIN_HEIGHT,
    position: 'absolute',
    cursor: 'grab',
  };

  let borderClass = 'border-slate-600';
  if (isStartScene) borderClass = 'border-emerald-500 ring-2 ring-emerald-500';
  if (isPrimarySelection) borderClass = 'border-sky-400 ring-2 ring-sky-400';
  if (isConnectionDragTarget) borderClass = 'border-yellow-400 ring-2 ring-yellow-400';

  const hoverScaleClass = !isConnectionDragTarget ? 'hover:scale-105' : '';

  const outgoingConnections = allConnections.filter(conn => conn.fromSceneId === scene.id);

  const handleAddNewChoiceToggle = () => {
    setIsAddingNewChoice(!isAddingNewChoice);
    setNewChoiceInputText('');
    if (!isAddingNewChoice) {
      setTimeout(() => newChoiceInputRef.current?.focus(), 0);
    }
  };

  const handleSaveNewChoice = () => {
    if (newChoiceInputText.trim()) {
      onAddInlineChoice(scene.id, newChoiceInputText.trim());
      setNewChoiceInputText('');
      setIsAddingNewChoice(false);
    }
  };
  
  const handleNewChoiceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveNewChoice();
    } else if (e.key === 'Escape') {
      setIsAddingNewChoice(false);
      setNewChoiceInputText('');
    }
  };

  const commonActionButtonClass = "flex-1 py-1.5 px-2 text-xs text-white rounded-md transition-colors focus:outline-none focus:ring-2";

  return (
    <div
      style={blockStyle}
      className={`bg-slate-700 shadow-xl rounded-lg border-2 ${borderClass} flex flex-col transition-all duration-150 ease-in-out transform group z-10 ${hoverScaleClass}`}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.connection-port, button, input, textarea, .choice-item, .add-choice-input-area, .generated-prompt-display')) {
          onBodyMouseDown(e, scene.id);
        }
      }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.connection-port, button, input, textarea, .choice-item, .add-choice-input-area, .generated-prompt-display')) {
          onClick(e, scene.id);
        }
      }}
      data-is-connection-target={isConnectionDragTarget}
    >
      {isStartScene && (
        <div className="absolute -top-3 -left-3 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full shadow-md font-semibold z-20">
          START
        </div>
      )}
      <div className="p-2 bg-slate-800 rounded-t-md relative flex justify-between items-center">
        <EditableText
          initialValue={scene.title}
          onSave={handleTitleSave}
          placeholder="Scene Title"
          className="text-sky-300 font-semibold flex-grow"
          inputFontSize="text-md"
        />
        <button
            onClick={(e) => { e.stopPropagation(); onDelete(scene.id); }}
            title="Delete Scene"
            className="ml-2 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full text-xs opacity-50 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-400 z-20"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c1.153 0 2.243.096 3.222.261m3.478-.397L10.877 4.102a2.25 2.25 0 00-2.244-2.077H8.084a2.25 2.25 0 00-2.244 2.077L4.772 5.79m14.456 0l-2.175 1.087M4.772 5.79l2.175 1.087m0 0L8.58 19.673H4.772M19.23 5.79L17.055 4.703M17.055 4.703L15.416 19.673H19.23" />
            </svg>
        </button>
      </div>
      <div className="p-3 flex-grow">
        {scene.isSubdivided && scene.beats ? (
          <div className="beats-container">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-300">Story Beats</h4>
              <div className="flex space-x-2">
                {onGenerateAllBeatImages && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerateAllBeatImages(scene.id);
                    }}
                    disabled={generatingBeatImageFor?.sceneId === scene.id && generatingBeatImageFor?.beatId === 'bulk'}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      generatingBeatImageFor?.sceneId === scene.id && generatingBeatImageFor?.beatId === 'bulk'
                        ? 'bg-orange-400 text-white cursor-not-allowed'
                        : 'bg-orange-600 hover:bg-orange-500 text-white'
                    }`}
                    title={generatingBeatImageFor?.sceneId === scene.id && generatingBeatImageFor?.beatId === 'bulk' ? "Generating all beat images..." : "Generate images for all beats in this scene"}
                  >
                    {generatingBeatImageFor?.sceneId === scene.id && generatingBeatImageFor?.beatId === 'bulk' ? (
                      <span className="flex items-center space-x-1">
                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Generating...</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Generate All Images</span>
                      </span>
                    )}
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Convert back to regular scene
                    onUpdate(scene.id, { isSubdivided: false, beats: undefined });
                  }}
                  className="text-xs px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-300 rounded transition-colors"
                  title="Convert back to regular scene"
                >
                  Merge Beats
                </button>
              </div>
            </div>
            {scene.beats.map((beat, index) => (
              <BeatDisplay
                key={beat.id}
                beat={beat}
                isLast={index === scene.beats!.length - 1}
                onImageGenerate={onGenerateBeatImage ? (beatId) => onGenerateBeatImage(scene.id, beatId) : undefined}
                onImageRegenerate={onGenerateBeatImage ? (beatId) => onGenerateBeatImage(scene.id, beatId) : undefined}
                onVideoUpload={onUploadBeatVideo ? (beatId, videoFile) => onUploadBeatVideo(scene.id, beatId, videoFile) : undefined}
                onBeatUpdate={(beatId, updates) => {
                  // Update the specific beat within the scene
                  const updatedBeats = scene.beats!.map(b => 
                    b.id === beatId ? { ...b, ...updates } : b
                  );
                  onUpdate(scene.id, { beats: updatedBeats });
                }}
                generatingImage={generatingBeatImageFor?.sceneId === scene.id && generatingBeatImageFor?.beatId === beat.id}
              />
            ))}
          </div>
        ) : (
          <EditableText
            initialValue={scene.content}
            onSave={handleContentSave}
            placeholder="Scene content..."
            isTextarea
            className="text-slate-200 text-sm"
            inputFontSize="text-sm"
          />
        )}
      </div>
      
      {/* Text Rewrite Section */}
      {onRewriteText && (
        <div className="p-2 border-t border-slate-600 relative">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Rewrite text:</span>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRewriteDropdown(!showRewriteDropdown);
                }}
                disabled={rewritingTextForScene === scene.id}
                className={`px-3 py-1 text-xs rounded transition-colors focus:outline-none focus:ring-2 ${
                  rewritingTextForScene === scene.id
                    ? 'bg-indigo-400 text-white cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-indigo-400'
                }`}
              >
                {rewritingTextForScene === scene.id ? (
                  <span className="flex items-center space-x-1">
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Rewriting...</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Choose Level</span>
                  </span>
                )}
              </button>
              
              {showRewriteDropdown && (
                <div className="absolute right-0 mt-1 w-32 bg-slate-700 border border-slate-600 rounded-md shadow-lg z-50">
                  {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as LanguageLevel[]).map((level) => (
                    <button
                      key={level}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowRewriteDropdown(false);
                        onRewriteText(scene.id, level);
                      }}
                      className="block w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-600 transition-colors"
                    >
                      {level} Level
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Beat Subdivision Section */}
      {onSubdivideIntoBeats && !scene.isSubdivided && (
        <div className="p-2 border-t border-slate-600">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Subdivide into beats:</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSubdivideIntoBeats(scene.id);
              }}
              disabled={subdividingSceneIntoBeats === scene.id}
              className={`px-3 py-1 text-xs rounded transition-colors focus:outline-none focus:ring-2 ${
                subdividingSceneIntoBeats === scene.id
                  ? 'bg-purple-400 text-white cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-500 text-white focus:ring-purple-400'
              }`}
              title={subdividingSceneIntoBeats === scene.id ? "Creating beats..." : "Subdivide this scene into narrative beats"}
            >
              {subdividingSceneIntoBeats === scene.id ? (
                <span className="flex items-center space-x-1">
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Creating beats...</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Create Beats</span>
                </span>
              )}
            </button>
          </div>
        </div>
      )}
      
      {scene.generatedImagePrompt && (
        <div className="generated-prompt-display p-2 border-t border-slate-600 bg-slate-750">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-purple-300 font-semibold mb-0">Suggested Image Prompt:</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isEditingPrompt) {
                  // Save the edited prompt
                  console.log('Saving prompt:', editedPrompt);
                  onUpdate(scene.id, { generatedImagePrompt: editedPrompt });
                  setIsEditingPrompt(false);
                } else {
                  // Start editing
                  setEditedPrompt(scene.generatedImagePrompt || '');
                  setIsEditingPrompt(true);
                }
              }}
              className={`text-xs px-2 py-1 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-purple-400 ${
                isEditingPrompt 
                  ? 'bg-green-600 hover:bg-green-500 text-white' 
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
              title={isEditingPrompt ? 'Save changes' : 'Edit prompt'}
            >
              {isEditingPrompt ? (
                <span className="flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit</span>
                </span>
              )}
            </button>
          </div>
          {isEditingPrompt ? (
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && e.ctrlKey) {
                  // Ctrl+Enter to save
                  console.log('Saving prompt via Ctrl+Enter:', editedPrompt);
                  onUpdate(scene.id, { generatedImagePrompt: editedPrompt });
                  setIsEditingPrompt(false);
                } else if (e.key === 'Escape') {
                  // Escape to cancel
                  setEditedPrompt(scene.generatedImagePrompt || '');
                  setIsEditingPrompt(false);
                }
              }}
              className="w-full text-xs text-purple-200 bg-slate-700 border border-slate-500 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400 resize-none"
              rows={3}
              placeholder="Enter image prompt..."
            />
          ) : (
            <p className="text-xs text-purple-200 italic whitespace-pre-wrap break-words">
              {scene.generatedImagePrompt}
            </p>
          )}
          {isEditingPrompt && (
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-slate-400">Ctrl+Enter to save, Escape to cancel</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditedPrompt(scene.generatedImagePrompt || '');
                  setIsEditingPrompt(false);
                }}
                className="text-xs px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-300 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-slate-400"
                title="Cancel editing"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {scene.generatedImageId && (
        <div className="generated-image-display p-2 border-t border-slate-600 bg-slate-750">
          <p className="text-xs text-orange-300 font-semibold mb-1">Generated Scene Image:</p>
          <div className="relative">
            {imageLoading ? (
              <div className="w-full h-32 bg-slate-600 rounded-md border border-slate-500 flex items-center justify-center">
                <span className="text-slate-400 text-sm">Loading image...</span>
              </div>
            ) : storedImage ? (
              <img 
                src={storedImage} 
                alt="Generated scene illustration"
                className="w-full h-auto rounded-md border border-slate-500"
                style={{ maxHeight: '200px', objectFit: 'contain' }}
              />
            ) : (
              <div className="w-full h-32 bg-slate-600 rounded-md border border-slate-500 flex items-center justify-center">
                <span className="text-slate-400 text-sm">Failed to load image</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {(scene.detectedCharacters?.length || scene.settingContext || editingCharacters) && (
        <div className="character-analysis-display p-2 border-t border-slate-600 bg-slate-700">
          {(scene.detectedCharacters?.length || editingCharacters) && (
            <div className="mb-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-blue-300 font-semibold">Characters in Scene:</p>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!editingCharacters) {
                        setTempCharacters(scene.detectedCharacters || []);
                        setEditingCharacters(true);
                      }
                    }}
                    className="text-xs px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Add Character
                  </button>
                  {(scene.detectedCharacters?.length || editingCharacters) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (editingCharacters) {
                          // Save changes
                          onUpdate(scene.id, { 
                            detectedCharacters: tempCharacters.length > 0 ? tempCharacters : undefined 
                          });
                          setEditingCharacters(false);
                          setNewCharacterName('');
                        } else {
                          setTempCharacters(scene.detectedCharacters || []);
                          setEditingCharacters(true);
                        }
                      }}
                      className="text-xs px-2 py-0.5 bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors"
                    >
                      {editingCharacters ? 'Save' : 'Edit'}
                    </button>
                  )}
                </div>
              </div>
              
              {editingCharacters ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {tempCharacters.map((character, index) => (
                      <div key={index} className="flex items-center bg-blue-600 text-blue-100 px-2 py-1 rounded text-xs">
                        <span>{character}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTempCharacters(tempCharacters.filter((_, i) => i !== index));
                          }}
                          className="ml-1 text-blue-200 hover:text-white"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCharacterName}
                      onChange={(e) => {
                        e.stopPropagation();
                        setNewCharacterName(e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newCharacterName.trim()) {
                          e.stopPropagation();
                          setTempCharacters([...tempCharacters, newCharacterName.trim()]);
                          setNewCharacterName('');
                        }
                      }}
                      className="flex-1 p-1 text-xs bg-slate-600 text-blue-200 border border-blue-400 rounded"
                      placeholder="Add character name..."
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (newCharacterName.trim()) {
                          setTempCharacters([...tempCharacters, newCharacterName.trim()]);
                          setNewCharacterName('');
                        }
                      }}
                      className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {scene.detectedCharacters?.map((character, index) => (
                    <span key={index} className="text-xs bg-blue-600 text-blue-100 px-1.5 py-0.5 rounded">
                      {character}
                    </span>
                  ))}
                  {(!scene.detectedCharacters?.length) && (
                    <span className="text-xs text-blue-300 italic">Click "Add Character" to tag characters in this scene</span>
                  )}
                </div>
              )}
            </div>
          )}
          {scene.settingContext && (
            <div>
              <p className="text-xs text-green-300 font-semibold mb-0.5">Setting Context:</p>
              <p className="text-xs text-green-200 italic">
                {scene.settingContext}
              </p>
            </div>
          )}
        </div>
      )}
      
      <div className="p-2 border-t border-slate-600 space-y-2">
        <div className="text-xs text-slate-400 mb-1">Options:</div>
        {outgoingConnections.length > 0 && (
          <ul className="space-y-1.5 max-h-32 overflow-y-auto pr-1 choice-list">
            {outgoingConnections.map(conn => (
              <li key={conn.id} className="choice-item flex items-center group bg-slate-600 p-1.5 rounded-md">
                <EditableText
                  initialValue={conn.label}
                  onSave={(newLabel) => onUpdateConnectionLabel(conn.id, newLabel)}
                  placeholder="Choice text..."
                  className="text-slate-100 text-xs flex-grow mr-1"
                  inputClassName="text-xs bg-slate-500"
                />
                <button
                  onClick={() => { if (window.confirm(`Delete choice: "${conn.label}"?`)) onDeleteConnection(conn.id); }}
                  className="p-0.5 text-red-400 hover:text-red-300 opacity-50 group-hover:opacity-100 transition-opacity"
                  title="Delete choice"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M2.22 2.22a.75.75 0 0 1 1.06 0L8 6.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L9.06 8l4.72 4.72a.75.75 0 1 1-1.06 1.06L8 9.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L6.94 8 2.22 3.28a.75.75 0 0 1 0-1.06Z" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
        {isAddingNewChoice ? (
          <div className="add-choice-input-area flex items-center space-x-1.5 p-1 bg-slate-600 rounded-md">
            <input
              ref={newChoiceInputRef}
              type="text"
              value={newChoiceInputText}
              onChange={(e) => setNewChoiceInputText(e.target.value)}
              onKeyDown={handleNewChoiceKeyDown}
              placeholder="Enter new choice text..."
              className="flex-grow p-1 text-xs bg-slate-500 text-slate-50 border border-slate-400 rounded"
            />
            <button onClick={handleSaveNewChoice} className="p-1 text-green-400 hover:text-green-300" title="Save choice">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.35 2.35 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
              </svg>
            </button>
            <button onClick={handleAddNewChoiceToggle} className="p-1 text-red-400 hover:text-red-300" title="Cancel">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                 <path d="M2.22 2.22a.75.75 0 0 1 1.06 0L8 6.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L9.06 8l4.72 4.72a.75.75 0 1 1-1.06 1.06L8 9.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L6.94 8 2.22 3.28a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={handleAddNewChoiceToggle}
              className="flex-1 py-1.5 px-2 text-xs bg-green-600 hover:bg-green-500 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 flex items-center justify-center space-x-1"
              title="Add a new choice branching from this scene"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5V3.75Z" />
              </svg>
              <span>Add Option</span>
            </button>
          </div>
        )}
      </div>

      {/* AI Generation Section */}
      {(onContinueWithAI || onContinueWithAI2Options || onContinueWithAI3Options) && (
        <div className="p-2 border-t border-slate-600">
          <div className="text-xs text-slate-300 mb-2 font-medium">AI Story Generation:</div>
          <div className="flex space-x-1">
            {onContinueWithAI && (
              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  console.log('[SceneBlock] AI Continue button clicked for scene:', scene.id);
                  onContinueWithAI(scene.id); 
                }}
                className={`flex-1 py-1.5 px-2 text-xs text-white rounded-md transition-colors focus:outline-none focus:ring-2 flex items-center justify-center space-x-1 ${
                  generatingContinuationForScene === scene.id 
                    ? 'bg-purple-400 cursor-not-allowed focus:ring-purple-300' 
                    : 'bg-purple-600 hover:bg-purple-500 focus:ring-purple-400'
                }`}
                title={generatingContinuationForScene === scene.id ? "Generating continuation..." : "Continue story with AI (single path)"}
                disabled={generatingContinuationForScene === scene.id}
              >
                {generatingContinuationForScene === scene.id ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs">Gen...</span>
                  </span>
                ) : (
                  <span className="text-xs">Continue</span>
                )}
              </button>
            )}
            {onContinueWithAI2Options && (
              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  console.log('[SceneBlock] AI 2 Options button clicked for scene:', scene.id);
                  onContinueWithAI2Options(scene.id); 
                }}
                className={`flex-1 py-1.5 px-2 text-xs text-white rounded-md transition-colors focus:outline-none focus:ring-2 flex items-center justify-center space-x-1 ${
                  generatingContinuationForScene === scene.id 
                    ? 'bg-pink-400 cursor-not-allowed focus:ring-pink-300' 
                    : 'bg-pink-600 hover:bg-pink-500 focus:ring-pink-400'
                }`}
                title={generatingContinuationForScene === scene.id ? "Generating continuation..." : "Continue with AI + 2 choices"}
                disabled={generatingContinuationForScene === scene.id}
              >
                {generatingContinuationForScene === scene.id ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs">Gen...</span>
                  </span>
                ) : (
                  <span className="text-xs">+2 Options</span>
                )}
              </button>
            )}
            {onContinueWithAI3Options && (
              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  console.log('[SceneBlock] AI 3 Options button clicked for scene:', scene.id);
                  onContinueWithAI3Options(scene.id); 
                }}
                className={`flex-1 py-1.5 px-2 text-xs text-white rounded-md transition-colors focus:outline-none focus:ring-2 flex items-center justify-center space-x-1 ${
                  generatingContinuationForScene === scene.id 
                    ? 'bg-orange-400 cursor-not-allowed focus:ring-orange-300' 
                    : 'bg-orange-600 hover:bg-orange-500 focus:ring-orange-400'
                }`}
                title={generatingContinuationForScene === scene.id ? "Generating continuation..." : "Continue with AI + 3 choices"}
                disabled={generatingContinuationForScene === scene.id}
              >
                {generatingContinuationForScene === scene.id ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs">Gen...</span>
                  </span>
                ) : (
                  <span className="text-xs">+3 Options</span>
                )}
              </button>
            )}
          </div>
        </div>
      )}
      
      {(onAddOneOption || onAddTwoOptions || onAddMultipleOptions || onGenerateSceneImage) && (
        <div className="p-2 border-t border-slate-600 flex space-x-2 justify-around items-center mt-1">
          {onAddOneOption && (
             <button
              onClick={(e) => { e.stopPropagation(); onAddOneOption(scene.id); }}
              className={`${commonActionButtonClass} bg-indigo-600 hover:bg-indigo-500 ring-indigo-400`}
              title="Automatically add one generic choice"
            >
              +1 Opt
            </button>
          )}
          {onAddTwoOptions && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddTwoOptions(scene.id);}}
              className={`${commonActionButtonClass} bg-sky-600 hover:bg-sky-500 ring-sky-400`}
              title="Automatically add two generic choices"
            >
              +2 Opts
            </button>
          )}
          {onAddMultipleOptions && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddMultipleOptions(scene.id);}}
              className={`${commonActionButtonClass} bg-teal-600 hover:bg-teal-500 ring-teal-400`}
              title="Automatically add three generic choices"
            >
              +3 Opts
            </button>
          )}
          {onGenerateSceneImage && (
            <button
              onClick={(e) => { e.stopPropagation(); onGenerateSceneImage(scene.id);}}
              className={`${commonActionButtonClass} ${
                generatingImageForScene === scene.id 
                  ? 'bg-orange-400 cursor-not-allowed' 
                  : 'bg-orange-600 hover:bg-orange-500'
              } ring-orange-400`}
              title={generatingImageForScene === scene.id ? "Generating image..." : "Generate image for this scene"}
              disabled={generatingImageForScene === scene.id}
            >
              {generatingImageForScene === scene.id ? (
                <span className="flex items-center">
                  Generating
                  <span className="ml-1 flex">
                    <span className="loading-dot">.</span>
                    <span className="loading-dot">.</span>
                    <span className="loading-dot">.</span>
                  </span>
                </span>
              ) : (
                'Generate Image'
              )}
            </button>
          )}
        </div>
      )}

      <div
        className="connection-port absolute right-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-sky-500 rounded-full border-2 border-slate-900 hover:bg-sky-400 cursor-crosshair z-30"
        title="Drag to connect (alternative to inline 'Add Option')"
        onMouseDown={(e) => {
            e.stopPropagation();
            onPortMouseDown(e, scene.id, e.currentTarget as HTMLElement);
        }}
      />
       <style>{`
        .choice-list::-webkit-scrollbar { width: 6px; }
        .choice-list::-webkit-scrollbar-thumb { background-color: #4b5563; border-radius: 3px; }
        .choice-list::-webkit-scrollbar-track { background-color: #334155; }
        .bg-slate-750 { background-color: #303a4c; } /* A slightly different shade for the prompt area */
      `}</style>
    </div>
  );
};

export default SceneBlock;