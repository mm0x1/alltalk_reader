import { useState, useCallback } from 'react';
import { textProcessor, type ProcessedText } from '~/services/textProcessing';

export function useTextProcessor() {
  const [text, setText] = useState('');
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessResult, setLastProcessResult] = useState<ProcessedText | null>(null);

  const handleTextChange = (newText: string) => {
    setText(newText);
  };

  const processText = useCallback((): string[] => {
    if (!text.trim()) {
      throw new Error('No text to process');
    }

    setIsProcessing(true);

    try {
      // Process input (auto-detects and parses AO3)
      const processResult = textProcessor.processInput(text);
      setLastProcessResult(processResult);

      if (processResult.wasAo3Parsed) {
        console.log('AO3 page detected and parsed');
        if (processResult.ao3Result?.metadata?.chapterTitle) {
          console.log(`Chapter: ${processResult.ao3Result.metadata.chapterTitle}`);
        }
      }

      // Split into paragraphs
      const newParagraphs = textProcessor.splitIntoParagraphs(processResult.text);
      setParagraphs(newParagraphs);
      setIsProcessing(false);

      console.log(`Text processed into ${newParagraphs.length} paragraphs`);
      return newParagraphs;
    } catch (error) {
      console.error('Error processing text:', error);
      setIsProcessing(false);
      throw new Error('Failed to process text. Please try again.');
    }
  }, [text]);

  const loadFromSession = (sessionText: string, sessionParagraphs: string[]) => {
    setText(sessionText);
    setParagraphs(sessionParagraphs);
  };

  const reset = () => {
    setText('');
    setParagraphs([]);
    setIsProcessing(false);
    setLastProcessResult(null);
  };

  return {
    text,
    paragraphs,
    isProcessing,
    handleTextChange,
    processText,
    loadFromSession,
    reset,
    // AO3 parsing info
    wasAo3Parsed: lastProcessResult?.wasAo3Parsed ?? false,
    ao3Metadata: lastProcessResult?.ao3Result?.metadata,
  };
}
