'use client';

import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/generate-storyboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate storyboard');
      }

      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ChalkTalk</h1>
          <p className="text-gray-600">AI-Powered Storyboarding for the Classroom</p>
              </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                Enter your lesson content or story:
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Paste your lesson plan, story, or concept here..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                required
              />
            </div>
            
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isLoading || !prompt.trim()}
                className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Generating...' : 'Generate Storyboard'}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setPrompt('');
                  setResult('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Clear
              </button>
            </div>
          </form>

          {result && (
            <div className="mt-6 p-4 bg-gray-50 rounded-md">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Result:</h3>
              <p className="text-gray-700">{result}</p>
            </div>
          )}

          {isLoading && (
            <div className="mt-6 p-4 bg-blue-50 rounded-md">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
                <span className="text-indigo-700">Generating your storyboard...</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Prompts</h2>
          <div className="grid gap-3">
            <button
              onClick={() => setPrompt("A young girl named Maya discovers a magical garden behind her school. She meets talking animals who teach her about photosynthesis and how plants make their own food.")}
              className="text-left p-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-gray-900">Science Story</div>
              <div className="text-sm text-gray-600">Photosynthesis lesson with magical elements</div>
            </button>
            
            <button
              onClick={() => setPrompt("In ancient Egypt, a young scribe named Amun learns about the pyramids. He discovers how thousands of workers moved massive stone blocks using ramps and levers.")}
              className="text-left p-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-gray-900">History Lesson</div>
              <div className="text-sm text-gray-600">Ancient Egypt and pyramid construction</div>
            </button>
            
            <button
              onClick={() => setPrompt("A brave little robot named Chip learns about emotions. He discovers that feeling sad, happy, or angry is normal and learns how to express his feelings to his robot friends.")}
              className="text-left p-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-gray-900">Social-Emotional Learning</div>
              <div className="text-sm text-gray-600">Understanding and expressing emotions</div>
              </button>
          </div>
          </div>
        </div>
    </div>
  );
}