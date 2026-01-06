/**
 * Storage Types
 *
 * Type definitions for IndexedDB audio storage.
 */

export interface AudioCacheEntry {
  id: string; // `${sessionId}_${index}`
  sessionId: string;
  index: number;
  blob: Blob;
  createdAt: number;
}

export interface SessionCacheMetadata {
  sessionId: string;
  audioCount: number;
  totalSizeBytes: number;
  createdAt: number;
  updatedAt: number;
}

export interface StorageStats {
  totalSessions: number;
  totalAudioFiles: number;
  totalSizeBytes: number;
  estimatedSizeMB: number;
}

export interface MigrationProgress {
  total: number;
  migrated: number;
  failed: number;
  currentSession: string | null;
}

export type MigrationProgressCallback = (progress: MigrationProgress) => void;
