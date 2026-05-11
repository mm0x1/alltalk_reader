/**
 * TTS Service
 * 
 * Handles text-to-speech generation and text processing.
 * Extracted from alltalkApi.ts for better separation of concerns.
 */

import { apiClient } from './client';
import { API_CONFIG, getBaseUrl } from '~/config/env';
import { API_ENDPOINTS } from '~/design-system/constants';

export interface TtsOptions {
  textFiltering?: string;
  characterVoice?: string;
  narratorEnabled?: boolean;
  narratorVoice?: string;
  textNotInside?: string;
  language?: string;
  outputFileName?: string;
  outputFileTimestamp?: boolean;
  speed?: number;
  pitch?: number;
  temperature?: number;
  repetitionPenalty?: number;
}

export interface TtsResult {
  status: string;
  output_file_url: string;
  fullAudioUrl: string;
}

const TERMINAL_PUNCTUATION = /[.!?;:]$/;

function ensureTerminalPunctuation(chunk: string): string {
  if (!chunk) return chunk;
  return TERMINAL_PUNCTUATION.test(chunk) ? chunk : `${chunk}.`;
}

export class TtsService {
  constructor(private client = apiClient) {}

  async generateTTS(text: string, options: TtsOptions = {}): Promise<TtsResult | null> {
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
      // Debug logging to diagnose the issue
      const url = `${getBaseUrl()}${API_ENDPOINTS.TTS_GENERATE}`;
      console.log('🔍 TTS Debug Info:');
      console.log('URL:', url);
      console.log('Payload:', payload.toString());
      console.log('Headers:', { 'Content-Type': 'application/x-www-form-urlencoded' });

      const response = await fetch(url, {
        method: 'POST',
        body: payload,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🚨 TTS API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ TTS API Success Response:', result);

      if (result.status === 'generate-success') {
        // Return successful result, including the full URL for the audio file
        return {
          ...result,
          fullAudioUrl: `${getBaseUrl()}${result.output_file_url}`
        };
      } else {
        throw new Error(`TTS generation failed: ${result.status}`);
      }
    } catch (error) {
      console.error('Error generating TTS:', error);
      return null;
    }
  }

  splitTextIntoChunks(text: string, maxLength = API_CONFIG.maxCharacters): string[] {
    if (!text) return [];
    if (text.length <= maxLength) return [ensureTerminalPunctuation(text.trim())];

    const chunks: string[] = [];
    let remainingText = text;
    const minBreak = Math.floor(maxLength / 2);

    while (remainingText.length > 0) {
      if (remainingText.length <= maxLength) {
        chunks.push(ensureTerminalPunctuation(remainingText.trim()));
        break;
      }

      // Prefer sentence-terminal punctuation (XTTS uses these as chunk anchors)
      const terminals = [
        remainingText.lastIndexOf('.', maxLength),
        remainingText.lastIndexOf('!', maxLength),
        remainingText.lastIndexOf('?', maxLength),
      ];
      let breakPoint = Math.max(...terminals);

      if (breakPoint < minBreak) {
        // Fallback: weaker boundaries
        const fallbacks = [
          remainingText.lastIndexOf(';', maxLength),
          remainingText.lastIndexOf(',', maxLength),
          remainingText.lastIndexOf(' ', maxLength),
        ];
        breakPoint = -1;
        for (const point of fallbacks) {
          if (point > minBreak) {
            breakPoint = point;
            break;
          }
        }
      }

      if (breakPoint < minBreak) breakPoint = maxLength - 1;

      chunks.push(
        ensureTerminalPunctuation(remainingText.substring(0, breakPoint + 1).trim())
      );
      remainingText = remainingText.substring(breakPoint + 1).trim();
    }

    return chunks;
  }

  splitIntoParagraphs(text: string): string[] {
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
      return this.splitTextIntoChunks(paragraph, maxLength);
    });
  }
}

export const ttsService = new TtsService();
