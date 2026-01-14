/**
 * ZIP Export
 *
 * Exports sessions as compressed ZIP files with chunked processing
 * to prevent memory issues with large sessions.
 */

import { zip, strToU8 } from 'fflate';
import type { AudioSession } from '../session/types';
import { getAudioBlobsForSession, hasSessionCache } from '../storage';
import { getCachedAudioBlobsForSession } from '../session/cache';
import type {
  ExportOptions,
  ExportProgress,
  ExportResult,
  ZipMetadata,
} from './types';
import {
  EXPORT_VERSION,
  METADATA_FILENAME,
  AUDIO_PREFIX,
  AUDIO_EXTENSION,
} from './types';

// Chunking configuration
const CHUNK_SIZE = 10; // Process 10 files at a time
const YIELD_INTERVAL_MS = 0; // Yield after each chunk

/**
 * Report progress with proper formatting
 */
function reportProgress(
  onProgress: ((progress: ExportProgress) => void) | undefined,
  phase: ExportProgress['phase'],
  current: number,
  total: number,
  message: string
): void {
  if (onProgress) {
    onProgress({
      phase,
      current,
      total,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
      message,
    });
  }
}

/**
 * Convert a Blob to Uint8Array
 */
async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Yield to main thread to prevent UI blocking
 */
function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => resolve(), { timeout: 50 });
    } else {
      setTimeout(resolve, YIELD_INTERVAL_MS);
    }
  });
}

/**
 * Get audio blobs from available sources (IndexedDB first, then sessionStorage)
 */
async function getAudioBlobs(
  session: AudioSession
): Promise<Record<string, Blob>> {
  // Try IndexedDB first (preferred)
  if (await hasSessionCache(session.id)) {
    const blobs = await getAudioBlobsForSession(session.id);
    if (Object.keys(blobs).length > 0) {
      return blobs;
    }
  }

  // Fallback to sessionStorage (legacy)
  const sessionStorageBlobs = getCachedAudioBlobsForSession(session.id);
  if (Object.keys(sessionStorageBlobs).length > 0) {
    return sessionStorageBlobs;
  }

  return {};
}

/**
 * Export a session to a ZIP file
 */
export async function exportSessionToZip(
  session: AudioSession,
  options: ExportOptions = { format: 'zip' }
): Promise<ExportResult> {
  const { onProgress, abortSignal } = options;

  try {
    // Phase 1: Preparing
    reportProgress(onProgress, 'preparing', 0, 100, 'Loading audio data...');

    if (abortSignal?.aborted) {
      throw new Error('Export cancelled');
    }

    // Get audio blobs from cache
    const audioBlobs = await getAudioBlobs(session);
    const audioKeys = Object.keys(audioBlobs).sort((a, b) => {
      const indexA = parseInt(a.replace('audio_', ''), 10);
      const indexB = parseInt(b.replace('audio_', ''), 10);
      return indexA - indexB;
    });

    if (audioKeys.length === 0) {
      throw new Error(
        'No cached audio found. Please pre-generate the session first.'
      );
    }

    if (audioKeys.length !== session.paragraphs.length) {
      console.warn(
        `Audio count (${audioKeys.length}) differs from paragraph count (${session.paragraphs.length})`
      );
    }

    reportProgress(
      onProgress,
      'preparing',
      100,
      100,
      `Found ${audioKeys.length} audio files`
    );

    // Phase 2: Packaging
    const totalFiles = audioKeys.length + 1; // +1 for metadata
    const zipData: Record<string, Uint8Array> = {};

    // Create metadata
    const metadata: ZipMetadata = {
      version: EXPORT_VERSION,
      exportedAt: Date.now(),
      session: {
        id: session.id,
        name: session.name,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        text: session.text,
        paragraphs: session.paragraphs,
        audioUrls: session.audioUrls,
        settings: session.settings,
        isOfflineSession: true,
        hasLocalAudio: false,
      },
    };

    zipData[METADATA_FILENAME] = strToU8(JSON.stringify(metadata, null, 2));
    reportProgress(onProgress, 'packaging', 1, totalFiles, 'Metadata created');

    // Process audio files in chunks
    for (let i = 0; i < audioKeys.length; i += CHUNK_SIZE) {
      if (abortSignal?.aborted) {
        throw new Error('Export cancelled');
      }

      const chunk = audioKeys.slice(i, Math.min(i + CHUNK_SIZE, audioKeys.length));

      // Process chunk in parallel
      await Promise.all(
        chunk.map(async (key) => {
          const blob = audioBlobs[key];
          const index = parseInt(key.replace('audio_', ''), 10);
          const fileName = `${AUDIO_PREFIX}${index}${AUDIO_EXTENSION}`;
          zipData[fileName] = await blobToUint8Array(blob);
        })
      );

      const processed = Math.min(i + CHUNK_SIZE, audioKeys.length);
      reportProgress(
        onProgress,
        'packaging',
        processed + 1,
        totalFiles,
        `Packaging audio ${processed}/${audioKeys.length}...`
      );

      // Yield to main thread
      await yieldToMainThread();
    }

    // Phase 3: Finalizing - Create ZIP
    reportProgress(onProgress, 'finalizing', 0, 100, 'Compressing...');

    if (abortSignal?.aborted) {
      throw new Error('Export cancelled');
    }

    const zipBuffer = await new Promise<Uint8Array>((resolve, reject) => {
      zip(zipData, { level: 6 }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

    reportProgress(onProgress, 'finalizing', 50, 100, 'Creating download...');

    // Create download
    const fileName = generateZipFileName(session);
    const blob = new Blob([new Uint8Array(zipBuffer)], { type: 'application/zip' });

    downloadBlob(blob, fileName);

    reportProgress(onProgress, 'finalizing', 100, 100, 'Export complete!');

    return {
      success: true,
      fileName,
      fileSizeBytes: blob.size,
      format: 'zip',
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Export failed';
    return {
      success: false,
      fileName: '',
      fileSizeBytes: 0,
      format: 'zip',
      error: errorMessage,
    };
  }
}

/**
 * Generate a filename for the ZIP export
 */
function generateZipFileName(session: AudioSession): string {
  const safeName = session.name
    .substring(0, 30)
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();

  const date = new Date(session.createdAt).toISOString().split('T')[0];
  return `alltalk-${safeName}-${date}.zip`;
}

/**
 * Trigger download of a blob
 */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;

  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 100);
}

/**
 * Estimate the final ZIP size (rough estimate for progress UI)
 */
export async function estimateZipSize(
  session: AudioSession
): Promise<{ estimatedMB: number; audioCount: number }> {
  const audioBlobs = await getAudioBlobs(session);
  const audioKeys = Object.keys(audioBlobs);

  let totalBytes = 0;
  for (const key of audioKeys) {
    totalBytes += audioBlobs[key].size;
  }

  // ZIP compression typically achieves 60-80% of original size for audio
  const estimatedBytes = Math.round(totalBytes * 0.7);
  const estimatedMB = Math.round((estimatedBytes / (1024 * 1024)) * 10) / 10;

  return {
    estimatedMB,
    audioCount: audioKeys.length,
  };
}
