/**
 * AllTalk API Service
 * 
 * This service handles all interactions with the AllTalk API, following best practices
 * from the documentation. It provides methods for checking server status, fetching
 * available voices and settings, and generating TTS audio.
 */

// API base configuration
const API_CONFIG = {
  protocol: 'http://',
  ipPort: 'localhost:7851',
  connectionTimeout: 5, // seconds
  maxCharacters: 4096, // Maximum characters allowed per TTS request
};

// Server status and available resources
let SERVER_STATUS: {
  ready: boolean;
  error: string | null;
  currentSettings: any;
  availableVoices: string[];
  availableRvcVoices: string[];
} = {
  ready: false,
  error: null,
  currentSettings: null,
  availableVoices: [],
  availableRvcVoices: [],
};

// Returns the base URL for the API
const getBaseUrl = () => {
  return `${API_CONFIG.protocol}${API_CONFIG.ipPort}`;
};

/**
 * Check if the AllTalk server is ready
 * 
 * @returns {Promise<boolean>} True if server is ready, false otherwise
 */
export async function checkServerReady() {
  const baseUrl = getBaseUrl();
  const startTime = Date.now();
  const timeout = API_CONFIG.connectionTimeout * 1000;
  
  SERVER_STATUS.error = null;
  
  try {
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`${baseUrl}/api/ready`);
        const text = await response.text();
        
        if (text === 'Ready') {
          SERVER_STATUS.ready = true;
          return true;
        }
      } catch (error) {
        // Keep trying until timeout
      }
      
      // Wait a short time before trying again
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // If we get here, the server didn't respond in time
    SERVER_STATUS.ready = false;
    SERVER_STATUS.error = 'Server did not respond in time. Check if AllTalk is running.';
    return false;
  } catch (error) {
    SERVER_STATUS.ready = false;
    SERVER_STATUS.error = `Error connecting to server: ${error instanceof Error ? error.message : String(error)}`;
    return false;
  }
}

/**
 * Initialize the API service by checking server status and fetching settings and voices
 * 
 * @returns {Promise<boolean>} True if initialization was successful
 */
export async function initializeApi() {
  if (!(await checkServerReady())) {
    return false;
  }
  
  try {
    // Get current settings, voices, and RVC voices in parallel
    const [settingsSuccess, voicesSuccess, rvcVoicesSuccess] = await Promise.all([
      getCurrentSettings(),
      getAvailableVoices(),
      getAvailableRvcVoices(),
    ]);
    
    return settingsSuccess && voicesSuccess && rvcVoicesSuccess;
  } catch (error) {
    SERVER_STATUS.error = `Error initializing API: ${error instanceof Error ? error.message : String(error)}`;
    return false;
  }
}

/**
 * Fetch current settings from the server
 * 
 * @returns {Promise<boolean>} True if settings were successfully retrieved
 */
export async function getCurrentSettings() {
  const baseUrl = getBaseUrl();
  
  try {
    const response = await fetch(`${baseUrl}/api/currentsettings`);
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    SERVER_STATUS.currentSettings = data;
    return true;
  } catch (error) {
    SERVER_STATUS.error = `Error fetching settings: ${error instanceof Error ? error.message : String(error)}`;
    return false;
  }
}

/**
 * Fetch available voices from the server
 * 
 * @returns {Promise<boolean>} True if voices were successfully retrieved
 */
export async function getAvailableVoices() {
  const baseUrl = getBaseUrl();
  
  try {
    const response = await fetch(`${baseUrl}/api/voices`);
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    SERVER_STATUS.availableVoices = data.voices || [];
    return true;
  } catch (error) {
    SERVER_STATUS.error = `Error fetching voices: ${error instanceof Error ? error.message : String(error)}`;
    return false;
  }
}

/**
 * Fetch available RVC voices from the server
 * 
 * @returns {Promise<boolean>} True if RVC voices were successfully retrieved
 */
export async function getAvailableRvcVoices() {
  const baseUrl = getBaseUrl();
  
  try {
    const response = await fetch(`${baseUrl}/api/rvcvoices`);
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    SERVER_STATUS.availableRvcVoices = data.voices || [];
    return true;
  } catch (error) {
    SERVER_STATUS.error = `Error fetching RVC voices: ${error instanceof Error ? error.message : String(error)}`;
    return false;
  }
}

/**
 * Reload the server configuration
 * 
 * @returns {Promise<boolean>} True if configuration was successfully reloaded
 */
export async function reloadConfig() {
  const baseUrl = getBaseUrl();
  
  try {
    const response = await fetch(`${baseUrl}/api/reload_config`);
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    // After reloading config, re-fetch settings and voices
    await initializeApi();
    return true;
  } catch (error) {
    SERVER_STATUS.error = `Error reloading config: ${error instanceof Error ? error.message : String(error)}`;
    return false;
  }
}

/**
 * Generate Text-to-Speech audio
 * 
 * @param {string} text - Text to convert to speech
 * @param {Object} options - Options for the TTS generation
 * @returns {Promise<Object|null>} Response from the server or null if failed
 */
