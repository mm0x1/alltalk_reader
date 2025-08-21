import React, { useRef, useEffect, useState } from 'react';

interface ParagraphListProps {
  paragraphs: string[];
  currentParagraphIndex: number | null;
  onPlayParagraph: (index: number) => void;
  isLoading?: boolean;
  preGeneratedStatus?: boolean[];
  isOfflineSession?: boolean;
}

export default function ParagraphList({
  paragraphs,
  currentParagraphIndex,
  onPlayParagraph,
  isLoading = false,
  preGeneratedStatus,
  isOfflineSession = false,
}: ParagraphListProps) {
  const paragraphRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [showControls, setShowControls] = useState(true);
  
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
    <div className="book-container" data-testid="paragraph-list">
      <div className="book-header sticky top-0 bg-dark-200 py-2 z-10 border-b border-dark-500 flex justify-between items-center">
        <h2 className="text-xl font-serif font-semibold">Your Book</h2>
        <div className="flex items-center gap-2">
          {isOfflineSession && (
            <span className="text-xs bg-accent-success/20 text-accent-success px-2 py-1 rounded-full border border-accent-success/30 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2.102 1.998l-6.674.875a1.998 1.998 0 01-2.215-1.642L4.838 13H4a2 2 0 01-2-2V6c0-1.1.9-2 2-2zm2 3a1 1 0 011-1h3a1 1 0 110 2H7a1 1 0 01-1-1zm0 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              Offline Mode
            </span>
          )}
          <button 
            className="text-sm px-2 py-1 rounded-full hover:bg-dark-400"
            onClick={() => setShowControls(!showControls)}
          >
            {showControls ? 'Hide Controls' : 'Show Controls'}
          </button>
        </div>
      </div>
      
      <div className="book-pages">
        {paragraphs.map((paragraph, index) => (
          <div 
            key={index}
            ref={el => { paragraphRefs.current[index] = el }}
            className={`book-paragraph ${
              currentParagraphIndex === index
                ? 'book-paragraph-active'
                : ''
            }`}
            onClick={() => onPlayParagraph(index)}
          >
            <p className="book-text">{paragraph}</p>
            
            {showControls && (
              <div className="paragraph-controls">
                <button
                  className={`play-button ${
                    isLoading && currentParagraphIndex === index
                      ? 'text-gray-500 cursor-wait'
                      : 'text-accent-primary hover:text-accent-hover'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayParagraph(index);
                  }}
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
                      Play
                    </>
                  )}
                </button>
                <div className="paragraph-info">
                  {isOfflineSession && (
                    <span className="paragraph-badge offline-badge">
                      <svg className="h-3 w-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 016 0v2h2V7a5 5 0 00-5-5z" />
                      </svg>
                      Offline
                    </span>
                  )}
                  {!isOfflineSession && preGeneratedStatus && (
                    <span className={`paragraph-badge ${preGeneratedStatus[index] ? 'cached-badge' : 'not-cached-badge'}`}>
                      {preGeneratedStatus[index] ? (
                        <>
                          <svg className="h-3 w-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Cached
                        </>
                      ) : 'Not cached'}
                    </span>
                  )}
                  <span className="paragraph-number">
                    {index + 1}/{paragraphs.length}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
