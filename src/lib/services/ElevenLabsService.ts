import AudioContextManager from './AudioContextManager'

export class ElevenLabsService {
  private apiKey: string
  private baseUrl = 'https://api.elevenlabs.io/v1'
  private audioManager: AudioContextManager
  private lastRequestTime: number = 0
  private requestQueue: Array<() => Promise<void>> = []
  private isProcessingQueue: boolean = false
  private minRequestInterval: number = 1000 // Minimum 1 second between requests
  private isDisabled: boolean = false // Track if service is disabled due to auth errors

  constructor() {
    // Try both environment variable names for compatibility
    this.apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || ''
    this.audioManager = AudioContextManager.getInstance()
    
    console.log('🎤 ElevenLabs Service initialized')
    console.log('🎤 API Key status:', this.getApiKeyStatus())
    
    if (!this.apiKey) {
      console.warn('❌ ElevenLabs API key not found. Voice synthesis will be disabled.')
      console.info('💡 To enable voice synthesis, add your ElevenLabs API key to .env.local as:')
      console.info('   NEXT_PUBLIC_ELEVENLABS_API_KEY=your_api_key_here')
      console.info('   or')
      console.info('   ELEVENLABS_API_KEY=your_api_key_here')
    } else if (this.apiKey.length < 20) {
      console.warn('⚠️ ElevenLabs API key appears to be invalid (too short). Voice synthesis may not work.')
    } else {
      console.log('✅ ElevenLabs API key found and appears valid')
    }
  }

  async synthesizeSpeech(text: string, npcId: string, isUserConversation: boolean = false, distance: number = 0): Promise<void> {
    if (!this.apiKey || this.isDisabled) {
      console.log('Voice synthesis disabled - no API key provided or service disabled due to auth errors')
      return
    }

    // Queue the request to handle rate limiting
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          await this.processSpeechRequest(text, npcId, isUserConversation, distance)
          resolve()
        } catch (error) {
          reject(error)
        }
      })
      
      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()
      if (request) {
        try {
          await request()
        } catch (error) {
          console.error('Error processing speech request:', error)
        }
        
        // Wait minimum interval between requests
        const timeSinceLastRequest = Date.now() - this.lastRequestTime
        if (timeSinceLastRequest < this.minRequestInterval) {
          await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest))
        }
      }
    }

    this.isProcessingQueue = false
  }

  private async processSpeechRequest(text: string, npcId: string, isUserConversation: boolean, distance: number): Promise<void> {
    try {
      // Get a voice ID based on the NPC (for consistency)
      const voiceId = this.getVoiceForNPC(npcId)
      
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      })

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('ElevenLabs API authentication failed. Please check your API key. Voice synthesis disabled.')
          this.isDisabled = true
          return
        }
        if (response.status === 429) {
          console.warn('ElevenLabs API rate limit exceeded. Skipping voice synthesis.')
          return
        }
        console.warn(`ElevenLabs API error: ${response.status}. Skipping voice synthesis.`)
        return
      }

      this.lastRequestTime = Date.now()
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      
      // Use the AudioContext manager for proper audio handling with conversation type and distance
      await this.audioManager.playAudio(audioUrl, isUserConversation, distance)
      
      // Clean up the URL after a delay (to allow audio to start playing)
      setTimeout(() => {
        URL.revokeObjectURL(audioUrl)
      }, 1000)

    } catch (error) {
      console.error('Error synthesizing speech:', error)
      // Don't throw error - just log it so the game continues
    }
  }

  private getVoiceForNPC(npcId: string): string {
    // Map NPC IDs to consistent voice IDs
    // Using some default ElevenLabs voice IDs for demo purposes
    const voiceMap: { [key: string]: string } = {
      'rachel': '21m00Tcm4TlvDq8ikWAM', // Rachel - American female
      'domi': 'AZnzlk1XvdvUeBnXmlld',   // Domi - American female
      'bella': 'EXAVITQu4vr4xnSDxMaL',  // Bella - American female
      'antoni': 'ErXwobaYiN019PkySvjV', // Antoni - American male
      'elli': 'MF3mGyEYCl7XYWbV9V6O',   // Elli - American female
      'josh': 'TxGEqnHWrfWFTfGW9XjX',   // Josh - American male
      'arnold': 'VR6AewLTigWG4xSOukaG', // Arnold - American male
      'adam': 'pNInz6obpgDQGcFmaJgB',   // Adam - American male
      'sam': 'yoZ06aMxZJJ28mfd3POQ'     // Sam - American male
    }

    // Generate a consistent voice based on NPC ID
    const voices = Object.values(voiceMap)
    const hash = npcId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    
    return voices[Math.abs(hash) % voices.length]
  }

  async getAvailableVoices(): Promise<any[]> {
    if (!this.apiKey) {
      return []
    }

    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status}`)
      }

      const data = await response.json()
      return data.voices || []
    } catch (error) {
      console.error('Error fetching voices:', error)
      return []
    }
  }

  // Method to test the API connection
  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false
    }

    try {
      const voices = await this.getAvailableVoices()
      return voices.length > 0
    } catch (error) {
      console.error('ElevenLabs connection test failed:', error)
      return false
    }
  }

  // Method to check if service is disabled
  isServiceDisabled(): boolean {
    return this.isDisabled
  }

  // Method to re-enable service (useful if API key is updated)
  reEnableService(): void {
    this.isDisabled = false
    console.log('ElevenLabs service re-enabled')
  }

  // Method to get API key status for debugging
  getApiKeyStatus(): string {
    if (!this.apiKey) {
      return 'No API key provided'
    }
    if (this.apiKey.length < 20) {
      return 'API key appears invalid (too short)'
    }
    return 'API key appears valid'
  }

  // Cleanup method to properly close AudioContext
  cleanup(): void {
    this.audioManager.close()
  }
}
