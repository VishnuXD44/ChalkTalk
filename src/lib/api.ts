// API integration utilities for ChalkTalk

export interface StoryboardRequest {
  prompt: string;
  style?: 'educational' | 'cartoon' | 'realistic';
  ageGroup?: 'elementary' | 'middle' | 'high';
}

export interface StoryboardResponse {
  scenes: Array<{
    id: string;
    text: string;
    imagePrompt: string;
    imageUrl?: string;
    audioUrl?: string;
  }>;
  characters: string[];
  style: string;
  narration?: string;
}

// Gemini API integration
export async function generateStoryboardWithGemini(request: StoryboardRequest): Promise<StoryboardResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Gemini API key not found. Please add GEMINI_API_KEY to your .env.local file.');
  }

  // Step 1: Generate story structure and scene descriptions
  const storyPrompt = `
    Create a visual storyboard for this educational content: "${request.prompt}"
    
    Requirements:
    - Break into 4-6 scenes
    - Age group: ${request.ageGroup || 'elementary'}
    - Style: ${request.style || 'educational'}
    - Include character descriptions
    - Make it engaging and educational
    - Create a narration script for each scene
    
    Return as JSON with this structure:
    {
      "scenes": [
        {
          "id": "scene1",
          "text": "Scene description",
          "imagePrompt": "Detailed prompt for image generation",
          "narration": "Audio narration text for this scene"
        }
      ],
      "characters": ["character1", "character2"],
      "style": "description of visual style",
      "narration": "Overall story narration"
    }
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are an expert educational content creator who specializes in creating engaging visual storyboards for classroom use. ${storyPrompt}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;
    
    // Extract JSON from the response (Gemini sometimes includes extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Gemini response');
    }
    
    const storyboardData = JSON.parse(jsonMatch[0]);
    
    return storyboardData;
  } catch (error) {
    console.error('Error generating storyboard with Gemini:', error);
    throw new Error('Failed to generate storyboard. Please check your API key and try again.');
  }
}

// ElevenLabs API integration for audio generation
export async function generateAudioWithElevenLabs(text: string, voiceId?: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    throw new Error('ElevenLabs API key not found. Please add ELEVENLABS_API_KEY to your .env.local file.');
  }

  // Default to a child-friendly voice if not specified
  const defaultVoiceId = voiceId || 'pNInz6obpgDQGcFmaJgB'; // Adam voice (good for educational content)
  
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${defaultVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.0,
          use_speaker_boost: true
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`ElevenLabs API error: ${response.statusText} - ${errorData}`);
    }

    // Convert the audio response to a data URL
    const audioBlob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
  } catch (error) {
    console.error('Error generating audio with ElevenLabs:', error);
    throw new Error('Failed to generate audio with ElevenLabs.');
  }
}

// Generate complete storyboard with audio
export async function generateCompleteStoryboard(request: StoryboardRequest): Promise<StoryboardResponse> {
  try {
    // Step 1: Generate story structure with Gemini
    const storyboard = await generateStoryboardWithGemini(request);
    
    // Step 2: Generate audio for each scene (optional - can be done on demand)
    // This is commented out to avoid making too many API calls during testing
    // Uncomment when you want to generate audio for all scenes
    
    /*
    for (const scene of storyboard.scenes) {
      if (scene.narration) {
        try {
          scene.audioUrl = await generateAudioWithElevenLabs(scene.narration);
        } catch (error) {
          console.warn(`Failed to generate audio for scene ${scene.id}:`, error);
        }
      }
    }
    */
    
    return storyboard;
  } catch (error) {
    console.error('Error generating complete storyboard:', error);
    throw error;
  }
}

// Get available voices from ElevenLabs
export async function getElevenLabsVoices(): Promise<any[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    throw new Error('ElevenLabs API key not found.');
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.voices;
  } catch (error) {
    console.error('Error fetching voices:', error);
    throw new Error('Failed to fetch available voices.');
  }
}
