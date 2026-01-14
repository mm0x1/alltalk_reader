/**
 * AllTalk Server Settings Component
 *
 * Controls for server-side AllTalk settings:
 * - DeepSpeed toggle
 * - Low VRAM mode toggle
 * - Model switching (if multiple models available)
 *
 * Only visible when VITE_ADVANCED_API_SETTINGS is enabled.
 */

import React, { useState, useEffect } from 'react';
import { useCapabilities } from '~/hooks/useCapabilities';
import { useApiState } from '~/contexts/ApiStateContext';
import type { StatusService } from '~/services/api/status';

interface AllTalkServerSettingsProps {
  className?: string;
}

export default function AllTalkServerSettings({
  className = '',
}: AllTalkServerSettingsProps) {
  const capabilities = useCapabilities();
  const { actions } = useApiState();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [statusServiceRef, setStatusServiceRef] = useState<StatusService | null>(null);

  // Only run on client side to avoid SSR issues
  useEffect(() => {
    setIsClient(true);
    // Dynamically import to avoid SSR serialization issues
    import('~/services/api/status').then(({ statusService }) => {
      setStatusServiceRef(statusService);
    });
  }, []);

  const handleDeepSpeedToggle = async () => {
    if (!capabilities.deepspeed || !statusServiceRef) return;

    setIsLoading(true);
    setError(null);
    try {
      await statusServiceRef.toggleDeepSpeed(!capabilities.deepspeedEnabled);
      // Refresh settings after toggle
      await actions.initializeApi();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle DeepSpeed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLowVramToggle = async () => {
    if (!capabilities.lowvram || !statusServiceRef) return;

    setIsLoading(true);
    setError(null);
    try {
      await statusServiceRef.toggleLowVram(!capabilities.lowvramEnabled);
      // Refresh settings after toggle
      await actions.initializeApi();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle Low VRAM');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelSwitch = async (modelName: string) => {
    if (!modelName || modelName === capabilities.currentModel || !statusServiceRef) return;

    setIsLoading(true);
    setError(null);
    try {
      await statusServiceRef.switchModel(modelName);
      // Refresh settings after model switch
      await actions.initializeApi();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch model');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render during SSR
  if (!isClient) {
    return null;
  }

  // Don't render if no advanced features are available
  const hasAnyFeature = capabilities.deepspeed || capabilities.lowvram || capabilities.availableModels.length > 1;
  if (!hasAnyFeature) {
    return null;
  }

  return (
    <div className={className}>
      <h3 className="text-sm font-medium mb-2 text-gray-200">AllTalk Server Settings</h3>
      <p className="text-xs text-gray-400 mb-3">
        Server-side settings for performance optimization.
      </p>

      {error && (
        <div className="mb-3 p-2 bg-red-900/30 border border-red-700 rounded text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {/* Current Status Display */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {capabilities.currentEngine && (
            <div>
              <span className="text-gray-400">Engine:</span>
              <span className="ml-2 text-gray-200">{capabilities.currentEngine}</span>
            </div>
          )}
          {capabilities.currentModel && (
            <div>
              <span className="text-gray-400">Model:</span>
              <span className="ml-2 text-gray-200">{capabilities.currentModel}</span>
            </div>
          )}
          {capabilities.audioFormat && (
            <div>
              <span className="text-gray-400">Audio:</span>
              <span className="ml-2 text-gray-200">{capabilities.audioFormat}</span>
            </div>
          )}
        </div>

        {/* DeepSpeed Toggle */}
        {capabilities.deepspeed && (
          <div className="flex items-center justify-between p-2 bg-dark-200 rounded">
            <div>
              <label className="block text-sm text-gray-300">DeepSpeed Acceleration</label>
              <p className="text-xs text-gray-500">Faster generation with optimized inference</p>
            </div>
            <button
              onClick={handleDeepSpeedToggle}
              disabled={isLoading}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                capabilities.deepspeedEnabled
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-dark-400 hover:bg-dark-300 text-gray-300'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? '...' : capabilities.deepspeedEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        )}

        {/* Low VRAM Toggle */}
        {capabilities.lowvram && (
          <div className="flex items-center justify-between p-2 bg-dark-200 rounded">
            <div>
              <label className="block text-sm text-gray-300">Low VRAM Mode</label>
              <p className="text-xs text-gray-500">Reduces GPU memory usage (slower)</p>
            </div>
            <button
              onClick={handleLowVramToggle}
              disabled={isLoading}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                capabilities.lowvramEnabled
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  : 'bg-dark-400 hover:bg-dark-300 text-gray-300'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? '...' : capabilities.lowvramEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        )}

        {/* Model Selector (if multiple models available) */}
        {capabilities.availableModels.length > 1 && (
          <div>
            <label className="block text-sm mb-1 text-gray-300">TTS Model</label>
            <select
              value={capabilities.currentModel || ''}
              onChange={(e) => handleModelSwitch(e.target.value)}
              className="input-field"
              disabled={isLoading}
            >
              {capabilities.availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Changing models will reload the TTS engine. This may take a moment.
            </p>
          </div>
        )}
      </div>

      {isLoading && (
        <p className="mt-2 text-xs text-accent-warning">
          Applying changes... This may take a moment.
        </p>
      )}
    </div>
  );
}
