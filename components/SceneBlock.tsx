import React, { useState, useRef, useEffect } from 'react';
import type { Scene, Connection } from '../types';
import EditableText from './EditableText';
import { DEFAULT_SCENE_MIN_HEIGHT, DEFAULT_SCENE_WIDTH } from '../constants';
import { getImageFromStorage } from '../fileStorageService';

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
}) => {
  const [isAddingNewChoice, setIsAddingNewChoice] = useState(false);
  const [newChoiceInputText, setNewChoiceInputText] = useState('');
  const newChoiceInputRef = useRef<HTMLInputElement>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [storedImage, setStoredImage] = useState<string | null>(null);

  useEffect(() => {
    const loadStoredImage = async () => {
      if (scene.generatedImageId) {
        setImageLoading(true);
        const imageData = await getImageFromStorage(scene.generatedImageId);
        setStoredImage(imageData);
        setImageLoading(false);
      } else {
        setStoredImage(null);
      }
    };
    loadStoredImage();
  }, [scene.generatedImageId]);

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
        <EditableText
          initialValue={scene.content}
          onSave={handleContentSave}
          placeholder="Scene content..."
          isTextarea
          className="text-slate-200 text-sm"
          inputFontSize="text-sm"
        />
      </div>
      
      {scene.generatedImagePrompt && (
        <div className="generated-prompt-display p-2 border-t border-slate-600 bg-slate-750">
          <p className="text-xs text-purple-300 font-semibold mb-0.5">Suggested Image Prompt:</p>
          <p className="text-xs text-purple-200 italic whitespace-pre-wrap break-words">
            {scene.generatedImagePrompt}
          </p>
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
      
      {(scene.detectedCharacters?.length || scene.settingContext) && (
        <div className="character-analysis-display p-2 border-t border-slate-600 bg-slate-700">
          {scene.detectedCharacters?.length && (
            <div className="mb-1">
              <p className="text-xs text-blue-300 font-semibold mb-0.5">Characters in Scene:</p>
              <div className="flex flex-wrap gap-1">
                {scene.detectedCharacters.map((character, index) => (
                  <span key={index} className="text-xs bg-blue-600 text-blue-100 px-1.5 py-0.5 rounded">
                    {character}
                  </span>
                ))}
              </div>
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
              className="flex-grow p-1 text-xs bg-slate-500 text-slate-50 rounded-sm border border-slate-400 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none"
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
          <button
            onClick={handleAddNewChoiceToggle}
            className="w-full py-1.5 px-2 text-xs bg-green-600 hover:bg-green-500 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 flex items-center justify-center space-x-1"
            title="Add a new choice branching from this scene"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5V3.75Z" />
            </svg>
            <span>Add Option</span>
          </button>
        )}
      </div>
      
      {(onAddOneOption || onAddTwoOptions || onAddMultipleOptions) && (
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