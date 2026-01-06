/**
 * ZIP Import
 *
 * Imports sessions from ZIP files with chunked processing
 * and stores audio in IndexedDB.
 */

import { unzip, strFromU8 } from 'fflate';
import type { AudioSession } from '../session/types';
import {
  storeAudioBlobsForSession,
  isIndexedDbAvailable,
} from '../storage';
import type {
  ImportOptions,
  ImportProgress,
  ImportResult,
  ValidationResult,
  ZipMetadata,
} from './types';
import {
  EXPORT_VERSION,
  METADATA_FILENAME,
  AUDIO_PREFIX,
  AUDIO_EXTENSION,
} from './types';

// Chunking configuration
const CHUNK_SIZE = 10;

/**
 * Report progress with proper formatting
 */
function reportProgress(
  onProgress: ((progress: ImportProgress) => void) | undefined,
  phase: ImportProgress['phase'],
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
 * Yield to main thread to prevent UI blocking
 */
function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => resolve(), { timeout: 50 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Read a File as ArrayBuffer
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Validate a ZIP file before full import
 */
export async function validateZipSession(
  file: File
): Promise<ValidationResult> {
  try {
    // Check file type
    if (!file.name.endsWith('.zip')) {
      return { valid: false, error: 'File must be a ZIP archive' };
    }

    // Read and unzip
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const zipData = await new Promise<Record<string, Uint8Array>>(
      (resolve, reject) => {
        unzip(new Uint8Array(arrayBuffer), (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      }
    );

    // Check for metadata file
    if (!zipData[METADATA_FILENAME]) {
      return { valid: false, error: 'Missing metadata.json - invalid export file' };
    }

    // Parse and validate metadata
    const metadataJson = strFromU8(zipData[METADATA_FILENAME]);
    const metadata = JSON.parse(metadataJson) as ZipMetadata;

    if (!metadata.version || !metadata.session) {
      return { valid: false, error: 'Invalid metadata structure' };
    }

    if (metadata.version > EXPORT_VERSION) {
      return {
        valid: false,
        error: `Export version ${metadata.version} is newer than supported version ${EXPORT_VERSION}`,
      };
    }

    const { session } = metadata;
    if (!session.id || !session.paragraphs || !Array.isArray(session.paragraphs)) {
      return { valid: false, error: 'Invalid session structure' };
    }

    // Count audio files
    const audioFiles = Object.keys(zipData).filter(
      (name) => name.startsWith(AUDIO_PREFIX) && name.endsWith(AUDIO_EXTENSION)
    );

    if (audioFiles.length === 0) {
      return { valid: false, error: 'No audio files found in archive' };
    }

    if (audioFiles.length !== session.paragraphs.length) {
      console.warn(
        `Audio file count (${audioFiles.length}) differs from paragraph count (${session.paragraphs.length})`
      );
    }

    return {
      valid: true,
      metadata,
      audioCount: audioFiles.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Validation failed';
    return { valid: false, error: message };
  }
}

/**
 * Import a session from a ZIP file
 */
export async function importSessionFromZip(
  file: File,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const { onProgress, abortSignal } = options;

  try {
    // Phase 1: Reading
    reportProgress(onProgress, 'reading', 0, 100, 'Reading file...');

    if (abortSignal?.aborted) {
      throw new Error('Import cancelled');
    }

    const arrayBuffer = await readFileAsArrayBuffer(file);

    reportProgress(onProgress, 'reading', 100, 100, 'File read complete');

    // Phase 2: Validating
    reportProgress(onProgress, 'validating', 0, 100, 'Validating archive...');

    if (abortSignal?.aborted) {
      throw new Error('Import cancelled');
    }

    const zipData = await new Promise<Record<string, Uint8Array>>(
      (resolve, reject) => {
        unzip(new Uint8Array(arrayBuffer), (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      }
    );

    // Validate structure
    if (!zipData[METADATA_FILENAME]) {
      throw new Error('Missing metadata.json - invalid export file');
    }

    const metadataJson = strFromU8(zipData[METADATA_FILENAME]);
    const metadata = JSON.parse(metadataJson) as ZipMetadata;

    if (!metadata.session?.id || !metadata.session?.paragraphs) {
      throw new Error('Invalid session metadata');
    }

    reportProgress(onProgress, 'validating', 100, 100, 'Validation complete');

    // Phase 3: Extracting audio files
    const audioFiles = Object.keys(zipData)
      .filter(
        (name) => name.startsWith(AUDIO_PREFIX) && name.endsWith(AUDIO_EXTENSION)
      )
      .sort((a, b) => {
        const indexA = parseInt(a.replace(AUDIO_PREFIX, '').replace(AUDIO_EXTENSION, ''), 10);
        const indexB = parseInt(b.replace(AUDIO_PREFIX, '').replace(AUDIO_EXTENSION, ''), 10);
        return indexA - indexB;
      });

    const audioBlobs: Record<string, Blob> = {};
    const total = audioFiles.length;

    for (let i = 0; i < audioFiles.length; i += CHUNK_SIZE) {
      if (abortSignal?.aborted) {
        throw new Error('Import cancelled');
      }

      const chunk = audioFiles.slice(i, Math.min(i + CHUNK_SIZE, audioFiles.length));

      for (const fileName of chunk) {
        const index = parseInt(
          fileName.replace(AUDIO_PREFIX, '').replace(AUDIO_EXTENSION, ''),
          10
        );
        const data = zipData[fileName];
        audioBlobs[`audio_${index}`] = new Blob([new Uint8Array(data)], { type: 'audio/wav' });
      }

      const processed = Math.min(i + CHUNK_SIZE, audioFiles.length);
      reportProgress(
        onProgress,
        'extracting',
        processed,
        total,
        `Extracting audio ${processed}/${total}...`
      );

      await yieldToMainThread();
    }

    // Phase 4: Storing in IndexedDB
    let audioStoredInIndexedDb = false;

    if (isIndexedDbAvailable()) {
      reportProgress(onProgress, 'storing', 0, 100, 'Storing audio...');

      if (abortSignal?.aborted) {
        throw new Error('Import cancelled');
      }

      await storeAudioBlobsForSession(
        metadata.session.id,
        audioBlobs,
        (progress) => {
          reportProgress(
            onProgress,
            'storing',
            Math.round(progress),
            100,
            `Storing audio ${Math.round(progress)}%...`
          );
        }
      );

      audioStoredInIndexedDb = true;
      reportProgress(onProgress, 'storing', 100, 100, 'Audio stored');
    }

    // Build the session object
    const session: AudioSession = {
      ...metadata.session,
      isOfflineSession: true,
      updatedAt: Date.now(),
      // If not stored in IndexedDB, embed base64 data for backwards compatibility
      audioBlobData: audioStoredInIndexedDb ? undefined : await convertToBase64(audioBlobs),
    };

    return {
      success: true,
      session,
      audioStoredInIndexedDb,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Import failed';
    return {
      success: false,
      session: null,
      audioStoredInIndexedDb: false,
      error: errorMessage,
    };
  }
}

/**
 * Convert blobs to base64 for legacy fallback
 */
async function convertToBase64(
  blobs: Record<string, Blob>
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  for (const [key, blob] of Object.entries(blobs)) {
    result[key] = await blobToBase64(blob);
  }

  return result;
}

/**
 * Convert a single blob to base64
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert blob to base64'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Detect file format (ZIP or JSON)
 */
export function detectFileFormat(file: File): 'zip' | 'json' | 'unknown' {
  if (file.name.endsWith('.zip')) {
    return 'zip';
  }
  if (file.name.endsWith('.json')) {
    return 'json';
  }
  return 'unknown';
}
