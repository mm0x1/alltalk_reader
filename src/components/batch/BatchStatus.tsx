/**
 * Batch Status Component
 * 
 * Displays status information for session saving.
 */

import React from 'react';
import { Icon, Loading } from '~/design-system';

interface BatchStatusProps {
  isSaving: boolean;
  saveError: string | null;
  sessionSaved: boolean;
}

export function BatchStatus({ isSaving, saveError, sessionSaved }: BatchStatusProps) {
  if (!isSaving && !saveError && !sessionSaved) {
    return null;
  }

  const getStatusContent = () => {
    if (isSaving) {
      return (
        <>
          <Loading size="sm" />
          <span className="ml-2">Saving session...</span>
        </>
      );
    }
    
    if (saveError) {
      return (
        <>
          <Icon name="warning" className="text-accent-danger mr-2" />
          <span className="text-accent-danger">{saveError}</span>
        </>
      );
    }
    
    if (sessionSaved) {
      return (
        <>
          <Icon name="check" className="mr-2" />
          <span>Session saved successfully</span>
        </>
      );
    }
    
    return null;
  };

  const getStatusClasses = () => {
    if (saveError) {
      return 'bg-accent-danger/10 border-accent-danger/30 text-accent-danger';
    }
    
    if (sessionSaved) {
      return 'bg-accent-success/10 border-accent-success/30 text-accent-success';
    }
    
    return 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary';
  };

  return (
    <div className={`mb-4 p-3 rounded-lg border flex items-center ${getStatusClasses()}`}>
      {getStatusContent()}
    </div>
  );
}