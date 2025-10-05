'use client'

import { useEffect, useRef, useState } from 'react'
import { createGameScene } from '../lib/game/GameScene'
import { GeminiService } from '../lib/services/GeminiService'

export default function Home() {
  const gameRef = useRef<HTMLDivElement>(null)
  const phaserGameRef = useRef<any>(null)
  const [isClient, setIsClient] = useState(false)
  const [npcDescription, setNpcDescription] = useState('')
  const [isSpawning, setIsSpawning] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [currentNPC, setCurrentNPC] = useState<any>(null)
  const [npcResponse, setNpcResponse] = useState('')

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !gameRef.current || phaserGameRef.current) return

    // Dynamically import Phaser only on client side
    import('phaser').then((Phaser) => {
      if (gameRef.current && !phaserGameRef.current) {
        const GameScene = createGameScene(Phaser)
        
        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO,
          width: window.innerWidth,
          height: window.innerHeight,
          parent: gameRef.current,
          backgroundColor: '#2c3e50',
          scene: GameScene,
          scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH
          }
        }

        phaserGameRef.current = new Phaser.Game(config)
        
        // Handle window resize
        const handleResize = () => {
          if (phaserGameRef.current) {
            phaserGameRef.current.scale.resize(window.innerWidth, window.innerHeight)
          }
        }
        
        window.addEventListener('resize', handleResize)
        
        // Set up the NPC interaction callback with proper timing
        const setupCallback = () => {
          const gameScene = phaserGameRef.current?.scene.getScene('GameScene')
          if (gameScene && gameScene.setNPCInteractionCallback) {
            console.log('Setting NPC interaction callback...')
            gameScene.setNPCInteractionCallback((data: any) => {
              console.log('Received callback from game scene:', data)
              if (data.action === 'closeChat') {
                setCurrentNPC(null)
                setNpcResponse('')
                setChatMessage('')
              } else if (data.action === 'sendMessage') {
                // Handle message sending
                console.log('Handling sendMessage action with data:', data)
                handleGameChatMessage(data.message, data)
              } else {
                // Regular NPC interaction
                setCurrentNPC(data)
                setNpcResponse('') // Clear previous response
              }
            })
            console.log('NPC interaction callback set successfully')
            return true
          }
          return false
        }
        
        // Try to set callback immediately, but don't worry if it fails
        if (!setupCallback()) {
          console.log('Scene not ready for callback setup - this is OK since we use direct Gemini calls')
          // The game will work fine without the callback since we're using direct API calls
          
          // Try to listen for scene-ready event as backup
          const gameScene = phaserGameRef.current?.scene.getScene('GameScene')
          if (gameScene) {
            gameScene.events.once('scene-ready', () => {
              console.log('Scene ready event received, setting callback...')
              setupCallback()
            })
          }
        }
      }
    }).catch((error) => {
      console.error('Failed to load Phaser:', error)
    })

    return () => {
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true)
        phaserGameRef.current = null
      }
      // Clean up resize listener
      window.removeEventListener('resize', handleResize)
    }
  }, [isClient])

  const spawnNPC = () => {
    if (!npcDescription.trim() || isSpawning) return

    setIsSpawning(true)
    try {
      // Create a simple personality object without API call
      const personality = {
        name: generateNPCName(npcDescription),
        description: `A ${npcDescription} with a unique personality`,
        traits: generateRandomTraits(),
        initialDialogue: [`Hello! I'm a ${npcDescription}. How can I help you?`]
      }
      
      // Create NPC in the game
      const npcId = `custom_npc_${Date.now()}`
      const gameScene = phaserGameRef.current?.scene.getScene('GameScene')
      
      if (gameScene) {
        const npc = gameScene.createCustomNPC(npcId, npcDescription, personality)
        setNpcDescription('') // Clear input after spawning
        
        // Remove focus from input field to exit text input mode
        const activeElement = document.activeElement as HTMLElement
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          activeElement.blur()
        }
      }
    } catch (error) {
      console.error('Error spawning NPC:', error)
      alert('Failed to spawn NPC. Please try again.')
    } finally {
      setIsSpawning(false)
    }
  }

  const generateNPCName = (description: string): string => {
    const words = description.split(' ')
    if (words.length >= 2) {
      return words[0].charAt(0).toUpperCase() + words[0].slice(1)
    }
    return 'NPC'
  }

  const generateRandomTraits = (): string[] => {
    const allTraits = [
      'friendly', 'curious', 'helpful', 'mysterious', 'wise', 'cheerful',
      'serious', 'playful', 'brave', 'cautious', 'creative', 'logical',
      'energetic', 'calm', 'adventurous', 'traditional', 'innovative', 'loyal'
    ]
    
    const numTraits = Math.floor(Math.random() * 3) + 2 // 2-4 traits
    const shuffled = allTraits.sort(() => 0.5 - Math.random())
    return shuffled.slice(0, numTraits)
  }

  const sendMessage = async () => {
    if (!chatMessage.trim() || !currentNPC || isTyping) return

    await handleGameChatMessage(chatMessage, currentNPC)
    setChatMessage('')
  }

  const handleAIConversation = async (npcData: any) => {
    console.log('Generating AI conversation for:', npcData.name)
    
    try {
      const geminiService = new GeminiService()
      
      const response = await geminiService.generateDialogue(
        npcData.prompt,
        [],
        ''
      )
      
      // Update the game scene with the AI conversation
      const gameScene = phaserGameRef.current?.scene.getScene('GameScene')
      if (gameScene && gameScene.showAIConversation) {
        gameScene.showAIConversation(npcData, response, npcData.isPlayerConversation, npcData.npc2Data)
      }
    } catch (error) {
      console.error('Error generating AI conversation:', error)
      // If AI fails, just end the conversation gracefully without showing hardcoded text
      const gameScene = phaserGameRef.current?.scene.getScene('GameScene')
      if (gameScene) {
        if (npcData.isPlayerConversation) {
          gameScene.endPlayerConversation()
        } else {
          gameScene.endConversation(npcData.id, npcData.npc2Data?.id || '')
        }
      }
    }
  }

  const handleGameChatMessage = async (message: string, npcData: any) => {
    console.log('handleGameChatMessage called with:', { message, npcData })
    
    // Handle different types of interactions
    if (npcData.action === 'generateConversation') {
      await handleAIConversation(npcData)
      return
    }
    
    if (!message.trim() || isTyping) return

    console.log('Starting Gemini API call...')
    setIsTyping(true)
    try {
      const gameScene = phaserGameRef.current?.scene.getScene('GameScene')
      if (!gameScene) return

      // Add player message to conversation history
      if (npcData.conversationState) {
        npcData.conversationState.conversationHistory.push(`Player: "${message}"`)
      }

      // Generate AI response based on conversation history
      const history = npcData.conversationState?.conversationHistory.slice(-4).join('\n') || ''
      
      const prompt = `Generate a natural response for ${npcData.name} in this conversation with the player. 

${npcData.name} is a ${npcData.description} with personality: ${npcData.personality}

Conversation so far:
${history}

Player just said: "${message}"

Generate a single, natural response that fits ${npcData.name}'s personality and continues the conversation naturally. Keep it conversational and 1-2 sentences maximum. Just return the response text, nothing else.`

      const geminiService = new GeminiService()
      const response = await geminiService.generateDialogue(prompt, [], '')
      
      // Add AI response to conversation history
      if (npcData.conversationState) {
        npcData.conversationState.conversationHistory.push(`${npcData.name}: "${response.trim()}"`)
        npcData.conversationState.messageCount++
      }
      
      // Update the game scene with the AI response
      if (gameScene.showPlayerConversationMessage) {
        gameScene.showPlayerConversationMessage(npcData, response.trim())
      }
      
      // Voice synthesis is handled by GameScene.showPlayerConversationMessage
      // No need to duplicate the call here
      
      // Update UI
      setNpcResponse(response)
      
      // Check if conversation should end
      if (npcData.conversationState && npcData.conversationState.messageCount >= npcData.conversationState.maxMessages) {
        setTimeout(() => {
          if (gameScene.endPlayerConversation) {
            gameScene.endPlayerConversation()
          }
        }, 3000)
      }
      
    } catch (error) {
      console.error('Error getting NPC response:', error)
      const errorResponse = 'Sorry, I can\'t respond right now.'
      
      // Show error in game
      const gameScene = phaserGameRef.current?.scene.getScene('GameScene')
      if (gameScene && gameScene.showPlayerConversationMessage) {
        gameScene.showPlayerConversationMessage(npcData, errorResponse)
      }
      
      setNpcResponse(errorResponse)
    } finally {
      setIsTyping(false)
    }
  }

  if (!isClient) {
    return (
      <div id="game-container">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          color: 'white',
          fontSize: '18px'
        }}>
          Loading game...
        </div>
      </div>
    )
  }

  return (
    <div id="game-container">
      <div ref={gameRef} id="phaser-game" tabIndex={-1} />
      
      <div className="ui-overlay">
        <div className="character-input">
          <h3>Virtual NPC Generator</h3>
          <p>Use WASD or Arrow Keys to move the white square around.</p>
          <p>Get close to colored squares to see interaction prompts.</p>
          <p>Press F to talk to nearby NPCs.</p>
          {currentNPC && (
            <div style={{ 
              background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)', 
              color: 'white', 
              padding: '8px', 
              borderRadius: '4px', 
              marginTop: '10px',
              fontSize: '12px',
              textAlign: 'center'
            }}>
              💬 Chatting with {currentNPC.name}
            </div>
          )}
          
          <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ddd' }}>
            <h4>Create Custom NPC</h4>
            <input
              type="text"
              placeholder="Describe your NPC (e.g., 'friendly wizard', 'grumpy bartender')"
              value={npcDescription}
              onChange={(e) => setNpcDescription(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && spawnNPC()}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              tabIndex={1}
              style={{ width: '100%', padding: '8px', marginBottom: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <button 
              onClick={spawnNPC} 
              disabled={isSpawning || !npcDescription.trim()}
              style={{ 
                background: isSpawning ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: isSpawning ? 'not-allowed' : 'pointer',
                fontSize: '12px'
              }}
            >
              {isSpawning ? 'Creating...' : 'Spawn NPC'}
            </button>
          </div>

          {currentNPC && (
            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ddd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4>Chat with {currentNPC.name}</h4>
                <button 
                  onClick={() => {
                    setCurrentNPC(null)
                    setNpcResponse('')
                    setChatMessage('')
                  }}
                  style={{ 
                    background: '#ff6b6b',
                    color: 'white',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                <div><strong>Description:</strong> {currentNPC.description}</div>
                {currentNPC.personality && (
                  <div><strong>Personality:</strong> {currentNPC.personality}</div>
                )}
                {currentNPC.traits && currentNPC.traits.length > 0 && (
                  <div><strong>Traits:</strong> {currentNPC.traits.join(', ')}</div>
                )}
                {currentNPC.dialogue && currentNPC.dialogue.length > 0 && (
                  <div><strong>Conversation History:</strong> {currentNPC.dialogue.length} messages</div>
                )}
              </div>
              <div style={{ 
                background: '#f5f5f5', 
                padding: '10px', 
                borderRadius: '4px', 
                marginBottom: '8px',
                minHeight: '60px',
                fontSize: '12px'
              }}>
                {npcResponse && (
                  <div style={{ marginBottom: '8px' }}>
                    <strong>{currentNPC.name}:</strong> {npcResponse}
                  </div>
                )}
                {isTyping && (
                  <div style={{ color: '#666' }}>NPC is typing...</div>
                )}
              </div>
              <input
                type="text"
                placeholder="Type your message..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
                tabIndex={2}
                disabled={isTyping}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  marginBottom: '8px', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px',
                  opacity: isTyping ? 0.6 : 1
                }}
              />
              <button 
                onClick={sendMessage}
                disabled={isTyping || !chatMessage.trim()}
                style={{ 
                  background: isTyping ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: isTyping ? 'not-allowed' : 'pointer',
                  fontSize: '12px'
                }}
              >
                {isTyping ? 'Sending...' : 'Send'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
