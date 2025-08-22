import React from 'react';
import { PlayPauseButton } from './playback/PlayPauseButton';
import { SkipButton } from './playback/SkipButton';
import { ResetButton } from './playback/ResetButton';

interface PlaybackControlsProps {
  isPlaying: boolean;
  selectedVoice: string;
  onPlayPause: () => void;
  onVoiceChange: (voice: string) => void;
  onReset: () => void;
  canSkipPrevious: boolean;
  canSkipNext: boolean;
  onSkipPrevious: () => void;
  onSkipNext: () => void;
  isLoading?: boolean;
}

export default function PlaybackControls({
  isPlaying,
  selectedVoice,
  onPlayPause,
  onVoiceChange,
  onReset,
  canSkipPrevious,
  canSkipNext,
  onSkipPrevious,
  onSkipNext,
  isLoading = false,
}: PlaybackControlsProps) {
  return (
    <div className="w-full">
      <div className="audiobook-controls">
        <div className="flex items-center space-x-3">
          <SkipButton
            direction="previous"
            canSkip={canSkipPrevious}
            isLoading={isLoading}
            onSkip={onSkipPrevious}
          />

          <PlayPauseButton
            isPlaying={isPlaying}
            isLoading={isLoading}
            onPlayPause={onPlayPause}
          />

          <SkipButton
            direction="next"
            canSkip={canSkipNext}
            isLoading={isLoading}
            onSkip={onSkipNext}
          />
        </div>

        <div className="ml-auto">
          <ResetButton
            isLoading={isLoading}
            onReset={onReset}
          />
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-400 italic">
        <p>
          {isLoading
            ? "Generating audio... Please wait."
            : "Click on any paragraph to start reading from that position."}
        </p>
      </div>
    </div>
  );
}
