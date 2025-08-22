import React, { useState } from 'react';
import { useParagraphScrolling } from '~/hooks/useParagraphScrolling';
import { ParagraphHeader } from './paragraph/ParagraphHeader';
import { ParagraphDisplay } from './paragraph/ParagraphDisplay';

interface ParagraphListProps {
  paragraphs: string[];
  currentParagraphIndex: number | null;
  onPlayParagraph: (index: number) => void;
  isLoading?: boolean;
  preGeneratedStatus?: boolean[];
  isOfflineSession?: boolean;
}

export default function ParagraphList({
  paragraphs,
  currentParagraphIndex,
  onPlayParagraph,
  isLoading = false,
  preGeneratedStatus,
  isOfflineSession = false,
}: ParagraphListProps) {
  const [showControls, setShowControls] = useState(true);
  const { paragraphRefs } = useParagraphScrolling(currentParagraphIndex);

  return (
    <div className="book-container" data-testid="paragraph-list">
      <ParagraphHeader
        showControls={showControls}
        onToggleControls={() => setShowControls(!showControls)}
        isOfflineSession={isOfflineSession}
      />
      
      <div className="book-pages">
        {paragraphs.map((paragraph, index) => (
          <ParagraphDisplay
            key={index}
            paragraph={paragraph}
            index={index}
            totalParagraphs={paragraphs.length}
            isCurrentParagraph={currentParagraphIndex === index}
            isLoading={isLoading}
            showControls={showControls}
            isOfflineSession={isOfflineSession}
            isPreGenerated={preGeneratedStatus?.[index]}
            onPlay={() => onPlayParagraph(index)}
            paragraphRef={(el) => { paragraphRefs.current[index] = el }}
          />
        ))}
      </div>
    </div>
  );
}
