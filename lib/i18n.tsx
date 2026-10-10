"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

type Locale = "en" | "es"

const translations: Record<Locale, Record<string, string>> = {
  en: require("../locales/en.json"),
  es: require("../locales/es.json"),
}

interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string, fallback?: string) => string
  tBoth: (key: string) => string
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Use a stable server/client initial value to avoid hydration mismatches.
  // Start with 'en' for SSR safety, then on client mount read localStorage
  // and switch to stored locale or the preferred default ('es').
  const [locale, setLocale] = useState<Locale>("es") // es is the app default (avoids an English first paint)

  useEffect(() => {
    try {
      const stored = (localStorage.getItem("pp_locale") as Locale) || null
      if (stored) {
        setLocale(stored)
      } else {
        // prefer Spanish by default for first-time visitors
        setLocale("es")
        try {
          localStorage.setItem("pp_locale", "es")
        } catch (e) {}
      }
    } catch (e) {
      // ignore
    }
  }, [])

  useEffect(() => {
    try { document.documentElement.lang = locale } catch (e) {}
  }, [locale])

  const t = (key: string, fallback?: string) => {
    const val = translations[locale] && (translations[locale] as any)[key]
    if (typeof val === "string") return val
    // fallback to english
    return (translations["en"] as any)[key] || fallback || key
  }

  const tBoth = (key: string) => {
    const primary = (translations[locale] && (translations[locale] as any)[key]) || null
    const otherLocale: Locale = locale === 'en' ? 'es' : 'en'
    const other = (translations[otherLocale] && (translations[otherLocale] as any)[key]) || null
    const primaryText = typeof primary === 'string' ? primary : ((translations['en'] as any)[key] || key)
    const otherText = typeof other === 'string' ? other : ((translations['es'] as any)[key] || key)
    if (primaryText === otherText) return primaryText
    // show primary then other in parentheses
    if (locale === 'es') return `${primaryText} — ${otherText}`
    return `${primaryText} — ${otherText}`
  }

  return <I18nContext.Provider value={{ locale, setLocale, t, tBoth }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider")
  return ctx
}
