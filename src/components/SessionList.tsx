import React, { useState, useEffect, useMemo } from 'react';
import {
  getAllSessions,
  deleteSession,
  updateSessionName,
  prepareSessionForExport,
  downloadSessionAsFile,
  type AudioSession,
  isSessionValid
} from '~/services/session';

interface SessionListProps {
  onLoadSession: (session: AudioSession) => void;
}

type SortField = 'date' | 'name' | 'progress';
type SortOrder = 'asc' | 'desc';

export default function SessionList({ onLoadSession }: SessionListProps) {
  const [sessions, setSessions] = useState<AudioSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [exportingSessionId, setExportingSessionId] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState(0);

  // Load sessions when component mounts
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const allSessions = await getAllSessions();
      const validSessions = allSessions.filter(isSessionValid);
      setSessions(validSessions);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setError('Failed to load saved sessions. Please try again.');
      setIsLoading(false);
    }
  };

  // Calculate progress for a session
  const getSessionProgress = (session: AudioSession): number => {
    if (!session.lastPlaybackPosition) return 0;
    return Math.round(((session.lastPlaybackPosition.paragraphIndex + 1) / session.paragraphs.length) * 100);
  };

  // Filter and sort sessions
  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(searchLower) ||
        s.settings.voice.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = b.updatedAt - a.updatedAt;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'progress':
          comparison = getSessionProgress(b) - getSessionProgress(a);
          break;
      }

      return sortOrder === 'desc' ? comparison : -comparison;
    });
  }, [sessions, search, sortBy, sortOrder]);

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

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

  const handleStartRename = (session: AudioSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingName(session.name);
  };

  const handleSaveRename = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingSessionId || !editingName.trim()) {
      setEditingSessionId(null);
      return;
    }

    try {
      const success = await updateSessionName(editingSessionId, editingName.trim());
      if (success) {
        setSessions(sessions.map(s =>
          s.id === editingSessionId ? { ...s, name: editingName.trim() } : s
        ));
      }
    } catch (err) {
      console.error('Error renaming session:', err);
    }

    setEditingSessionId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(null);
  };

  const handleExportSession = async (session: AudioSession, e: React.MouseEvent) => {
    e.stopPropagation();

    if (exportingSessionId) return; // Already exporting

    setExportingSessionId(session.id);
    setExportProgress(0);

    try {
      // Prepare session for export (converts audio to base64)
      const exportSession = await prepareSessionForExport(
        session,
        (progress) => setExportProgress(progress)
      );

      // Download the file
      downloadSessionAsFile(exportSession);
    } catch (err) {
      console.error('Error exporting session:', err);
      setError('Failed to export session. Please try again.');
    } finally {
      setExportingSessionId(null);
      setExportProgress(0);
    }
  };

  const handlePlaySession = (session: AudioSession, e: React.MouseEvent) => {
    e.stopPropagation();
    onLoadSession(session);
  };

  const formatRelativeDate = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 30) {
      return new Date(timestamp).toLocaleDateString();
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
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
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-lg text-gray-200">Saved Sessions</h3>
        <span className="text-sm text-gray-400">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Search and Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-dark-400 border border-dark-500 rounded text-gray-200 text-sm focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="px-3 py-2 bg-dark-400 border border-dark-500 rounded text-gray-200 text-sm focus:ring-2 focus:ring-accent-primary/50"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="progress">Sort by Progress</option>
          </select>
          <button
            onClick={toggleSortOrder}
            className="px-3 py-2 bg-dark-400 border border-dark-500 rounded text-gray-300 hover:bg-dark-500 transition-colors"
            title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
          >
            {sortOrder === 'desc' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Session List */}
      {filteredSessions.length === 0 ? (
        <div className="p-4 text-center bg-dark-300 rounded-lg border border-dark-400">
          <p className="text-gray-400">No sessions match your search.</p>
        </div>
      ) : (
        <div className="divide-y divide-dark-400 border border-dark-400 rounded-lg overflow-hidden">
          {filteredSessions.map((session) => {
            const progress = getSessionProgress(session);
            const isEditing = editingSessionId === session.id;

            return (
              <div
                key={session.id}
                onClick={() => !isEditing && onLoadSession(session)}
                className="p-4 bg-dark-300 hover:bg-dark-400 transition-colors cursor-pointer"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Session Name */}
                    {isEditing ? (
                      <div className="flex items-center gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 px-2 py-1 bg-dark-500 border border-dark-600 rounded text-gray-200 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(e as unknown as React.MouseEvent);
                            if (e.key === 'Escape') handleCancelRename(e as unknown as React.MouseEvent);
                          }}
                        />
                        <button
                          onClick={handleSaveRename}
                          className="p-1 text-accent-success hover:bg-dark-500 rounded"
                          title="Save"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={handleCancelRename}
                          className="p-1 text-gray-400 hover:bg-dark-500 rounded"
                          title="Cancel"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-200 truncate">{session.name}</h4>
                        <button
                          onClick={(e) => handleStartRename(session, e)}
                          className="p-1 text-gray-500 hover:text-gray-300 hover:bg-dark-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Rename"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
                      <span>{session.paragraphs.length} paragraphs</span>
                      <span className="text-gray-600">|</span>
                      <span>{session.settings.voice.replace('.wav', '')}</span>
                      {session.isOfflineSession && (
                        <>
                          <span className="text-gray-600">|</span>
                          <span className="text-accent-success">Offline</span>
                        </>
                      )}
                    </div>

                    {/* Progress bar */}
                    {progress > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-dark-500 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-primary rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Date */}
                    <p className="text-xs text-gray-500 mt-2">
                      Updated {formatRelativeDate(session.updatedAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {/* Play button */}
                    <button
                      onClick={(e) => handlePlaySession(session, e)}
                      className="p-1.5 text-accent-success hover:text-accent-success hover:bg-dark-500 rounded"
                      title={progress > 0 ? 'Resume' : 'Play'}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    {/* Export button */}
                    <button
                      onClick={(e) => handleExportSession(session, e)}
                      disabled={exportingSessionId !== null}
                      className={`p-1.5 rounded ${
                        exportingSessionId === session.id
                          ? 'text-accent-primary animate-pulse'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-dark-500'
                      }`}
                      title={exportingSessionId === session.id ? `Exporting ${exportProgress}%` : 'Export session'}
                    >
                      {exportingSessionId === session.id ? (
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      )}
                    </button>
                    {/* Rename button */}
                    <button
                      onClick={(e) => handleStartRename(session, e)}
                      className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-dark-500 rounded"
                      title="Rename session"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    {/* Delete button */}
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
              </div>
            );
          })}
        </div>
      )}

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
