/**
 * Session Types
 *
 * Type definitions for audio sessions and storage configuration.
 */

export interface LastPlaybackPosition {
  paragraphIndex: number;
  timestamp: number;
}

export interface AudioSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  text: string;
  paragraphs: string[];
  audioUrls: string[];
  audioBlobData?: Record<string, string | null>;
  audioLocalFiles?: Record<string, string>;
  settings: {
    voice: string;
    speed: number;
    pitch: number;
    language: string;
  };
  isOfflineSession?: boolean;
  hasLocalAudio?: boolean;
  lastPlaybackPosition?: LastPlaybackPosition;
}

export interface SessionStorageConfig {
  protocol: string;
  ipPort: string;
  apiPath: string;
  initialized: boolean;
}
