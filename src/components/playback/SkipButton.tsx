/**
 * Skip Button Component
 * 
 * Navigation button for previous/next paragraph.
 */

import React from 'react';
import { Button, Icon } from '~/design-system';

interface SkipButtonProps {
  direction: 'previous' | 'next';
  canSkip: boolean;
  isLoading: boolean;
  onSkip: () => void;
}

export function SkipButton({ direction, canSkip, isLoading, onSkip }: SkipButtonProps) {
  const isPrevious = direction === 'previous';
  const iconName = isPrevious ? 'skipPrev' : 'skipNext';
  const label = isPrevious ? 'Previous' : 'Next';
  const title = `${label} paragraph`;

  return (
    <Button
      className={`control-button ${direction}-button ${!canSkip || isLoading ? 'disabled' : ''}`}
      onClick={onSkip}
      disabled={!canSkip || isLoading}
      title={title}
      variant="secondary"
    >
      <Icon name={iconName} />
      <span className="control-label ml-1">{label}</span>
    </Button>
  );
}