export async function generateTTS(text: string, options: any = {}) {
  const baseUrl = getBaseUrl();
  
  // Check text length against maximum allowed
  if (text.length > API_CONFIG.maxCharacters) {
    console.warn(`Text length (${text.length}) exceeds maximum allowed characters (${API_CONFIG.maxCharacters}).`);
    console.warn('Text will be truncated.');
    text = text.substring(0, API_CONFIG.maxCharacters);
  }
  
  // Prepare the request payload with defaults
  const payload = new URLSearchParams({
    text_input: text,
    text_filtering: options.textFiltering || 'standard',
    character_voice_gen: options.characterVoice || 'female_01.wav',
    narrator_enabled: options.narratorEnabled ? 'true' : 'false',
    narrator_voice_gen: options.narratorVoice || '',
    text_not_inside: options.textNotInside || 'character',
    language: options.language || 'en',
    output_file_name: options.outputFileName || `alltalk_output_${Date.now()}`,
    output_file_timestamp: options.outputFileTimestamp ? 'true' : 'false',
    autoplay: 'false'
  });
  
  // Only add optional parameters if they are defined
  if (options.speed !== undefined) {
    payload.append('speed', options.speed.toString());
  }
  
  if (options.pitch !== undefined) {
    payload.append('pitch', options.pitch.toString());
  }
  
  if (options.temperature !== undefined) {
    payload.append('temperature', options.temperature.toString());
  }
  
  if (options.repetitionPenalty !== undefined) {
    payload.append('repetition_penalty', options.repetitionPenalty.toString());
  }
  
  try {
    const response = await fetch(`${baseUrl}/api/tts-generate`, {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.status === 'generate-success') {
      // Return successful result, including the full URL for the audio file
      return { 
        ...result,
        fullAudioUrl: `${baseUrl}${result.output_file_url}`
      };
    } else {
      throw new Error(`TTS generation failed: ${result.status}`);
    }
  } catch (error) {
    SERVER_STATUS.error = `Error generating TTS: ${error instanceof Error ? error.message : String(error)}`;
    return null;
  }
}

/**
 * Split text into chunks that respect the maximum character limit
 * 
 * @param {string} text - Text to split
 * @param {number} maxLength - Maximum length of each chunk
 * @returns {string[]} Array of text chunks
 */
export function splitTextIntoChunks(text: string, maxLength = API_CONFIG.maxCharacters): string[] {
  if (!text) return [];
  
  // If text is under the limit, return it as a single chunk
  if (text.length <= maxLength) {
    return [text];
  }
  
  const chunks = [];
  let remainingText = text;
  
  while (remainingText.length > 0) {
    if (remainingText.length <= maxLength) {
      // Add the remaining text as the last chunk
      chunks.push(remainingText);
      break;
    }
    
    // Find a good break point within the maxLength
    let breakPoint = remainingText.lastIndexOf('.', maxLength);
    
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      // If no period found or it's too early, try semicolon
      breakPoint = remainingText.lastIndexOf(';', maxLength);
    }
    
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      // If no semicolon found or it's too early, try comma
      breakPoint = remainingText.lastIndexOf(',', maxLength);
    }
    
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      // If no comma found or it's too early, try space
      breakPoint = remainingText.lastIndexOf(' ', maxLength);
    }
    
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      // If no good break point found, just break at the maximum length
      breakPoint = maxLength;
    }
    
    // Add the chunk and remove it from the remaining text
    chunks.push(remainingText.substring(0, breakPoint + 1).trim());
    remainingText = remainingText.substring(breakPoint + 1).trim();
  }
  
  return chunks;
}

/**
 * Split text into paragraphs and ensure each paragraph respects character limits
 * 
 * @param {string} text - The text to split
 * @returns {string[]} Array of paragraphs, each within the character limit
 */
export function splitIntoParagraphs(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  
  // First split by double newlines (common paragraph separator)
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  // Then ensure each paragraph respects the character limit
  const maxLength = API_CONFIG.maxCharacters;
  
  // Process each paragraph and flatten the result
  return paragraphs.flatMap(paragraph => {
    if (paragraph.length <= maxLength) {
      return [paragraph];
    }
    
    // If a paragraph is too long, split it into chunks
    return splitTextIntoChunks(paragraph, maxLength);
  });
}

/**
 * Get the current server status
 * 
 * @returns {Object} Current server status
 */
export function getServerStatus() {
  return { ...SERVER_STATUS };
}

/**
 * Get the current API configuration
 * 
 * @returns {Object} Current API configuration
 */
export function getApiConfig() {
  return { ...API_CONFIG };
}

/**
 * Update API configuration
 * 
 * @param {Object} newConfig - New configuration parameters
 */
export function updateApiConfig(newConfig: any) {
  Object.assign(API_CONFIG, newConfig);
}

/**
 * Get a list of available voices in a user-friendly format
 * 
 * @returns {Array<Object>} Array of voice objects with id and name properties
 */
export function getVoiceOptions() {
  if (!SERVER_STATUS.ready || !SERVER_STATUS.availableVoices || SERVER_STATUS.availableVoices.length === 0) {
    return [
      { id: 'female_01.wav', name: 'Female 1' },
      { id: 'female_02.wav', name: 'Female 2' },
      { id: 'male_01.wav', name: 'Male 1' },
      { id: 'male_02.wav', name: 'Male 2' }
    ];
  }
  
  // Transform the voice list into a user-friendly format
  return SERVER_STATUS.availableVoices.map(voice => ({
    id: voice,
    name: voice.replace('.wav', '').replace(/_/g, ' ')
  }));
}

// Initialize API on service load
initializeApi().catch(error => {
  console.error('Failed to initialize API:', error);
});
