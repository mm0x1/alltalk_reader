import React, { useState } from 'react';

interface ProgressBarProps {
  currentIndex: number | null;
  totalParagraphs: number;
  onSelectParagraph: (index: number) => void;
}

export default function ProgressBar({
  currentIndex,
  totalParagraphs,
  onSelectParagraph,
}: ProgressBarProps) {
  if (totalParagraphs === 0) return null;

  const [pageInput, setPageInput] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);
  
  const progress = currentIndex !== null 
    ? Math.round(((currentIndex + 1) / totalParagraphs) * 100) 
    : 0;

  // Calculate the segments for the progress bar
  // We'll show a maximum of 20 segments for visual clarity
  const maxVisibleSegments = 20;
  const segmentSize = Math.ceil(totalParagraphs / maxVisibleSegments);
  const segments = Math.min(totalParagraphs, maxVisibleSegments);
  
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers
    const value = e.target.value.replace(/[^0-9]/g, '');
    setPageInput(value);
    
    // Clear any previous error when the input changes
    if (inputError) {
      setInputError(null);
    }
  };
  
  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pageInput) return;
    
    // Convert to number and make it 0-based index
    const pageNumber = parseInt(pageInput, 10);
    
    if (isNaN(pageNumber)) {
      setInputError('Please enter a valid number');
      return;
    }
    
    if (pageNumber < 1 || pageNumber > totalParagraphs) {
      setInputError(`Please enter a number between 1 and ${totalParagraphs}`);
      return;
    }
    
    // Convert from 1-based (user visible) to 0-based (internal index)
    onSelectParagraph(pageNumber - 1);
    setPageInput('');
    setInputError(null);
  };

  return (
    <div className="book-progress mb-6">
      <div className="flex justify-between text-sm text-gray-300 mb-1 font-serif">
        <span>Reading Progress</span>
        <span>{progress}% • Page {currentIndex !== null ? currentIndex + 1 : 0} of {totalParagraphs}</span>
      </div>
      
      <div className="progress-bar-container">
        <div 
          className="progress-bar-filled"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {totalParagraphs <= 50 && (
        <div className="mt-2 flex flex-wrap gap-1 chapter-markers">
          {Array.from({ length: totalParagraphs }).map((_, index) => (
            <button
              key={index}
              onClick={() => onSelectParagraph(index)}
              className={`chapter-marker ${currentIndex === index ? 'current-marker' : ''}`}
              title={`Go to paragraph ${index + 1}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}
      
      {totalParagraphs > 50 && (
        <div className="text-center text-xs text-gray-400 mt-2 italic">
          {totalParagraphs} paragraphs total. Use the form below to jump to a specific page.
        </div>
      )}
      
      {/* This is a simplified navigation for books with many paragraphs */}
      {totalParagraphs > 50 && (
        <div className="mt-3 mb-2 flex flex-wrap items-center justify-center gap-2">
          <button 
            onClick={() => onSelectParagraph(0)} 
            className="book-nav-button"
            title="Go to beginning"
          >
            First
          </button>
          
          {currentIndex !== null && currentIndex > 10 && (
            <button 
              onClick={() => onSelectParagraph(Math.max(0, currentIndex - 10))} 
              className="book-nav-button"
              title="Go back 10 paragraphs"
            >
              -10
            </button>
          )}
          
          {currentIndex !== null && currentIndex > 0 && (
            <button 
              onClick={() => onSelectParagraph(currentIndex - 1)} 
              className="book-nav-button"
              title="Previous paragraph"
            >
              Prev
            </button>
          )}
          
          <div className="px-2 py-1 bg-dark-300 rounded-lg">
            {currentIndex !== null ? currentIndex + 1 : 0}/{totalParagraphs}
          </div>
          
          {currentIndex !== null && currentIndex < totalParagraphs - 1 && (
            <button 
              onClick={() => onSelectParagraph(currentIndex + 1)} 
              className="book-nav-button"
              title="Next paragraph"
            >
              Next
            </button>
          )}
          
          {currentIndex !== null && currentIndex < totalParagraphs - 10 && (
            <button 
              onClick={() => onSelectParagraph(Math.min(totalParagraphs - 1, currentIndex + 10))} 
              className="book-nav-button"
              title="Go forward 10 paragraphs"
            >
              +10
            </button>
          )}
          
          <button 
            onClick={() => onSelectParagraph(totalParagraphs - 1)} 
            className="book-nav-button"
            title="Go to end"
          >
            Last
          </button>
          
          {/* Page Jump Form */}
          <form 
            onSubmit={handlePageInputSubmit} 
            className="flex flex-col items-center mt-2 md:mt-0 ml-1"
          >
            <div className="flex items-center">
              <label htmlFor="page-jump" className="text-sm text-gray-300 mr-2 whitespace-nowrap">
                Jump to Page:
              </label>
              <input
                id="page-jump"
                type="text"
                value={pageInput}
                onChange={handlePageInputChange}
                placeholder={`1-${totalParagraphs}`}
                className={`w-20 py-1 px-2 text-sm bg-dark-300 border ${inputError ? 'border-accent-danger' : 'border-dark-400'} rounded text-white focus:border-accent-primary focus:outline-none`}
                aria-label={`Enter a page number between 1 and ${totalParagraphs}`}
              />
              <button
                type="submit"
                className="ml-2 px-2 py-1 bg-accent-primary text-white text-sm rounded hover:bg-accent-primary/80 transition-colors"
                disabled={!pageInput}
              >
                Go
              </button>
            </div>
            {inputError && (
              <div className="text-xs text-accent-danger mt-1 text-center">
                {inputError}
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
