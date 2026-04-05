import { forwardRef } from 'react'

const Input = forwardRef(function Input({ label, error, hint, className = '', ...props }, ref) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-semibold text-slate-600">{label}</label>
      )}
      <input
        ref={ref}
        className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-gray-900 bg-slate-50
          placeholder-slate-400 outline-none transition-all
          focus:bg-white focus:border-[#005ea4] focus:ring-2 focus:ring-[#005ea4]/10
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-400/10' : 'border-slate-200'}
          ${className}`}
        {...props}
      />
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
})

export default Input
