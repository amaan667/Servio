import OpenAI from "openai";

export function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "The OPENAI_API_KEY environment variable is missing or empty; set it at runtime to use OpenAI features."
    );
  }
  return new OpenAI({ apiKey });
}
