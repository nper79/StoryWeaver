import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { StoryData, Scene, Connection, VoiceAssignment, Beat, BeatPart } from '../types'; 
import { generateSpeech } from '../elevenLabsService';
import { getImageFromStorage } from '../fileStorageService';
import { BeatParsingService } from '../beatParsingService';

interface PlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  story: StoryData; 
  initialSceneId: string;
  elevenLabsApiKey: string | null; 
  narratorVoiceId: string | null;
}

interface ContentLine {
  id: string; 
  text: string;
  speaker?: string;
  voiceId?: string;
  originalLine: string; 
  isSpokenLine: boolean; 
}

interface CharacterProfile {
  voiceId?: string;
  imageId?: string;
}

const PlayModal: React.FC<PlayModalProps> = ({ isOpen, onClose, story, initialSceneId, elevenLabsApiKey, narratorVoiceId }) => {
  console.log(`🎙️ [PLAYMODAL] Received narratorVoiceId: ${narratorVoiceId || 'null/undefined'}`);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(initialSceneId);
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [choices, setChoices] = useState<Connection[]>([]);
  const [parsedLines, setParsedLines] = useState<ContentLine[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [showChoices, setShowChoices] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | undefined>(undefined);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | undefined>(undefined);
  const [currentBeats, setCurrentBeats] = useState<Beat[]>([]);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const characterProfileMap = useRef<Map<string, CharacterProfile>>(new Map());
  const speechGenerationSemaphore = useRef(true); 
  const currentlyProcessingLine = useRef<string | null>(null);
  const isProcessingBeat = useRef<boolean>(false); 
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
      console.log('[PlayModal] Current voice assignments:', story.voiceAssignments);
      (story.voiceAssignments || []).forEach((va: VoiceAssignment) => {
        if (va.characterName && va.characterName.trim()) {
          console.log(`[PlayModal] Setting voice for ${va.characterName}: ${va.voiceId}`);
          characterProfileMap.current.set(va.characterName.trim(), { voiceId: va.voiceId, imageId: va.imageId });
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
      setCurrentImageUrl(undefined);
    } else {
      cleanupAudio(); 
      speechGenerationSemaphore.current = true; 
      setIsAudioLoading(false);
      setCurrentSceneId(null);
      setParsedLines([]);
      setShowChoices(false);
      setCurrentImageUrl(undefined);
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

      // Handle subdivided scenes (beats)
      if (scene.isSubdivided && scene.beats && scene.beats.length > 0) {
        const sortedBeats = [...scene.beats].sort((a, b) => a.order - b.order);
        setCurrentBeats(sortedBeats);
        setCurrentBeatIndex(0);
        
        // For beat mode, we'll process beats one at a time, not all at once
        console.log(`🎭 Beat mode: ${sortedBeats.length} beats found`);
        
        // Don't process all beats at once - we'll process the current beat when needed
        setParsedLines([]); // Clear parsed lines for beat mode
      } 
      // Handle regular, line-by-line scenes
      else {
        const lines = scene.content.split('\n');
        const newParsedLines: ContentLine[] = lines.map((line, index) => {
          const match = line.match(/^([\w\s.-]+):\s*(.*)$/);
          let speaker, text, isSpokenLine = false, voiceId: string | undefined;

          if (match) { // Dialogue line like "Character: Text"
            speaker = match[1].trim();
            text = match[2].trim();
            const profile = characterProfileMap.current.get(speaker);
            voiceId = profile?.voiceId;
          } else { // Narration line
            speaker = 'Narrator';
            text = line.trim();
            // Use the global narrator voice ID
            voiceId = narratorVoiceId || undefined;
            console.log(`🎙️ [NARRATOR] Using narrator voice: ${narratorVoiceId || 'none'} for text: ${text.substring(0, 30)}...`);
          }

          // Intelligent fallback: use narratorVoiceId if available, then Rachel as last resort
          if (!voiceId && text) {
            if (speaker === 'Narrator' && narratorVoiceId) {
              voiceId = narratorVoiceId;
              console.log(`[PlayModal] Using selected narrator voice: ${narratorVoiceId}`);
            } else {
              voiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel - Last resort fallback
              console.log(`[PlayModal] No voice found for '${speaker}'. Using fallback voice.`);
            }
          }
          
          // A line is spoken if it has text and a voice assigned.
          isSpokenLine = !!(voiceId && text);

          return { id: `line-${scene.id}-${index}`, text, speaker, originalLine: line, isSpokenLine, voiceId };
        });
        setParsedLines(newParsedLines);
        setCurrentBeats([]);

      }
      setCurrentLineIndex(0);
      setShowChoices(false);
      setAudioError(null); 
      setCurrentImageUrl(undefined); // Reset image on new scene
      setCurrentVideoUrl(undefined); // Reset video on new scene
    } else { 
      setParsedLines([]);
      setChoices([]);
      setShowChoices(currentSceneId ? true : false); 
    }
    const outgoingConnections = scene ? story.connections.filter(c => c.fromSceneId === scene.id) : [];
    setChoices(outgoingConnections);

  }, [currentSceneId, story.scenes, story.connections, isOpen]);

  // Effect to load the correct media (image/video for beat or image for scene)
  useEffect(() => {
    let isActive = true;

    const loadMedia = async () => {
      // If in beat mode, load beat media (video takes priority over image)
      if (currentBeats.length > 0) {
        const beat = currentBeats[currentBeatIndex];
        
        // Check for video first
        if (beat?.videoId) {
          const videoUrl = await getImageFromStorage(beat.videoId); // Reuse storage system
          if (isActive) {
            setCurrentVideoUrl(videoUrl || undefined);
            setCurrentImageUrl(undefined); // Clear image when video is present
          }
        }
        // Fall back to image if no video
        else if (beat?.imageId) {
          const imageUrl = await getImageFromStorage(beat.imageId);
          if (isActive) {
            setCurrentImageUrl(imageUrl || undefined);
            setCurrentVideoUrl(undefined); // Clear video when image is present
          }
        } else {
          if (isActive) {
            setCurrentImageUrl(undefined);
            setCurrentVideoUrl(undefined);
          }
        }
      } 
      // If in regular scene mode, load scene image
      else if (currentScene?.generatedImageId) {
        const url = await getImageFromStorage(currentScene.generatedImageId);
        if (isActive) {
          setCurrentImageUrl(url || undefined);
          setCurrentVideoUrl(undefined); // Clear video in scene mode
        }
      } else {
        if (isActive) {
          setCurrentImageUrl(undefined);
          setCurrentVideoUrl(undefined);
        }
      }
    };

    if (isOpen) {
      loadMedia();
    }

    return () => { isActive = false; };
  }, [isOpen, currentScene, currentBeatIndex, currentBeats]);

  // New useEffect to process current beat parts when in beat mode
  useEffect(() => {
    if (!isOpen || !currentScene || currentBeats.length === 0) {
      return;
    }

    // Prevent simultaneous beat processing
    if (isProcessingBeat.current) {
      console.log('🔄 [BEAT SKIP] Beat processing already in progress, skipping');
      return;
    }

    const currentBeat = currentBeats[currentBeatIndex];
    if (!currentBeat) {
      console.log('❌ No current beat found for index:', currentBeatIndex);
      return;
    }

    console.log(`🎭 Processing beat ${currentBeatIndex + 1}/${currentBeats.length}:`, currentBeat.text.substring(0, 50) + '...');
    console.log('🔒 [BEAT] Setting beat processing flag to true');
    isProcessingBeat.current = true;

    let beatParts: BeatPart[];
    
    // Use existing parts if available, otherwise parse intelligently
    if (currentBeat.parts && currentBeat.parts.length > 0) {
      beatParts = currentBeat.parts;
      console.log(`🎭 Using existing parts:`, beatParts.map(p => `${p.speaker}: "${p.text}"`));
    } else {
      // SIMPLIFIED: Just send the entire beat text as narration
      console.log(`🎯 [SIMPLE BEAT] Sending entire beat as narration:`, currentBeat.text);
      beatParts = [{
        text: currentBeat.text,
        speaker: 'Narrator'
      }];
    }
    
    // Convert each part to a ContentLine for this beat only
    const beatLines: ContentLine[] = beatParts.map((part, partIndex) => {
      let voiceId: string | undefined;
      let isSpokenLine = false;
      
      // Try to find voice for this speaker
      const profile = characterProfileMap.current.get(part.speaker) ||
                     characterProfileMap.current.get(part.speaker.toLowerCase()) ||
                     characterProfileMap.current.get(part.speaker.toUpperCase());
      
      if (profile?.voiceId) {
        voiceId = profile.voiceId;
      } else if (part.speaker === 'Narrator') {
        // Use the global narrator voice ID
        voiceId = narratorVoiceId || undefined;
        console.log(`🎙️ [NARRATOR BEAT] Using narrator voice: ${narratorVoiceId || 'none'} for text: ${part.text.substring(0, 30)}...`);
      }

      // Intelligent fallback: use narratorVoiceId if available, then Rachel as last resort
      if (!voiceId && part.text) {
        if (part.speaker === 'Narrator' && narratorVoiceId) {
          voiceId = narratorVoiceId;
          console.log(`[PlayModal] Using selected narrator voice: ${narratorVoiceId}`);
        } else {
          voiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel - Last resort fallback
          console.log(`[PlayModal] No voice found for '${part.speaker}'. Using fallback voice.`);
        }
      }
      
      // Any text part with a voice should be considered spoken
      isSpokenLine = !!(voiceId && part.text);
      
      console.log(`🎯 Part ${partIndex + 1}:`, {
        speaker: part.speaker,
        text: part.text.substring(0, 30) + '...',
        voiceId: voiceId ? voiceId.substring(0, 8) + '...' : 'none',
        isSpokenLine
      });
      
      return {
        id: `beat-${currentBeat.id}-part-${partIndex}`,
        text: part.text,
        speaker: part.speaker,
        originalLine: part.text,
        isSpokenLine,
        voiceId
      };
    });
    
    setParsedLines(beatLines);
    console.log('🔄 [RESET] Setting currentLineIndex to 0 for beat:', currentBeatIndex + 1);
    console.log('🔄 [RESET] Beat lines created:', beatLines.length, 'lines');
    console.log('🔄 [RESET] First line preview:', beatLines[0]?.text?.substring(0, 50) + '...');
    setCurrentLineIndex(0); // Reset to first part of this beat
    
  }, [isOpen, currentScene, currentBeats, currentBeatIndex]);

  useEffect(() => {
    let isActive = true; 
    let timeoutId: number | undefined;



    const playAudioAsync = async (line: ContentLine) => {
      console.log('🎬 [AUDIO START] playAudioAsync called for:', line.text.substring(0, 50) + '...');
      console.log('🔓 [SEMAPHORE] Current state:', speechGenerationSemaphore.current);
      
      // Enhanced semaphore check - also check if audio is currently playing
      if (!speechGenerationSemaphore.current) {
        console.warn("🚫 Speech generation already in progress, skipping. Semaphore:", speechGenerationSemaphore.current);
        console.warn("🔍 Audio state:", {
          paused: audioRef.current?.paused,
          currentSrc: audioRef.current?.currentSrc,
          readyState: audioRef.current?.readyState
        });
        return;
      }
      
      // Lock semaphore immediately to prevent race conditions
      console.log('🔒 [SEMAPHORE] Locking semaphore for audio generation');
      speechGenerationSemaphore.current = false;
      if (audioRef.current && !audioRef.current.paused) {
        console.warn("Audio is currently playing, skipping new generation.");
        return;
      }
      if (!elevenLabsApiKey) {
        setAudioError("ElevenLabs API key is not set.");
        return;
      }
      if (!line.voiceId) {
        setAudioError("No voice ID for this line.");
        return;
      }

      console.log('🎵 Starting audio generation for:', line.text.substring(0, 50) + '...');
      speechGenerationSemaphore.current = false;
      setIsAudioLoading(true);
      setAudioError(null);
      cleanupAudio();

      try {
        // Always prioritize environment variable API key
        const envApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
        const keyToUse = envApiKey || elevenLabsApiKey;
        
        console.log('[PlayModal] Speech generation - Environment key available:', envApiKey ? 'yes' : 'no');
        console.log('[PlayModal] Speech generation - State key available:', elevenLabsApiKey ? 'yes' : 'no');
        console.log('[PlayModal] Speech generation - Using key:', keyToUse ? keyToUse.substring(0, 5) + '...' : 'none');
        console.log('[PlayModal] Speech generation - Voice ID:', line.voiceId);
        console.log('[PlayModal] Speech generation - Text:', line.text.substring(0, 50) + '...');
        
        if (!keyToUse) {
          throw new Error('No ElevenLabs API key available');
        }
        
        const blob = await generateSpeech(line.text, line.voiceId, keyToUse);
        if (isActive) {
          const url = URL.createObjectURL(blob);
          currentAudioBlobUrlRef.current = url;
          if (audioRef.current) {
            console.log('🎵 Audio blob created, setting up playback...');
            audioRef.current.src = url;
            audioRef.current.oncanplaythrough = () => {
              if (isActive) {
                console.log('🎵 Audio ready to play, starting playback...');
                audioRef.current?.play().catch(e => {
                  console.error('❌ Audio playback failed:', e);
                  if (isActive) setAudioError(`Audio playback failed: ${e.message}`);
                });
              }
            };
            audioRef.current.onerror = () => {
                console.error('❌ Audio element error');
                if (isActive) setAudioError("Error playing audio file.");
            };
          }
        }
      } catch (error: any) {
        if (isActive) {
          setAudioError(`Speech generation failed: ${error.message}`);
        }
      } finally {
        if (isActive) {
          setIsAudioLoading(false);
        }
        speechGenerationSemaphore.current = true;
      }
    };


    if (!isOpen || !currentScene) { 
      return () => { isActive = false; if (timeoutId) window.clearTimeout(timeoutId); }; // Use window.clearTimeout
    }
    
    // Determine which line/beat to process
    const inBeatMode = currentBeats.length > 0;
    const lineIndex = currentLineIndex; // Always use currentLineIndex to navigate through parts
    
    if (lineIndex >= parsedLines.length) {
      if (parsedLines.length > 0 && isActive && isOpen) {
         setIsAudioLoading(false); 
      }
      return () => { isActive = false; if (timeoutId) window.clearTimeout(timeoutId); };
    }

    const line = parsedLines[lineIndex];
    
    // Debug logging
    console.log('PlayModal Audio Debug:', {
      inBeatMode,
      lineIndex,
      currentBeatIndex,
      currentLineIndex,
      parsedLinesLength: parsedLines.length,
      line: line ? {
        text: line.text,
        speaker: line.speaker,
        isSpokenLine: line.isSpokenLine,
        voiceId: line.voiceId
      } : null,
      elevenLabsApiKey: elevenLabsApiKey ? 'SET' : 'NOT SET'
    });
    
    // Load scene's generated image if available (only for non-beat mode)
    if (!inBeatMode && currentScene?.generatedImageId) {
      getImageFromStorage(currentScene.generatedImageId).then((imageUrl) => {
        if (imageUrl) {
          setCurrentImageUrl(imageUrl || undefined);
        } else {
          setCurrentImageUrl(undefined);
        }
      }).catch(() => {
        setCurrentImageUrl(undefined);
      });
    } else if (!inBeatMode) {
      setCurrentImageUrl(undefined);
    }

    // Only trigger audio if this is the current line and not already being processed
    const lineId = `${currentBeatIndex}-${lineIndex}-${line?.text?.substring(0, 20)}`;
    
    if (line?.isSpokenLine && line.voiceId && line.text && lineIndex === currentLineIndex) {
      // Validate that we're using the correct line data (not stale from previous beat)
      const expectedBeatText = currentBeats[currentBeatIndex]?.text;
      const isCorrectBeat = expectedBeatText && line.text.includes(expectedBeatText.substring(0, 20));
      
      if (!isCorrectBeat) {
        console.log('⚠️ [STALE DATA] Line data doesn\'t match current beat, skipping:');
        console.log('  Expected beat text:', expectedBeatText?.substring(0, 50) + '...');
        console.log('  Actual line text:', line.text?.substring(0, 50) + '...');
        return () => { isActive = false; if (timeoutId) window.clearTimeout(timeoutId); };
      }
      
      if (currentlyProcessingLine.current === lineId) {
        console.log('🔄 [SKIP] Already processing this line, skipping duplicate call');
        return () => { isActive = false; if (timeoutId) window.clearTimeout(timeoutId); };
      }
      
      console.log('🎬 [TRIGGER] Triggering audio for current line:', line.text.substring(0, 50) + '...');
      console.log('🎬 [TRIGGER] Line index:', lineIndex, 'Current index:', currentLineIndex);
      console.log('🎬 [TRIGGER] Line ID:', lineId);
      console.log('🎬 [TRIGGER] Actual line object:', {
        id: line.id,
        text: line.text?.substring(0, 30) + '...',
        speaker: line.speaker,
        voiceId: line.voiceId?.substring(0, 8) + '...'
      });
      
      currentlyProcessingLine.current = lineId;
      playAudioAsync(line);
    } else { 
      console.log('❌ Not triggering audio - line conditions not met:');
      console.log('  - hasLine:', !!line);
      console.log('  - line.text:', line?.text);
      console.log('  - line.speaker:', line?.speaker);
      console.log('  - line.isSpokenLine:', line?.isSpokenLine);
      console.log('  - line.voiceId:', line?.voiceId);
      console.log('  - characterProfileMap:', characterProfileMap.current);
      console.log('  - Full line object:', line);
      if (isActive && isOpen) {
        setIsAudioLoading(false); 
        // Visual novel style - no auto-advance, wait for user clicks
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
  }, [currentLineIndex, currentBeatIndex, parsedLines, currentBeats, isOpen, elevenLabsApiKey, currentScene]);

  useEffect(() => {
    if (parsedLines.length > 0 && currentLineIndex >= parsedLines.length && !showChoices && choices.length > 1) {
      setShowChoices(true);
    }
  }, [currentLineIndex, parsedLines.length, showChoices, choices.length]);

  const handleAudioEnded = useCallback(() => {
    if (!isOpen) return; 
    
    console.log('🎵 Audio ended, cleaning up (no auto-advance)...');
    setIsAudioLoading(false);
    
    // Clean up current audio
    if (audioRef.current && audioRef.current.currentSrc === currentAudioBlobUrlRef.current && currentAudioBlobUrlRef.current) {
        URL.revokeObjectURL(currentAudioBlobUrlRef.current);
        currentAudioBlobUrlRef.current = null;
        audioRef.current.removeAttribute('src'); 
        audioRef.current.load(); // Force reload to clear any cached data
    }

    // Release semaphore to allow next audio generation
    console.log('🔓 [SEMAPHORE] Releasing semaphore - was:', speechGenerationSemaphore.current);
    speechGenerationSemaphore.current = true;
    console.log('🔓 [SEMAPHORE] Semaphore released - now:', speechGenerationSemaphore.current);
    
    // Clear currently processing line to allow next line
    console.log('🧽 [CLEAR] Clearing currently processing line:', currentlyProcessingLine.current);
    currentlyProcessingLine.current = null;
    
    // Clear beat processing flag to allow next beat
    console.log('🔓 [BEAT] Clearing beat processing flag');
    isProcessingBeat.current = false;
    
    console.log('🎵 Audio ended - waiting for user click to advance');
    
    // NOTE: Removed automatic advancement logic - slides now only advance on user click
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
    setCurrentImageUrl(undefined);
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

  const inBeatMode = currentBeats.length > 0;
  const currentLineData = !inBeatMode ? parsedLines[currentLineIndex] : null;
  const currentBeatData = inBeatMode ? currentBeats[currentBeatIndex] : null;
  


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
    <div className={`fixed inset-0 z-50 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-300`}>
      {/* Visual Novel Style Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-800">
        
        {/* Scene Media Display - Full Screen Background (Video takes priority over Image) */}
        {currentVideoUrl ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <video 
              src={currentVideoUrl} 
              className="w-full h-full object-cover opacity-90"
              autoPlay
              loop
              muted
              onLoadedData={() => console.log('Video loaded successfully:', currentVideoUrl)}
              onError={(e) => console.error('Video failed to load:', currentVideoUrl, e)}
            />
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
          </div>
        ) : currentImageUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <img 
              src={currentImageUrl} 
              alt={currentBeatData?.text || currentLineData?.speaker || 'Scene'} 
              className="w-full h-full object-cover opacity-90"
              onLoad={() => console.log('Image loaded successfully:', currentImageUrl)}
              onError={(e) => console.error('Image failed to load:', currentImageUrl, e)}
            />
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
          </div>
        )}

        {/* Top UI Bar */}
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-4 bg-black/30 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-white truncate pr-4" title={currentScene?.title}>
            {currentScene?.title}
          </h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl p-2 rounded-full bg-black/30 hover:bg-black/50 transition-all"
            aria-label="Close play mode"
          >
            ×
          </button>
        </div>

        {/* Main Content Area - Bottom Overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          
          {/* Text Display Area */}
          {currentScene && ((inBeatMode && currentBeatData) || (!inBeatMode && currentLineData)) && (
            <div 
              className="bg-black/85 backdrop-blur-sm p-6 mx-4 mb-4 rounded-lg border border-white/20 cursor-pointer hover:bg-black/90 transition-colors"
              onClick={() => {
                // Clean up audio state if user manually advances during playback
                const cleanupAudioState = () => {
                  console.log('🧹 [MANUAL ADVANCE] Cleaning up audio state due to manual advance');
                  
                  // Stop current audio if playing
                  if (audioRef.current && !audioRef.current.paused) {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                  }
                  
                  // Clean up blob URL
                  if (currentAudioBlobUrlRef.current) {
                    URL.revokeObjectURL(currentAudioBlobUrlRef.current);
                    currentAudioBlobUrlRef.current = null;
                  }
                  
                  // Reset audio element
                  if (audioRef.current) {
                    audioRef.current.removeAttribute('src');
                    audioRef.current.load();
                  }
                  
                  // Release semaphore
                  console.log('🔓 [MANUAL ADVANCE] Releasing semaphore - was:', speechGenerationSemaphore.current);
                  speechGenerationSemaphore.current = true;
                  
                  // Clear processing flags
                  currentlyProcessingLine.current = null;
                  isProcessingBeat.current = false;
                  
                  // Reset UI state
                  setIsAudioLoading(false);
                  setAudioError(null);
                  
                  console.log('🧹 [MANUAL ADVANCE] Audio state cleanup complete');
                };
                
                // Clean up if audio is currently playing/loading
                if (isAudioLoading || (audioRef.current && !audioRef.current.paused)) {
                  cleanupAudioState();
                }
                
                // Prevent advance during audio loading in non-beat mode (original logic)
                if (isAudioLoading && !inBeatMode) {
                  cleanupAudioState(); // Clean up and allow advance
                }

                if (inBeatMode) {
                  if (currentBeatIndex < currentBeats.length - 1) {
                    setCurrentBeatIndex(prev => prev + 1);
                  } else if (choices.length === 1) {
                    handleChoiceClick(choices[0]);
                  } else {
                    setShowChoices(true);
                  }
                } else {
                  // If not on last line, advance to next line
                  if (currentLineIndex < parsedLines.length - 1) {
                    setCurrentLineIndex(prev => prev + 1);
                  }
                  // If on last line with single choice, go to next scene
                  else if (choices.length === 1) {
                    handleChoiceClick(choices[0]);
                  }
                  // If on last line with multiple choices, show choices
                  else if (choices.length > 1 && !showChoices) {
                    setShowChoices(true);
                  }
                }
              }}
            >
              {/* Scene/Beat Text */}
              <div className="text-white text-lg leading-relaxed mb-4">
                {inBeatMode ? (
                  <div className="text-white">
                    {currentBeatData?.text}
                  </div>
                ) : (
                  <>
                    {currentLineData?.speaker && (
                      <div className="text-sky-300 font-semibold mb-2 text-xl">
                        {currentLineData.speaker}
                      </div>
                    )}
                    <div className="text-white">
                      {currentLineData?.text || currentLineData?.originalLine}
                    </div>
                  </>
                )}
              </div>

              {/* Character Thoughts (if line contains thoughts) */}
              {currentLineData?.originalLine && (currentLineData.originalLine.includes('thinks:') || currentLineData.originalLine.includes(' thinks ')) && (
                <div className="text-yellow-300 italic text-base mt-3 opacity-90">
                  {(() => {
                    // Extract thought text after "thinks:" or "thinks"
                    const thoughtMatch = currentLineData?.originalLine?.match(/thinks:?\s*["']?([^"']+)["']?/i);
                    return thoughtMatch ? thoughtMatch[1].trim() : '';
                  })()}
                </div>
              )}

              {/* Audio Status */}
              {(isAudioLoading || audioError) && (
                (!inBeatMode && currentLineData?.isSpokenLine) || 
                (inBeatMode && parsedLines[currentBeatIndex]?.isSpokenLine)
              ) && (
                <div className={`mt-3 p-2 text-sm rounded ${audioError ? 'bg-red-600/80' : 'bg-sky-600/80'} text-white`}>
                  {isAudioLoading && "🔊 Playing audio..."}
                  {audioError && `⚠️ ${audioError}`}
                  {isAudioLoading && !audioError && elevenLabsApiKey && (
                    <button onClick={handleSkipAudio} className="ml-2 underline text-sm">
                      Skip
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Multiple choices - show only when explicitly shown */}
          {choices.length > 1 && showChoices && (
            <div className="bg-black/85 backdrop-blur-sm p-6 mx-4 mb-4 rounded-lg border border-white/20">
              <div className="space-y-3">
                {choices.map((choice) => (
                  <button
                    key={choice.id}
                    onClick={() => handleChoiceClick(choice)}
                    className="w-full text-left px-4 py-3 rounded-lg bg-slate-700/80 hover:bg-sky-600/80 text-white font-medium transition-all duration-200 transform hover:scale-[1.02] border border-white/20 hover:border-sky-400/50"
                  >
                    {choice.label || "Continue..."}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading State - Only show when there's truly no content */}
          {!currentScene && currentSceneId && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-white text-xl">Loading scene...</div>
            </div>
          )}

        </div>

      </div>
      
      <audio ref={audioRef} onEnded={handleAudioEnded} onError={handleAudioError} className="hidden" />
    </div>
  );
};

export default PlayModal;