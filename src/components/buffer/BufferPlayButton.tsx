/**
 * BufferPlayButton Component
 *
 * Button to start buffered playback mode.
 * Shows different states based on playback status.
 */

import type { BufferPlaybackStatus } from '~/services/generation';

interface BufferPlayButtonProps {
  status: BufferPlaybackStatus;
  isServerConnected: boolean;
  hasParagraphs: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function BufferPlayButton({
  status,
  isServerConnected,
  hasParagraphs,
  onStart,
  onPause,
  onResume,
  onStop,
}: BufferPlayButtonProps) {
  const isDisabled = !isServerConnected || !hasParagraphs;
  const isActive = status !== 'idle' && status !== 'completed' && status !== 'error';
  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isBuffering = status === 'buffering' || status === 'initial-buffering';

  // Handle click based on current status
  const handleClick = () => {
    if (isDisabled) return;

    if (status === 'idle' || status === 'completed' || status === 'error') {
      onStart();
    } else if (isPlaying || isBuffering) {
      onPause();
    } else if (isPaused) {
      onResume();
    }
  };

  // Get button text
  const getButtonText = () => {
    switch (status) {
      case 'initial-buffering':
        return 'Buffering...';
      case 'buffering':
        return 'Buffering...';
      case 'playing':
        return 'Pause';
      case 'paused':
        return 'Resume';
      case 'completed':
        return 'Play Again';
      case 'error':
        return 'Retry';
      default:
        return 'Buffer Play';
    }
  };

  // Get button icon
  const getIcon = () => {
    if (isBuffering) {
      return (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      );
    }

    if (isPlaying) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      );
    }

    // Play icon (default)
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
          clipRule="evenodd"
        />
      </svg>
    );
  };

  // Get button style
  const getButtonStyle = () => {
    if (isDisabled) {
      return 'bg-dark-200 text-gray-500 cursor-not-allowed';
    }
    if (isActive) {
      return 'bg-accent-primary hover:bg-accent-primary/80 text-white';
    }
    return 'bg-accent-primary hover:bg-accent-primary/80 text-white';
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`px-3 py-1.5 text-sm rounded flex items-center gap-1.5 transition-colors ${getButtonStyle()}`}
        title={
          !isServerConnected
            ? 'Server not connected'
            : !hasParagraphs
            ? 'No paragraphs to play'
            : 'Start buffered playback'
        }
      >
        {getIcon()}
        <span>{getButtonText()}</span>
      </button>

      {/* Stop button - only visible when active */}
      {isActive && (
        <button
          onClick={onStop}
          className="px-2 py-1.5 text-sm rounded bg-dark-400 hover:bg-dark-500 text-gray-300 transition-colors"
          title="Stop playback"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

export default BufferPlayButton;
