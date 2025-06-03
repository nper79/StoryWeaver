export interface Scene {
  id: string;
  title: string;
  content: string;
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

export interface StoryData {
  scenes: Scene[];
  connections: Connection[];
  startSceneId?: string | null; // Optional: ID of the first scene
  voiceAssignments?: VoiceAssignment[]; 
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