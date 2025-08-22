/**
 * Environment Configuration
 * 
 * Centralized configuration management using environment variables.
 * This replaces hardcoded configuration values throughout the application.
 */

interface ApiConfig {
  protocol: string;
  host: string;
  port: string;
  connectionTimeout: number;
  maxCharacters: number;
}

export const API_CONFIG: ApiConfig = {
  protocol: import.meta.env.VITE_API_PROTOCOL || 'http://',
  host: import.meta.env.VITE_API_HOST || 'localhost',
  port: import.meta.env.VITE_API_PORT || '7851',
  connectionTimeout: Number(import.meta.env.VITE_CONNECTION_TIMEOUT) || 5,
  maxCharacters: Number(import.meta.env.VITE_MAX_CHARACTERS) || 4096,
};

export const getBaseUrl = () => `${API_CONFIG.protocol}${API_CONFIG.host}:${API_CONFIG.port}`;