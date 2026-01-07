/**
 * Advanced TTS Settings Component
 *
 * Controls for temperature and repetition penalty.
 * Only visible when VITE_ADVANCED_API_SETTINGS is enabled.
 */

import React from 'react';
import { useCapabilities } from '~/hooks/useCapabilities';

interface AdvancedTtsSettingsProps {
  temperature: number;
  repetitionPenalty: number;
  onTemperatureChange: (value: number) => void;
  onRepetitionPenaltyChange: (value: number) => void;
  defaults: {
    temperature: number;
    repetitionPenalty: number;
  };
  className?: string;
}

export default function AdvancedTtsSettings({
  temperature,
  repetitionPenalty,
  onTemperatureChange,
  onRepetitionPenaltyChange,
  defaults,
  className = '',
}: AdvancedTtsSettingsProps) {
  const capabilities = useCapabilities();
  const temperatureCapable = capabilities.temperature;

  return (
    <div className={className}>
      <h3 className="text-sm font-medium mb-2 text-gray-200">Advanced TTS Settings</h3>
      <p className="text-xs text-gray-400 mb-3">
        Fine-tune TTS generation for better audiobook quality.
      </p>

      <div className="space-y-3">
        {/* Temperature setting */}
        <div className={`${!temperatureCapable ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex justify-between">
            <label className="block text-sm text-gray-300">
              Temperature: {temperature.toFixed(2)}
            </label>
            <button
              onClick={() => onTemperatureChange(defaults.temperature)}
              className="text-xs text-accent-primary hover:text-accent-hover"
              disabled={!temperatureCapable}
            >
              Reset
            </button>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={temperature}
            onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
            className="w-full accent-accent-primary bg-dark-400"
            disabled={!temperatureCapable}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0.1 (Consistent)</span>
            <span>1.0 (Varied)</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Higher values produce more varied output. Lower values are more consistent.
          </p>
        </div>

        {/* Repetition Penalty setting */}
        <div>
          <div className="flex justify-between">
            <label className="block text-sm text-gray-300">
              Repetition Penalty: {repetitionPenalty.toFixed(1)}
            </label>
            <button
              onClick={() => onRepetitionPenaltyChange(defaults.repetitionPenalty)}
              className="text-xs text-accent-primary hover:text-accent-hover"
            >
              Reset
            </button>
          </div>
          <input
            type="range"
            min="1.0"
            max="20.0"
            step="0.5"
            value={repetitionPenalty}
            onChange={(e) => onRepetitionPenaltyChange(parseFloat(e.target.value))}
            className="w-full accent-accent-primary bg-dark-400"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>1.0 (Natural)</span>
            <span>20.0 (No Repetition)</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Higher values reduce repetitive speech patterns. Useful for long texts.
          </p>
        </div>
      </div>

      {!temperatureCapable && (
        <p className="mt-2 text-xs text-accent-warning">
          Temperature control is not supported by the current TTS engine.
        </p>
      )}
    </div>
  );
}
