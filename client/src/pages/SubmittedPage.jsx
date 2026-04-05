export default function SubmittedPage() {
  return (
    <div className="min-h-screen bg-[#f5f7fa] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center flex flex-col items-center gap-5">

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200
          flex items-center justify-center">
          <svg
            width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Message */}
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            You're all done!
          </h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Your responses have been submitted successfully.
            The team will review them and be in touch soon.
          </p>
        </div>

        {/* Brand */}
        <div className="flex items-center gap-2 pt-4">
          <div className="w-6 h-6 rounded-md bg-[#005ea4] flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-xs">R1</span>
          </div>
          <span className="text-sm font-bold text-slate-500 tracking-tight">RoundOne</span>
        </div>
      </div>
    </div>
  )
}
