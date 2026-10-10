"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Mail, Lock, Loader2, Check } from "lucide-react"
import * as m from "motion/react-m"
import { useAuthStore } from "@/lib/auth-store"
import { useI18n } from "@/lib/i18n"
import { LanguageToggle } from "@/components/language-toggle"

export default function LoginForm({ allowRegister = false }: { allowRegister?: boolean }) {
  const router = useRouter()
  const { login } = useAuthStore()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const { t } = useI18n()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const success = await login(email, password)

      if (success) {
        { const next = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null; router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/") }
      } else {
        setError(t("login.error.invalid"))
      }
    } catch (err) {
      setError(t("login.error.generic"))
    } finally {
      setIsLoading(false)
    }
  }

  const points = [t("login.brand.point1"), t("login.brand.point2"), t("login.brand.point3")]

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel: ink + canvas, slow drifting shapes (transform only, off with reduced motion) */}
      <aside className="relative hidden overflow-hidden bg-[#171715] text-[#f3f2ee] lg:flex lg:flex-col lg:justify-between lg:p-12" aria-hidden="true">
        <div className="pointer-events-none absolute inset-0">
          <div className="pp-drift absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-[#f3f2ee]/[0.06] blur-3xl" />
          <div className="pp-drift-slow absolute -bottom-32 right-[-10%] h-[520px] w-[520px] rounded-full bg-[#d9d7cf]/[0.07] blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#f3f2ee_1px,transparent_1px),linear-gradient(90deg,#f3f2ee_1px,transparent_1px)] [background-size:56px_56px]" />
        </div>
        <div className="relative">
          <div className="inline-flex rounded-lg bg-[#f3f2ee] px-3 py-2">
            <Image src="/logo.png" alt="" width={140} height={48} className="h-8 w-auto" priority />
          </div>
        </div>
        <div className="relative max-w-md space-y-6">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">{t("login.brand.title")}</h2>
          <p className="text-base text-[#f3f2ee]/70">{t("login.brand.tagline")}</p>
          <ul className="space-y-3 text-sm text-[#f3f2ee]/85">
            {points.map((p, i) => (
              <m.li key={p} className="flex items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.15 + i * 0.06 }}>
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#f3f2ee]/25"><Check className="h-3.5 w-3.5" /></span>
                {p}
              </m.li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-[#f3f2ee]/50">© {new Date().getFullYear()} Paint Power</p>
      </aside>

      <main className="relative flex items-center justify-center p-4 sm:p-6 lg:p-12">
        <div className="absolute right-3 top-3 sm:right-6 sm:top-6">
          <LanguageToggle />
        </div>
        <m.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="mb-6 text-center sm:mb-8 lg:text-left">
            <div className="mb-4 flex justify-center lg:hidden">
              <Image src="/logo.png" alt="Paint Power" width={180} height={60} className="h-10 w-auto sm:h-12" priority />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("login.welcome")}</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2 sm:text-base">{t("login.subtitle")}</p>
          </div>

          <Card className="border-border shadow-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl sm:text-2xl">{t("login.title")}</CardTitle>
              <CardDescription className="text-sm">{t("login.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                    <Alert variant="destructive" className="text-sm">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </m.div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm">{t("login.email")}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="correo@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-10 pl-10 sm:h-11"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm">{t("login.password")}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder={t("login.passwordPlaceholder")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 pl-10 pr-10 sm:h-11"
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      disabled={isLoading}
                      aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("login.forgotHint")}</p>
                </div>

                <Button type="submit" variant="brand" className="h-10 w-full sm:h-11" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("login.submitting")}
                    </>
                  ) : (
                    t("login.submit")
                  )}
                </Button>
              </form>
            </CardContent>
            {allowRegister && (
              <CardFooter className="flex flex-col space-y-4 pt-0">
                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">{t("login.or")}</span>
                  </div>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  {t("login.noAccount")}{" "}
                  <Link href="/register" prefetch={false} className="font-medium text-foreground underline-offset-4 hover:underline">
                    {t("login.signup")}
                  </Link>
                </p>
              </CardFooter>
            )}
          </Card>
        </m.div>
      </main>
    </div>
  )
}
