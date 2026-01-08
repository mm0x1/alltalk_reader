/**
 * Status Service
 *
 * Handles server status checking, current settings retrieval, and server control.
 * Extracted from alltalkApi.ts for better separation of concerns.
 */

import { apiClient, ConnectionError } from './client';
import { API_CONFIG, getBaseUrl } from '~/config/env';
import { API_ENDPOINTS } from '~/design-system/constants';
import type {
  AllTalkSettings,
  ModelReloadResponse,
  DeepSpeedToggleResponse,
  LowVramToggleResponse
} from '~/types/api';

export interface ServerStatus {
  ready: boolean;
  error: string | null;
  currentSettings: AllTalkSettings | null;
  availableVoices: string[];
  availableRvcVoices: string[];
}

export class StatusService {
  constructor(private client = apiClient) {}

  async checkReady(): Promise<boolean> {
    const startTime = Date.now();
    const timeout = API_CONFIG.connectionTimeout * 1000;

    try {
      while (Date.now() - startTime < timeout) {
        try {
          const response = await this.client.get<string>(API_ENDPOINTS.READY);
          
          if (response === 'Ready') {
            return true;
          }
        } catch (error) {
          // Keep trying until timeout
        }

        // Wait a short time before trying again
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // If we get here, the server didn't respond in time
      throw new ConnectionError('Server did not respond in time. Check if AllTalk is running.');
    } catch (error) {
      if (error instanceof ConnectionError) {
        throw error;
      }
      throw new ConnectionError(`Error connecting to server: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getCurrentSettings(): Promise<AllTalkSettings> {
    try {
      const data = await this.client.get<AllTalkSettings>(API_ENDPOINTS.CURRENT_SETTINGS);
      return data;
    } catch (error) {
      throw new Error(`Error fetching settings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async reloadConfig(): Promise<void> {
    try {
      await this.client.get<void>(API_ENDPOINTS.RELOAD_CONFIG);
    } catch (error) {
      throw new Error(`Error reloading config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Switch TTS model (requires model reload)
   * @param modelName - The name of the model to load
   */
  async switchModel(modelName: string): Promise<ModelReloadResponse> {
    try {
      const url = `${getBaseUrl()}${API_ENDPOINTS.MODEL_RELOAD}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ tts_method: modelName }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const result = await response.json();
      return result as ModelReloadResponse;
    } catch (error) {
      throw new Error(`Error switching model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Toggle DeepSpeed acceleration
   * @param enable - Whether to enable or disable DeepSpeed
   */
  async toggleDeepSpeed(enable: boolean): Promise<DeepSpeedToggleResponse> {
    try {
      const params = new URLSearchParams({ new_deepspeed_value: enable ? 'True' : 'False' });
      const url = `${getBaseUrl()}${API_ENDPOINTS.DEEPSPEED_TOGGLE}?${params}`;
      const response = await fetch(url, { method: 'POST' });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const result = await response.json();
      return result as DeepSpeedToggleResponse;
    } catch (error) {
      throw new Error(`Error toggling DeepSpeed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Toggle Low VRAM mode
   * @param enable - Whether to enable or disable Low VRAM mode
   */
  async toggleLowVram(enable: boolean): Promise<LowVramToggleResponse> {
    try {
      const params = new URLSearchParams({ new_low_vram_value: enable ? 'True' : 'False' });
      const url = `${getBaseUrl()}${API_ENDPOINTS.LOWVRAM_TOGGLE}?${params}`;
      const response = await fetch(url, { method: 'POST' });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const result = await response.json();
      return result as LowVramToggleResponse;
    } catch (error) {
      throw new Error(`Error toggling Low VRAM: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const statusService = new StatusService();