export interface BeatPart {
  speaker: string; // Character name ("Narrator", "Lucy", etc.)
  text: string; // What they say
  voiceId?: string; // Resolved voice ID for this speaker
}

export interface Beat {
  id: string;
  text: string; // Keep for backward compatibility
  imagePrompt?: string;
  imageId?: string;
  videoId?: string; // New: Video ID for uploaded video
  speaker?: string; // Keep for backward compatibility
  order: number; // Order within the scene
  parts?: BeatPart[]; // New: Multiple speaking parts within this beat
}

export interface Scene {
  id: string;
  title: string;
  content: string; // Keep for backward compatibility
  x: number;
  y: number;
  width: number;
  height: number; // Can be dynamic based on content, but having a base helps
  generatedImagePrompt?: string; // Added for AI-generated image prompts
  generatedImageId?: string; // Changed: Now stores image ID instead of data URL
  detectedCharacters?: string[]; // Characters detected in this scene
  settingContext?: string; // Setting/location context from this or previous scenes
  locationKey?: string; // Key to identify the location/setting for consistency
  baseLocationImageId?: string; // Reference image for this location to maintain consistency
  beats?: Beat[]; // New: Array of beats for subdivided scenes
  isSubdivided?: boolean; // Flag to indicate if scene has been subdivided into beats
}

export interface Connection {
  id:string;
  fromSceneId: string;
  toSceneId: string;
  label: string;
}

export interface VoiceAssignment {
  characterName: string;
  voiceId: string;
  imageId?: string; // Changed: Now stores image ID instead of data URL
}

// Multilingual support types
export interface Translation {
  id: string;
  language: string; // Language code (e.g., 'en', 'es', 'pt')
  sceneId: string;
  title: string;
  content: string;
  beats?: {
    id: string;
    text: string;
    imagePrompt?: string;
  }[];
  createdAt: string;
  version: number;
}

// Translation for connection labels
export interface ConnectionTranslation {
  id: string;
  language: string;
  connectionId: string;
  label: string;
}

export interface NarratorVoiceAssignments {
  [language: string]: string; // language code -> voice ID
}

export interface StoryData {
  scenes: Scene[];
  connections: Connection[];
  startSceneId?: string | null; // Optional: ID of the first scene
  voiceAssignments?: VoiceAssignment[]; 
  narratorVoiceId?: string; // Voice ID for the narrator throughout the story
  narratorVoiceAssignments?: NarratorVoiceAssignments; // Voice assignments per language
  translations?: Translation[]; // Translations for all scenes
  connectionTranslations?: ConnectionTranslation[]; // Translations for connection labels
  currentLanguage?: string; // Current active language
}

export interface Point {
  x: number;
  y: number;
}

export type PortSide = 'left' | 'right' | 'top' | 'bottom';

// Data passed when a connection drag starts
export interface ConnectionDragStartData {
    sceneId: string;
    portPosition: Point; // Absolute position of the port on the canvas
}

// For ElevenLabs service
export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  // Add other relevant fields from the API response if needed for display/filtering
}