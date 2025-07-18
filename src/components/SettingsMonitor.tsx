import React, { useState, useEffect } from 'react';
import {
  getApiConfig,
  updateApiConfig,
  getServerStatus,
  checkServerReady,
  reloadConfig
} from '~/services/alltalkApi';

interface SettingsMonitorProps {
  onConnectionStatusChange?: (connected: boolean) => void;
}

export default function SettingsMonitor({ onConnectionStatusChange }: SettingsMonitorProps) {
  const [apiSettings, setApiSettings] = useState(getApiConfig());
  const [serverStatus, setServerStatus] = useState(getServerStatus());
  const [isEditing, setIsEditing] = useState(false);
  const [tempSettings, setTempSettings] = useState(getApiConfig());
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);

  // Monitor server status periodically
  useEffect(() => {
    const checkStatus = async () => {
      const isReady = await checkServerReady();
      setServerStatus(getServerStatus());
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
  }, [onConnectionStatusChange]);

  const handleSaveSettings = () => {
    updateApiConfig(tempSettings);
    setApiSettings(getApiConfig());
    setIsEditing(false);
    checkServerReady();
  };

  const handleReloadConfig = async () => {
    const success = await reloadConfig();
    if (success) {
      setServerStatus(getServerStatus());
    }
  };

  if (!isEditing) {
    return (
      <div className="bg-stone-800 p-4 rounded-lg mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">AllTalk Server Status</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsEditing(true)}
              className="px-2 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
              title="Edit API settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            <button
              onClick={() => checkServerReady().then(() => setServerStatus(getServerStatus()))}
              className="px-2 py-1 text-sm bg-blue-100 hover:bg-blue-200 rounded"
              title="Refresh connection status"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={handleReloadConfig}
              className="px-2 py-1 text-sm bg-green-100 hover:bg-green-200 rounded"
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
              <span className="font-medium mr-2">Server:</span>
              {serverStatus.ready ? (
                <span className="text-green-600 flex items-center">
                  <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Connected
                </span>
              ) : (
                <span className="text-red-600 flex items-center">
                  <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Disconnected
                </span>
              )}
            </div>
            <div>
              <span className="font-medium">URL:</span> {apiSettings.protocol}{apiSettings.ipPort}
            </div>
            <div>
              <span className="font-medium">Available voices:</span> {serverStatus.availableVoices?.length || 0}
            </div>
          </div>

          <div>
            <div>
              <span className="font-medium">Max characters:</span> {apiSettings.maxCharacters}
            </div>
            <div>
              <span className="font-medium">Last check:</span> {lastCheckTime ? lastCheckTime.toLocaleTimeString() : 'Never'}
            </div>
            {serverStatus.error && (
              <div className="text-red-600">
                <span className="font-medium">Error:</span> {serverStatus.error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-stone-800 p-4 rounded-lg mb-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Edit API Settings</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsEditing(false)}
            className="px-3 py-1 text-sm bg-gray-300 hover:bg-gray-400 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSettings}
            className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded"
          >
            Save
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Protocol</label>
            <select
              value={tempSettings.protocol}
              onChange={(e) => setTempSettings({ ...tempSettings, protocol: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded"
            >
              <option value="http://">HTTP</option>
              <option value="https://">HTTPS</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">IP:Port</label>
            <input
              type="text"
              value={tempSettings.ipPort}
              onChange={(e) => setTempSettings({ ...tempSettings, ipPort: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="localhost:7851"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Connection Timeout (seconds)</label>
            <input
              type="number"
              min="1"
              max="60"
              value={tempSettings.connectionTimeout}
              onChange={(e) => setTempSettings({ ...tempSettings, connectionTimeout: parseInt(e.target.value) })}
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Max Characters per Request</label>
            <input
              type="number"
              min="100"
              max="10000"
              value={tempSettings.maxCharacters}
              onChange={(e) => setTempSettings({ ...tempSettings, maxCharacters: parseInt(e.target.value) })}
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="4096"
            />
          </div>
        </div>

        <div className="text-sm text-gray-600 italic">
          Note: After changing these settings, the app will attempt to reconnect to the server.
        </div>
      </div>
    </div>
  );
}
