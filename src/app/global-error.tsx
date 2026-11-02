'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: '#09090b', color: '#ededf0', fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 18 }}>Something went wrong</h1>
          <p style={{ color: '#a0a0ab', fontSize: 13 }}>An unexpected error occurred. Please try again.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: '8px 14px', borderRadius: 6, border: '1px solid #31313a', background: '#151519', color: '#ededf0' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
