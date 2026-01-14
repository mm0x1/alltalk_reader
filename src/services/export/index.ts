/**
 * Export Services
 *
 * Unified export/import services with ZIP and legacy JSON support.
 */

// Types
export type {
  ExportFormat,
  ExportOptions,
  ExportProgress,
  ImportOptions,
  ImportProgress,
  ValidationResult,
  ZipMetadata,
  ExportResult,
  ImportResult,
} from './types';

export {
  EXPORT_VERSION,
  METADATA_FILENAME,
  AUDIO_PREFIX,
  AUDIO_EXTENSION,
} from './types';

// ZIP Export
export { exportSessionToZip, estimateZipSize } from './zipExport';

// ZIP Import
export {
  validateZipSession,
  importSessionFromZip,
  detectFileFormat,
} from './zipImport';

// Re-export legacy functions for backwards compatibility
export {
  prepareSessionForExport,
  prepareSessionForExportFromCache,
  downloadSessionAsFile,
} from '../session/export';

export { importSessionFromFile } from '../session/import';
