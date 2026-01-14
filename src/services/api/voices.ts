/**
 * Voice Service
 * 
 * Handles voice management and voice option formatting.
 * Extracted from alltalkApi.ts for better separation of concerns.
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '~/design-system/constants';

export interface VoiceOption {
  id: string;
  name: string;
}

export class VoiceService {
  constructor(private client = apiClient) {}

  async getAvailableVoices(): Promise<string[]> {
    try {
      const data = await this.client.get<any>(API_ENDPOINTS.VOICES);
      return data.voices || [];
    } catch (error) {
      throw new Error(`Error fetching voices: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getAvailableRvcVoices(): Promise<string[]> {
    try {
      const data = await this.client.get<any>(API_ENDPOINTS.RVC_VOICES);
      return data.voices || [];
    } catch (error) {
      throw new Error(`Error fetching RVC voices: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  formatVoiceOptions(voices: string[]): VoiceOption[] {
    if (!voices || voices.length === 0) {
      return [
        { id: 'female_01.wav', name: 'Female 1' },
        { id: 'female_02.wav', name: 'Female 2' },
        { id: 'male_01.wav', name: 'Male 1' },
        { id: 'male_02.wav', name: 'Male 2' }
      ];
    }

    // Transform the voice list into a user-friendly format
    return voices.map(voice => ({
      id: voice,
      name: voice.replace('.wav', '').replace(/_/g, ' ')
    }));
  }

  async getVoiceOptions(): Promise<VoiceOption[]> {
    try {
      const voices = await this.getAvailableVoices();
      return this.formatVoiceOptions(voices);
    } catch (error) {
      // Return fallback options on error
      return this.formatVoiceOptions([]);
    }
  }
}

export const voiceService = new VoiceService();