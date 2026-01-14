/**
 * Reset Button Component
 * 
 * Button to start a new book/session.
 */

import React from 'react';
import { Button, Icon } from '~/design-system';

interface ResetButtonProps {
  isLoading: boolean;
  onReset: () => void;
}

export function ResetButton({ isLoading, onReset }: ResetButtonProps) {
  return (
    <Button
      className="new-book-button"
      onClick={onReset}
      disabled={isLoading}
      title="Start new book"
      variant="secondary"
      icon="file"
      iconPosition="left"
    >
      New Book
    </Button>
  );
}