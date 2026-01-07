/**
 * Paragraph Display Component
 *
 * Individual paragraph display with text and optional controls.
 * Memoized to prevent unnecessary re-renders in large lists.
 */

import React, { memo } from 'react';
import { ParagraphControls } from './ParagraphControls';

interface ParagraphDisplayProps {
  paragraph: string;
  index: number;
  totalParagraphs: number;
  isCurrentParagraph: boolean;
  isLoading: boolean;
  showControls: boolean;
  isOfflineSession: boolean;
  isPreGenerated?: boolean;
  isLastPosition?: boolean;
  onPlay: () => void;
  paragraphRef: (el: HTMLDivElement | null) => void;
}

export const ParagraphDisplay = memo(function ParagraphDisplay({
  paragraph,
  index,
  totalParagraphs,
  isCurrentParagraph,
  isLoading,
  showControls,
  isOfflineSession,
  isPreGenerated,
  isLastPosition,
  onPlay,
  paragraphRef
}: ParagraphDisplayProps) {
  return (
    <div
      ref={paragraphRef}
      className={`book-paragraph ${
        isCurrentParagraph
          ? 'book-paragraph-active'
          : isLastPosition
            ? 'book-paragraph-last-position'
            : ''
      }`}
      onClick={onPlay}
    >
      {/* Last position marker - shown when not currently playing */}
      {isLastPosition && !isCurrentParagraph && (
        <div className="absolute -left-1 top-0 bottom-0 flex items-center">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/20 text-amber-400 rounded-r text-xs font-medium">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
            <span className="hidden sm:inline">Last position</span>
          </div>
        </div>
      )}

      <p className="book-text">{paragraph}</p>

      {showControls && (
        <ParagraphControls
          index={index}
          totalParagraphs={totalParagraphs}
          isLoading={isLoading}
          isCurrentParagraph={isCurrentParagraph}
          isOfflineSession={isOfflineSession}
          isPreGenerated={isPreGenerated}
          onPlay={onPlay}
        />
      )}
    </div>
  );
});