import React from 'react';

interface AudioCacheStatusProps {
  status: 'initial' | 'generating' | 'playing' | 'paused' | 'error';
  paragraphIndex?: number;
  totalParagraphs?: number;
  errorMessage?: string;
}

export default function AudioCacheStatus({
  status,
  paragraphIndex,
  totalParagraphs,
  errorMessage
}: AudioCacheStatusProps) {
  if (status === 'initial') return null;
  
  const statusClassName = {
    generating: 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30',
    playing: 'bg-accent-success/20 text-accent-success border border-accent-success/30',
    paused: 'bg-accent-warning/20 text-accent-warning border border-accent-warning/30',
    error: 'bg-accent-danger/20 text-accent-danger border border-accent-danger/30',
  }[status];
  
  const statusIcon = {
    generating: (
      <svg className="animate-spin mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    ),
    playing: (
      <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
      </svg>
    ),
    paused: (
      <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    error: (
      <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
  }[status];
  
  let statusText = '';
  
  switch (status) {
    case 'generating':
      statusText = `Generating audio for paragraph ${paragraphIndex! + 1}${totalParagraphs ? ` of ${totalParagraphs}` : ''}...`;
      break;
    case 'playing':
      statusText = `Playing paragraph ${paragraphIndex! + 1}${totalParagraphs ? ` of ${totalParagraphs}` : ''}`;
      break;
    case 'paused':
      statusText = `Paused at paragraph ${paragraphIndex! + 1}${totalParagraphs ? ` of ${totalParagraphs}` : ''}`;
      break;
    case 'error':
      statusText = errorMessage || 'Error generating audio';
      break;
  }
  
  return (
    <div className={`mb-4 p-3 rounded-lg flex items-center ${statusClassName}`}>
      {statusIcon}
      <span>{statusText}</span>
    </div>
  );
}
