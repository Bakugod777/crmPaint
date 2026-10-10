"use client"

import { useMemo, useState } from "react"
import { Plus, Pencil, Search, Download, Users, Wallet, CalendarDays } from "lucide-react"
import { PageShell, Stat, Empty, Field } from "@/components/accounting/page-shell"
import { DateRange } from "@/components/accounting/date-range"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FadeRow } from "@/components/motion/fade-row"
import { TableSkeleton } from "@/components/motion/table-skeleton"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/hooks/use-toast"
import { useResource, api, fmtMoney, fmtNum, fmtDate, todayStr, monthStartStr, downloadCSV } from "@/lib/acct-client"
import { useEffect } from "react"

const blank = { id: 0, name: "", position: "", phone: "", email: "", document_id: "", pay_type: "daily", pay_rate: "", status: "active", start_date: todayStr(), notes: "" }

export default function EmployeesPage() {
  const { t, locale } = useI18n()
  const { toast } = useToast()
  const [from, setFrom] = useState(monthStartStr())
  const [to, setTo] = useState(todayStr())
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("active")
  const emp = useResource<any>("employees", { status })
  const [summary, setSummary] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>(blank)

  useEffect(() => {
    api("accounting/summary", { params: { from, to } }).then(setSummary).catch(() => setSummary(null))
  }, [from, to, emp.rows.length])

  const stats = useMemo(() => {
    const m: Record<number, any> = {}
    for (const e of summary?.payroll?.employees || []) m[e.id] = e
    return m
  }, [summary])

  const rows = emp.rows.filter((e) => !search || `${e.name} ${e.position || ""} ${e.phone || ""}`.toLowerCase().includes(search.toLowerCase()))

  const save = async () => {
    if (!form.name.trim()) return toast({ title: t("acct.required"), description: t("acct.emp.name"), variant: "destructive" })
    try {
      const body = { ...form, pay_rate: Number(form.pay_rate) || 0 }
      if (form.id) await emp.update(body)
      else await emp.create(body)
      toast({ title: t("acct.saved") })
      setOpen(false)
    } catch (e: any) {
      toast({ title: t("acct.error"), description: e.message, variant: "destructive" })
    }
  }

  const totDays = rows.reduce((s, e) => s + (stats[e.id]?.days || 0), 0)
  const totEarned = rows.reduce((s, e) => s + (stats[e.id]?.earned || 0), 0)
  const totOwed = rows.reduce((s, e) => s + Math.max(0, stats[e.id]?.owed_total || 0), 0)

  return (
    <PageShell
      title={t("acct.emp.title")}
      subtitle={t("acct.emp.subtitle")}
      actions={
        <>
          <Button variant="outline" onClick={() => downloadCSV(`empleados-${from}-${to}.csv`, rows.map((e) => ({ ...e, ...(stats[e.id] || {}) })), [
            { key: "name", label: t("acct.emp.name") }, { key: "position", label: t("acct.emp.position") }, { key: "pay_type", label: t("acct.emp.payType") },
            { key: "pay_rate", label: t("acct.emp.rate") }, { key: "days", label: t("acct.days") }, { key: "hours", label: t("acct.hours") },
            { key: "earned", label: t("acct.earned") }, { key: "owed_total", label: t("acct.owed") },
          ])}>
            <Download className="mr-2 h-4 w-4" />CSV
          </Button>
          <Button variant="brand" onClick={() => { setForm(blank); setOpen(true) }}><Plus className="mr-2 h-4 w-4" />{t("acct.emp.new")}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat title={t("acct.emp.active")} value={emp.rows.filter((e) => e.status === "active").length} icon={Users} />
        <Stat title={t("acct.daysWorkedPeriod")} value={fmtNum(totDays)} icon={CalendarDays} />
        <Stat title={t("acct.earnedPeriod")} value={fmtMoney(totEarned, locale)} icon={Wallet} />
        <Stat title={t("acct.payrollOwed")} value={fmtMoney(totOwed, locale)} tone={totOwed > 0 ? "warn" : "good"} icon={Wallet} />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <DateRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt) }} />
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="h-9 w-full pl-9 sm:w-56" placeholder={t("acct.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("acct.all")}</SelectItem>
                  <SelectItem value="active">{t("acct.status.active")}</SelectItem>
                  <SelectItem value="inactive">{t("acct.status.inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {rows.length === 0 ? (emp.loading ? <TableSkeleton /> : <Empty text={t("acct.emp.empty")} />) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("acct.emp.name")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("acct.emp.position")}</TableHead>
                    <TableHead className="text-right">{t("acct.emp.rate")}</TableHead>
                    <TableHead className="text-right">{t("acct.days")}</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">{t("acct.hours")}</TableHead>
                    <TableHead className="text-right">{t("acct.earned")}</TableHead>
                    <TableHead className="text-right">{t("acct.owed")}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e, __i: number) => {
                    const s = stats[e.id] || {}
                    return (
                      <FadeRow index={__i} key={e.id}>
                        <TableCell>
                          <div className="font-medium">{e.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {e.phone || e.email || ""} {e.status !== "active" && <Badge variant="outline" className="ml-1">{t("acct.status.inactive")}</Badge>}
                          </div>
                          {e.start_date && <div className="text-xs text-muted-foreground">{t("acct.emp.since")} {fmtDate(e.start_date, locale)}</div>}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{e.position || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtMoney(e.pay_rate, locale)}<span className="text-xs text-muted-foreground">/{e.pay_type === "hourly" ? t("acct.perHourShort") : t("acct.perDayShort")}</span></TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(s.days || 0)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-right tabular-nums">{fmtNum(s.hours || 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtMoney(s.earned || 0, locale)}</TableCell>
                        <TableCell className={`text-right font-semibold tabular-nums`}>{fmtMoney(s.owed_total || 0, locale)}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" aria-label={t("acct.edit")} onClick={() => { setForm({ ...blank, ...e, pay_rate: String(e.pay_rate ?? "") }); setOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                        </TableCell>
                      </FadeRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? t("acct.emp.edit") : t("acct.emp.new")}</DialogTitle>
            <DialogDescription>{t("acct.emp.formHint")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("acct.emp.name") + " *"} className="sm:col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label={t("acct.emp.position")}><Input value={form.position || ""} placeholder={t("acct.emp.positionPh")} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
            <Field label={t("acct.emp.document")}><Input value={form.document_id || ""} onChange={(e) => setForm({ ...form, document_id: e.target.value })} /></Field>
            <Field label={t("acct.emp.payType")}>
              <Select value={form.pay_type} onValueChange={(v) => setForm({ ...form, pay_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t("acct.perDay")}</SelectItem>
                  <SelectItem value="hourly">{t("acct.perHour")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("acct.emp.rate") + " (USD)"}><Input type="number" inputMode="decimal" min="0" step="0.01" value={form.pay_rate} onChange={(e) => setForm({ ...form, pay_rate: e.target.value })} /></Field>
            <Field label={t("acct.phone")}><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label={t("acct.email")}><Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label={t("acct.emp.startDate")}><Input type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
            <Field label={t("acct.status")}>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("acct.status.active")}</SelectItem>
                  <SelectItem value="inactive">{t("acct.status.inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("acct.emp.userId")} className="sm:col-span-2"><Input type="number" value={form.user_id ?? ""} placeholder={t("acct.emp.userIdPh")} onChange={(e) => setForm({ ...form, user_id: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label={t("acct.notes")} className="sm:col-span-2"><Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
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
