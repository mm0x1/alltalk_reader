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
   * Split oversized text into chunks at sentence boundaries.
   * Every emitted chunk is guaranteed to end in terminal punctuation
   * so XTTS doesn't silently drop the tail of a chunk.
   */
  splitTextIntoChunks(
    text: string,
    maxLength = API_CONFIG.maxCharacters
  ): string[] {
    if (!text) return [];
    if (text.length <= maxLength) return [ensureTerminalPunctuation(text.trim())];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(ensureTerminalPunctuation(remaining.trim()));
        break;
      }

      const breakPoint = this.findBestBreakPoint(remaining, maxLength);
      chunks.push(ensureTerminalPunctuation(remaining.slice(0, breakPoint).trim()));
      remaining = remaining.slice(breakPoint).trim();
    }

    return chunks;
  }

  /**
   * Find the best point to break text. Sentence-terminal punctuation
   * is strongly preferred over commas/spaces because XTTS uses
   * terminal punctuation to anchor its internal chunking.
   */
  private findBestBreakPoint(text: string, maxLength: number): number {
    const minBreak = Math.floor(maxLength / 2);

    // Tier 1: sentence terminals — take the best of these if any pass minBreak
    const terminals = [
      text.lastIndexOf('. ', maxLength),
      text.lastIndexOf('! ', maxLength),
      text.lastIndexOf('? ', maxLength),
    ];
    const bestTerminal = Math.max(...terminals);
    if (bestTerminal > minBreak) return bestTerminal + 1;

    // Tier 2: weaker breaks
    const fallbacks = [
      text.lastIndexOf('; ', maxLength),
      text.lastIndexOf(', ', maxLength),
      text.lastIndexOf(' ', maxLength),
    ];
    for (const point of fallbacks) {
      if (point > minBreak) return point + 1;
    }

    return maxLength;
  }
}

const TERMINAL_PUNCTUATION = /[.!?;:]$/;

/**
 * Ensure a chunk ends with terminal punctuation so XTTS treats it as
 * a complete utterance. Appends a period when missing.
 */
function ensureTerminalPunctuation(chunk: string): string {
  if (!chunk) return chunk;
  return TERMINAL_PUNCTUATION.test(chunk) ? chunk : `${chunk}.`;
}

export const textProcessor = new TextProcessor();
