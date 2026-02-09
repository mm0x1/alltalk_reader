/**
 * Session Export
 *
 * Functions for exporting sessions to downloadable files.
 */

import type { AudioSession } from './types';
import { blobToBase64 } from './utils';
import { getBaseUrl } from '~/config/env';

/**
 * Prepare a session for export by downloading audio and converting to base64
 */
export async function prepareSessionForExport(
  session: AudioSession,
  onProgress?: (progress: number) => void
): Promise<AudioSession> {
  const exportSession: AudioSession = JSON.parse(JSON.stringify(session));

  exportSession.audioBlobData = {};
  exportSession.isOfflineSession = true;

  for (let i = 0; i < session.audioUrls.length; i++) {
    try {
      if (onProgress) {
        onProgress((i / session.audioUrls.length) * 100);
      }

      const url = session.audioUrls[i];
      if (!url) {
        exportSession.audioBlobData[`audio_${i}`] = null;
        continue;
      }

      // Resolve relative path to full URL for fetching
      const response = await fetch(`${getBaseUrl()}${url}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio file: ${response.status}`);
      }

      const blob = await response.blob();
      const base64Data = await blobToBase64(blob);
      exportSession.audioBlobData[`audio_${i}`] = base64Data;
    } catch (error) {
      console.error(`Error processing audio file at index ${i}:`, error);
      exportSession.audioBlobData[`audio_${i}`] = null;
    }
  }

  if (onProgress) {
    onProgress(100);
  }

  return exportSession;
}

/**
 * Prepare a session for export using already-cached audio data
 */
export async function prepareSessionForExportFromCache(
  session: AudioSession,
  cachedAudioBlobs: Record<string, Blob>,
  onProgress?: (progress: number) => void
): Promise<AudioSession> {
  const exportSession: AudioSession = JSON.parse(JSON.stringify(session));

  exportSession.audioBlobData = {};
  exportSession.isOfflineSession = true;

  for (let i = 0; i < session.paragraphs.length; i++) {
    try {
      if (onProgress) {
        onProgress((i / session.paragraphs.length) * 100);
      }

      const key = `audio_${i}`;
      const blob = cachedAudioBlobs[key];

      if (!blob) {
        exportSession.audioBlobData[key] = null;
        continue;
      }

      const base64Data = await blobToBase64(blob);
      exportSession.audioBlobData[key] = base64Data;
    } catch (error) {
      console.error(`Error processing cached audio at index ${i}:`, error);
      exportSession.audioBlobData[`audio_${i}`] = null;
    }
  }

  if (onProgress) {
    onProgress(100);
  }

  return exportSession;
}

/**
 * Export a session to a JSON file for download
 */
export function downloadSessionAsFile(exportSession: AudioSession): void {
  const jsonString = JSON.stringify(exportSession, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });

  const fileName = `alltalk-${exportSession.name.substring(0, 30)
    .replace(/\W+/g, '-')
    .toLowerCase()}-${new Date(exportSession.createdAt).toISOString().split('T')[0]}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;

  document.body.appendChild(a);
  a.click();

  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
