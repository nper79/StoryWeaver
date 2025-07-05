import React, { useState, useEffect, useCallback } from 'react';
import type { Scene, Connection, StoryData, VoiceAssignment, Translation, NarratorVoiceAssignments } from './types';
import Toolbar from './components/Toolbar';
import CanvasView from './components/CanvasView';
import ZoomControls from './components/ZoomControls';
import PlayModal from './components/PlayModal';
import VoiceSettingsModal from './components/VoiceSettingsModal';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { TranslationService } from './services/translationService';
import { generateAudioWithAlignment } from './elevenLabsService';



import { 
  DEFAULT_SCENE_WIDTH, 
  DEFAULT_SCENE_MIN_HEIGHT, 
  INITIAL_START_SCENE_ID_KEY,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  ZOOM_LEVEL_KEY,
  LAYOUT_TOP_PADDING,
  LAYOUT_SIDE_PADDING,
  LAYOUT_VERTICAL_GAP,
  LAYOUT_HORIZONTAL_GAP,
  WORLD_WIDTH,
  WORLD_HEIGHT,

  OPENAI_API_KEY_LOCAL_STORAGE_KEY,
} from './constants';
import { 
  getImageGenerationStrategy 
} from './sceneSequenceService';
import { generateSceneImageWithCharacterReferences } from './imageGenerationService';
import { saveGeneratedImage, saveCharacterImage } from './fileStorageService';
import { beatSubdivisionService } from './services/beatSubdivisionService';
import { exportStoryToZip, importStoryFromZip } from './backupService';
import { aiStoryService } from './services/aiStoryService';
import { 
  analyzeScene, 
  generateSimpleImagePrompt, 
  type CharacterDetectionResult 
} from './characterAnalysisService';
import { 
  extractLocationKey,
  updateStoryWithLocationKeys
} from './locationConsistencyService';
import { textRewriteService, type LanguageLevel } from './services/textRewriteService';
import { BeatMigrationService } from './services/beatMigrationService';

const generateId = (): string => Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
const STORY_DATA_LOCAL_STORAGE_KEY = 'interactiveStoryData';

