import NavBar from '../components/NavBar'

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Interview templates
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your question templates.
          </p>
        </div>
      </main>
    </div>
  )
}
