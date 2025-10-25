import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Simple test endpoint to verify Playwright is working
 * Call: GET /api/test-scrape
 */
export async function GET() {
  const testId = Math.random().toString(36).substring(7);

  console.info(`\n${"=".repeat(80)}`);
  console.info(`🧪 [TEST SCRAPE ${testId}] STARTING PLAYWRIGHT TEST`);
  console.info(`⏰ ${new Date().toISOString()}`);
  console.info(`${"=".repeat(80)}\n`);

  try {
    // Test 1: Import Playwright
    console.info(`📦 [TEST ${testId}] Step 1: Importing playwright-core...`);
    const playwright = await import("playwright-core");
    console.info(`✅ [TEST ${testId}] playwright-core imported successfully`);

    // Test 2: Launch browser
    console.info(`🌐 [TEST ${testId}] Step 2: Launching Chromium browser...`);
    const browser = await playwright.chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--no-zygote",
      ],
      timeout: 30000,
    });
    console.info(`✅ [TEST ${testId}] Browser launched successfully`);

    // Test 3: Create page
    console.info(`📄 [TEST ${testId}] Step 3: Creating new page...`);
    const page = await browser.newPage();
    console.info(`✅ [TEST ${testId}] Page created`);

    // Test 4: Navigate to simple site
    console.info(`🌐 [TEST ${testId}] Step 4: Navigating to example.com...`);
    await page.goto("https://example.com", {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });
    console.info(`✅ [TEST ${testId}] Navigation successful`);

    // Test 5: Extract content
    console.info(`📝 [TEST ${testId}] Step 5: Extracting page content...`);
    const title = await page.title();
    const html = await page.content();
    console.info(`✅ [TEST ${testId}] Content extracted`);
    console.info(`  📄 Title: "${title}"`);
    console.info(`  📄 HTML length: ${html.length} chars`);

    // Cleanup
    await browser.close();
    console.info(`✅ [TEST ${testId}] Browser closed`);

    console.info(`\n${"=".repeat(80)}`);
    console.info(`✅ [TEST SCRAPE ${testId}] ALL TESTS PASSED!`);
    console.info(`${"=".repeat(80)}\n`);

    return NextResponse.json({
      ok: true,
      message: "Playwright is working correctly!",
      test: {
        playwrightImport: "✅",
        browserLaunch: "✅",
        pageCreation: "✅",
        navigation: "✅",
        contentExtraction: "✅",
      },
      sample: {
        title,
        htmlLength: html.length,
      },
    });
  } catch (error) {
    console.error(`\n${"=".repeat(80)}`);
    console.error(`❌ [TEST SCRAPE ${testId}] TEST FAILED`);
    console.error(`${"=".repeat(80)}`);
    console.error(`❌ Error:`, error);
    console.error(`❌ Message:`, error instanceof Error ? error.message : String(error));
    console.error(`❌ Stack:`, error instanceof Error ? error.stack : "No stack");
    console.error(`${"=".repeat(80)}\n`);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Test failed",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
