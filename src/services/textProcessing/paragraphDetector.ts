/**
 * Smart Paragraph Detector
 *
 * Analyzes text to determine the best paragraph splitting strategy
 * and applies it to create natural paragraph breaks.
 */

import {
  DEFAULT_PARAGRAPH_CONFIG,
  type ParagraphConfig,
} from './paragraphConfig';

export type ParagraphStrategy =
  | 'double-newline'
  | 'indentation'
  | 'single-newline'
  | 'sentence-based'
  | 'auto';

export interface DetectionResult {
  /** Strategy that was used */
  strategy: ParagraphStrategy;
  /** Confidence score (0-1) */
  confidence: number;
  /** Split paragraphs */
  paragraphs: string[];
  /** Detection statistics */
  stats: {
    totalChars: number;
    totalLines: number;
    paragraphCount: number;
    avgParagraphLength: number;
  };
}

export interface AnalysisResult {
  strategy: ParagraphStrategy;
  confidence: number;
  counts: {
    doubleNewlines: number;
    indentedLines: number;
    singleNewlineWithCaps: number;
    sceneBreaks: number;
    totalLines: number;
  };
}

export class ParagraphDetector {
  constructor(private config: ParagraphConfig = DEFAULT_PARAGRAPH_CONFIG) {}

  /**
   * Analyze text and determine the best splitting strategy
   */
  analyze(text: string): AnalysisResult {
    const lines = text.split('\n');
    const totalLines = lines.length;

    // Count pattern occurrences
    const doubleNewlines = (text.match(/\n\s*\n/g) || []).length;
    const indentedLines = (text.match(/(?:^|\n)[ \t]+[A-Z]/g) || []).length;
    const singleNewlineWithCaps = (text.match(/[.!?"']\s*\n[A-Z]/g) || []).length;
    const sceneBreaks = this.config.sceneBreakPatterns.reduce(
      (count, pattern) => count + (text.match(pattern) || []).length,
      0
    );

    // Calculate ratios
    const doubleNewlineRatio = totalLines > 0 ? doubleNewlines / totalLines : 0;
    const indentationRatio = totalLines > 0 ? indentedLines / totalLines : 0;
    const singleNewlineRatio =
      totalLines > 0 ? singleNewlineWithCaps / totalLines : 0;

    // Determine best strategy based on thresholds
    let strategy: ParagraphStrategy = 'sentence-based';
    let confidence = 0.5;

    if (doubleNewlineRatio >= this.config.thresholds.doubleNewlineRatio) {
      strategy = 'double-newline';
      confidence = Math.min(doubleNewlineRatio * 10, 1);
    } else if (indentationRatio >= this.config.thresholds.indentationRatio) {
      strategy = 'indentation';
      confidence = Math.min(indentationRatio * 5, 1);
    } else if (singleNewlineRatio >= this.config.thresholds.singleNewlineRatio) {
      strategy = 'single-newline';
      confidence = Math.min(singleNewlineRatio * 5, 1);
    }

    return {
      strategy,
      confidence,
      counts: {
        doubleNewlines,
        indentedLines,
        singleNewlineWithCaps,
        sceneBreaks,
        totalLines,
      },
    };
  }

  /**
   * Split text using the specified or auto-detected strategy
   */
  split(text: string, strategy: ParagraphStrategy = 'auto'): DetectionResult {
    if (!text || typeof text !== 'string') {
      return this.createResult('sentence-based', 0, []);
    }

    // First, handle scene breaks (always applied)
    const sectionsWithBreaks = this.splitAtSceneBreaks(text);

    // Determine strategy if auto
    let selectedStrategy = strategy;
    let confidence = 1;

    if (strategy === 'auto') {
      const analysis = this.analyze(text);
      selectedStrategy = analysis.strategy;
      confidence = analysis.confidence;
    }

    // Apply the selected strategy to each section
    const paragraphs: string[] = [];

    for (const section of sectionsWithBreaks) {
      if (!section.trim()) continue;

      let sectionParagraphs: string[];

      switch (selectedStrategy) {
        case 'double-newline':
          sectionParagraphs = this.splitByDoubleNewline(section);
          break;
        case 'indentation':
          sectionParagraphs = this.splitByIndentation(section);
          break;
        case 'single-newline':
          sectionParagraphs = this.splitBySingleNewline(section);
          break;
        case 'sentence-based':
        default:
          sectionParagraphs = this.splitBySentence(section);
          break;
      }

      paragraphs.push(...sectionParagraphs);
    }

    // Post-process: merge tiny paragraphs
    const normalizedParagraphs = this.mergeTinyParagraphs(paragraphs);

    return this.createResult(selectedStrategy, confidence, normalizedParagraphs);
  }

  /**
   * Split at scene breaks (always applied first)
   */
  private splitAtSceneBreaks(text: string): string[] {
    let sections = [text];

    for (const pattern of this.config.sceneBreakPatterns) {
      sections = sections.flatMap((section) => {
        const parts = section.split(pattern);
        return parts.filter((p) => p.trim().length > 0);
      });
    }

    return sections;
  }

  /**
   * Strategy 1: Split by double newlines (legacy behavior)
   */
  private splitByDoubleNewline(text: string): string[] {
    return text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  /**
   * Strategy 2: Split by indentation (PDF/book style)
   */
  private splitByIndentation(text: string): string[] {
    const lines = text.split('\n');
    const paragraphs: string[] = [];
    let currentParagraph = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Check if line starts with whitespace (indentation)
      const isIndented = /^[ \t]+/.test(line) && /^[A-Z]/.test(trimmedLine);

      if (isIndented && currentParagraph.length > 0) {
        // New paragraph starts with indentation
        paragraphs.push(currentParagraph.trim());
        currentParagraph = trimmedLine;
      } else {
        // Continue current paragraph
        currentParagraph += (currentParagraph ? ' ' : '') + trimmedLine;
      }
    }

    if (currentParagraph.trim()) {
      paragraphs.push(currentParagraph.trim());
    }

    return paragraphs;
  }

  /**
   * Strategy 3: Split by single newline after sentence end
   */
  private splitBySingleNewline(text: string): string[] {
    // Split on newlines that follow sentence-ending punctuation
    // and precede a capital letter
    const parts = text.split(/(?<=[.!?"'])\s*\n(?=[A-Z])/);

    return parts
      .map((p) => p.trim().replace(/\n/g, ' '))
      .filter((p) => p.length > 0);
  }

  /**
   * Strategy 4: Split by sentences (for wall-of-text)
   * Uses Intl.Segmenter for locale-aware sentence boundaries
   */
  private splitBySentence(text: string): string[] {
    const targetLength = this.config.targetParagraphLength;

    // Normalize the text first (replace newlines with spaces)
    const normalizedText = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

    // Try to use Intl.Segmenter (modern browsers)
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      try {
        return this.splitBySentenceWithSegmenter(normalizedText, targetLength);
      } catch {
        // Fall back to regex-based splitting
        console.warn(
          '[ParagraphDetector] Intl.Segmenter failed, using fallback'
        );
      }
    }

    // Fallback: regex-based sentence splitting
    return this.splitBySentenceWithRegex(normalizedText, targetLength);
  }

  /**
   * Sentence splitting using Intl.Segmenter (preferred)
   */
  private splitBySentenceWithSegmenter(
    text: string,
    targetLength: number
  ): string[] {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
    const segments = Array.from(segmenter.segment(text));

    const paragraphs: string[] = [];
    let currentChunk = '';

    for (const { segment } of segments) {
      // If adding this sentence would exceed target length
      // (and we already have some content), push the current chunk
      if (
        currentChunk.length + segment.length > targetLength &&
        currentChunk.length > 0
      ) {
        paragraphs.push(currentChunk.trim());
        currentChunk = segment;
      } else {
        currentChunk += segment;
      }
    }

    if (currentChunk.trim()) {
      paragraphs.push(currentChunk.trim());
    }

    return paragraphs;
  }

  /**
   * Sentence splitting using regex (fallback for older browsers)
   */
  private splitBySentenceWithRegex(text: string, targetLength: number): string[] {
    // Simple sentence detection regex
    // Handles: periods, exclamation, question marks followed by space and capital
    const sentencePattern = /[^.!?]+[.!?]+(?:\s|$)/g;
    const sentences = text.match(sentencePattern) || [text];

    const paragraphs: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (
        currentChunk.length + sentence.length > targetLength &&
        currentChunk.length > 0
      ) {
        paragraphs.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.trim()) {
      paragraphs.push(currentChunk.trim());
    }

    return paragraphs;
  }

  /**
   * Post-process: merge tiny paragraphs into previous ones
   */
  private mergeTinyParagraphs(paragraphs: string[]): string[] {
    if (paragraphs.length <= 1) return paragraphs;

    const minLength = this.config.minParagraphLength;
    const result: string[] = [];

    for (const paragraph of paragraphs) {
      if (paragraph.length < minLength && result.length > 0) {
        // Merge with previous paragraph
        result[result.length - 1] += ' ' + paragraph;
      } else {
        result.push(paragraph);
      }
    }

    return result;
  }

  /**
   * Create a detection result object
   */
  private createResult(
    strategy: ParagraphStrategy,
    confidence: number,
    paragraphs: string[]
  ): DetectionResult {
    const totalChars = paragraphs.reduce((sum, p) => sum + p.length, 0);

    return {
      strategy,
      confidence,
      paragraphs,
      stats: {
        totalChars,
        totalLines: paragraphs.length,
        paragraphCount: paragraphs.length,
        avgParagraphLength:
          paragraphs.length > 0 ? totalChars / paragraphs.length : 0,
      },
    };
  }
}

export const paragraphDetector = new ParagraphDetector();
