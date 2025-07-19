import { OpenAI } from "openai";
import fs from "fs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function extractMenuFromImage(imagePath: string) {
  const imageBytes = fs.readFileSync(imagePath).toString("base64");

  const prompt = `
You are an expert at reading restaurant menus. 
From the image, extract structured JSON in the following format:

[
  {
    "name": "Dish Name",
    "description": "Optional description",
    "price": 12.50,
    "category": "Starters"
  },
  ...
]

Rules:
- Include all items that have names and prices.
- Use the English translation if bilingual.
- Group items under reasonable categories.
- Add-ons should be included with "Add-on" in the name.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${imageBytes}`,
            },
          },
        ],
      },
    ],
    temperature: 0.2,
  });

  const text = response.choices[0]?.message?.content;
  try {
    const json = JSON.parse(text!);
    return json;
  } catch (err) {
    console.error("Failed to parse JSON:", text);
    throw new Error("Invalid JSON response from GPT Vision");
  }
} 