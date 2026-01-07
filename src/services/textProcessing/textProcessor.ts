/**
 * Text Processor Service
 *
 * Main entry point for text processing. Handles:
 * - Auto-detection and parsing of AO3 pages
 * - General text splitting into paragraphs
 * - Smart paragraph detection (BETA)
 * - Chunk splitting for TTS limits
 */

import { ao3Parser, type Ao3ParseResult } from './ao3Parser';
import { paragraphDetector, type ParagraphStrategy } from './paragraphDetector';
import { API_CONFIG } from '~/config/env';

export interface ProcessedText {
  /** The processed text (AO3-parsed if applicable) */
  text: string;
  /** Whether AO3 parsing was applied */
  wasAo3Parsed: boolean;
  /** AO3 parse result details (if applicable) */
  ao3Result?: Ao3ParseResult;
}

export interface SplitOptions {
  /** Maximum length per paragraph (default: API_CONFIG.maxCharacters) */
  maxLength?: number;
  /** Enable smart paragraph detection (BETA) */
  enableSmartDetection?: boolean;
  /** Force a specific strategy (only when enableSmartDetection is true) */
  strategy?: ParagraphStrategy;
}

export class TextProcessor {
  /**
   * Process input text - auto-detects AO3 and parses if needed
   */
  processInput(text: string): ProcessedText {
    const ao3Result = ao3Parser.parse(text);

    return {
      text: ao3Result.success ? ao3Result.text : text,
      wasAo3Parsed: ao3Result.success,
      ao3Result,
    };
  }

  /**
   * Split text into paragraphs, respecting character limits
   *
   * @param text - The text to split
   * @param options - Split options (or just maxLength for backward compat)
   */
  splitIntoParagraphs(
    text: string,
    options: SplitOptions | number = {}
  ): string[] {
    // Handle backward compatibility (passing just maxLength as number)
    const opts: SplitOptions =
      typeof options === 'number' ? { maxLength: options } : options;

    const {
      maxLength = API_CONFIG.maxCharacters,
      enableSmartDetection = false,
      strategy = 'auto',
    } = opts;

    if (!text || typeof text !== 'string') return [];

    let paragraphs: string[];

    if (enableSmartDetection) {
      // Use smart paragraph detection (BETA)
      const result = paragraphDetector.split(text, strategy);
      console.log(
        `[SmartSplit] Strategy: ${result.strategy}, Confidence: ${(result.confidence * 100).toFixed(0)}%, Paragraphs: ${result.paragraphs.length}`
      );
      paragraphs = result.paragraphs;
    } else {
      // Legacy behavior: split by double newlines only
      paragraphs = text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    }

    // Post-process: ensure each paragraph respects the character limit
    return paragraphs.flatMap((paragraph) => {
      if (paragraph.length <= maxLength) {
        return [paragraph];
      }
      return this.splitTextIntoChunks(paragraph, maxLength);
    });
  }

  /**
   * Split oversized text into chunks at sentence boundaries
   */
  splitTextIntoChunks(
    text: string,
    maxLength = API_CONFIG.maxCharacters
  ): string[] {
    if (!text) return [];
    if (text.length <= maxLength) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining.trim());
        break;
      }

      const breakPoint = this.findBestBreakPoint(remaining, maxLength);
      chunks.push(remaining.slice(0, breakPoint).trim());
      remaining = remaining.slice(breakPoint).trim();
    }

    return chunks;
  }

  /**
   * Find the best point to break text (sentence > clause > word)
   */
  private findBestBreakPoint(text: string, maxLength: number): number {
    // Priority order: sentence end, semicolon, comma, space
    const breakPoints = [
      text.lastIndexOf('. ', maxLength),
      text.lastIndexOf('! ', maxLength),
      text.lastIndexOf('? ', maxLength),
      text.lastIndexOf('; ', maxLength),
      text.lastIndexOf(', ', maxLength),
      text.lastIndexOf(' ', maxLength),
    ];

    // Find the best break point (closest to maxLength but > maxLength/2)
    const minBreak = Math.floor(maxLength / 2);

    for (const point of breakPoints) {
      if (point > minBreak) {
        return point + 1; // Include the punctuation
      }
    }

    // Fallback: hard break at maxLength
    return maxLength;
  }
}

export const textProcessor = new TextProcessor();
