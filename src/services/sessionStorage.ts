/**
 * Session Storage Service
 * 
 * This service provides persistent storage for audio generation sessions,
 * stored in a file-based database on the server and with export/import capabilities
 * for offline usage.
 */

// Define the structure for our session data
export interface AudioSession {
  id: string;
  name: string; // Session name (auto-generated or user-provided)
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
  text: string; // Original text
  paragraphs: string[]; // Split paragraphs 
  audioUrls: string[]; // Generated audio URLs
  audioBlobData?: Record<string, string | null>; // Base64 encoded audio data for offline use
  audioLocalFiles?: Record<string, string>; // Local file paths for audio files
  settings: {
    voice: string;
    speed: number;
    pitch: number;
    language: string;
  };
  isOfflineSession?: boolean; // Flag to indicate if this is an imported offline session
  hasLocalAudio?: boolean; // Flag to indicate if audio data is stored locally
}

// Session Storage configuration
let SESSION_STORAGE_CONFIG = {
  protocol: 'http://',
  ipPort:
    (typeof window !== 'undefined'
      ? window.location.hostname
      : 'localhost') +
    ':3001', // Default to same hostname as the web app, port 3001
  apiPath: '/api',
  initialized: false
};

// Helper function to get the base URL for the session API
function getSessionApiUrl(): string {
  return `${SESSION_STORAGE_CONFIG.protocol}${SESSION_STORAGE_CONFIG.ipPort}${SESSION_STORAGE_CONFIG.apiPath}`;
}

// Initialize the session storage API configuration
export function initializeSessionApi(config?: Partial<typeof SESSION_STORAGE_CONFIG>): void {
  if (config) {
    SESSION_STORAGE_CONFIG = { ...SESSION_STORAGE_CONFIG, ...config };
  }

  // Set initialized to true
  SESSION_STORAGE_CONFIG.initialized = true;

  console.log(`Session API initialized with URL: ${getSessionApiUrl()}`);
}

// Get current Session API configuration
export function getSessionApiConfig() {
  return { ...SESSION_STORAGE_CONFIG };
}

/**
 * Get all saved sessions
 * 
 * @returns {Promise<AudioSession[]>} Promise with array of saved sessions
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
 * 
 * @param {string} sessionId - The ID of the session to retrieve
 * @returns {Promise<AudioSession|null>} Promise with the session or null if not found
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
 * 
 * @param {AudioSession} session - The session to save
 * @returns {Promise<boolean>} Promise resolving to true if saved successfully
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
 * 
 * @param {string} sessionId - The ID of the session to delete
 * @returns {Promise<boolean>} Promise resolving to true if deleted successfully
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
 * Generate a session name based on the text content
 * 
 * @param {string} text - The text content
 * @returns {string} A generated session name
 */
export function generateSessionName(text: string): string {
  // Take first 30 characters and clean up
  const nameBase = text.trim().substring(0, 30).replace(/\n/g, ' ');

  // Add date stamp
  const date = new Date();
  const datePart = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  return `${nameBase}... (${datePart})`;
}

/**
 * Generate a unique session ID
 * 
 * @returns {string} A unique ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if audio URLs in a session are still valid
 * This checks both online URLs and offline blob data
 * 
 * @param {AudioSession} session - The session to check
 * @returns {boolean} True if the session appears valid
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
  
  // For online sessions, check URL pattern
  for (const url of session.audioUrls) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return false;
    }
  }

  return true;
}

/**
 * Prepare a session for export by downloading audio and converting to base64
 * 
 * @param {AudioSession} session - The session to export
 * @param {(progress: number) => void} [onProgress] - Optional progress callback
 * @returns {Promise<AudioSession>} A new session object with embedded audio data
 */
