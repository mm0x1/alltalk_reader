import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '~/config/env';

interface ServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: { host: string; port: string }) => void;
}

const STORAGE_KEY = 'alltalk-server-config';

export function getStoredServerConfig(): { host: string; port: string } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load stored server config:', e);
  }
  return null;
}

export function saveServerConfig(config: { host: string; port: string }): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save server config:', e);
  }
}

export function clearServerConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear server config:', e);
  }
}

export default function ServerConfigModal({ isOpen, onClose, onSave }: ServerConfigModalProps) {
  const [host, setHost] = useState(API_CONFIG.host);
  const [port, setPort] = useState(API_CONFIG.port);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Load stored config or defaults
      const stored = getStoredServerConfig();
      if (stored) {
        setHost(stored.host);
        setPort(stored.port);
      } else {
        setHost(API_CONFIG.host);
        setPort(API_CONFIG.port);
      }
      setError(null);
    }
  }, [isOpen]);

  const handleSave = () => {
    // Basic validation
    if (!host.trim()) {
      setError('Host is required');
      return;
    }
    if (!port.trim() || isNaN(Number(port)) || Number(port) < 1 || Number(port) > 65535) {
      setError('Port must be a number between 1 and 65535');
      return;
    }

    const config = { host: host.trim(), port: port.trim() };
    saveServerConfig(config);
    onSave(config);
    onClose();
  };

  const handleReset = () => {
    clearServerConfig();
    setHost(API_CONFIG.host);
    setPort(API_CONFIG.port);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-200 rounded-lg p-6 w-full max-w-md border border-dark-500">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-200">Server Configuration</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          Configure the AllTalk server connection. Changes will be saved to your browser and persist across sessions.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="host" className="block text-sm font-medium text-gray-300 mb-1">
              Host
            </label>
            <input
              id="host"
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="localhost or IP address"
              className="w-full px-3 py-2 bg-dark-400 border border-dark-500 rounded text-gray-200 focus:outline-none focus:border-accent-primary"
            />
          </div>

          <div>
            <label htmlFor="port" className="block text-sm font-medium text-gray-300 mb-1">
              Port
            </label>
            <input
              id="port"
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="7851"
              className="w-full px-3 py-2 bg-dark-400 border border-dark-500 rounded text-gray-200 focus:outline-none focus:border-accent-primary"
            />
          </div>

          {error && (
            <div className="text-accent-danger text-sm">{error}</div>
          )}

          <div className="text-xs text-gray-500">
            <strong>Note:</strong> After saving, the page will reload to apply the new configuration.
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-dark-400 hover:bg-dark-500 text-gray-300 rounded transition-colors"
          >
            Reset to Default
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-dark-400 hover:bg-dark-500 text-gray-300 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-accent-primary hover:bg-accent-hover text-white rounded transition-colors"
            >
              Save & Reload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
