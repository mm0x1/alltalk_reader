import { useCallback } from 'react'
import { useReaderStore } from '~/state/readerStore'
import { textProcessor, type ProcessedText } from '~/services/textProcessing'

export interface ProcessTextOptions {
  /** Enable smart paragraph detection (BETA) */
  enableSmartDetection?: boolean
}

/**
 * Hook for managing text input and processing
 * Now backed by Zustand store (Phase 3)
 */
export function useTextProcessor() {
  const text = useReaderStore((state) => state.textState.text)
  const paragraphs = useReaderStore((state) => state.textState.paragraphs)
  const isProcessing = useReaderStore((state) => state.textState.isProcessing)
  const wasAo3Parsed = useReaderStore((state) => state.textState.wasAo3Parsed)
  const ao3Metadata = useReaderStore((state) => state.textState.ao3Metadata)

  const updateText = useReaderStore((state) => state.updateText)
  const updateParagraphs = useReaderStore((state) => state.updateParagraphs)
  const setProcessing = useReaderStore((state) => state.setProcessing)
  const setAo3Parsed = useReaderStore((state) => state.setAo3Parsed)
  const loadTextFromSession = useReaderStore((state) => state.loadTextFromSession)
  const resetTextState = useReaderStore((state) => state.resetTextState)

  const handleTextChange = (newText: string) => {
    updateText(newText)
  }

  const processText = useCallback(
    (options: ProcessTextOptions = {}): string[] => {
      const { enableSmartDetection = false } = options

      if (!text.trim()) {
        throw new Error('No text to process')
      }

      setProcessing(true)

      try {
        // Process input (auto-detects and parses AO3)
        const processResult: ProcessedText = textProcessor.processInput(text)

        if (processResult.wasAo3Parsed) {
          console.log('AO3 page detected and parsed')
          if (processResult.ao3Result?.metadata?.chapterTitle) {
            console.log(`Chapter: ${processResult.ao3Result.metadata.chapterTitle}`)
          }
          setAo3Parsed(true, processResult.ao3Result?.metadata ?? null)
        } else {
          setAo3Parsed(false, null)
        }

        // Split into paragraphs (with optional smart detection)
        const newParagraphs = textProcessor.splitIntoParagraphs(processResult.text, {
          enableSmartDetection,
        })
        updateParagraphs(newParagraphs)
        setProcessing(false)

        console.log(`Text processed into ${newParagraphs.length} paragraphs`)
        return newParagraphs
      } catch (error) {
        console.error('Error processing text:', error)
        setProcessing(false)
        throw new Error('Failed to process text. Please try again.')
      }
    },
    [text, setProcessing, setAo3Parsed, updateParagraphs]
  )

  const loadFromSession = (sessionText: string, sessionParagraphs: string[]) => {
    loadTextFromSession(sessionText, sessionParagraphs)
  }

  const reset = () => {
    resetTextState()
  }

  return {
    text,
    paragraphs,
    isProcessing,
    handleTextChange,
    processText,
    loadFromSession,
    reset,
    // AO3 parsing info
    wasAo3Parsed,
    ao3Metadata,
  }
}
