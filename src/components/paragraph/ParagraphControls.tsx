/**
 * Paragraph Controls Component
 * 
 * Play button and status indicators for individual paragraphs.
 */

import React from 'react';
import { Button, Icon, Loading } from '~/design-system';

interface ParagraphControlsProps {
  index: number;
  totalParagraphs: number;
  isLoading: boolean;
  isCurrentParagraph: boolean;
  isOfflineSession: boolean;
  isPreGenerated?: boolean;
  onPlay: (e?: React.MouseEvent) => void;
}

export function ParagraphControls({
  index,
  totalParagraphs,
  isLoading,
  isCurrentParagraph,
  isOfflineSession,
  isPreGenerated,
  onPlay
}: ParagraphControlsProps) {
  return (
    <div className="paragraph-controls">
      <Button
        variant="primary"
        size="sm"
        className={isLoading && isCurrentParagraph ? 'text-gray-500 cursor-wait' : ''}
        onClick={(e) => {
          e?.stopPropagation();
          onPlay(e);
        }}
        disabled={isLoading && isCurrentParagraph}
        icon={isLoading && isCurrentParagraph ? undefined : 'play'}
      >
        {isLoading && isCurrentParagraph ? (
          <>
            <Loading size="sm" />
            <span className="ml-2">Generating...</span>
          </>
        ) : (
          'Play'
        )}
      </Button>
      
      <div className="paragraph-info">
        {isOfflineSession && (
          <span className="paragraph-badge offline-badge">
            <Icon name="lock" size="sm" className="mr-1" />
            Offline
          </span>
        )}
        {!isOfflineSession && isPreGenerated !== undefined && (
          <span className={`paragraph-badge ${isPreGenerated ? 'cached-badge' : 'not-cached-badge'}`}>
            {isPreGenerated ? (
              <>
                <Icon name="check" size="sm" className="mr-1" />
                Cached
              </>
            ) : (
              'Not cached'
            )}
          </span>
        )}
        <span className="paragraph-number">
          {index + 1}/{totalParagraphs}
        </span>
      </div>
    </div>
  );
}