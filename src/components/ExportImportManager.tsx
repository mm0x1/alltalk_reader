import React, { useState, useRef, useCallback, useEffect } from 'react';
import { type AudioSession } from '~/services/session';
import {
  exportSessionToZip,
  estimateZipSize,
  importSessionFromZip,
  detectFileFormat,
  type ExportProgress,
  type ImportProgress,
  type ExportFormat,
} from '~/services/export';
import { importSessionFromFile } from '~/services/session';
import ProgressBarIndicator from './ProgressBarIndicator';

interface ExportImportManagerProps {
  session: AudioSession | null;
  isPreGenerated: boolean;
  onImportSession: (session: AudioSession) => void;
  onClose: () => void;
}

type ExportPhase = ExportProgress['phase'];
type ImportPhase = ImportProgress['phase'];

const PHASE_LABELS: Record<ExportPhase | ImportPhase, string> = {
  preparing: 'Preparing',
  packaging: 'Packaging',
  finalizing: 'Finalizing',
  reading: 'Reading',
  validating: 'Validating',
  extracting: 'Extracting',
  storing: 'Storing',
};

export default function ExportImportManager({
  session,
  isPreGenerated,
  onImportSession,
  onClose,
}: ExportImportManagerProps) {
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('zip');
  const [estimatedSize, setEstimatedSize] = useState<{ estimatedMB: number; audioCount: number } | null>(null);
  const exportAbortController = useRef<AbortController | null>(null);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const importAbortController = useRef<AbortController | null>(null);

  // Estimate ZIP size when session changes
  useEffect(() => {
    if (session && isPreGenerated) {
      estimateZipSize(session).then(setEstimatedSize).catch(() => setEstimatedSize(null));
    } else {
      setEstimatedSize(null);
    }
  }, [session, isPreGenerated]);

  // Handle export
  const handleExport = useCallback(async () => {
    if (!session) {
      setExportError('No session available to export');
      return;
    }

    if (!isPreGenerated) {
      setExportError('Please pre-generate all audio before exporting');
      return;
    }

    setIsExporting(true);
    setExportProgress(null);
    setExportError(null);

    exportAbortController.current = new AbortController();

    try {
      const result = await exportSessionToZip(session, {
        format: exportFormat,
        onProgress: setExportProgress,
        abortSignal: exportAbortController.current.signal,
      });

      if (!result.success) {
        throw new Error(result.error || 'Export failed');
      }

      // Success - show completion briefly
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(null);
      }, 1500);
    } catch (error) {
      console.error('Export error:', error);
      const message = error instanceof Error ? error.message : 'Export failed';
      setExportError(message);
      setIsExporting(false);
      setExportProgress(null);
    } finally {
      exportAbortController.current = null;
    }
  }, [session, isPreGenerated, exportFormat]);

  // Cancel export
  const handleCancelExport = useCallback(() => {
    if (exportAbortController.current) {
      exportAbortController.current.abort();
      setIsExporting(false);
      setExportProgress(null);
    }
  }, []);

  // Handle file selection for import
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) {
        return;
      }

      const file = e.target.files[0];
      setIsImporting(true);
      setImportProgress(null);
      setImportError(null);

      importAbortController.current = new AbortController();

      try {
        const format = detectFileFormat(file);

        if (format === 'zip') {
          // New ZIP format
          const result = await importSessionFromZip(file, {
            onProgress: setImportProgress,
            abortSignal: importAbortController.current.signal,
          });

          if (!result.success || !result.session) {
            throw new Error(result.error || 'Import failed');
          }

          onImportSession(result.session);
        } else if (format === 'json') {
          // Legacy JSON format
          const importedSession = await importSessionFromFile(file);
          onImportSession(importedSession);
        } else {
          throw new Error('Unsupported file format. Please use .zip or .json files.');
        }

        setIsImporting(false);
        setImportProgress(null);
      } catch (error) {
        console.error('Import error:', error);
        const message = error instanceof Error ? error.message : 'Import failed';
        setImportError(message);
        setIsImporting(false);
        setImportProgress(null);
      } finally {
        importAbortController.current = null;
      }

      // Clear the file input
      e.target.value = '';
    },
    [onImportSession]
  );

  // Cancel import
  const handleCancelImport = useCallback(() => {
    if (importAbortController.current) {
      importAbortController.current.abort();
      setIsImporting(false);
      setImportProgress(null);
    }
  }, []);

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Export / Import Session</h2>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-dark-400 rounded"
          title="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-6">
        {/* Export Section */}
        <div className="border border-dark-500 rounded-lg p-4 bg-dark-300">
          <h3 className="font-medium text-base mb-3 text-gray-200">Export Session</h3>
          <p className="text-gray-400 mb-4">
            Export a pre-generated session as a compressed ZIP file for offline playback.
            ZIP format is smaller and works better with large sessions.
          </p>

          {/* Size estimate */}
          {estimatedSize && !isExporting && (
            <p className="text-sm text-gray-400 mb-3">
              Estimated size: ~{estimatedSize.estimatedMB} MB ({estimatedSize.audioCount} audio files)
            </p>
          )}

          {/* Export progress */}
          {isExporting && exportProgress && (
            <div className="mb-4">
              <ProgressBarIndicator
                progress={exportProgress.percentage}
                label={`${PHASE_LABELS[exportProgress.phase]} (${exportProgress.percentage}%)`}
                colorClass="bg-accent-primary"
              />
              <p className="text-sm text-gray-400 mt-1">{exportProgress.message}</p>
            </div>
          )}

          {/* Export error */}
          {exportError && (
            <div className="mb-4 p-3 bg-accent-danger/20 text-accent-danger rounded-lg border border-accent-danger/30">
              <p className="font-medium">Export Error</p>
              <p className="text-sm mt-1">{exportError}</p>
            </div>
          )}

          {/* Export buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={!session || !isPreGenerated || isExporting}
              className={`px-4 py-2 rounded flex items-center ${
                !session || !isPreGenerated || isExporting
                  ? 'bg-dark-200 text-gray-500 cursor-not-allowed'
                  : 'bg-accent-primary hover:bg-accent-primary/80 text-white'
              }`}
            >
              {isExporting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 mr-2"
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
                  Exporting...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Export as ZIP
                </>
              )}
            </button>

            {isExporting && (
              <button
                onClick={handleCancelExport}
                className="px-4 py-2 rounded bg-accent-danger hover:bg-accent-danger/80 text-white"
              >
                Cancel
              </button>
            )}
          </div>

          {!isPreGenerated && session && (
            <p className="text-sm text-amber-400 mt-2">
              Please use the "Pre-Generate All Audio" button to generate all audio files
              before exporting.
            </p>
          )}
        </div>

        {/* Import Section */}
        <div className="border border-dark-500 rounded-lg p-4 bg-dark-300">
          <h3 className="font-medium text-base mb-3 text-gray-200">Import Session</h3>
          <p className="text-gray-400 mb-4">
            Import a previously exported session for offline playback. Supports both ZIP
            (recommended) and legacy JSON formats.
          </p>

          {/* Import progress */}
          {isImporting && importProgress && (
            <div className="mb-4">
              <ProgressBarIndicator
                progress={importProgress.percentage}
                label={`${PHASE_LABELS[importProgress.phase]} (${importProgress.percentage}%)`}
                colorClass="bg-accent-primary"
              />
              <p className="text-sm text-gray-400 mt-1">{importProgress.message}</p>
            </div>
          )}

          {/* Import error */}
          {importError && (
            <div className="mb-4 p-3 bg-accent-danger/20 text-accent-danger rounded-lg border border-accent-danger/30">
              <p className="font-medium">Import Error</p>
              <p className="text-sm mt-1">{importError}</p>
            </div>
          )}

          <div className="flex items-center gap-2">
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
                  <svg
                    className="animate-spin h-4 w-4 mr-2"
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
                  Importing...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L4 8m4-4v12"
                    />
                  </svg>
                  Select File to Import
                </>
              )}
              <input
                id="file-upload"
                type="file"
                accept=".zip,.json"
                onChange={handleFileSelect}
                disabled={isImporting}
                className="sr-only"
              />
            </label>

            {isImporting && (
              <button
                onClick={handleCancelImport}
                className="px-4 py-2 rounded bg-accent-danger hover:bg-accent-danger/80 text-white"
              >
                Cancel
              </button>
            )}
          </div>

          <p className="text-sm text-gray-400 mt-2">
            Accepts .zip (recommended) or .json files exported from AllTalk Reader.
          </p>
        </div>
      </div>
    </div>
  );
}
