"use client"

import { useMemo, useState } from "react"
import { Plus, Trash2, Download, CalendarDays, Clock, Wallet, Users } from "lucide-react"
import { PageShell, Stat, Empty, Field } from "@/components/accounting/page-shell"
import { DateRange } from "@/components/accounting/date-range"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FadeRow } from "@/components/motion/fade-row"
import { TableSkeleton } from "@/components/motion/table-skeleton"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/hooks/use-toast"
import { useResource, fmtMoney, fmtNum, fmtDate, todayStr, monthStartStr, addDaysStr, downloadCSV, useProjectsList } from "@/lib/acct-client"

export default function AttendancePage() {
  const { t, locale } = useI18n()
  const { toast } = useToast()
  const [from, setFrom] = useState(monthStartStr())
  const [to, setTo] = useState(todayStr())
  const [empFilter, setEmpFilter] = useState("all")
  const [projFilter, setProjFilter] = useState("all")
  const att = useResource<any>("attendance", { from, to, employee_id: empFilter, project_id: projFilter })
  const emps = useResource<any>("employees", { status: "active" })
  const projects = useProjectsList()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({ work_date: todayStr(), project_id: "none", days: "1", hours: "8", notes: "", selected: {} as Record<number, boolean> })

  const totals = useMemo(() => {
    const by: Record<number, any> = {}
    for (const r of att.rows) {
      const b = (by[r.employee_id] ||= { employee_id: r.employee_id, name: r.employee_name, days: 0, hours: 0, amount: 0, entries: 0 })
      b.days += Number(r.days); b.hours += Number(r.hours); b.amount += Number(r.amount); b.entries++
    }
    return Object.values(by).sort((a: any, b: any) => a.name.localeCompare(b.name))
  }, [att.rows])
  const sum = (k: string) => totals.reduce((s: number, r: any) => s + r[k], 0)

  // matrix: employees x dates (max 31 columns)
  const dates = useMemo(() => {
    const out: string[] = []
    let d = from
    while (d <= to && out.length < 31) { out.push(d); d = addDaysStr(d, 1) }
    return out
  }, [from, to])
  const cell = useMemo(() => {
    const m: Record<string, { d: number; h: number }> = {}
    for (const r of att.rows) { const k = `${r.employee_id}|${r.work_date}`; const c = (m[k] ||= { d: 0, h: 0 }); c.d += Number(r.days); c.h += Number(r.hours) }
    return m
  }, [att.rows])

  const save = async () => {
    const ids = Object.entries(form.selected).filter(([, v]) => v).map(([k]) => Number(k))
    if (!ids.length) return toast({ title: t("acct.required"), description: t("acct.att.pickEmployees"), variant: "destructive" })
    try {
      await att.create({
        entries: ids.map((employee_id) => ({
          employee_id, work_date: form.work_date, project_id: form.project_id === "none" ? null : Number(form.project_id),
          days: Number(form.days) || 0, hours: Number(form.hours) || 0, notes: form.notes,
        })),
      })
      toast({ title: t("acct.saved"), description: `${ids.length} ${t("acct.att.entriesSaved")}` })
      setOpen(false)
      setForm({ ...form, selected: {}, notes: "" })
    } catch (e: any) {
      toast({ title: t("acct.error"), description: e.message, variant: "destructive" })
    }
  }

  const del = async (id: number) => {
    if (!confirm(t("acct.confirmDelete"))) return
    try { await att.remove(id); toast({ title: t("acct.deleted") }) } catch (e: any) { toast({ title: t("acct.error"), description: e.message, variant: "destructive" }) }
  }

  return (
    <PageShell
      title={t("acct.att.title")}
      subtitle={t("acct.att.subtitle")}
      actions={
        <>
          <Button variant="outline" onClick={() => downloadCSV(`dias-trabajados-${from}-${to}.csv`, att.rows, [
            { key: "work_date", label: t("acct.date") }, { key: "employee_name", label: t("acct.employee") }, { key: "project_name", label: t("acct.project") },
            { key: "days", label: t("acct.days") }, { key: "hours", label: t("acct.hours") }, { key: "rate", label: t("acct.emp.rate") },
            { key: "pay_type", label: t("acct.emp.payType") }, { key: "amount", label: t("acct.amount") }, { key: "notes", label: t("acct.notes") },
          ])}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="brand" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />{t("acct.att.new")}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat title={t("acct.att.peopleWorked")} value={totals.length} icon={Users} />
        <Stat title={t("acct.daysWorkedPeriod")} value={fmtNum(sum("days"))} icon={CalendarDays} />
        <Stat title={t("acct.hours")} value={fmtNum(sum("hours"))} icon={Clock} />
        <Stat title={t("acct.att.laborCost")} value={fmtMoney(sum("amount"), locale)} icon={Wallet} />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <DateRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt) }} />
            <div className="flex flex-wrap gap-2">
              <Select value={empFilter} onValueChange={setEmpFilter}>
                <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder={t("acct.employee")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("acct.allEmployees")}</SelectItem>
                  {emps.rows.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={projFilter} onValueChange={setProjFilter}>
                <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder={t("acct.project")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("acct.allProjects")}</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <Tabs defaultValue="totals">
            <TabsList className="mx-3 sm:mx-0">
              <TabsTrigger value="totals">{t("acct.att.totals")}</TabsTrigger>
              <TabsTrigger value="grid">{t("acct.att.calendar")}</TabsTrigger>
              <TabsTrigger value="list">{t("acct.att.detail")}</TabsTrigger>
            </TabsList>

            <TabsContent value="totals">
              {totals.length === 0 ? (att.loading ? <TableSkeleton /> : <Empty text={t("acct.att.empty")} />) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t("acct.employee")}</TableHead><TableHead className="text-right">{t("acct.entries")}</TableHead>
                      <TableHead className="text-right">{t("acct.days")}</TableHead><TableHead className="text-right">{t("acct.hours")}</TableHead>
                      <TableHead className="text-right">{t("acct.earned")}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {totals.map((r: any, __i: number) => (
                        <FadeRow index={__i} key={r.employee_id}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.entries}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(r.days)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(r.hours)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{fmtMoney(r.amount, locale)}</TableCell>
                        </FadeRow>
                      ))}
                    </TableBody>
                    <TableFooter><TableRow>
                      <TableCell>{t("acct.total")}</TableCell><TableCell className="text-right">{att.rows.length}</TableCell>
                      <TableCell className="text-right">{fmtNum(sum("days"))}</TableCell><TableCell className="text-right">{fmtNum(sum("hours"))}</TableCell>
                      <TableCell className="text-right">{fmtMoney(sum("amount"), locale)}</TableCell>
                    </TableRow></TableFooter>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="grid">
              {totals.length === 0 ? <Empty text={t("acct.att.empty")} /> : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 bg-card p-2 text-left font-medium">{t("acct.employee")}</th>
                        {dates.map((d) => {
                          const wd = new Date(d + "T12:00:00").getDay()
                          return <th key={d} className={`min-w-[34px] p-1 text-center font-medium ${wd === 0 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{d.slice(8)}</th>
                        })}
                        <th className="p-2 text-right font-medium">{t("acct.days")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totals.map((r: any) => (
                        <tr key={r.employee_id} className="border-t">
                          <td className="sticky left-0 z-10 bg-card p-2 font-medium whitespace-nowrap">{r.name}</td>
                          {dates.map((d) => {
                            const h = cell[`${r.employee_id}|${d}`]
                            return (
                              <td key={d} className="p-0.5 text-center">
                                {h ? <span className="inline-flex h-7 w-8 items-center justify-center rounded bg-primary/15 font-semibold text-primary" title={`${h.d} d · ${h.h} h`}>{fmtNum(h.d, 1)}</span> : <span className="text-muted-foreground/40">·</span>}
                              </td>
                            )
                          })}
                          <td className="p-2 text-right font-semibold tabular-nums">{fmtNum(r.days)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-3 pt-2 text-xs text-muted-foreground sm:px-0">{t("acct.att.gridHint")}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="list">
              {att.rows.length === 0 ? <Empty text={t("acct.att.empty")} /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t("acct.date")}</TableHead><TableHead>{t("acct.employee")}</TableHead>
                      <TableHead className="hidden md:table-cell">{t("acct.project")}</TableHead>
                      <TableHead className="text-right">{t("acct.days")}</TableHead><TableHead className="text-right">{t("acct.hours")}</TableHead>
                      <TableHead className="text-right">{t("acct.amount")}</TableHead><TableHead className="w-10" />
                    </TableRow></TableHeader>
                    <TableBody>
                      {att.rows.map((r, __i: number) => (
                        <FadeRow index={__i} key={r.id}>
                          <TableCell className="whitespace-nowrap">{fmtDate(r.work_date, locale)}</TableCell>
                          <TableCell><div className="font-medium">{r.employee_name}</div>{r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}</TableCell>
                          <TableCell className="hidden md:table-cell">{r.project_name || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(r.days)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(r.hours)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtMoney(r.amount, locale)}<div className="text-[10px] text-muted-foreground">{fmtMoney(r.rate, locale)}/{r.pay_type === "hourly" ? t("acct.perHourShort") : t("acct.perDayShort")}</div></TableCell>
                          <TableCell><Button size="icon" variant="ghost" aria-label={t("acct.delete")} onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                        </FadeRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("acct.att.new")}</DialogTitle>
            <DialogDescription>{t("acct.att.formHint")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("acct.date") + " *"}><Input type="date" value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} /></Field>
            <Field label={t("acct.project")}>
              <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("acct.noProject")}</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("acct.att.daysLabel")}><Input type="number" min="0" max="3" step="0.25" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></Field>
            <Field label={t("acct.att.hoursLabel")}><Input type="number" min="0" max="24" step="0.5" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></Field>
            <Field label={t("acct.notes")} className="sm:col-span-2"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("acct.att.whoWorked")}</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setForm({ ...form, selected: Object.fromEntries(emps.rows.map((e) => [e.id, true])) })}>{t("acct.selectAll")}</Button>
            </div>
            {emps.rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("acct.att.noEmployees")}</p> : (
              <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
                {emps.rows.map((e) => (
                  <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent">
                    <Checkbox checked={!!form.selected[e.id]} onCheckedChange={(v) => setForm({ ...form, selected: { ...form.selected, [e.id]: !!v } })} />
                    <span className="flex-1 text-sm">{e.name}</span>
                    <span className="text-xs text-muted-foreground">{fmtMoney(e.pay_rate, locale)}/{e.pay_type === "hourly" ? t("acct.perHourShort") : t("acct.perDayShort")}</span>
                  </label>
                ))}
              </div>
            )}
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
