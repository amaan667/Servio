import { getOpenAI } from "@/lib/openai";

export async function GET(req: Request) {
  // If you need Supabase, you must use the Node.js request/response objects.
  // In Next.js app router, you can only use the web Request object, so skip Supabase unless you use edge SSR helpers.
  // Remove or comment out Supabase usage if not needed for this test route.

  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "OpenAI API key is missing",
          available: false,
        }),
        { status: 400 },
      );
    }

    console.log("Testing OpenAI API key...");
    const openai = getOpenAI();
    // Test with a simple text completion
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: "Say 'Hello World' if you can read this." },
      ],
      max_tokens: 10,
    });
    const text = response.choices[0]?.message?.content || "";
    return new Response(
      JSON.stringify({
        success: true,
        message: text,
        available: true,
      }),
      { status: 200 },
    );
  } catch (error: any) {
    console.error("OpenAI test failed:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        available: false,
      }),
      { status: 500 },
    );
  }
}
