export const DEFAULT_SCENE_WIDTH = 280;
export const DEFAULT_SCENE_MIN_HEIGHT = 180;
export const ARROW_HEAD_ID = 'storyweaver-arrowhead';
export const INITIAL_START_SCENE_ID_KEY = 'initialStartSceneId'; // For local storage persistence of start scene

// Zoom and Canvas World constants
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;
export const DEFAULT_ZOOM = 1.0;
export const ZOOM_STEP = 0.1;
export const ZOOM_LEVEL_KEY = 'storyWeaverZoomLevel';

export const WORLD_WIDTH = 8000; // px
export const WORLD_HEIGHT = 6000; // px

// Auto-layout constants
export const LAYOUT_TOP_PADDING = 150;
export const LAYOUT_SIDE_PADDING = 150;
export const LAYOUT_VERTICAL_GAP = 400; // Space between levels - greatly increased to prevent overlap
export const LAYOUT_HORIZONTAL_GAP = 250; // Space between scenes on the same level - greatly increased

// API Key constants
export const GEMINI_API_KEY_LOCAL_STORAGE_KEY = 'geminiApiKey'; // Added
export const ELEVEN_LABS_API_KEY_LOCAL_STORAGE_KEY = 'elevenLabsUserApiKey';
export const OPENAI_API_KEY_LOCAL_STORAGE_KEY = 'openaiApiKey';
