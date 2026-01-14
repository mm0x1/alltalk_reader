/**
 * Play/Pause Button Component
 * 
 * Central playback control button with loading state.
 */

import React from 'react';
import { Button, Icon, Loading } from '~/design-system';

interface PlayPauseButtonProps {
  isPlaying: boolean;
  isLoading: boolean;
  onPlayPause: () => void;
}

export function PlayPauseButton({ isPlaying, isLoading, onPlayPause }: PlayPauseButtonProps) {
  const getButtonContent = () => {
    if (isLoading) {
      return (
        <>
          <Loading size="sm" />
          <span className="control-label ml-1">Loading</span>
        </>
      );
    }
    
    if (isPlaying) {
      return (
        <>
          <Icon name="pause" />
          <span className="control-label ml-1">Pause</span>
        </>
      );
    }
    
    return (
      <>
        <Icon name="play" />
        <span className="control-label ml-1">Play</span>
      </>
    );
  };

  return (
    <Button
      className={`control-button play-pause-button ${
        isLoading ? 'loading' : isPlaying ? 'playing' : 'paused'
      }`}
      onClick={onPlayPause}
      disabled={isLoading}
      title={isLoading ? "Loading..." : isPlaying ? "Pause" : "Play"}
    >
      {getButtonContent()}
    </Button>
  );
}