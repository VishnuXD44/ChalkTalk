// Phaser will be imported dynamically in the main component
import { GeminiService } from '../services/GeminiService'

export function createGameScene(Phaser: any) {
  return class GameScene extends Phaser.Scene {
  private npcs: Map<string, Phaser.GameObjects.Rectangle> = new Map()
  private npcDialogs: Map<string, Phaser.GameObjects.Container> = new Map()
  private npcData: Map<string, any> = new Map() // Store NPC personality data
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
  private player?: Phaser.GameObjects.Rectangle
  private wasd?: any
  private proximityDistance = 60 // Reduced to be less aggressive
  private onNPCInteractionCallback?: (npc: any) => void
  private activeChatNPC?: string // Track which NPC is currently being chatted with
  private minDistance = 45 // Minimum distance between NPCs and player
  private npcCollisionRadius = 25 // NPC collision radius
  private playerCollisionRadius = 20 // Player collision radius
  private collisionPadding = 5 // Extra padding for smooth collision response
  private playerConversationState: 'idle' | 'approaching' | 'talking' | 'exiting' = 'idle'
  private playerConversationPartner?: string
  private conversationEntryTimer?: number
  private conversationExitTimer?: number
  private activeConversations: Set<string> = new Set() // Track active conversations
  private maxConversations = 2 // Maximum concurrent conversations
  private conversationHistory: Map<string, string[]> = new Map() // Track conversation topics to prevent repetition

  constructor() {
    super({ key: 'GameScene' })
  }

  preload() {
    // No need to load images for simple colored rectangles
  }

  create() {
    console.log('GameScene create() method called')
    
    // Get full screen dimensions
    const gameWidth = this.cameras.main.width
    const gameHeight = this.cameras.main.height
    
    console.log('Game dimensions:', { gameWidth, gameHeight })
    
    // Fallback to default dimensions if camera dimensions are invalid
    const safeWidth = gameWidth > 0 ? gameWidth : 1200
    const safeHeight = gameHeight > 0 ? gameHeight : 800
    
    console.log('Safe dimensions:', { safeWidth, safeHeight })
    
    // Create a simple ground/background covering the entire screen
    this.add.rectangle(safeWidth / 2, safeHeight / 2, safeWidth, safeHeight, 0x2c3e50)
    
    // Create player (white square) in a safe starting position
    const startX = Math.max(50, safeWidth * 0.1)
    const startY = Math.max(50, safeHeight * 0.1)
    this.player = this.add.rectangle(startX, startY, 30, 30, 0xffffff)
    this.player.setStrokeStyle(2, 0x000000)
    
    console.log('Player created at:', { startX, startY })
    
    // Create NPCs with different personalities
    this.createPersonalityNPCs()

    // Set up input using the centralized method
    this.setupBasicKeyboardHandlers()
    
    // Emit event that scene is ready for callback setup
    this.events.emit('scene-ready')
    console.log('GameScene is ready for callback setup')
    
    // Add click handler for NPCs
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const clickedObjects = this.input.hitTestPointer(pointer)
      clickedObjects.forEach(obj => {
        if (obj instanceof Phaser.GameObjects.Rectangle && this.npcs.has(obj.name)) {
          this.onNPCClick(obj.name)
        }
      })
    })

    // Add some initial text positioned relative to screen size
    this.add.text(safeWidth * 0.05, safeHeight * 0.05, 'Virtual NPC Generator', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial'
    })

    this.add.text(safeWidth * 0.05, safeHeight * 0.1, 'Use WASD or Arrow Keys to move. Get close to NPCs and press F to talk.', {
      fontSize: '16px',
      color: '#cccccc',
      fontFamily: 'Arial'
    })
    
    console.log('Text elements created')
  }

  update() {
    if (!this.cursors || !this.player || !this.wasd) return

    const speed = 200

    // Player movement with WASD and Arrow Keys (only if not talking)
    if (this.playerConversationState === 'idle') {
    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      this.player.x -= speed * this.game.loop.delta / 1000
    }
    if (this.cursors.right.isDown || this.wasd.D.isDown) {
      this.player.x += speed * this.game.loop.delta / 1000
    }
    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      this.player.y -= speed * this.game.loop.delta / 1000
    }
    if (this.cursors.down.isDown || this.wasd.S.isDown) {
      this.player.y += speed * this.game.loop.delta / 1000
      }
    } else {
      // Debug: Log when player movement is blocked
      if (this.cursors.left.isDown || this.wasd.A.isDown || 
          this.cursors.right.isDown || this.wasd.D.isDown ||
          this.cursors.up.isDown || this.wasd.W.isDown ||
          this.cursors.down.isDown || this.wasd.S.isDown) {
        console.log('Player movement blocked - conversation state:', this.playerConversationState)
      }
    }

    // Keep player within bounds with proper padding
    const playerBoundsPadding = this.playerCollisionRadius + this.collisionPadding
    const gameWidth = this.cameras.main.width
    const gameHeight = this.cameras.main.height
    this.player.x = Phaser.Math.Clamp(this.player.x, playerBoundsPadding, gameWidth - playerBoundsPadding)
    this.player.y = Phaser.Math.Clamp(this.player.y, playerBoundsPadding, gameHeight - playerBoundsPadding)

    // Prevent collisions
    this.preventPlayerCollision()
    this.preventNPCCollisions()

    // Update NPC behaviors
    this.updateNPCBehaviors()

    // Check proximity to NPCs
    this.checkNPCProximity()
    
    // Update conversation state timers
    this.updateConversationTimers()
  }

  private updateConversationTimers() {
    const currentTime = this.time.now
    
    // Update exit timer
    if (this.playerConversationState === 'exiting' && this.conversationExitTimer) {
      if (currentTime >= this.conversationExitTimer) {
        this.exitConversationState()
      }
    }
    
    // Update entry timer (if needed for delayed entry)
    if (this.playerConversationState === 'approaching' && this.conversationEntryTimer) {
      if (currentTime >= this.conversationEntryTimer) {
        // Entry timer expired - could trigger automatic conversation start
        // For now, we'll just clear the timer
        this.conversationEntryTimer = undefined
      }
    }
  }

  updateNPCBehaviors() {
    const currentTime = this.time.now

    this.npcs.forEach((npc, npcId) => {
      const npcData = this.npcData.get(npcId)
      if (!npcData) return

      // Process handshake responses
      this.processHandshakeResponse(npcData, currentTime)

      // Update NPC movement
      this.updateNPCMovement(npc, npcData, currentTime)

      // Check for NPC-to-NPC interactions (only if idle)
      if (npcData.handshakeState === 'idle') {
        this.checkNPCInteractions(npc, npcData, currentTime)
      }
    })
  }

  updateNPCMovement(npc: Phaser.GameObjects.Rectangle, npcData: any, currentTime: number) {
    // Skip movement if NPC is in conversation
    if (npcData.handshakeState === 'conversing') {
      npcData.isMoving = false
      return
    }

    // Update movement timer
    npcData.moveTimer += this.game.loop.delta

    // If movement duration is over, choose a new direction
    if (npcData.moveTimer >= npcData.moveDuration) {
      npcData.moveTimer = 0
      npcData.moveDuration = Phaser.Math.Between(2000, 5000)

      // Choose a new random direction
      const angle = Phaser.Math.Between(0, 360) * (Math.PI / 180)
      npcData.moveDirection.x = Math.cos(angle)
      npcData.moveDirection.y = Math.sin(angle)
      npcData.isMoving = true
    }

    // Move the NPC if it's supposed to be moving
    if (npcData.isMoving) {
      const deltaTime = this.game.loop.delta / 1000
      // Use container position if available, otherwise use NPC position
      const currentX = npcData.container ? npcData.container.x : npc.x
      const currentY = npcData.container ? npcData.container.y : npc.y
      const newX = currentX + (npcData.moveDirection.x * npcData.moveSpeed * deltaTime)
      const newY = currentY + (npcData.moveDirection.y * npcData.moveSpeed * deltaTime)
      
      // Check bounds and collision with other NPCs
      if (this.isValidNPCPosition(newX, newY, npcData.id)) {
        // Move the container (which moves both NPC and label together)
        if (npcData.container) {
          npcData.container.x = newX
          npcData.container.y = newY
        } else {
          // Fallback: move individual NPC and label
          npc.x = newX
          npc.y = newY
          if (npcData.label) {
            npcData.label.x = newX
            npcData.label.y = newY - 25
          }
        }
      } else {
        // Hit a boundary or another NPC, choose a new direction
        npcData.moveTimer = npcData.moveDuration // Force new direction
      }
    }
  }


  isValidNPCPosition(x: number, y: number, excludeId: string): boolean {
    // Check bounds with proper padding
    const boundsPadding = this.npcCollisionRadius + this.collisionPadding
    const gameWidth = this.cameras.main.width
    const gameHeight = this.cameras.main.height
    if (x < boundsPadding || x > gameWidth - boundsPadding || y < boundsPadding || y > gameHeight - boundsPadding) {
      return false
    }
    
    // Check collision with player
    if (this.player) {
      const distanceToPlayer = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y)
      const requiredDistance = this.npcCollisionRadius + this.playerCollisionRadius + this.collisionPadding
      if (distanceToPlayer < requiredDistance) {
        return false
      }
    }
    
    // Check collision with other NPCs
    for (const [npcId, otherNpc] of this.npcs) {
      if (npcId === excludeId) continue
      
      // Get the actual position of the other NPC (container or individual)
      const otherNpcData = this.npcData.get(npcId)
      const otherX = otherNpcData?.container ? otherNpcData.container.x : otherNpc.x
      const otherY = otherNpcData?.container ? otherNpcData.container.y : otherNpc.y
      
      const distance = Phaser.Math.Distance.Between(x, y, otherX, otherY)
      const requiredDistance = (this.npcCollisionRadius * 2) + this.collisionPadding
      if (distance < requiredDistance) {
        return false
      }
    }
    
    return true
  }

  checkNPCInteractions(npc: Phaser.GameObjects.Rectangle, npcData: any, currentTime: number) {
    // Skip if NPC is already in a handshake process or conversation
    if (npcData.handshakeState !== 'idle') {
      return
    }
    
    // Check if enough time has passed since last interaction
    if (currentTime - npcData.lastInteraction < npcData.interactionCooldown) {
      return
    }
    
    // Find nearby NPCs
    let closestNPC: { id: string; npc: Phaser.GameObjects.Rectangle; distance: number } | null = null
    
    this.npcs.forEach((otherNpc, otherId) => {
      if (otherId === npcData.id) return
      
      const otherNpcData = this.npcData.get(otherId)
      if (!otherNpcData) return
      
      // Skip if other NPC is already in a handshake process
      if (otherNpcData.handshakeState !== 'idle') {
        return
      }
      
      // Get actual positions (container or individual)
      const currentX = npcData.container ? npcData.container.x : npc.x
      const currentY = npcData.container ? npcData.container.y : npc.y
      const otherX = otherNpcData.container ? otherNpcData.container.x : otherNpc.x
      const otherY = otherNpcData.container ? otherNpcData.container.y : otherNpc.y
      
      const distance = Phaser.Math.Distance.Between(currentX, currentY, otherX, otherY)
      if (distance <= 80 && (!closestNPC || distance < closestNPC.distance)) {
        closestNPC = { id: otherId, npc: otherNpc, distance }
      }
    })
    
    // If there's a nearby NPC, initiate handshake
    if (closestNPC) {
      this.initiateHandshake(npcData.id, closestNPC.id)
      npcData.lastInteraction = currentTime
    }
  }


  initiateHandshake(initiatorId: string, targetId: string) {
    const initiatorData = this.npcData.get(initiatorId)
    const targetData = this.npcData.get(targetId)
    
    if (!initiatorData || !targetData) return
    
    // Set handshake states
    initiatorData.handshakeState = 'requesting'
    initiatorData.handshakePartner = targetId
    initiatorData.handshakeRequestTimer = 0
    
    targetData.handshakeState = 'requested'
    targetData.handshakePartner = initiatorId
    targetData.handshakeRequestTimer = 0
    
    // Show handshake request
    this.showHandshakeRequest(initiatorData, targetData)
    
    console.log(`${initiatorData.name} is requesting a handshake from ${targetData.name}`)
  }

  showHandshakeRequest(initiatorData: any, targetData: any) {
    // Show simple greeting request above the target NPC
    const targetX = targetData.container ? targetData.container.x : targetData.sprite.x
    const targetY = targetData.container ? targetData.container.y : targetData.sprite.y
    
    const requestBubble = this.add.container(targetX, targetY - 60)
    
    // Background
    const bg = this.add.rectangle(0, 0, 150, 25, 0x000000, 0.9)
    bg.setStrokeStyle(2, 0xffff00) // Yellow border for handshake request
    
    // Generate AI greeting
    this.generateHandshakeGreeting(initiatorData, targetData, requestBubble, bg)
    
    // Store reference for cleanup
    targetData.handshakeRequestBubble = requestBubble
    
    // Animate the request
    requestBubble.setScale(0.5)
    this.tweens.add({
      targets: requestBubble,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut'
    })
  }

  async generateHandshakeGreeting(initiatorData: any, targetData: any, requestBubble: any, bg: any) {
    try {
      // Generate AI greeting for handshake request
      const prompt = `Generate a short, friendly greeting (1-3 words) that ${initiatorData.name} would say when approaching ${targetData.name} for a conversation. 

${initiatorData.name} is a ${initiatorData.description} with personality: ${initiatorData.personality}
${targetData.name} is a ${targetData.description} with personality: ${targetData.personality}

Make it natural, personality-appropriate, and brief. Just return the greeting text, nothing else.`

      const geminiService = new GeminiService()
      const greeting = await geminiService.generateDialogue(prompt, [], '')
      
      // Create text with AI-generated greeting
      const text = this.add.text(0, 0, greeting.trim(), {
        fontSize: '10px',
        color: '#ffffff',
        fontFamily: 'Arial'
      })
      text.setOrigin(0.5)
      
      requestBubble.add([bg, text])
      
      // Synthesize voice for the greeting (background conversation)
      this.synthesizeNPCVoice(initiatorData.id, greeting.trim(), false)
      
      // Auto-hide after calculated duration based on word count
      const duration = this.calculateTextDuration(greeting.trim())
      this.time.delayedCall(duration, () => {
        if (targetData.handshakeRequestBubble === requestBubble) {
          this.tweens.add({
            targets: requestBubble,
            scaleX: 0.5,
            scaleY: 0.5,
            alpha: 0,
            duration: 300,
            ease: 'Back.easeIn',
            onComplete: () => {
              requestBubble.destroy()
              if (targetData.handshakeRequestBubble === requestBubble) {
                targetData.handshakeRequestBubble = null
              }
            }
          })
        }
      })
    } catch (error) {
      console.error('Error generating handshake greeting:', error)
      // Fallback to a simple generic greeting if AI fails
      const fallbackGreeting = "Hello!"
      const text = this.add.text(0, 0, fallbackGreeting, {
        fontSize: '10px',
        color: '#ffffff',
        fontFamily: 'Arial'
      })
      text.setOrigin(0.5)
      
      requestBubble.add([bg, text])
      
      // Synthesize voice for the fallback greeting (background conversation)
      this.synthesizeNPCVoice(initiatorData.id, fallbackGreeting, false)
      
      // Auto-hide after calculated duration based on word count
      const duration = this.calculateTextDuration(fallbackGreeting)
      this.time.delayedCall(duration, () => {
        if (targetData.handshakeRequestBubble === requestBubble) {
          this.tweens.add({
            targets: requestBubble,
            scaleX: 0.5,
            scaleY: 0.5,
            alpha: 0,
            duration: 300,
            ease: 'Back.easeIn',
            onComplete: () => {
              requestBubble.destroy()
              if (targetData.handshakeRequestBubble === requestBubble) {
                targetData.handshakeRequestBubble = null
              }
            }
          })
        }
      })
    }
  }

  processHandshakeResponse(npcData: any, currentTime: number) {
    if (npcData.handshakeState === 'requested') {
      npcData.handshakeRequestTimer += this.game.loop.delta
      
      // Time's up - auto-reject
      if (npcData.handshakeRequestTimer >= npcData.handshakeRequestDuration) {
        this.rejectHandshake(npcData.id)
        return
      }
      
      // Make decision based on personality
      const shouldAccept = this.shouldAcceptHandshake(npcData)
      
      if (shouldAccept) {
        this.acceptHandshake(npcData.id)
      } else {
        this.rejectHandshake(npcData.id)
      }
    }
  }

  shouldAcceptHandshake(npcData: any): boolean {
    // Personality-based handshake acceptance logic
    const personality = npcData.personality.toLowerCase()
    
    // Warriors are more likely to accept challenges
    if (personality.includes('warrior') || personality.includes('battle')) {
      return Math.random() < 0.8
    }
    
    // Scholars are curious and likely to accept
    if (personality.includes('scholar') || personality.includes('knowledge')) {
      return Math.random() < 0.9
    }
    
    // Mystics are mysterious but sometimes accept
    if (personality.includes('mystic') || personality.includes('fortune')) {
      return Math.random() < 0.6
    }
    
    // Gardeners are friendly and likely to accept
    if (personality.includes('gardener') || personality.includes('nature')) {
      return Math.random() < 0.85
    }
    
    // Merchants are business-minded and selective
    if (personality.includes('merchant') || personality.includes('business')) {
      return Math.random() < 0.7
    }
    
    // Artists are emotional and variable
    if (personality.includes('artist') || personality.includes('creative')) {
      return Math.random() < 0.75
    }
    
    // Sailors are adventurous and likely to accept
    if (personality.includes('sailor') || personality.includes('adventure')) {
      return Math.random() < 0.8
    }
    
    // Blacksmiths are practical and selective
    if (personality.includes('blacksmith') || personality.includes('craft')) {
      return Math.random() < 0.65
    }
    
    // Night owls are contemplative and selective
    if (personality.includes('night') || personality.includes('philosopher')) {
      return Math.random() < 0.6
    }
    
    // Nobles are refined and selective
    if (personality.includes('noble') || personality.includes('refined')) {
      return Math.random() < 0.7
    }
    
    // Default acceptance rate
    return Math.random() < 0.7
  }

  acceptHandshake(npcId: string) {
    const npcData = this.npcData.get(npcId)
    const partnerId = npcData.handshakePartner
    const partnerData = this.npcData.get(partnerId)
    
    if (!npcData || !partnerData) return
    
    // Update states
    npcData.handshakeState = 'conversing'
    partnerData.handshakeState = 'conversing'
    
    // Clean up request bubbles
    this.cleanupHandshakeRequest(npcData)
    this.cleanupHandshakeRequest(partnerData)
    
    // Start conversation flow
    this.startConversationFlow(npcData, partnerData)
    
    console.log(`${npcData.name} accepted handshake from ${partnerData.name}`)
  }

  rejectHandshake(npcId: string) {
    const npcData = this.npcData.get(npcId)
    const partnerId = npcData.handshakePartner
    const partnerData = this.npcData.get(partnerId)
    
    if (!npcData || !partnerData) return
    
    // Update states
    npcData.handshakeState = 'rejected'
    partnerData.handshakeState = 'rejected'
    
    // Clean up request bubbles
    this.cleanupHandshakeRequest(npcData)
    this.cleanupHandshakeRequest(partnerData)
    
    // Show rejection
    this.showHandshakeRejection(npcData, partnerData)
    
    // Reset states after a delay
    this.time.delayedCall(2000, () => {
      this.resetHandshakeState(npcData.id)
      this.resetHandshakeState(partnerData.id)
    })
    
    console.log(`${npcData.name} rejected handshake from ${partnerData.name}`)
  }

  cleanupHandshakeRequest(npcData: any) {
    if (npcData.handshakeRequestBubble) {
      npcData.handshakeRequestBubble.destroy()
      npcData.handshakeRequestBubble = null
    }
  }


  showHandshakeRejection(npcData: any, partnerData: any) {
    const npcX = npcData.container ? npcData.container.x : npcData.sprite.x
    const npcY = npcData.container ? npcData.container.y : npcData.sprite.y
    
    const rejectionBubble = this.add.container(npcX, npcY - 60)
    
    // Background
    const bg = this.add.rectangle(0, 0, 100, 25, 0x000000, 0.9)
    bg.setStrokeStyle(2, 0xff0000) // Red border for rejection
    
    // Simple rejection
    // Generate AI rejection message
    this.generateHandshakeRejection(npcData, rejectionBubble, bg)
    
    // Animate and destroy
    rejectionBubble.setScale(0.5)
    this.tweens.add({
      targets: rejectionBubble,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(1500, () => {
          rejectionBubble.destroy()
        })
      }
    })
  }

  async generateHandshakeRejection(npcData: any, rejectionBubble: any, bg: any) {
    try {
      // Generate AI rejection message
      const prompt = `Generate a short, polite rejection message (1-3 words) that ${npcData.name} would say when declining a conversation request.

${npcData.name} is a ${npcData.description} with personality: ${npcData.personality}

Make it natural, personality-appropriate, and brief. Just return the rejection text, nothing else.`

      const geminiService = new GeminiService()
      const rejection = await geminiService.generateDialogue(prompt, [], '')
      
      // Create text with AI-generated rejection
      const text = this.add.text(0, 0, rejection.trim(), {
        fontSize: '10px',
        color: '#ff0000',
        fontFamily: 'Arial'
      })
      text.setOrigin(0.5)
      
      rejectionBubble.add([bg, text])
    } catch (error) {
      console.error('Error generating handshake rejection:', error)
      // Fallback to a simple generic rejection if AI fails
      const text = this.add.text(0, 0, "Maybe later.", {
        fontSize: '10px',
        color: '#ff0000',
        fontFamily: 'Arial'
      })
      text.setOrigin(0.5)
      
      rejectionBubble.add([bg, text])
    }
  }

  startConversationFlow(npc1Data: any, npc2Data: any) {
    // Start a message-by-message conversation between NPCs
    this.startMessageByMessageConversation(npc1Data, npc2Data)
    
    console.log(`${npc1Data.name} and ${npc2Data.name} are starting a conversation!`)
  }

  startMessageByMessageConversation(npc1Data: any, npc2Data: any) {
    // Initialize conversation state
    npc1Data.conversationState = {
      partner: npc2Data.id,
      messageCount: 0,
      maxMessages: Phaser.Math.Between(3, 5), // 3-5 message exchanges
      conversationHistory: []
    }
    
    npc2Data.conversationState = {
      partner: npc1Data.id,
      messageCount: 0,
      maxMessages: npc1Data.conversationState.maxMessages,
      conversationHistory: []
    }
    
    // Start with an intro message from the initiator
    this.sendConversationMessage(npc1Data, npc2Data, true)
  }

  async sendConversationMessage(speakerData: any, listenerData: any, isFirstMessage: boolean = false) {
    try {
      let prompt: string
      
      if (isFirstMessage) {
        // Use predefined intro messages for the first message
        const introMessages = this.getIntroMessages(speakerData, listenerData)
        const selectedIntro = introMessages[Phaser.Math.Between(0, introMessages.length - 1)]
        
        // Show the intro message immediately
        this.showConversationMessage(speakerData, listenerData, selectedIntro)
        
        // Track used topic to prevent repetition
        const conversationKey = `${speakerData.id}-${listenerData.id}`
        const usedTopics = this.conversationHistory.get(conversationKey) || []
        usedTopics.push(selectedIntro)
        this.conversationHistory.set(conversationKey, usedTopics)
        
        // Add to conversation history
        speakerData.conversationState.conversationHistory.push(`${speakerData.name}: "${selectedIntro}"`)
        listenerData.conversationState.conversationHistory.push(`${speakerData.name}: "${selectedIntro}"`)
        
        // Schedule the response
        this.time.delayedCall(2000, () => {
          this.sendConversationMessage(listenerData, speakerData, false)
        })
      } else {
        // Generate AI response based on conversation history
        const history = speakerData.conversationState.conversationHistory.slice(-4).join('\n') // Last 4 messages for context
        
        prompt = `Generate a natural response for ${speakerData.name} in this conversation. 

${speakerData.name} is a ${speakerData.description} with personality: ${speakerData.personality}
${listenerData.name} is a ${listenerData.description} with personality: ${listenerData.personality}

Conversation so far:
${history}

Generate a single, natural response that fits ${speakerData.name}'s personality and continues the conversation naturally. Keep it conversational and 1-2 sentences maximum. Just return the response text, nothing else.`

        const geminiService = new GeminiService()
        const response = await geminiService.generateDialogue(prompt, [], '')
        
        // Show the AI-generated response
        this.showConversationMessage(speakerData, listenerData, response.trim())
        
        // Add to conversation history
        const message = `${speakerData.name}: "${response.trim()}"`
        speakerData.conversationState.conversationHistory.push(message)
        listenerData.conversationState.conversationHistory.push(message)
        
        // Check if conversation should continue
        speakerData.conversationState.messageCount++
        
        if (speakerData.conversationState.messageCount < speakerData.conversationState.maxMessages) {
          // Schedule next message from the other NPC
          this.time.delayedCall(Phaser.Math.Between(2000, 4000), () => {
            this.sendConversationMessage(listenerData, speakerData, false)
          })
        } else {
          // End conversation
          this.time.delayedCall(3000, () => {
            this.endConversation(speakerData.id, listenerData.id)
          })
        }
      }
    } catch (error) {
      console.error('Error generating conversation message:', error)
      // End conversation gracefully if AI fails
      this.endConversation(speakerData.id, listenerData.id)
    }
  }

  getIntroMessages(speakerData: any, listenerData: any): string[] {
    // Get conversation history to avoid repetition
    const conversationKey = `${speakerData.id}-${listenerData.id}`
    const usedTopics = this.conversationHistory.get(conversationKey) || []
    
    // Predefined intro messages based on personality types with more variety
    const personality = speakerData.personality.toLowerCase()
    const listenerName = listenerData.name
    
    let allMessages: string[] = []
    
    if (personality.includes('warrior')) {
      allMessages = [
        `Greetings, ${listenerName}! What brings you here?`,
        `${listenerName}, good to see you. Any news from the battlefield?`,
        `Well met, ${listenerName}. How goes your training?`,
        `Ah, ${listenerName}! Ready for some action?`,
        `Hail, ${listenerName}! The honor of combat calls.`,
        `${listenerName}, I've been sharpening my blade. Care to spar?`,
        `Greetings, warrior! What quests have you undertaken?`,
        `${listenerName}, the battlefield awaits those with courage.`
      ]
    } else if (personality.includes('scholar')) {
      allMessages = [
        `${listenerName}, what knowledge do you seek today?`,
        `Ah, ${listenerName}! Have you discovered anything interesting?`,
        `Greetings, ${listenerName}. What mysteries shall we explore?`,
        `${listenerName}, I've been studying something fascinating...`,
        `Hello, ${listenerName}! The library holds many secrets.`,
        `${listenerName}, I've been researching ancient texts.`,
        `Greetings, fellow seeker of truth!`,
        `${listenerName}, wisdom flows through our conversation.`
      ]
    } else if (personality.includes('mystic')) {
      allMessages = [
        `${listenerName}, the stars have been whispering about you...`,
        `Greetings, ${listenerName}. The cosmic energies are strong today.`,
        `${listenerName}, I sense something in your aura...`,
        `Ah, ${listenerName}. The fates have brought us together.`,
        `Hello, ${listenerName}! The mystical forces are aligned.`,
        `${listenerName}, the crystal ball shows interesting things.`,
        `Greetings, seeker of the arcane!`,
        `${listenerName}, the spirits speak through me today.`
      ]
    } else if (personality.includes('merchant')) {
      allMessages = [
        `${listenerName}, my friend! What can I interest you in today?`,
        `Ah, ${listenerName}! I have some excellent deals for you.`,
        `Greetings, ${listenerName}. Business is good, I hope?`,
        `${listenerName}, I've got something special just for you...`,
        `Hello, ${listenerName}! The market is bustling today.`,
        `${listenerName}, I've acquired some rare goods recently.`,
        `Greetings, valued customer!`,
        `${listenerName}, profit and prosperity to us both!`
      ]
    } else if (personality.includes('gardener')) {
      allMessages = [
        `${listenerName}, how lovely to see you! How does your garden grow?`,
        `Greetings, ${listenerName}. The flowers are blooming beautifully today.`,
        `${listenerName}, I've been tending to some new plants...`,
        `Ah, ${listenerName}! Nature has been kind to us lately.`,
        `Hello, ${listenerName}! The earth is fertile this season.`,
        `${listenerName}, I've been experimenting with new seeds.`,
        `Greetings, fellow cultivator!`,
        `${listenerName}, the soil speaks of abundance.`
      ]
    } else if (personality.includes('artist')) {
      allMessages = [
        `${listenerName}, you inspire me! What's your latest creation?`,
        `Greetings, ${listenerName}. The world needs more beauty like yours.`,
        `${listenerName}, I've been working on something new...`,
        `Ah, ${listenerName}! Art flows through everything we do.`,
        `Hello, ${listenerName}! Creativity flows like a river.`,
        `${listenerName}, I've been experimenting with new techniques.`,
        `Greetings, fellow artist!`,
        `${listenerName}, beauty is in the eye of the beholder.`
      ]
    } else if (personality.includes('sailor')) {
      allMessages = [
        `${listenerName}, ahoy! What winds bring you here?`,
        `Greetings, ${listenerName}. The seas have been kind lately.`,
        `${listenerName}, I've tales of distant shores to share...`,
        `Ah, ${listenerName}! Adventure calls to us both.`,
        `Hello, ${listenerName}! The ocean's call is strong today.`,
        `${listenerName}, I've been charting new courses.`,
        `Greetings, fellow mariner!`,
        `${listenerName}, the tide brings us together.`
      ]
    } else if (personality.includes('blacksmith')) {
      allMessages = [
        `${listenerName}, good to see you! Need anything forged?`,
        `Greetings, ${listenerName}. The forge has been busy today.`,
        `${listenerName}, I've been working on some new techniques...`,
        `Ah, ${listenerName}! Steel and fire await.`,
        `Hello, ${listenerName}! The anvil sings with purpose.`,
        `${listenerName}, I've been experimenting with new alloys.`,
        `Greetings, fellow craftsman!`,
        `${listenerName}, metal and muscle make the world go round.`
      ]
    } else if (personality.includes('noble')) {
      allMessages = [
        `${listenerName}, what a pleasure to see you again.`,
        `Greetings, ${listenerName}. I trust you're well?`,
        `${listenerName}, I've been meaning to speak with you...`,
        `Ah, ${listenerName}! Your presence brightens the day.`,
        `Hello, ${listenerName}! The court has been quite busy.`,
        `${listenerName}, I've been attending to matters of state.`,
        `Greetings, distinguished friend!`,
        `${listenerName}, elegance and grace in all things.`
      ]
    } else {
      allMessages = [
        `${listenerName}, good to see you!`,
        `Greetings, ${listenerName}. How are you?`,
        `${listenerName}, what brings you here?`,
        `Ah, ${listenerName}! Nice to meet you.`,
        `Hello, ${listenerName}! How's your day?`,
        `${listenerName}, it's always good to see a friendly face.`,
        `Greetings, friend!`,
        `${listenerName}, the world is full of interesting people.`
      ]
    }
    
    // Filter out used topics to prevent repetition
    const availableMessages = allMessages.filter(msg => !usedTopics.includes(msg))
    
    // If all messages have been used, reset the history for this conversation pair
    if (availableMessages.length === 0) {
      this.conversationHistory.set(conversationKey, [])
      return allMessages
    }
    
    return availableMessages
  }

  showConversationMessage(speakerData: any, listenerData: any, message: string) {
    // Create or update conversation bubble
    const npc1X = speakerData.container ? speakerData.container.x : speakerData.sprite.x
    const npc1Y = speakerData.container ? speakerData.container.y : speakerData.sprite.y
    const npc2X = listenerData.container ? listenerData.container.x : listenerData.sprite.x
    const npc2Y = listenerData.container ? listenerData.container.y : listenerData.sprite.y
    
    const midX = (npc1X + npc2X) / 2
    const midY = Math.min(npc1Y, npc2Y) - 60
    
    // Destroy existing conversation bubble if it exists
    if (speakerData.conversationBubble) {
      speakerData.conversationBubble.destroy()
    }
    if (listenerData.conversationBubble) {
      listenerData.conversationBubble.destroy()
    }
    
    const conversationBubble = this.add.container(midX, midY)
    
    // Background
    const bg = this.add.rectangle(0, 0, 400, 60, 0x000000, 0.9)
    bg.setStrokeStyle(2, 0x00ff00) // Green border for NPC conversations
    
    // Text
    const text = this.add.text(0, 0, message, {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'Arial',
      wordWrap: { width: 380, useAdvancedWrap: true },
      align: 'center'
    })
    text.setOrigin(0.5)
    
    conversationBubble.add([bg, text])
    
    // Store reference for cleanup
    speakerData.conversationBubble = conversationBubble
    listenerData.conversationBubble = conversationBubble
    
    // Synthesize voice for the speaker (background conversation)
    this.synthesizeNPCVoice(speakerData.id, message, false)
    
    // Auto-hide after calculated duration based on word count
    const duration = this.calculateTextDuration(message)
    this.time.delayedCall(duration, () => {
      if (speakerData.conversationBubble === conversationBubble) {
        this.tweens.add({
          targets: conversationBubble,
          scaleX: 0.8,
          scaleY: 0.8,
          alpha: 0,
          duration: 300,
          ease: 'Back.easeIn',
          onComplete: () => {
            conversationBubble.destroy()
            if (speakerData.conversationBubble === conversationBubble) {
              speakerData.conversationBubble = null
            }
            if (listenerData.conversationBubble === conversationBubble) {
              listenerData.conversationBubble = null
            }
          }
        })
      }
    })
  }


  showConversationBubble(npc1Data: any, npc2Data: any, conversation: string, isPlayerConversation: boolean = false) {
    let midX: number, midY: number
    
    if (isPlayerConversation) {
      // Position conversation bubble between player and NPC
      const npcX = npc1Data.container ? npc1Data.container.x : npc1Data.sprite.x
      const npcY = npc1Data.container ? npc1Data.container.y : npc1Data.sprite.y
      const playerX = this.player!.x
      const playerY = this.player!.y
      
      midX = (npcX + playerX) / 2
      midY = Math.min(npcY, playerY) - 80
    } else {
      // Position conversation bubble between two NPCs
      const npc1X = npc1Data.container ? npc1Data.container.x : npc1Data.sprite.x
      const npc1Y = npc1Data.container ? npc1Data.container.y : npc1Data.sprite.y
      const npc2X = npc2Data.container ? npc2Data.container.x : npc2Data.sprite.x
      const npc2Y = npc2Data.container ? npc2Data.container.y : npc2Data.sprite.y
      
      midX = (npc1X + npc2X) / 2
      midY = Math.min(npc1Y, npc2Y) - 80
    }
    
    const conversationBubble = this.add.container(midX, midY)
    
    // Background
    const bg = this.add.rectangle(0, 0, 400, 80, 0x000000, 0.9)
    bg.setStrokeStyle(2, isPlayerConversation ? 0x00ffff : 0x00ff00) // Cyan for player, green for NPC
    
    // Text
    const text = this.add.text(0, 0, conversation, {
      fontSize: '11px',
      color: '#ffffff',
      fontFamily: 'Arial',
      align: 'center',
      wordWrap: { width: 380 }
    })
    text.setOrigin(0.5)
    
    conversationBubble.add([bg, text])
    
    // Animate entrance
    conversationBubble.setScale(0.5)
    this.tweens.add({
      targets: conversationBubble,
      scaleX: 1,
      scaleY: 1,
      duration: 400,
      ease: 'Back.easeOut'
    })
    
    // Store reference for cleanup
    if (isPlayerConversation) {
      npc1Data.conversationBubble = conversationBubble
    } else {
      npc1Data.conversationBubble = conversationBubble
      npc2Data.conversationBubble = conversationBubble
    }
  }

  showAIConversation(npcData: any, conversation: string, isPlayerConversation: boolean, npc2Data?: any) {
    // Show the AI-generated conversation
    this.showConversationBubble(npcData, npc2Data, conversation, isPlayerConversation)
    
    // End conversation after some time
    if (isPlayerConversation) {
      this.time.delayedCall(8000, () => {
        this.endPlayerConversation()
      })
    } else {
      this.time.delayedCall(8000, () => {
        this.endConversation(npcData.id, npc2Data?.id || '')
      })
    }
  }

  endPlayerConversation() {
    console.log('Ending player conversation')
    
    if (this.playerConversationPartner) {
      const npcData = this.npcData.get(this.playerConversationPartner)
      if (npcData) {
        // Clean up conversation bubble
        if (npcData.conversationBubble) {
          npcData.conversationBubble.destroy()
          npcData.conversationBubble = null
        }
        
        // Reset NPC state
        npcData.handshakeState = 'idle'
        npcData.conversationState = undefined
      }
    }
    
    // Restore background volume when user conversation ends
    this.restoreBackgroundVolume()
    
    // Reset player conversation state
    this.exitConversationState()
    
    // Call callback to close chat in UI
    if (this.onNPCInteractionCallback) {
      this.onNPCInteractionCallback({ action: 'closeChat' })
    }
    
    console.log('Player conversation ended')
  }

  endConversation(npc1Id: string, npc2Id: string) {
    const npc1Data = this.npcData.get(npc1Id)
    const npc2Data = this.npcData.get(npc2Id)
    
    if (!npc1Data || !npc2Data) return
    
    // Clean up conversation bubble
    if (npc1Data.conversationBubble) {
      npc1Data.conversationBubble.destroy()
      npc1Data.conversationBubble = null
    }
    if (npc2Data.conversationBubble) {
      npc2Data.conversationBubble = null // Don't destroy twice
    }
    
    // Reset states
    this.resetHandshakeState(npc1Id)
    this.resetHandshakeState(npc2Id)
    
    console.log(`${npc1Data.name} and ${npc2Data.name} finished their conversation`)
  }

  resetHandshakeState(npcId: string) {
    const npcData = this.npcData.get(npcId)
    if (!npcData) return
    
    npcData.handshakeState = 'idle'
    npcData.handshakePartner = null
    npcData.handshakeRequestTimer = 0
  }



  showNPCConversation(npc1Data: any, npc2Data: any, conversation: string) {
    // Create conversation bubble between the two NPCs
    // Use container positions if available, otherwise use sprite positions
    const npc1X = npc1Data.container ? npc1Data.container.x : npc1Data.sprite.x
    const npc1Y = npc1Data.container ? npc1Data.container.y : npc1Data.sprite.y
    const npc2X = npc2Data.container ? npc2Data.container.x : npc2Data.sprite.x
    const npc2Y = npc2Data.container ? npc2Data.container.y : npc2Data.sprite.y
    
    const midX = (npc1X + npc2X) / 2
    const midY = Math.min(npc1Y, npc2Y) - 60
    
    const conversationBubble = this.add.container(midX, midY)
    
    // Background
    const bg = this.add.rectangle(0, 0, 300, 40, 0x000000, 0.9)
    bg.setStrokeStyle(2, 0x00ff00)
    
    // Text
    const text = this.add.text(0, 0, conversation, {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'Arial',
      align: 'center',
      wordWrap: { width: 280 }
    })
    text.setOrigin(0.5)
    
    conversationBubble.add([bg, text])
    
    // Animate the conversation bubble
    conversationBubble.setScale(0)
    this.tweens.add({
      targets: conversationBubble,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut'
    })
    
    // Remove after 5 seconds
    this.time.delayedCall(5000, () => {
      this.tweens.add({
        targets: conversationBubble,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        duration: 300,
        ease: 'Back.easeIn',
        onComplete: () => {
          conversationBubble.destroy()
        }
      })
    })
  }

  createPersonalityNPCs() {
    console.log('Creating personality NPCs...')
    
    // Define NPC personalities with unique traits
    const personalities = [
      {
        name: "Ruby the Warrior",
        color: 0xff6b6b, // Red
        personality: "You are Ruby, a fierce warrior. You're brave, direct, and always ready for battle. You speak with confidence and use military terms. You respect strength and courage.",
        greeting: "Hail, traveler! I am Ruby, warrior of these lands. What brings you to my domain?"
      },
      {
        name: "Azure the Scholar",
        color: 0x4ecdc4, // Teal
        personality: "You are Azure, a wise scholar. You're intelligent, curious, and speak in a formal, academic manner. You love learning and sharing knowledge.",
        greeting: "Greetings, fellow seeker of knowledge. I am Azure, keeper of ancient wisdom. What mysteries shall we explore together?"
      },
      {
        name: "Sage the Mystic",
        color: 0x45b7d1, // Blue
        personality: "You are Sage, a mystical fortune teller. You speak in riddles and metaphors, often predicting the future. You're mysterious and wise.",
        greeting: "The stars whisper your name, traveler. I am Sage, reader of fate's tapestry. What destiny do you seek?"
      },
      {
        name: "Forest the Gardener",
        color: 0x96ceb4, // Green
        personality: "You are Forest, a gentle gardener. You're peaceful, nurturing, and speak about nature and growth. You love plants and harmony.",
        greeting: "Welcome to my garden, friend. I am Forest, tender of all growing things. How may nature's wisdom guide you?"
      },
      {
        name: "Goldie the Merchant",
        color: 0xfeca57, // Yellow
        personality: "You are Goldie, a shrewd merchant. You're business-minded, persuasive, and always looking for deals. You speak about trade and profit.",
        greeting: "Ah, a potential customer! I am Goldie, purveyor of fine goods. What treasures might interest you today?"
      },
      {
        name: "Rose the Artist",
        color: 0xff9ff3, // Pink
        personality: "You are Rose, a passionate artist. You're creative, emotional, and speak about beauty and inspiration. You see the world through an artistic lens.",
        greeting: "Welcome to my studio, dear soul. I am Rose, painter of dreams. What beauty shall we create together?"
      },
      {
        name: "Storm the Sailor",
        color: 0x54a0ff, // Light Blue
        personality: "You are Storm, an experienced sailor. You're adventurous, weathered, and speak about the sea and distant lands. You tell tales of adventure.",
        greeting: "Ahoy there, land lubber! I am Storm, captain of the seven seas. What adventures call to your heart?"
      },
      {
        name: "Ember the Blacksmith",
        color: 0xff7675, // Coral
        personality: "You are Ember, a skilled blacksmith. You're strong, practical, and speak about craftsmanship and hard work. You forge tools and weapons.",
        greeting: "Welcome to my forge, friend. I am Ember, master of metal and flame. What shall we craft together?"
      },
      {
        name: "Luna the Night Owl",
        color: 0x74b9ff, // Sky Blue
        personality: "You are Luna, a nocturnal philosopher. You're contemplative, mysterious, and speak about the night sky and deep thoughts. You're most active at night.",
        greeting: "The moon greets you, night wanderer. I am Luna, keeper of midnight secrets. What mysteries shall we ponder?"
      },
      {
        name: "Violet the Noble",
        color: 0xa29bfe, // Purple
        personality: "You are Violet, a refined noble. You're elegant, sophisticated, and speak with proper etiquette. You value culture and refinement.",
        greeting: "Good day, distinguished guest. I am Lady Violet of the noble house. How may I be of service to you?"
      }
    ]

    // Create NPCs with unique personalities
    
    for (let i = 0; i < personalities.length; i++) {
      console.log(`Creating NPC ${i + 1}/${personalities.length}: ${personalities[i].name}`)
      
      // Find a valid spawn position that doesn't overlap with other NPCs or player
      const validPosition = this.findValidSpawnPosition()
      if (!validPosition) {
        console.warn(`Could not find valid spawn position for ${personalities[i].name}`)
        continue
      }
      
      const { x, y } = validPosition
      const personality = personalities[i]
      
      console.log(`NPC ${personality.name} positioned at:`, { x, y })
      
      // Create a container to hold both the NPC and its label
      const npcContainer = this.add.container(x, y)
      
      // Create the NPC rectangle
      const npc = this.add.rectangle(0, 0, 35, 35, personality.color)
      npc.setName(`npc_${i}`)
      npc.setInteractive()
      npc.setStrokeStyle(3, 0x000000)

      // Add hover effect
      npc.on('pointerover', () => {
        npc.setScale(1.2)
        npc.setStrokeStyle(4, 0xffff00)
      })

      npc.on('pointerout', () => {
        npc.setScale(1.0)
        npc.setStrokeStyle(3, 0x000000)
      })

      // Add name label
      const label = this.add.text(0, -25, personality.name, {
        fontSize: '10px',
        color: '#ffffff',
        fontFamily: 'Arial',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: { x: 4, y: 2 }
      })
      label.setOrigin(0.5)
      
      // Add both NPC and label to the container
      npcContainer.add([npc, label])

      this.npcs.set(`npc_${i}`, npc)
      
      // Store NPC reference and personality data
      this.npcData.set(`npc_${i}`, {
        id: `npc_${i}`,
        name: personality.name,
        description: personality.name,
        personality: personality.personality,
        greeting: personality.greeting,
        color: personality.color,
        dialogue: [personality.greeting],
        sprite: npc,
        container: npcContainer, // Store the container that holds both NPC and label
        label: label, // Store the label with the NPC data
        // Movement properties
        moveSpeed: Phaser.Math.Between(20, 40), // Random speed for each NPC
        moveDirection: { x: 0, y: 0 },
        moveTimer: 0,
        moveDuration: Phaser.Math.Between(2000, 5000), // How long to move in one direction
        isMoving: false,
        // Interaction properties
        lastInteraction: 0,
        interactionCooldown: Phaser.Math.Between(10000, 20000), // 10-20 seconds between interactions
        // Handshake system properties
        handshakeState: 'idle', // 'idle', 'requesting', 'requested', 'accepted', 'rejected', 'conversing'
        handshakePartner: null,
        handshakeRequestTimer: 0,
        handshakeRequestDuration: 3000 // 3 seconds to respond to handshake
      })
      
    }
    
    console.log(`Created ${personalities.length} NPCs with unique personalities`)
  }

  createNPC(id: string, description: string): Phaser.GameObjects.Rectangle {
    // Generate random position
    const x = Phaser.Math.Between(50, 1150)
    const y = Phaser.Math.Between(50, 750)

    // Create NPC sprite (simple colored rectangle)
    const npc = this.add.rectangle(x, y, 35, 35, this.getNPCColor(description))
    npc.setName(id)
    npc.setInteractive()
    npc.setStrokeStyle(2, 0x000000)

    // Add hover effect
    npc.on('pointerover', () => {
      npc.setScale(1.2)
      npc.setStrokeStyle(3, 0xffff00)
    })

    npc.on('pointerout', () => {
      npc.setScale(1)
      npc.setStrokeStyle(2, 0x000000)
    })

    // Add name label
    const nameLabel = this.add.text(x, y - 25, this.getNPCName(description), {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 2, y: 1 }
    })
    nameLabel.setOrigin(0.5)

    // Store NPC reference
    this.npcs.set(id, npc)

    return npc
  }

  createCustomNPC(id: string, description: string, personality: any): any {
    // Find a valid spawn position that doesn't overlap with other NPCs or player
    const validPosition = this.findValidSpawnPosition()
    if (!validPosition) {
      console.warn(`Could not find valid spawn position for custom NPC: ${id}`)
      return null
    }
    
    const { x, y } = validPosition

    // Create a container to hold both the NPC and its label
    const npcContainer = this.add.container(x, y)

    // Create NPC sprite (simple colored rectangle)
    const npc = this.add.rectangle(0, 0, 35, 35, this.getNPCColor(description))
    npc.setName(id)
    npc.setInteractive()
    npc.setStrokeStyle(3, 0x00ff00) // Green border for custom NPCs

    // Add hover effect
    npc.on('pointerover', () => {
      npc.setScale(1.2)
      npc.setStrokeStyle(4, 0xffff00)
    })

    npc.on('pointerout', () => {
      npc.setScale(1)
      npc.setStrokeStyle(3, 0x00ff00)
    })

    // Add name label
    const nameLabel = this.add.text(0, -25, personality.name || this.getNPCName(description), {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 2, y: 1 }
    })
    nameLabel.setOrigin(0.5)
    
    // Add both NPC and label to the container
    npcContainer.add([npc, nameLabel])

    // Store NPC reference and data
    this.npcs.set(id, npc)
    this.npcData.set(id, {
      id,
      name: personality.name || this.getNPCName(description),
      description,
      personality: personality.description,
      greeting: personality.greeting || `Hello! I'm ${personality.name || description}.`,
      color: this.getNPCColor(description),
      dialogue: personality.initialDialogue || [],
      sprite: npc,
      container: npcContainer, // Store the container that holds both NPC and label
      label: nameLabel // Store the label with the NPC data
    })

    return this.npcData.get(id)
  }

  private getNPCColor(description: string): number {
    // Generate color based on description
    const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xfeca57, 0xff9ff3, 0x54a0ff, 0xff7675, 0x74b9ff, 0xa29bfe]
    const hash = description.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    return colors[Math.abs(hash) % colors.length]
  }

  private getNPCName(description: string): string {
    // Extract a simple name from description
    const words = description.split(' ')
    if (words.length >= 2) {
      return words[0].charAt(0).toUpperCase() + words[0].slice(1)
    }
    return 'NPC'
  }

  private onNPCClick(npcId: string) {
    // This will be handled by the main component
    console.log('NPC clicked:', npcId)
  }

  removeNPC(id: string) {
    const npc = this.npcs.get(id)
    if (npc) {
      npc.destroy()
      this.npcs.delete(id)
    }
    
    // Also remove dialog if it exists
    const dialog = this.npcDialogs.get(id)
    if (dialog) {
      dialog.destroy()
      this.npcDialogs.delete(id)
    }
  }

  private checkNPCProximity() {
    if (!this.player) {
      console.log('checkNPCProximity: No player found')
      return
    }

    console.log(`checkNPCProximity: Player at (${this.player.x.toFixed(1)}, ${this.player.y.toFixed(1)}), checking ${this.npcs.size} NPCs`)

    this.npcs.forEach((npc, npcId) => {
      const npcData = this.npcData.get(npcId)
      if (!npcData) return
      
      // Get actual NPC position (container or individual)
      const npcX = npcData.container ? npcData.container.x : npc.x
      const npcY = npcData.container ? npcData.container.y : npc.y
      
      const distance = Phaser.Math.Distance.Between(
        this.player!.x, 
        this.player!.y, 
        npcX, 
        npcY
      )

      // Debug logging
      if (distance <= this.proximityDistance + 20) { // Log when close
        console.log(`Player near ${npcId}: distance=${distance.toFixed(1)}, proximityDistance=${this.proximityDistance}`)
      }

      if (distance <= this.proximityDistance) {
        // Player is close to NPC - show interaction prompt but don't disable movement
        this.showInteractionPrompt(npcId, npc, distance)
      } else {
        // Player is far from NPC
        this.handlePlayerDistance(npcId, distance)
      }
    })
  }

  private showInteractionPrompt(npcId: string, npc: Phaser.GameObjects.Rectangle, distance: number) {
    const npcData = this.npcData.get(npcId)
    if (!npcData) return

    // Only show prompt if not already in conversation with this NPC
    if (this.playerConversationState !== 'talking' || this.playerConversationPartner !== npcId) {
      // Show "Press F to talk" dialog without changing conversation state
          this.showNPCDialog(npcId, npc)
        }
  }

  private handlePlayerApproach(npcId: string, npc: Phaser.GameObjects.Rectangle, distance: number) {
    const npcData = this.npcData.get(npcId)
    if (!npcData) return

    // Handle different conversation states
    switch (this.playerConversationState) {
      case 'idle':
        // Player is approaching an NPC for the first time
        this.enterApproachState(npcId, npc, distance)
        break
        
      case 'approaching':
        // Player is still approaching the same NPC
        if (this.playerConversationPartner === npcId) {
          this.updateApproachState(npcId, npc, distance)
      } else {
          // Player switched to a different NPC
          this.exitConversationState()
          this.enterApproachState(npcId, npc, distance)
        }
        break
        
      case 'talking':
        // Player is already in conversation
        if (this.playerConversationPartner === npcId) {
          // Still talking to the same NPC - maintain conversation
          this.maintainConversationState(npcId, npc, distance)
        } else {
          // Player switched to a different NPC while talking
          this.exitConversationState()
          this.enterApproachState(npcId, npc, distance)
        }
        break
        
      case 'exiting':
        // Player is in the process of exiting conversation
        if (this.playerConversationPartner === npcId) {
          // Player came back while exiting - cancel exit
          this.cancelExitState()
          this.enterApproachState(npcId, npc, distance)
        } else {
          // Player switched to different NPC while exiting
          this.exitConversationState()
          this.enterApproachState(npcId, npc, distance)
        }
        break
    }
  }

  private handlePlayerDistance(npcId: string, distance: number) {
    // Player moved away from NPC
    if (this.playerConversationPartner === npcId) {
      switch (this.playerConversationState) {
        case 'approaching':
          // Player moved away while approaching - cancel approach
          this.exitConversationState()
          break
          
        case 'talking':
          // Player moved away while talking - start exit process
          this.enterExitState()
          break
          
        case 'exiting':
          // Player is already exiting - continue exit process
          this.updateExitState()
          break
      }
    }
    
    // Hide dialog for this NPC
        this.hideNPCDialog(npcId)
  }

  private enterApproachState(npcId: string, npc: Phaser.GameObjects.Rectangle, distance: number) {
    console.log(`Entering approach state for ${npcId}`)
    
    this.playerConversationState = 'approaching'
    this.playerConversationPartner = npcId
    
    // Show approach dialog
    this.showNPCDialog(npcId, npc)
    
    // Set entry timer (optional - for delayed entry)
    this.conversationEntryTimer = this.time.now + 500 // 500ms delay
  }

  private updateApproachState(npcId: string, npc: Phaser.GameObjects.Rectangle, distance: number) {
    // Update approach dialog if needed
    if (!this.npcDialogs.has(npcId)) {
      this.showNPCDialog(npcId, npc)
    }
  }

  private maintainConversationState(npcId: string, npc: Phaser.GameObjects.Rectangle, distance: number) {
    // Maintain conversation state - ensure chat interface is still active
    if (this.activeChatNPC !== npcId) {
      // Restore chat interface if it was lost
      this.startChatWithNPC(npcId)
    }
  }

  private enterExitState() {
    console.log('Entering exit state')
    
    this.playerConversationState = 'exiting'
    this.conversationExitTimer = this.time.now + 2000 // 2 second exit delay
    
    // Show exit warning
    if (this.playerConversationPartner) {
      this.showExitWarning(this.playerConversationPartner)
    }
  }

  private updateExitState() {
    if (this.conversationExitTimer && this.time.now >= this.conversationExitTimer) {
      // Exit timer expired - complete the exit
      this.exitConversationState()
    }
  }

  private cancelExitState() {
    console.log('Canceling exit state')
    
    this.playerConversationState = 'approaching'
    this.conversationExitTimer = undefined
    
    // Hide exit warning
    if (this.playerConversationPartner) {
      this.hideExitWarning(this.playerConversationPartner)
    }
  }

  private exitConversationState() {
    console.log('Exiting conversation state')
    
    // Close any active chat
    if (this.activeChatNPC) {
      this.closeChat(this.activeChatNPC)
    }
    
    // Reset NPC state if we were talking to one
    if (this.playerConversationPartner) {
      const npcData = this.npcData.get(this.playerConversationPartner)
      if (npcData) {
        // Reset NPC conversation state
        npcData.handshakeState = 'idle'
        npcData.conversationState = undefined
        npcData.conversationBubble = null
        
        // Clean up any conversation bubbles
        if (npcData.conversationBubble) {
          npcData.conversationBubble.destroy()
          npcData.conversationBubble = null
        }
        
        console.log(`Reset NPC ${this.playerConversationPartner} state to idle`)
      }
    }
    
    // Reset conversation state
    this.playerConversationState = 'idle'
    this.playerConversationPartner = undefined
    this.conversationEntryTimer = undefined
    this.conversationExitTimer = undefined
    
    // Hide all dialogs
    this.npcDialogs.forEach((dialog, npcId) => {
      this.hideNPCDialog(npcId)
    })
    
    // Clear any exit warnings
    this.npcDialogs.forEach((dialog, npcId) => {
      if (npcId.includes('_exit_warning')) {
        this.hideNPCDialog(npcId)
      }
    })
    
    // Clear any approach dialogs that might still be showing
    this.npcDialogs.forEach((dialog, npcId) => {
      if (npcId.includes('_dialog') || npcId.includes('_interaction')) {
        this.hideNPCDialog(npcId)
      }
    })
    
    console.log('Conversation state fully reset - player should be able to move')
  }

  private showExitWarning(npcId: string) {
    const npcData = this.npcData.get(npcId)
    if (!npcData) return
    
    const npcX = npcData.container ? npcData.container.x : npcData.sprite.x
    const npcY = npcData.container ? npcData.container.y : npcData.sprite.y
    
    const warningContainer = this.add.container(npcX, npcY - 160)
    
    const warningBg = this.add.rectangle(0, 0, 200, 25, 0x000000, 0.8)
    warningBg.setStrokeStyle(2, 0xff6600) // Orange border for warning
    
    const warningText = this.add.text(0, 0, 'Moving away...', {
      fontSize: '10px',
      color: '#ff6600',
      fontFamily: 'Arial',
      align: 'center'
    })
    warningText.setOrigin(0.5)
    
    warningContainer.add([warningBg, warningText])
    this.npcDialogs.set(`${npcId}_exit_warning`, warningContainer)
  }

  private hideExitWarning(npcId: string) {
    const warningDialog = this.npcDialogs.get(`${npcId}_exit_warning`)
    if (warningDialog) {
      warningDialog.destroy()
      this.npcDialogs.delete(`${npcId}_exit_warning`)
    }
  }

  private showNPCDialog(npcId: string, npc: Phaser.GameObjects.Rectangle) {
    console.log(`showNPCDialog called for ${npcId}`)
    
    // Don't create dialog if it already exists or if we're already chatting
    if (this.npcDialogs.has(npcId) || this.activeChatNPC === npcId) {
      console.log(`Dialog already exists or active chat for ${npcId}`)
      return
    }

    const npcData = this.npcData.get(npcId)
    if (!npcData) {
      console.log(`No npcData found for ${npcId}`)
      return
    }
    
    // Get actual NPC position (container or individual)
    const npcX = npcData.container ? npcData.container.x : npc.x
    const npcY = npcData.container ? npcData.container.y : npc.y

    console.log(`Creating dialog for ${npcId} at position (${npcX}, ${npcY - 45})`)

    // Create dialog container
    const dialogContainer = this.add.container(npcX, npcY - 45)
    
    // Create dialog background
    const dialogBg = this.add.rectangle(0, 0, 100, 30, 0x000000, 0.8)
    dialogBg.setStrokeStyle(2, 0xffffff)
    
    // Create dialog text
    const dialogText = this.add.text(0, 0, 'Press F to talk', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'Arial',
      align: 'center'
    })
    dialogText.setOrigin(0.5)
    
    // Add background and text to container
    dialogContainer.add([dialogBg, dialogText])
    
    // Add pulsing animation
    this.tweens.add({
      targets: dialogContainer,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Store dialog reference
    this.npcDialogs.set(npcId, dialogContainer)
  }

  private hideNPCDialog(npcId: string) {
    const dialog = this.npcDialogs.get(npcId)
    if (dialog) {
      dialog.destroy()
      this.npcDialogs.delete(npcId)
    }
  }

  // Collision detection methods

  private preventNPCCollisions() {
    // Check all NPC pairs for collisions
    const npcArray = Array.from(this.npcs.entries())
    
    for (let i = 0; i < npcArray.length; i++) {
      for (let j = i + 1; j < npcArray.length; j++) {
        const [npc1Id, npc1] = npcArray[i]
        const [npc2Id, npc2] = npcArray[j]
        
        const npc1Data = this.npcData.get(npc1Id)
        const npc2Data = this.npcData.get(npc2Id)
        
        if (!npc1Data || !npc2Data) continue
        
        // Get actual positions
        const npc1X = npc1Data.container ? npc1Data.container.x : npc1.x
        const npc1Y = npc1Data.container ? npc1Data.container.y : npc1.y
        const npc2X = npc2Data.container ? npc2Data.container.x : npc2.x
        const npc2Y = npc2Data.container ? npc2Data.container.y : npc2.y
        
        const distance = Phaser.Math.Distance.Between(npc1X, npc1Y, npc2X, npc2Y)
        const requiredDistance = (this.npcCollisionRadius * 2) + this.collisionPadding
        
        if (distance < requiredDistance) {
          // Calculate separation vector
          const angle = Phaser.Math.Angle.Between(npc1X, npc1Y, npc2X, npc2Y)
          const separationDistance = (requiredDistance - distance) / 2 + 1
          
          const pushX = Math.cos(angle) * separationDistance
          const pushY = Math.sin(angle) * separationDistance
          
          // Move NPCs apart
          const newNpc1X = npc1X - pushX
          const newNpc1Y = npc1Y - pushY
          const newNpc2X = npc2X + pushX
          const newNpc2Y = npc2Y + pushY
          
          // Apply movement if positions are valid
          if (this.isValidNPCPosition(newNpc1X, newNpc1Y, npc1Id)) {
            if (npc1Data.container) {
              npc1Data.container.x = newNpc1X
              npc1Data.container.y = newNpc1Y
            } else {
              npc1.x = newNpc1X
              npc1.y = newNpc1Y
            }
          }
          
          if (this.isValidNPCPosition(newNpc2X, newNpc2Y, npc2Id)) {
            if (npc2Data.container) {
              npc2Data.container.x = newNpc2X
              npc2Data.container.y = newNpc2Y
            } else {
              npc2.x = newNpc2X
              npc2.y = newNpc2Y
            }
          }
        }
      }
    }
  }

  private findValidSpawnPosition(maxAttempts: number = 100): { x: number; y: number } | null {
    const gameWidth = this.cameras.main.width
    const gameHeight = this.cameras.main.height
    const boundsPadding = this.npcCollisionRadius + this.collisionPadding

    for (let i = 0; i < maxAttempts; i++) {
      const x = Phaser.Math.Between(boundsPadding, gameWidth - boundsPadding)
      const y = Phaser.Math.Between(boundsPadding, gameHeight - boundsPadding)
      
      if (this.isValidNPCPosition(x, y, '')) {
        return { x, y }
      }
    }

    return null // No valid position found
  }

  private preventPlayerCollision() {
    if (!this.player) return

    // Check if player is colliding with any NPC
    for (const [npcId, npc] of this.npcs) {
      const npcData = this.npcData.get(npcId)
      if (!npcData) continue
      
      // Get actual NPC position (container or individual)
      const npcX = npcData.container ? npcData.container.x : npc.x
      const npcY = npcData.container ? npcData.container.y : npc.y
      
      const distance = Phaser.Math.Distance.Between(
        this.player.x, 
        this.player.y, 
        npcX, 
        npcY
      )

      const requiredDistance = this.playerCollisionRadius + this.npcCollisionRadius + this.collisionPadding
      
      if (distance < requiredDistance) {
        // Calculate push direction and distance
        const angle = Phaser.Math.Angle.Between(npcX, npcY, this.player.x, this.player.y)
        const pushDistance = requiredDistance - distance + 2 // Extra 2 pixels for smooth separation
        
        // Apply smooth push
        const pushX = Math.cos(angle) * pushDistance
        const pushY = Math.sin(angle) * pushDistance
        
        this.player.x += pushX
        this.player.y += pushY
        
        // Keep player within bounds with proper padding
        const playerBoundsPadding = this.playerCollisionRadius + this.collisionPadding
        this.player.x = Phaser.Math.Clamp(this.player.x, playerBoundsPadding, this.cameras.main.width - playerBoundsPadding)
        this.player.y = Phaser.Math.Clamp(this.player.y, playerBoundsPadding, this.cameras.main.height - playerBoundsPadding)
      }
    }
  }

  private interactWithNearbyNPC() {
    if (!this.player) return
    
    // If already in conversation, don't start a new one
    if (this.playerConversationState === 'talking') {
      console.log('Already in conversation with', this.playerConversationPartner)
      return
    }

    // Find the nearest NPC within interaction range
    let nearestNPC: { id: string, npc: Phaser.GameObjects.Rectangle, distance: number } | null = null
    let minDistance = this.proximityDistance

    this.npcs.forEach((npc, npcId) => {
      const npcData = this.npcData.get(npcId)
      if (!npcData) return
      
      const npcX = npcData.container ? npcData.container.x : npc.x
      const npcY = npcData.container ? npcData.container.y : npc.y
      
      const distance = Phaser.Math.Distance.Between(
        this.player!.x, 
        this.player!.y, 
        npcX, 
        npcY
      )
      
      if (distance <= this.proximityDistance && distance < minDistance) {
        nearestNPC = { id: npcId, npc, distance }
        minDistance = distance
      }
    })
    
    if (nearestNPC) {
      console.log(`Starting conversation with nearest NPC: ${nearestNPC.id}`)
      this.startPlayerConversation(nearestNPC.id, nearestNPC.npc)
    } else {
      console.log('No NPC within interaction range')
    }
  }

  startPlayerConversation(npcId: string, npc: Phaser.GameObjects.Rectangle) {
    const npcData = this.npcData.get(npcId)
    if (!npcData) return

    console.log(`Starting conversation with ${npcData.name}`)

    // Transition to talking state
    this.playerConversationState = 'talking'
    this.playerConversationPartner = npcId
    npcData.handshakeState = 'conversing'

    // Hide approach dialog
    this.hideNPCDialog(npcId)

    // Start message-by-message conversation with player
    this.startPlayerMessageByMessageConversation(npcData)

    console.log(`Player conversation started with ${npcData.name}`)
  }

  startPlayerMessageByMessageConversation(npcData: any) {
    // Initialize conversation state for NPC
    npcData.conversationState = {
      partner: 'player',
      messageCount: 0,
      maxMessages: Phaser.Math.Between(3, 5), // 3-5 message exchanges
      conversationHistory: []
    }
    
    // Start with an intro message from the NPC
    this.sendPlayerConversationMessage(npcData, true)
    
    // Also start the chat interface for the player
    this.startChatWithNPC(npcData.id)
  }

  async sendPlayerConversationMessage(npcData: any, isFirstMessage: boolean = false) {
    try {
      if (isFirstMessage) {
        // Use predefined intro messages for the first message
        const introMessages = this.getPlayerIntroMessages(npcData)
        const selectedIntro = introMessages[Phaser.Math.Between(0, introMessages.length - 1)]
        
        // Show the intro message immediately
        this.showPlayerConversationMessage(npcData, selectedIntro)
        
        // Add to conversation history
        npcData.conversationState.conversationHistory.push(`${npcData.name}: "${selectedIntro}"`)
        
        // Wait for player response (this will be handled by the chat system)
        // The conversation will continue when the player sends a message
      } else {
        // Generate AI response based on conversation history
        const history = npcData.conversationState.conversationHistory.slice(-4).join('\n') // Last 4 messages for context
        
        const prompt = `Generate a natural response for ${npcData.name} in this conversation with the player. 

${npcData.name} is a ${npcData.description} with personality: ${npcData.personality}

Conversation so far:
${history}

Generate a single, natural response that fits ${npcData.name}'s personality and continues the conversation naturally. Keep it conversational and 1-2 sentences maximum. Just return the response text, nothing else.`

        const geminiService = new GeminiService()
        const response = await geminiService.generateDialogue(prompt, [], '')
        
        // Show the AI-generated response
        this.showPlayerConversationMessage(npcData, response.trim())
        
        // Add to conversation history
        const message = `${npcData.name}: "${response.trim()}"`
        npcData.conversationState.conversationHistory.push(message)
        
        // Check if conversation should continue
        npcData.conversationState.messageCount++
        
        if (npcData.conversationState.messageCount >= npcData.conversationState.maxMessages) {
          // End conversation
          this.time.delayedCall(3000, () => {
            this.endPlayerConversation()
          })
        }
      }
    } catch (error) {
      console.error('Error generating player conversation message:', error)
      // End conversation gracefully if AI fails
      this.endPlayerConversation()
    }
  }

  getPlayerIntroMessages(npcData: any): string[] {
    // Predefined intro messages for player conversations
    const personality = npcData.personality.toLowerCase()
    
    if (personality.includes('warrior')) {
      return [
        "Greetings, traveler! What brings you to these lands?",
        "Well met, stranger. Are you here to test your mettle?",
        "Ah, a new face! What adventures have you seen?",
        "Welcome, friend. The path ahead is dangerous."
      ]
    } else if (personality.includes('scholar')) {
      return [
        "Ah, a seeker of knowledge! What mysteries interest you?",
        "Greetings, fellow learner. What wisdom do you seek?",
        "Welcome, curious one. I have much to share.",
        "Ah, another mind eager to explore! What shall we discover?"
      ]
    } else if (personality.includes('mystic')) {
      return [
        "The stars whisper of your arrival, traveler...",
        "Greetings, seeker. The cosmic energies swirl around you.",
        "Ah, one touched by destiny. What do the fates hold?",
        "Welcome, child of the universe. The mysteries await."
      ]
    } else if (personality.includes('merchant')) {
      return [
        "Welcome, customer! What can I interest you in today?",
        "Ah, a potential buyer! I have the finest wares.",
        "Greetings, friend! Business is good, I hope?",
        "Welcome to my shop! What treasures do you seek?"
      ]
    } else if (personality.includes('gardener')) {
      return [
        "Welcome, friend! How lovely to see you in my garden.",
        "Greetings, nature lover! The flowers bloom for you.",
        "Ah, a kindred spirit! What grows in your heart?",
        "Welcome, friend of the earth. Nature smiles upon us."
      ]
    } else if (personality.includes('artist')) {
      return [
        "Welcome, fellow creator! What beauty do you bring?",
        "Greetings, kindred soul! Art flows through everything.",
        "Ah, another artist! What masterpiece are you crafting?",
        "Welcome, friend! The world needs more beauty."
      ]
    } else if (personality.includes('sailor')) {
      return [
        "Ahoy there, landlubber! What winds bring you here?",
        "Welcome, friend! The seas have many tales to tell.",
        "Greetings, fellow adventurer! Ready for the high seas?",
        "Ahoy! What adventures await us on the horizon?"
      ]
    } else if (personality.includes('blacksmith')) {
      return [
        "Welcome, friend! Need anything forged today?",
        "Greetings, traveler! The forge burns bright.",
        "Ah, a customer! What steel do you need?",
        "Welcome to my forge! What shall we create together?"
      ]
    } else if (personality.includes('noble')) {
      return [
        "Greetings, traveler. I trust you are well?",
        "Welcome, friend. What brings you to our lands?",
        "Ah, a distinguished visitor! How may I assist you?",
        "Greetings, kind soul. Your presence honors us."
      ]
    } else {
      return [
        "Hello there, traveler! How are you?",
        "Greetings, friend! What brings you here?",
        "Welcome, stranger! Nice to meet you.",
        "Hello! What can I do for you today?"
      ]
    }
  }

  showPlayerConversationMessage(npcData: any, message: string) {
    // Create or update conversation bubble for player conversation
    const npcX = npcData.container ? npcData.container.x : npcData.sprite.x
    const npcY = npcData.container ? npcData.container.y : npcData.sprite.y
    const playerX = this.player?.x || 0
    const playerY = this.player?.y || 0
    
    const midX = (npcX + playerX) / 2
    const midY = Math.min(npcY, playerY) - 80
    
    // Destroy existing conversation bubble if it exists
    if (npcData.conversationBubble) {
      npcData.conversationBubble.destroy()
    }
    
    const conversationBubble = this.add.container(midX, midY)
    
    // Improved background with gradient effect
    const bg = this.add.rectangle(0, 0, 450, 80, 0x1a1a1a, 0.95)
    bg.setStrokeStyle(3, 0x00ffff) // Cyan border for player conversations
    
    // Add subtle glow effect
    const glow = this.add.rectangle(0, 0, 460, 90, 0x00ffff, 0.1)
    glow.setStrokeStyle(1, 0x00ffff, 0.3)
    
    // Text with better styling
    const text = this.add.text(0, 0, message, {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial',
      wordWrap: { width: 420, useAdvancedWrap: true },
      align: 'center',
      stroke: '#000000',
      strokeThickness: 1
    })
    text.setOrigin(0.5)
    
    conversationBubble.add([glow, bg, text])
    
    // Animate entrance
    conversationBubble.setScale(0.8)
    this.tweens.add({
      targets: conversationBubble,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut'
    })
    
    // Store reference for cleanup
    npcData.conversationBubble = conversationBubble
    
    // Synthesize voice for the NPC response (user conversation)
    this.synthesizeNPCVoice(npcData.id, message, true)
    
    // Auto-hide after calculated duration based on word count
    const duration = this.calculateTextDuration(message)
    this.time.delayedCall(duration, () => {
      if (npcData.conversationBubble === conversationBubble) {
        this.tweens.add({
          targets: conversationBubble,
          scaleX: 0.8,
          scaleY: 0.8,
          alpha: 0,
          duration: 300,
          ease: 'Back.easeIn',
          onComplete: () => {
            conversationBubble.destroy()
            if (npcData.conversationBubble === conversationBubble) {
              npcData.conversationBubble = null
            }
          }
        })
      }
    })
  }

  async continuePlayerConversation(npcData: any) {
    try {
      // Generate AI response based on conversation history
      const history = npcData.conversationState.conversationHistory.slice(-4).join('\n') // Last 4 messages for context
      
      const prompt = `Generate a natural response for ${npcData.name} in this conversation with the player. 

${npcData.name} is a ${npcData.description} with personality: ${npcData.personality}

Conversation so far:
${history}

Generate a single, natural response that fits ${npcData.name}'s personality and continues the conversation naturally. Keep it conversational and 1-2 sentences maximum. Just return the response text, nothing else.`

      const geminiService = new GeminiService()
      const response = await geminiService.generateDialogue(prompt, [], '')
      
      // Hide typing indicator
      this.hideNPCDialog(`${npcData.id}_typing`)
      
      // Show the AI-generated response
      this.showPlayerConversationMessage(npcData, response.trim())
      
      // Add to conversation history
      const message = `${npcData.name}: "${response.trim()}"`
      npcData.conversationState.conversationHistory.push(message)
      
      // Check if conversation should continue
      npcData.conversationState.messageCount++
      
      if (npcData.conversationState.messageCount >= npcData.conversationState.maxMessages) {
        // End conversation after a delay
        this.time.delayedCall(3000, () => {
          this.endPlayerConversation()
        })
      }
    } catch (error) {
      console.error('Error generating player conversation response:', error)
      // Hide typing indicator and end conversation gracefully
      this.hideNPCDialog(`${npcData.id}_typing`)
      this.endPlayerConversation()
    }
  }

  async generateAIConversation(npcData: any, isPlayerConversation: boolean = false, npc2Data?: any) {
    try {
      // Create conversation context
      const conversationHistory = npcData.dialogue ? npcData.dialogue.slice(-6) : []
      const historyText = conversationHistory.join('\n')
      
      let prompt: string
      if (isPlayerConversation) {
        prompt = `You are ${npcData.name}. ${npcData.personality}

Generate a natural 3-4 sentence conversation between you and a player character. Make it engaging and in character. Each sentence should be on a new line.

Previous conversation history: ${historyText}

Generate a conversation that feels natural and fits your personality.`
      } else {
        // For NPC-to-NPC conversations
        const npc2Name = npc2Data ? npc2Data.name : 'another NPC'
        const npc2Personality = npc2Data ? npc2Data.personality : 'a friendly character'
        
        prompt = `You are ${npcData.name}. ${npcData.personality}

You are having a conversation with ${npc2Name}, who is ${npc2Personality}.

Generate a natural 3-4 sentence conversation between you and ${npc2Name}. Make it engaging and in character. Each sentence should be on a new line.

Format: ${npcData.name}: "your dialogue here"
${npc2Name}: "their response here"
${npcData.name}: "your next line"
${npc2Name}: "their final response"

Make it feel natural and fit both personalities.`
      }

      // Call Gemini API
      if (this.onNPCInteractionCallback) {
        this.onNPCInteractionCallback({
          ...npcData,
          action: 'generateConversation',
          prompt: prompt,
          isPlayerConversation: isPlayerConversation,
          npc2Data: npc2Data
        })
      } else {
        // Fallback to direct API call
        await this.handleDirectGeminiConversation(npcData, prompt, isPlayerConversation, npc2Data)
      }
    } catch (error) {
      console.error('Error generating AI conversation:', error)
      // If AI fails, just end the conversation gracefully without showing hardcoded text
      if (isPlayerConversation) {
        this.endPlayerConversation()
      } else {
        this.endConversation(npcData.id, npc2Data?.id || '')
      }
    }
  }

  async handleDirectGeminiConversation(npcData: any, prompt: string, isPlayerConversation: boolean, npc2Data?: any) {
    // Direct Gemini API call for conversations
    try {
      const geminiService = new GeminiService()
      const response = await geminiService.generateDialogue(prompt, [], '')
      
      // Show the AI-generated conversation
      this.showAIConversation(npcData, response, isPlayerConversation, npc2Data)
    } catch (error) {
      console.error('Error generating AI conversation:', error)
      // If AI fails, just end the conversation gracefully without showing hardcoded text
      if (isPlayerConversation) {
        this.endPlayerConversation()
      } else {
        this.endConversation(npcData.id, npc2Data?.id || '')
      }
    }
  }

  private onNPCInteraction(npcId: string, npc: Phaser.GameObjects.Rectangle) {
    console.log('Interacting with NPC:', npcId)
    
    // Close any existing chat first and ensure clean state
    if (this.activeChatNPC && this.activeChatNPC !== npcId) {
      console.log('Switching from NPC:', this.activeChatNPC, 'to NPC:', npcId)
      this.closeChat(this.activeChatNPC)
      // Small delay to ensure cleanup is complete
      this.time.delayedCall(50, () => {
        this.startNewInteraction(npcId, npc)
      })
    } else {
      this.startNewInteraction(npcId, npc)
    }
  }

  private startNewInteraction(npcId: string, npc: Phaser.GameObjects.Rectangle) {
    // Check if this NPC has personality data (both custom and random NPCs now have this)
    const npcData = this.npcData.get(npcId)
    if (npcData) {
      // Show dialog box above the NPC
      this.showNPCDialogBox(npcId, npc, npcData)
    } else {
      // Fallback for any NPCs without personality data
      this.showInteractionDialog(npcId, npc)
    }
  }

  // Method to set the callback for NPC interactions
  setNPCInteractionCallback(callback: (npc: any) => void) {
    console.log('Setting NPC interaction callback in game scene')
    this.onNPCInteractionCallback = callback
    console.log('NPC interaction callback set successfully')
  }

  // Method to check if callback is set
  public isCallbackSet(): boolean {
    return this.onNPCInteractionCallback !== undefined
  }

  // Method to get conversation history for an NPC
  getNPCConversationHistory(npcId: string): string[] {
    const npcData = this.npcData.get(npcId)
    return npcData ? npcData.dialogue || [] : []
  }

  // Method to get all NPC data (for saving)
  getAllNPCData(): any[] {
    return Array.from(this.npcData.values())
  }

  // Method to save conversation data to localStorage
  saveConversationsToStorage() {
    const allNPCData = this.getAllNPCData()
    localStorage.setItem('npc_conversations', JSON.stringify(allNPCData))
    console.log('Saved conversations to localStorage:', allNPCData)
  }

  // Method to load conversation data from localStorage
  loadConversationsFromStorage() {
    try {
      const savedData = localStorage.getItem('npc_conversations')
      if (savedData) {
        const npcDataArray = JSON.parse(savedData)
        console.log('Loaded conversations from localStorage:', npcDataArray)
        
        // Restore NPC data
        npcDataArray.forEach((npcData: any) => {
          this.npcData.set(npcData.id, npcData)
        })
        
        return npcDataArray
      }
    } catch (error) {
      console.error('Error loading conversations from localStorage:', error)
    }
    return []
  }

  // Method to clear all dialogs and reset states
  clearAllDialogs() {
    // Clear all dialog containers
    this.npcDialogs.forEach((dialog, key) => {
      if (dialog && dialog.destroy) {
        dialog.destroy()
      }
    })
    this.npcDialogs.clear()
    
    // Clear active chat state
    this.activeChatNPC = undefined
    
    // Clear all keyboard handlers
    this.input.keyboard?.removeAllListeners()
    
    // Re-setup basic keyboard handlers
    this.setupBasicKeyboardHandlers()
  }

  private setupBasicKeyboardHandlers() {
    // Re-setup basic keyboard handlers after clearing all
    this.cursors = this.input.keyboard?.createCursorKeys()
    this.wasd = this.input.keyboard?.addKeys('W,S,A,D')
    
    // E key is now handled as normal text input in chat, no special interaction
    
    // Add F key for NPC interaction
    this.input.keyboard?.on('keydown-F', () => {
      this.interactWithNearbyNPC()
    })
    
    // Add T key to clear stuck typing indicators (debug helper)
    this.input.keyboard?.on('keydown-T', () => {
      this.clearStuckTypingIndicators()
    })
    
    // Add Q key to force close chat (useful when stuck)
    this.input.keyboard?.on('keydown-Q', () => {
      if (this.activeChatNPC) {
        console.log('Q key pressed - force closing chat for NPC:', this.activeChatNPC)
        this.closeChat(this.activeChatNPC)
      }
    })
    
    // Add G key to test direct Gemini call
    this.input.keyboard?.on('keydown-G', () => {
      if (this.activeChatNPC) {
        console.log('G key pressed - testing direct Gemini call for NPC:', this.activeChatNPC)
        const npcData = this.npcData.get(this.activeChatNPC)
        if (npcData) {
          this.handleDirectGeminiCall(this.activeChatNPC, 'Hello, this is a test message', npcData)
        }
      }
    })
    
    // Centralized keyboard handler for all chat interactions
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      this.handleGlobalKeyboardEvent(event)
    })
  }

  private handleGlobalKeyboardEvent(event: KeyboardEvent) {
    // Handle ESC key for conversation exit (works in all modes)
    if (event.key === 'Escape' || event.key === 'Esc') {
      this.handleEscapeKey(event)
      return
    }
    
    // If we're in chat input mode, let the chat handler deal with other keys
    if (this.isInChatInputMode()) {
      return // Chat input handler will deal with all other keys
    }
    
    // Handle other global keys when not in chat input mode
    if (event.code === 'Space') {
      if (this.activeChatNPC) {
        console.log('SPACE key pressed to start chat with NPC:', this.activeChatNPC)
        event.preventDefault()
        this.startChatWithNPC(this.activeChatNPC)
      }
    }
  }

  private handleEscapeKey(event: KeyboardEvent) {
    console.log('ESC key pressed - current conversation state:', this.playerConversationState)
    
    switch (this.playerConversationState) {
      case 'idle':
        // No conversation to exit
        console.log('ESC pressed but no active conversation')
        break
        
      case 'approaching':
        // Exit approach state
        console.log('ESC pressed - exiting approach state')
        event.preventDefault()
        this.exitConversationState()
        break
        
      case 'talking':
        // Exit conversation
        console.log('ESC pressed - exiting conversation with', this.playerConversationPartner)
        event.preventDefault()
        this.exitConversationState()
        break
        
      case 'exiting':
        // Already exiting - complete the exit
        console.log('ESC pressed - completing exit')
        event.preventDefault()
        this.exitConversationState()
        break
    }
  }

  private isInChatInputMode(): boolean {
    return this.activeChatNPC !== undefined && 
           this.npcDialogs.has(`${this.activeChatNPC}_chat`)
  }

  private isActivelyTypingInChat(): boolean {
    if (!this.activeChatNPC) return false
    
    const chatManager = this.npcDialogs.get(`${this.activeChatNPC}_chatManager`)
    return chatManager && chatManager.currentText && chatManager.currentText.length > 0
  }

  private startChatWithNPC(npcId: string) {
    console.log('Starting chat with NPC:', npcId)
    const npcData = this.npcData.get(npcId)
    if (!npcData) {
      console.log('No NPC data found for:', npcId)
      return
    }

    // Check conversation limit
    if (this.activeConversations.size >= this.maxConversations && !this.activeConversations.has(npcId)) {
      console.log(`Maximum conversations (${this.maxConversations}) reached. Cannot start new conversation with ${npcId}`)
      // Show a message to the player
      this.showConversationLimitMessage()
      return
    }

    // Close any existing chat first
    if (this.activeChatNPC && this.activeChatNPC !== npcId) {
      this.closeChat(this.activeChatNPC)
    }

    // Add to active conversations
    this.activeConversations.add(npcId)

    // Set this as the active chat NPC
    this.activeChatNPC = npcId

    // Hide the dialog box
    this.hideNPCDialog(`${npcId}_dialog`)
    
    // Create chat input field above the NPC
    this.showChatInput(npcId, npcData)
    
    // Show chat lock indicator
    this.showChatLockIndicator(npcId)
    
    // Call the callback to open the chat interface in the UI
    if (this.onNPCInteractionCallback) {
      this.onNPCInteractionCallback(npcData)
    }
  }

  private showChatInput(npcId: string, npcData: any) {
    console.log('Showing chat input for NPC:', npcId)
    const npc = this.npcs.get(npcId)
    if (!npc) {
      console.log('No NPC sprite found for:', npcId)
      return
    }

    // Get actual NPC position (container or individual)
    const npcX = npcData.container ? npcData.container.x : npc.x
    const npcY = npcData.container ? npcData.container.y : npc.y

    // Create chat input container
    const chatContainer = this.add.container(npcX, npcY - 80)
    console.log('Created chat container at:', npcX, npcY - 80)
    
    // Create input background
    const inputBg = this.add.rectangle(0, 0, 250, 40, 0x000000, 0.9)
    inputBg.setStrokeStyle(2, 0x00ff00)
    
    // Create input text (placeholder)
    const inputText = this.add.text(-100, 0, 'Type your message...', {
      fontSize: '12px',
      color: '#888888',
      fontFamily: 'Arial',
      align: 'left'
    })
    inputText.setOrigin(0, 0.5)
    
    // Create cursor positioned at the start
    const cursor = this.add.rectangle(-100, 0, 2, 14, 0x00ff00)
    cursor.setOrigin(0, 0.5)
    cursor.setVisible(false) // Start hidden until user types
    
    // Add blinking cursor animation
    this.tweens.add({
      targets: cursor,
      alpha: 0,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
    
    // Add all elements to container
    chatContainer.add([inputBg, inputText, cursor])
    
    // Store chat input reference
    this.npcDialogs.set(`${npcId}_chat`, chatContainer)
    
    // Set up keyboard input for typing
    this.setupChatInput(npcId, inputText, cursor)
    
    // Focus the game canvas to ensure keyboard input works
    if (this.game.canvas) {
      this.game.canvas.focus()
    }
  }

  private setupChatInput(npcId: string, inputText: any, cursor: any) {
    let currentText = ''
    let cursorPosition = 0
    
    // Create a dedicated chat input manager
    const chatInputManager = {
      npcId: npcId,
      currentText: currentText,
      cursorPosition: cursorPosition,
      inputText: inputText,
      cursor: cursor,
      
      handleKey: (event: KeyboardEvent) => {
        // Only handle keys for this specific NPC
        if (!this.activeChatNPC || this.activeChatNPC !== npcId) return
        
        // Always prevent default and stop propagation for chat input
        event.preventDefault()
        event.stopPropagation()
        
        console.log('Chat input key pressed:', event.key, 'for NPC:', npcId)
        
        if (event.key === 'Enter') {
          this.sendChatMessage(npcId, chatInputManager.currentText)
          chatInputManager.clearText()
        } else if (event.key === 'Backspace') {
          chatInputManager.handleBackspace()
        } else if (event.key === 'Escape' || event.key === 'Esc') {
          console.log('ESC key pressed in chat - exiting conversation for NPC:', npcId)
          this.exitConversationState()
        } else if (event.key === ' ') {
          chatInputManager.addCharacter(' ')
        } else if (this.isValidInputCharacter(event.key)) {
          chatInputManager.addCharacter(event.key)
        }
      },
      
      addCharacter: (char: string) => {
        chatInputManager.currentText += char
        chatInputManager.cursorPosition = chatInputManager.currentText.length
        chatInputManager.updateDisplay()
      },
      
      handleBackspace: () => {
        if (chatInputManager.currentText.length > 0) {
          chatInputManager.currentText = chatInputManager.currentText.slice(0, -1)
          chatInputManager.cursorPosition = Math.max(0, chatInputManager.cursorPosition - 1)
          chatInputManager.updateDisplay()
        }
      },
      
      clearText: () => {
        chatInputManager.currentText = ''
        chatInputManager.cursorPosition = 0
        chatInputManager.inputText.setText('Type your message...')
        chatInputManager.inputText.setColor('#888888')
        chatInputManager.cursor.setVisible(false)
      },
      
      updateDisplay: () => {
        if (chatInputManager.currentText.length === 0) {
          chatInputManager.inputText.setText('Type your message...')
          chatInputManager.inputText.setColor('#888888')
          chatInputManager.cursor.setVisible(false)
        } else {
          chatInputManager.inputText.setText(chatInputManager.currentText)
          chatInputManager.inputText.setColor('#ffffff')
          chatInputManager.cursor.setVisible(true)
          
          // Position cursor at the end of the text
          const textWidth = chatInputManager.inputText.width
          chatInputManager.cursor.x = -100 + textWidth + 2
        }
      }
    }
    
    // Store the manager
    this.npcDialogs.set(`${npcId}_chatManager`, chatInputManager as any)
    
    // Add the key handler
    this.input.keyboard?.on('keydown', chatInputManager.handleKey)
    
    // Store the handler reference for cleanup
    this.npcDialogs.set(`${npcId}_keyHandler`, chatInputManager.handleKey as any)
  }

  private isValidInputCharacter(key: string): boolean {
    return key.length === 1 && 
           !key.match(/[^\x20-\x7E]/) && // Only printable ASCII characters
           !['Enter', 'Backspace', 'Escape', 'Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(key)
  }

  private showChatLockIndicator(npcId: string) {
    const npc = this.npcs.get(npcId)
    if (!npc) return
    
    const npcData = this.npcData.get(npcId)
    if (!npcData) return

    // Remove existing lock indicator
    this.hideNPCDialog(`${npcId}_lock`)
    
    // Get actual NPC position (container or individual)
    const npcX = npcData.container ? npcData.container.x : npc.x
    const npcY = npcData.container ? npcData.container.y : npc.y
    
    // Create lock indicator
    const lockContainer = this.add.container(npcX, npcY - 180)
    
    const lockBg = this.add.rectangle(0, 0, 250, 25, 0x000000, 0.8)
    lockBg.setStrokeStyle(2, 0x00ff00)
    
    const lockText = this.add.text(0, 0, '🔒 Chat Active - You can move around freely', {
      fontSize: '10px',
      color: '#00ff00',
      fontFamily: 'Arial',
      align: 'center'
    })
    lockText.setOrigin(0.5)
    
    lockContainer.add([lockBg, lockText])
    this.npcDialogs.set(`${npcId}_lock`, lockContainer)
  }

  private sendChatMessage(npcId: string, message: string) {
    if (!message.trim()) return
    
    console.log('Sending chat message:', message, 'to NPC:', npcId)
    
    const npcData = this.npcData.get(npcId)
    if (!npcData) return
    
    // Add user message to conversation history if using new system
    if (npcData.conversationState) {
      npcData.conversationState.conversationHistory.push(`Player: "${message}"`)
    } else {
      // Fallback to old system
    if (!npcData.dialogue) {
      npcData.dialogue = []
    }
    npcData.dialogue.push(`User: ${message}`)
    }
    
    // Auto-save conversations
    this.saveConversationsToStorage()
    
    // Show "NPC is typing..." message
    this.showTypingIndicator(npcId)
    
    // Use the new message-by-message system if available
    if (npcData.conversationState) {
      // Continue the conversation with AI response
      this.continuePlayerConversation(npcData)
    } else {
      // Fallback to old system
    console.log('Using direct Gemini API call for message:', message, 'to NPC:', npcId)
    this.handleDirectGeminiCall(npcId, message, npcData)
    
    // Also try the callback if it's available (for future use)
    if (this.onNPCInteractionCallback) {
      console.log('Callback is also available, but using direct call for reliability')
      // this.onNPCInteractionCallback({ ...npcData, action: 'sendMessage', message })
      }
    }
  }

  private showTypingIndicator(npcId: string) {
    const npc = this.npcs.get(npcId)
    if (!npc) return
    
    const npcData = this.npcData.get(npcId)
    if (!npcData) return

    // Remove existing typing indicator
    this.hideNPCDialog(`${npcId}_typing`)
    
    // Get actual NPC position (container or individual)
    const npcX = npcData.container ? npcData.container.x : npc.x
    const npcY = npcData.container ? npcData.container.y : npc.y
    
    // Create typing indicator
    const typingContainer = this.add.container(npcX, npcY - 140)
    
    const typingBg = this.add.rectangle(0, 0, 200, 30, 0x000000, 0.8)
    typingBg.setStrokeStyle(2, 0xffff00)
    
    const typingText = this.add.text(0, 0, 'NPC is typing...', {
      fontSize: '12px',
      color: '#ffff00',
      fontFamily: 'Arial',
      align: 'center'
    })
    typingText.setOrigin(0.5)
    
    typingContainer.add([typingBg, typingText])
    this.npcDialogs.set(`${npcId}_typing`, typingContainer)
    
    // Add pulsing animation
    this.tweens.add({
      targets: typingContainer,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
    
    // Add timeout to hide typing indicator after 10 seconds (fallback)
    this.time.delayedCall(10000, () => {
      const currentTypingContainer = this.npcDialogs.get(`${npcId}_typing`)
      if (currentTypingContainer === typingContainer) {
        console.log('Typing indicator timeout - hiding for NPC:', npcId)
        this.hideNPCDialog(`${npcId}_typing`)
      }
    })
  }

  public receiveAIResponse(npcId: string, response: string) {
    const npcData = this.npcData.get(npcId)
    if (!npcData) return
    
    console.log('Received AI response for NPC:', npcId, 'Response:', response)
    
    // Hide typing indicator immediately
    this.hideNPCDialog(`${npcId}_typing`)
    
    // Also stop any typing animations
    const typingContainer = this.npcDialogs.get(`${npcId}_typing`)
    if (typingContainer) {
      this.tweens.killTweensOf(typingContainer)
      typingContainer.destroy()
      this.npcDialogs.delete(`${npcId}_typing`)
    }
    
    // Add AI response to dialogue history
    if (!npcData.dialogue) {
      npcData.dialogue = []
    }
    npcData.dialogue.push(`${npcData.name}: ${response}`)
    
    // Auto-save conversations
    this.saveConversationsToStorage()
    
    // Show AI response above the NPC
    this.showAIResponse(npcId, response)
    
    // Synthesize voice for the NPC response (user conversation)
    this.synthesizeNPCVoice(npcId, response, true)
  }

  private showAIResponse(npcId: string, response: string) {
    const npc = this.npcs.get(npcId)
    if (!npc) return
    
    const npcData = this.npcData.get(npcId)
    if (!npcData) return

    // Remove existing response
    this.hideNPCDialog(`${npcId}_response`)
    
    // Get actual NPC position (container or individual)
    const npcX = npcData.container ? npcData.container.x : npc.x
    const npcY = npcData.container ? npcData.container.y : npc.y
    
    // Create response container
    const responseContainer = this.add.container(npcX, npcY - 140)
    
    const responseBg = this.add.rectangle(0, 0, 300, 60, 0x000000, 0.9)
    responseBg.setStrokeStyle(2, 0x00ff00)
    
    const responseText = this.add.text(0, 0, response, {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'Arial',
      align: 'center',
      wordWrap: { width: 280 }
    })
    responseText.setOrigin(0.5)
    
    responseContainer.add([responseBg, responseText])
    this.npcDialogs.set(`${npcId}_response`, responseContainer)
    
    // Auto-hide after calculated duration based on word count
    const duration = this.calculateTextDuration(response)
    this.time.delayedCall(duration, () => {
      this.hideNPCDialog(`${npcId}_response`)
    })
  }

  private closeChat(npcId: string) {
    console.log('Closing chat for NPC:', npcId)
    
    // Clean up chat manager first
    const chatManager = this.npcDialogs.get(`${npcId}_chatManager`)
    if (chatManager) {
      // Clear any text in the chat manager
      if (chatManager.clearText) {
        chatManager.clearText()
      }
      this.npcDialogs.delete(`${npcId}_chatManager`)
    }
    
    // Remove keyboard handler for this specific NPC
    const keyHandler = this.npcDialogs.get(`${npcId}_keyHandler`)
    if (keyHandler) {
      this.input.keyboard?.off('keydown', keyHandler)
      this.npcDialogs.delete(`${npcId}_keyHandler`)
    }
    
    // Hide all related dialogs and input fields
    this.hideNPCDialog(`${npcId}_chat`)
    this.hideNPCDialog(`${npcId}_dialog`)
    this.hideNPCDialog(`${npcId}_typing`)
    this.hideNPCDialog(`${npcId}_response`)
    this.hideNPCDialog(`${npcId}_lock`)
    
    // Also stop any typing animations and clean up tweens
    const typingContainer = this.npcDialogs.get(`${npcId}_typing`)
    if (typingContainer) {
      this.tweens.killTweensOf(typingContainer)
    }
    
    // Clear active chat state
    this.activeChatNPC = undefined
    
    // Remove from active conversations
    this.activeConversations.delete(npcId)
    
    // Ensure all input-related containers are destroyed
    const chatContainer = this.npcDialogs.get(`${npcId}_chat`)
    if (chatContainer && chatContainer.destroy) {
      chatContainer.destroy()
      this.npcDialogs.delete(`${npcId}_chat`)
    }
    
    // Clear any remaining dialog references for this NPC
    this.npcDialogs.forEach((dialog, key) => {
      if (key.startsWith(npcId)) {
        if (dialog && dialog.destroy) {
          dialog.destroy()
        }
        this.npcDialogs.delete(key)
      }
    })
    
    // Ensure no input fields are focused
    this.clearAllInputFocus()
    
    // Call callback to close chat in UI
    if (this.onNPCInteractionCallback) {
      this.onNPCInteractionCallback({ action: 'closeChat' })
    }
    
    console.log('Chat closed successfully for NPC:', npcId)
  }

  private async synthesizeNPCVoice(npcId: string, text: string, isUserConversation: boolean = false) {
    console.log(`🎤 Attempting voice synthesis for NPC ${npcId}`)
    console.log(`🎤 Text: "${text}"`)
    console.log(`🎤 User conversation: ${isUserConversation}`)
    
    try {
      // Import ElevenLabsService dynamically to avoid SSR issues
      const { ElevenLabsService } = await import('../services/ElevenLabsService')
      const elevenLabsService = new ElevenLabsService()
      
      // Check if service is disabled
      if (elevenLabsService.isServiceDisabled()) {
        console.warn('🎤 ElevenLabs service is disabled. Skipping voice synthesis.')
        return
      }
      
      // Calculate distance from player to NPC
      let distance = 0
      if (!isUserConversation && this.player) {
        const npcData = this.npcData.get(npcId)
        if (npcData) {
          const npcX = npcData.container ? npcData.container.x : npcData.sprite?.x || 0
          const npcY = npcData.container ? npcData.container.y : npcData.sprite?.y || 0
          distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, npcX, npcY)
        }
      }
      
      console.log(`🎤 Distance: ${distance}`)
      
      // Synthesize speech for the NPC with conversation type and distance
      await elevenLabsService.synthesizeSpeech(text, npcId, isUserConversation, distance)
      console.log(`✅ Voice synthesis completed for NPC ${npcId}`)
    } catch (error) {
      console.error('❌ Error synthesizing voice for NPC:', npcId, error)
      // Don't throw error - just log it so the game continues
    }
  }

  private calculateTextDuration(text: string): number {
    // Calculate duration based on word count: 0.4 seconds per word
    const words = text.trim().split(/\s+/).length
    const duration = Math.max(words * 0.4, 1) // Minimum 1 second
    return duration * 1000 // Convert to milliseconds
  }

  private async restoreBackgroundVolume() {
    try {
      // Import AudioContextManager dynamically to avoid SSR issues
      const AudioContextManager = (await import('../services/AudioContextManager')).default
      const audioManager = AudioContextManager.getInstance()
      
      // Restore normal volume for background conversations
      audioManager.setUserInConversation(false)
      console.log('Background volume restored')
    } catch (error) {
      console.error('Error restoring background volume:', error)
    }
  }

  private showConversationLimitMessage() {
    // Show a temporary message to the player about conversation limit
    const playerX = this.player?.x || 0
    const playerY = this.player?.y || 0
    
    const limitMessage = this.add.container(playerX, playerY - 100)
    
    // Background
    const bg = this.add.rectangle(0, 0, 300, 50, 0xff6b6b, 0.9)
    bg.setStrokeStyle(2, 0xffffff)
    
    // Text
    const text = this.add.text(0, 0, 'Maximum 2 conversations at a time!', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 1
    })
    text.setOrigin(0.5)
    
    limitMessage.add([bg, text])
    
    // Animate entrance
    limitMessage.setScale(0.5)
    this.tweens.add({
      targets: limitMessage,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut'
    })
    
    // Auto-hide after 3 seconds
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: limitMessage,
        scaleX: 0.5,
        scaleY: 0.5,
        alpha: 0,
        duration: 200,
        ease: 'Back.easeIn',
        onComplete: () => {
          limitMessage.destroy()
        }
      })
    })
  }

  private clearAllInputFocus() {
    // Clear focus from any active input elements in the DOM
    if (typeof document !== 'undefined') {
      const activeElement = document.activeElement as HTMLElement
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        activeElement.blur()
      }
    }
    
    // Ensure the game canvas can receive focus for keyboard input
    if (this.game && this.game.canvas) {
      this.game.canvas.focus()
    }
  }

  // Method to clear any stuck typing indicators
  public clearStuckTypingIndicators() {
    this.npcDialogs.forEach((dialog, key) => {
      if (key.endsWith('_typing')) {
        console.log('Clearing stuck typing indicator:', key)
        this.tweens.killTweensOf(dialog)
        this.hideNPCDialog(key)
      }
    })
  }

  // Method to get current chat input text (for debugging)
  public getCurrentChatText(npcId: string): string {
    const chatManager = this.npcDialogs.get(`${npcId}_chatManager`)
    return chatManager ? chatManager.currentText : ''
  }

  // Method to check if chat input is active
  public isChatInputActive(npcId: string): boolean {
    return this.npcDialogs.has(`${npcId}_chat`) && 
           this.npcDialogs.has(`${npcId}_chatManager`)
  }

  // Method to handle direct Gemini API calls (fallback when callback is not available)
  private async handleDirectGeminiCall(npcId: string, message: string, npcData: any) {
    try {
      console.log('Making direct Gemini API call for NPC:', npcId)
      
      // Import GeminiService dynamically to avoid SSR issues
      const { GeminiService } = await import('../services/GeminiService')
      console.log('GeminiService imported successfully')
      const geminiService = new GeminiService()
      console.log('GeminiService instance created')
      
      // Check if API key is available
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
      if (!apiKey) {
        throw new Error('Gemini API key not found. Please set NEXT_PUBLIC_GEMINI_API_KEY in your environment variables.')
      }
      console.log('API key is available')
      
      // Create personality context from the NPC's personality
      const personalityContext = `${npcData.personality}. Respond in character as this NPC would. Keep responses conversational and 1-2 sentences.`
      
      // Get conversation history for context
      const conversationHistory = npcData.dialogue ? npcData.dialogue.slice(-6) : []
      
      const response = await geminiService.generateDialogue(
        personalityContext,
        conversationHistory,
        message
      )
      
      console.log('Received response from direct Gemini call:', response)
      this.receiveAIResponse(npcId, response)
      
    } catch (error) {
      console.error('Error in direct Gemini API call:', error)
      const fallbackResponse = "I'm sorry, I can't respond right now. Please try again."
      this.receiveAIResponse(npcId, fallbackResponse)
    }
  }

  // Method to attempt to set the callback (fallback mechanism)
  private attemptToSetCallback() {
    try {
      // Try to find the game instance and set the callback
      if (this.game && this.game.scene && this.game.scene.getScene) {
        const gameScene = this.game.scene.getScene('GameScene')
        if (gameScene && gameScene.setNPCInteractionCallback) {
          console.log('Found game scene, attempting to set callback...')
          // The callback should be set by the React component
          // This is just a fallback to ensure it's available
        }
      }
    } catch (error) {
      console.error('Error attempting to set callback:', error)
    }
  }

  private generateRandomTraits(): string[] {
    const allTraits = [
      'friendly', 'curious', 'helpful', 'mysterious', 'wise', 'cheerful',
      'serious', 'playful', 'brave', 'cautious', 'creative', 'logical',
      'energetic', 'calm', 'adventurous', 'traditional', 'innovative', 'loyal'
    ]
    
    const numTraits = Phaser.Math.Between(2, 4) // 2-4 traits
    const shuffled = allTraits.sort(() => 0.5 - Math.random())
    return shuffled.slice(0, numTraits)
  }


  private showNPCDialogBox(npcId: string, npc: Phaser.GameObjects.Rectangle, npcData: any) {
    // Remove any existing dialogs for this NPC
    this.hideNPCDialog(`${npcId}_dialog`)
    this.hideNPCDialog(`${npcId}_interaction`)
    
    // Set this as the active chat NPC
    this.activeChatNPC = npcId
    
    // Get actual NPC position (container or individual)
    const npcX = npcData.container ? npcData.container.x : npc.x
    const npcY = npcData.container ? npcData.container.y : npc.y
    
    // Create dialog container
    const dialogContainer = this.add.container(npcX, npcY - 120)
    
    // Create dialog background
    const dialogBg = this.add.rectangle(0, 0, 300, 80, 0x000000, 0.9)
    dialogBg.setStrokeStyle(3, 0x00ff00)
    
    // Create NPC name
    const nameText = this.add.text(0, -25, npcData.name, {
      fontSize: '16px',
      color: '#00ff00',
      fontFamily: 'Arial',
      align: 'center'
    })
    nameText.setOrigin(0.5)
    
    // Create greeting message
    const greetingText = this.add.text(0, 0, npcData.dialogue[0] || `Hello! I'm a ${npcData.description}.`, {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'Arial',
      align: 'center',
      wordWrap: { width: 280 }
    })
    greetingText.setOrigin(0.5)
    
    // Create instruction text
    const instructionText = this.add.text(0, 25, 'Press SPACE to start chatting', {
      fontSize: '10px',
      color: '#ffff00',
      fontFamily: 'Arial',
      align: 'center'
    })
    instructionText.setOrigin(0.5)
    
    // Add all elements to container
    dialogContainer.add([dialogBg, nameText, greetingText, instructionText])
    
    // Store dialog reference
    this.npcDialogs.set(`${npcId}_dialog`, dialogContainer)
    
    // Add pulsing animation
    this.tweens.add({
      targets: dialogContainer,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }

  private showInteractionDialog(npcId: string, npc: Phaser.GameObjects.Rectangle) {
    // Remove existing interaction dialog if any
    const existingDialog = this.npcDialogs.get(`${npcId}_interaction`)
    if (existingDialog) {
      existingDialog.destroy()
    }
    
    const npcData = this.npcData.get(npcId)
    if (!npcData) return
    
    // Get actual NPC position (container or individual)
    const npcX = npcData.container ? npcData.container.x : npc.x
    const npcY = npcData.container ? npcData.container.y : npc.y

    // Create interaction dialog container
    const dialogContainer = this.add.container(npcX, npcY - 100)
    
    // Create dialog background (larger for interaction)
    const dialogBg = this.add.rectangle(0, 0, 200, 60, 0x000000, 0.9)
    dialogBg.setStrokeStyle(3, 0x00ff00)
    
    // Create dialog text
    const dialogText = this.add.text(0, 0, `Hello! I'm ${npcId.replace('npc_', 'NPC ')}`, {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial',
      align: 'center',
      wordWrap: { width: 180 }
    })
    dialogText.setOrigin(0.5)
    
    // Add background and text to container
    dialogContainer.add([dialogBg, dialogText])
    
    // Store dialog reference
    this.npcDialogs.set(`${npcId}_interaction`, dialogContainer)

    // Auto-hide after 3 seconds
    this.time.delayedCall(3000, () => {
      this.hideNPCDialog(`${npcId}_interaction`)
    })
  }
  }
}
