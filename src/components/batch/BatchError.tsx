/**
 * Batch Error Component
 * 
 * Displays error information for batch audio generation.
 */

import React from 'react';
import { Icon } from '~/design-system';

interface BatchErrorProps {
  error: string;
}

export function BatchError({ error }: BatchErrorProps) {
  return (
    <div className="mb-4 p-3 bg-accent-danger/20 text-accent-danger rounded-lg border border-accent-danger/30">
      <div className="flex items-center">
        <Icon name="warning" className="mr-2" />
        <p className="font-medium">Generation Error</p>
      </div>
      <p className="text-sm mt-1">{error}</p>
    </div>
  );
}