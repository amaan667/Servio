"use client";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  // Don't render error UI for NEXT_REDIRECT errors
  if (error.message === 'NEXT_REDIRECT' || error.name === 'NEXT_REDIRECT') {
    return null;
  }

  return (
    <html>
      <body style={{padding:24,fontFamily:"system-ui",margin:0,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",backgroundColor:"#f9fafb"}}>
        <div style={{textAlign:"center",maxWidth:"400px"}}>
          <h1 style={{color:"#374151",marginBottom:"16px"}}>Something went wrong</h1>
          <p style={{color:"#6b7280",marginBottom:"24px"}}>Please refresh the page or try again later.</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              backgroundColor:"#8b5cf6",
              color:"white",
              border:"none",
              padding:"12px 24px",
              borderRadius:"8px",
              cursor:"pointer",
              fontSize:"14px"
            }}
          >
            Refresh Page
          </button>
        </div>
      </body>
    </html>
  );
}