class AudioContextManager {
  private static instance: AudioContextManager
  private audioContext: AudioContext | null = null
  private isInitialized = false

  private constructor() {}

  static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager()
    }
    return AudioContextManager.instance
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Create AudioContext only in browser environment
      if (typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass()
          
          // Resume AudioContext if it's suspended (required by some browsers)
          if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume()
          }
          
          this.isInitialized = true
        }
      }
    } catch (error) {
      console.warn('Failed to initialize AudioContext:', error)
    }
  }

  async playAudio(audioUrl: string): Promise<void> {
    try {
      // Ensure AudioContext is initialized
      await this.initialize()

      const audio = new Audio(audioUrl)
      
      // Set up audio element
      audio.crossOrigin = 'anonymous'
      
      // Play with proper error handling
      const playPromise = audio.play()
      
      if (playPromise !== undefined) {
        await playPromise
      }
      
    } catch (error) {
      console.warn('Audio playback failed:', error)
    }
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext
  }

  isReady(): boolean {
    return this.isInitialized && this.audioContext !== null
  }

  async suspend(): Promise<void> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.suspend()
      } catch (error) {
        console.warn('Failed to suspend AudioContext:', error)
      }
    }
  }

  async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume()
      } catch (error) {
        console.warn('Failed to resume AudioContext:', error)
      }
    }
  }

  close(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close()
      } catch (error) {
        console.warn('Failed to close AudioContext:', error)
      }
    }
    this.audioContext = null
    this.isInitialized = false
  }
}

export default AudioContextManager
