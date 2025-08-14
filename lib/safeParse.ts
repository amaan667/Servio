import OpenAI from 'openai';

function pickCandidateLines(raw: string, limit = 150): string {
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  const candidates = lines.filter((l) => /[0-9•\-\*]/.test(l)).slice(0, limit);
  return candidates.join('\n');
}

export async function tryParseMenuWithGPT(raw: string): Promise<{ ok: boolean; parsed: any }> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const sample = pickCandidateLines(raw);
    const prompt = `From the text below, extract a restaurant menu strictly as JSON array of items.\nEach item must be: { "category": string, "name": string, "price": number, "description": string|null }.\nOnly include purchasable items with prices. Ignore addresses, hours, phone, about-us, disclaimers, or promos.\nJSON only, no commentary.\nText:\n${sample}`;
    const chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0,
    });
    const content = chat.choices[0].message.content || '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const arr = Array.isArray(parsed) ? parsed : (parsed.items || parsed.menu || []);
    const ok = Array.isArray(arr) && arr.length > 0;
    return { ok, parsed: ok ? arr : [] };
  } catch {
    return { ok: false, parsed: [] };
  }
}

export default tryParseMenuWithGPT;


