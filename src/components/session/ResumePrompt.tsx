/**
 * Resume Prompt Component
 *
 * Shows a prompt to resume playback from the last saved position.
 */

interface ResumePromptProps {
  paragraphIndex: number;
  totalParagraphs: number;
  onResume: (index: number) => void;
  onStartOver: () => void;
  onDismiss: () => void;
}

export function ResumePrompt({
  paragraphIndex,
  totalParagraphs,
  onResume,
  onStartOver,
  onDismiss
}: ResumePromptProps) {
  const progress = Math.round(((paragraphIndex + 1) / totalParagraphs) * 100);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-300 rounded-lg p-6 max-w-md w-full shadow-xl border border-dark-400">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-accent-primary/20 rounded-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-accent-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-200">Resume Reading?</h3>
            <p className="text-sm text-gray-400">You left off at paragraph {paragraphIndex + 1}</p>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-400 mb-1">
            <span>Progress</span>
            <span>{progress}% complete</span>
          </div>
          <div className="w-full bg-dark-500 rounded-full h-2">
            <div
              className="bg-accent-primary h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Paragraph {paragraphIndex + 1} of {totalParagraphs}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onResume(paragraphIndex)}
            className="flex-1 px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Resume
          </button>
          <button
            onClick={onStartOver}
            className="flex-1 px-4 py-2 bg-dark-400 hover:bg-dark-500 text-gray-300 rounded-lg font-medium transition-colors"
          >
            Start Over
          </button>
        </div>

        <button
          onClick={onDismiss}
          className="w-full mt-3 px-4 py-2 text-gray-400 hover:text-gray-200 text-sm transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
