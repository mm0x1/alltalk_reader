import React, { useRef, useEffect } from 'react';

interface ParagraphListProps {
  paragraphs: string[];
  currentParagraphIndex: number | null;
  onPlayParagraph: (index: number) => void;
  isLoading?: boolean;
  preGeneratedStatus?: boolean[];
}

export default function ParagraphList({
  paragraphs,
  currentParagraphIndex,
  onPlayParagraph,
  isLoading = false,
  preGeneratedStatus,
}: ParagraphListProps) {
  const paragraphRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Auto-scroll to current paragraph
  useEffect(() => {
    if (currentParagraphIndex !== null && paragraphRefs.current[currentParagraphIndex]) {
      paragraphRefs.current[currentParagraphIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentParagraphIndex]);

  return (
    <div className="space-y-4 mt-4 max-h-[600px] overflow-y-auto pr-2" data-testid="paragraph-list">
      <h2 className="text-xl font-semibold sticky top-0 bg-dark-200 py-2 z-10 border-b border-dark-500">
        Your Book
      </h2>
      
      {paragraphs.map((paragraph, index) => (
        <div 
          key={index}
          ref={el => paragraphRefs.current[index] = el}
          className={`p-3 rounded transition-all duration-200 ${
            currentParagraphIndex === index
              ? 'bg-accent-primary/20 border-l-4 border-accent-primary shadow-md text-gray-100'
              : 'bg-dark-300 hover:bg-dark-400 text-gray-300'
          }`}
        >
          <p>{paragraph}</p>
          <div className="mt-2 flex justify-between items-center">
            <button
              className={`text-sm flex items-center ${
                isLoading && currentParagraphIndex === index
                  ? 'text-gray-500 cursor-wait'
                  : 'text-accent-primary hover:text-accent-hover'
              }`}
              onClick={() => onPlayParagraph(index)}
              disabled={isLoading && currentParagraphIndex === index}
            >
              {isLoading && currentParagraphIndex === index ? (
                <>
                  <svg 
                    className="animate-spin h-4 w-4 mr-1" 
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
                    ></circle>
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-4 w-4 mr-1" 
                    viewBox="0 0 20 20" 
                    fill="currentColor"
                  >
                    <path 
                      fillRule="evenodd" 
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" 
                      clipRule="evenodd" 
                    />
                  </svg>
                  Play this paragraph
                </>
              )}
            </button>
            <div className="flex items-center space-x-2">
              {preGeneratedStatus && (
                <span className={`text-xs ${preGeneratedStatus[index] ? 'text-accent-success' : 'text-gray-500'}`}>
                  {preGeneratedStatus[index] ? (
                    <>
                      <svg className="h-4 w-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Cached
                    </>
                  ) : 'Not cached'}
                </span>
              )}
              <span className="text-xs text-gray-500">
                Paragraph {index + 1} of {paragraphs.length}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
