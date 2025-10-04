# Virtual NPC Generator Setup

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Gemini API Key for AI personality and dialogue generation
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here

# ElevenLabs API Key for voice synthesis
NEXT_PUBLIC_ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

## Getting API Keys

### Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key and add it to your `.env.local` file

**Note**: The app uses the `gemini-1.5-flash` model. If you encounter model errors, check the [Google AI documentation](https://ai.google.dev/gemini-api/docs/models/gemini) for the latest available models.

### ElevenLabs API Key
1. Go to [ElevenLabs](https://elevenlabs.io/)
2. Sign up for an account
3. Go to your profile settings and copy your API key
4. Add it to your `.env.local` file

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## How to Use

1. **Create NPCs**: Type a description in the input field (e.g., "cyberpunk bartender", "wise wizard", "friendly shopkeeper")
2. **Spawn NPC**: Click "Spawn NPC" to generate a character with AI-generated personality and dialogue
3. **Interact**: Click on NPCs in the game world to talk to them
4. **Listen**: NPCs will speak their dialogue using AI-generated voice synthesis

## Features

- **AI Personality Generation**: Uses Gemini AI to create unique personalities based on descriptions
- **Dynamic Dialogue**: NPCs generate contextual responses using AI
- **Voice Synthesis**: ElevenLabs integration for realistic character voices
- **2D Game World**: Built with PhaserJS for interactive gameplay
- **Simple Sprites**: Uses colored rectangles for now (can be replaced with detailed sprites later)

## Game Controls

- **Arrow Keys**: Move your character around
- **Click**: Interact with NPCs
- **Mouse Hover**: See NPC names and get visual feedback

## Future Enhancements

- Replace simple sprites with detailed character artwork
- Add more complex animations and behaviors
- Implement quest systems and storylines
- Add multiplayer functionality
- Create different game environments and themes
