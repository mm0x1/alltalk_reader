import { useState } from 'react'

export function useBatchGeneration() {
  const [preGeneratedAudio, setPreGeneratedAudio] = useState<string[]>([])
  const [isPreGenerated, setIsPreGenerated] = useState(false)

  const handleBatchComplete = (audioUrls: string[]) => {
    setPreGeneratedAudio(audioUrls)
    setIsPreGenerated(true)
  }

  const resetPreGenerated = () => {
    setIsPreGenerated(false)
    setPreGeneratedAudio([])
  }

  const initializeForParagraphs = (paragraphCount: number) => {
    setPreGeneratedAudio(Array(paragraphCount).fill(''))
    setIsPreGenerated(false)
  }

  const loadFromSession = (audioUrls: string[]) => {
    setPreGeneratedAudio(audioUrls)
    setIsPreGenerated(true)
  }

  return {
    preGeneratedAudio,
    isPreGenerated,
    handleBatchComplete,
    resetPreGenerated,
    initializeForParagraphs,
    loadFromSession
  }
}