/**
 * Modal Component
 * 
 * Standardized modal dialog with backdrop and consistent sizing.
 */

import React from 'react';
import { Button } from './Button';
import { type Size } from '../types';
import { cn } from '../utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: Size;
  className?: string;
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  className = '' 
}: ModalProps) {
  if (!isOpen) return null;
  
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className={cn(
        'w-full max-h-[90vh] overflow-auto bg-dark-200 rounded-lg',
        sizeClasses[size],
        className
      )}>
        {title && (
          <div className="flex justify-between items-center p-4 border-b border-dark-500">
            <h2 className="text-lg font-semibold text-gray-200">{title}</h2>
            <Button variant="secondary" size="sm" icon="close" onClick={onClose} />
          </div>
        )}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}