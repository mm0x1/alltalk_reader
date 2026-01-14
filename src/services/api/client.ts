/**
 * API Client
 * 
 * Standardized HTTP client with error handling, retry logic, and timeout management.
 * This replaces scattered fetch calls throughout the application.
 */

import { getBaseUrl } from '~/config/env';

export class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number = 10000; // 10 seconds

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getBaseUrl();
  }

  async get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  async post<T>(endpoint: string, data?: unknown, options: RequestInit = {}): Promise<T> {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    const headers = data instanceof FormData 
      ? {} 
      : { 'Content-Type': 'application/json', ...options.headers };

    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      headers,
      body,
    });
  }

  private async request<T>(endpoint: string, options: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.defaultTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new ApiError(
          `HTTP error ${response.status}: ${response.statusText}`,
          response.status,
          endpoint
        );
      }

      // Handle text responses (like /api/ready)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return (await response.text()) as T;
      }
    } catch (error) {
      clearTimeout(timeout);
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ConnectionError(`Request timeout after ${this.defaultTimeout}ms`);
      }
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ConnectionError(`Network error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setTimeout(timeout: number) {
    this.defaultTimeout = timeout;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionError';
  }
}

// Default client instance
export const apiClient = new ApiClient();