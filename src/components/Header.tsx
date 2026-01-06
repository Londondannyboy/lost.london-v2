'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { authClient } from '@/lib/auth/client'

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const { data: session } = authClient.useSession()

  const navLinks = [
    { href: '/', label: 'Talk to VIC' },
    { href: '/profile', label: 'My Profile' },
  ]

  return (
    <header className="sticky top-0 z-50 bg-stone-900 text-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-serif font-bold">Lost London</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 relative z-50">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 text-sm transition-colors ${
                  pathname === link.href
                    ? 'text-white bg-white/10'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Auth - Sign In / User Menu */}
            {session?.user ? (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/20 relative z-50 pointer-events-auto">
                <button
                  onClick={async () => {
                    await authClient.signOut()
                    window.location.href = '/'
                  }}
                  className="px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer relative z-50"
                >
                  Sign Out
                </button>
                <Link href="/profile" className="relative z-50">
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || 'User'}
                      className="w-7 h-7 rounded-full cursor-pointer hover:ring-2 hover:ring-white/50 transition-all"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs cursor-pointer hover:bg-white/30 transition-colors">
                      {session.user.name?.[0] || session.user.email?.[0] || 'U'}
                    </div>
                  )}
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-1 ml-2 pl-2 border-l border-white/20">
                <Link
                  href="/auth/sign-in"
                  className="px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/sign-up"
                  className="px-3 py-2 text-sm bg-white text-black hover:bg-gray-200 transition-colors rounded"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile menu button - hamburger */}
          <button
            className="md:hidden p-2 text-white hover:bg-white/10 rounded"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <nav className="md:hidden py-4 border-t border-white/20">
            <div className="flex flex-col">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-3 text-base ${
                    pathname === link.href
                      ? 'text-white bg-white/10'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              {/* Mobile Auth */}
              <div className="border-t border-white/20 mt-2 pt-2">
                {session?.user ? (
                  <>
                    <Link
                      href="/profile"
                      className="block px-4 py-3 text-base text-white bg-white/5 hover:bg-white/10"
                      onClick={() => setMenuOpen(false)}
                    >
                      My Profile
                    </Link>
                    <div className="px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-gray-300">{session.user.email}</span>
                      <button
                        onClick={async () => {
                          setMenuOpen(false)
                          await authClient.signOut()
                          window.location.href = '/'
                        }}
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Sign Out
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2 px-4 py-3">
                    <Link
                      href="/auth/sign-in"
                      className="flex-1 text-center py-2 text-sm text-gray-300 border border-white/20 rounded hover:bg-white/5"
                      onClick={() => setMenuOpen(false)}
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/auth/sign-up"
                      className="flex-1 text-center py-2 text-sm bg-white text-black rounded hover:bg-gray-200"
                      onClick={() => setMenuOpen(false)}
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
