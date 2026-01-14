/**
 * BufferStatusIndicator Component
 *
 * Displays the current buffer status during buffered playback.
 * Shows progress bar, paragraph counts, and generation status.
 */

import type { BufferStatus, BufferPlaybackStatus } from '~/services/generation';

interface BufferStatusIndicatorProps {
  status: BufferPlaybackStatus;
  currentParagraph: number;
  totalParagraphs: number;
  bufferStatus: BufferStatus;
  error?: string;
}

export function BufferStatusIndicator({
  status,
  currentParagraph,
  totalParagraphs,
  bufferStatus,
  error,
}: BufferStatusIndicatorProps) {
  const { bufferSize, targetBuffer, isGenerating, generatingIndex, generated } = bufferStatus;

  // Calculate buffer fill percentage
  const bufferFillPercent = Math.min((bufferSize / targetBuffer) * 100, 100);

  // Get status color
  const getStatusColor = () => {
    switch (status) {
      case 'playing':
        return 'bg-accent-success';
      case 'buffering':
      case 'initial-buffering':
        return 'bg-accent-warning';
      case 'paused':
        return 'bg-accent-primary';
      case 'error':
        return 'bg-accent-danger';
      case 'completed':
        return 'bg-accent-success';
      default:
        return 'bg-gray-500';
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (status) {
      case 'initial-buffering':
        return 'Building initial buffer...';
      case 'buffering':
        return 'Refilling buffer...';
      case 'playing':
        return 'Playing';
      case 'paused':
        return 'Paused';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Ready';
    }
  };

  // Get buffer bar color based on fill level
  const getBufferBarColor = () => {
    if (bufferSize >= targetBuffer) return 'bg-accent-success';
    if (bufferSize >= targetBuffer / 2) return 'bg-accent-warning';
    return 'bg-accent-danger';
  };

  if (status === 'idle') return null;

  return (
    <div className="bg-dark-300 rounded-lg p-3 border border-dark-500">
      {/* Status row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()} animate-pulse`} />
          <span className="text-sm font-medium text-gray-200">{getStatusText()}</span>
        </div>
        <span className="text-sm text-gray-400">
          Paragraph {currentParagraph + 1} of {totalParagraphs}
        </span>
      </div>

      {/* Buffer bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>Buffer</span>
          <span>
            {bufferSize}/{targetBuffer} ahead
          </span>
        </div>
        <div className="h-2 bg-dark-500 rounded-full overflow-hidden">
          <div
            className={`h-full ${getBufferBarColor()} transition-all duration-300`}
            style={{ width: `${bufferFillPercent}%` }}
          />
        </div>
      </div>

      {/* Generation status */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-1">
          {isGenerating ? (
            <>
              <svg
                className="animate-spin h-3 w-3"
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
              <span>Generating paragraph {generatingIndex + 1}...</span>
            </>
          ) : (
            <span>{generated.size} paragraphs generated</span>
          )}
        </div>
        <span>{Math.round((generated.size / totalParagraphs) * 100)}% complete</span>
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-2 p-2 bg-accent-danger/20 text-accent-danger rounded text-sm border border-accent-danger/30">
          {error}
        </div>
      )}
    </div>
  );
}

export default BufferStatusIndicator;
