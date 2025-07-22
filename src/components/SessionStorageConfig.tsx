import React, { useState, useEffect } from 'react';
import { initializeSessionApi, getSessionApiConfig } from '~/services/sessionStorage';

interface SessionStorageConfigProps {
  onConfigChange?: (isConnected: boolean) => void;
}

export default function SessionStorageConfig({ onConfigChange }: SessionStorageConfigProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [configValues, setConfigValues] = useState({
    ipPort: getSessionApiConfig().ipPort,
    protocol: getSessionApiConfig().protocol,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get current URL
  const currentUrl = `${configValues.protocol}${configValues.ipPort}`;

  // Test connection to session storage server
  const testConnection = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${configValues.protocol}${configValues.ipPort}/api/sessions`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // Short timeout for the test
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        setIsConnected(true);
        if (onConfigChange) {
          onConfigChange(true);
        }
      } else {
        setIsConnected(false);
        setError(`Error ${response.status}: ${response.statusText}`);
        if (onConfigChange) {
          onConfigChange(false);
        }
      }
    } catch (err) {
      setIsConnected(false);
      setError(err instanceof Error ? err.message : 'Failed to connect to session storage server');
      if (onConfigChange) {
        onConfigChange(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize configuration on mount
  useEffect(() => {
    testConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply the configuration
  const applyConfig = () => {
    initializeSessionApi({
      protocol: configValues.protocol,
      ipPort: configValues.ipPort,
    });
    testConnection();
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConfigValues({
      ...configValues,
      [name]: value,
    });
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`h-3 w-3 rounded-full ${isConnected ? 'bg-accent-success' : isLoading ? 'bg-accent-primary' : 'bg-accent-danger'}`}
        ></div>
        <span className="text-sm text-gray-400">
          {isConnected
            ? 'Session storage connected'
            : isLoading
            ? 'Testing connection...'
            : 'Session storage not connected'}
        </span>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="text-xs px-2 py-1 bg-dark-300 hover:bg-dark-400 rounded ml-auto flex items-center transition-colors"
          title="Configure session storage connection"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
          Configure
        </button>
        <button
          onClick={testConnection}
          className="text-xs px-2 py-1 bg-dark-300 hover:bg-dark-400 rounded flex items-center transition-colors"
          title="Test connection"
          disabled={isLoading}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
              clipRule="evenodd"
            />
          </svg>
          Refresh
        </button>
      </div>

      {showConfig && (
        <div className="p-4 mb-4 rounded-lg bg-dark-300 border border-dark-400">
          <h3 className="text-sm font-medium text-gray-200 mb-3">Session Storage Configuration</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Protocol</label>
              <select
                name="protocol"
                value={configValues.protocol}
                onChange={handleInputChange}
                className="bg-dark-400 border border-dark-500 rounded px-3 py-1.5 w-full text-sm"
              >
                <option value="http://">HTTP</option>
                <option value="https://">HTTPS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Hostname:Port</label>
              <input
                type="text"
                name="ipPort"
                value={configValues.ipPort}
                onChange={handleInputChange}
                placeholder="e.g., localhost:3001 or 192.168.1.5:3001"
                className="bg-dark-400 border border-dark-500 rounded px-3 py-1.5 w-full text-sm"
              />
            </div>
            <div className="text-xs text-gray-400 mb-2">
              Current URL: <span className="font-mono">{currentUrl}/api</span>
            </div>
            {error && (
              <div className="text-xs text-accent-danger mb-2 bg-accent-danger/10 border border-accent-danger/20 p-2 rounded">
                {error}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfig(false)}
                className="text-xs px-3 py-1.5 bg-dark-400 hover:bg-dark-500 rounded"
              >
                Cancel
              </button>
              <button
                onClick={applyConfig}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/80 rounded"
              >
                {isLoading ? 'Applying...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
