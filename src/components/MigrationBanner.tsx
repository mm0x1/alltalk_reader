/**
 * Migration Banner
 *
 * Displays a notification when there are cached sessions in sessionStorage
 * that can be migrated to IndexedDB for better performance.
 */

import React, { useState, useEffect } from 'react';
import {
  hasPendingMigration,
  getPendingMigrationCount,
  migrateFromSessionStorage,
  type MigrationProgress,
} from '~/services/storage';
import ProgressBarIndicator from './ProgressBarIndicator';

interface MigrationBannerProps {
  onMigrationComplete?: () => void;
}

export default function MigrationBanner({ onMigrationComplete }: MigrationBannerProps) {
  const [hasPending, setHasPending] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Check for pending migrations on mount
  useEffect(() => {
    const check = () => {
      const pending = hasPendingMigration();
      setHasPending(pending);
      if (pending) {
        setPendingCount(getPendingMigrationCount());
      }
    };
    check();
  }, []);

  const handleMigrate = async () => {
    setIsMigrating(true);
    setError(null);

    try {
      const result = await migrateFromSessionStorage((prog) => {
        setProgress(prog);
      });

      if (result.failed > 0) {
        setError(`Migration completed with ${result.failed} failures`);
      }

      // Refresh the pending state
      setHasPending(hasPendingMigration());
      onMigrationComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  // Don't show if no pending migrations or dismissed
  if (!hasPending || dismissed) {
    return null;
  }

  return (
    <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-amber-200">Cache Migration Available</h3>
          <p className="text-sm text-amber-300/80 mt-1">
            Found {pendingCount} session(s) with cached audio in the old format.
            Migrating to the new storage will improve performance with large sessions.
          </p>

          {/* Progress */}
          {isMigrating && progress && (
            <div className="mt-3">
              <ProgressBarIndicator
                progress={
                  progress.total > 0
                    ? Math.round((progress.migrated / progress.total) * 100)
                    : 0
                }
                label={`Migrating ${progress.migrated}/${progress.total}...`}
                colorClass="bg-amber-500"
              />
              {progress.currentSession && (
                <p className="text-xs text-amber-400 mt-1">
                  Processing: {progress.currentSession.substring(0, 30)}...
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400 mt-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleMigrate}
              disabled={isMigrating}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                isMigrating
                  ? 'bg-amber-800 text-amber-400 cursor-not-allowed'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              {isMigrating ? 'Migrating...' : 'Migrate Now'}
            </button>
            <button
              onClick={handleDismiss}
              disabled={isMigrating}
              className="px-3 py-1.5 rounded text-sm text-amber-300 hover:text-amber-100"
            >
              Dismiss
            </button>
          </div>
        </div>

        {/* Close button */}
        {!isMigrating && (
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-amber-800/50 rounded"
            title="Dismiss"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-amber-400"
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
        )}
      </div>
    </div>
  );
}
