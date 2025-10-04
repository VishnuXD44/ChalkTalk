import { GoogleGenerativeAI } from '@google/generative-ai'

export interface PersonalityData {
  name: string
  description: string
  traits: string[]
  initialDialogue: string[]
  background: string
}

export class GeminiService {
  private genAI: GoogleGenerativeAI
  private model: any

  constructor() {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('Gemini API key not found. Please set NEXT_PUBLIC_GEMINI_API_KEY in your environment variables.')
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey)
    // Use the latest working model with fallback
    try {
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    } catch (error) {
      console.log('Falling back to gemini-1.5-flash model')
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    }
  }

  async generatePersonality(characterDescription: string): Promise<PersonalityData> {
    try {
      const prompt = `
        Create a detailed personality for a game NPC based on this description: "${characterDescription}"
        
        Please provide a JSON response with the following structure:
        {
          "name": "A fitting name for this character",
          "description": "A brief description of their personality and role",
          "traits": ["trait1", "trait2", "trait3"],
          "initialDialogue": [
            "First thing they might say when encountered",
            "Alternative greeting",
            "Another possible opening line"
          ],
          "background": "A brief background story for this character"
        }
        
        Make the character interesting, memorable, and fitting for the description. 
        The dialogue should be natural and engaging.
      `

      const result = await this.model.generateContent({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
      const response = await result.response
      const text = response.text()
      
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      } else {
        // Fallback if JSON parsing fails
        return this.createFallbackPersonality(characterDescription)
      }
    } catch (error) {
      console.error('Error generating personality:', error)
      if (error instanceof Error && error.message.includes('404')) {
        console.error('Model not found. Please check if the Gemini model name is correct.')
      }
      return this.createFallbackPersonality(characterDescription)
    }
  }

  async generateDialogue(
    personality: string, 
    previousDialogue: string[], 
    context: string
  ): Promise<string> {
    try {
      console.log('GeminiService.generateDialogue called with:', { personality, previousDialogue, context })
      
      const prompt = `
        You are a game NPC with the following personality: ${personality}
        
        Current conversation context: ${context}
        
        Recent dialogue history: ${previousDialogue.slice(-3).join(', ')}
        
        Instructions:
        - Respond in character as this NPC would
        - Keep responses conversational and natural
        - Limit to 1-2 sentences maximum
        - Stay true to your personality traits
        - Be engaging and immersive for the player
        
        Generate your response:
      `

      console.log('Sending prompt to Gemini:', prompt)
      
      // Use low temperature for more deterministic responses (best practice from documentation)
      const result = await this.model.generateContent({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.1, // Low temperature for consistent responses
          maxOutputTokens: 150, // Limit response length
        }
      })
      
      const response = await result.response
      const responseText = response.text().trim()
      console.log('Received response from Gemini:', responseText)
      return responseText
    } catch (error) {
      console.error('Error generating dialogue:', error)
      if (error instanceof Error && error.message.includes('404')) {
        console.error('Model not found. Please check if the Gemini model name is correct.')
      }
      return this.getRandomFallbackDialogue()
    }
  }

  private createFallbackPersonality(characterDescription: string): PersonalityData {
    const words = characterDescription.split(' ')
    const name = words[0]?.charAt(0).toUpperCase() + words[0]?.slice(1) || 'NPC'
    
    return {
      name,
      description: `A ${characterDescription} with a unique personality`,
      traits: ['friendly', 'curious', 'helpful'],
      initialDialogue: [
        `Hello there! I'm a ${characterDescription}. How can I help you?`,
        `Greetings! Nice to meet you.`,
        `Well, well, what brings you here?`
      ],
      background: `This character is a ${characterDescription} with an interesting past.`
    }
  }

  private getRandomFallbackDialogue(): string {
    const fallbackDialogue = [
      "That's interesting! Tell me more.",
      "I see what you mean.",
      "Well, that's quite something!",
      "I hadn't thought of it that way.",
      "You make a good point.",
      "That reminds me of something...",
      "I'm not sure about that, but it's worth considering.",
      "You seem to know what you're talking about.",
      "I'd love to hear more about that.",
      "That's a perspective I hadn't considered."
    ]
    
    return fallbackDialogue[Math.floor(Math.random() * fallbackDialogue.length)]
  }
}
