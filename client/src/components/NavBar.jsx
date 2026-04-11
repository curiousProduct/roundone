import { Link, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import supabase from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function NavBar() {
  const { user }     = useAuth()
  const { pathname } = useLocation()

  const templatesActive = pathname.startsWith('/templates')

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center
        justify-between gap-4">

        {/* Left: logo + nav links */}
        <div className="flex items-center gap-6">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 shrink-0"
          >
            <div className="w-7 h-7 rounded-lg bg-[#005ea4] flex items-center
              justify-center shadow-sm">
              <span className="text-white font-bold text-xs">R1</span>
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">RoundOne</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              to="/templates"
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors
                ${templatesActive
                  ? 'bg-[#e6f0f9] text-[#005ea4]'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
            >
              Templates
            </Link>
          </nav>
        </div>

        {/* Right: email + sign out */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-xs text-slate-400 truncate max-w-[200px]">
            {user?.email}
          </span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border
              border-slate-200 text-xs font-semibold text-slate-500
              hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            <LogOut size={12} />
            Sign out
          </button>
        </div>

      </div>
    </header>
  )
}
