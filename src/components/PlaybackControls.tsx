import React from 'react';
import { availableVoices } from '~/utils/alltalk';

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
          <button
            className={`control-button previous-button ${!canSkipPrevious || isLoading ? 'disabled' : ''}`}
            onClick={onSkipPrevious}
            disabled={!canSkipPrevious || isLoading}
            title="Previous paragraph"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="control-label">Previous</span>
          </button>

          <button
            className={`control-button play-pause-button ${
              isLoading ? 'loading' : isPlaying ? 'playing' : 'paused'
            }`}
            onClick={onPlayPause}
            disabled={isLoading}
            title={isLoading ? "Loading..." : isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="control-label">Loading</span>
              </>
            ) : isPlaying ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="control-label">Pause</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="control-label">Play</span>
              </>
            )}
          </button>

          <button
            className={`control-button next-button ${!canSkipNext || isLoading ? 'disabled' : ''}`}
            onClick={onSkipNext}
            disabled={!canSkipNext || isLoading}
            title="Next paragraph"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="control-label">Next</span>
          </button>
        </div>

        <div className="ml-auto">
          <button
            className="new-book-button"
            onClick={onReset}
            disabled={isLoading}
            title="Start new book"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
            New Book
          </button>
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
