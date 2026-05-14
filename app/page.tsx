export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <main className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-700 bg-slate-900/90 p-12 shadow-2xl shadow-slate-950/30">
        <h1 className="text-4xl font-semibold">4DX Platform Backend</h1>
        <p className="mt-4 text-lg leading-8 text-slate-300">
          This service hosts the backend API for 4DX Platform.
        </p>
        <div className="mt-8 space-y-4 text-slate-200">
          <p>
            API root:{" "}
            <code className="rounded bg-slate-800 px-2 py-1">/api</code>
          </p>
          <p>
            TRPC endpoint:{" "}
            <code className="rounded bg-slate-800 px-2 py-1">/api/trpc</code>
          </p>
          <p>
            Health check:{" "}
            <code className="rounded bg-slate-800 px-2 py-1">/api/health</code>
          </p>
        </div>
      </main>
    </div>
  );
}
