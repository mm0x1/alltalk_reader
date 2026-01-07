/**
 * API State Context
 * 
 * Centralized API state management using React context.
 * This replaces the global SERVER_STATUS variable from alltalkApi.ts.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { statusService, voiceService, type ServerStatus } from '~/services/api';

interface ApiState {
  isConnected: boolean;
  serverStatus: ServerStatus;
  availableVoices: string[];
  availableRvcVoices: string[];
  error: string | null;
  isInitializing: boolean;
}

interface ApiStateContextType {
  state: ApiState;
  actions: {
    checkConnection: () => Promise<boolean>;
    initializeApi: () => Promise<boolean>;
    reloadConfig: () => Promise<boolean>;
    clearError: () => void;
  };
}

const ApiStateContext = createContext<ApiStateContextType | undefined>(undefined);

const initialState: ApiState = {
  isConnected: false,
  serverStatus: {
    ready: false,
    error: null,
    currentSettings: null,
    availableVoices: [],
    availableRvcVoices: [],
  },
  availableVoices: [],
  availableRvcVoices: [],
  error: null,
  isInitializing: false,
};

interface ApiStateProviderProps {
  children: ReactNode;
}

export function ApiStateProvider({ children }: ApiStateProviderProps) {
  const [state, setState] = useState<ApiState>(initialState);

  const checkConnection = async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, error: null }));
      const isReady = await statusService.checkReady();
      
      setState(prev => ({
        ...prev,
        isConnected: isReady,
        serverStatus: { ...prev.serverStatus, ready: isReady, error: null }
      }));
      
      return isReady;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState(prev => ({
        ...prev,
        isConnected: false,
        serverStatus: { ...prev.serverStatus, ready: false, error: errorMessage },
        error: errorMessage
      }));
      return false;
    }
  };

  const initializeApi = async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isInitializing: true, error: null }));
    
    try {
      // First check if server is ready
      const isReady = await checkConnection();
      if (!isReady) {
        setState(prev => ({ ...prev, isInitializing: false }));
        return false;
      }

      // Get current settings, voices, and RVC voices in parallel
      const [currentSettings, voices, rvcVoices] = await Promise.all([
        statusService.getCurrentSettings().catch(() => null),
        voiceService.getAvailableVoices().catch(() => []),
        voiceService.getAvailableRvcVoices().catch(() => []),
      ]);

      setState(prev => ({
        ...prev,
        isInitializing: false,
        serverStatus: {
          ready: true,
          error: null,
          currentSettings,
          availableVoices: voices,
          availableRvcVoices: rvcVoices,
        },
        availableVoices: voices,
        availableRvcVoices: rvcVoices,
      }));

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState(prev => ({
        ...prev,
        isInitializing: false,
        error: errorMessage,
        serverStatus: { ...prev.serverStatus, error: errorMessage }
      }));
      return false;
    }
  };

  const reloadConfig = async (): Promise<boolean> => {
    try {
      await statusService.reloadConfig();
      // After reloading config, re-initialize
      return await initializeApi();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState(prev => ({
        ...prev,
        error: errorMessage,
        serverStatus: { ...prev.serverStatus, error: errorMessage }
      }));
      return false;
    }
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  // Initialize on mount
  useEffect(() => {
    initializeApi().catch(error => {
      console.error('Failed to initialize API:', error);
    });
  }, []);

  const actions = React.useMemo(() => ({
    checkConnection,
    initializeApi,
    reloadConfig,
    clearError,
  }), []);

  const contextValue: ApiStateContextType = React.useMemo(() => ({
    state,
    actions,
  }), [state, actions]);

  return (
    <ApiStateContext.Provider value={contextValue}>
      {children}
    </ApiStateContext.Provider>
  );
}

export function useApiState(): ApiStateContextType {
  const context = useContext(ApiStateContext);
  if (context === undefined) {
    throw new Error('useApiState must be used within an ApiStateProvider');
  }
  return context;
}