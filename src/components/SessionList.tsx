import React, { useState, useEffect } from 'react';
import { 
  getAllSessions,
  deleteSession, 
  AudioSession, 
  isSessionValid
} from '~/services/sessionStorage';

interface SessionListProps {
  onLoadSession: (session: AudioSession) => void;
}

export default function SessionList({ onLoadSession }: SessionListProps) {
  const [sessions, setSessions] = useState<AudioSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load sessions when component mounts
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const allSessions = await getAllSessions();
      
      // Filter out invalid sessions
      const validSessions = allSessions.filter(isSessionValid);
      
      setSessions(validSessions);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setError('Failed to load saved sessions. Please try again.');
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent onClick
    
    if (window.confirm('Are you sure you want to delete this saved session?')) {
      try {
        const success = await deleteSession(sessionId);
        if (success) {
          setSessions(sessions.filter(session => session.id !== sessionId));
        } else {
          setError('Failed to delete session. Please try again.');
        }
      } catch (err) {
        console.error('Error deleting session:', err);
        setError('An error occurred while deleting the session.');
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <svg className="animate-spin h-5 w-5 mx-auto mb-2 text-accent-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-gray-400">Loading saved sessions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-accent-danger/20 text-accent-danger rounded-lg border border-accent-danger/30">
        <p className="font-medium">Error loading sessions</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={loadSessions}
          className="mt-2 px-3 py-1 bg-accent-danger/20 hover:bg-accent-danger/30 text-accent-danger border border-accent-danger/30 rounded text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4 text-center bg-dark-300 rounded-lg border border-dark-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-gray-300 font-medium">No saved sessions</p>
        <p className="text-gray-400 text-sm mt-1">
          Use the "Pre-Generate All Audio" button while reading to save a session.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-lg text-gray-200">Saved Sessions</h3>
      
      <div className="divide-y divide-dark-400 border border-dark-400 rounded-lg overflow-hidden">
        {sessions.map((session) => (
          <div 
            key={session.id} 
            onClick={() => onLoadSession(session)}
            className="p-4 bg-dark-300 hover:bg-dark-400 transition-colors cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-gray-200">{session.name}</h4>
                <p className="text-sm text-gray-400">
                  {session.paragraphs.length} paragraphs | Voice: {session.settings.voice.replace('.wav', '')}
                </p>
                <p className="text-xs text-gray-500 mt-1">Created: {formatDate(session.createdAt)}</p>
              </div>
              <button
                onClick={(e) => handleDeleteSession(session.id, e)}
                className="p-1.5 text-gray-400 hover:text-accent-danger hover:bg-dark-500 rounded"
                title="Delete session"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="text-right">
        <button
          onClick={loadSessions}
          className="px-3 py-1.5 text-sm bg-dark-400 hover:bg-dark-500 rounded flex items-center ml-auto"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh List
        </button>
      </div>
    </div>
  );
}
