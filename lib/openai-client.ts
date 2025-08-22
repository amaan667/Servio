import OpenAI from "openai";

let cachedOpenAIClient: OpenAI | null = null;

/**
 * Creates an OpenAI client with proper error handling
 */
export function createOpenAIClient(): OpenAI {
  // Return cached client if available
  if (cachedOpenAIClient) {
    return cachedOpenAIClient;
  }

  console.log('🔄 Creating OpenAI client...');

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const error = 'OPENAI_API_KEY is required for OpenAI client';
    console.error('❌ OpenAI client creation failed:', error);
    throw new Error(error);
  }

  try {
    cachedOpenAIClient = new OpenAI({ apiKey });
    console.log('✅ OpenAI client created successfully');
    return cachedOpenAIClient;
  } catch (error) {
    console.error('💥 Failed to create OpenAI client:', error);
    throw error;
  }
}

/**
 * Gets the OpenAI client, creating it if necessary
 */
export function getOpenAIClient(): OpenAI {
  return createOpenAIClient();
}