/**
 * Session Storage Service
 * 
 * This service provides persistent storage for audio generation sessions,
 * stored in a file-based database on the server.
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
  settings: {
    voice: string;
    speed: number;
    pitch: number;
    language: string;
  };
}

// Session Storage configuration
let SESSION_STORAGE_CONFIG = {
  protocol: 'http://',
  ipPort: window.location.hostname + ':3001', // Default to same hostname as the web app, port 3001
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
 * This does a basic check by testing if the URLs match expected pattern
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
  
  // Check if URLs follow expected pattern
  for (const url of session.audioUrls) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return false;
    }
  }
  
  return true;
}
