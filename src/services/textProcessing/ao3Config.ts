/**
 * AO3 Parser Configuration
 *
 * Centralized configuration for AO3 page structure markers.
 * Update these values if AO3 changes their page format.
 */

export interface Ao3MarkerConfig {
  /** Patterns that indicate the start of content to INCLUDE */
  includeStartMarkers: {
    /** Chapter title pattern (e.g., "Chapter 1: Title" or just "Chapter 1") */
    chapterTitle: RegExp;
    /** Summary section header */
    summary: string;
    /** Notes section header */
    notes: string;
    /** Marker that precedes actual story content */
    chapterText: string;
  };

  /** Patterns that indicate the END of chapter content */
  endMarkers: {
    /** Line that marks end of chapter (appears after story content) */
    actions: string;
  };

  /** Patterns to detect if text is from AO3 */
  detectionPatterns: RegExp[];

  /** Lines/sections to always exclude (navigation, metadata) */
  excludePatterns: RegExp[];
}

export const AO3_CONFIG: Ao3MarkerConfig = {
  includeStartMarkers: {
    // Matches: "Chapter 1", "Chapter 1: Title", "Chapter 12: The End"
    chapterTitle: /^Chapter\s+\d+(?::\s*.+)?$/im,
    summary: 'Summary:',
    notes: 'Notes:',
    chapterText: 'Chapter Text',
  },

  endMarkers: {
    actions: 'Actions',
  },

  detectionPatterns: [
    /Archive of Our Own/i,
    /archiveofourown\.org/i,
    /Work Header/i,
    /^Rating:\s*$/m,
    /^Kudos:\s*$/m,
  ],

  excludePatterns: [
    /^Main Content$/,
    /^Archive of Our Own/,
    /^Hi,\s+\w+!$/, // User greeting
    /^(Post|Log Out)$/,
    /^(Fandoms|Browse|Search|About)$/,
    /^Work Header$/,
    /^Rating:$/,
    /^Archive Warning:$/,
    /^Category:$/,
    /^Fandoms:$/,
    /^Relationships:$/,
    /^Characters:$/,
    /^Additional Tags:$/,
    /^Language:$/,
    /^Stats:$/,
    /^(Published|Completed|Words|Chapters|Comments|Kudos|Bookmarks|Hits):$/,
    /^Entire Work/,
    /^Next Chapter/,
    /^Bookmark\s+Comments\s+Share$/,
    /^\d+\s+characters left$/,
    /^Footer$/,
    /^Customize$/,
    /^(About the Archive|Site Map|Terms of Service)/,
    /^(Contact Us|Development)/,
    /^otwarchive\s+v[\d.]+/,
    /^GPL-[\d.]+-or-later/,
    /^\d+ more users as well as \d+ guests left kudos/,
  ],
};
