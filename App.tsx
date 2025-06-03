import React, { useState, useEffect, useCallback } from 'react';
import type { Scene, Connection, StoryData, VoiceAssignment } from './types';
import Toolbar from './components/Toolbar';
import CanvasView from './components/CanvasView';
import ZoomControls from './components/ZoomControls';
import PlayModal from './components/PlayModal'; 
import VoiceSettingsModal from './components/VoiceSettingsModal';

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
  ELEVEN_LABS_API_KEY_LOCAL_STORAGE_KEY,
  OPENAI_API_KEY_LOCAL_STORAGE_KEY,
} from './constants';
import { 
  analyzeScene, 
  generateSimpleImagePrompt, 
  type CharacterDetectionResult 
} from './characterAnalysisService';
import { 
  enhancePromptWithLocationConsistency,
  extractLocationKey,
  updateStoryWithLocationKeys
} from './locationConsistencyService';
import { generateSceneImageWithCharacterReferences } from './imageGenerationService';
import { saveGeneratedImage, saveCharacterImage } from './fileStorageService';
import { exportStoryToZip, importStoryFromZip } from './backupService';

const generateId = (): string => Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
const STORY_DATA_LOCAL_STORAGE_KEY = 'interactiveStoryData';

const App: React.FC = () => {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [startSceneId, setStartSceneId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [voiceAssignments, setVoiceAssignments] = useState<VoiceAssignment[]>([]);
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string | null>(null);
  const [openaiApiKey, setOpenaiApiKey] = useState<string | null>(null);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState<boolean>(false);
  const [characterAnalysisProgress, setCharacterAnalysisProgress] = useState<number>(0);
  const [generatingImageForScene, setGeneratingImageForScene] = useState<string | null>(null);

  const loadInitialData = () => {
    const savedStory = localStorage.getItem(STORY_DATA_LOCAL_STORAGE_KEY);
    let initialScenes: Scene[] = [];
    let initialConnections: Connection[] = [];
    let initialStartSceneId: string | null = null;
    let initialVoiceAssignments: VoiceAssignment[] = [];

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
          settingContext: undefined
        }];
        initialStartSceneId = firstSceneId;
    }
    
    setScenes(initialScenes);
    setConnections(initialConnections);
    setStartSceneId(initialStartSceneId);
    setVoiceAssignments(initialVoiceAssignments);

    const savedZoom = localStorage.getItem(ZOOM_LEVEL_KEY);
    if (savedZoom) {
      const parsedZoom = parseFloat(savedZoom);
      if (!isNaN(parsedZoom) && parsedZoom >= MIN_ZOOM && parsedZoom <= MAX_ZOOM) {
        setZoomLevel(parsedZoom);
      }
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

    // IMPORTANT: Directly use the hardcoded API key from .env file
    // This is a temporary solution for development purposes only
    // In production, this should be handled more securely
    const apiKey = 'sk_5f0ee775056bc6685ae206574e0c2c2e2109556ec825b391';
    
    console.log('[App] Using hardcoded API key for development');
    console.log('[App] API key length:', apiKey.length);
    console.log('[App] API key starts with:', apiKey.substring(0, 5));
    console.log('[App] API key ends with:', apiKey.substring(apiKey.length - 5));
    
    // Set the API key directly and save to localStorage
    setElevenLabsApiKey(apiKey);
    localStorage.setItem(ELEVEN_LABS_API_KEY_LOCAL_STORAGE_KEY, apiKey);
  };

  useEffect(() => {
    loadInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const storyData: StoryData = { scenes, connections, startSceneId, voiceAssignments };
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
  }, [scenes, connections, startSceneId, voiceAssignments]);

  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_LEVEL_KEY, zoomLevel.toString());
    } catch (error) {
      console.warn("Failed to save zoom level, continuing:", error);
      // Continue working without storage - don't block the user
    }
  }, [zoomLevel]);

  const handleSetElevenLabsApiKey = (apiKey: string | null) => {
    try {
      if (apiKey) {
        localStorage.setItem(ELEVEN_LABS_API_KEY_LOCAL_STORAGE_KEY, apiKey);
        setElevenLabsApiKey(apiKey);
      } else {
        localStorage.removeItem(ELEVEN_LABS_API_KEY_LOCAL_STORAGE_KEY);
        setElevenLabsApiKey(null);
      }
    } catch (error) {
      console.warn("Failed to save ElevenLabs API key, continuing:", error);
      // Still update state even if localStorage fails
      setElevenLabsApiKey(apiKey);
    }
  };

  const handleSetOpenaiApiKey = (apiKey: string | null) => {
    try {
      if (apiKey) {
        localStorage.setItem(OPENAI_API_KEY_LOCAL_STORAGE_KEY, apiKey);
        setOpenaiApiKey(apiKey);
      } else {
        localStorage.removeItem(OPENAI_API_KEY_LOCAL_STORAGE_KEY);
        setOpenaiApiKey(null);
      }
    } catch (error) {
      console.warn("Failed to save OpenAI API key, continuing:", error);
      // Still update state even if localStorage fails
      setOpenaiApiKey(apiKey);
    }
  };

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
    const storyData: StoryData = { scenes, connections, startSceneId, voiceAssignments };
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
      const storyData: StoryData = { scenes, connections, startSceneId, voiceAssignments };
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
    setScenes(data.scenes?.map(s => ({
      ...s, 
      generatedImagePrompt: s.generatedImagePrompt || undefined,
      detectedCharacters: s.detectedCharacters || undefined,
      settingContext: s.settingContext || undefined
    })) || []); 
    setConnections(data.connections || []);
    setStartSceneId(data.startSceneId || null);
    setVoiceAssignments(data.voiceAssignments || []);
    setActiveSceneId(null); 
    setZoomLevel(DEFAULT_ZOOM); 
    setTimeout(() => alert('Story loaded successfully! Zoom has been reset. You may need to scroll or use "Organize Flow" to locate all scenes.'), 100);
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
    };

    setScenes(prev => [...prev, newTargetScene]);
    addConnection(sourceSceneId, newTargetSceneId, choiceLabel);
  };

  const handleOrganizeFlowVertically = () => {
    if (!startSceneId) {
      alert("Please set a Start Scene first before organizing the flow.");
      return;
    }

    const sceneMap = new Map(scenes.map(s => [s.id, s]));
    const adj = new Map<string, string[]>();
    scenes.forEach(s => adj.set(s.id, []));
    connections.forEach(c => {
      if (adj.has(c.fromSceneId)) {
        adj.get(c.fromSceneId)!.push(c.toSceneId);
      }
    });

    const levels = new Map<string, number>();
    const queue: { id: string, level: number }[] = [{ id: startSceneId, level: 0 }];
    const visited = new Set<string>();
    visited.add(startSceneId);
    levels.set(startSceneId, 0);

    let head = 0;
    while (head < queue.length) {
      const { id: currentId, level: currentLevel } = queue[head++];
      const neighbors = adj.get(currentId) || [];
      for (const neighborId of neighbors) {
        if (!sceneMap.has(neighborId)) continue; 

        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          levels.set(neighborId, currentLevel + 1);
          queue.push({ id: neighborId, level: currentLevel + 1 });
        } else {
          const existingLevel = levels.get(neighborId)!;
          if (currentLevel + 1 > existingLevel) {
            levels.set(neighborId, currentLevel + 1);
             const queueIndex = queue.slice(head).findIndex(item => item.id === neighborId);
             if (queueIndex !== -1) { 
                if(queue[head + queueIndex].level < currentLevel + 1) {
                    queue[head + queueIndex].level = currentLevel + 1; 
                }
             } else {
                queue.push({ id: neighborId, level: currentLevel + 1 });
             }
          }
        }
      }
    }
    
    const scenesByLevel: Map<number, Scene[]> = new Map();
    levels.forEach((level, id) => {
      if (!scenesByLevel.has(level)) scenesByLevel.set(level, []);
      const scene = sceneMap.get(id);
      if (scene) scenesByLevel.get(level)!.push(scene);
    });
    
    const maxProcessedLevel = Math.max(0, ...Array.from(scenesByLevel.keys()));
    let unreachedLevel = maxProcessedLevel + 1;
    scenes.forEach(s => {
        if(!levels.has(s.id)) {
            if(!scenesByLevel.has(unreachedLevel)) scenesByLevel.set(unreachedLevel, []);
            scenesByLevel.get(unreachedLevel)!.push(s);
            levels.set(s.id, unreachedLevel); 
        }
    });

    const updatedScenes = scenes.map(s => ({ ...s })); 

    scenesByLevel.forEach((levelScenes, level) => {
      const levelWidth = levelScenes.reduce((sum, s) => sum + (s.width || DEFAULT_SCENE_WIDTH), 0) + Math.max(0, levelScenes.length - 1) * LAYOUT_HORIZONTAL_GAP;
      let currentX = Math.max(LAYOUT_SIDE_PADDING, (WORLD_WIDTH - levelWidth) / 2); 

      levelScenes.forEach(sceneInLevel => {
        const sceneToUpdate = updatedScenes.find(s => s.id === sceneInLevel.id);
        if (sceneToUpdate) {
          sceneToUpdate.y = LAYOUT_TOP_PADDING + level * (DEFAULT_SCENE_MIN_HEIGHT + LAYOUT_VERTICAL_GAP);
          sceneToUpdate.x = currentX;
          currentX += (sceneToUpdate.width || DEFAULT_SCENE_WIDTH) + LAYOUT_HORIZONTAL_GAP;
        }
      });
    });
    
    setScenes(updatedScenes);
  };

  const handlePlayStory = () => {
    if (startSceneId) {
      setIsPlaying(true);
    } else {
      alert("Please set a start scene first to play the story.");
    }
  };

  const handleClosePlayModal = () => setIsPlaying(false);
  const handleOpenSettings = () => setIsSettingsModalOpen(true);
  const handleCloseSettings = () => setIsSettingsModalOpen(false);
  
  const handleSaveVoiceAssignments = (assignments: VoiceAssignment[]) => {
    setVoiceAssignments(assignments);
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
      
      // Step 1: Enhance prompt with location consistency
      const storyData: StoryData = { scenes, connections, startSceneId, voiceAssignments };
      const enhancedPrompt = await enhancePromptWithLocationConsistency(
        scene.generatedImagePrompt,
        scene,
        storyData
      );
      
      console.log(`[App] Enhanced prompt with location consistency: ${enhancedPrompt.substring(0, 200)}...`);
      
      // Step 2: Generate the image using the enhanced prompt
      const result = await generateSceneImageWithCharacterReferences(
        enhancedPrompt,
        scene.detectedCharacters || [],
        voiceAssignments,
        openaiApiKey
      );

      if (result.success && result.imageUrl) {
        // Step 3: Save image using the new file storage system
        const imageId = await saveGeneratedImage(result.imageUrl, sceneId);
        
        if (imageId) {
          // Step 4: Update scene with location information if this is the first image for this location
          const locationKey = scene.locationKey || extractLocationKey(scene);
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
              updatedScene = { generatedImageId: imageId, locationKey };
            }
          }
          
          // Step 5: Update the scene with all the new information
          updateScene(sceneId, updatedScene);
          console.log(`[App] Successfully generated and saved image for scene: ${scene.title} (ID: ${imageId})`);
          
          // Step 6: Update story data with location keys for future consistency
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

  const storyData: StoryData = { scenes, connections, startSceneId, voiceAssignments };

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
        onOpenSettings={handleOpenSettings}
      />
      <CanvasView
        storyData={storyData}
        onUpdateScene={updateScene}
        onDeleteScene={deleteScene}
        onAddConnection={addConnection}
        onDeleteConnection={deleteConnection}
        activeSceneId={activeSceneId}
        setActiveSceneId={setActiveSceneId}
        startSceneId={startSceneId}
        zoomLevel={zoomLevel}
        onAddMultipleOptions={handleAddThreeOptions}
        onAddTwoOptions={handleAddTwoOptions}
        onAddOneOption={handleAddOneOption}
        onAddInlineChoice={handleAddInlineChoice} 
        onUpdateConnectionLabel={updateConnectionLabel}
        onGenerateSceneImageForScene={generateSceneImageForScene}
        generatingImageForScene={generatingImageForScene}
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
        />
      )}
      <VoiceSettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={handleCloseSettings}
        currentAssignments={voiceAssignments}
        onSaveAssignments={handleSaveVoiceAssignments}
        currentElevenLabsApiKey={elevenLabsApiKey}
        onSetElevenLabsApiKey={handleSetElevenLabsApiKey}
        currentOpenaiApiKey={openaiApiKey}
        onSetOpenaiApiKey={handleSetOpenaiApiKey}
        onGenerateImagePrompts={generateImagePrompts}
        isGeneratingPrompts={isGeneratingPrompts}
        characterAnalysisProgress={characterAnalysisProgress}
      />
    </div>
  );
};

export default App;
