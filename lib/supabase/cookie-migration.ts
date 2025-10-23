/**
 * Cookie Migration Helper
 *
 * Automatically migrates localStorage-only sessions to cookie-based sessions.
 * This ensures server-side routes can access the session.
 */

export function migrateSessionToCookies() {
  if (typeof window === "undefined") return;

  try {
    // Check if we have a localStorage session but no cookie session
    const storageKey = Object.keys(localStorage).find(
      (key) => key.includes("supabase.auth.token") || key.includes("-auth-token")
    );

    if (!storageKey) return;

    const sessionData = localStorage.getItem(storageKey);
    if (!sessionData) return;

    // Parse the session
    const session = JSON.parse(sessionData);

    // Check if we have a valid session with access_token
    if (!session?.access_token && !session?.currentSession?.access_token) return;

    // Check if cookies are already set
    const hasCookie = document.cookie
      .split(";")
      .some((cookie) => cookie.trim().startsWith("sb-") && cookie.includes("-auth-token"));

    if (hasCookie) {
      console.info("[COOKIE MIGRATION] ✅ Cookies already set");
      return;
    }

    console.warn("[COOKIE MIGRATION] ⚠️ Session in localStorage but not in cookies");
    console.warn("[COOKIE MIGRATION] 🔄 Please sign out and sign back in to enable all features");

    // Show a user-friendly banner
    showMigrationBanner();
  } catch (error) {
    console.error("[COOKIE MIGRATION] Error checking session:", error);
  }
}

function showMigrationBanner() {
  // Only show once per session
  if (sessionStorage.getItem("cookie-migration-shown")) return;
  sessionStorage.setItem("cookie-migration-shown", "true");

  const banner = document.createElement("div");
  banner.id = "cookie-migration-banner";
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  banner.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
      <div style="flex: 1; min-width: 300px;">
        <strong style="font-size: 16px;">🔄 Session Update Required</strong>
        <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.95;">
          Please sign out and sign back in to enable all features (KDS, QR codes, etc.)
        </p>
      </div>
      <div style="display: flex; gap: 12px; align-items: center;">
        <button 
          onclick="window.location.href='/sign-out'"
          style="
            background: white;
            color: #667eea;
            border: none;
            padding: 10px 24px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
            transition: transform 0.2s;
          "
          onmouseover="this.style.transform='scale(1.05)'"
          onmouseout="this.style.transform='scale(1)'"
        >
          Sign Out & Re-login
        </button>
        <button 
          onclick="document.getElementById('cookie-migration-banner').remove()"
          style="
            background: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
          "
          onmouseover="this.style.background='rgba(255,255,255,0.3)'"
          onmouseout="this.style.background='rgba(255,255,255,0.2)'"
        >
          Dismiss
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(banner);
}
