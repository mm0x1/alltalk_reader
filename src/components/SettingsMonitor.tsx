import React, { useState, useEffect } from 'react';
import { getBaseUrl, API_CONFIG } from '~/config/env';
import { useApiState } from '~/contexts/ApiStateContext';

interface SettingsMonitorProps {
  onConnectionStatusChange?: (connected: boolean) => void;
}

export default function SettingsMonitor({ onConnectionStatusChange }: SettingsMonitorProps) {
  const { state, actions } = useApiState();
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);

  // Monitor server status periodically
  useEffect(() => {
    const checkStatus = async () => {
      const isReady = await actions.checkConnection();
      setLastCheckTime(new Date());

      if (onConnectionStatusChange) {
        onConnectionStatusChange(isReady);
      }
    };

    // Check immediately
    checkStatus();

    // Then check every 30 seconds
    const interval = setInterval(checkStatus, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [onConnectionStatusChange, actions]);

  const handleRefreshStatus = async () => {
    const isReady = await actions.checkConnection();
    setLastCheckTime(new Date());
    if (onConnectionStatusChange) {
      onConnectionStatusChange(isReady);
    }
  };

  const handleReloadConfig = async () => {
    await actions.reloadConfig();
    setLastCheckTime(new Date());
  };

  return (
    <div className="card mb-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold text-gray-200">AllTalk Server Status</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefreshStatus}
            className="p-2 bg-accent-primary hover:bg-accent-hover text-white rounded transition-colors"
            title="Refresh connection status"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={handleReloadConfig}
            className="p-2 bg-accent-success hover:bg-accent-success/80 text-white rounded transition-colors"
            title="Reload AllTalk configuration"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        <div>
          <div className="flex items-center">
            <span className="font-medium mr-2 text-gray-300">Server:</span>
            {state.isConnected ? (
              <span className="text-accent-success flex items-center">
                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Connected
              </span>
            ) : (
              <span className="text-accent-danger flex items-center">
                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                Disconnected
              </span>
            )}
          </div>
          <div className="text-gray-300">
            <span className="font-medium">URL:</span> {getBaseUrl()}
          </div>
          <div className="text-gray-300">
            <span className="font-medium">Available voices:</span> {state.availableVoices?.length || 0}
          </div>
        </div>

        <div>
          <div className="text-gray-300">
            <span className="font-medium">Max characters:</span> {API_CONFIG.maxCharacters}
          </div>
          <div className="text-gray-300">
            <span className="font-medium">Last check:</span> {lastCheckTime ? lastCheckTime.toLocaleTimeString() : 'Never'}
          </div>
          {state.error && (
            <div className="text-accent-danger">
              <span className="font-medium">Error:</span> {state.error}
            </div>
          )}
        </div>
      </div>

      {state.isInitializing && (
        <div className="mt-2 text-sm text-gray-400">
          Connecting to server...
        </div>
      )}
    </div>
  );
}
