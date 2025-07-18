/**
 * AllTalk TTS API utility functions using the standard TTS generation endpoint
 */

// Default API base URL
const API_BASE_URL = 'http://localhost:7851';

// Default voice and language settings
const DEFAULT_VOICE = 'female_01.wav';
const DEFAULT_LANGUAGE = 'en';

/**
 * Generate TTS audio for a text paragraph
 * 
 * @param text The text to convert to speech
 * @param options Configuration options
 * @returns Promise that resolves with the audio URL when complete
 */
export async function generateSpeech(
  text: string,
  options: {
    characterVoice?: string;
    language?: string;
    outputFileName?: string;
    baseUrl?: string;
    speed?: number;
    pitch?: number;
  } = {}
): Promise<string | null> {
  if (!text || text.trim() === '') {
    return null;
  }
  
  const {
    characterVoice = DEFAULT_VOICE,
    language = DEFAULT_LANGUAGE,
    outputFileName = `paragraph_${Date.now()}`,
    baseUrl = API_BASE_URL,
    speed,
    pitch,
  } = options;
  
  // Prepare the payload
  const payload = new URLSearchParams({
    text_input: text,
    text_filtering: 'standard',
    character_voice_gen: characterVoice,
    narrator_enabled: 'false',
    text_not_inside: 'character',
    language: language,
    output_file_name: outputFileName,
    output_file_timestamp: 'true',
    autoplay: 'false'
  });
  
  // Only add optional parameters if they're defined
  if (speed !== undefined) {
    payload.append('speed', speed.toString());
  }
  
  if (pitch !== undefined) {
    payload.append('pitch', pitch.toString());
  }
  
  try {
    // Send POST request to the API
    const response = await fetch(`${baseUrl}/api/tts-generate`, {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.status === 'generate-success') {
      // Return the audio URL for playback
      return `${baseUrl}${result.output_file_url}`;
    } else {
      console.error('TTS generation failed:', result);
      return null;
    }
  } catch (error) {
    console.error('Error generating TTS:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Play a paragraph of text using the AllTalk API
 * 
 * @param text Text to be spoken
 * @param options Configuration options
 * @returns Promise that resolves with the audio element when playback starts
 */
export async function playParagraph(
  text: string,
  options: {
    voice?: string;
    language?: string;
    speed?: number;
    pitch?: number;
    onEnd?: () => void;
    onError?: (error: any) => void;
    onLoading?: () => void;
    onLoaded?: () => void;
  } = {}
): Promise<HTMLAudioElement | null> {
  const { voice, language, speed, pitch, onEnd, onError, onLoading, onLoaded } = options;
  
  if (onLoading) {
    onLoading();
  }
  
  try {
    const audioUrl = await generateSpeech(text, {
      characterVoice: voice,
      language,
      speed,
      pitch,
      outputFileName: `paragraph_${Date.now()}`,
    });
    
    if (!audioUrl) {
      throw new Error('Failed to generate speech');
    }
    
    const audio = new Audio(audioUrl);
    
    if (onEnd) {
      audio.onended = onEnd;
    }
    
    if (onError) {
      audio.onerror = (e) => onError(e);
    }
    
    if (onLoaded) {
      audio.oncanplaythrough = onLoaded;
    }
    
    // Start playback
    await audio.play();
    
    return audio;
  } catch (error) {
    console.error('Failed to play audio:', error instanceof Error ? error.message : String(error));
    if (onError) onError(error);
    return null;
  }
}

/**
 * Split text into paragraphs
 * 
 * @param text The text to split
 * @returns An array of paragraphs
 */
export function splitIntoParagraphs(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  
  // Split by double newlines (common paragraph separator)
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

// Available voices in the AllTalk API
export const availableVoices = [
  { id: 'female_01.wav', name: 'Female 1' },
  { id: 'female_02.wav', name: 'Female 2' },
  { id: 'male_01.wav', name: 'Male 1' },
  { id: 'male_02.wav', name: 'Male 2' }
];
