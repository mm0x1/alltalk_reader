/**
 * Paragraph Detection Configuration
 *
 * Configurable patterns and thresholds for smart paragraph detection.
 */

export interface ParagraphConfig {
  /**
   * Detection thresholds (as ratios of total lines)
   * Used to determine which strategy to apply
   */
  thresholds: {
    /** Minimum ratio of double newlines to consider that strategy */
    doubleNewlineRatio: number;
    /** Minimum ratio of indented lines to use indentation strategy */
    indentationRatio: number;
    /** Minimum ratio of single newline + capital patterns */
    singleNewlineRatio: number;
  };

  /**
   * Patterns that always create a paragraph break (scene breaks)
   */
  sceneBreakPatterns: RegExp[];

  /**
   * Target length for sentence-based splitting (wall of text)
   */
  targetParagraphLength: number;

  /**
   * Minimum paragraph length to avoid micro-splits
   */
  minParagraphLength: number;

  /**
   * Maximum paragraph length (API limit)
   */
  maxParagraphLength: number;
}

/**
 * Default configuration for paragraph detection
 */
export const DEFAULT_PARAGRAPH_CONFIG: ParagraphConfig = {
  thresholds: {
    doubleNewlineRatio: 0.03, // 3% of lines have double newlines
    indentationRatio: 0.08, // 8% of lines start with indent
    singleNewlineRatio: 0.1, // 10% have sentence end + newline + capital
  },

  sceneBreakPatterns: [
    /^[-*_~]{3,}\s*$/m, // --- or *** or ___ (3+ chars)
    /^\*\s+\*\s+\*\s*$/m, // * * *
    /^#\s+#\s+#\s*$/m, // # # #
    /^~\s+~\s+~\s*$/m, // ~ ~ ~
  ],

  targetParagraphLength: 1000, // ~1000 chars per paragraph for wall-of-text
  minParagraphLength: 50, // Merge paragraphs smaller than this
  maxParagraphLength: 4096, // Hard API limit
};
