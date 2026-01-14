/**
 * AO3 Page Parser
 *
 * Parses full AO3 page text to extract chapter content.
 */

import { AO3_CONFIG, type Ao3MarkerConfig } from './ao3Config';

export interface Ao3ParseResult {
  /** Whether the text was detected as an AO3 page */
  isAo3: boolean;
  /** Whether parsing was successful */
  success: boolean;
  /** The parsed/extracted text (or original if parsing failed) */
  text: string;
  /** Extracted metadata (if available) */
  metadata?: {
    chapterTitle?: string;
    hasSummary: boolean;
    hasNotes: boolean;
  };
  /** Error message if parsing failed */
  error?: string;
}

export class Ao3Parser {
  constructor(private config: Ao3MarkerConfig = AO3_CONFIG) {}

  /**
   * Detect if the given text appears to be from an AO3 page
   */
  isAo3Page(text: string): boolean {
    // Must match at least 2 detection patterns to be considered AO3
    const matchCount = this.config.detectionPatterns.filter((pattern) =>
      pattern.test(text)
    ).length;
    return matchCount >= 2;
  }

  /**
   * Parse AO3 page text and extract chapter content
   */
  parse(text: string): Ao3ParseResult {
    // Check if this looks like AO3 content
    if (!this.isAo3Page(text)) {
      return {
        isAo3: false,
        success: false,
        text: text,
        error: 'Text does not appear to be from AO3',
      };
    }

    try {
      const extracted = this.extractChapterContent(text);
      return {
        isAo3: true,
        success: true,
        text: extracted.content,
        metadata: {
          chapterTitle: extracted.chapterTitle,
          hasSummary: extracted.hasSummary,
          hasNotes: extracted.hasNotes,
        },
      };
    } catch (error) {
      return {
        isAo3: true,
        success: false,
        text: text, // Return original on failure
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      };
    }
  }

  /**
   * Extract chapter content from AO3 page
   */
  private extractChapterContent(text: string): {
    content: string;
    chapterTitle?: string;
    hasSummary: boolean;
    hasNotes: boolean;
  } {
    const lines = text.split('\n');
    const result: string[] = [];

    let chapterTitle: string | undefined;
    let hasSummary = false;
    let hasNotes = false;

    // State machine for parsing
    type ParseState =
      | 'seeking'
      | 'in_summary'
      | 'in_notes'
      | 'in_chapter'
      | 'done';
    let state: ParseState = 'seeking';

    // Track if we've found the chapter title (appears before Summary)
    let foundChapterTitleBeforeSummary = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Check for end marker
      if (
        state !== 'seeking' &&
        trimmedLine === this.config.endMarkers.actions
      ) {
        state = 'done';
        break;
      }

      // State transitions
      switch (state) {
        case 'seeking':
          // Look for chapter title first (it appears before Summary)
          if (
            !foundChapterTitleBeforeSummary &&
            this.config.includeStartMarkers.chapterTitle.test(trimmedLine)
          ) {
            chapterTitle = trimmedLine;
            foundChapterTitleBeforeSummary = true;
            result.push(trimmedLine);
            result.push('');
          }
          // Look for Summary section
          else if (trimmedLine === this.config.includeStartMarkers.summary) {
            hasSummary = true;
            result.push(trimmedLine);
            result.push('');
            state = 'in_summary';
          }
          break;

        case 'in_summary':
          // Summary ends when Notes starts
          if (trimmedLine === this.config.includeStartMarkers.notes) {
            hasNotes = true;
            result.push(trimmedLine);
            result.push('');
            state = 'in_notes';
          }
          // Or when Chapter Text starts (no Notes section)
          else if (
            trimmedLine === this.config.includeStartMarkers.chapterText
          ) {
            // Check for chapter title right before "Chapter Text"
            if (
              i > 0 &&
              this.config.includeStartMarkers.chapterTitle.test(
                lines[i - 1].trim()
              )
            ) {
              result.push(lines[i - 1].trim());
            }
            result.push(trimmedLine);
            result.push('');
            state = 'in_chapter';
          }
          // Include summary content
          else if (
            trimmedLine.length > 0 &&
            !this.isExcludedLine(trimmedLine)
          ) {
            result.push(line); // Preserve original indentation
          }
          break;

        case 'in_notes':
          // Notes end when Chapter Text starts
          if (trimmedLine === this.config.includeStartMarkers.chapterText) {
            // Check for chapter title right before "Chapter Text"
            if (
              i > 0 &&
              this.config.includeStartMarkers.chapterTitle.test(
                lines[i - 1].trim()
              )
            ) {
              result.push(lines[i - 1].trim());
            }
            result.push(trimmedLine);
            result.push('');
            state = 'in_chapter';
          }
          // Include notes content
          else if (
            trimmedLine.length > 0 &&
            !this.isExcludedLine(trimmedLine)
          ) {
            result.push(line);
          }
          break;

        case 'in_chapter':
          // Include all chapter content until "Actions"
          result.push(line);
          break;
      }
    }

    // Clean up the result
    const content = result
      .join('\n')
      .replace(/\n{3,}/g, '\n\n') // Normalize multiple blank lines
      .trim();

    return {
      content,
      chapterTitle,
      hasSummary,
      hasNotes,
    };
  }

  /**
   * Check if a line should be excluded based on patterns
   */
  private isExcludedLine(line: string): boolean {
    return this.config.excludePatterns.some((pattern) => pattern.test(line));
  }
}

export const ao3Parser = new Ao3Parser();
