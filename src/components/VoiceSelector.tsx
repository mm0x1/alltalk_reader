import React, { useState, useEffect } from 'react';
import { getVoiceOptions, getServerStatus, reloadConfig } from '~/services/alltalkApi';

interface VoiceSelectorProps {
  value: string;
  onChange: (voice: string) => void;
  label?: string;
  className?: string;
}

export default function VoiceSelector({ 
  value, 
  onChange, 
  label = "Voice", 
  className = "" 
}: VoiceSelectorProps) {
  const [voices, setVoices] = useState(getVoiceOptions());
  const [serverStatus, setServerStatus] = useState(getServerStatus());
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Effect to update voices when server status changes
  useEffect(() => {
    const checkVoices = () => {
      setVoices(getVoiceOptions());
      setServerStatus(getServerStatus());
    };
    
    // Initial check
    checkVoices();
    
    // Setup interval for periodic checks
    const interval = setInterval(checkVoices, 30000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  // Handle refreshing the voice list
  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      await reloadConfig();
      setVoices(getVoiceOptions());
      setServerStatus(getServerStatus());
    } catch (error) {
      console.error('Failed to refresh voices:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // If the current value is not in the list, use the first available voice
  const currentVoiceExists = voices.some(voice => voice.id === value);
  
  useEffect(() => {
    if (!currentVoiceExists && voices.length > 0) {
      onChange(voices[0].id);
    }
  }, [currentVoiceExists, voices, onChange]);
  
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium">
          {label}
        </label>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || !serverStatus.ready}
          className={`px-2 py-1 text-xs rounded flex items-center ${
            isRefreshing || !serverStatus.ready 
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
          title={serverStatus.ready ? "Refresh voice list" : "Server not connected"}
        >
          <svg 
            className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-2 pr-8 border border-gray-300 rounded appearance-none"
          disabled={!serverStatus.ready && voices.length === 0}
        >
          {voices.length === 0 ? (
            <option value="">No voices available</option>
          ) : (
            voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
              </option>
            ))
          )}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
      
      {!serverStatus.ready && (
        <p className="mt-1 text-xs text-red-500">
          Server disconnected. Using default voices.
        </p>
      )}
      
      <p className="mt-1 text-xs text-gray-500">
        {voices.length} {voices.length === 1 ? 'voice' : 'voices'} available
      </p>
    </div>
  );
}