const App: React.FC = () => {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [startSceneId, setStartSceneId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [voiceAssignments, setVoiceAssignments] = useState<VoiceAssignment[]>([]);
  const [narratorVoiceId, setNarratorVoiceId] = useState<string | null>(null);
  const [narratorVoiceAssignments, setNarratorVoiceAssignments] = useState<NarratorVoiceAssignments>({});
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState<boolean>(false);
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string | null>(null);
  const [openaiApiKey, setOpenaiApiKey] = useState<string | null>(null);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState<boolean>(false);
  const [characterAnalysisProgress, setCharacterAnalysisProgress] = useState<number>(0);
  const [generatingImageForScene, setGeneratingImageForScene] = useState<string | null>(null);
  const [generatingContinuationForScene, setGeneratingContinuationForScene] = useState<string | null>(null);
  const [isBulkGeneratingImages, setIsBulkGeneratingImages] = useState<boolean>(false);
  const [bulkImageProgress, setBulkImageProgress] = useState<number>(0);
  const [isDownloadingAudio, setIsDownloadingAudio] = useState<boolean>(false);
  const [rewritingTextForScene, setRewritingTextForScene] = useState<string | null>(null);
  const [subdividingSceneIntoBeats, setSubdividingSceneIntoBeats] = useState<string | null>(null);
  const [generatingBeatImageFor, setGeneratingBeatImageFor] = useState<{ sceneId: string; beatId: string } | null>(null);

  const loadInitialData = () => {
    const savedStory = localStorage.getItem(STORY_DATA_LOCAL_STORAGE_KEY);
    let initialScenes: Scene[] = [];
    let initialConnections: Connection[] = [];
    let initialStartSceneId: string | null = null;
    let initialVoiceAssignments: VoiceAssignment[] = [];
    let initialNarratorVoiceId: string | null = null;
    let initialNarratorVoiceAssignments: NarratorVoiceAssignments = {};
    let initialTranslations: Translation[] = [];
    let initialCurrentLanguage: string = 'en';

    if (savedStory) {
      try {
        const parsedStory: StoryData = JSON.parse(savedStory);
        initialScenes = parsedStory.scenes?.map(s => ({
          ...s, 
          generatedImagePrompt: s.generatedImagePrompt || undefined,
          detectedCharacters: s.detectedCharacters || undefined,
          settingContext: s.settingContext || undefined
        })) || [];
        initialConnections = parsedStory.connections || [];
        initialStartSceneId = parsedStory.startSceneId || localStorage.getItem(INITIAL_START_SCENE_ID_KEY) || null;
        initialVoiceAssignments = parsedStory.voiceAssignments || [];
        initialNarratorVoiceId = parsedStory.narratorVoiceId || null;
        initialNarratorVoiceAssignments = parsedStory.narratorVoiceAssignments || {};
        initialTranslations = parsedStory.translations || [];
        initialCurrentLanguage = parsedStory.currentLanguage || 'en';
        
        // Check if we need to migrate image data from localStorage to IndexedDB
        const scenesMigrationNeeded = initialScenes.some(scene => (scene as any).generatedImageUrl && !scene.generatedImageId);
        const charactersMigrationNeeded = initialVoiceAssignments.some(va => (va as any).imageUrl && !va.imageId);
        
        if (scenesMigrationNeeded || charactersMigrationNeeded) {
          console.log('[Migration] Starting migration from localStorage base64 to IndexedDB storage...');
          
          // Start the migration process in the background
          (async () => {
            try {
              // Migrate scene images
              if (scenesMigrationNeeded) {
                console.log('[Migration] Migrating scene images...');
                for (let i = 0; i < initialScenes.length; i++) {
                  const scene = initialScenes[i];
                  if ((scene as any).generatedImageUrl && !scene.generatedImageId) {
                    try {
                      const imageId = await saveGeneratedImage((scene as any).generatedImageUrl, scene.id);
                      initialScenes[i] = {
                        ...scene,
                        generatedImageId: imageId
                      };
                      // Remove the old property
                      delete (initialScenes[i] as any).generatedImageUrl;
                      console.log(`[Migration] Migrated image for scene: ${scene.title}`);
                    } catch (error) {
                      console.error(`[Migration] Failed to migrate scene image for ${scene.title}:`, error);
                    }
                  }
                }
                
                // Update state with migrated data
                setScenes([...initialScenes]);
                
                // Save migrated data back to localStorage
                try {
                  const updatedStoryData: StoryData = {
                    scenes: initialScenes,
                    connections: initialConnections,
                    startSceneId: initialStartSceneId,
                    voiceAssignments: initialVoiceAssignments
                  };
                  localStorage.setItem(STORY_DATA_LOCAL_STORAGE_KEY, JSON.stringify(updatedStoryData));
                  console.log('[Migration] Saved migrated scenes to localStorage');
                } catch (error) {
                  console.warn('[Migration] Failed to save migrated scenes to localStorage:', error);
                }
              }
              
              // Migrate character images
              if (charactersMigrationNeeded) {
                console.log('[Migration] Migrating character images...');
                for (let i = 0; i < initialVoiceAssignments.length; i++) {
                  const assignment = initialVoiceAssignments[i];
                  if ((assignment as any).imageUrl && !assignment.imageId) {
                    try {
                      const imageId = await saveCharacterImage((assignment as any).imageUrl, assignment.characterName);
                      initialVoiceAssignments[i] = {
                        ...assignment,
                        imageId: imageId
                      };
                      // Remove the old property
                      delete (initialVoiceAssignments[i] as any).imageUrl;
                      console.log(`[Migration] Migrated image for character: ${assignment.characterName}`);
                    } catch (error) {
                      console.error(`[Migration] Failed to migrate character image for ${assignment.characterName}:`, error);
                    }
                  }
                }
                
                // Update state with migrated data
                setVoiceAssignments([...initialVoiceAssignments]);
                
                // Save migrated data back to localStorage
                try {
                  const updatedStoryData: StoryData = {
                    scenes: initialScenes,
                    connections: initialConnections,
                    startSceneId: initialStartSceneId,
                    voiceAssignments: initialVoiceAssignments
                  };
                  localStorage.setItem(STORY_DATA_LOCAL_STORAGE_KEY, JSON.stringify(updatedStoryData));
                  console.log('[Migration] Saved migrated character data to localStorage');
                } catch (error) {
                  console.warn('[Migration] Failed to save migrated character data to localStorage:', error);
                }
              }
              
              console.log('[Migration] Migration completed successfully');
              
            } catch (error) {
              console.error('[Migration] Error during migration:', error);
            }
          })();
        }
      } catch (e) {
        console.error("Failed to load story from localStorage", e);
      }
    }

    if (initialScenes.length === 0) {
        const firstSceneId = generateId();
        initialScenes = [{ 
          id: firstSceneId, 
          title: 'Start Scene', 
          content: 'This is the beginning of your story.', 
          x: 50, 
          y: 50, 
          width: DEFAULT_SCENE_WIDTH, 
          height: DEFAULT_SCENE_MIN_HEIGHT, 
          generatedImagePrompt: undefined,
          detectedCharacters: undefined,
          settingContext: undefined,
          generatedImageId: undefined,
        }];
        initialStartSceneId = firstSceneId;
    }
    
    setScenes(initialScenes);
    setConnections(initialConnections);
    setStartSceneId(initialStartSceneId);
    setVoiceAssignments(initialVoiceAssignments);
    setNarratorVoiceId(initialNarratorVoiceId);
    setNarratorVoiceAssignments(initialNarratorVoiceAssignments);
    setTranslations(initialTranslations);
    setCurrentLanguage(initialCurrentLanguage);

    const savedZoom = localStorage.getItem(ZOOM_LEVEL_KEY);
    if (savedZoom) {
      const parsedZoom = parseFloat(savedZoom);
      if (!isNaN(parsedZoom) && parsedZoom >= MIN_ZOOM && parsedZoom <= MAX_ZOOM) {
        setZoomLevel(parsedZoom);
      }
    }

    // Load ElevenLabs API key from .env
    const envElevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    if (envElevenLabsApiKey) {
      setElevenLabsApiKey(envElevenLabsApiKey);
      console.log('[App] ElevenLabs API key loaded from .env.');
    } else {
      console.warn('[App] VITE_ELEVENLABS_API_KEY not found in .env. Text-to-speech will not function.');
    }

    // Load OpenAI API key from environment variable
    const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (openaiApiKey) {
      console.log('[App] Loading OpenAI API key from environment');
      console.log('[App] OpenAI API key length:', openaiApiKey.length);
      console.log('[App] OpenAI API key starts with:', openaiApiKey.substring(0, 5));
      setOpenaiApiKey(openaiApiKey);
      localStorage.setItem(OPENAI_API_KEY_LOCAL_STORAGE_KEY, openaiApiKey);
    } else {
      // Fallback to localStorage if env var is not available
      const savedOpenaiApiKey = localStorage.getItem(OPENAI_API_KEY_LOCAL_STORAGE_KEY);
      if (savedOpenaiApiKey) {
        setOpenaiApiKey(savedOpenaiApiKey);
      }
    }
  };

  useEffect(() => {
    loadInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const storyData: StoryData = { 
        scenes, 
        connections, 
        startSceneId, 
        voiceAssignments, 
        narratorVoiceId: narratorVoiceId || undefined,
        narratorVoiceAssignments,
        translations,
        currentLanguage
      };
      localStorage.setItem(STORY_DATA_LOCAL_STORAGE_KEY, JSON.stringify(storyData));
      if (startSceneId) {
          localStorage.setItem(INITIAL_START_SCENE_ID_KEY, startSceneId);
      } else {
          localStorage.removeItem(INITIAL_START_SCENE_ID_KEY);
      }
    } catch (error) {
      console.warn("localStorage full, continuing without persistent storage:", error);
      // Continue working without storage - don't block the user
    }
  }, [scenes, connections, startSceneId, voiceAssignments, narratorVoiceId]);

  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_LEVEL_KEY, zoomLevel.toString());
    } catch (error) {
      console.warn("Failed to save zoom level, continuing:", error);
      // Continue working without storage - don't block the user
    }
  }, [zoomLevel]);



  const addScene = () => {
    const newId = generateId();
    const newX = scenes.length > 0 ? (scenes.reduce((acc, s) => acc + s.x, 0) / scenes.length) + 50 : Math.random() * (WORLD_WIDTH / 4) + 50;
    const newY = scenes.length > 0 ? (scenes.reduce((acc, s) => acc + s.y, 0) / scenes.length) + 50 : Math.random() * (WORLD_HEIGHT / 4) + 50;

    const newScene: Scene = {
      id: newId,
      title: `New Scene ${scenes.length + 1}`,
      content: 'Edit this scene content.',
      x: Math.max(0, Math.min(newX, WORLD_WIDTH - DEFAULT_SCENE_WIDTH)),
      y: Math.max(0, Math.min(newY, WORLD_HEIGHT - DEFAULT_SCENE_MIN_HEIGHT)),
      width: DEFAULT_SCENE_WIDTH,
      height: DEFAULT_SCENE_MIN_HEIGHT,
      generatedImagePrompt: undefined,
      detectedCharacters: undefined,
      settingContext: undefined,
      generatedImageId: undefined,
    };
    setScenes(prevScenes => [...prevScenes, newScene]);
    setActiveSceneId(newId);
    if (scenes.length === 0 || !startSceneId) { 
        setStartSceneId(newId);
    }
  };

  const updateScene = (id: string, updates: Partial<Omit<Scene, 'id'>>) => {
    setScenes(prevScenes =>
      prevScenes.map(scene =>
        scene.id === id ? { ...scene, ...updates } : scene
      )
    );
  };

  const deleteScene = (id: string) => {
    setScenes(prevScenes => prevScenes.filter(scene => scene.id !== id));
    setConnections(prevConnections =>
      prevConnections.filter(conn => conn.fromSceneId !== id && conn.toSceneId !== id)
    );
    if (activeSceneId === id) {
      setActiveSceneId(null);
    }
    if (startSceneId === id) {
        const remainingScenes = scenes.filter(s => s.id !== id);
        setStartSceneId(remainingScenes.length > 0 ? remainingScenes[0].id : null); 
    }
  };

  const addConnection = (fromSceneId: string, toSceneId: string, label: string) => {
    const existing = connections.find(c => c.fromSceneId === fromSceneId && c.toSceneId === toSceneId);
    if (existing) {
        alert("A connection between these scenes already exists. Edit the existing connection label or delete it to create a new one.");
        return;
    }
    if (fromSceneId === toSceneId) {
        alert("Cannot connect a scene to itself.");
        return;
    }

    const newConnection: Connection = {
      id: generateId(),
      fromSceneId,
      toSceneId,
      label,
    };
    setConnections(prevConnections => [...prevConnections, newConnection]);
  };

  const updateConnectionLabel = (connectionId: string, newLabel: string) => {
    setConnections(prevConnections =>
      prevConnections.map(conn =>
        conn.id === connectionId ? { ...conn, label: newLabel } : conn
      )
    );
  };

  const deleteConnection = (id: string) => {
    setConnections(prevConnections => prevConnections.filter(conn => conn.id !== id));
  };

  // Handler functions for CanvasView
  const handleSceneMove = (sceneId: string, x: number, y: number) => {
    updateScene(sceneId, { x, y });
  };

  const handleSceneResize = (sceneId: string, width: number, height: number) => {
    updateScene(sceneId, { width, height });
  };

  const handleSceneEdit = (sceneId: string) => {
    setActiveSceneId(sceneId);
  };

  const handleSceneDelete = (sceneId: string) => {
    deleteScene(sceneId);
  };

  const handleConnectionCreate = (fromSceneId: string, toSceneId: string, label: string) => {
    addConnection(fromSceneId, toSceneId, label);
  };

  const handleConnectionDelete = (connectionId: string) => {
    deleteConnection(connectionId);
  };

  const handleConnectionEdit = (connectionId: string, newLabel: string) => {
    updateConnectionLabel(connectionId, newLabel);
  };
  
  const handleSetStartScene = () => {
    if (activeSceneId) { 
      if (startSceneId === activeSceneId) {
        setStartSceneId(null); 
      } else {
        setStartSceneId(activeSceneId); 
      }
    }
  };

  const handleSave = () => {
    const storyData: StoryData = { 
      scenes, 
      connections, 
      startSceneId, 
      voiceAssignments,
      translations,
      currentLanguage,
      narratorVoiceId: narratorVoiceId || undefined,
      narratorVoiceAssignments
    };
    const json = JSON.stringify(storyData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'interactive_story.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportZip = async () => {
    try {
      const storyData: StoryData = { scenes, connections, startSceneId, voiceAssignments, translations, currentLanguage, narratorVoiceId: narratorVoiceId || undefined, narratorVoiceAssignments };
      
      // Debug: Log what translations are being exported
      console.log('🔍 Exporting translations:', translations);
      console.log('🔍 Current language:', currentLanguage);
      console.log('🔍 Full story data:', storyData);
      
      await exportStoryToZip(storyData);
      alert('Story exported successfully as ZIP file!');
    } catch (error) {
      console.error('Failed to export story:', error);
      alert('Failed to export story. Please try again.');
    }
  };

  const handleImportZip = async (file: File) => {
    try {
      const importedStoryData = await importStoryFromZip(file);
      handleLoad(importedStoryData);
      alert('Story imported successfully from ZIP file!');
    } catch (error) {
      console.error('Failed to import story:', error);
      alert('Failed to import story. Please check the file and try again.');
    }
  };

  const handleLoad = (data: StoryData) => {
    console.log('[Load] Processing imported story data:', {
      scenes: data.scenes?.length || 0,
      translations: data.translations?.length || 0,
      currentLanguage: data.currentLanguage || 'en',
      narratorVoiceAssignments: data.narratorVoiceAssignments || {}
    });
    
    setScenes(data.scenes?.map(s => ({
      ...s, 
      generatedImagePrompt: s.generatedImagePrompt || undefined,
      detectedCharacters: s.detectedCharacters || undefined,
      settingContext: s.settingContext || undefined,
      generatedImageId: s.generatedImageId || undefined,
    })) || []); 
    setConnections(data.connections || []);
    setStartSceneId(data.startSceneId || null);
    setVoiceAssignments(data.voiceAssignments || []);
    
    // Process imported translations and language settings
    if (data.translations && data.translations.length > 0) {
      console.log('[Load] Setting translations:', data.translations.length);
      setTranslations(data.translations);
    } else {
      console.log('[Load] No translations found, clearing existing translations');
      setTranslations([]);
    }
    
    if (data.currentLanguage && data.currentLanguage !== 'en') {
      console.log('[Load] Setting current language:', data.currentLanguage);
      setCurrentLanguage(data.currentLanguage);
    } else {
      console.log('[Load] No current language specified, resetting to English');
      setCurrentLanguage('en');
    }
    
    if (data.narratorVoiceAssignments) {
      console.log('[Load] Setting narrator voice assignments:', data.narratorVoiceAssignments);
      setNarratorVoiceAssignments(data.narratorVoiceAssignments);
    }
    
    setActiveSceneId(null); 
    setZoomLevel(DEFAULT_ZOOM); 
    
    const hasTranslations = data.translations && data.translations.length > 0;
    const language = data.currentLanguage || 'en';
    const message = hasTranslations 
      ? `Story loaded successfully with ${data.translations.length} translations in ${language.toUpperCase()}! Language has been set to ${language.toUpperCase()}.`
      : 'Story loaded successfully! Zoom has been reset. You may need to scroll or use "Organize Flow" to locate all scenes.';
    
    setTimeout(() => alert(message), 100);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  };

  const handleResetZoom = () => {
    setZoomLevel(DEFAULT_ZOOM);
  };

  const handleAddMultipleOptions = useCallback((sourceSceneId: string, count: number) => {
    const sourceScene = scenes.find(s => s.id === sourceSceneId);
    if (!sourceScene) return;

    const newScenesToAdd: Scene[] = [];
    const newConnectionsToAdd: Connection[] = [];

    const baseOffsetY = (sourceScene.height || DEFAULT_SCENE_MIN_HEIGHT) + 60; 
    const horizontalSpreadFactor = (DEFAULT_SCENE_WIDTH + 30); 

    for (let i = 0; i < count; i++) {
      const newSceneId = generateId();
      let offsetX: number;
      if (count === 1) { 
        offsetX = 0; 
      } else if (count % 2 === 0) {
        offsetX = (i - (count / 2 - 0.5)) * horizontalSpreadFactor;
      } else { 
        offsetX = (i - Math.floor(count / 2)) * horizontalSpreadFactor;
      }
      
      const newScene: Scene = {
        id: newSceneId,
        title: `Option ${scenes.length + newScenesToAdd.length + 1}`,
        content: `Content for Option ${i + 1}`,
        x: Math.max(0, Math.min(sourceScene.x + offsetX, WORLD_WIDTH - DEFAULT_SCENE_WIDTH)),
        y: Math.max(0, Math.min(sourceScene.y + baseOffsetY, WORLD_HEIGHT - DEFAULT_SCENE_MIN_HEIGHT)),
        width: DEFAULT_SCENE_WIDTH,
        height: DEFAULT_SCENE_MIN_HEIGHT,
        generatedImagePrompt: undefined,
        detectedCharacters: undefined,
        settingContext: undefined,
        generatedImageId: undefined,
      };
      newScenesToAdd.push(newScene);

      const newConnection: Connection = {
        id: generateId(),
        fromSceneId: sourceSceneId,
        toSceneId: newSceneId,
        label: `Choice ${i + 1}`,
      };
      newConnectionsToAdd.push(newConnection);
    }

    setScenes(prev => [...prev, ...newScenesToAdd]);
    setConnections(prev => [...prev, ...newConnectionsToAdd]);
  }, [scenes]);

  const handleAddThreeOptions = useCallback((sourceSceneId: string) => {
    handleAddMultipleOptions(sourceSceneId, 3);
  }, [handleAddMultipleOptions]);

  const handleAddTwoOptions = useCallback((sourceSceneId: string) => {
    handleAddMultipleOptions(sourceSceneId, 2);
  }, [handleAddMultipleOptions]);

  const handleAddOneOption = useCallback((sourceSceneId: string) => {
    handleAddMultipleOptions(sourceSceneId, 1);
  }, [handleAddMultipleOptions]);

  const handleAddInlineChoice = (sourceSceneId: string, choiceLabel: string) => {
    const sourceScene = scenes.find(s => s.id === sourceSceneId);
    if (!sourceScene) return;

    const newTargetSceneId = generateId();
    const baseOffsetY = (sourceScene.height || DEFAULT_SCENE_MIN_HEIGHT) + 80;
    const slightlyRightOffset = 30; 

    const newTargetScene: Scene = {
      id: newTargetSceneId,
      title: `Scene from: "${choiceLabel.substring(0, 20)}${choiceLabel.length > 20 ? '...' : ''}"`,
      content: `Content for choice: "${choiceLabel}"`,
      x: Math.max(0, Math.min(sourceScene.x + slightlyRightOffset, WORLD_WIDTH - DEFAULT_SCENE_WIDTH)),
      y: Math.max(0, Math.min(sourceScene.y + baseOffsetY, WORLD_HEIGHT - DEFAULT_SCENE_MIN_HEIGHT)),
      width: DEFAULT_SCENE_WIDTH,
      height: DEFAULT_SCENE_MIN_HEIGHT,
      generatedImagePrompt: undefined,
      detectedCharacters: undefined,
      settingContext: undefined,
      generatedImageId: undefined,
    };

    setScenes(prev => [...prev, newTargetScene]);
    addConnection(sourceSceneId, newTargetSceneId, choiceLabel);
  };

  const calculateSceneActualSize = (scene: Scene, connections: Connection[]): { width: number; height: number } => {
    const baseWidth = scene.width || DEFAULT_SCENE_WIDTH;
    let calculatedHeight = DEFAULT_SCENE_MIN_HEIGHT;
    
    // Header height (title + delete button)
    calculatedHeight += 40; // ~40px for header
    
    // Content height - estimate based on content length
    if (scene.content) {
      const contentLines = Math.ceil(scene.content.length / 50); // ~50 chars per line
      calculatedHeight += Math.max(60, contentLines * 20); // Min 60px, ~20px per line
    } else {
      calculatedHeight += 60; // Placeholder height
    }
    
    // Generated image prompt height
    if (scene.generatedImagePrompt) {
      const promptLines = Math.ceil(scene.generatedImagePrompt.length / 60);
      calculatedHeight += 30 + (promptLines * 16); // Header + text lines
    }
    
    // Generated image height
    if (scene.generatedImageId) {
      calculatedHeight += 200 + 30; // Max image height + padding/header
    }
    
    // Character analysis height
    if (scene.detectedCharacters?.length || scene.settingContext) {
      calculatedHeight += 20; // Base padding
      
      if (scene.detectedCharacters?.length) {
        const characterRows = Math.ceil(scene.detectedCharacters.length / 3); // ~3 tags per row
        calculatedHeight += 20 + (characterRows * 24); // Header + tag rows
      }
      
      if (scene.settingContext) {
        const settingLines = Math.ceil(scene.settingContext.length / 50);
        calculatedHeight += 20 + (settingLines * 16); // Header + text lines
      }
    }
    
    // Connections/choices height
    const outgoingConnections = connections.filter(conn => conn.fromSceneId === scene.id);
    if (outgoingConnections.length > 0) {
      calculatedHeight += 40; // Header + padding
      const choiceHeight = Math.min(outgoingConnections.length * 28, 128); // Max 128px (max-h-32)
      calculatedHeight += choiceHeight;
    }
    
    // Add choice button height
    calculatedHeight += 40;
    
    // Action buttons section (if present)
    calculatedHeight += 60; // Estimated action buttons section
    
    // Add some padding for safety
    calculatedHeight += 20;
    
    return {
      width: baseWidth,
      height: Math.max(calculatedHeight, DEFAULT_SCENE_MIN_HEIGHT)
    };
  };

  const handleOrganizeFlowVertically = () => {
    if (scenes.length === 0) {
      alert("No scenes to organize.");
      return;
    }

    // Safety check for very large stories
    if (scenes.length > 50) {
      const proceed = confirm(`This story has ${scenes.length} scenes. Organizing very large stories may take some time. Continue?`);
      if (!proceed) return;
    }

    try {
      // Calculate actual sizes for all scenes with safety limits
      const sceneActualSizes = new Map<string, { width: number; height: number }>();
      scenes.forEach(scene => {
        const calculatedSize = calculateSceneActualSize(scene, connections);
        // Apply safety limits to prevent excessive sizes
        const safeSize = {
          width: Math.min(calculatedSize.width, 400), // Max width limit
          height: Math.min(calculatedSize.height, 800) // Max height limit
        };
        sceneActualSizes.set(scene.id, safeSize);
      });

      // Create a map of scenes and adjacency list
      const sceneMap = new Map(scenes.map(s => [s.id, s]));
      const adj = new Map<string, string[]>();
      const inDegree = new Map<string, number>();
      
      // Initialize adjacency list and in-degree count
      scenes.forEach(s => {
        adj.set(s.id, []);
        inDegree.set(s.id, 0);
      });
      
      connections.forEach(c => {
        if (adj.has(c.fromSceneId) && sceneMap.has(c.toSceneId)) {
          adj.get(c.fromSceneId)!.push(c.toSceneId);
          inDegree.set(c.toSceneId, (inDegree.get(c.toSceneId) || 0) + 1);
        }
      });

      // Find root nodes (nodes with no incoming connections)
      const rootNodes = scenes.filter(s => inDegree.get(s.id) === 0);
      
      // If we have a designated start scene, prioritize it
      let startNodes = rootNodes;
      if (startSceneId && sceneMap.has(startSceneId)) {
        startNodes = [sceneMap.get(startSceneId)!];
        // Add other root nodes that aren't the start scene
        rootNodes.forEach(node => {
          if (node.id !== startSceneId) {
            startNodes.push(node);
          }
        });
      }

      // Perform level-based layout using BFS with cycle detection
      const levels = new Map<string, number>();
      const queue: { id: string, level: number }[] = [];
      const visited = new Set<string>();
      const processing = new Set<string>(); // For cycle detection

      // Start with root nodes at level 0
      startNodes.forEach(node => {
        if (!visited.has(node.id)) {
          queue.push({ id: node.id, level: 0 });
          visited.add(node.id);
          levels.set(node.id, 0);
        }
      });

      // BFS to assign levels with safety counter
      let iterations = 0;
      const maxIterations = scenes.length * scenes.length; // Safety limit

      while (queue.length > 0 && iterations < maxIterations) {
        iterations++;
        const { id: currentId, level: currentLevel } = queue.shift()!;
        
        // Cycle detection
        if (processing.has(currentId)) {
          console.warn(`Cycle detected at scene ${currentId}, skipping`);
          continue;
        }
        processing.add(currentId);
        
        const neighbors = adj.get(currentId) || [];
        
        for (const neighborId of neighbors) {
          if (!sceneMap.has(neighborId)) continue;
          
          const newLevel = currentLevel + 1;
          
          // Prevent excessive nesting levels
          if (newLevel > 20) {
            console.warn(`Maximum nesting level reached for scene ${neighborId}`);
            continue;
          }
          
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            levels.set(neighborId, newLevel);
            queue.push({ id: neighborId, level: newLevel });
          } else {
            // If already visited, update level if this path is longer
            const existingLevel = levels.get(neighborId)!;
            if (newLevel > existingLevel) {
              levels.set(neighborId, newLevel);
              // Re-queue to update its children
              queue.push({ id: neighborId, level: newLevel });
            }
          }
        }
        
        processing.delete(currentId);
      }

      if (iterations >= maxIterations) {
        console.warn('Flow organization reached maximum iterations, some scenes may not be properly positioned');
      }

      // Handle any unconnected scenes
      scenes.forEach(s => {
        if (!levels.has(s.id)) {
          levels.set(s.id, 0);
        }
      });

      // Group scenes by level
      const scenesByLevel = new Map<number, Scene[]>();
      levels.forEach((level, id) => {
        if (!scenesByLevel.has(level)) {
          scenesByLevel.set(level, []);
        }
        const scene = sceneMap.get(id);
        if (scene) {
          scenesByLevel.get(level)!.push(scene);
        }
      });

      // Calculate layout dimensions using actual scene sizes with safety checks
      const maxLevel = Math.max(...Array.from(scenesByLevel.keys()));
      const totalLevels = maxLevel + 1;
      
      // Calculate optimal spacing with safety limits
      const availableWidth = WORLD_WIDTH - (2 * LAYOUT_SIDE_PADDING);
      const availableHeight = WORLD_HEIGHT - (2 * LAYOUT_TOP_PADDING);
      
      // Find the level with the most total width to determine horizontal spacing
      let maxLevelWidth = 0;
      scenesByLevel.forEach((levelScenes) => {
        const levelWidth = levelScenes.reduce((sum, s) => {
          const actualSize = sceneActualSizes.get(s.id)!;
          return sum + actualSize.width;
        }, 0);
        maxLevelWidth = Math.max(maxLevelWidth, levelWidth);
      });
      
      // Always use the defined horizontal gap, don't reduce it
      const horizontalSpacing = LAYOUT_HORIZONTAL_GAP;
      
      // Calculate vertical spacing based on actual heights with safety limits
      const totalContentHeight = Array.from(scenesByLevel.entries()).reduce((sum, [, levelScenes]) => {
        const maxHeightInLevel = Math.max(...levelScenes.map(s => sceneActualSizes.get(s.id)!.height));
        return sum + Math.min(maxHeightInLevel, 800); // Apply height limit
      }, 0);
      
      // Always use the defined vertical gap, don't reduce it
      const verticalSpacing = LAYOUT_VERTICAL_GAP;

      // Position scenes using actual dimensions
      const updatedScenes = scenes.map(s => ({ ...s }));
      let currentY = LAYOUT_TOP_PADDING;

      scenesByLevel.forEach((levelScenes) => {
        // Sort scenes in each level for consistent ordering
        levelScenes.sort((a, b) => {
          // Prioritize start scene at the beginning
          if (a.id === startSceneId) return -1;
          if (b.id === startSceneId) return 1;
          // Then sort by title or id
          return (a.title || a.id).localeCompare(b.title || b.id);
        });

        // Calculate total width needed for this level using actual sizes
        const totalSceneWidth = levelScenes.reduce((sum, s) => {
          const actualSize = sceneActualSizes.get(s.id)!;
          return sum + actualSize.width;
        }, 0);
        const totalGapWidth = Math.max(0, levelScenes.length - 1) * horizontalSpacing;
        const levelWidth = totalSceneWidth + totalGapWidth;
        
        // Center the level horizontally
        let currentX = LAYOUT_SIDE_PADDING + Math.max(0, (availableWidth - levelWidth) / 2);
        
        // Find the maximum height in this level for consistent Y positioning
        const maxHeightInLevel = Math.max(...levelScenes.map(s => sceneActualSizes.get(s.id)!.height));

        levelScenes.forEach(sceneInLevel => {
          const sceneToUpdate = updatedScenes.find(s => s.id === sceneInLevel.id);
          const actualSize = sceneActualSizes.get(sceneInLevel.id)!;
          
          if (sceneToUpdate) {
            sceneToUpdate.x = currentX;
            sceneToUpdate.y = currentY;
            // Update the scene's stored dimensions to match calculated size
            sceneToUpdate.width = actualSize.width;
            sceneToUpdate.height = actualSize.height;
            
            currentX += actualSize.width + horizontalSpacing;
          }
        });
        
        // Move to next level with extra buffer to ensure no overlap
        currentY += maxHeightInLevel + verticalSpacing + 50; // Added 50px extra buffer
      });

      // Force a complete re-render by updating scenes
      setScenes([...updatedScenes]);
      
      // Reset zoom to show all scenes properly
      setZoomLevel(DEFAULT_ZOOM);
      
      // Force connections to re-render by triggering a state update
      setConnections(prevConnections => [...prevConnections]);
      
      // Scroll to top-left of canvas after organization
      setTimeout(() => {
        const canvasViewport = document.querySelector('.canvas-bg');
        if (canvasViewport) {
          canvasViewport.scrollTo(0, 0);
        }
        alert('Flow organized successfully! All scenes are now properly arranged.');
      }, 100);
      
    } catch (error) {
      console.error('Error during flow organization:', error);
      alert('An error occurred while organizing the flow. Please check the console for details.');
    }
  };

  const handlePlayStory = () => {
    if (startSceneId) {
      setIsPlaying(true);
    } else {
      alert("Please set a start scene first to play the story.");
    }
  };

  const handleClosePlayModal = () => setIsPlaying(false);


  
  const handleSaveVoiceAssignments = (assignments: VoiceAssignment[]) => {
    console.log(`[App] ✅ Receiving voice assignments:`, assignments.map(a => ({
      name: a.characterName,
      imageId: a.imageId,
      voiceId: a.voiceId
    })));
    setVoiceAssignments(assignments);
    console.log(`[App] ✅ Voice assignments updated in main state`);
  };

  const generateImagePrompts = async () => {
    setIsGeneratingPrompts(true);
    setCharacterAnalysisProgress(0);
    
    try {
      // Get OpenAI API key from environment variables
      const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
      
      if (!openaiApiKey) {
        throw new Error('OpenAI API key is missing');
      }

      console.log('[App] Generating enhanced image prompts with character analysis');
      
      // Process each scene to detect characters and generate enhanced prompts
      const updatedScenes = [...scenes];
      const detectionResults: CharacterDetectionResult[] = [];
      
      for (let i = 0; i < updatedScenes.length; i++) {
        const scene = updatedScenes[i];
        console.log(`[App] Processing scene ${i+1}/${updatedScenes.length}: ${scene.title}`);
        
        try {
          // Step 1: Analyze the scene for characters and context
          const analysisResult = analyzeScene(scene, voiceAssignments);
          detectionResults.push(analysisResult);
          
          // Update scene with detected characters and setting context
          updatedScenes[i] = {
            ...scene,
            detectedCharacters: analysisResult.detectedCharacters,
            settingContext: analysisResult.settingContext
          };
          
          console.log(`[App] Scene analysis for "${scene.title}":`, {
            characters: analysisResult.detectedCharacters,
            setting: analysisResult.settingContext
          });
          
          // Step 2: Generate simple image prompt focusing on scene and action
          const simpleResult = await generateSimpleImagePrompt(
            scene,
            analysisResult.detectedCharacters,
            analysisResult.settingContext
          );
          
          updatedScenes[i] = {
            ...updatedScenes[i],
            generatedImagePrompt: simpleResult.prompt
          };
          
          console.log(`[App] Simple prompt for scene ${scene.title}: ${simpleResult.prompt}`);
          
          // Update progress
          setCharacterAnalysisProgress(Math.round(((i + 1) / updatedScenes.length) * 100));
          
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (sceneError) {
          console.error(`[App] Error processing scene ${scene.title}:`, sceneError);
          // Continue with other scenes even if one fails
        }
      }
      
      // Update all scenes with the new prompts and analysis results
      setScenes(updatedScenes);
      console.log('[App] Finished generating enhanced image prompts');
      
    } catch (error) {
      console.error('[App] Error in generateImagePrompts:', error);
      alert(`Error generating image prompts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingPrompts(false);
      setCharacterAnalysisProgress(0);
    }
  };

  const generateSceneImageForScene = async (sceneId: string) => {
    console.log(`[App] generateSceneImageForScene called for scene ID: ${sceneId}`);
    
    // Prevent multiple simultaneous generations - clear any existing generation
    if (generatingImageForScene && generatingImageForScene !== sceneId) {
      console.log(`[App] Stopping previous image generation for scene: ${generatingImageForScene}`);
      setGeneratingImageForScene(null);
      // Add a small delay to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) {
      console.error('[App] Scene not found for ID:', sceneId);
      alert('Scene not found');
      return;
    }

    console.log('[App] OpenAI API Key status:', {
      exists: !!openaiApiKey,
      length: openaiApiKey?.length,
      startsWithSk: openaiApiKey?.startsWith('sk-')
    });

    if (!openaiApiKey) {
      console.error('[App] No OpenAI API key available');
      alert('Please set your OpenAI API key in the settings first');
      return;
    }

    if (!scene.generatedImagePrompt) {
      console.error('[App] No generated image prompt for scene:', scene.title);
      alert('Please generate an image prompt for this scene first');
      return;
    }

    // Set loading state for this specific scene
    setGeneratingImageForScene(sceneId);

    try {
      console.log(`[App] Generating image for scene: ${scene.title}`);
      
      // Step 1: Analyze scene sequence and get generation strategy
      const storyData: StoryData = { scenes, connections, startSceneId, voiceAssignments };
      const generationStrategy = getImageGenerationStrategy(scene, storyData);
      
      console.log(`[App] Generation strategy:`, {
        strategy: generationStrategy.strategy,
        sequenceType: generationStrategy.sequenceInfo.sequenceType,
        isSameLocation: generationStrategy.sequenceInfo.isSameLocation,
        hasBaseImage: !!generationStrategy.baseImageId
      });
      
      // Step 2: Use the enhanced prompt from the strategy
      const enhancedPrompt = generationStrategy.enhancedPrompt;
      console.log(`[App] Enhanced prompt: ${enhancedPrompt.substring(0, 200)}...`);
      
      // Step 3: Debug character detection and voice assignments
      console.log(`[App] DEBUG - Scene characters:`, scene.detectedCharacters);
      console.log(`[App] DEBUG - Voice assignments:`, voiceAssignments.map(va => ({
        name: va.characterName,
        hasImageId: !!va.imageId,
        imageId: va.imageId
      })));
      
      // Check for character name matching issues
      if (scene.detectedCharacters) {
        scene.detectedCharacters.forEach(charName => {
          const assignment = voiceAssignments.find(va => va.characterName === charName);
          console.log(`[App] DEBUG - Character "${charName}" -> Assignment:`, {
            found: !!assignment,
            hasImageId: !!assignment?.imageId,
            imageId: assignment?.imageId
          });
        });
      }
      
      // Step 4: Generate the image using the appropriate strategy
      let result;
      if (generationStrategy.strategy === 'image_to_image' && generationStrategy.baseImageId) {
        // TODO: Implement image-to-image generation when available
        console.log(`[App] Image-to-image generation requested but not yet implemented. Falling back to text-to-image.`);
        result = await generateSceneImageWithCharacterReferences(
          enhancedPrompt,
          scene.detectedCharacters || [],
          voiceAssignments,
          openaiApiKey
        );
      } else {
        // Standard text-to-image generation
        result = await generateSceneImageWithCharacterReferences(
          enhancedPrompt,
          scene.detectedCharacters || [],
          voiceAssignments,
          openaiApiKey
        );
      }

      if (result.success && result.imageUrl) {
        // Step 4: Save image using the new file storage system
        const imageId = await saveGeneratedImage(result.imageUrl, sceneId);
        
        if (imageId) {
          // Step 5: Update scene with location information
          const locationKey = generationStrategy.sequenceInfo.locationKey || extractLocationKey(scene);
          let updatedScene: Partial<Omit<Scene, 'id'>> = { generatedImageId: imageId };
          
          if (locationKey) {
            // Check if this is the first image for this location
            const existingLocationScene = scenes.find(s => 
              s.locationKey === locationKey && s.baseLocationImageId && s.id !== sceneId
            );
            
            if (!existingLocationScene) {
              // This is the first image for this location - set it as base reference
              updatedScene = {
                generatedImageId: imageId,
                locationKey: locationKey,
                baseLocationImageId: imageId
              };
              console.log(`[App] Set as base location image for location: ${locationKey}`);
            } else {
              // Just add the location key for consistency tracking
              updatedScene = { generatedImageId: imageId, locationKey: locationKey };
            }
          }
          
          // Step 6: Update the scene with all the new information
          updateScene(sceneId, updatedScene);
          console.log(`[App] Successfully generated and saved image for scene: ${scene.title} (ID: ${imageId})`);
          
          // Step 7: Update story data with location keys for future consistency
          setScenes(prevScenes => {
            const currentStoryData = { ...storyData, scenes: prevScenes };
            const updatedStoryData = updateStoryWithLocationKeys(currentStoryData);
            return updatedStoryData.scenes;
          });
          
        } else {
          alert('Failed to save the generated image');
        }
      } else {
        alert(`Failed to generate image: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[App] Error generating scene image:', error);
      alert(`Error generating image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Clear loading state
      setGeneratingImageForScene(null);
    }
  };

  const generateAllSceneImages = async () => {
    if (!openaiApiKey) {
      alert('Please set your OpenAI API key in the settings first');
      return;
    }

    // Check if scenes have image prompts
    const scenesWithoutPrompts = scenes.filter(scene => !scene.generatedImagePrompt);
    if (scenesWithoutPrompts.length > 0) {
      const shouldContinue = confirm(
        `${scenesWithoutPrompts.length} scenes don't have image prompts yet. ` +
        `Would you like to generate prompts for all scenes first?`
      );
      
      if (shouldContinue) {
        await generateImagePrompts();
        // Wait a moment for state to update
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        return;
      }
    }

    // Get scenes that need images (have prompts but no generated images)
    const scenesToGenerate = scenes.filter(scene => 
      scene.generatedImagePrompt && !scene.generatedImageId
    );

    if (scenesToGenerate.length === 0) {
      alert('All scenes already have images generated!');
      return;
    }

    const shouldProceed = confirm(
      `This will generate images for ${scenesToGenerate.length} scenes. ` +
      `This may take several minutes and will use your OpenAI API credits. Continue?`
    );

    if (!shouldProceed) return;

    setIsBulkGeneratingImages(true);
    setBulkImageProgress(0);

    try {
      console.log(`[App] Starting bulk image generation for ${scenesToGenerate.length} scenes`);
      
      for (let i = 0; i < scenesToGenerate.length; i++) {
        const scene = scenesToGenerate[i];
        console.log(`[App] Generating image ${i + 1}/${scenesToGenerate.length} for scene: ${scene.title}`);
        
        try {
          // Use the existing generateSceneImageForScene function
          await generateSceneImageForScene(scene.id);
          
          // Update progress
          setBulkImageProgress(Math.round(((i + 1) / scenesToGenerate.length) * 100));
          
          // Add delay between generations to avoid rate limiting
          if (i < scenesToGenerate.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
        } catch (error) {
          console.error(`[App] Error generating image for scene ${scene.title}:`, error);
          // Continue with next scene even if one fails
        }
      }
      
      console.log('[App] Bulk image generation completed');
      alert(`Successfully generated images for ${scenesToGenerate.length} scenes!`);
      
    } catch (error) {
      console.error('[App] Error in bulk image generation:', error);
      alert(`Error during bulk image generation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsBulkGeneratingImages(false);
      setBulkImageProgress(0);
    }
  };

  // Function to migrate existing beats to use speaker annotations
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
      alert(`Error during beat migration: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or check the console for details.`);
    } finally {
      setIsMigratingBeats(false);
    }
  };

  // Function to gather story context from previous scenes
  const gatherStoryContext = (currentSceneId: string): string => {
    const visited = new Set<string>();
    const storyPath: string[] = [];
    
    // Find path from start scene to current scene
    const findPath = (sceneId: string, path: string[]): boolean => {
      if (visited.has(sceneId)) return false;
      visited.add(sceneId);
      
      const scene = scenes.find(s => s.id === sceneId);
      if (!scene) return false;
      
      path.push(scene.content);
      
      if (sceneId === currentSceneId) {
        storyPath.push(...path);
        return true;
      }
      
      // Find connections leading to this scene
      const incomingConnections = connections.filter(conn => conn.toSceneId === sceneId);
      
      for (const connection of incomingConnections) {
        if (findPath(connection.fromSceneId, [...path])) {
          return true;
        }
      }
      
      return false;
    };
    
    // Start from the start scene if it exists
    if (startSceneId && startSceneId !== currentSceneId) {
      findPath(startSceneId, []);
    }
    
    // If no path found or no start scene, try to find any path to current scene
    if (storyPath.length === 0) {
      const currentScene = scenes.find(s => s.id === currentSceneId);
      if (currentScene) {
        // Get all scenes that lead to current scene
        const getParentScenes = (sceneId: string, depth = 0): string[] => {
          if (depth > 10) return []; // Prevent infinite recursion
          
          const parentConnections = connections.filter(conn => conn.toSceneId === sceneId);
          const parentTexts: string[] = [];
          
          for (const connection of parentConnections) {
            const parentScene = scenes.find(s => s.id === connection.fromSceneId);
            if (parentScene && !visited.has(parentScene.id)) {
              visited.add(parentScene.id);
              const grandParentTexts = getParentScenes(parentScene.id, depth + 1);
              parentTexts.push(...grandParentTexts, parentScene.content);
            }
          }
          
          return parentTexts;
        };
        
        visited.clear();
        const parentTexts = getParentScenes(currentSceneId);
        storyPath.push(...parentTexts);
      }
    }
    
    // Add current scene content
    const currentScene = scenes.find(s => s.id === currentSceneId);
    if (currentScene) {
      storyPath.push(currentScene.content);
    }
    
    return storyPath.join('\n\n');
  };

  // AI Story Continuation Handlers
  const handleContinueWithAI = async (sceneId: string) => {
    console.log('[App] handleContinueWithAI called with sceneId:', sceneId);
    console.log(`[App] AI continuation requested for scene: ${sceneId}`);
    setGeneratingContinuationForScene(sceneId);
    
    try {
      // Get the current scene
      const currentScene = scenes.find(s => s.id === sceneId);
      if (!currentScene) {
        throw new Error('Scene not found');
      }
      const storyContext = gatherStoryContext(sceneId);
      console.log('[App] Story context gathered:', storyContext);

      // Use AI story service for real AI generation
      const aiResponse = await aiStoryService.generateStoryContinuation({
        storyContext,
        currentScene: currentScene?.content || '',
        numberOfChoices: 0
      });
      const aiGeneratedContent = aiResponse.content;
      
      // Create new scene with AI-generated content
      const newSceneId = generateId();
      const newScene: Scene = {
        id: newSceneId,
        title: `AI Continuation from ${currentScene.title}`,
        content: aiGeneratedContent,
        x: currentScene.x + 350, // Position to the right of current scene
        y: currentScene.y,
        width: DEFAULT_SCENE_WIDTH,
        height: DEFAULT_SCENE_MIN_HEIGHT,
        detectedCharacters: [],
        settingContext: currentScene.settingContext || '',
        generatedImagePrompt: '',
        generatedImageId: undefined,
        locationKey: currentScene.locationKey || undefined,
        baseLocationImageId: currentScene.baseLocationImageId || undefined
      };

      // Add the new scene
      setScenes(prevScenes => [...prevScenes, newScene]);

      // Create connection from current scene to new scene
      const connectionId = generateId();
      const newConnection: Connection = {
        id: connectionId,
        fromSceneId: sceneId,
        toSceneId: newSceneId,
        label: 'Continue'
      };

      // Add the connection
      setConnections(prevConnections => [...prevConnections, newConnection]);

      console.log(`[App] AI continuation generated for scene: ${sceneId}, created new scene: ${newSceneId}`);
    } catch (error) {
      console.error('[App] Error generating AI continuation:', error);
      alert(`Error generating AI continuation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGeneratingContinuationForScene(null);
    }
  };

  const handleContinueWithAI2Options = async (sceneId: string) => {
    console.log('[App] handleContinueWithAI2Options called with sceneId:', sceneId);
    console.log(`[App] AI continuation with 2 options requested for scene: ${sceneId}`);
    setGeneratingContinuationForScene(sceneId);
    
    try {
      const currentScene = scenes.find(s => s.id === sceneId);
      if (!currentScene) {
        throw new Error('Scene not found');
      }

      // Gather story context from previous scenes
      const storyContext = gatherStoryContext(sceneId);
      console.log('[App] Story context gathered for 2 options:', storyContext);

      // Use AI story service for real AI generation
      const aiResponse = await aiStoryService.generateStoryContinuation({
        storyContext,
        currentScene: currentScene?.content || '',
        numberOfChoices: 2
      });
      const aiGeneratedContent = aiResponse.content;
      const aiChoices = aiResponse.choices;
      
      // Create main continuation scene
      const mainSceneId = generateId();
      const mainScene: Scene = {
        id: mainSceneId,
        title: `AI Story: ${currentScene.title} Continues`,
        content: aiGeneratedContent,
        x: currentScene.x + 350,
        y: currentScene.y,
        width: DEFAULT_SCENE_WIDTH,
        height: DEFAULT_SCENE_MIN_HEIGHT,
        detectedCharacters: [],
        settingContext: currentScene.settingContext || '',
        generatedImagePrompt: '',
        generatedImageId: undefined,
        locationKey: currentScene.locationKey || undefined,
        baseLocationImageId: currentScene.baseLocationImageId || undefined
      };

      // Create two choice scenes
      const choice1Id = generateId();
      const choice1Scene: Scene = {
        id: choice1Id,
        title: 'AI Choice 1',
        content: aiChoices?.[0] || 'Continue with the first option...',
        x: currentScene.x + 700,
        y: currentScene.y - 200,
        width: DEFAULT_SCENE_WIDTH,
        height: DEFAULT_SCENE_MIN_HEIGHT,
        detectedCharacters: [],
        settingContext: currentScene.settingContext || '',
        generatedImagePrompt: '',
        generatedImageId: undefined,
        locationKey: currentScene.locationKey || undefined,
        baseLocationImageId: currentScene.baseLocationImageId || undefined
      };

      const choice2Id = generateId();
      const choice2Scene: Scene = {
        id: choice2Id,
        title: 'AI Choice 2',
        content: aiChoices?.[1] || 'Continue with the second option...',
        x: currentScene.x + 700,
        y: currentScene.y + 200,
        width: DEFAULT_SCENE_WIDTH,
        height: DEFAULT_SCENE_MIN_HEIGHT,
        detectedCharacters: [],
        settingContext: currentScene.settingContext || '',
        generatedImagePrompt: '',
        generatedImageId: undefined,
        locationKey: currentScene.locationKey || undefined,
        baseLocationImageId: currentScene.baseLocationImageId || undefined
      };

      // Add all scenes
      setScenes(prevScenes => [...prevScenes, mainScene, choice1Scene, choice2Scene]);

      // Create connections
      const connections: Connection[] = [
        {
          id: generateId(),
          fromSceneId: sceneId,
          toSceneId: mainSceneId,
          label: 'Continue'
        },
        {
          id: generateId(),
          fromSceneId: mainSceneId,
          toSceneId: choice1Id,
          label: 'Choose path 1'
        },
        {
          id: generateId(),
          fromSceneId: mainSceneId,
          toSceneId: choice2Id,
          label: 'Choose path 2'
        }
      ];

      setConnections(prevConnections => [...prevConnections, ...connections]);

      console.log(`[App] AI continuation with 2 options generated for scene: ${sceneId}`);
    } catch (error) {
      console.error('[App] Error generating AI continuation with 2 options:', error);
      alert(`Error generating AI continuation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGeneratingContinuationForScene(null);
    }
  };

  const handleContinueWithAI3Options = async (sceneId: string) => {
    console.log('[App] handleContinueWithAI3Options called with sceneId:', sceneId);
    console.log(`[App] AI continuation with 3 options requested for scene: ${sceneId}`);
    setGeneratingContinuationForScene(sceneId);
    
    try {
      const currentScene = scenes.find(s => s.id === sceneId);
      if (!currentScene) {
        throw new Error('Scene not found');
      }

      // Gather story context from previous scenes
      const storyContext = gatherStoryContext(sceneId);
      console.log('[App] Story context gathered for 3 options:', storyContext);

      // Use AI story service for real AI generation
      const aiResponse = await aiStoryService.generateStoryContinuation({
        storyContext,
        currentScene: currentScene?.content || '',
        numberOfChoices: 3
      });
      const aiGeneratedContent = aiResponse.content;
      const aiChoices = aiResponse.choices;
      
      // Create main continuation scene
      const mainSceneId = generateId();
      const mainScene: Scene = {
        id: mainSceneId,
        title: `AI Story: ${currentScene.title} Develops`,
        content: aiGeneratedContent,
        x: currentScene.x + 350,
        y: currentScene.y,
        width: DEFAULT_SCENE_WIDTH,
        height: DEFAULT_SCENE_MIN_HEIGHT,
        detectedCharacters: [],
        settingContext: currentScene.settingContext || '',
        generatedImagePrompt: '',
        generatedImageId: undefined,
        locationKey: currentScene.locationKey || undefined,
        baseLocationImageId: currentScene.baseLocationImageId || undefined
      };

      // Create three choice scenes
      const choice1Id = generateId();
      const choice1Scene: Scene = {
        id: choice1Id,
        title: 'AI Choice 1',
        content: aiChoices?.[0] || 'Continue with the first option...',
        x: currentScene.x + 700,
        y: currentScene.y - 200,
        width: DEFAULT_SCENE_WIDTH,
        height: DEFAULT_SCENE_MIN_HEIGHT,
        detectedCharacters: [],
        settingContext: currentScene.settingContext || '',
        generatedImagePrompt: '',
        generatedImageId: undefined,
        locationKey: currentScene.locationKey || undefined,
        baseLocationImageId: currentScene.baseLocationImageId || undefined
      };

      const choice2Id = generateId();
      const choice2Scene: Scene = {
        id: choice2Id,
        title: 'AI Choice 2',
        content: aiChoices?.[1] || 'Continue with the second option...',
        x: currentScene.x + 700,
        y: currentScene.y,
        width: DEFAULT_SCENE_WIDTH,
        height: DEFAULT_SCENE_MIN_HEIGHT,
        detectedCharacters: [],
        settingContext: currentScene.settingContext || '',
        generatedImagePrompt: '',
        generatedImageId: undefined,
        locationKey: currentScene.locationKey || undefined,
        baseLocationImageId: currentScene.baseLocationImageId || undefined
      };

      const choice3Id = generateId();
      const choice3Scene: Scene = {
        id: choice3Id,
        title: 'AI Choice 3',
        content: aiChoices?.[2] || 'Continue with the third option...',
        x: currentScene.x + 700,
        y: currentScene.y + 200,
        width: DEFAULT_SCENE_WIDTH,
        height: DEFAULT_SCENE_MIN_HEIGHT,
        detectedCharacters: [],
        settingContext: currentScene.settingContext || '',
        generatedImagePrompt: '',
        generatedImageId: undefined,
        locationKey: currentScene.locationKey || undefined,
        baseLocationImageId: currentScene.baseLocationImageId || undefined
      };

      // Add all scenes
      setScenes(prevScenes => [...prevScenes, mainScene, choice1Scene, choice2Scene, choice3Scene]);

      // Create connections
      const connections: Connection[] = [
        {
          id: generateId(),
          fromSceneId: sceneId,
          toSceneId: mainSceneId,
          label: 'Continue'
        },
        {
          id: generateId(),
          fromSceneId: mainSceneId,
          toSceneId: choice1Id,
          label: 'Choose path 1'
        },
        {
          id: generateId(),
          fromSceneId: mainSceneId,
          toSceneId: choice2Id,
          label: 'Choose path 2'
        },
        {
          id: generateId(),
          fromSceneId: mainSceneId,
          toSceneId: choice3Id,
          label: 'Choose path 3'
        }
      ];

      setConnections(prevConnections => [...prevConnections, ...connections]);

      console.log(`[App] AI continuation with 3 options generated for scene: ${sceneId}`);
    } catch (error) {
      console.error('[App] Error generating AI continuation with 3 options:', error);
      alert(`Error generating AI continuation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGeneratingContinuationForScene(null);
    }
  };

  // Text Rewrite Handler
  const handleRewriteText = async (sceneId: string, level: LanguageLevel) => {
    console.log(`[App] Rewriting text for scene ${sceneId} at level ${level}`);
    setRewritingTextForScene(sceneId);
    
    try {
      // Check if OpenAI API key is set
      if (!openaiApiKey) {
        throw new Error('OpenAI API key is not set. Please configure it in Settings.');
      }
      
      // Get the current scene
      const currentScene = scenes.find(s => s.id === sceneId);
      if (!currentScene) {
        throw new Error('Scene not found');
      }
      
      // Gather story context up to this scene
      const storyContext = gatherStoryContext(sceneId);
      
      // Call the rewrite service
      const result = await textRewriteService.rewriteSceneText(
        currentScene.content,
        level,
        storyContext,
        openaiApiKey
      );
      
      if (result.success && result.rewrittenText) {
        // Update the scene with the rewritten text
        updateScene(sceneId, { content: result.rewrittenText });
        console.log(`[App] Successfully rewrote text for scene ${sceneId}`);
      } else {
        throw new Error(result.error || 'Failed to rewrite text');
      }
    } catch (error) {
      console.error('[App] Error rewriting text:', error);
      alert(`Error rewriting text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRewritingTextForScene(null);
    }
  };

  // Beat subdivision functionality
  const handleSubdivideIntoBeats = async (sceneId: string) => {
    if (!openaiApiKey) {
      alert('OpenAI API key is required for beat subdivision. Please set it in the settings.');
      return;
    }

    const currentScene = scenes.find(s => s.id === sceneId);
    if (!currentScene) {
      console.error('[App] Scene not found for beat subdivision:', sceneId);
      return;
    }

    if (!currentScene.content.trim()) {
      alert('Scene content is empty. Please add some content before subdividing into beats.');
      return;
    }

    setSubdividingSceneIntoBeats(sceneId);
    console.log(`[App] Starting beat subdivision for scene ${sceneId}`);

    try {
      const storyContext = gatherStoryContext(sceneId);
      
      const result = await beatSubdivisionService.subdivideSceneIntoBeats(
        {
          sceneContent: currentScene.content,
          sceneTitle: currentScene.title,
          storyContext,
          detectedCharacters: currentScene.detectedCharacters
        },
        openaiApiKey
      );
      
      if (result.success && result.beats) {
        // Update the scene with beats
        updateScene(sceneId, { 
          beats: result.beats,
          isSubdivided: true
        });
        console.log(`[App] Successfully subdivided scene ${sceneId} into ${result.beats.length} beats`);
        alert(`Scene successfully subdivided into ${result.beats.length} narrative beats!`);
      } else {
        throw new Error(result.error || 'Failed to subdivide scene into beats');
      }
    } catch (error) {
      console.error('[App] Error subdividing scene into beats:', error);
      alert(`Error subdividing scene: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSubdividingSceneIntoBeats(null);
    }
  };

  // Beat image generation functionality
  const handleGenerateBeatImage = async (sceneId: string, beatId: string) => {
    if (!openaiApiKey) {
      alert('OpenAI API key is required for image generation. Please set it in the settings.');
      return;
    }

    const currentScene = scenes.find(s => s.id === sceneId);
    if (!currentScene || !currentScene.beats) {
      console.error('[App] Scene or beats not found for image generation:', sceneId, beatId);
      return;
    }

    const beat = currentScene.beats.find(b => b.id === beatId);
    if (!beat) {
      console.error('[App] Beat not found for image generation:', beatId);
      return;
    }

    if (!beat.imagePrompt) {
      alert('No image prompt available for this beat.');
      return;
    }

    setGeneratingBeatImageFor({ sceneId, beatId });
    console.log(`[App] Starting image generation for beat ${beatId} in scene ${sceneId}`);

    try {
      const imageResult = await generateSceneImageWithCharacterReferences(
        beat.imagePrompt,
        currentScene.detectedCharacters || [],
        voiceAssignments,
        openaiApiKey
      );

      if (imageResult.success && imageResult.imageUrl) {
        // Save the image
        const imageId = await saveGeneratedImage(imageResult.imageUrl, `beat_${beatId}_image`);
        
        // Update the beat with the generated image
        const updatedBeats = currentScene.beats.map(b => 
          b.id === beatId ? { ...b, imageId } : b
        );
        
        updateScene(sceneId, { beats: updatedBeats });
        console.log(`[App] Successfully generated image for beat ${beatId}`);
      } else {
        throw new Error(imageResult.error || 'Failed to generate beat image');
      }
    } catch (error) {
      console.error('[App] Error generating beat image:', error);
      alert(`Error generating beat image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGeneratingBeatImageFor(null);
    }
  };

  // Bulk beat image generation functionality
  const handleGenerateAllBeatImages = async (sceneId: string) => {
    if (!openaiApiKey) {
      alert('OpenAI API key is required for image generation. Please set it in the settings.');
      return;
    }

    const currentScene = scenes.find(s => s.id === sceneId);
    if (!currentScene || !currentScene.beats) {
      console.error('[App] Scene or beats not found for bulk image generation:', sceneId);
      return;
    }

    // Debug: Log all beats and their status
    console.log(`[App] Debug - Scene has ${currentScene.beats.length} beats:`);
    currentScene.beats.forEach((beat, index) => {
      console.log(`[App] Beat ${index + 1}:`, {
        id: beat.id,
        hasImagePrompt: !!beat.imagePrompt,
        hasImageId: !!beat.imageId,
        imagePrompt: beat.imagePrompt ? beat.imagePrompt.substring(0, 50) + '...' : 'None'
      });
    });

    // Filter beats that need images (have imagePrompt but no imageId)
    const beatsNeedingImages = currentScene.beats.filter(beat => 
      beat.imagePrompt && !beat.imageId
    );

    // Also check for beats that have imagePrompt but empty/undefined imageId
    const beatsWithPromptNoImage = currentScene.beats.filter(beat => 
      beat.imagePrompt && (!beat.imageId || beat.imageId.trim() === '')
    );

    console.log(`[App] Beats needing images (strict): ${beatsNeedingImages.length}`);
    console.log(`[App] Beats with prompts but no images (flexible): ${beatsWithPromptNoImage.length}`);

    const finalBeatsToProcess = beatsWithPromptNoImage.length > 0 ? beatsWithPromptNoImage : beatsNeedingImages;

    if (finalBeatsToProcess.length === 0) {
      const totalBeats = currentScene.beats.length;
      const beatsWithPrompts = currentScene.beats.filter(beat => beat.imagePrompt).length;
      const beatsWithImages = currentScene.beats.filter(beat => beat.imageId).length;
      
      alert(`Debug Info:\n` +
            `Total beats: ${totalBeats}\n` +
            `Beats with image prompts: ${beatsWithPrompts}\n` +
            `Beats with images: ${beatsWithImages}\n\n` +
            `All beats already have images or no image prompts available.`);
      return;
    }

    console.log(`[App] Starting bulk image generation for ${finalBeatsToProcess.length} beats in scene ${sceneId}`);
    
    // Set bulk generation state
    setGeneratingBeatImageFor({ sceneId, beatId: 'bulk' });
    
    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < finalBeatsToProcess.length; i++) {
        const beat = finalBeatsToProcess[i];
        console.log(`[App] Generating image for beat ${i + 1}/${finalBeatsToProcess.length}: ${beat.id}`);

        try {
          const imageResult = await generateSceneImageWithCharacterReferences(
            beat.imagePrompt!,
            currentScene.detectedCharacters || [],
            voiceAssignments,
            openaiApiKey
          );

          if (imageResult.success && imageResult.imageUrl) {
            // Save the image
            const imageId = await saveGeneratedImage(imageResult.imageUrl, `beat_${beat.id}_image`);
            
            if (imageId) {
              // Update the beat with the generated image
              setScenes(prevScenes => 
                prevScenes.map(scene => {
                  if (scene.id === sceneId && scene.beats) {
                    const updatedBeats = scene.beats.map(b => 
                      b.id === beat.id ? { ...b, imageId } : b
                    );
                    return { ...scene, beats: updatedBeats };
                  }
                  return scene;
                })
              );
              
              successCount++;
              console.log(`[App] Successfully generated image for beat ${beat.id} (${i + 1}/${finalBeatsToProcess.length})`);
            } else {
              throw new Error('Failed to save generated image');
            }
          } else {
            throw new Error(imageResult.error || 'Failed to generate beat image');
          }
        } catch (beatError) {
          console.error(`[App] Error generating image for beat ${beat.id}:`, beatError);
          errorCount++;
        }

        // Add a small delay between requests to avoid rate limiting
        if (i < finalBeatsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Show completion message
      if (successCount > 0 && errorCount === 0) {
        alert(`Successfully generated images for all ${successCount} beats!`);
      } else if (successCount > 0 && errorCount > 0) {
        alert(`Generated images for ${successCount} beats. ${errorCount} failed.`);
      } else {
        alert(`Failed to generate images for all beats. Please check the console for details.`);
      }

    } catch (error) {
      console.error('[App] Error during bulk beat image generation:', error);
      alert(`Error during bulk image generation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGeneratingBeatImageFor(null);
    }
  };

  // Handle video upload for beats
  const handleUploadBeatVideo = async (sceneId: string, beatId: string, videoFile: File) => {
    console.log(`[App] Uploading video for beat ${beatId} in scene ${sceneId}`);
    
    try {
      // Save video blob directly to storage (using saveCharacterImage which handles blobs)
      const videoId = await saveCharacterImage(videoFile, `beat_${beatId}_video`);
      
      if (videoId) {
        // Update the beat with the video ID
        setScenes(prevScenes => 
          prevScenes.map(scene => {
            if (scene.id === sceneId && scene.beats) {
              const updatedBeats = scene.beats.map(beat => 
                beat.id === beatId ? { ...beat, videoId } : beat
              );
              return { ...scene, beats: updatedBeats };
            }
            return scene;
          })
        );
        
        console.log(`[App] Successfully uploaded video for beat ${beatId}`);
        alert('Video uploaded successfully!');
      } else {
        throw new Error('Failed to save video to storage');
      }
    } catch (error) {
      console.error(`[App] Error uploading video for beat ${beatId}:`, error);
      alert(`Error uploading video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Download all audio functionality
  const handleDownloadAllAudio = async () => {
    if (!elevenLabsApiKey) {
      alert('Please set your ElevenLabs API key in Settings first.');
      return;
    }

    // Get all available languages (English + translations)
    const availableLanguages = ['en', ...new Set(translations.map(t => t.language))];
    
    if (availableLanguages.length === 0) {
      alert('No languages available for audio download.');
      return;
    }

    // Confirm with user
    const confirmed = confirm(
      `This will download and cache audio for all beats in ${availableLanguages.length} language(s): ${availableLanguages.join(', ')}. ` +
      `This may take several minutes and use API credits. Continue?`
    );
    
    if (!confirmed) return;

    setIsDownloadingAudio(true);
    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalErrors = 0;

    try {
      console.log(`[Audio Download] Starting download for ${availableLanguages.length} languages`);
      
      for (const language of availableLanguages) {
        console.log(`[Audio Download] Processing language: ${language}`);
        
        // Get scenes for this language
        const scenesToProcess = language === 'en' ? scenes : scenes.map(scene => {
          const translation = translations.find(t => t.sceneId === scene.id && t.language === language);
          if (translation) {
            return {
              ...scene,
              title: translation.title,
              content: translation.content,
              beats: translation.beats || scene.beats
            };
          }
          return scene;
        });
        
        // Process each scene's beats
        for (const scene of scenesToProcess) {
          if (!scene.beats || scene.beats.length === 0) continue;
          
          console.log(`[Audio Download] Processing scene "${scene.title}" (${scene.beats.length} beats)`);
          
          for (const beat of scene.beats) {
            if (!beat.text) continue;
            
            totalProcessed++;
            
            try {
              // Generate unique audio ID for this beat + language combination
              const audioId = `audio_${scene.id}_${beat.id}_${language}`;
              
              // Check if audio already exists in localStorage
              const existingAudio = localStorage.getItem(audioId);
              if (existingAudio) {
                console.log(`[Audio Download] Audio already cached for beat ${beat.id} in ${language}`);
                totalSuccess++;
                continue;
              }
              
              // Parse beat text to identify speakers and generate audio
              const beatParts = beat.text.includes('[') && beat.text.includes(']') 
                ? parseBeatText(beat.text)
                : [{ text: beat.text, speaker: 'Narrator' }];
              
              for (const part of beatParts) {
                if (!part.text.trim()) continue;
                
                // Get voice for this speaker and language
                let voiceId: string | undefined;
                
                if (part.speaker === 'Narrator') {
                  voiceId = narratorVoiceAssignments[language] || narratorVoiceId || undefined;
                } else {
                  // Find character voice assignment
                  const profile = voiceAssignments.find(va => 
                    va.characterName.toLowerCase() === part.speaker.toLowerCase()
                  );
                  voiceId = profile?.voiceId;
                }
                
                if (!voiceId) {
                  console.warn(`[Audio Download] No voice found for speaker ${part.speaker} in ${language}`);
                  continue;
                }
                
                // Generate audio using ElevenLabs
                const audioResponse = await generateAudioWithAlignment(part.text, voiceId, elevenLabsApiKey);
                
                if (audioResponse && audioResponse.audio) {
                  const audioBlob = audioResponse.audio;
                  // Convert to data URL and store
                  const dataURL = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(audioBlob);
                  });
                  
                  // Store in localStorage with unique ID
                  const partAudioId = `${audioId}_${part.speaker}_${Date.now()}`;
                  localStorage.setItem(partAudioId, dataURL);
                  
                  console.log(`[Audio Download] Cached audio for ${part.speaker} in ${language}`);
                  totalSuccess++;
                } else {
                  throw new Error('Failed to generate audio');
                }
              }
              
              // Add small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 500));
              
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              console.error(`[Audio Download] Error processing beat ${beat.id} in ${language}:`, errorMessage);
              console.error(`[Audio Download] Full error details:`, error);
              totalErrors++;
            }
          }
        }
      }
      
      const message = `Audio download complete!\n` +
        `Processed: ${totalProcessed} beats\n` +
        `Success: ${totalSuccess}\n` +
        `Errors: ${totalErrors}\n` +
        `Languages: ${availableLanguages.join(', ')}`;
      
      alert(message);
      console.log('[Audio Download] Complete:', { totalProcessed, totalSuccess, totalErrors });
      
    } catch (error) {
      console.error('[Audio Download] Fatal error:', error);
      alert(`Audio download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDownloadingAudio(false);
    }
  };

  // Helper function to parse beat text with speaker annotations
  const parseBeatText = (text: string): { text: string; speaker: string }[] => {
    const parts: { text: string; speaker: string }[] = [];
    const regex = /\[([^\]]+)\]([^\[]*)/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const speaker = match[1];
      const content = match[2].trim();
      if (content) {
        parts.push({ text: content, speaker });
      }
    }
    
    return parts.length > 0 ? parts : [{ text, speaker: 'Narrator' }];
  };

  // Translation management functions
  const handleAddTranslation = (translation: Translation) => {
    setTranslations(prev => {
      const existingIndex = prev.findIndex(t => t.language === translation.language);
      if (existingIndex >= 0) {
        // Replace existing translation
        const updated = [...prev];
        updated[existingIndex] = translation;
        return updated;
      } else {
        // Add new translation
        return [...prev, translation];
      }
    });
  };



  const storyData: StoryData = { 
    scenes, 
    connections, 
    startSceneId, 
    voiceAssignments,
    translations,
    currentLanguage
  };

  return (
      <div className="flex flex-col h-screen bg-slate-900">
        <Toolbar
          onAddScene={addScene}
          onSave={handleSave}
          onExportZip={handleExportZip}
          onLoad={handleLoad}
          onImportZip={handleImportZip}
          onSetStartScene={handleSetStartScene}
          isStartSceneSet={!!startSceneId && startSceneId === activeSceneId}
          selectedSceneId={activeSceneId}
          onOrganizeFlow={handleOrganizeFlowVertically}
          onPlayStory={handlePlayStory}
          canPlayStory={!!startSceneId}
          onGenerateAllSceneImages={generateAllSceneImages}
          isBulkGeneratingImages={isBulkGeneratingImages}
          bulkImageProgress={bulkImageProgress}
          onOpenSettings={() => setIsVoiceSettingsOpen(true)}
          onDownloadAllAudio={handleDownloadAllAudio}
          isDownloadingAudio={isDownloadingAudio}
          currentLanguage={currentLanguage}
          translations={translations}
          onLanguageChange={setCurrentLanguage}
        />
        <div className="flex-1 relative overflow-hidden">
          <CanvasView
            storyData={storyData}
            onUpdateScene={updateScene}
            onDeleteScene={deleteScene}
            onAddConnection={addConnection}
            onDeleteConnection={deleteConnection}
            setActiveSceneId={setActiveSceneId}
            activeSceneId={activeSceneId}
            zoomLevel={zoomLevel}
            onGenerateSceneImageForScene={generateSceneImageForScene}
            generatingImageForScene={generatingImageForScene}
            onContinueWithAI={handleContinueWithAI}
            onContinueWithAI2Options={handleContinueWithAI2Options}
            onContinueWithAI3Options={handleContinueWithAI3Options}
            generatingContinuationForScene={generatingContinuationForScene}
            onRewriteText={handleRewriteText}
            rewritingTextForScene={rewritingTextForScene}
            onSubdivideIntoBeats={handleSubdivideIntoBeats}
            subdividingSceneIntoBeats={subdividingSceneIntoBeats}
            onGenerateBeatImage={handleGenerateBeatImage}
            onGenerateAllBeatImages={handleGenerateAllBeatImages}
            onUploadBeatVideo={handleUploadBeatVideo}
            generatingBeatImageFor={generatingBeatImageFor}
            currentLanguage={currentLanguage}
            translations={translations}
          />
          <ZoomControls
            zoomLevel={zoomLevel}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
          />
          {isPlaying && startSceneId && (
            <PlayModal
              isOpen={isPlaying}
              onClose={handleClosePlayModal}
              story={storyData}
              initialSceneId={startSceneId}
              elevenLabsApiKey={elevenLabsApiKey}
              narratorVoiceId={narratorVoiceId}
              narratorVoiceAssignments={narratorVoiceAssignments}
              currentLanguage={currentLanguage}
              translations={translations}
            />
          )}
          
          <VoiceSettingsModal
            isOpen={isVoiceSettingsOpen}
            onClose={() => setIsVoiceSettingsOpen(false)}
            currentAssignments={voiceAssignments}
            onSaveAssignments={setVoiceAssignments}
            currentElevenLabsApiKey={elevenLabsApiKey}
            onSetElevenLabsApiKey={setElevenLabsApiKey}
            currentOpenaiApiKey={openaiApiKey}
            onSetOpenaiApiKey={setOpenaiApiKey}
            onGenerateImagePrompts={generateImagePrompts}
            isGeneratingPrompts={isGeneratingPrompts}
            characterAnalysisProgress={characterAnalysisProgress}
            onGenerateAllSceneImages={generateAllSceneImages}
            isBulkGeneratingImages={isBulkGeneratingImages}
            bulkImageProgress={bulkImageProgress}
            onDownloadAllAudio={handleDownloadAllAudio}
            isDownloadingAudio={isDownloadingAudio}
            currentNarratorVoiceId={narratorVoiceId}
            onSetNarratorVoiceId={setNarratorVoiceId}
            currentNarratorVoiceAssignments={narratorVoiceAssignments}
            onSetNarratorVoiceAssignments={setNarratorVoiceAssignments}
            scenes={scenes}
            connections={connections}
            currentLanguage={currentLanguage}
            translations={translations}
            onSaveTranslations={setTranslations}
          />
        </div>
      </div>
  );
};

export default App;
