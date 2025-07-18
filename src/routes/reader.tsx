import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { 
  splitIntoParagraphs, 
  generateTTS,
  getVoiceOptions,
  getServerStatus,
  checkServerReady,
  initializeApi
} from '~/services/alltalkApi'
import ProgressBar from '~/components/ProgressBar'
import ParagraphList from '~/components/ParagraphList'
import PlaybackControls from '~/components/PlaybackControls'
import AudioCacheStatus from '~/components/AudioCacheStatus'
import SettingsMonitor from '~/components/SettingsMonitor'
import VoiceSelector from '~/components/VoiceSelector'
import TtsSettings from '~/components/TtsSettings'
import BatchGenerator from '~/components/BatchGenerator'

export const Route = createFileRoute('/reader')({
  component: BookReader,
})

function BookReader() {
  // State for the pasted text and split paragraphs
  const [text, setText] = useState('')
  const [paragraphs, setParagraphs] = useState<string[]>([])
  const [currentParagraph, setCurrentParagraph] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedVoice, setSelectedVoice] = useState(getVoiceOptions()[0]?.id || 'female_01.wav')
  const [isServerConnected, setIsServerConnected] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  
  // Pre-generation state
  const [showBatchGenerator, setShowBatchGenerator] = useState(false)
  const [preGeneratedAudio, setPreGeneratedAudio] = useState<(string | null)[]>([])
  const [isPreGenerated, setIsPreGenerated] = useState(false)
  
  // TTS settings
  const [speed, setSpeed] = useState(1.0)
  const [pitch, setPitch] = useState(0)
  const [language, setLanguage] = useState('en')
  
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize API when component mounts
  useEffect(() => {
    initializeApi()
      .then(success => {
        setIsServerConnected(success)
        // Update selected voice options if server is connected
        if (success) {
          const voices = getVoiceOptions()
          if (voices.length > 0) {
            setSelectedVoice(voices[0].id)
          }
        }
      })
      .catch(error => {
        console.error('Failed to initialize API:', error)
        setIsServerConnected(false)
      })
  }, [])

  // Handle text input
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
  }

  // Process the pasted text
  const handleProcessText = () => {
    if (!text.trim()) return

    setIsProcessing(true)
    
    try {
      // Split text into paragraphs with size limit handling
      const newParagraphs = splitIntoParagraphs(text)
      
      setParagraphs(newParagraphs)
      setCurrentParagraph(null)
      setIsPlaying(false)
      setIsProcessing(false)
      setIsLoadingAudio(false)
      setErrorMessage(null)
      setIsPreGenerated(false)
      setPreGeneratedAudio(Array(newParagraphs.length).fill(null))
      
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      // Log how many paragraphs were created
      console.log(`Text processed into ${newParagraphs.length} paragraphs`)
    } catch (error) {
      console.error('Error processing text:', error)
      setIsProcessing(false)
      setErrorMessage('Failed to process text. Please try again.')
    }
  }

  // Play a paragraph at the specified index
  const handlePlayParagraph = async (index: number) => {
    if (index >= paragraphs.length) {
      setIsPlaying(false)
      setCurrentParagraph(null)
      setIsLoadingAudio(false)
      setErrorMessage(null)
      return
    }

    setCurrentParagraph(index)
    setIsLoadingAudio(true)
    setErrorMessage(null)

    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    try {
      let audioUrl: string | null = null;

      // Check if we have pre-generated audio for this paragraph
      if (isPreGenerated && preGeneratedAudio[index]) {
        audioUrl = preGeneratedAudio[index];
        console.log(`Using pre-generated audio for paragraph ${index + 1}/${paragraphs.length}`);
      } else {
        // Generate TTS for the paragraph
        const paragraph = paragraphs[index];
        console.log(`Generating TTS for paragraph ${index + 1}/${paragraphs.length} (${paragraph.length} characters)`);

        const result = await generateTTS(paragraph, {
          characterVoice: selectedVoice,
          language,
          outputFileName: `paragraph_${index}_${Date.now()}`,
          speed,
          pitch,
        });

        if (!result) {
          throw new Error('Failed to generate audio');
        }

        audioUrl = result.fullAudioUrl;
      }

      // Create and play audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // Set up event handlers
      audio.oncanplaythrough = () => {
        setIsLoadingAudio(false)
        setIsPlaying(true)
        audio.play().catch(err => {
          console.error('Failed to play audio:', err)
          setIsPlaying(false)
          setErrorMessage('Failed to play audio. Please try again.')
        })
      }

      audio.onended = () => {
        // Move to next paragraph when audio ends
        handlePlayParagraph(index + 1)
      }

      audio.onerror = (e) => {
        console.error('Audio error:', e)
        setIsPlaying(false)
        setIsLoadingAudio(false)
        setErrorMessage('Error playing audio. Please try again.')
      }
    } catch (error) {
      console.error('Failed to play paragraph:', error)
      setIsPlaying(false)
      setIsLoadingAudio(false)
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred')
    }
  }

  // Handle the completion of batch generation
  const handleBatchComplete = (audioUrls: string[]) => {
    setPreGeneratedAudio(audioUrls);
    setIsPreGenerated(true);
    setShowBatchGenerator(false);
  }

  // Handle cancellation of batch generation
  const handleBatchCancel = () => {
    setShowBatchGenerator(false);
  }

  // Handle play/pause
  const togglePlayback = () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setIsPlaying(false)
    } else if (!isLoadingAudio) {
      handlePlayParagraph(currentParagraph !== null ? currentParagraph : 0)
    }
  }

  // Reset everything
  const handleReset = () => {
    setParagraphs([])
    setText('')
    setCurrentParagraph(null)
    setIsPlaying(false)
    setIsLoadingAudio(false)
    setErrorMessage(null)
    setIsPreGenerated(false)
    setPreGeneratedAudio([])
    setShowBatchGenerator(false)
    
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
  }

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-white">AllTalk Book Reader</h1>
      <p className="text-gray-400 mb-4">
        Using the standard AllTalk API to generate TTS audio paragraph by paragraph.
      </p>
      
      <SettingsMonitor onConnectionStatusChange={setIsServerConnected} />

      {paragraphs.length === 0 ? (
        <div className="space-y-4">
          <div className="card">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="text-input" className="block font-medium text-lg text-gray-200">
                  Paste your text below:
                </label>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-sm px-3 py-1 bg-dark-300 hover:bg-dark-400 rounded flex items-center transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  {showSettings ? 'Hide Settings' : 'Show Settings'}
                </button>
              </div>
              <textarea
                id="text-input"
                className="input-field h-64"
                value={text}
                onChange={handleTextChange}
                placeholder="Paste your book text here..."
              />
            </div>
            
            {showSettings && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-dark-300 p-4 rounded-lg">
                <VoiceSelector
                  value={selectedVoice}
                  onChange={setSelectedVoice}
                  label="Character Voice"
                />
                
                <TtsSettings
                  speed={speed}
                  pitch={pitch}
                  language={language}
                  onSpeedChange={setSpeed}
                  onPitchChange={setPitch}
                  onLanguageChange={setLanguage}
                />
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                {text ? `${text.length} characters in ${text.trim().split(/\s+/).length} words` : 'No text entered'}
              </div>
              <button
                className="btn-primary"
                onClick={handleProcessText}
                disabled={isProcessing || !text.trim() || !isServerConnected}
              >
                {isProcessing ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : !isServerConnected ? (
                  <span className="flex items-center">
                    <svg className="mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Server Not Connected
                  </span>
                ) : 'Process Text'}
              </button>
            </div>
            
            {!isServerConnected && (
              <div className="mt-4 p-3 bg-dark-400 text-amber-300 rounded-lg border border-amber-500">
                <div className="flex items-start">
                  <svg className="h-5 w-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-medium">AllTalk server is not connected</p>
                    <p className="text-sm mt-1">Please check your server settings. The app needs a connection to the AllTalk API server to generate TTS audio.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 justify-between bg-dark-300 p-4 rounded-lg mb-1">
            <PlaybackControls
              isPlaying={isPlaying}
              selectedVoice={selectedVoice}
              onPlayPause={togglePlayback}
              onVoiceChange={setSelectedVoice}
              onReset={handleReset}
              canSkipPrevious={currentParagraph !== null && currentParagraph > 0}
              canSkipNext={currentParagraph !== null && currentParagraph < paragraphs.length - 1}
              onSkipPrevious={() => currentParagraph !== null && currentParagraph > 0 && handlePlayParagraph(currentParagraph - 1)}
              onSkipNext={() => currentParagraph !== null && currentParagraph < paragraphs.length - 1 && handlePlayParagraph(currentParagraph + 1)}
              isLoading={isLoadingAudio}
            />
            
            <button 
              onClick={() => setShowBatchGenerator(true)}
              disabled={showBatchGenerator || isPreGenerated || !isServerConnected}
              className={`px-3 py-1.5 text-sm rounded flex items-center ${
                isPreGenerated 
                  ? 'bg-accent-success/20 text-accent-success border border-accent-success' 
                  : showBatchGenerator || !isServerConnected
                    ? 'bg-dark-200 text-gray-500 cursor-not-allowed' 
                    : 'bg-dark-400 text-accent-primary hover:bg-dark-500 border border-accent-primary'
              }`}
            >
              {isPreGenerated ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Pre-Generated
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Pre-Generate All Audio
                </>
              )}
            </button>
          </div>

          {/* Batch generator */}
          {showBatchGenerator && (
            <BatchGenerator 
              paragraphs={paragraphs}
              voice={selectedVoice}
              speed={speed}
              pitch={pitch}
              language={language}
              onComplete={handleBatchComplete}
              onCancel={handleBatchCancel}
            />
          )}
          
          {showSettings && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-dark-300 border border-dark-500 rounded-lg">
              <VoiceSelector
                value={selectedVoice}
                onChange={voice => {
                  setSelectedVoice(voice);
                  // If audio is currently playing, stop it
                  if (isPlaying && audioRef.current) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                  }
                  // Reset pre-generated state when voice changes
                  setIsPreGenerated(false);
                  setPreGeneratedAudio(Array(paragraphs.length).fill(null));
                }}
                label="Character Voice"
              />
              
              <TtsSettings
                speed={speed}
                pitch={pitch}
                language={language}
                onSpeedChange={value => {
                  setSpeed(value);
                  if (isPlaying && audioRef.current) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                  }
                  // Reset pre-generated state when settings change
                  setIsPreGenerated(false);
                  setPreGeneratedAudio(Array(paragraphs.length).fill(null));
                }}
                onPitchChange={value => {
                  setPitch(value);
                  if (isPlaying && audioRef.current) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                  }
                  // Reset pre-generated state when settings change
                  setIsPreGenerated(false);
                  setPreGeneratedAudio(Array(paragraphs.length).fill(null));
                }}
                onLanguageChange={value => {
                  setLanguage(value);
                  if (isPlaying && audioRef.current) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                  }
                  // Reset pre-generated state when settings change
                  setIsPreGenerated(false);
                  setPreGeneratedAudio(Array(paragraphs.length).fill(null));
                }}
              />
            </div>
          )}
          
          {/* Status indicator */}
          {currentParagraph !== null && (
            <AudioCacheStatus
              status={
                errorMessage 
                  ? 'error' 
                  : isLoadingAudio 
                    ? 'generating' 
                    : isPlaying 
                      ? 'playing' 
                      : 'paused'
              }
              paragraphIndex={currentParagraph}
              totalParagraphs={paragraphs.length}
              errorMessage={errorMessage || undefined}
            />
          )}
          
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-200">Book Content</h2>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-sm px-3 py-1 bg-dark-400 hover:bg-dark-500 rounded flex items-center transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                {showSettings ? 'Hide Settings' : 'Show Settings'}
              </button>
            </div>
            
            <ProgressBar 
              currentIndex={currentParagraph}
              totalParagraphs={paragraphs.length}
              onSelectParagraph={handlePlayParagraph}
            />
            
            <ParagraphList 
              paragraphs={paragraphs}
              currentParagraphIndex={currentParagraph}
              onPlayParagraph={handlePlayParagraph}
              isLoading={isLoadingAudio}
              preGeneratedStatus={isPreGenerated ? preGeneratedAudio.map(url => url !== null) : undefined}
            />
          </div>
        </div>
      )}
    </div>
  )
}
