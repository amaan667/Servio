import OpenAI from 'openai';

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: 'OpenAI API key is missing',
        available: false 
      }), { status: 400 });
    }

    console.log('Testing OpenAI API key...');
    
    const openai = new OpenAI({ apiKey });
    
    // Test with a simple text completion
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "user", content: "Say 'Hello World' if you can read this." }
      ],
      max_tokens: 10,
    });

    const text = response.choices[0]?.message?.content || '';
    
    return new Response(JSON.stringify({ 
      success: true,
      message: text,
      available: true 
    }), { status: 200 });
    
  } catch (error: any) {
    console.error('OpenAI test failed:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      available: false 
    }), { status: 500 });
  }
} 