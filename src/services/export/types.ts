/**
 * Export/Import Types
 *
 * Type definitions for session export and import operations.
 */

import type { AudioSession } from '../session/types';

export type ExportFormat = 'zip' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  onProgress?: (progress: ExportProgress) => void;
  abortSignal?: AbortSignal;
}

export interface ExportProgress {
  phase: 'preparing' | 'packaging' | 'finalizing';
  current: number;
  total: number;
  percentage: number;
  message: string;
}

export interface ImportOptions {
  onProgress?: (progress: ImportProgress) => void;
  abortSignal?: AbortSignal;
}

export interface ImportProgress {
  phase: 'reading' | 'validating' | 'extracting' | 'storing';
  current: number;
  total: number;
  percentage: number;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  metadata?: ZipMetadata;
  audioCount?: number;
}

export interface ZipMetadata {
  version: number;
  exportedAt: number;
  session: Omit<AudioSession, 'audioBlobData'>;
}

export interface ExportResult {
  success: boolean;
  fileName: string;
  fileSizeBytes: number;
  format: ExportFormat;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  session: AudioSession | null;
  audioStoredInIndexedDb: boolean;
  error?: string;
}

export const EXPORT_VERSION = 1;
export const METADATA_FILENAME = 'metadata.json';
export const AUDIO_PREFIX = 'audio_';
export const AUDIO_EXTENSION = '.wav';
