/**
 * Button Component
 * 
 * Standardized button component with consistent variants, sizes, and behavior.
 * This replaces scattered button implementations throughout the application.
 */

import React from 'react';
import { Icon, ICONS } from './Icon';
import { type ButtonVariant, type Size, type IconPosition } from '../types';
import { cn } from '../utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: Size;
  icon?: keyof typeof ICONS;
  iconPosition?: IconPosition;
  loading?: boolean;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  icon, 
  iconPosition = 'left',
  loading = false,
  children, 
  className = '',
  disabled,
  ...props 
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2';
  
  const variantClasses = {
    primary: 'bg-accent-primary hover:bg-accent-primary/80 text-white focus:ring-accent-primary/50',
    secondary: 'bg-dark-300 hover:bg-dark-400 text-gray-200 focus:ring-dark-400/50',
    danger: 'bg-accent-danger hover:bg-accent-danger/80 text-white focus:ring-accent-danger/50',
    success: 'bg-accent-success hover:bg-accent-success/80 text-white focus:ring-accent-success/50',
    warning: 'bg-accent-warning hover:bg-accent-warning/80 text-white focus:ring-accent-warning/50',
  };
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2',
    lg: 'px-4 py-3 text-lg',
  };
  
  const isDisabled = disabled || loading;
  const disabledClasses = isDisabled ? 'opacity-50 cursor-not-allowed' : '';
  
  return (
    <button
      className={cn(
        baseClasses, 
        variantClasses[variant], 
        sizeClasses[size], 
        disabledClasses, 
        className
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading && <Icon name="spinner" className="animate-spin mr-2" />}
      {!loading && icon && iconPosition === 'left' && <Icon name={icon} className="mr-2" />}
      {children}
      {!loading && icon && iconPosition === 'right' && <Icon name={icon} className="ml-2" />}
    </button>
  );
}