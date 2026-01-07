'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { authClient } from '@/lib/auth/client'

// Book icon SVG component
function BookIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  )
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const { data: session } = authClient.useSession()

  return (
    <header className="sticky top-0 z-50 bg-stone-900 text-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo with book icon */}
          <Link href="/" className="flex items-center gap-2 group">
            <BookIcon className="w-6 h-6 text-amber-500 group-hover:text-amber-400 transition-colors" />
            <span className="text-xl font-serif font-bold">Lost London</span>
          </Link>

          {/* Right side - Auth buttons ALWAYS visible */}
          <div className="flex items-center gap-2">
            {/* Desktop nav links */}
            <nav className="hidden md:flex items-center gap-1 mr-4">
              <Link
                href="/"
                className={`px-3 py-2 text-sm transition-colors ${
                  pathname === '/'
                    ? 'text-white bg-white/10'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                Talk to VIC
              </Link>
              {session?.user && (
                <Link
                  href="/dashboard"
                  className={`px-3 py-2 text-sm transition-colors ${
                    pathname === '/dashboard'
                      ? 'text-white bg-white/10'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  My History
                </Link>
              )}
              <Link
                href="/profile"
                className={`px-3 py-2 text-sm transition-colors ${
                  pathname === '/profile'
                    ? 'text-white bg-white/10'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                My Profile
              </Link>
            </nav>

            {/* Auth - ALWAYS visible on all screen sizes */}
            {session?.user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    await authClient.signOut()
                    window.location.href = '/'
                  }}
                  className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Sign Out
                </button>
                <Link href="/profile">
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || 'User'}
                      className="w-8 h-8 rounded-full hover:ring-2 hover:ring-white/50 transition-all"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-sm font-medium">
                      {session.user.name?.[0] || session.user.email?.[0] || 'U'}
                    </div>
                  )}
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/sign-in"
                  className="px-4 py-2 text-sm font-medium bg-white text-black rounded hover:bg-gray-100 transition-colors"
                >
                  Sign In
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden ml-2 p-2 text-white hover:bg-white/10 rounded"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation dropdown */}
        {menuOpen && (
          <nav className="md:hidden py-3 border-t border-white/20">
            <Link
              href="/"
              className={`block px-4 py-2 ${pathname === '/' ? 'text-white bg-white/10' : 'text-gray-300'}`}
              onClick={() => setMenuOpen(false)}
            >
              Talk to VIC
            </Link>
            {session?.user && (
              <Link
                href="/dashboard"
                className={`block px-4 py-2 ${pathname === '/dashboard' ? 'text-white bg-white/10' : 'text-gray-300'}`}
                onClick={() => setMenuOpen(false)}
              >
                My History
              </Link>
            )}
            <Link
              href="/profile"
              className={`block px-4 py-2 ${pathname === '/profile' ? 'text-white bg-white/10' : 'text-gray-300'}`}
              onClick={() => setMenuOpen(false)}
            >
              My Profile
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
