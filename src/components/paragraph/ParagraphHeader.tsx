/**
 * Paragraph Header Component
 * 
 * Header for the paragraph list with title and controls toggle.
 */

import React from 'react';
import { Button, Icon } from '~/design-system';

interface ParagraphHeaderProps {
  showControls: boolean;
  onToggleControls: () => void;
  isOfflineSession: boolean;
}

export function ParagraphHeader({ 
  showControls, 
  onToggleControls, 
  isOfflineSession 
}: ParagraphHeaderProps) {
  return (
    <div className="book-header sticky top-0 bg-dark-200 py-2 z-10 border-b border-dark-500 flex justify-between items-center">
      <h2 className="text-xl font-serif font-semibold">Your Book</h2>
      <div className="flex items-center gap-2">
        {isOfflineSession && (
          <span className="text-xs bg-accent-success/20 text-accent-success px-2 py-1 rounded-full border border-accent-success/30 flex items-center">
            <Icon name="file" size="sm" className="mr-1" />
            Offline Mode
          </span>
        )}
        <Button 
          variant="secondary"
          size="sm"
          onClick={onToggleControls}
        >
          {showControls ? 'Hide Controls' : 'Show Controls'}
        </Button>
      </div>
    </div>
  );
}