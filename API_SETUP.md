# ChalkTalk API Setup Guide

## Required Environment Variables

Create a `.env.local` file in your project root and add the following API keys:

### Essential APIs for Storyboard Generation

#### 1. Google Gemini API (Text processing and story generation)
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```
- **Purpose**: Text analysis, story structure generation, prompt optimization
- **Get it**: https://makersuite.google.com/app/apikey
- **Cost**: Free tier available, very affordable
- **Model**: gemini-1.5-flash (fast and cost-effective)

#### 2. ElevenLabs API (Audio generation)
```bash
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```
- **Purpose**: Generate high-quality narration audio for storyboards
- **Get it**: https://elevenlabs.io/app/settings/api-keys
- **Cost**: Free tier includes 10,000 characters/month
- **Features**: Multiple voices, child-friendly options available

### Optional APIs

#### Database (if storing user data)
```bash
DATABASE_URL=your_database_url_here
```
- **Options**: PostgreSQL, MongoDB, Supabase, PlanetScale

#### Authentication (if adding user accounts)
```bash
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=http://localhost:3000
```

## Recommended Starting Setup

For testing and development, start with:

```bash
# .env.local
GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

This will allow you to:
1. Process text and generate story structures with Gemini
2. Create narration audio with ElevenLabs
3. Test the full storyboard generation pipeline

## API Usage Tips

1. **Start with Gemini**: Free tier available, easy to implement
2. **Monitor costs**: Set usage limits in your API accounts
3. **Test with small prompts**: Use the test prompts in the app
4. **Audio generation**: ElevenLabs has a free tier with 10k characters/month
5. **Voice selection**: Use child-friendly voices for educational content

## Next Steps

1. Get a Gemini API key from Google AI Studio
2. Get an ElevenLabs API key
3. Add both to your `.env.local` file
4. Test with the provided sample prompts
5. Optionally generate audio for storyboard scenes

## Available API Endpoints

- `POST /api/generate-storyboard` - Generate storyboard structure with Gemini
- `POST /api/generate-audio` - Generate audio narration with ElevenLabs
