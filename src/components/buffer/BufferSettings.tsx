/**
 * BufferSettings Component
 *
 * Configuration controls for buffered playback mode.
 * Allows users to adjust buffer size and other settings.
 */

import type { BufferedPlaybackConfig } from '~/services/generation';

interface BufferSettingsProps {
  config: BufferedPlaybackConfig;
  onConfigChange: (config: Partial<BufferedPlaybackConfig>) => void;
  disabled?: boolean;
}

export function BufferSettings({
  config,
  onConfigChange,
  disabled = false,
}: BufferSettingsProps) {
  const { targetBufferSize, minBufferSize } = config;

  return (
    <div className="bg-dark-400 rounded-lg p-3 space-y-3">
      <h4 className="text-sm font-medium text-gray-200">Buffer Settings</h4>

      {/* Target buffer size */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <label htmlFor="targetBuffer" className="text-gray-400">
            Buffer Size
          </label>
          <span className="text-gray-300">{targetBufferSize} paragraphs</span>
        </div>
        <input
          id="targetBuffer"
          type="range"
          min={2}
          max={10}
          value={targetBufferSize}
          onChange={(e) => onConfigChange({ targetBufferSize: Number(e.target.value) })}
          disabled={disabled}
          className="w-full h-2 bg-dark-500 rounded-lg appearance-none cursor-pointer accent-accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-0.5">
          <span>2</span>
          <span>10</span>
        </div>
      </div>

      {/* Minimum buffer size */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <label htmlFor="minBuffer" className="text-gray-400">
            Min Buffer (pause threshold)
          </label>
          <span className="text-gray-300">{minBufferSize} paragraphs</span>
        </div>
        <input
          id="minBuffer"
          type="range"
          min={1}
          max={Math.max(targetBufferSize - 1, 1)}
          value={minBufferSize}
          onChange={(e) => onConfigChange({ minBufferSize: Number(e.target.value) })}
          disabled={disabled}
          className="w-full h-2 bg-dark-500 rounded-lg appearance-none cursor-pointer accent-accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-0.5">
          <span>1</span>
          <span>{Math.max(targetBufferSize - 1, 1)}</span>
        </div>
      </div>

      {/* Info text */}
      <p className="text-xs text-gray-500">
        Buffer Play generates audio ahead while you listen, combining quick start with
        smooth playback. Increase buffer size for more reliable playback on slower
        connections.
      </p>
    </div>
  );
}

export default BufferSettings;
