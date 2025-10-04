// Phaser will be imported dynamically in the main component

export function createGameScene(Phaser: any) {
  return class GameScene extends Phaser.Scene {
  private npcs: Map<string, Phaser.GameObjects.Rectangle> = new Map()
  private npcDialogs: Map<string, Phaser.GameObjects.Container> = new Map()
  private npcData: Map<string, any> = new Map() // Store NPC personality data
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
  private player?: Phaser.GameObjects.Rectangle
  private wasd?: any
  private proximityDistance = 80
  private onNPCInteractionCallback?: (npc: any) => void
  private activeChatNPC?: string // Track which NPC is currently being chatted with
  private minDistance = 60 // Minimum distance between NPCs and player

  constructor() {
    super({ key: 'GameScene' })
  }

  preload() {
    // No need to load images for simple colored rectangles
  }

  create() {
    console.log('GameScene create() method called')
    
    // Create a simple ground/background
    this.add.rectangle(600, 400, 1200, 800, 0x2c3e50)
    
    // Create player (white square)
    this.player = this.add.rectangle(100, 100, 30, 30, 0xffffff)
    this.player.setStrokeStyle(2, 0x000000)
    
    // Create some random colored squares (NPCs)
    this.createRandomNPCs()

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

    // Add some initial text
    this.add.text(50, 50, 'Virtual NPC Generator', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial'
    })

    this.add.text(50, 100, 'Use WASD or Arrow Keys to move. Get close to NPCs and press E to talk.', {
      fontSize: '16px',
      color: '#cccccc',
      fontFamily: 'Arial'
    })
  }

  update() {
    if (!this.cursors || !this.player || !this.wasd) return

    const speed = 200

    // Player movement with WASD and Arrow Keys
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

    // Keep player within bounds
    this.player.x = Phaser.Math.Clamp(this.player.x, 15, 1185)
    this.player.y = Phaser.Math.Clamp(this.player.y, 15, 785)

    // Prevent player from colliding with NPCs
    this.preventPlayerCollision()

    // Check proximity to NPCs
    this.checkNPCProximity()
  }

  createRandomNPCs() {
    const colors = [
      0xff6b6b, // Red
      0x4ecdc4, // Teal
      0x45b7d1, // Blue
      0x96ceb4, // Green
      0xfeca57, // Yellow
      0xff9ff3, // Pink
      0x54a0ff, // Light Blue
      0xff7675, // Coral
      0x74b9ff, // Sky Blue
      0xa29bfe, // Purple
      0xfd79a8, // Hot Pink
      0xfdcb6e, // Orange
      0x6c5ce7, // Violet
      0x00b894, // Emerald
      0xe17055  // Orange Red
    ]

    // Create 8-12 random NPCs
    const numNPCs = Phaser.Math.Between(8, 12)
    
    for (let i = 0; i < numNPCs; i++) {
      // Find a valid spawn position that doesn't overlap with other NPCs or player
      const validPosition = this.findValidSpawnPosition()
      if (!validPosition) {
        console.warn(`Could not find valid spawn position for NPC ${i}`)
        continue
      }
      
      const { x, y } = validPosition
      const color = colors[Phaser.Math.Between(0, colors.length - 1)]
      const size = Phaser.Math.Between(25, 40)
      
      const npc = this.add.rectangle(x, y, size, size, color)
      npc.setName(`npc_${i}`)
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

      // Add a simple label
      const label = this.add.text(x, y - 25, `NPC ${i + 1}`, {
        fontSize: '10px',
        color: '#ffffff',
        fontFamily: 'Arial',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: { x: 2, y: 1 }
      })
      label.setOrigin(0.5)

      this.npcs.set(`npc_${i}`, npc)
      
      // Give random NPCs personality data too
      const randomDescriptions = [
        'mysterious stranger', 'friendly traveler', 'wise elder', 'cheerful merchant',
        'serious guard', 'playful child', 'brave warrior', 'cautious scholar',
        'energetic bard', 'calm monk', 'adventurous explorer', 'traditional craftsman'
      ]
      
      const randomDescription = randomDescriptions[Phaser.Math.Between(0, randomDescriptions.length - 1)]
      const randomTraits = this.generateRandomTraits()
      
      this.npcData.set(`npc_${i}`, {
        id: `npc_${i}`,
        name: `NPC ${i + 1}`,
        description: randomDescription,
        personality: `A ${randomDescription} with a unique personality`,
        traits: randomTraits,
        dialogue: [`Hello! I'm a ${randomDescription}.`],
        sprite: npc
      })
    }
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

    // Create NPC sprite (simple colored rectangle)
    const npc = this.add.rectangle(x, y, 35, 35, this.getNPCColor(description))
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
    const nameLabel = this.add.text(x, y - 25, personality.name || this.getNPCName(description), {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 2, y: 1 }
    })
    nameLabel.setOrigin(0.5)

    // Store NPC reference and data
    this.npcs.set(id, npc)
    this.npcData.set(id, {
      id,
      name: personality.name || this.getNPCName(description),
      description,
      personality: personality.description,
      traits: personality.traits || [],
      dialogue: personality.initialDialogue || [],
      sprite: npc
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
    if (!this.player) return

    this.npcs.forEach((npc, npcId) => {
      const distance = Phaser.Math.Distance.Between(
        this.player!.x, 
        this.player!.y, 
        npc.x, 
        npc.y
      )

      if (distance <= this.proximityDistance) {
        // Player is close to NPC - show dialog only if not already chatting
        if (this.activeChatNPC !== npcId) {
          this.showNPCDialog(npcId, npc)
        }
      } else {
        // Player is far from NPC - hide dialog but don't close active chat
        this.hideNPCDialog(npcId)
        
        // Only close chat if we're not actively in chat input mode
        if (this.activeChatNPC === npcId && !this.isInChatInputMode()) {
          console.log('Player moved away from NPC, closing chat:', npcId)
          this.closeChat(npcId)
        } else if (this.activeChatNPC === npcId && this.isInChatInputMode()) {
          console.log('Player moved away but actively chatting, keeping chat open:', npcId)
        }
      }
    })
  }

  private showNPCDialog(npcId: string, npc: Phaser.GameObjects.Rectangle) {
    // Don't create dialog if it already exists or if we're already chatting
    if (this.npcDialogs.has(npcId) || this.activeChatNPC === npcId) return

    // Create dialog container
    const dialogContainer = this.add.container(npc.x, npc.y - 60)
    
    // Create dialog background
    const dialogBg = this.add.rectangle(0, 0, 120, 40, 0x000000, 0.8)
    dialogBg.setStrokeStyle(2, 0xffffff)
    
    // Create dialog text
    const dialogText = this.add.text(0, 0, 'Press F to talk', {
      fontSize: '12px',
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
  private isPositionOccupied(x: number, y: number, excludeId?: string): boolean {
    // Check collision with player
    if (this.player) {
      const distanceToPlayer = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y)
      if (distanceToPlayer < this.minDistance) {
        return true
      }
    }

    // Check collision with other NPCs
    for (const [npcId, npc] of this.npcs) {
      if (excludeId && npcId === excludeId) continue
      
      const distance = Phaser.Math.Distance.Between(x, y, npc.x, npc.y)
      if (distance < this.minDistance) {
        return true
      }
    }

    return false
  }

  private findValidSpawnPosition(maxAttempts: number = 50): { x: number; y: number } | null {
    const gameWidth = this.cameras.main.width
    const gameHeight = this.cameras.main.height
    const margin = 50 // Keep NPCs away from edges

    for (let i = 0; i < maxAttempts; i++) {
      const x = Phaser.Math.Between(margin, gameWidth - margin)
      const y = Phaser.Math.Between(margin, gameHeight - margin)
      
      if (!this.isPositionOccupied(x, y)) {
        return { x, y }
      }
    }

    return null // No valid position found
  }

  private preventPlayerCollision() {
    if (!this.player) return

    // Check if player is colliding with any NPC
    for (const [npcId, npc] of this.npcs) {
      const distance = Phaser.Math.Distance.Between(
        this.player.x, 
        this.player.y, 
        npc.x, 
        npc.y
      )

      if (distance < this.minDistance) {
        // Push player away from NPC
        const angle = Phaser.Math.Angle.Between(npc.x, npc.y, this.player.x, this.player.y)
        const pushDistance = this.minDistance - distance + 5
        
        this.player.x += Math.cos(angle) * pushDistance
        this.player.y += Math.sin(angle) * pushDistance
        
        // Keep player within bounds
        this.player.x = Phaser.Math.Clamp(this.player.x, 15, this.cameras.main.width - 15)
        this.player.y = Phaser.Math.Clamp(this.player.y, 15, this.cameras.main.height - 15)
      }
    }
  }

  private interactWithNearbyNPC() {
    if (!this.player) return
    
    // Don't interact if we're actively chatting
    if (this.isInChatInputMode() || this.isActivelyTypingInChat()) {
      console.log('Cannot interact with NPC while actively chatting')
      return
    }

    // Find the closest NPC within interaction range
    let closestNPC: { id: string; npc: Phaser.GameObjects.Rectangle; distance: number } | null = null

    this.npcs.forEach((npc, npcId) => {
      const distance = Phaser.Math.Distance.Between(
        this.player!.x, 
        this.player!.y, 
        npc.x, 
        npc.y
      )

      if (distance <= this.proximityDistance) {
        if (!closestNPC || distance < closestNPC.distance) {
          closestNPC = { id: npcId, npc, distance }
        }
      }
    })

    if (closestNPC) {
      this.onNPCInteraction(closestNPC.id, closestNPC.npc)
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
    // If we're in chat input mode, let the chat handler deal with it
    if (this.isInChatInputMode()) {
      return // Chat input handler will deal with all keys
    }
    
    // Handle global keys when not in chat input mode
    if (event.key === 'Escape' || event.key === 'Esc') {
      if (this.activeChatNPC) {
        console.log('Global ESC key pressed - closing chat for NPC:', this.activeChatNPC)
        event.preventDefault()
        this.closeChat(this.activeChatNPC)
      }
    } else if (event.code === 'Space') {
      if (this.activeChatNPC) {
        console.log('SPACE key pressed to start chat with NPC:', this.activeChatNPC)
        event.preventDefault()
        this.startChatWithNPC(this.activeChatNPC)
      }
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

    // Close any existing chat first
    if (this.activeChatNPC && this.activeChatNPC !== npcId) {
      this.closeChat(this.activeChatNPC)
    }

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

    // Create chat input container
    const chatContainer = this.add.container(npc.x, npc.y - 100)
    console.log('Created chat container at:', npc.x, npc.y - 100)
    
    // Create input background
    const inputBg = this.add.rectangle(0, 0, 250, 40, 0x000000, 0.9)
    inputBg.setStrokeStyle(2, 0x00ff00)
    
    // Create input text (placeholder)
    const inputText = this.add.text(0, 0, 'Type your message...', {
      fontSize: '12px',
      color: '#888888',
      fontFamily: 'Arial',
      align: 'center'
    })
    inputText.setOrigin(0.5)
    
    // Create cursor
    const cursor = this.add.rectangle(0, 0, 2, 16, 0x00ff00)
    cursor.setOrigin(0.5)
    
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
          console.log('ESC key pressed - closing chat for NPC:', npcId)
          this.closeChat(npcId)
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
      },
      
      updateDisplay: () => {
        if (chatInputManager.currentText.length === 0) {
          chatInputManager.inputText.setText('Type your message...')
          chatInputManager.inputText.setColor('#888888')
        } else {
          chatInputManager.inputText.setText(chatInputManager.currentText)
          chatInputManager.inputText.setColor('#ffffff')
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

    // Remove existing lock indicator
    this.hideNPCDialog(`${npcId}_lock`)
    
    // Create lock indicator
    const lockContainer = this.add.container(npc.x, npc.y - 180)
    
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
    
    // Add user message to NPC's dialogue history
    if (!npcData.dialogue) {
      npcData.dialogue = []
    }
    npcData.dialogue.push(`User: ${message}`)
    
    // Auto-save conversations
    this.saveConversationsToStorage()
    
    // Show "NPC is typing..." message
    this.showTypingIndicator(npcId)
    
    // Always use direct Gemini API call for now to ensure it works
    console.log('Using direct Gemini API call for message:', message, 'to NPC:', npcId)
    this.handleDirectGeminiCall(npcId, message, npcData)
    
    // Also try the callback if it's available (for future use)
    if (this.onNPCInteractionCallback) {
      console.log('Callback is also available, but using direct call for reliability')
      // this.onNPCInteractionCallback({ ...npcData, action: 'sendMessage', message })
    }
  }

  private showTypingIndicator(npcId: string) {
    const npc = this.npcs.get(npcId)
    if (!npc) return

    // Remove existing typing indicator
    this.hideNPCDialog(`${npcId}_typing`)
    
    // Create typing indicator
    const typingContainer = this.add.container(npc.x, npc.y - 140)
    
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
  }

  private showAIResponse(npcId: string, response: string) {
    const npc = this.npcs.get(npcId)
    if (!npc) return

    // Remove existing response
    this.hideNPCDialog(`${npcId}_response`)
    
    // Create response container
    const responseContainer = this.add.container(npc.x, npc.y - 140)
    
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
    
    // Auto-hide after 5 seconds
    this.time.delayedCall(5000, () => {
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
      
      // Create personality context from the NPC's description and traits
      const personalityContext = `You are a ${npcData.description}. Your personality traits are: ${npcData.traits.join(', ')}. ${npcData.personality}. Respond in character as this NPC would. Keep responses conversational and 1-2 sentences.`
      
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
    
    // Create dialog container
    const dialogContainer = this.add.container(npc.x, npc.y - 120)
    
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

    // Create interaction dialog container
    const dialogContainer = this.add.container(npc.x, npc.y - 100)
    
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
