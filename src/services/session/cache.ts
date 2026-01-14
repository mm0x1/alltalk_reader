/**
 * Session Cache
 *
 * Functions for caching audio blobs in browser storage.
 */

import { blobToBase64, base64ToBlob } from './utils';

/**
 * Cache audio blobs for a session to enable offline export
 */
export async function cacheAudioBlobsForSession(
  sessionId: string,
  audioBlobs: Record<string, Blob>
): Promise<void> {
  const cacheKey = `audio_cache_${sessionId}`;

  try {
    const keys = Object.keys(audioBlobs);

    for (const key of keys) {
      try {
        const base64Data = await blobToBase64(audioBlobs[key]);
        sessionStorage.setItem(`${cacheKey}_${key}`, base64Data);
      } catch (error) {
        console.error(`Error caching audio blob ${key}:`, error);
      }
    }

    sessionStorage.setItem(`${cacheKey}_meta`, JSON.stringify({
      sessionId,
      keys,
      timestamp: Date.now()
    }));

    console.log(`Cached ${keys.length} audio blobs for session ${sessionId}`);
  } catch (error) {
    console.error('Error caching audio blobs:', error);
  }
}

/**
 * Get cached audio blobs for a session
 */
export function getCachedAudioBlobsForSession(sessionId: string): Record<string, Blob> {
  const cacheKey = `audio_cache_${sessionId}`;
  const blobs: Record<string, Blob> = {};

  try {
    const metaData = sessionStorage.getItem(`${cacheKey}_meta`);
    if (!metaData) {
      return blobs;
    }

    const meta = JSON.parse(metaData);

    meta.keys.forEach((key: string) => {
      const base64Data = sessionStorage.getItem(`${cacheKey}_${key}`);
      if (base64Data) {
        blobs[key] = base64ToBlob(base64Data);
      }
    });
  } catch (error) {
    console.error('Error retrieving cached audio blobs:', error);
  }

  return blobs;
}

/**
 * Clear cached audio blobs for a session
 */
export function clearCachedAudioBlobsForSession(sessionId: string): void {
  const cacheKey = `audio_cache_${sessionId}`;

  try {
    const metaData = sessionStorage.getItem(`${cacheKey}_meta`);
    if (metaData) {
      const meta = JSON.parse(metaData);
      meta.keys.forEach((key: string) => {
        sessionStorage.removeItem(`${cacheKey}_${key}`);
      });
    }
    sessionStorage.removeItem(`${cacheKey}_meta`);
  } catch (error) {
    console.error('Error clearing cached audio blobs:', error);
  }
}

/**
 * Clear all cached audio blobs from sessionStorage
 */
export function clearAllCachedAudioBlobs(): number {
  let clearedCount = 0;

  try {
    const keys = Object.keys(sessionStorage);
    const cacheKeys = keys.filter(key => key.startsWith('audio_cache_'));

    cacheKeys.forEach(key => {
      sessionStorage.removeItem(key);
      clearedCount++;
    });

    console.log(`Cleared ${clearedCount} cache entries from sessionStorage`);
  } catch (error) {
    console.error('Error clearing all cached audio blobs:', error);
  }

  return clearedCount;
}

/**
 * Get the total size of cached audio data in sessionStorage
 */
export function getCacheSize(): { entries: number; estimatedSizeKB: number } {
  let entries = 0;
  let totalSize = 0;

  try {
    const keys = Object.keys(sessionStorage);
    const cacheKeys = keys.filter(key => key.startsWith('audio_cache_'));
    entries = cacheKeys.length;

    cacheKeys.forEach(key => {
      const value = sessionStorage.getItem(key);
      if (value) {
        totalSize += value.length;
      }
    });

    const estimatedSizeKB = Math.round(totalSize / 1024);
    return { entries, estimatedSizeKB };
  } catch (error) {
    console.error('Error calculating cache size:', error);
    return { entries: 0, estimatedSizeKB: 0 };
  }
}
