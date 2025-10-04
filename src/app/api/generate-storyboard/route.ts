import { NextRequest, NextResponse } from 'next/server';
import { generateStoryboardWithGemini } from '@/lib/api';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      );
    }

    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { 
          error: 'Gemini API key not configured. Please add GEMINI_API_KEY to your .env.local file.',
          setup: 'See API_SETUP.md for instructions'
        },
        { status: 500 }
      );
    }

    // Generate storyboard
    const storyboard = await generateStoryboardWithGemini({
      prompt,
      style: 'educational',
      ageGroup: 'elementary'
    });

    return NextResponse.json({
      success: true,
      storyboard,
      message: `Generated storyboard with ${storyboard.scenes.length} scenes`
    });

  } catch (error) {
    console.error('Storyboard generation error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: 'Check your API key and network connection'
      },
      { status: 500 }
    );
  }
}
