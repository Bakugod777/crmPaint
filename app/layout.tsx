import type React from "react"
import type { Metadata } from "next"
// Removed next/font/google to avoid Turbopack internal font resolution errors
import { Analytics } from "@vercel/analytics/next"
import "@fontsource-variable/inter"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { I18nProvider } from "@/lib/i18n"
import { MotionProvider } from "@/components/motion/motion-provider"

// Inter is self-hosted via @fontsource-variable/inter (no remote font fetch at build time)

export const metadata: Metadata = {
  title: "Paint Power CRM - Manage Your Painting Business",
  description: "Professional CRM for managing painting projects, clients, and team",
  generator: "From paint Power",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <I18nProvider>
            <MotionProvider>{children}</MotionProvider>
          </I18nProvider>
        </ThemeProvider>
        {/* Vercel Analytics only exists on Vercel; elsewhere its script 404s and logs console errors. */}
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  )
}
