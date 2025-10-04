import * as Phaser from 'phaser'

export interface NPCData {
  id: string
  name: string
  description: string
  personality: string
  position: { x: number; y: number }
  sprite: Phaser.GameObjects.Sprite
  dialogue: string[]
  isSpeaking: boolean
  voiceId?: string
}

export class NPCManager {
  private npcs: Map<string, NPCData> = new Map()
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  createNPC(description: string, personality: string, name: string): NPCData {
    const id = `npc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Generate random position
    const x = Phaser.Math.Between(300, 900)
    const y = 650

    // Create NPC sprite
    const sprite = this.createNPCSprite(id, x, y, description)
    
    const npc: NPCData = {
      id,
      name,
      description,
      personality,
      position: { x, y },
      sprite,
      dialogue: [],
      isSpeaking: false
    }

    this.npcs.set(id, npc)
    return npc
  }

  private createNPCSprite(id: string, x: number, y: number, description: string): Phaser.GameObjects.Sprite {
    // Create a simple colored rectangle as sprite
    const color = this.getNPCColor(description)
    const npc = this.scene.add.rectangle(x, y, 40, 60, color)
    npc.setName(id)
    npc.setInteractive()
    
    // Add physics
    this.scene.physics.add.existing(npc)
    const npcBody = npc.body as Phaser.Physics.Arcade.Body
    npcBody.setImmovable(true)

    // Add hover effects
    npc.on('pointerover', () => {
      npc.setScale(1.1)
      npc.setTint(0xffff00)
    })

    npc.on('pointerout', () => {
      npc.setScale(1)
      npc.clearTint()
    })

    // Add name label
    const nameLabel = this.scene.add.text(x, y - 40, this.getNPCName(description), {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 4, y: 2 }
    })
    nameLabel.setOrigin(0.5)

    return npc as any
  }

  private getNPCColor(description: string): number {
    const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xfeca57, 0xff9ff3, 0x54a0ff, 0xff7675, 0x74b9ff, 0xa29bfe]
    const hash = description.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    return colors[Math.abs(hash) % colors.length]
  }

  private getNPCName(description: string): string {
    const words = description.split(' ')
    if (words.length >= 2) {
      return words[0].charAt(0).toUpperCase() + words[0].slice(1)
    }
    return 'NPC'
  }

  getNPC(id: string): NPCData | undefined {
    return this.npcs.get(id)
  }

  getAllNPCs(): NPCData[] {
    return Array.from(this.npcs.values())
  }

  updateNPCDialogue(id: string, newDialogue: string) {
    const npc = this.npcs.get(id)
    if (npc) {
      npc.dialogue.push(newDialogue)
    }
  }

  setNPCSpeaking(id: string, isSpeaking: boolean) {
    const npc = this.npcs.get(id)
    if (npc) {
      npc.isSpeaking = isSpeaking
      
      // Visual feedback for speaking
      if (isSpeaking) {
        npc.sprite.setTint(0x00ff00)
        npc.sprite.setScale(1.2)
      } else {
        npc.sprite.clearTint()
        npc.sprite.setScale(1)
      }
    }
  }

  removeNPC(id: string) {
    const npc = this.npcs.get(id)
    if (npc) {
      npc.sprite.destroy()
      this.npcs.delete(id)
    }
  }

  clearAllNPCs() {
    this.npcs.forEach(npc => {
      npc.sprite.destroy()
    })
    this.npcs.clear()
  }
}
