import React from 'react';

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

  const progress = currentIndex !== null 
    ? Math.round(((currentIndex + 1) / totalParagraphs) * 100) 
    : 0;

  return (
    <div className="mb-6">
      <div className="flex justify-between text-sm text-gray-400 mb-1">
        <span>Progress</span>
        <span>{progress}%</span>
      </div>
      
      <div className="w-full h-2 bg-dark-400 rounded-full overflow-hidden">
        <div 
          className="h-full bg-accent-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className="mt-2 flex flex-wrap gap-1">
        {Array.from({ length: totalParagraphs }).map((_, index) => (
          <button
            key={index}
            onClick={() => onSelectParagraph(index)}
            className={`w-6 h-6 text-xs flex items-center justify-center rounded ${
              currentIndex === index
                ? 'bg-accent-primary text-white'
                : 'bg-dark-400 hover:bg-dark-500 text-gray-300'
            }`}
            title={`Paragraph ${index + 1}`}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
