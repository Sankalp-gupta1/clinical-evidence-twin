'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Something didn’t load.</h1>
      <p>Your original records are safe. Try opening the workspace again.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
