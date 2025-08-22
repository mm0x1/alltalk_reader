/**
 * Loading Component
 * 
 * Standardized loading indicator with optional text.
 */

import React from 'react';
import { Icon } from './Icon';
import { type Size } from '../types';
import { cn } from '../utils';

interface LoadingProps {
  size?: Size;
  text?: string;
  className?: string;
}

export function Loading({ size = 'md', text, className = '' }: LoadingProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };
  
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="flex flex-col items-center space-y-2">
        <Icon 
          name="spinner" 
          className={cn(sizeClasses[size], 'animate-spin text-accent-primary')}
        />
        {text && <span className="text-sm text-gray-400">{text}</span>}
      </div>
    </div>
  );
}