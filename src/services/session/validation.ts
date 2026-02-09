/**
 * Session Validation
 *
 * Functions to validate session data integrity.
 */

import type { AudioSession } from './types';

/**
 * Check if audio URLs in a session are still valid
 * This checks both online URLs and offline blob data
 */
export function isSessionValid(session: AudioSession): boolean {
  // Basic validation checks
  if (!session || !session.id || !session.paragraphs || !session.audioUrls) {
    return false;
  }

  // Check if we have URLs for each paragraph
  if (session.paragraphs.length !== session.audioUrls.length) {
    return false;
  }

  // If offline session, check if we have blob data
  if (session.isOfflineSession) {
    if (!session.audioBlobData) return false;

    // Check if we have data for each paragraph
    for (let i = 0; i < session.paragraphs.length; i++) {
      const key = `audio_${i}`;
      if (!session.audioBlobData[key]) {
        return false;
      }
    }
    return true;
  }

  // For online sessions, check URL pattern (accept both full URLs and relative paths)
  for (const url of session.audioUrls) {
    if (!url || typeof url !== 'string' || (!url.startsWith('http') && !url.startsWith('/'))) {
      return false;
    }
  }

  return true;
}
