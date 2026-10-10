"use client"

import { useEffect, useState } from "react"
import { Download, TrendingUp, TrendingDown, Wallet, Landmark, HandCoins, Package, Pencil, Scale } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { PageShell, Stat, Empty, Field } from "@/components/accounting/page-shell"
import { DateRange } from "@/components/accounting/date-range"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FadeRow } from "@/components/motion/fade-row"
import { TableSkeleton } from "@/components/motion/table-skeleton"
import { useI18n } from "@/lib/i18n"
import { useChartAnimation, chartTooltipStyle } from "@/components/motion/chart-anim"
import { useToast } from "@/hooks/use-toast"
import { api, fmtMoney, fmtDate, fmtNum, todayStr, monthStartStr, downloadCSV } from "@/lib/acct-client"

function Line({ label, value, strong, neg, locale }: { label: string; value: number; strong?: boolean; neg?: boolean; locale: string }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${strong ? "border-t pt-2 font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className={`tabular-nums ${neg && value ? "text-negative" : ""}`}>{neg && value ? "−" : ""}{fmtMoney(Math.abs(value), locale)}</span>
    </div>
  )
}

export default function AccountingPage() {
  const { t, locale } = useI18n()
  const anim = useChartAnimation()
  const { toast } = useToast()
  const [from, setFrom] = useState(monthStartStr())
  const [to, setTo] = useState(todayStr())
  const [s, setS] = useState<any>(null)
  const [ledger, setLedger] = useState<any[]>([])
  const [onlyCash, setOnlyCash] = useState(false)
  const [credit, setCredit] = useState<any>(null)

  const load = () => {
    api("accounting/summary", { params: { from, to } }).then(setS).catch((e) => toast({ title: t("acct.error"), description: e.message, variant: "destructive" }))
    api("accounting/ledger", { params: { from, to } }).then((d: any) => setLedger(d.entries || [])).catch(() => setLedger([]))
  }
  useEffect(load, [from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveCredit = async () => {
    try {
      const existing: any = await api("client_accounts")
      const row = (existing.rows || []).find((r: any) => r.client_name === credit.client)
      const body = { client_name: credit.client, credit_limit: Number(credit.limit) || 0, payment_terms_days: Number(credit.terms) || 0 }
      if (row) await api("client_accounts", { method: "PUT", body: { id: row.id, ...body } })
      else await api("client_accounts", { method: "POST", body })
      toast({ title: t("acct.saved") }); setCredit(null); load()
    } catch (e: any) { toast({ title: t("acct.error"), description: e.message, variant: "destructive" }) }
  }

  const p = s?.pnl, c = s?.cash, ar = s?.receivables, ap = s?.payables
  const led = onlyCash ? ledger.filter((e) => e.cash) : ledger

  return (
    <PageShell title={t("acct.acc.title")} subtitle={t("acct.acc.subtitle")}
      actions={<DateRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt) }} />}>
      {!s ? <TableSkeleton rows={6} /> : (<>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat title={t("acct.acc.revenue")} value={fmtMoney(p.revenue, locale)} icon={TrendingUp} hint={t("acct.acc.revenueHint")} />
          <Stat title={t("acct.acc.costs")} value={fmtMoney(p.costs, locale)} icon={TrendingDown} hint={`${t("acct.acc.materials")} ${fmtMoney(p.materials, locale)} · ${t("acct.acc.labor")} ${fmtMoney(p.labor, locale)}`} />
          <Stat title={t("acct.acc.netProfit")} value={fmtMoney(p.net, locale)} tone={p.net >= 0 ? "good" : "bad"} icon={Scale} hint={p.margin !== null ? `${t("acct.acc.margin")} ${p.margin}%` : ""} />
          <Stat title={t("acct.acc.cashNet")} value={fmtMoney(c.net, locale)} tone={c.net >= 0 ? "good" : "bad"} icon={Wallet} hint={`${t("acct.acc.in")} ${fmtMoney(c.in, locale)} · ${t("acct.acc.out")} ${fmtMoney(c.out, locale)}`} />
          <Stat title={t("acct.acc.receivable")} value={fmtMoney(ar.total, locale)} tone={ar.total > 0 ? "warn" : "good"} icon={Landmark} hint={t("acct.acc.asOf") + " " + fmtDate(s.to, locale)} />
          <Stat title={t("acct.acc.payable")} value={fmtMoney(ap.total, locale)} icon={HandCoins} />
          <Stat title={t("acct.payrollOwed")} value={fmtMoney(s.payroll.owed, locale)} tone={s.payroll.owed > 0 ? "warn" : "good"} icon={HandCoins} />
          <Stat title={t("acct.mat.invValue")} value={fmtMoney(s.inventory.value, locale)} icon={Package} hint={s.inventory.lowStock ? `${s.inventory.lowStock} ${t("acct.mat.lowStock").toLowerCase()}` : ""} />
        </div>

        <Tabs defaultValue="pnl" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="pnl">{t("acct.acc.tabPnl")}</TabsTrigger>
            <TabsTrigger value="ar">{t("acct.acc.tabAr")}</TabsTrigger>
            <TabsTrigger value="ap">{t("acct.acc.tabAp")}</TabsTrigger>
            <TabsTrigger value="projects">{t("acct.acc.tabProjects")}</TabsTrigger>
            <TabsTrigger value="employees">{t("acct.acc.tabEmployees")}</TabsTrigger>
            <TabsTrigger value="ledger">{t("acct.acc.tabLedger")}</TabsTrigger>
          </TabsList>

          <TabsContent value="pnl" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>{t("acct.acc.pnlTitle")}</CardTitle><CardDescription>{fmtDate(s.from, locale)} → {fmtDate(s.to, locale)}</CardDescription></CardHeader>
                <CardContent className="text-sm">
                  <Line label={t("acct.acc.revenue")} value={p.revenue} locale={locale} />
                  <Line label={t("acct.acc.materials")} value={p.materials} neg locale={locale} />
                  <Line label={t("acct.acc.labor")} value={p.labor} neg locale={locale} />
                  {p.expensesByCategory.map((e: any) => <Line key={e.category} label={`${t("acct.acc.expense")}: ${t(`acct.cat.${e.category}`)}`} value={e.total} neg locale={locale} />)}
                  <Line label={t("acct.acc.netProfit")} value={p.net} strong neg={p.net < 0} locale={locale} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>{t("acct.acc.cashTitle")}</CardTitle><CardDescription>{t("acct.acc.cashHint")}</CardDescription></CardHeader>
                <CardContent className="text-sm">
                  <Line label={t("acct.acc.cashInPayments")} value={c.in} locale={locale} />
                  <Line label={t("acct.acc.outExpenses")} value={c.outExpenses} neg locale={locale} />
                  <Line label={t("acct.acc.outPurchases")} value={c.outPurchases} neg locale={locale} />
                  <Line label={t("acct.acc.outSuppliers")} value={c.outSuppliers} neg locale={locale} />
                  <Line label={t("acct.acc.outPayroll")} value={c.outPayroll} neg locale={locale} />
                  <Line label={t("acct.acc.cashNet")} value={c.net} strong neg={c.net < 0} locale={locale} />
                </CardContent>
              </Card>
            </div>
            {s.monthly.length > 0 && (
              <Card>
                <CardHeader><CardTitle>{t("acct.acc.byMonth")}</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={s.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} stroke="var(--border)" />
                      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} stroke="var(--border)" width={80} tickFormatter={(v) => fmtMoney(v, locale).replace(/\.00$/, "")} />
                      <Tooltip formatter={(v: any) => fmtMoney(v, locale)} contentStyle={chartTooltipStyle} cursor={{ fill: "var(--muted)" }} />
                      <Legend />
                      <Bar dataKey="revenue" name={t("acct.acc.revenue")} fill="var(--positive)" radius={[4, 4, 0, 0]} {...anim} />
                      <Bar dataKey="costs" name={t("acct.acc.costs")} fill="var(--negative)" radius={[4, 4, 0, 0]} {...anim} />
                      <Bar dataKey="cashIn" name={t("acct.acc.in")} fill="var(--chart-2)" radius={[4, 4, 0, 0]} {...anim} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ar" className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(["current", "d1_30", "d31_60", "d61_90", "d90p"] as const).map((k) => (
                <Stat key={k} title={t(`acct.aging.${k}`)} value={fmtMoney(ar.aging[k], locale)} tone={k === "current" ? undefined : ar.aging[k] > 0 ? (k === "d90p" || k === "d61_90" ? "bad" : "warn") : undefined} />
              ))}
            </div>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div><CardTitle>{t("acct.acc.byClient")}</CardTitle><CardDescription>{t("acct.acc.creditHint")}</CardDescription></div>
                <Button size="sm" variant="outline" onClick={() => downloadCSV(`cuentas-por-cobrar-${s.to}.csv`, ar.clients, [
                  { key: "client", label: t("acct.client") }, { key: "invoiced", label: t("acct.acc.invoiced") }, { key: "paid", label: t("acct.acc.paid") }, { key: "balance", label: t("acct.balance") },
                  { key: "current", label: t("acct.aging.current") }, { key: "d1_30", label: "1-30" }, { key: "d31_60", label: "31-60" }, { key: "d61_90", label: "61-90" }, { key: "d90p", label: "90+" },
                  { key: "creditLimit", label: t("acct.acc.creditLimit") }, { key: "availableCredit", label: t("acct.acc.available") },
                ])}><Download className="mr-2 h-4 w-4" />CSV</Button>
              </CardHeader>
              <CardContent className="px-0 sm:px-6">
                {ar.clients.length === 0 ? <Empty text={t("acct.acc.noReceivables")} /> : (
                  <div className="overflow-x-auto"><Table>
                    <TableHeader><TableRow>
                      <TableHead>{t("acct.client")}</TableHead><TableHead className="hidden md:table-cell text-right">{t("acct.acc.invoiced")}</TableHead>
                      <TableHead className="hidden md:table-cell text-right">{t("acct.acc.paid")}</TableHead><TableHead className="text-right">{t("acct.balance")}</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">1-30</TableHead><TableHead className="hidden lg:table-cell text-right">31-60</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">61-90</TableHead><TableHead className="hidden lg:table-cell text-right">90+</TableHead>
                      <TableHead className="text-right">{t("acct.acc.credit")}</TableHead><TableHead className="w-10" />
                    </TableRow></TableHeader>
                    <TableBody>{ar.clients.map((r: any, __i: number) => (
                      <FadeRow index={__i} key={r.client}>
                        <TableCell><div className="font-medium">{r.client}</div><div className="text-xs text-muted-foreground">{r.invoices} {t("acct.acc.invoicesShort")} · {t("acct.mat.terms")} {r.termsDays}{t("acct.daysShort")}</div></TableCell>
                        <TableCell className="hidden md:table-cell text-right tabular-nums">{fmtMoney(r.invoiced, locale)}</TableCell>
                        <TableCell className="hidden md:table-cell text-right tabular-nums">{fmtMoney(r.paid, locale)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{fmtMoney(r.balance, locale)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-right tabular-nums">{r.d1_30 ? fmtMoney(r.d1_30, locale) : "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell text-right tabular-nums">{r.d31_60 ? fmtMoney(r.d31_60, locale) : "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell text-right tabular-nums text-negative">{r.d61_90 ? fmtMoney(r.d61_90, locale) : "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell text-right tabular-nums text-negative">{r.d90p ? fmtMoney(r.d90p, locale) : "—"}</TableCell>
                        <TableCell className="text-right text-xs">{r.creditLimit > 0 ? <><div className="tabular-nums">{fmtMoney(r.creditLimit, locale)}</div>{r.overLimit ? <Badge variant="destructive">{t("acct.acc.overLimit")}</Badge> : <span className="text-muted-foreground">{t("acct.acc.available")} {fmtMoney(r.availableCredit, locale)}</span>}</> : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell><Button size="icon" variant="ghost" aria-label={t("acct.edit")} onClick={() => setCredit({ client: r.client, limit: String(r.creditLimit || ""), terms: String(r.termsDays ?? 30) })}><Pencil className="h-4 w-4" /></Button></TableCell>
                      </FadeRow>
                    ))}</TableBody>
                    <TableFooter><TableRow><TableCell>{t("acct.total")}</TableCell><TableCell className="hidden md:table-cell" /><TableCell className="hidden md:table-cell" /><TableCell className="text-right">{fmtMoney(ar.total, locale)}</TableCell><TableCell colSpan={6} className="hidden lg:table-cell" /></TableRow></TableFooter>
                  </Table></div>
                )}
              </CardContent>
            </Card>
            {ar.openInvoices.length > 0 && (
              <Card>
                <CardHeader><CardTitle>{t("acct.acc.openInvoices")}</CardTitle></CardHeader>
                <CardContent className="px-0 sm:px-6"><div className="overflow-x-auto"><Table>
                  <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t("acct.client")}</TableHead><TableHead className="hidden sm:table-cell">{t("acct.due")}</TableHead><TableHead className="text-right">{t("acct.balance")}</TableHead><TableHead className="text-right">{t("acct.acc.daysLate")}</TableHead></TableRow></TableHeader>
                  <TableBody>{ar.openInvoices.map((i: any, __i: number) => (
                    <FadeRow index={__i} key={i.id}>
                      <TableCell>INV-{i.id}</TableCell><TableCell>{i.client}<div className="text-xs text-muted-foreground">{i.project}</div></TableCell>
                      <TableCell className="hidden sm:table-cell">{fmtDate(i.due, locale)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(i.balance, locale)}<div className="text-[10px] text-muted-foreground">{t("acct.of")} {fmtMoney(i.amount, locale)}</div></TableCell>
                      <TableCell className="text-right">{i.daysLate > 0 ? <Badge variant={i.daysLate > 60 ? "destructive" : "secondary"}>{i.daysLate}</Badge> : <span className="text-muted-foreground">0</span>}</TableCell>
                    </FadeRow>
                  ))}</TableBody>
                </Table></div></CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ap">
            <Card>
              <CardHeader><CardTitle>{t("acct.acc.payablesTitle")}</CardTitle><CardDescription>{t("acct.acc.payablesHint")}</CardDescription></CardHeader>
              <CardContent className="px-0 sm:px-6">
                {ap.suppliers.length === 0 ? <Empty text={t("acct.mat.noSuppliers")} /> : (
                  <div className="overflow-x-auto"><Table>
                    <TableHeader><TableRow><TableHead>{t("acct.mat.supplier")}</TableHead><TableHead className="text-right">{t("acct.acc.creditPurchases")}</TableHead><TableHead className="text-right">{t("acct.acc.paid")}</TableHead><TableHead className="text-right">{t("acct.balance")}</TableHead><TableHead className="hidden sm:table-cell">{t("acct.acc.nextDue")}</TableHead></TableRow></TableHeader>
                    <TableBody>{ap.suppliers.map((r: any, __i: number) => (
                      <FadeRow index={__i} key={r.id}><TableCell className="font-medium">{r.name}</TableCell><TableCell className="text-right tabular-nums">{fmtMoney(r.credit_purchases, locale)}</TableCell><TableCell className="text-right tabular-nums">{fmtMoney(r.payments, locale)}</TableCell><TableCell className={`text-right font-semibold tabular-nums`}>{fmtMoney(r.balance, locale)}</TableCell><TableCell className="hidden sm:table-cell">{r.balance > 0 && r.next_due ? fmtDate(r.next_due, locale) : "—"}</TableCell></FadeRow>
                    ))}</TableBody>
                    <TableFooter><TableRow><TableCell colSpan={3}>{t("acct.total")}</TableCell><TableCell className="text-right">{fmtMoney(ap.total, locale)}</TableCell><TableCell className="hidden sm:table-cell" /></TableRow></TableFooter>
                  </Table></div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div><CardTitle>{t("acct.acc.projectsTitle")}</CardTitle><CardDescription>{t("acct.acc.projectsHint")}</CardDescription></div>
                <Button size="sm" variant="outline" onClick={() => downloadCSV(`rentabilidad-proyectos-${s.from}-${s.to}.csv`, s.projects, [
                  { key: "name", label: t("acct.project") }, { key: "client", label: t("acct.client") }, { key: "budget", label: t("acct.acc.budget") }, { key: "invoiced", label: t("acct.acc.invoiced") },
                  { key: "collected", label: t("acct.acc.collected") }, { key: "materials", label: t("acct.acc.materials") }, { key: "labor", label: t("acct.acc.labor") }, { key: "labor_days", label: t("acct.days") },
                  { key: "expenses", label: t("acct.acc.expense") }, { key: "profit", label: t("acct.acc.profit") }, { key: "margin", label: "%" },
                ])}><Download className="mr-2 h-4 w-4" />CSV</Button>
              </CardHeader>
              <CardContent className="px-0 sm:px-6">
                {s.projects.length === 0 ? <Empty text={t("acct.acc.noProjects")} /> : (
                  <div className="overflow-x-auto"><Table>
                    <TableHeader><TableRow>
                      <TableHead>{t("acct.project")}</TableHead><TableHead className="text-right">{t("acct.acc.invoiced")}</TableHead>
                      <TableHead className="hidden md:table-cell text-right">{t("acct.acc.materials")}</TableHead><TableHead className="hidden md:table-cell text-right">{t("acct.acc.labor")}</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">{t("acct.acc.expense")}</TableHead><TableHead className="text-right">{t("acct.acc.profit")}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{s.projects.map((r: any, __i: number) => (
                      <FadeRow index={__i} key={r.id}>
                        <TableCell><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.client || ""}{r.budget ? ` · ${t("acct.acc.budget")} ${fmtMoney(r.budget, locale)}` : ""}</div></TableCell>
                        <TableCell className="text-right tabular-nums">{fmtMoney(r.invoiced, locale)}<div className="text-[10px] text-muted-foreground">{t("acct.acc.collected")} {fmtMoney(r.collected, locale)}</div></TableCell>
                        <TableCell className="hidden md:table-cell text-right tabular-nums">{fmtMoney(r.materials, locale)}</TableCell>
                        <TableCell className="hidden md:table-cell text-right tabular-nums">{fmtMoney(r.labor, locale)}<div className="text-[10px] text-muted-foreground">{fmtNum(r.labor_days)} {t("acct.daysShort")}</div></TableCell>
                        <TableCell className="hidden lg:table-cell text-right tabular-nums">{fmtMoney(r.expenses, locale)}</TableCell>
                        <TableCell className={`text-right font-semibold tabular-nums ${r.profit < 0 ? "text-negative" : "text-positive"}`}>{fmtMoney(r.profit, locale)}{r.margin !== null && <div className="text-[10px] font-normal text-muted-foreground">{r.margin}%</div>}</TableCell>
                      </FadeRow>
                    ))}</TableBody>
                  </Table></div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employees">
            <Card>
              <CardHeader><CardTitle>{t("acct.acc.employeesTitle")}</CardTitle><CardDescription>{t("acct.pay.formula")}</CardDescription></CardHeader>
              <CardContent className="px-0 sm:px-6"><div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>{t("acct.employee")}</TableHead><TableHead className="text-right">{t("acct.days")}</TableHead><TableHead className="text-right">{t("acct.earned")}</TableHead><TableHead className="hidden sm:table-cell text-right">{t("acct.pay.paidAdv")}</TableHead><TableHead className="text-right">{t("acct.owed")}</TableHead></TableRow></TableHeader>
                <TableBody>{s.payroll.employees.map((e: any, __i: number) => (
                  <FadeRow index={__i} key={e.id}><TableCell className="font-medium">{e.name}</TableCell><TableCell className="text-right tabular-nums">{fmtNum(e.days)}</TableCell><TableCell className="text-right tabular-nums">{fmtMoney(e.earned + e.bonus - e.deduction, locale)}</TableCell><TableCell className="hidden sm:table-cell text-right tabular-nums">{fmtMoney(e.paid + e.advance, locale)}</TableCell><TableCell className="text-right font-semibold tabular-nums">{fmtMoney(e.owed_total, locale)}</TableCell></FadeRow>
                ))}</TableBody>
              </Table></div></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ledger">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div><CardTitle>{t("acct.acc.ledgerTitle")}</CardTitle><CardDescription>{t("acct.acc.ledgerHint")}</CardDescription></div>
                <div className="flex gap-2">
                  <Button size="sm" variant={onlyCash ? "default" : "outline"} onClick={() => setOnlyCash(!onlyCash)}>{t("acct.acc.onlyCash")}</Button>
                  <Button size="sm" variant="outline" onClick={() => downloadCSV(`libro-diario-${s.from}-${s.to}.csv`, led.map((e) => ({ ...e, kind: t(`acct.kind.${e.kind}`), cash: e.cash ? "1" : "0" })), [
                    { key: "date", label: t("acct.date") }, { key: "kind", label: t("acct.type") }, { key: "party", label: t("acct.acc.party") }, { key: "project", label: t("acct.project") },
                    { key: "description", label: t("acct.description") }, { key: "income", label: t("acct.acc.in") }, { key: "expense", label: t("acct.acc.out") }, { key: "cash", label: "cash" }, { key: "cashBalance", label: t("acct.balance") },
                  ])}><Download className="mr-2 h-4 w-4" />CSV</Button>
                </div>
              </CardHeader>
              <CardContent className="px-0 sm:px-6">
                {led.length === 0 ? <Empty text={t("acct.acc.noMovements")} /> : (
                  <div className="max-h-[600px] overflow-auto"><Table>
                    <TableHeader><TableRow><TableHead>{t("acct.date")}</TableHead><TableHead>{t("acct.type")}</TableHead><TableHead className="hidden md:table-cell">{t("acct.description")}</TableHead><TableHead className="text-right">{t("acct.acc.in")}</TableHead><TableHead className="text-right">{t("acct.acc.out")}</TableHead><TableHead className="hidden sm:table-cell text-right">{t("acct.acc.cashBalance")}</TableHead></TableRow></TableHeader>
                    <TableBody>{led.map((e, i) => (
                      <FadeRow index={i} key={i} className={e.cash ? "" : "text-muted-foreground"}>
                        <TableCell className="whitespace-nowrap">{fmtDate(e.date, locale)}</TableCell>
                        <TableCell><Badge variant={e.cash ? "default" : "outline"} className="whitespace-nowrap">{t(`acct.kind.${e.kind}`)}</Badge><div className="text-xs md:hidden">{e.party}</div></TableCell>
                        <TableCell className="hidden md:table-cell"><div>{e.description}</div><div className="text-xs text-muted-foreground">{[e.party, e.project].filter(Boolean).join(" · ")}</div></TableCell>
                        <TableCell className="text-right tabular-nums text-positive">{e.income ? fmtMoney(e.income, locale) : ""}</TableCell>
                        <TableCell className="text-right tabular-nums text-negative">{e.expense ? fmtMoney(e.expense, locale) : ""}</TableCell>
                        <TableCell className="hidden sm:table-cell text-right tabular-nums">{e.cash ? fmtMoney(e.cashBalance, locale) : ""}</TableCell>
                      </FadeRow>
                    ))}</TableBody>
                  </Table></div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </>)}

      <Dialog open={!!credit} onOpenChange={(o) => !o && setCredit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("acct.acc.creditTitle")}</DialogTitle><DialogDescription>{credit?.client}</DialogDescription></DialogHeader>
          {credit && <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("acct.acc.creditLimit") + " (USD)"}><Input type="number" min="0" step="0.01" value={credit.limit} onChange={(e) => setCredit({ ...credit, limit: e.target.value })} /></Field>
            <Field label={t("acct.mat.terms") + ` (${t("acct.daysShort")})`}><Input type="number" min="0" value={credit.terms} onChange={(e) => setCredit({ ...credit, terms: e.target.value })} /></Field>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setCredit(null)}>{t("acct.cancel")}</Button><Button onClick={saveCredit}>{t("acct.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
