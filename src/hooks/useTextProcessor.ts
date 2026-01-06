import { useState } from 'react'
import { ttsService } from '~/services/api'

export function useTextProcessor() {
  const [text, setText] = useState('')
  const [paragraphs, setParagraphs] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const handleTextChange = (newText: string) => {
    setText(newText)
  }

  const processText = (): string[] => {
    if (!text.trim()) {
      throw new Error('No text to process')
    }

    setIsProcessing(true)

    try {
      const newParagraphs = ttsService.splitIntoParagraphs(text)
      setParagraphs(newParagraphs)
      setIsProcessing(false)
      
      console.log(`Text processed into ${newParagraphs.length} paragraphs`)
      return newParagraphs
    } catch (error) {
      console.error('Error processing text:', error)
      setIsProcessing(false)
      throw new Error('Failed to process text. Please try again.')
    }
  }

  const loadFromSession = (sessionText: string, sessionParagraphs: string[]) => {
    setText(sessionText)
    setParagraphs(sessionParagraphs)
  }

  const reset = () => {
    setText('')
    setParagraphs([])
    setIsProcessing(false)
  }

  return {
    text,
    paragraphs,
    isProcessing,
    handleTextChange,
    processText,
    loadFromSession,
    reset
  }
}