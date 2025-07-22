import puppeteer from "puppeteer";

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }
  let browser;
  try {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    // Wait for main content to load (optional: tweak selector)
    await page.waitForTimeout(2000);
    const text = await page.evaluate(() => document.body.innerText);
    await browser.close();
    res.status(200).json({ text });
  } catch (error) {
    if (browser) await browser.close();
    res.status(500).json({ error: error.message || "Failed to scrape page" });
  }
} 