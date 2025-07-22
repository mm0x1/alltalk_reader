import React, { useState } from 'react';
import SessionList from './SessionList';
import { AudioSession } from '~/services/sessionStorage';

interface SessionManagerProps {
  onLoadSession: (session: AudioSession) => void;
  onClose: () => void;
}

export default function SessionManager({ onLoadSession, onClose }: SessionManagerProps) {
  // Force a refresh key to ensure the SessionList always reloads when opened
  const [refreshKey, setRefreshKey] = useState(Date.now());

  const handleRefresh = () => {
    setRefreshKey(Date.now());
  };

  const handleSelectSession = (session: AudioSession) => {
    onLoadSession(session);
    onClose();
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Saved Sessions</h2>
        <div className="flex gap-2">
          <button 
            onClick={handleRefresh}
            className="p-1.5 hover:bg-dark-400 rounded"
            title="Refresh Sessions"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-dark-400 rounded"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <p className="text-gray-400 mb-4">
        Select a previously generated session to load its audio files.
        These sessions persist even if you refresh or close the browser.
      </p>
      
      <SessionList 
        key={refreshKey}
        onLoadSession={handleSelectSession} 
      />
    </div>
  );
}
