'use client'

import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-black text-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <Link href="/" className="font-serif text-xl font-bold">
              Lost London
            </Link>
            <p className="text-gray-400 text-sm mt-1">
              AI voice guide to London history
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
            <Link href="/" className="hover:text-white transition-colors">Talk to VIC</Link>
            <Link href="/profile" className="hover:text-white transition-colors">Profile</Link>
          </nav>
        </div>
        <div className="border-t border-gray-800 mt-6 pt-6 text-center text-xs text-gray-500">
          <p>
            Original articles by Vic Keegan from{' '}
            <a href="https://lost.london" className="underline hover:text-gray-300" target="_blank" rel="noopener noreferrer">lost.london</a>
          </p>
        </div>
      </div>
    </footer>
  )
}
