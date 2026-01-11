"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body
        style={{

        }}
      >
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <h1 style={{ color: "#374151", marginBottom: "16px" }}>Something went wrong</h1>
          <p style={{ color: "#6b7280", marginBottom: "24px" }}>
            Please refresh the page or try again later.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{

            }}
          >
            Refresh Page
          </button>
        </div>
      </body>
    </html>
  );
}
