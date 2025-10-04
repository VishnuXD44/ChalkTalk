import AudioContextManager from './AudioContextManager'

export class ElevenLabsService {
  private apiKey: string
  private baseUrl = 'https://api.elevenlabs.io/v1'
  private audioManager: AudioContextManager

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || ''
    this.audioManager = AudioContextManager.getInstance()
    
    if (!this.apiKey) {
      console.warn('ElevenLabs API key not found. Voice synthesis will be disabled.')
    }
  }

  async synthesizeSpeech(text: string, npcId: string): Promise<void> {
    if (!this.apiKey) {
      console.log('Voice synthesis disabled - no API key provided')
      return
    }

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
        throw new Error(`ElevenLabs API error: ${response.status}`)
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      
      // Use the AudioContext manager for proper audio handling
      await this.audioManager.playAudio(audioUrl)
      
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

  // Cleanup method to properly close AudioContext
  cleanup(): void {
    this.audioManager.close()
  }
}
