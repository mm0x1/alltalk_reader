/**
 * Batch Progress Component
 * 
 * Displays progress information for batch audio generation.
 */

import React from 'react';
import { Progress } from '~/design-system';

interface BatchProgressProps {
  progress: number;
  currentIndex: number;
  totalParagraphs: number;
  audioUrlsCount: number;
  error: string | null;
  isGenerating: boolean;
}

export function BatchProgress({
  progress,
  currentIndex,
  totalParagraphs,
  audioUrlsCount,
  error,
  isGenerating
}: BatchProgressProps) {
  return (
    <>
      <div className="mb-4">
        <Progress 
          value={progress}
          label="Overall Progress"
          variant={error ? 'danger' : 'primary'}
        />
        
        <div className="mt-1 flex justify-between text-sm text-gray-400">
          <span>Paragraph {currentIndex + 1} of {totalParagraphs}</span>
          <span>{error ? 'Error' : isGenerating ? 'Generating...' : 'Complete'}</span>
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-400">
          {audioUrlsCount} of {totalParagraphs} paragraphs generated
        </span>
      </div>
    </>
  );
}