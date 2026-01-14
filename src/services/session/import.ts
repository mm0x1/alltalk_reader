/**
 * Session Import
 *
 * Functions for importing sessions from files.
 */

import type { AudioSession } from './types';

/**
 * Import a session from a file
 */
export function importSessionFromFile(file: File): Promise<AudioSession> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        if (!event.target || !event.target.result) {
          throw new Error('Failed to read file');
        }

        const json = JSON.parse(event.target.result as string);

        // Validate the imported session
        if (!json.id || !json.name || !json.paragraphs || !json.audioUrls || !json.audioBlobData) {
          throw new Error('Invalid session file format');
        }

        // Make sure the session is marked as offline
        json.isOfflineSession = true;

        // Update the timestamp
        json.updatedAt = Date.now();

        resolve(json as AudioSession);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}
