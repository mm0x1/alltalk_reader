/**
 * Design System Types
 * 
 * TypeScript type definitions for design system components and patterns.
 */

export type ColorVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
export type Size = 'sm' | 'md' | 'lg';
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
export type IconPosition = 'left' | 'right';

export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export type AudioStatus = typeof import('./constants').AUDIO_STATUS[keyof typeof import('./constants').AUDIO_STATUS];