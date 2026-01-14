/**
 * Generation Types
 *
 * Type definitions for the buffered playback generation system.
 */

export type BufferPlaybackStatus =
  | 'idle'
  | 'initial-buffering'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'completed'
  | 'error';

export interface BufferStatus {
  /** Indices of paragraphs that have been generated */
  generated: Set<number>;
  /** Current number of paragraphs buffered ahead of playback */
  bufferSize: number;
  /** Target buffer size (configurable) */
  targetBuffer: number;
  /** Whether generation is currently in progress */
  isGenerating: boolean;
  /** Index of the paragraph currently being generated (-1 if none) */
  generatingIndex: number;
}

export interface BufferedPlaybackState {
  status: BufferPlaybackStatus;
  currentParagraph: number;
  bufferStatus: BufferStatus;
  error?: string;
}

export interface BufferedPlaybackConfig {
  /** Target number of paragraphs to buffer ahead (default: 5) */
  targetBufferSize: number;
  /** Minimum buffer size before pausing playback (default: 2) */
  minBufferSize: number;
  /** Maximum concurrent generations (default: 1 - AllTalk limitation) */
  maxConcurrent: number;
}

export interface GeneratedAudio {
  index: number;
  url: string;
  generatedAt: number;
}

export interface GenerationProgress {
  index: number;
  url: string;
}

export interface GenerationControllerCallbacks {
  onProgress: (progress: GenerationProgress) => void;
  onError: (index: number, error: Error) => void;
  onComplete: () => void;
}
