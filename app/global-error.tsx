"use client";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html>
      <body style={{padding:24,fontFamily:"system-ui"}}>
        <h1>Something went wrong</h1>
        <pre style={{whiteSpace:"pre-wrap"}}>{error?.message || String(error)}</pre>
        <p>Try refresh. If it persists, check console for stack trace.</p>
      </body>
    </html>
  );
}