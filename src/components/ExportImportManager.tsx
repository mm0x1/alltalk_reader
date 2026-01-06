import React, { useState } from 'react';
import {
  type AudioSession,
  prepareSessionForExport,
  prepareSessionForExportFromCache,
  getCachedAudioBlobsForSession,
  downloadSessionAsFile,
  importSessionFromFile
} from '~/services/session';
import ProgressBarIndicator from './ProgressBarIndicator';

interface ExportImportManagerProps {
  session: AudioSession | null;
  isPreGenerated: boolean;
  onImportSession: (session: AudioSession) => void;
  onClose: () => void;
}

export default function ExportImportManager({ 
  session, 
  isPreGenerated,
  onImportSession,
  onClose 
}: ExportImportManagerProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Handle session export
  const handleExportSession = async () => {
    if (!session) {
      setExportError('No session available to export');
      return;
    }

    if (!isPreGenerated) {
      setExportError('Please pre-generate all audio before exporting');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportError(null);

    try {
      // First try to use cached audio blobs (works offline)
      const cachedBlobs = getCachedAudioBlobsForSession(session.id);
      const hasCachedAudio = Object.keys(cachedBlobs).length === session.paragraphs.length;
      
      let exportableSession: AudioSession;
      
      if (hasCachedAudio) {
        console.log('Using cached audio data for export (offline capable)');
        exportableSession = await prepareSessionForExportFromCache(session, cachedBlobs, setExportProgress);
      } else {
        console.log('No cached audio found, attempting to download from server');
        exportableSession = await prepareSessionForExport(session, setExportProgress);
      }
      
      // Download the session as a JSON file
      downloadSessionAsFile(exportableSession);
      
      setExportProgress(100);
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 1000);
    } catch (error) {
      console.error('Error exporting session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to export session';
      
      // If server fetch failed, suggest the user that AllTalk server might be offline
      if (errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
        setExportError('Export failed: AllTalk server appears to be offline. ' +
                      'Pre-generate the session again while the server is online to enable offline export.');
      } else {
        setExportError(errorMessage);
      }
      setIsExporting(false);
    }
  };

  // Handle file selection for import
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }

    const file = e.target.files[0];
    setIsImporting(true);
    setImportError(null);

    try {
      const importedSession = await importSessionFromFile(file);
      onImportSession(importedSession);
      setIsImporting(false);
    } catch (error) {
      console.error('Error importing session:', error);
      setImportError(error instanceof Error ? error.message : 'Failed to import session');
      setIsImporting(false);
    }

    // Clear the file input
    e.target.value = '';
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Export / Import Session</h2>
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

      <div className="space-y-6">
        {/* Export Section */}
        <div className="border border-dark-500 rounded-lg p-4 bg-dark-300">
          <h3 className="font-medium text-base mb-3 text-gray-200">Export Session</h3>
          <p className="text-gray-400 mb-4">
            Export a pre-generated session with all audio files for offline playback. 
            The exported file contains all text and audio data needed for offline use.
          </p>

          {isExporting && (
            <div className="mb-4">
              <ProgressBarIndicator 
                progress={exportProgress}
                label="Export Progress"
                colorClass="bg-accent-primary"
              />
              <p className="text-sm text-gray-400 mt-1">
                Downloading and packaging audio files ({Math.round(exportProgress)}%)...
              </p>
            </div>
          )}

          {exportError && (
            <div className="mb-4 p-3 bg-accent-danger/20 text-accent-danger rounded-lg border border-accent-danger/30">
              <p className="font-medium">Export Error</p>
              <p className="text-sm mt-1">{exportError}</p>
            </div>
          )}

          <button
            onClick={handleExportSession}
            disabled={!session || !isPreGenerated || isExporting}
            className={`px-4 py-2 rounded flex items-center ${
              !session || !isPreGenerated || isExporting
                ? 'bg-dark-200 text-gray-500 cursor-not-allowed'
                : 'bg-accent-primary hover:bg-accent-primary/80 text-white'
            }`}
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export Session
              </>
            )}
          </button>
          
          {!isPreGenerated && session && (
            <p className="text-sm text-amber-400 mt-2">
              Please use the "Pre-Generate All Audio" button to generate all audio files before exporting.
            </p>
          )}
        </div>

        {/* Import Section */}
        <div className="border border-dark-500 rounded-lg p-4 bg-dark-300">
          <h3 className="font-medium text-base mb-3 text-gray-200">Import Session</h3>
          <p className="text-gray-400 mb-4">
            Import a previously exported session with embedded audio files for offline playback.
            This will replace any current session.
          </p>

          {importError && (
            <div className="mb-4 p-3 bg-accent-danger/20 text-accent-danger rounded-lg border border-accent-danger/30">
              <p className="font-medium">Import Error</p>
              <p className="text-sm mt-1">{importError}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label 
              htmlFor="file-upload"
              className={`px-4 py-2 rounded flex items-center ${
                isImporting
                  ? 'bg-dark-200 text-gray-500 cursor-not-allowed'
                  : 'bg-accent-primary hover:bg-accent-primary/80 text-white cursor-pointer'
              }`}
            >
              {isImporting ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Importing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L4 8m4-4v12" />
                  </svg>
                  Select File to Import
                </>
              )}
              <input
                id="file-upload"
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                disabled={isImporting}
                className="sr-only"
              />
            </label>
          </div>
          
          <p className="text-sm text-gray-400 mt-2">
            Only files previously exported from AllTalk Reader can be imported.
          </p>
        </div>

      </div>
    </div>
  );
}
