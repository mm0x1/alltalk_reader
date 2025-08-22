/**
 * Paragraph Display Component
 * 
 * Individual paragraph display with text and optional controls.
 */

import React from 'react';
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
  onPlay: () => void;
  paragraphRef: (el: HTMLDivElement | null) => void;
}

export function ParagraphDisplay({
  paragraph,
  index,
  totalParagraphs,
  isCurrentParagraph,
  isLoading,
  showControls,
  isOfflineSession,
  isPreGenerated,
  onPlay,
  paragraphRef
}: ParagraphDisplayProps) {
  return (
    <div 
      ref={paragraphRef}
      className={`book-paragraph ${
        isCurrentParagraph
          ? 'book-paragraph-active'
          : ''
      }`}
      onClick={onPlay}
    >
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
}