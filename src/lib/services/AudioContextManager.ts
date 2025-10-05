class AudioContextManager {
  private static instance: AudioContextManager
  private audioContext: AudioContext | null = null
  private isInitialized = false
  private currentAudio: HTMLAudioElement | null = null
  private backgroundVolume = 1.0
  private isUserInConversation = false
  private maxDistance = 200 // Maximum distance for audio to be audible
  private minDistance = 50 // Minimum distance for full volume

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

  async playAudio(audioUrl: string, isUserConversation: boolean = false, distance: number = 0): Promise<void> {
    try {
      // Ensure AudioContext is initialized
      await this.initialize()

      const audio = new Audio(audioUrl)
      
      // Set up audio element
      audio.crossOrigin = 'anonymous'
      
      // Store current audio for volume control
      this.currentAudio = audio
      
      // Calculate volume based on distance and conversation state
      let volume = this.calculateVolume(distance, isUserConversation)
      audio.volume = volume
      
      // Set user conversation state
      if (isUserConversation) {
        this.setUserInConversation(true)
      }
      
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

  calculateVolume(distance: number, isUserConversation: boolean): number {
    if (isUserConversation) {
      // User conversation - always full volume
      return 1.0
    }
    
    // Background NPC conversation - distance-based volume
    if (distance > this.maxDistance) {
      return 0 // Too far away - no volume
    }
    
    if (distance <= this.minDistance) {
      // Close enough for full volume (but reduced if user is talking)
      return this.isUserInConversation ? 0.3 : 1.0
    }
    
    // Calculate volume based on distance (linear interpolation)
    const volumeRange = this.maxDistance - this.minDistance
    const distanceInRange = distance - this.minDistance
    const distanceRatio = distanceInRange / volumeRange
    const baseVolume = 1.0 - (distanceRatio * 0.8) // Reduce from 1.0 to 0.2
    
    // Apply user conversation reduction if applicable
    return this.isUserInConversation ? baseVolume * 0.3 : baseVolume
  }

  setUserInConversation(inConversation: boolean): void {
    this.isUserInConversation = inConversation
    
    // Adjust volume of current background audio if it exists
    if (this.currentAudio && !inConversation) {
      this.currentAudio.volume = 1.0
    }
  }

  setBackgroundVolume(volume: number): void {
    this.backgroundVolume = Math.max(0, Math.min(1, volume))
    
    // Apply to current audio if it's background audio
    if (this.currentAudio && !this.isUserInConversation) {
      this.currentAudio.volume = this.backgroundVolume
    }
  }

  getUserInConversation(): boolean {
    return this.isUserInConversation
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
    this.currentAudio = null
    this.isUserInConversation = false
  }
}

export default AudioContextManager
