"use client"

import { useEffect, useState } from "react"
import { Download, HandCoins, Trash2, Wallet, CalendarDays, Users } from "lucide-react"
import { PageShell, Stat, Empty, Field } from "@/components/accounting/page-shell"
import { DateRange } from "@/components/accounting/date-range"
import { LegacyProjectPayroll } from "@/components/accounting/legacy-project-payroll"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FadeRow } from "@/components/motion/fade-row"
import { TableSkeleton } from "@/components/motion/table-skeleton"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/hooks/use-toast"
import { api, useResource, fmtMoney, fmtNum, fmtDate, todayStr, monthStartStr, downloadCSV, PAYMENT_METHODS } from "@/lib/acct-client"

export default function PayrollPage() {
  const { t, locale } = useI18n()
  const { toast } = useToast()
  const [from, setFrom] = useState(monthStartStr())
  const [to, setTo] = useState(todayStr())
  const [summary, setSummary] = useState<any>(null)
  const pays = useResource<any>("employee_payments", { from, to })
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({ employee_id: "", pay_date: todayStr(), type: "payment", amount: "", method: "cash", notes: "" })

  const load = () => api("accounting/summary", { params: { from, to } }).then(setSummary).catch((e) => toast({ title: t("acct.error"), description: e.message, variant: "destructive" }))
  useEffect(() => { load() }, [from, to, pays.rows.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const emps: any[] = (summary?.payroll?.employees || []).filter((e: any) => e.entries > 0 || e.owed_total !== 0 || e.status === "active")
  const tot = (k: string) => emps.reduce((s, e) => s + Number(e[k] || 0), 0)

  const openPay = (e: any) => {
    setForm({ employee_id: String(e.id), pay_date: todayStr(), type: "payment", amount: e.owed_total > 0 ? String(e.owed_total) : "", method: "cash", notes: `${t("acct.pay.period")} ${from} → ${to}`, period_start: from, period_end: to })
    setOpen(true)
  }
  const save = async () => {
    if (!form.employee_id || !(Number(form.amount) > 0)) return toast({ title: t("acct.required"), description: t("acct.amount"), variant: "destructive" })
    try {
      await pays.create({ ...form, employee_id: Number(form.employee_id), amount: Number(form.amount) })
      toast({ title: t("acct.saved") })
      setOpen(false)
    } catch (e: any) { toast({ title: t("acct.error"), description: e.message, variant: "destructive" }) }
  }
  const del = async (id: number) => {
    if (!confirm(t("acct.confirmDelete"))) return
    try { await pays.remove(id) } catch (e: any) { toast({ title: t("acct.error"), description: e.message, variant: "destructive" }) }
  }

  return (
    <PageShell
      title={t("admin.payroll.title")}
      subtitle={t("acct.pay.subtitle")}
      actions={
        <Button variant="outline" onClick={() => downloadCSV(`nomina-${from}-${to}.csv`, emps, [
          { key: "name", label: t("acct.employee") }, { key: "days", label: t("acct.days") }, { key: "hours", label: t("acct.hours") },
          { key: "earned", label: t("acct.earned") }, { key: "bonus", label: t("acct.pay.type.bonus") }, { key: "deduction", label: t("acct.pay.type.deduction") },
          { key: "paid", label: t("acct.pay.type.payment") }, { key: "advance", label: t("acct.pay.type.advance") },
          { key: "period_net", label: t("acct.pay.periodNet") }, { key: "owed_total", label: t("acct.owed") },
        ])}><Download className="mr-2 h-4 w-4" />CSV</Button>
      }
    >
      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="attendance">{t("acct.pay.tabAttendance")}</TabsTrigger>
          <TabsTrigger value="payments">{t("acct.pay.tabPayments")}</TabsTrigger>
          <TabsTrigger value="legacy">{t("acct.pay.tabLegacy")}</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat title={t("acct.att.peopleWorked")} value={emps.filter((e) => e.entries > 0).length} icon={Users} />
            <Stat title={t("acct.daysWorkedPeriod")} value={fmtNum(tot("days"))} icon={CalendarDays} />
            <Stat title={t("acct.earnedPeriod")} value={fmtMoney(tot("earned") + tot("bonus") - tot("deduction"), locale)} icon={Wallet} />
            <Stat title={t("acct.payrollOwed")} value={fmtMoney(summary?.payroll?.owed || 0, locale)} tone={(summary?.payroll?.owed || 0) > 0 ? "warn" : "good"} icon={HandCoins} hint={t("acct.pay.owedHint")} />
          </div>
          <Card>
            <CardHeader><DateRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt) }} /></CardHeader>
            <CardContent className="px-0 sm:px-6">
              {emps.length === 0 ? (summary ? <Empty text={t("acct.emp.empty")} /> : <TableSkeleton />) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t("acct.employee")}</TableHead>
                      <TableHead className="text-right">{t("acct.days")}</TableHead>
                      <TableHead className="hidden sm:table-cell text-right">{t("acct.hours")}</TableHead>
                      <TableHead className="text-right">{t("acct.earned")}</TableHead>
                      <TableHead className="hidden md:table-cell text-right">{t("acct.pay.paidAdv")}</TableHead>
                      <TableHead className="text-right">{t("acct.owed")}</TableHead>
                      <TableHead />
                    </TableRow></TableHeader>
                    <TableBody>
                      {emps.map((e, __i: number) => (
                        <FadeRow index={__i} key={e.id}>
                          <TableCell><div className="font-medium">{e.name}</div><div className="text-xs text-muted-foreground">{fmtMoney(e.pay_rate, locale)}/{e.pay_type === "hourly" ? t("acct.perHourShort") : t("acct.perDayShort")}</div></TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(e.days)}</TableCell>
                          <TableCell className="hidden sm:table-cell text-right tabular-nums">{fmtNum(e.hours)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtMoney(e.earned + e.bonus - e.deduction, locale)}</TableCell>
                          <TableCell className="hidden md:table-cell text-right tabular-nums">{fmtMoney(e.paid + e.advance, locale)}</TableCell>
                          <TableCell className={`text-right font-semibold tabular-nums ${e.owed_total > 0 ? "" : e.owed_total < 0 ? "text-negative" : ""}`}>{fmtMoney(e.owed_total, locale)}</TableCell>
                          <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => openPay(e)}><HandCoins className="mr-1 h-4 w-4" />{t("acct.pay.register")}</Button></TableCell>
                        </FadeRow>
                      ))}
                    </TableBody>
                    <TableFooter><TableRow>
                      <TableCell>{t("acct.total")}</TableCell>
                      <TableCell className="text-right">{fmtNum(tot("days"))}</TableCell>
                      <TableCell className="hidden sm:table-cell text-right">{fmtNum(tot("hours"))}</TableCell>
                      <TableCell className="text-right">{fmtMoney(tot("earned") + tot("bonus") - tot("deduction"), locale)}</TableCell>
                      <TableCell className="hidden md:table-cell text-right">{fmtMoney(tot("paid") + tot("advance"), locale)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(tot("owed_total"), locale)}</TableCell>
                      <TableCell />
                    </TableRow></TableFooter>
                  </Table>
                  <p className="px-3 pt-2 text-xs text-muted-foreground sm:px-0">{t("acct.pay.formula")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader><DateRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt) }} /></CardHeader>
            <CardContent className="px-0 sm:px-6">
              {pays.rows.length === 0 ? <Empty text={t("acct.pay.empty")} /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t("acct.date")}</TableHead><TableHead>{t("acct.employee")}</TableHead><TableHead>{t("acct.type")}</TableHead>
                      <TableHead className="hidden md:table-cell">{t("acct.method")}</TableHead><TableHead className="text-right">{t("acct.amount")}</TableHead><TableHead className="w-10" />
                    </TableRow></TableHeader>
                    <TableBody>
                      {pays.rows.map((p, __i: number) => (
                        <FadeRow index={__i} key={p.id}>
                          <TableCell className="whitespace-nowrap">{fmtDate(p.pay_date, locale)}</TableCell>
                          <TableCell><div className="font-medium">{p.employee_name}</div>{p.notes && <div className="text-xs text-muted-foreground">{p.notes}</div>}</TableCell>
                          <TableCell><Badge variant={p.type === "payment" ? "default" : p.type === "advance" ? "secondary" : "outline"}>{t(`acct.pay.type.${p.type}`)}</Badge></TableCell>
                          <TableCell className="hidden md:table-cell">{p.method ? t(`acct.method.${p.method}`) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtMoney(p.amount, locale)}</TableCell>
                          <TableCell><Button size="icon" variant="ghost" aria-label={t("acct.delete")} onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                        </FadeRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legacy"><LegacyProjectPayroll /></TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("acct.pay.register")}</DialogTitle>
            <DialogDescription>{emps.find((e) => String(e.id) === form.employee_id)?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("acct.type")}>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["payment", "advance", "bonus", "deduction"].map((k) => <SelectItem key={k} value={k}>{t(`acct.pay.type.${k}`)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label={t("acct.date")}><Input type="date" value={form.pay_date} onChange={(e) => setForm({ ...form, pay_date: e.target.value })} /></Field>
            <Field label={t("acct.amount") + " (USD)"}><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label={t("acct.method")}>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{t(`acct.method.${m}`)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label={t("acct.notes")} className="sm:col-span-2"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("acct.cancel")}</Button>
            <Button onClick={save}>{t("acct.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
