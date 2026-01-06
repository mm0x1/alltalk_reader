/**
 * Offline Audio
 *
 * Functions for handling offline audio playback from embedded session data.
 */

import type { AudioSession } from './types';
import { base64ToBlob } from './utils';
import { getCachedAudioBlobsForSession } from './cache';
import {
  getAudioBlob as getIndexedDbAudioBlob,
  isIndexedDbAvailable,
} from '../storage';

/**
 * Track created Object URLs for cleanup to prevent memory leaks
 */
const createdObjectUrls: Set<string> = new Set();

/**
 * Create an Object URL and track it for later cleanup
 */
function createTrackedObjectUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  createdObjectUrls.add(url);
  return url;
}

/**
 * Revoke a previously created Object URL
 */
export function revokeAudioObjectUrl(url: string): void {
  if (url && url.startsWith('blob:') && createdObjectUrls.has(url)) {
    URL.revokeObjectURL(url);
    createdObjectUrls.delete(url);
  }
}

/**
 * Revoke all tracked Object URLs (useful for cleanup on session change)
 */
export function revokeAllAudioObjectUrls(): void {
  createdObjectUrls.forEach(url => {
    URL.revokeObjectURL(url);
  });
  createdObjectUrls.clear();
}

/**
 * Get audio blob URL for an offline session paragraph
 */
export function getOfflineAudioUrl(session: AudioSession, index: number): string | null {
  if (!session.isOfflineSession || !session.audioBlobData) {
    return null;
  }

  const key = `audio_${index}`;
  const base64Data = session.audioBlobData[key];

  if (!base64Data) {
    return null;
  }

  const blob = base64ToBlob(base64Data);
  return createTrackedObjectUrl(blob);
}

/**
 * Get audio URL for playback, checking various sources in order of preference (sync version)
 * @deprecated Use getAudioUrlForPlaybackAsync for better IndexedDB support
 */
export function getAudioUrlForPlayback(
  session: AudioSession,
  index: number,
  fallbackUrl?: string
): string | null {
  const key = `audio_${index}`;

  // First priority: Offline session with embedded audio
  if (session.isOfflineSession && session.audioBlobData && session.audioBlobData[key]) {
    return getOfflineAudioUrl(session, index);
  }

  // Second priority: Cached audio blobs (sessionStorage)
  const cachedBlobs = getCachedAudioBlobsForSession(session.id);
  if (cachedBlobs[key]) {
    return createTrackedObjectUrl(cachedBlobs[key]);
  }

  // Third priority: Original URL (may require server)
  if (session.audioUrls[index]) {
    return session.audioUrls[index];
  }

  // Fourth priority: Fallback URL
  if (fallbackUrl) {
    return fallbackUrl;
  }

  return null;
}

/**
 * Get audio URL for playback, checking various sources in order of preference (async version)
 * This version supports IndexedDB for larger audio cache capacity.
 */
export async function getAudioUrlForPlaybackAsync(
  session: AudioSession,
  index: number,
  fallbackUrl?: string
): Promise<string | null> {
  const key = `audio_${index}`;

  // First priority: Offline session with embedded audio
  if (session.isOfflineSession && session.audioBlobData && session.audioBlobData[key]) {
    return getOfflineAudioUrl(session, index);
  }

  // Second priority: IndexedDB (preferred for large sessions)
  if (isIndexedDbAvailable()) {
    try {
      const indexedDbBlob = await getIndexedDbAudioBlob(session.id, index);
      if (indexedDbBlob) {
        return createTrackedObjectUrl(indexedDbBlob);
      }
    } catch (error) {
      console.warn('IndexedDB lookup failed:', error);
    }
  }

  // Third priority: sessionStorage (legacy)
  const cachedBlobs = getCachedAudioBlobsForSession(session.id);
  if (cachedBlobs[key]) {
    return createTrackedObjectUrl(cachedBlobs[key]);
  }

  // Fourth priority: Original URL (may require server)
  if (session.audioUrls[index]) {
    return session.audioUrls[index];
  }

  // Fifth priority: Fallback URL
  if (fallbackUrl) {
    return fallbackUrl;
  }

  return null;
}
