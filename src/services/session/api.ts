/**
 * Session API
 *
 * CRUD operations for session storage via the Express server.
 */

import type { AudioSession, SessionStorageConfig } from './types';

let SESSION_STORAGE_CONFIG: SessionStorageConfig = {
  protocol: 'http://',
  ipPort:
    (typeof window !== 'undefined'
      ? window.location.hostname
      : 'localhost') + ':3001',
  apiPath: '/api',
  initialized: false
};

function getSessionApiUrl(): string {
  return `${SESSION_STORAGE_CONFIG.protocol}${SESSION_STORAGE_CONFIG.ipPort}${SESSION_STORAGE_CONFIG.apiPath}`;
}

/**
 * Initialize the session storage API configuration
 */
export function initializeSessionApi(config?: Partial<SessionStorageConfig>): void {
  if (config) {
    SESSION_STORAGE_CONFIG = { ...SESSION_STORAGE_CONFIG, ...config };
  }
  SESSION_STORAGE_CONFIG.initialized = true;
  console.log(`Session API initialized with URL: ${getSessionApiUrl()}`);
}

/**
 * Get current Session API configuration
 */
export function getSessionApiConfig(): SessionStorageConfig {
  return { ...SESSION_STORAGE_CONFIG };
}

/**
 * Get all saved sessions
 */
export async function getAllSessions(): Promise<AudioSession[]> {
  try {
    const apiUrl = getSessionApiUrl();
    console.log(`Fetching sessions from: ${apiUrl}/sessions`);

    const response = await fetch(`${apiUrl}/sessions`);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    return data.success ? data.sessions : [];
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    return [];
  }
}

/**
 * Get a specific session by ID
 */
export async function getSessionById(sessionId: string): Promise<AudioSession | null> {
  try {
    const apiUrl = getSessionApiUrl();
    const response = await fetch(`${apiUrl}/sessions/${sessionId}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    return data.success ? data.session : null;
  } catch (error) {
    console.error(`Failed to fetch session ${sessionId}:`, error);
    return null;
  }
}

/**
 * Save a new session
 */
export async function saveSession(session: AudioSession): Promise<boolean> {
  try {
    const apiUrl = getSessionApiUrl();
    console.log(`Saving session to: ${apiUrl}/sessions`);

    const response = await fetch(`${apiUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(session),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Failed to save session:', error);
    return false;
  }
}

/**
 * Delete a session by ID
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const apiUrl = getSessionApiUrl();
    const response = await fetch(`${apiUrl}/sessions/${sessionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error(`Failed to delete session ${sessionId}:`, error);
    return false;
  }
}

/**
 * Update a session's playback position
 */
export async function updateSessionPosition(
  sessionId: string,
  paragraphIndex: number
): Promise<boolean> {
  try {
    const apiUrl = getSessionApiUrl();
    const response = await fetch(`${apiUrl}/sessions/${sessionId}/position`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastPlaybackPosition: {
          paragraphIndex,
          timestamp: Date.now()
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error(`Failed to update session position ${sessionId}:`, error);
    return false;
  }
}

/**
 * Update a session's name
 */
export async function updateSessionName(
  sessionId: string,
  name: string
): Promise<boolean> {
  try {
    const apiUrl = getSessionApiUrl();
    const response = await fetch(`${apiUrl}/sessions/${sessionId}/name`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error(`Failed to update session name ${sessionId}:`, error);
    return false;
  }
}
