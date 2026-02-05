import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy external menu item images so they load when the source blocks cross-origin
 * (e.g. nurcafe.co.uk/_next/image?url=...). Browser requests our URL; we fetch and stream.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return NextResponse.json({ error: "Only http(s) allowed" }, { status: 400 });
  }

  try {
    const res = await fetch(parsed.toString(), {
      method: "GET",
      headers: {
        Accept: "image/*",
        "User-Agent":
          "Mozilla/5.0 (compatible; ServioMenu/1.0; +https://servio.app)",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}` },
        { status: res.status }
      );
    }
    const contentType =
      res.headers.get("Content-Type") || "application/octet-stream";
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
