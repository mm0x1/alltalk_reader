/**
 * Paragraph Scrolling Hook
 * 
 * Manages auto-scrolling behavior for paragraphs during audio playback.
 * Extracted from ParagraphList component for better separation of concerns.
 */

import { useRef, useEffect } from 'react';

export function useParagraphScrolling(currentIndex: number | null) {
  const paragraphRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  useEffect(() => {
    if (currentIndex !== null && paragraphRefs.current[currentIndex]) {
      paragraphRefs.current[currentIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentIndex]);
  
  return { paragraphRefs };
}