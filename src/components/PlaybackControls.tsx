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
    <div className="bg-gray-100 p-4 rounded-lg mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center space-x-2">
          <button
            className={`p-2 rounded-full ${canSkipPrevious ? 'text-blue-500 hover:bg-blue-100' : 'text-gray-400'
              }`}
            onClick={onSkipPrevious}
            disabled={!canSkipPrevious || isLoading}
            title="Previous paragraph"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            className={`p-2 rounded-full ${isLoading
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : isPlaying
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            onClick={onPlayPause}
            disabled={isLoading}
            title={isLoading ? "Loading..." : isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>

          <button
            className={`p-2 rounded-full ${canSkipNext ? 'text-blue-500 hover:bg-blue-100' : 'text-gray-400'
              }`}
            onClick={onSkipNext}
            disabled={!canSkipNext || isLoading}
            title="Next paragraph"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center space-x-2 ml-auto">
          <label htmlFor="voice-select-control" className="text-sm font-medium text-gray-700">
            Voice:
          </label>
          <select
            id="voice-select-control"
            className="p-1.5 text-sm border border-gray-300 rounded"
            value={selectedVoice}
            onChange={(e) => onVoiceChange(e.target.value)}
            disabled={isLoading}
          >
            {availableVoices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
              </option>
            ))}
          </select>

          <button
            className="p-1.5 text-sm text-white bg-stone-8000 rounded hover:bg-gray-600 disabled:bg-gray-400"
            onClick={onReset}
            disabled={isLoading}
            title="New text"
          >
            New Text
          </button>
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-500">
        <p>
          {isLoading
            ? "Generating audio... Please wait."
            : "Tip: You can click on any paragraph to start playback from that position."}
        </p>
      </div>
    </div>
  );
}
