import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import "@copilotkit/react-ui/styles.css"
import "@neondatabase/neon-js/ui/css"
import { authClient } from '@/lib/auth/client'
import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react/ui'
import { CopilotWrapper } from '@/components/CopilotWrapper'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Lost London | Discover London's Hidden Stories",
  description: "Explore Vic Keegan's Lost London - 370+ articles about London's hidden history with VIC, your AI guide.",
  keywords: ["London history", "hidden London", "London walks", "London guide", "Vic Keegan", "Lost London"],
  authors: [{ name: "Vic Keegan" }],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-stone-50 text-gray-900`} suppressHydrationWarning>
        <NeonAuthUIProvider
          authClient={authClient}
          redirectTo="/"
          social={{ providers: ['google'] }}
        >
          <CopilotWrapper>
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </CopilotWrapper>
        </NeonAuthUIProvider>
      </body>
    </html>
  )
}
