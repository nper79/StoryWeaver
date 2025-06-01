import React, { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import type { VoiceAssignment, ElevenLabsVoice } from '../types';
import { fetchAvailableElevenLabsVoices } from '../elevenLabsService';
import { saveCharacterImage, getImageFromStorage } from '../fileStorageService';

interface SettingsModalProps { 
  isOpen: boolean;
  onClose: () => void;
  currentAssignments: VoiceAssignment[];
  onSaveAssignments: (assignments: VoiceAssignment[]) => void;
  currentElevenLabsApiKey: string | null; // Renamed from currentApiKey
  onSetElevenLabsApiKey: (apiKey: string | null) => void; // Renamed from onSetApiKey
  currentOpenaiApiKey: string | null; // New prop for OpenAI API key
  onSetOpenaiApiKey: (apiKey: string | null) => void; // New prop for OpenAI API key
  onGenerateImagePrompts: () => Promise<void>; 
  isGeneratingPrompts: boolean; 
  characterAnalysisProgress?: number; // Progress percentage for character analysis
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen,
  onClose,
  currentAssignments,
  onSaveAssignments,
  currentElevenLabsApiKey, // Renamed
  onSetElevenLabsApiKey, // Renamed
  currentOpenaiApiKey, // New prop for OpenAI API key
  onSetOpenaiApiKey, // New prop for OpenAI API key
  onGenerateImagePrompts,
  isGeneratingPrompts,
  characterAnalysisProgress,
}) => {
  const [assignments, setAssignments] = useState<VoiceAssignment[]>([]);
  const [availableVoices, setAvailableVoices] = useState<ElevenLabsVoice[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [elevenLabsApiKeyInput, setElevenLabsApiKeyInput] = useState<string>(''); // Renamed
  const [openaiApiKeyInput, setOpenaiApiKeyInput] = useState<string>(''); // New state for OpenAI API key
  const [characterUrlInputs, setCharacterUrlInputs] = useState<Record<number, string>>({});
  // New state for storing loaded image data URLs for display
  const [characterImageUrls, setCharacterImageUrls] = useState<Record<number, string>>({});
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>({});


  useEffect(() => {
    if (isOpen) {
      const initialAssignments = currentAssignments.map(a => ({ ...a }));
      setAssignments(initialAssignments);
      setElevenLabsApiKeyInput(currentElevenLabsApiKey || ''); // Updated
      setOpenaiApiKeyInput(currentOpenaiApiKey || ''); // New state for OpenAI API key
      
      // Initialize empty URL inputs
      const initialUrlInputs: Record<number, string> = {};
      initialAssignments.forEach((_, idx) => {
        initialUrlInputs[idx] = '';
      });
      setCharacterUrlInputs(initialUrlInputs);
      
      // Load images from IndexedDB
      const newLoadingImages: Record<number, boolean> = {};
      const loadImages = async () => {
        for (let i = 0; i < initialAssignments.length; i++) {
          const assignment = initialAssignments[i];
          if (assignment.imageId) {
            newLoadingImages[i] = true;
            try {
              const imageUrl = await getImageFromStorage(assignment.imageId);
              if (imageUrl) {
                setCharacterImageUrls(prev => ({
                  ...prev,
                  [i]: imageUrl
                }));
              }
            } catch (error) {
              console.error(`Error loading image for ${assignment.characterName}:`, error);
            } finally {
              newLoadingImages[i] = false;
            }
          }
        }
        setLoadingImages(newLoadingImages);
      };
      
      loadImages();
    }
  }, [isOpen, currentAssignments, currentElevenLabsApiKey, currentOpenaiApiKey]); // Removed currentGeminiApiKey

  useEffect(() => {
    setElevenLabsApiKeyInput(currentElevenLabsApiKey || ''); // Updated
    setOpenaiApiKeyInput(currentOpenaiApiKey || ''); // New state for OpenAI API key
  }, [currentElevenLabsApiKey, currentOpenaiApiKey]);

  const loadVoices = useCallback(async (apiKeyToUse: string | null) => {
    if (!apiKeyToUse) {
      setError("Please set your ElevenLabs API Key to load voices.");
      setAvailableVoices([]);
      setIsLoadingVoices(false);
      return;
    }
    
    setIsLoadingVoices(true);
    setError(null);
    try {
      const voices = await fetchAvailableElevenLabsVoices(apiKeyToUse);
      setAvailableVoices(voices);
      if (voices.length === 0) {
        setError("No voices found. Check your ElevenLabs account or API key permissions.");
      }
    } catch (err) {
      console.error("Error in modal loading voices", err);
      setError((err as Error).message || 'Failed to load voices. Check the key and network.');
      setAvailableVoices([]);
    } finally {
      setIsLoadingVoices(false);
    }
  }, []); 

  useEffect(() => {
    if (isOpen) {
      if (currentElevenLabsApiKey) { // Updated
        loadVoices(currentElevenLabsApiKey); // Updated
      } else {
        setAvailableVoices([]);
        setError(null); 
      }
    }
  }, [isOpen, currentElevenLabsApiKey, loadVoices]); // Updated


  const handleSetElevenLabsKeyAndLoad = () => { // Renamed
    const trimmedKey = elevenLabsApiKeyInput.trim();
    onSetElevenLabsApiKey(trimmedKey || null); // Updated 
    if (!trimmedKey) {
        setAvailableVoices([]);
        setError("ElevenLabs API Key cannot be empty if you intend to use it.");
    }
  };

  const handleSetOpenaiKey = () => { // New function for OpenAI API key
    const trimmedKey = openaiApiKeyInput.trim();
    onSetOpenaiApiKey(trimmedKey || null); // New prop for OpenAI API key
  };

  const handleAddCharacter = () => {
    if (!currentElevenLabsApiKey) { // Updated
        alert("Please set your ElevenLabs API Key and load voices before adding characters.");
        return;
    }
    if (newCharacterName.trim() && !assignments.find(a => a.characterName.toLowerCase() === newCharacterName.trim().toLowerCase())) {
      const newIndex = assignments.length;
      setAssignments([...assignments, { characterName: newCharacterName.trim(), voiceId: '', imageId: undefined }]);
      setCharacterUrlInputs(prev => ({...prev, [newIndex]: ''}));
      setNewCharacterName('');
    } else if (newCharacterName.trim()) {
        alert("Character name already exists.");
    }
  };

  const handleCharacterNameChange = (index: number, name: string) => {
    const updated = assignments.map((a, i) => i === index ? { ...a, characterName: name } : a);
    setAssignments(updated);
  };
  
  const handleVoiceChange = (index: number, voiceId: string) => {
    const updated = assignments.map((a, i) => i === index ? { ...a, voiceId: voiceId } : a);
    setAssignments(updated);
  };

  const handleDeleteCharacter = (index: number) => {
    setAssignments(assignments.filter((_, i) => i !== index));
    setCharacterUrlInputs(prev => {
        const newInputs = {...prev};
        delete newInputs[index];
        return newInputs;
    });
  };

  const handleImageUpload = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { 
        alert("Image is too large. Please choose an image under 10MB.");
        event.target.value = ''; 
        return;
      }
      
      // Get the character information
      const character = assignments[index];
      if (!character) {
        alert("Character not found.");
        event.target.value = '';
        return;
      }
      
      // Set loading state for this character's image
      setLoadingImages(prev => ({ ...prev, [index]: true }));
      
      // Create a canvas to compress the image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = async () => {
        // Set maximum dimensions for compression
        const maxWidth = 300;
        const maxHeight = 300;
        let { width, height } = img;
        
        // Calculate new dimensions maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress the image
        ctx?.drawImage(img, 0, 0, width, height);
        
        try {
          // Convert canvas to blob
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob(blob => {
              if (blob) resolve(blob);
              else throw new Error("Failed to convert to blob");
            }, 'image/jpeg', 0.7); // 70% quality
          });
          
          // Save to IndexedDB and get ID
          const imageId = await saveCharacterImage(blob, character.characterName);
          
          if (imageId) {
            // Update assignments with the new image ID
            const updated = assignments.map((a, i) => i === index ? { ...a, imageId } : a);
            setAssignments(updated);
            
            // Update UI
            setCharacterUrlInputs(prev => ({...prev, [index]: ''}));
            
            // Convert blob to data URL for display
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result as string;
              setCharacterImageUrls(prev => ({ ...prev, [index]: base64data }));
            };
            reader.readAsDataURL(blob);
          }
        } catch (error) {
          console.error("Error saving compressed image:", error);
          alert("Error saving image. Please try again.");
        } finally {
          setLoadingImages(prev => ({ ...prev, [index]: false }));
        }
      };
      
      img.onerror = () => {
        alert("Error loading image. Please try a different file.");
        setLoadingImages(prev => ({ ...prev, [index]: false }));
      };
      
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.error) {
          console.error("FileReader error:", reader.error);
          alert("Error reading file. Please try again.");
          setLoadingImages(prev => ({ ...prev, [index]: false }));
          return;
        }
        if (typeof reader.result === 'string') {
          img.src = reader.result;
        }
      };
      reader.onerror = () => { 
          console.error("FileReader.onerror:", reader.error);
          alert("Error reading file. Please try again. Check console for details.");
          setLoadingImages(prev => ({ ...prev, [index]: false }));
      };
      reader.readAsDataURL(file);
      event.target.value = ''; 
    }
  };
  
  const handleImageUrlInputChange = async (index: number, url: string) => {
    setCharacterUrlInputs(prev => ({...prev, [index]: url}));
    
    // Only process external URLs
    if (url.trim().toLowerCase().startsWith('http')) {
      // Set loading state
      setLoadingImages(prev => ({ ...prev, [index]: true }));
      
      try {
        // Get the character
        const character = assignments[index];
        if (!character) return;
        
        // Fetch the image from URL
        const response = await fetch(url.trim());
        if (!response.ok) {
          console.error('Failed to fetch image:', response.statusText);
          return;
        }
        
        // Get the image as a blob
        const blob = await response.blob();
        
        // Save to IndexedDB
        const imageId = await saveCharacterImage(blob, character.characterName);
        if (imageId) {
          // Update assignments
          const updated = assignments.map((a, i) => i === index ? { ...a, imageId } : a);
          setAssignments(updated);
          
          // Convert blob to data URL for display
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            setCharacterImageUrls(prev => ({ ...prev, [index]: base64data }));
          };
          reader.readAsDataURL(blob);
        }
      } catch (error) {
        console.error('Error processing image URL:', error);
        setError('Error processing image URL');
      } finally {
        setLoadingImages(prev => ({ ...prev, [index]: false }));
      }
    } else if (!url.trim()) { 
      // Handle clearing the URL input
      const updated = assignments.map((a, i) => {
        if (i === index && a.imageId) {
          return { ...a, imageId: undefined };
        }
        return a;
      });
      setAssignments(updated);
      setCharacterImageUrls(prev => {
        const newUrls = {...prev};
        delete newUrls[index];
        return newUrls;
      });
    }
  };

  const handleRemoveImage = (index: number) => {
    // Update assignments to remove the image ID
    const updated = assignments.map((a, i) => i === index ? { ...a, imageId: undefined } : a);
    setAssignments(updated);
    
    // Clear the URL input and image preview
    setCharacterUrlInputs(prev => ({...prev, [index]: ''}));
    setCharacterImageUrls(prev => {
      const newUrls = {...prev};
      delete newUrls[index];
      return newUrls;
    });
  };

  const handleSaveSettings = () => { 
    // Only keep assignments with non-empty character names
    const validAssignments = assignments.filter(a => a.characterName.trim() !== '');
    
    // Save assignments
    onSaveAssignments(validAssignments);
    
    // Note: API keys are set immediately via their respective "Set Key" buttons.
    onClose();
  };

  const handleGeneratePromptsClick = async () => {
    if (window.confirm("This will generate image prompts for ALL scenes using the OpenAI API. This may take some time and consume API quota. Continue?")) {
        await onGenerateImagePrompts();
    }
  };
  
  const CharacterInputRow: React.FC<{index: number, assignment: VoiceAssignment}> = ({index, assignment}) => {
    const isNarrator = assignment.characterName.trim().toLowerCase() === 'narrator';
    const uniqueFileId = `file-upload-${index}-${assignment.characterName.replace(/\s+/g, '-')}`;
    const isLoading = loadingImages[index] || false;
    const imageUrl = characterImageUrls[index];

    return (
     <div key={`char-input-row-${index}`} className="mb-3 p-3 bg-slate-700 rounded-md space-y-3">
        <div className="flex items-center space-x-2">
            <input
                type="text"
                value={assignment.characterName}
                onChange={(e) => handleCharacterNameChange(index, e.target.value)}
                placeholder="Character Name (e.g., Narrator)"
                className="flex-grow p-2 border border-slate-500 rounded bg-slate-600 text-slate-100 focus:ring-sky-500 focus:border-sky-500"
                disabled={!currentElevenLabsApiKey || isLoadingVoices || isGeneratingPrompts} // Updated
            />
            <select
                value={assignment.voiceId}
                onChange={(e) => handleVoiceChange(index, e.target.value)}
                className="p-2 border border-slate-500 rounded bg-slate-600 text-slate-100 focus:ring-sky-500 focus:border-sky-500"
                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em'}}
                disabled={!currentElevenLabsApiKey || availableVoices.length === 0 || isLoadingVoices || isGeneratingPrompts} // Updated
            >
                <option value="">
                    {!currentElevenLabsApiKey ? "Set API Key First" : // Updated
                    isLoadingVoices ? "Loading voices..." : 
                    (availableVoices.length === 0 && error ? "No voices (Error)" : 
                    (availableVoices.length === 0 ? "No voices available" : "Select Voice"))}
                </option>
                {availableVoices.map(voice => (
                <option key={voice.voice_id} value={voice.voice_id}>
                    {voice.name} ({voice.labels?.accent ? `${voice.labels.accent}, ` : ''}{voice.category || 'standard'})
                </option>
                ))}
            </select>
            <button
                onClick={() => handleDeleteCharacter(index)}
                className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-xs shrink-0"
                title="Delete Character"
                disabled={!currentElevenLabsApiKey || isLoadingVoices || isGeneratingPrompts} // Updated
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        {!isNarrator && currentElevenLabsApiKey && ( // Updated
          <div className="flex items-center space-x-2 pl-1">
            <div className="w-12 h-12 rounded bg-slate-600 flex items-center justify-center text-slate-400 text-xs border border-slate-500 shrink-0">
                {imageUrl ? (
                    <img src={imageUrl} alt={`${assignment.characterName} preview`} className="w-full h-full rounded object-cover"/>
                ) : isLoading ? (
                    <span className="animate-pulse">Loading</span>
                ) : (
                    "No Img"
                )}
            </div>
            <label htmlFor={uniqueFileId} className={`px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs cursor-pointer transition-colors whitespace-nowrap shrink-0 ${isGeneratingPrompts ? 'opacity-50 cursor-not-allowed' : ''}`}>
                Upload Img
            </label>
            <input 
                id={uniqueFileId}
                type="file" 
                accept="image/png, image/jpeg, image/webp, image/gif" 
                onChange={(e) => handleImageUpload(index, e)} 
                className="hidden" 
                disabled={isLoadingVoices || isGeneratingPrompts}
            />
            <input
                type="text"
                placeholder="Or paste image URL"
                value={characterUrlInputs[index] || ''}
                onChange={(e) => handleImageUrlInputChange(index, e.target.value)}
                className="flex-grow p-1.5 border border-slate-500 rounded bg-slate-600 text-slate-100 focus:ring-sky-500 focus:border-sky-500 text-xs"
                disabled={isLoadingVoices || isGeneratingPrompts}
            />
            {imageUrl && (
              <button 
                onClick={() => handleRemoveImage(index)} 
                className={`px-3 py-1.5 rounded bg-yellow-600 hover:bg-yellow-500 text-white text-xs transition-colors whitespace-nowrap shrink-0 ${isGeneratingPrompts ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isLoadingVoices || isGeneratingPrompts}
              >
                Remove Img
              </button>
            )}
          </div>
        )}
    </div>
  )};

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings"> 
      <div className="space-y-4 text-sm">
        {/* Section for ElevenLabs API Key and Character/Voice Settings */}
        <details className="bg-slate-750 p-3 rounded-md group" open>
            <summary className="text-md font-semibold text-sky-300 cursor-pointer group-hover:text-sky-200 list-none flex justify-between items-center">
                <span>Character Voice & Image Settings (ElevenLabs)</span>
                <span className="text-xs text-slate-400 group-open:rotate-90 transform transition-transform duration-200">&#9656;</span>
            </summary>
            <div className="mt-3 space-y-3">
                <div className="p-3 bg-slate-700 rounded-md space-y-2">
                    <label htmlFor="elevenLabsApiKeyInput" className="block text-sm font-medium text-sky-300">
                        ElevenLabs API Key (for Text-to-Speech)
                    </label>
                    <div className="flex items-center space-x-2">
                        <input
                            id="elevenLabsApiKeyInput"
                            type="password" 
                            value={elevenLabsApiKeyInput} // Updated
                            onChange={(e) => setElevenLabsApiKeyInput(e.target.value)} // Updated
                            placeholder="Enter your ElevenLabs API Key"
                            className="flex-grow p-2 border border-slate-500 rounded bg-slate-600 text-slate-100 focus:ring-sky-500 focus:border-sky-500"
                            disabled={isGeneratingPrompts}
                        />
                        <button
                            onClick={handleSetElevenLabsKeyAndLoad} // Renamed
                            className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white transition-colors text-xs whitespace-nowrap"
                            disabled={isGeneratingPrompts}
                        >
                            Set Key & Load Voices
                        </button>
                    </div>
                    {!currentElevenLabsApiKey && elevenLabsApiKeyInput === '' && <p className="text-xs text-yellow-400 pt-1">Your ElevenLabs API key is required for voice/image features. It will be stored locally in your browser.</p>}
                </div>

                <div className="p-3 bg-slate-700 rounded-md space-y-2">
                    <label htmlFor="openaiApiKeyInput" className="block text-sm font-medium text-sky-300">
                        OpenAI API Key (for Image Generation)
                    </label>
                    {currentOpenaiApiKey ? (
                        <div className="p-2 bg-green-800 text-green-100 rounded">
                            ✓ OpenAI API Key loaded from environment (.env file)
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center space-x-2">
                                <input
                                    id="openaiApiKeyInput"
                                    type="password" 
                                    value={openaiApiKeyInput} // New state for OpenAI API key
                                    onChange={(e) => setOpenaiApiKeyInput(e.target.value)} // New state for OpenAI API key
                                    placeholder="Enter your OpenAI API Key"
                                    className="flex-grow p-2 border border-slate-500 rounded bg-slate-600 text-slate-100 focus:ring-sky-500 focus:border-sky-500"
                                    disabled={isGeneratingPrompts}
                                />
                                <button
                                    onClick={handleSetOpenaiKey} // New function for OpenAI API key
                                    className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white transition-colors text-xs whitespace-nowrap"
                                    disabled={isGeneratingPrompts}
                                >
                                    Set Key
                                </button>
                            </div>
                            <p className="text-xs text-yellow-400 pt-1">Your OpenAI API key is required for image generation features. It will be stored locally in your browser.</p>
                        </div>
                    )}
                </div>

                {error && (
                <div className="p-3 bg-red-800 text-red-100 rounded-md">
                    <strong>Error:</strong> {error}
                    {currentElevenLabsApiKey && <button onClick={() => loadVoices(currentElevenLabsApiKey)} className="ml-2 underline text-xs" disabled={isGeneratingPrompts}>Retry Load Voices</button>}
                </div>
                )}
                {isLoadingVoices && <p className="text-slate-300 p-2 text-center">🔊 Loading available voices...</p>}
                
                <div className={`max-h-60 overflow-y-auto pr-1 space-y-1 ${(!currentElevenLabsApiKey || isLoadingVoices || isGeneratingPrompts) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {assignments.length > 0 ? assignments.map((assignment, index) => (
                        <CharacterInputRow key={`char-assign-${index}-${assignment.characterName}`} index={index} assignment={assignment} />
                    )) : <p className="text-slate-400 italic p-2">{currentElevenLabsApiKey ? 'No characters defined yet. Add one below.' : 'Set ElevenLabs API key and load voices to manage characters.'}</p>}
                </div>

                <div className={`flex items-center space-x-2 pt-2 border-t border-slate-600 ${(!currentElevenLabsApiKey || isLoadingVoices || isGeneratingPrompts) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input
                    type="text"
                    value={newCharacterName}
                    onChange={(e) => setNewCharacterName(e.target.value)}
                    placeholder="New Character Name"
                    className="flex-grow p-2 border border-slate-500 rounded bg-slate-600 text-slate-100 focus:ring-sky-500 focus:border-sky-500"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddCharacter();}}
                    disabled={!currentElevenLabsApiKey || isLoadingVoices || isGeneratingPrompts}
                />
                <button
                    onClick={handleAddCharacter}
                    className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white transition-colors"
                    disabled={!currentElevenLabsApiKey || isLoadingVoices || !newCharacterName.trim() || isGeneratingPrompts}
                >
                    Add Character
                </button>
                </div>
                
                <p className="text-xs text-slate-400 mt-1">
                    Define character names exactly as they appear before a colon in your scene content (e.g., "Narrator", "Michael", "Anna"). Assign a voice and optionally an image (max 5MB, except for "Narrator"). Use upload or paste a direct image URL.
                </p>
            </div>
        </details>

        {/* Section for Image Prompt Generation */}
        <details className="bg-slate-750 p-3 rounded-md group" open>
            <summary className="text-md font-semibold text-purple-300 cursor-pointer group-hover:text-purple-200 list-none flex justify-between items-center">
                <span>AI Image Prompt Generation (OpenAI)</span>
                <span className="text-xs text-slate-400 group-open:rotate-90 transform transition-transform duration-200">&#9656;</span>
            </summary>
            <div className="mt-3 space-y-3">
                 <button
                    onClick={handleGeneratePromptsClick}
                    className="w-full px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isGeneratingPrompts}
                >
                    {isGeneratingPrompts ? (
                        <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating Prompts...
                        </span>
                    ) : (
                        "Generate Image Prompts for All Scenes"
                    )}
                </button>
                 {isGeneratingPrompts && <p className="text-xs text-slate-400 text-center mt-2">This may take a moment, especially for longer stories...</p>}
                 {characterAnalysisProgress !== undefined && <p className="text-xs text-slate-400 text-center mt-2">Character Analysis Progress: {characterAnalysisProgress}%</p>}
            </div>
        </details>

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-600 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-slate-600 hover:bg-slate-500 text-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSettings} 
            className="px-4 py-2 rounded bg-sky-500 hover:bg-sky-600 text-white transition-colors"
            disabled={(isLoadingVoices && !!currentElevenLabsApiKey) || isGeneratingPrompts} 
          >
            Save & Close Settings
          </button>
        </div>
      </div>
      <style>{`
        select:disabled, input:disabled, button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .bg-slate-750 { background-color: #303a4c; } 
        details > summary { list-style: none; }
        details > summary::-webkit-details-marker { display: none; } 

      `}</style>
    </Modal>
  );
};

export default SettingsModal;
