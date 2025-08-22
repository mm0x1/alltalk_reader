/**
 * Progress Component
 * 
 * Standardized progress bar with percentage display and variants.
 */

import React from 'react';
import { type ColorVariant, type Size } from '../types';
import { cn } from '../utils';

interface ProgressProps {
  value: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  variant?: ColorVariant;
  size?: Size;
  className?: string;
}

export function Progress({ 
  value, 
  label, 
  showPercentage = true, 
  variant = 'primary',
  size = 'md',
  className = ''
}: ProgressProps) {
  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };
  
  const colorClasses = {
    primary: 'bg-accent-primary',
    secondary: 'bg-dark-400',
    success: 'bg-accent-success',
    warning: 'bg-accent-warning', 
    danger: 'bg-accent-danger',
  };
  
  const clampedValue = Math.min(100, Math.max(0, value));
  
  return (
    <div className={cn('w-full', className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-sm text-gray-400">{label}</span>}
          {showPercentage && <span className="text-sm text-gray-400">{Math.round(clampedValue)}%</span>}
        </div>
      )}
      <div className={cn('w-full bg-dark-400 rounded-full', heightClasses[size])}>
        <div 
          className={cn(
            heightClasses[size], 
            colorClasses[variant], 
            'rounded-full transition-all duration-300'
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}