export async function prepareSessionForExport(
  session: AudioSession, 
  onProgress?: (progress: number) => void
): Promise<AudioSession> {
  // Create a deep copy of the session
  const exportSession: AudioSession = JSON.parse(JSON.stringify(session));
  
  // Initialize the audio blob data object
  exportSession.audioBlobData = {};
  exportSession.isOfflineSession = true;
  
  // Download and convert each audio file
  for (let i = 0; i < session.audioUrls.length; i++) {
    try {
      // Update progress
      if (onProgress) {
        onProgress((i / session.audioUrls.length) * 100);
      }
      
      const url = session.audioUrls[i];
      if (!url) {
        exportSession.audioBlobData[`audio_${i}`] = null;
        continue;
      }
      
      // Fetch the audio file
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio file: ${response.status}`);
      }
      
      // Get the blob
      const blob = await response.blob();
      
      // Convert to base64
      const base64Data = await blobToBase64(blob);
      
      // Store in the session
      exportSession.audioBlobData[`audio_${i}`] = base64Data;
    } catch (error) {
      console.error(`Error processing audio file at index ${i}:`, error);
      exportSession.audioBlobData[`audio_${i}`] = null;
    }
  }
  
  // Set final progress
  if (onProgress) {
    onProgress(100);
  }
  
  return exportSession;
}

/**
 * Export a session to a JSON file for download
 * 
 * @param {AudioSession} exportSession - The prepared session with embedded audio
 * @returns {void}
 */
export function downloadSessionAsFile(exportSession: AudioSession): void {
  // Create a JSON string from the session
  const jsonString = JSON.stringify(exportSession, null, 2);
  
  // Create a blob from the JSON string
  const blob = new Blob([jsonString], { type: 'application/json' });
  
  // Clean up the session name for the file name
  const fileName = `alltalk-${exportSession.name.substring(0, 30)
    .replace(/\W+/g, '-')
    .toLowerCase()}-${new Date(exportSession.createdAt).toISOString().split('T')[0]}.json`;
  
  // Create a download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  
  // Click the link to download the file
  document.body.appendChild(a);
  a.click();
  
  // Clean up
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Import a session from a file
 * 
 * @param {File} file - The file to import
 * @returns {Promise<AudioSession>} The imported session
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
    
    // Read the file as text
    reader.readAsText(file);
  });
}

/**
 * Get audio blob URL for an offline session paragraph
 * 
 * @param {AudioSession} session - The offline session
 * @param {number} index - The paragraph index
 * @returns {string|null} A blob URL for the audio or null if not available
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
  
  // Convert base64 to blob
  const byteCharacters = atob(base64Data.split(',')[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'audio/wav' });
  
  // Create and return a blob URL
  return URL.createObjectURL(blob);
}

/**
 * Prepare a session for export using already-cached audio data
 * This function works even when the AllTalk server is offline by using cached blob data
 * 
 * @param {AudioSession} session - The session to export
 * @param {Record<string, Blob>} cachedAudioBlobs - Cached audio blobs by paragraph index
 * @param {(progress: number) => void} [onProgress] - Optional progress callback
 * @returns {Promise<AudioSession>} A new session object with embedded audio data
 */
export async function prepareSessionForExportFromCache(
  session: AudioSession,
  cachedAudioBlobs: Record<string, Blob>,
  onProgress?: (progress: number) => void
): Promise<AudioSession> {
  // Create a deep copy of the session
  const exportSession: AudioSession = JSON.parse(JSON.stringify(session));
  
  // Initialize the audio blob data object
  exportSession.audioBlobData = {};
  exportSession.isOfflineSession = true;
  
  // Convert each cached audio blob to base64
  for (let i = 0; i < session.paragraphs.length; i++) {
    try {
      // Update progress
      if (onProgress) {
        onProgress((i / session.paragraphs.length) * 100);
      }
      
      const key = `audio_${i}`;
      const blob = cachedAudioBlobs[key];
      
      if (!blob) {
        exportSession.audioBlobData[key] = null;
        continue;
      }
      
      // Convert to base64
      const base64Data = await blobToBase64(blob);
      
      // Store in the session
      exportSession.audioBlobData[key] = base64Data;
    } catch (error) {
      console.error(`Error processing cached audio at index ${i}:`, error);
      exportSession.audioBlobData[`audio_${i}`] = null;
    }
  }
  
  // Set final progress
  if (onProgress) {
    onProgress(100);
  }
  
  return exportSession;
}

/**
 * Cache audio blobs for a session to enable offline export
 * This should be called during pre-generation to store audio data locally
 * 
 * @param {string} sessionId - The session ID
 * @param {Record<string, Blob>} audioBlobs - Audio blobs by paragraph index
 */
export async function cacheAudioBlobsForSession(sessionId: string, audioBlobs: Record<string, Blob>): Promise<void> {
  // Store in sessionStorage or localStorage for persistence across page reloads
  const cacheKey = `audio_cache_${sessionId}`;
  
  try {
    // Convert blobs to base64 for storage
    const keys = Object.keys(audioBlobs);
    
    for (const key of keys) {
      try {
        const base64Data = await blobToBase64(audioBlobs[key]);
        // Store individual files to avoid hitting storage limits
        sessionStorage.setItem(`${cacheKey}_${key}`, base64Data);
      } catch (error) {
        console.error(`Error caching audio blob ${key}:`, error);
      }
    }
    
    // Store metadata about cached files
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
 * 
 * @param {string} sessionId - The session ID
 * @returns {Record<string, Blob>} Cached audio blobs by paragraph index
 */
export function getCachedAudioBlobsForSession(sessionId: string): Record<string, Blob> {
  const cacheKey = `audio_cache_${sessionId}`;
  const blobs: Record<string, Blob> = {};
  
  try {
    // Get metadata
    const metaData = sessionStorage.getItem(`${cacheKey}_meta`);
    if (!metaData) {
      return blobs;
    }
    
    const meta = JSON.parse(metaData);
    
    // Get each cached file
    meta.keys.forEach((key: string) => {
      const base64Data = sessionStorage.getItem(`${cacheKey}_${key}`);
      if (base64Data) {
        // Convert base64 back to blob
        const byteCharacters = atob(base64Data.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blobs[key] = new Blob([byteArray], { type: 'audio/wav' });
      }
    });
  } catch (error) {
    console.error('Error retrieving cached audio blobs:', error);
  }
  
  return blobs;
}

/**
 * Clear cached audio blobs for a session
 * 
 * @param {string} sessionId - The session ID
 */
export function clearCachedAudioBlobsForSession(sessionId: string): void {
  const cacheKey = `audio_cache_${sessionId}`;
  
  try {
    // Get metadata to know which keys to clear
    const metaData = sessionStorage.getItem(`${cacheKey}_meta`);
    if (metaData) {
      const meta = JSON.parse(metaData);
      
      // Clear each cached file
      meta.keys.forEach((key: string) => {
        sessionStorage.removeItem(`${cacheKey}_${key}`);
      });
    }
    
    // Clear metadata
    sessionStorage.removeItem(`${cacheKey}_meta`);
  } catch (error) {
    console.error('Error clearing cached audio blobs:', error);
  }
}

/**
 * Get audio URL for playback, checking various sources in order of preference
 * This function handles offline sessions, cached audio, and server URLs
 * 
 * @param {AudioSession} session - The session
 * @param {number} index - The paragraph index
 * @param {string} [fallbackUrl] - Fallback URL if other sources fail
 * @returns {string|null} Audio URL for playback
 */
export function getAudioUrlForPlayback(session: AudioSession, index: number, fallbackUrl?: string): string | null {
  const key = `audio_${index}`;
  
  // First priority: Offline session with embedded audio
  if (session.isOfflineSession && session.audioBlobData && session.audioBlobData[key]) {
    return getOfflineAudioUrl(session, index);
  }
  
  // Second priority: Cached audio blobs
  const cachedBlobs = getCachedAudioBlobsForSession(session.id);
  if (cachedBlobs[key]) {
    return URL.createObjectURL(cachedBlobs[key]);
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
 * Helper function to convert a Blob to a base64 string
 * 
 * @param {Blob} blob - The blob to convert
 * @returns {Promise<string>} A promise that resolves to the base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error('Failed to convert blob to base64'));
    };
    reader.readAsDataURL(blob);
  });
}
