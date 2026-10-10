"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Users, Briefcase, TrendingUp } from "lucide-react"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { PipelineOverview } from "@/components/dashboard/pipeline-overview"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { UpcomingTasks } from "@/components/dashboard/upcoming-tasks"
import { MainLayout } from "@/components/main-layout"
import { useDataStore } from "@/lib/data-store"
import { useI18n } from "@/lib/i18n"
import { AuthGuard } from "@/components/auth-guard"
import { FinanceSummary } from "@/components/dashboard/finance-summary"
import { AnimatedNumber } from "@/components/motion/animated-number"
import { formatUSD } from "@/lib/money"

// Month key "YYYY-MM" from an ISO-ish date string (no timezone shifting).
const monthKey = (d?: string) => (typeof d === "string" && d.length >= 7 ? d.slice(0, 7) : "")

export default function DashboardPage() {
  const { t } = useI18n()
  const { leads, deals, contacts } = useDataStore()

  // Real comparisons only: this calendar month vs the previous one.
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`

  const won = deals.filter((d) => d.stage === "won")
  const revenueThis = won.filter((d) => monthKey(d.closeDate) === thisMonth).reduce((sum, d) => sum + (Number(d.value) || 0), 0)
  const revenuePrev = won.filter((d) => monthKey(d.closeDate) === prevMonth).reduce((sum, d) => sum + (Number(d.value) || 0), 0)
  const activeClients = contacts.filter((c) => c.status === "active").length
  const openDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost")
  const pipelineValue = openDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0)
  const leadsThis = leads.filter((l) => monthKey(l.createdAt) === thisMonth).length
  const leadsPrev = leads.filter((l) => monthKey(l.createdAt) === prevMonth).length

  // Percentage change only when the previous month has data; otherwise just state the previous value.
  const revenueDelta = revenuePrev > 0 ? ((revenueThis - revenuePrev) / revenuePrev) * 100 : null

  const stats = [
    {
      key: "revenue",
      title: t("dashboard.stat.revenue"),
      value: revenueThis,
      format: "usd" as const,
      note: t("dashboard.note.prevMonth").replace("{{value}}", formatUSD(revenuePrev)),
      delta: revenueDelta,
      icon: DollarSign,
    },
    {
      key: "clients",
      title: t("dashboard.stat.activeClients"),
      value: activeClients,
      format: "int" as const,
      note: t("dashboard.note.ofContacts").replace("{{count}}", String(contacts.length)),
      delta: null,
      icon: Users,
    },
    {
      key: "deals",
      title: t("dashboard.stat.activeDeals"),
      value: openDeals.length,
      format: "int" as const,
      note: t("dashboard.note.pipelineValue").replace("{{value}}", formatUSD(pipelineValue)),
      delta: null,
      icon: Briefcase,
    },
    {
      key: "leads",
      title: t("dashboard.stat.newLeads"),
      value: leadsThis,
      format: "int" as const,
      note: t("dashboard.note.prevMonthCount").replace("{{count}}", String(leadsPrev)),
      delta: null,
      icon: TrendingUp,
    },
  ]

  return (
    <AuthGuard>
      <MainLayout>
        <div className="p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">{t('dashboard.title')}</h2>
              <p className="text-sm text-muted-foreground sm:text-base">
                {t('dashboard.subtitle')}
              </p>
            </div>

            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => {
                const Icon = stat.icon
                return (
                  <Card key={stat.key} className="overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm line-clamp-2">
                        {stat.title}
                      </CardTitle>
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <AnimatedNumber value={stat.value} format={stat.format} className="block text-xl font-bold tracking-tight sm:text-2xl" />
                      <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                        {stat.delta !== null && (
                          <span className={stat.delta >= 0 ? "font-medium text-positive" : "font-medium text-negative"}>
                            {stat.delta >= 0 ? "▲" : "▼"} {Math.abs(stat.delta).toFixed(1)}%
                          </span>
                        )}
                        <span className="truncate">{stat.note}</span>
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <FinanceSummary />

            <div className="grid gap-4 sm:gap-6 lg:grid-cols-7">
              <div className="lg:col-span-4">
                <RevenueChart />
              </div>
              <div className="lg:col-span-3">
                <PipelineOverview />
              </div>
            </div>

            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
              <RecentActivity />
              <UpcomingTasks />
            </div>
          </div>
        </div>
      </MainLayout>
    </AuthGuard>
  )
}
