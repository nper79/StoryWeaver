import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { StoryData, Scene, Connection, VoiceAssignment } from '../types'; 
import { generateSpeech } from '../elevenLabsService';

interface PlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  story: StoryData; 
  initialSceneId: string;
  elevenLabsApiKey: string | null; 
}

interface ContentLine {
  id: string; 
  text: string;
  speaker?: string;
  voiceId?: string;
  imageUrl?: string;
  originalLine: string; 
  isSpokenLine: boolean; 
}

interface CharacterProfile {
  voiceId?: string;
  imageUrl?: string;
}

const PlayModal: React.FC<PlayModalProps> = ({ isOpen, onClose, story, initialSceneId, elevenLabsApiKey }) => {
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(initialSceneId);
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [choices, setChoices] = useState<Connection[]>([]);
  const [parsedLines, setParsedLines] = useState<ContentLine[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [showChoices, setShowChoices] = useState(false);
  const [currentSpeakerImageUrl, setCurrentSpeakerImageUrl] = useState<string | undefined>(undefined);

  const audioRef = useRef<HTMLAudioElement>(null);
  const characterProfileMap = useRef<Map<string, CharacterProfile>>(new Map());
  const speechGenerationSemaphore = useRef(true); 
  const currentAudioBlobUrlRef = useRef<string | null>(null); 

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (currentAudioBlobUrlRef.current) {
      URL.revokeObjectURL(currentAudioBlobUrlRef.current);
      currentAudioBlobUrlRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.removeAttribute('src'); 
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      characterProfileMap.current.clear();
      (story.voiceAssignments || []).forEach((va: VoiceAssignment) => {
        if (va.characterName && va.characterName.trim()) {
          characterProfileMap.current.set(va.characterName.trim(), { voiceId: va.voiceId, imageUrl: va.imageUrl });
        }
      });
      cleanupAudio(); 
      setCurrentSceneId(initialSceneId); 
      setCurrentLineIndex(0);
      setShowChoices(false);
      setParsedLines([]);
      setAudioError(null); 
      setIsAudioLoading(false); 
      speechGenerationSemaphore.current = true; 
      setCurrentSpeakerImageUrl(undefined);
    } else {
      cleanupAudio(); 
      speechGenerationSemaphore.current = true; 
      setIsAudioLoading(false);
      setCurrentSceneId(null);
      setParsedLines([]);
      setShowChoices(false);
      setCurrentSpeakerImageUrl(undefined);
    }
  }, [isOpen, initialSceneId, story.voiceAssignments, cleanupAudio]);

  useEffect(() => {
    if (!isOpen || !currentSceneId) { 
        if (!isOpen) setCurrentScene(null); 
        return;
    }
    
    const scene = story.scenes.find(s => s.id === currentSceneId);
    setCurrentScene(scene || null);
    
    if (scene) {
      const lines = scene.content.split('\n');
      const newParsedLines: ContentLine[] = lines.map((line, index) => {
        const match = line.match(/^([\w\s.-]+):\s*(.*)$/);
        let speaker, text, isSpokenLine = false, voiceId, imageUrl;
        if (match) {
          speaker = match[1].trim();
          text = match[2].trim();
          const profile = characterProfileMap.current.get(speaker);
          isSpokenLine = !!profile?.voiceId;
          if (isSpokenLine) {
            voiceId = profile!.voiceId;
          }
          // Assign imageUrl if speaker is not Narrator
          if (speaker.toLowerCase() !== 'narrator') {
            imageUrl = profile?.imageUrl;
          }
        } else {
          text = line.trim();
        }
        return { id: `line-${scene.id}-${index}`, text, speaker, originalLine: line, isSpokenLine, voiceId, imageUrl };
      });
      setParsedLines(newParsedLines);
      setCurrentLineIndex(0);
      setShowChoices(false);
      setAudioError(null); 
      setCurrentSpeakerImageUrl(undefined); // Reset speaker image on new scene
    } else { 
      setParsedLines([]);
      setChoices([]);
      setShowChoices(currentSceneId ? true : false); 
    }
    const outgoingConnections = scene ? story.connections.filter(c => c.fromSceneId === scene.id) : [];
    setChoices(outgoingConnections);

  }, [currentSceneId, story.scenes, story.connections, isOpen]);


  useEffect(() => {
    let isActive = true; 
    let timeoutId: number | undefined;

    const advanceToNextLine = () => {
      if (isActive && isOpen) {
        timeoutId = window.setTimeout(() => { // Use window.setTimeout
           if (isActive && isOpen) setCurrentLineIndex(prev => prev + 1);
        }, 50);
      }
    };

    const playAudioAsync = async (line: ContentLine) => {
      if (!isActive || !isOpen) { speechGenerationSemaphore.current = true; return; }

      if (!elevenLabsApiKey) {
        if (isActive && isOpen) {
          setAudioError("Audio disabled: ElevenLabs API Key not set.");
          setIsAudioLoading(false);
          advanceToNextLine();
        }
        return;
      }
      
      if (!speechGenerationSemaphore.current) {
        if (isActive && isOpen) {
          console.warn("Speech generation for line skipped due to concurrent request limit.");
          setAudioError("Audio loading skipped: System busy. Please wait.");
          setIsAudioLoading(false);
          advanceToNextLine();
        }
        return;
      }
      speechGenerationSemaphore.current = false;

      if (isActive && isOpen) { 
        setIsAudioLoading(true);
        setAudioError(null);
      } else {
        speechGenerationSemaphore.current = true; 
        return; 
      }
      
      let tempBlobUrlForThisAttempt: string | null = null;

      try {
        const audioBlob = await generateSpeech(elevenLabsApiKey, line.voiceId!, line.text);

        if (!isActive || !isOpen) {
          if (audioBlob) { 
            const tempUrl = URL.createObjectURL(audioBlob); 
            URL.revokeObjectURL(tempUrl);
          }
          speechGenerationSemaphore.current = true;
          return;
        }

        if (!(audioBlob instanceof Blob)) { throw new Error("Speech generation did not return a valid Blob object."); }
        if (audioBlob.size === 0) { throw new Error("Generated audio Blob is empty (0 bytes)."); }
        if (!audioBlob.type.startsWith("audio/")) {
          let errorDetails = `Expected an audio Blob, but received type: ${audioBlob.type}.`;
           try { const textContent = await audioBlob.text(); errorDetails += ` Content (first 100 chars): ${textContent.substring(0,100)}`; } catch (e) { /* ignore */ }
          throw new Error(errorDetails);
        }
        
        tempBlobUrlForThisAttempt = URL.createObjectURL(audioBlob);

        if (audioRef.current && isActive && isOpen) {
          if (currentAudioBlobUrlRef.current) {
            URL.revokeObjectURL(currentAudioBlobUrlRef.current);
          }
          currentAudioBlobUrlRef.current = tempBlobUrlForThisAttempt; 
          audioRef.current.src = currentAudioBlobUrlRef.current;
          tempBlobUrlForThisAttempt = null; 

          await audioRef.current.play();
        } else {
          if (tempBlobUrlForThisAttempt) {
            URL.revokeObjectURL(tempBlobUrlForThisAttempt);
          }
        }
      } catch (error) { 
        if (isActive && isOpen) { 
          console.error('Failed to generate/play speech:', error);
          setAudioError(`Audio Error: ${(error instanceof Error ? error.message : String(error))}`);
          setIsAudioLoading(false); 
          advanceToNextLine();
        }
        if (tempBlobUrlForThisAttempt) {
          URL.revokeObjectURL(tempBlobUrlForThisAttempt);
        }
      } finally {
         speechGenerationSemaphore.current = true;
      }
    };


    if (!isOpen || !currentScene) { 
      return () => { isActive = false; if (timeoutId) window.clearTimeout(timeoutId); }; // Use window.clearTimeout
    }
    
    if (currentLineIndex >= parsedLines.length) {
      if (parsedLines.length > 0 && isActive && isOpen) {
         setShowChoices(true);
         setIsAudioLoading(false); 
         setCurrentSpeakerImageUrl(undefined); // Clear speaker image when choices appear
      }
      return () => { isActive = false; if (timeoutId) window.clearTimeout(timeoutId); }; // Use window.clearTimeout
    }

    const line = parsedLines[currentLineIndex];
    
    // Update speaker image
    if (line.speaker && line.speaker.toLowerCase() !== 'narrator') {
        setCurrentSpeakerImageUrl(line.imageUrl);
    } else {
        setCurrentSpeakerImageUrl(undefined); // Clear for Narrator or non-spoken lines
    }


    if (line.isSpokenLine && line.voiceId && line.text) {
      playAudioAsync(line);
    } else { 
      if (isActive && isOpen) {
        setIsAudioLoading(false); 
        const delay = line.text.length > 0 ? Math.min(Math.max(line.text.length * 30, 500), 3000) : 100;
        timeoutId = window.setTimeout(advanceToNextLine, delay); // Use window.setTimeout
      }
    }
    
    return () => {
      isActive = false; 
      if (timeoutId) window.clearTimeout(timeoutId); // Use window.clearTimeout
      if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
      }
      setIsAudioLoading(false); 
    };
  }, [currentLineIndex, parsedLines, isOpen, elevenLabsApiKey, currentScene]);

  const handleAudioEnded = useCallback(() => {
    if (!isOpen) return; 
    setIsAudioLoading(false);
    
    if (audioRef.current && audioRef.current.currentSrc === currentAudioBlobUrlRef.current && currentAudioBlobUrlRef.current) {
        URL.revokeObjectURL(currentAudioBlobUrlRef.current);
        currentAudioBlobUrlRef.current = null;
        audioRef.current.removeAttribute('src'); 
    }
    if (isOpen) { 
        setCurrentLineIndex(prev => prev + 1);
    }
  }, [isOpen]); 
  
  const handleAudioError = useCallback((e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    if (!isOpen) return;

    setIsAudioLoading(false);
    const targetElement = e.nativeEvent.target as HTMLAudioElement;
    const mediaError = targetElement?.error;
    let errorMessage = "Audio playback error.";

    if (mediaError) {
        const baseMessage = `HTMLAudioElement error - Code: ${mediaError.code}, Message: "${mediaError.message || 'Not available'}"`;
        console.error(baseMessage + `. Current src: ${targetElement.currentSrc || 'N/A'}`);
        
        switch (mediaError.code) {
            case MediaError.MEDIA_ERR_ABORTED: errorMessage = "Playback aborted."; break;
            case MediaError.MEDIA_ERR_NETWORK: errorMessage = "Network error during playback."; break;
            case MediaError.MEDIA_ERR_DECODE: errorMessage = "Error decoding audio."; break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage = `Audio format/source not supported.`;
                if (!targetElement.currentSrc || targetElement.currentSrc === window.location.href) {
                    errorMessage += " (Source was empty or invalid).";
                }
                break;
            default: errorMessage = `Unknown playback error (Code: ${mediaError.code})`;
        }
    } else {
        console.error(`HTMLAudioElement: Unknown playback error. Event:`, e);
    }
    
    if (isOpen) setAudioError(prev => prev || errorMessage); 

    if (audioRef.current && audioRef.current.currentSrc === currentAudioBlobUrlRef.current && currentAudioBlobUrlRef.current) {
        URL.revokeObjectURL(currentAudioBlobUrlRef.current);
        currentAudioBlobUrlRef.current = null;
        audioRef.current.removeAttribute('src');
    }
    if (isOpen) { 
        setCurrentLineIndex(prev => prev + 1); 
    }
  }, [isOpen]); 

  const handleChoiceClick = (connection: Connection) => {
    cleanupAudio(); 
    speechGenerationSemaphore.current = true; 
    setIsAudioLoading(false); 
    setCurrentSpeakerImageUrl(undefined);
    setCurrentSceneId(connection.toSceneId);
  };
  
  const handleSkipAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (currentAudioBlobUrlRef.current) {
      URL.revokeObjectURL(currentAudioBlobUrlRef.current);
      currentAudioBlobUrlRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.removeAttribute('src');
    }
  
    setIsAudioLoading(false);
    speechGenerationSemaphore.current = true; 
    if (isOpen) {
      setCurrentLineIndex(prev => prev + 1); 
    }
  }

  if (!isOpen) return null;

  const currentLineData = parsedLines[currentLineIndex];

  if (!currentScene && currentSceneId) { 
     return (
        <div className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-sky-300">End of Path</h2>
                     <button onClick={onClose} className="text-slate-400 hover:text-sky-300 text-3xl p-1" aria-label="Close play mode">&times;</button>
                </div>
                <p className="text-slate-300 mb-6">This path of the story has ended here.</p>
                <button
                    onClick={onClose}
                    className="w-full px-6 py-3 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-semibold"
                >
                    Return to Editor
                </button>
            </div>
        </div>
    );
  }
  
  if (!currentScene) { 
    return (
        <div className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
                 <h2 className="text-2xl font-bold text-sky-300 mb-4">Loading Story...</h2>
                 <p className="text-slate-300">Please wait.</p>
                 <button onClick={onClose} className="mt-4 px-4 py-2 bg-sky-600 text-white rounded">Close</button>
            </div>
        </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out"
      aria-modal="true" role="dialog" aria-labelledby="playmodal-title"
    >
      <div 
        className="bg-slate-800 p-6 md:p-8 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modal-appear"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 md:mb-6">
          <h2 id="playmodal-title" className="text-xl md:text-2xl font-bold text-sky-300 truncate pr-4" title={currentScene.title}>{currentScene.title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-sky-300 text-3xl p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-sky-500"
            aria-label="Close play mode"
          >
            &times;
          </button>
        </div>
        
        {/* Character Image Display Area */}
        {currentSpeakerImageUrl && !showChoices && (
            <div className="mb-4 flex justify-center items-center">
                <img 
                    src={currentSpeakerImageUrl} 
                    alt={currentLineData?.speaker || 'Character image'} 
                    className="max-w-[100px] max-h-[100px] md:max-w-[120px] md:max-h-[120px] rounded-lg border-2 border-sky-500 shadow-lg object-cover"
                />
            </div>
        )}


        <div className="text-slate-300 mb-6 md:mb-8 overflow-y-auto flex-grow prose prose-sm prose-invert max-w-none pr-2 text-base"
             style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 #1f2937' }}
             aria-live="polite"
        >
          {parsedLines.map((line, index) => (
            <p 
                key={line.id} 
                className={`transition-all duration-300 ${index === currentLineIndex && !showChoices ? 'text-sky-300 font-semibold scale-105' : 'text-slate-300'}`}
                style={{ marginBlockStart: '0.5em', marginBlockEnd: '0.5em' }}
            >
                {line.speaker && <strong className="text-sky-400">{line.speaker}: </strong>}
                {line.speaker ? line.text : line.originalLine}
            </p>
          ))}
          { (isAudioLoading || audioError) && currentLineData?.isSpokenLine && !showChoices && (
            <div className={`mt-2 p-2 text-xs rounded-md ${audioError ? 'bg-red-700' : 'bg-sky-700'} text-white`}>
                {isAudioLoading && "🔊 Synthesizing audio..."}
                {audioError && `⚠️ ${audioError}`}
                 {isAudioLoading && !audioError && elevenLabsApiKey && <button onClick={handleSkipAudio} className="ml-2 underline text-xs">Skip current audio</button>}
            </div>
          )}
        </div>
        
        <audio ref={audioRef} onEnded={handleAudioEnded} onError={handleAudioError} className="hidden" />

        {showChoices ? (
          choices.length > 0 ? (
            <div className="space-y-2 md:space-y-3 overflow-y-auto max-h-48 pr-2"
                 style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 #1f2937' }}
            >
              {choices.map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => handleChoiceClick(choice)}
                  className="w-full block text-left px-4 py-2.5 md:px-6 md:py-3 rounded-lg bg-slate-700 hover:bg-sky-600 text-sky-100 hover:text-white font-medium transition-all duration-150 ease-in-out transform hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 text-sm md:text-base"
                >
                  {choice.label || "Continue..."}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-3 md:py-4">
              <p className="text-slate-400 italic text-md md:text-lg">End of this path.</p>
              <button
                  onClick={onClose}
                  className="mt-3 md:mt-4 px-5 py-2.5 md:px-6 md:py-3 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75"
              >
                  Return to Editor
              </button>
            </div>
          )
        ) : (
            <div className="text-center py-3 md:py-4 h-24 flex items-center justify-center" aria-hidden="true">
                <p className="text-slate-500 italic">
                    {isAudioLoading && currentLineData?.isSpokenLine ? 'Playing audio...' : (parsedLines.length > 0 ? 'Processing scene...' : 'Loading scene...')}
                </p>
            </div>
        )}
      </div>
      <style>{`
        @keyframes modal-appear {
          to { opacity: 1; transform: scale(1); }
        }
        .animate-modal-appear { animation: modal-appear 0.3s forwards; }
        .prose-invert p { margin-top: 0.5em; margin-bottom: 0.5em; }
      `}</style>
    </div>
  );
};

export default PlayModal;