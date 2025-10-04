import { NextRequest, NextResponse } from 'next/server';
import { generateAudioWithElevenLabs } from '@/lib/api';

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      );
    }

    // Check if ElevenLabs API key is configured
    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { 
          error: 'ElevenLabs API key not configured. Please add ELEVENLABS_API_KEY to your .env.local file.',
          setup: 'See API_SETUP.md for instructions'
        },
        { status: 500 }
      );
    }

    // Generate audio
    const audioUrl = await generateAudioWithElevenLabs(text, voiceId);

    return NextResponse.json({
      success: true,
      audioUrl,
      message: 'Audio generated successfully'
    });

  } catch (error) {
    console.error('Audio generation error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: 'Check your ElevenLabs API key and network connection'
      },
      { status: 500 }
    );
  }
}
