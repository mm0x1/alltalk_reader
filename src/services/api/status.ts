/**
 * Status Service
 *
 * Handles server status checking and current settings retrieval.
 * Extracted from alltalkApi.ts for better separation of concerns.
 */

import { apiClient, ConnectionError } from './client';
import { API_CONFIG } from '~/config/env';
import { API_ENDPOINTS } from '~/design-system/constants';
import type { AllTalkSettings } from '~/types/api';

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
}

export const statusService = new StatusService();