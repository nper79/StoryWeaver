import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { StoryData, Scene, Connection, VoiceAssignment, Beat, Translation } from '../types'; 
import { generateAudioWithAlignment } from '../elevenLabsService';
import { getImageFromStorage } from '../fileStorageService';
import WordHighlightText from './WordHighlightText';

interface PlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  story: StoryData; 
  initialSceneId: string;
  elevenLabsApiKey: string | null; 
  narratorVoiceId: string | null;
  narratorVoiceAssignments: { [language: string]: string };
  currentLanguage: string;
  translations: Translation[];
}

interface ContentLine {
  id: string; 
  text: string;
  speaker?: string;
  voiceId?: string;
  originalLine: string; 
  isSpokenLine: boolean; 
}

interface BeatPart {
  text: string;
  speaker: string;
}

interface WordTimestamp {
  word: string;
  start_time_ms: number;
  end_time_ms: number;
}

// Interface updated to match ElevenLabs service
// Using WordAlignment from elevenLabsService

interface CharacterProfile {
  voiceId?: string;
  imageId?: string;
}

const PlayModal: React.FC<PlayModalProps> = ({ 
  isOpen, 
  onClose, 
  story, 
  initialSceneId, 
  elevenLabsApiKey, 
  narratorVoiceId,
  narratorVoiceAssignments,
  currentLanguage,
  translations
}) => {
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
  const [wordTimestamps, setWordTimestamps] = useState<WordTimestamp[]>([]);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [audioSource, setAudioSource] = useState<'zip' | 'api' | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const characterProfileMap = useRef<Map<string, CharacterProfile>>(new Map());
  const speechGenerationSemaphore = useRef(true); 
  const currentlyProcessingLine = useRef<string | null>(null);
  const isProcessingBeat = useRef<boolean>(false); 
  const currentAudioBlobUrlRef = useRef<string | null>(null); 

  // Function to get translated scene content
  const getTranslatedScene = (scene: Scene) => {
    console.log(`🌍 [TRANSLATION] Getting translated scene for language: ${currentLanguage}`);
    console.log(`🌍 [TRANSLATION] Scene ID: ${scene.id}`);
    console.log(`🌍 [TRANSLATION] Available translations:`, translations.length);
    
    if (currentLanguage === 'en') {
      console.log(`🌍 [TRANSLATION] Using original English scene`);
      return scene; // Return original scene for English
    }
    
    // Find translation for current scene and language
    const translation = translations.find(t => 
      t.sceneId === scene.id && t.language === currentLanguage
    );
    
    console.log(`🌍 [TRANSLATION] Found translation:`, !!translation);
    if (translation) {
      console.log(`🌍 [TRANSLATION] Translation has beats:`, !!translation.beats, translation.beats?.length || 0);
      const translatedScene = {
        ...scene,
        title: translation.title,
        content: translation.content,
        beats: translation.beats?.map((beat, index) => ({
          ...beat,
          order: index // Ensure order is set for translated beats
        })) || scene.beats
      };
      console.log(`🌍 [TRANSLATION] Translated scene beats:`, translatedScene.beats?.length || 0);
      if (translatedScene.beats && translatedScene.beats.length > 0) {
        console.log(`🌍 [TRANSLATION] First beat text:`, translatedScene.beats[0].text.substring(0, 50) + '...');
      }
      return translatedScene;
    }
    
    console.log(`🌍 [TRANSLATION] No translation found, using original scene`);
    return scene; // Fallback to original if no translation found
  };

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (currentAudioBlobUrlRef.current) {
      URL.revokeObjectURL(currentAudioBlobUrlRef.current);
      currentAudioBlobUrlRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
  }, []);



  // Function to retrieve saved alignment data from localStorage
  const getSavedAlignmentData = (text: string, speaker: string, sceneId: string, beatId: string, language: string): any => {
    console.log('🔍 [DEBUG ALIGNMENT] Searching for alignment data with:');
    console.log('  - text:', text.substring(0, 50) + '...');
    console.log('  - speaker:', speaker);
    console.log('  - sceneId:', sceneId);
    console.log('  - beatId:', beatId);
    console.log('  - language:', language);
    
    // List all alignment keys for debugging
    const alignmentKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('alignment_')) {
        alignmentKeys.push(key);
      }
    }
    console.log('🔍 [DEBUG ALIGNMENT] Available alignment keys:', alignmentKeys);
    
    // Search for alignment data in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('alignment_')) {
        try {
          const alignmentData = JSON.parse(localStorage.getItem(key) || '{}');
          console.log('🔍 [DEBUG ALIGNMENT] Checking key:', key);
          console.log('  - stored text:', alignmentData.text?.substring(0, 50) + '...');
          console.log('  - stored speaker:', alignmentData.speaker);
          console.log('  - stored sceneId:', alignmentData.sceneId);
          console.log('  - stored beatId:', alignmentData.beatId);
          console.log('  - stored language:', alignmentData.language);
          
          if (
            alignmentData.text === text &&
            alignmentData.speaker === speaker &&
            alignmentData.sceneId === sceneId &&
            alignmentData.beatId === beatId &&
            alignmentData.language === language
          ) {
            console.log('🎯 [CACHED ALIGNMENT] Found saved alignment data:', key);
            return alignmentData.alignment;
          }
        } catch (error) {
          console.warn('Failed to parse alignment data:', key, error);
        }
      }
    }
    console.log('⚠️ [DEBUG ALIGNMENT] No matching alignment data found');
    return null;
  };

  const extractWordTimestamps = (alignment: any): WordTimestamp[] => {
    console.log('🔍 [TIMESTAMPS] Converting alignment data:', {
      type: typeof alignment,
      isArray: Array.isArray(alignment),
      hasCharacters: alignment?.characters ? true : false,
      charactersLength: alignment?.characters?.length || 0,
      data: alignment
    });
    
    // Debug: Log the first few characters and their timestamps
    if (alignment?.characters && alignment?.character_start_times_seconds) {
      console.log('🔍 [TIMESTAMPS] First 10 characters with timestamps:');
      for (let i = 0; i < Math.min(10, alignment.characters.length); i++) {
        console.log(`  [${i}]: "${alignment.characters[i]}" -> ${alignment.character_start_times_seconds[i]}s - ${alignment.character_end_times_seconds[i]}s`);
      }
    }
    
    if (!alignment) {
      console.warn(' [TIMESTAMPS] Alignment is null/undefined');
      return [];
    }
    
    // Handle ElevenLabs character-based alignment format
    if (alignment.characters && alignment.character_start_times_seconds && alignment.character_end_times_seconds) {
      console.log(' [TIMESTAMPS] Processing character-based alignment from ElevenLabs');
      
      const characters = alignment.characters;
      const startTimes = alignment.character_start_times_seconds;
      const endTimes = alignment.character_end_times_seconds;
      
      if (characters.length !== startTimes.length || characters.length !== endTimes.length) {
        console.warn(' [TIMESTAMPS] Mismatched array lengths in alignment data');
        return [];
      }
      
      // Helper function to detect if character is Japanese
      const isJapanese = (char: string): boolean => {
        const code = char.charCodeAt(0);
        return (
          (code >= 0x3040 && code <= 0x309F) || // Hiragana
          (code >= 0x30A0 && code <= 0x30FF) || // Katakana
          (code >= 0x4E00 && code <= 0x9FAF) || // CJK Unified Ideographs (Kanji)
          (code >= 0xFF00 && code <= 0xFFEF)    // Full-width characters
        );
      };
      
      // Helper function to determine word boundaries for different languages
      const isWordBoundary = (char: string, nextChar: string | null): boolean => {
        // For space-separated languages (English, etc.)
        if (char === ' ') return true;
        
        // For Japanese: create shorter segments for better highlighting
        if (isJapanese(char)) {
          // Break on punctuation
          if ('。、！？：；'.includes(char)) return true;
          
          // Break between different character types (Hiragana/Katakana/Kanji)
          if (nextChar) {
            const currentType = getJapaneseCharType(char);
            const nextType = getJapaneseCharType(nextChar);
            
            // Break between different types, but allow some combinations
            if (currentType !== nextType) {
              // Allow Hiragana after Kanji (common pattern)
              if (currentType === 'kanji' && nextType === 'hiragana') return false;
              // Allow Katakana sequences
              if (currentType === 'katakana' && nextType === 'katakana') return false;
              return true;
            }
          }
          
          // For long sequences, break every 2-3 characters to avoid very long highlights
          return false;
        }
        
        return false;
      };
      
      const getJapaneseCharType = (char: string): string => {
        const code = char.charCodeAt(0);
        if (code >= 0x3040 && code <= 0x309F) return 'hiragana';
        if (code >= 0x30A0 && code <= 0x30FF) return 'katakana';
        if (code >= 0x4E00 && code <= 0x9FAF) return 'kanji';
        return 'other';
      };
      
      // Convert character-based timestamps to word-based timestamps
      const wordTimestamps: WordTimestamp[] = [];
      let currentWord = '';
      let wordStartTime = 0;
      let segmentLength = 0;
      
      for (let i = 0; i < characters.length; i++) {
        const char = characters[i];
        const startTime = startTimes[i];
        const endTime = endTimes[i];
        const nextChar = i < characters.length - 1 ? characters[i + 1] : null;
        
        // Add character to current word
        if (currentWord === '') {
          wordStartTime = startTime;
        }
        currentWord += char;
        segmentLength++;
        
        // Check if we should end the current word
        const shouldBreak = 
          i === characters.length - 1 || // End of text
          isWordBoundary(char, nextChar) || // Natural boundary
          (isJapanese(char) && segmentLength >= 3); // Max 3 chars for Japanese segments
        
        if (shouldBreak) {
          if (currentWord.trim().length > 0) {
            wordTimestamps.push({
              word: currentWord.trim(),
              start_time_ms: Math.round(wordStartTime * 1000),
              end_time_ms: Math.round(endTime * 1000)
            });
            
            console.log(`🎯 [WORD ${wordTimestamps.length + 1}]:`, {
              word: currentWord.trim(),
              length: currentWord.trim().length,
              start_s: wordStartTime,
              end_s: endTime,
              start_ms: Math.round(wordStartTime * 1000),
              end_ms: Math.round(endTime * 1000),
              isJapanese: isJapanese(currentWord.trim()),
              charTypes: currentWord.trim().split('').map(c => getJapaneseCharType(c))
            });
          }
          
          currentWord = '';
          segmentLength = 0;
          wordStartTime = i < characters.length - 1 ? startTimes[i + 1] : endTime;
        }
      }
      
      console.log('📊 [TIMESTAMPS] Converted', wordTimestamps.length, 'word timestamps from character data');
      console.log('📊 [TIMESTAMPS] Summary of all segments:');
      wordTimestamps.forEach((word, index) => {
        console.log(`  ${index + 1}. "${word.word}" (${word.start_time_ms}ms - ${word.end_time_ms}ms) [${word.end_time_ms - word.start_time_ms}ms duration]`);
      });
      
      return wordTimestamps;
    }
    
    // Fallback: try to handle as word-based array (legacy format)
    if (Array.isArray(alignment)) {
      console.log(' [TIMESTAMPS] Processing word-based alignment array');
      
      const wordTimestamps: WordTimestamp[] = alignment.map((item, index) => {
        const timestamp = {
          word: item.word,
          start_time_ms: Math.round(item.start * 1000),
          end_time_ms: Math.round(item.end * 1000)
        };
        
        console.log(` [TIMESTAMP ${index + 1}]:`, {
          word: item.word,
          start_s: item.start,
          end_s: item.end,
          start_ms: timestamp.start_time_ms,
          end_ms: timestamp.end_time_ms
        });
        
        return timestamp;
      });
      
      console.log(' [TIMESTAMPS] Converted', wordTimestamps.length, 'word timestamps');
      return wordTimestamps;
    }
    
    console.warn(' [TIMESTAMPS] Unknown alignment format:', typeof alignment);
    return [];
  };

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

  // Update audio currentTime and duration in real-time for word highlighting
  useEffect(() => {
    if (!audioRef.current) {
      console.log('⚠️ [AUDIO SETUP] Audio ref not available yet');
      return;
    }

    const audio = audioRef.current;
    console.log('✅ [AUDIO SETUP] Setting up audio event listeners');
    
    const updateAudioTime = () => {
      const currentTime = audio.currentTime;
      setAudioCurrentTime(currentTime);
      console.log('⏰ [AUDIO TIME] Current time updated:', currentTime.toFixed(2) + 's');
    };
    
    const updateAudioDuration = () => {
      const duration = audio.duration || 0;
      setAudioDuration(duration);
      console.log('⏱️ [AUDIO DURATION] Duration updated:', duration.toFixed(2) + 's');
    };
    
    // Add event listeners
    audio.addEventListener('timeupdate', updateAudioTime);
    audio.addEventListener('loadedmetadata', updateAudioDuration);
    audio.addEventListener('durationchange', updateAudioDuration);
    
    console.log('🎧 [AUDIO SETUP] Event listeners added successfully');
    
    // Initial update
    if (audio.duration) {
      setAudioDuration(audio.duration);
      console.log('🎧 [AUDIO SETUP] Initial duration set:', audio.duration.toFixed(2) + 's');
    }
    
    return () => {
      console.log('🧹 [AUDIO CLEANUP] Removing event listeners');
      audio.removeEventListener('timeupdate', updateAudioTime);
      audio.removeEventListener('loadedmetadata', updateAudioDuration);
      audio.removeEventListener('durationchange', updateAudioDuration);
    };
  }, [isOpen, isAudioLoading]); // Re-run when audio state changes

  useEffect(() => {
    if (!isOpen || !currentSceneId) { 
        if (!isOpen) setCurrentScene(null); 
        return;
    }
    
    const scene = story.scenes.find(s => s.id === currentSceneId);
    const translatedScene = scene ? getTranslatedScene(scene) : null;
    setCurrentScene(translatedScene);
    
    if (translatedScene) {

      // Handle subdivided scenes (beats)
      if (translatedScene.isSubdivided && translatedScene.beats && translatedScene.beats.length > 0) {
        const sortedBeats = [...translatedScene.beats].sort((a, b) => a.order - b.order);
        setCurrentBeats(sortedBeats);
        setCurrentBeatIndex(0);
        
        // For beat mode, we'll process beats one at a time, not all at once
        console.log(`🎭 Beat mode: ${sortedBeats.length} beats found`);
        
        // Don't process all beats at once - we'll process the current beat when needed
        setParsedLines([]); // Clear parsed lines for beat mode
      } 
      // Handle regular, line-by-line scenes
      else {
        const lines = translatedScene.content.split('\n');
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
            // Use language-specific narrator voice or fallback to global narrator voice
            voiceId = narratorVoiceAssignments[currentLanguage] || narratorVoiceId || undefined;
            console.log(`🎙️ [NARRATOR] Using narrator voice for ${currentLanguage}: ${voiceId || 'none'} for text: ${text.substring(0, 30)}...`);
          }

          // Intelligent fallback: use language-specific narrator voice, then global narrator voice, then Rachel as last resort
          if (!voiceId && text) {
            if (speaker === 'Narrator') {
              const languageSpecificVoice = narratorVoiceAssignments[currentLanguage];
              if (languageSpecificVoice) {
                voiceId = languageSpecificVoice;
                console.log(`[PlayModal] Using language-specific narrator voice for ${currentLanguage}: ${languageSpecificVoice}`);
              } else if (narratorVoiceId) {
                voiceId = narratorVoiceId;
                console.log(`[PlayModal] Using global narrator voice: ${narratorVoiceId}`);
              } else {
                voiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel - Last resort fallback
                console.log(`[PlayModal] No narrator voice found for '${speaker}' in ${currentLanguage}. Using fallback voice.`);
              }
            } else {
              voiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel - Last resort fallback
              console.log(`[PlayModal] No voice found for '${speaker}'. Using fallback voice.`);
            }
          }
          
          // A line is spoken if it has text and a voice assigned.
          isSpokenLine = !!(voiceId && text);

          return { id: `line-${translatedScene.id}-${index}`, text, speaker, originalLine: line, isSpokenLine, voiceId };
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
    const outgoingConnections = translatedScene ? story.connections.filter(c => c.fromSceneId === translatedScene.id) : [];
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
        // Use language-specific narrator voice or fallback to global narrator voice
        voiceId = narratorVoiceAssignments[currentLanguage] || narratorVoiceId || undefined;
        console.log(`🎙️ [BEAT NARRATOR] Using narrator voice for ${currentLanguage}: ${voiceId || 'none'}`);
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
    
  }, [isOpen, currentScene, currentBeats, currentBeatIndex, narratorVoiceAssignments, currentLanguage]);

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
        
        // Check for cached audio first (from ZIP backup)
        const currentScene = getTranslatedScene(story.scenes.find(s => s.id === story.currentSceneId) || story.scenes[0]);
        const currentBeat = currentScene.beats?.[currentBeatIndex];
        const audioId = `audio_${currentScene.id}_${currentBeat?.id || 'unknown'}_${currentLanguage}`;
        const speaker = line.speaker || 'Narrator';
        
        // Look for cached audio in localStorage
        console.log('🔍 [DEBUG] Searching for cached audio with pattern:', audioId);
        console.log('🔍 [DEBUG] Speaker:', speaker);
        console.log('🔍 [DEBUG] Current localStorage keys:');
        
        // List all localStorage keys for debugging
        const allKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('audio_')) {
            allKeys.push(key);
          }
        }
        console.log('🔍 [DEBUG] Audio keys in localStorage:', allKeys);
        
        let cachedAudioUrl = null;
        
        // PRIMARY SEARCH: Try exact scene ID match
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(audioId) && key.includes(speaker)) {
            const audioData = localStorage.getItem(key);
            if (audioData) {
              cachedAudioUrl = audioData;
              console.log('💾 [ZIP AUDIO] Found cached audio from backup (exact match):', key);
              break;
            }
          }
        }
        
        // FALLBACK SEARCH: Try position-based matching if exact match fails
        if (!cachedAudioUrl) {
          console.log('🔍 [FALLBACK] Searching by scene/beat position...');
          
          // Get current scene and beat indices
          const currentSceneIndex = story.scenes.findIndex(s => s.id === story.currentSceneId);
          const sceneToUse = story.scenes[currentSceneIndex] || story.scenes[0];
          const beatIndex = currentBeatIndex;
          
          console.log(`🔍 [POSITION] Looking for Scene ${currentSceneIndex + 1}, Beat ${beatIndex + 1}`);
          
          // Search for any audio that matches this position pattern
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('audio_') && key.includes(speaker) && key.includes(currentLanguage)) {
              // Extract beat ID from key to match position
              const beatIdMatch = key.match(/_beat_([^_]+)_/);
              if (beatIdMatch) {
                const keyBeatId = beatIdMatch[1];
                // Check if this beat ID matches our current beat position
                if (currentBeat?.id === keyBeatId || 
                    (sceneToUse.beats && sceneToUse.beats[beatIndex]?.id === keyBeatId)) {
                  const audioData = localStorage.getItem(key);
                  if (audioData) {
                    cachedAudioUrl = audioData;
                    console.log(`🎯 [POSITION MATCH] Found audio by position - Scene ${currentSceneIndex + 1}, Beat ${beatIndex + 1}:`, key);
                    break;
                  }
                }
              }
            }
          }
        }
        
        // LAST RESORT: Try any audio with matching beat pattern and speaker
        if (!cachedAudioUrl && currentBeat?.id) {
          console.log('🔍 [LAST RESORT] Searching for any audio with matching beat ID and speaker...');
          
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('audio_') && 
                key.includes(currentBeat.id) && 
                key.includes(speaker) && 
                key.includes(currentLanguage)) {
              const audioData = localStorage.getItem(key);
              if (audioData) {
                cachedAudioUrl = audioData;
                console.log('🆘 [LAST RESORT] Found audio with matching beat/speaker:', key);
                break;
              }
            }
          }
        }
        
        if (!cachedAudioUrl) {
          console.log('⚠️ [DEBUG] No cached audio found after all search attempts. Pattern:', audioId, 'Speaker:', speaker);
        }
        
        // Check for cached alignment data
        const cachedAlignment = getSavedAlignmentData(
          line.text, 
          speaker, 
          currentScene.id, 
          currentBeat?.id || '', 
          currentLanguage
        );
        
        let alignment = null;
        let audioUrl = null;
        
        if (cachedAudioUrl && cachedAlignment) {
          // Both audio and alignment are cached - use ZIP data
          console.log('🚀 [ZIP] Using cached audio and alignment from backup');
          audioUrl = cachedAudioUrl;
          alignment = cachedAlignment;
          setAudioSource('zip');
        } else {
          // Generate fresh audio via API
          console.log('🌐 [API] Generating fresh audio and alignment via ElevenLabs');
          const response = await generateAudioWithAlignment(line.text, line.voiceId, keyToUse);
          audioUrl = URL.createObjectURL(response.audio);
          alignment = response.alignment;
          setAudioSource('api');
        }
        if (isActive) {
          currentAudioBlobUrlRef.current = audioUrl;
          
          // Store timestamps for word-level highlighting (use cached or fresh)
          const wordTimestamps = extractWordTimestamps(alignment);
          console.log('🎯 [TIMESTAMPS] Using word timestamps:', wordTimestamps.length, 'words', audioSource === 'zip' ? '(from ZIP)' : '(from API)');
          setWordTimestamps(wordTimestamps);
          
          if (audioRef.current) {
            console.log('🎵 Audio ready for playback, source:', audioSource);
            audioRef.current.src = audioUrl;
            audioRef.current.oncanplaythrough = () => {
              if (isActive) {
                console.log('🎵 Audio ready to play, starting playback...');
                audioRef.current?.play().catch(e => {
                  console.error('❌ Audio playback failed:', e);
                  if (isActive) setAudioError(`Audio playback failed: ${e.message}`);
                });
              }
            };
            
            // Add event listeners for play/pause state
            audioRef.current.onplay = () => {
              console.log('🎵 Audio started playing');
              setIsAudioPlaying(true);
            };
            
            audioRef.current.onpause = () => {
              console.log('⏸️ Audio paused');
              setIsAudioPlaying(false);
            };
            
            // Add event listener to capture audio duration when metadata loads
            audioRef.current.onloadedmetadata = () => {
              const duration = audioRef.current?.duration || 0;
              console.log(`🎯 [AUDIO DURATION] Audio metadata loaded, duration: ${duration.toFixed(2)}s`);
              setAudioDuration(duration);
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
      // Only validate beat data if we're actually in beat mode
      if (inBeatMode) {
        const expectedBeatText = currentBeats[currentBeatIndex]?.text;
        const isCorrectBeat = expectedBeatText && line.text.includes(expectedBeatText.substring(0, 20));
        
        if (!isCorrectBeat) {
          console.log('⚠️ [STALE DATA] Line data doesn\'t match current beat, skipping:');
          console.log('  Expected beat text:', expectedBeatText?.substring(0, 50) + '...');
          console.log('  Actual line text:', line.text?.substring(0, 50) + '...');
          return () => { isActive = false; if (timeoutId) window.clearTimeout(timeoutId); };
        }
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
    setIsAudioPlaying(false); // Clear playing state for WordHighlightText
    
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
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white truncate pr-4" title={currentScene?.title}>
              {currentScene?.title}
            </h2>
            {/* Audio Source Indicator */}
            {audioSource && (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                audioSource === 'zip' 
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}>
                {audioSource === 'zip' ? (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    ZIP Backup
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd" />
                      <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V9a1 1 0 00-1-1h-1v4.5a1.5 1.5 0 01-3 0V8a1 1 0 011-1z" />
                    </svg>
                    API Streaming
                  </>
                )}
              </div>
            )}
          </div>
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
              {/* Scene/Beat Text with Word-Level Highlighting */}
              <div className="mb-4">
                {inBeatMode ? (
                  <WordHighlightText
                    text={currentBeatData?.text || ''}
                    isPlaying={isAudioPlaying}
                    audioDuration={audioDuration}
                    currentTime={audioCurrentTime}
                    className="text-white text-lg leading-relaxed"
                    wordTimestamps={wordTimestamps}
                  />
                ) : (
                  <WordHighlightText
                    text={currentLineData?.text || currentLineData?.originalLine || ''}
                    isPlaying={isAudioPlaying}
                    audioDuration={audioRef.current?.duration || 0}
                    currentTime={audioRef.current?.currentTime || 0}
                    speaker={currentLineData?.speaker}
                    className="text-white text-lg leading-relaxed"
                    wordTimestamps={wordTimestamps}
                  />
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