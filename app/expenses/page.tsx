"use client"

import { useMemo, useState } from "react"
import { Plus, Pencil, Trash2, Download, Receipt, Tags, Briefcase } from "lucide-react"
import { PageShell, Stat, Empty, Field } from "@/components/accounting/page-shell"
import { DateRange } from "@/components/accounting/date-range"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FadeRow } from "@/components/motion/fade-row"
import { TableSkeleton } from "@/components/motion/table-skeleton"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/hooks/use-toast"
import { useResource, fmtMoney, fmtDate, todayStr, monthStartStr, downloadCSV, useProjectsList, EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/acct-client"

const blank = { id: 0, expense_date: todayStr(), category: "fuel", description: "", amount: "", payee: "", project_id: "none", payment_method: "cash", receipt_ref: "", notes: "" }

export default function ExpensesPage() {
  const { t, locale } = useI18n()
  const { toast } = useToast()
  const [from, setFrom] = useState(monthStartStr())
  const [to, setTo] = useState(todayStr())
  const [cat, setCat] = useState("all")
  const [proj, setProj] = useState("all")
  const exp = useResource<any>("expenses", { from, to, category: cat, project_id: proj })
  const projects = useProjectsList()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>(blank)

  const total = exp.rows.reduce((s, e) => s + Number(e.amount), 0)
  const byCat = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of exp.rows) m[e.category] = (m[e.category] || 0) + Number(e.amount)
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [exp.rows])
  const projTotal = exp.rows.filter((e) => e.project_id).reduce((s, e) => s + Number(e.amount), 0)

  const save = async () => {
    if (!(Number(form.amount) > 0) || !form.expense_date) return toast({ title: t("acct.required"), description: `${t("acct.date")} / ${t("acct.amount")}`, variant: "destructive" })
    try {
      const body = { ...form, amount: Number(form.amount), project_id: form.project_id === "none" ? null : Number(form.project_id) }
      if (form.id) await exp.update(body); else await exp.create(body)
      toast({ title: t("acct.saved") }); setOpen(false)
    } catch (e: any) { toast({ title: t("acct.error"), description: e.message, variant: "destructive" }) }
  }
  const del = async (id: number) => {
    if (!confirm(t("acct.confirmDelete"))) return
    try { await exp.remove(id) } catch (e: any) { toast({ title: t("acct.error"), description: e.message, variant: "destructive" }) }
  }

  return (
    <PageShell title={t("acct.exp.title")} subtitle={t("acct.exp.subtitle")}
      actions={<>
        <Button variant="outline" onClick={() => downloadCSV(`gastos-${from}-${to}.csv`, exp.rows.map((e) => ({ ...e, category: t(`acct.cat.${e.category}`) })), [
          { key: "expense_date", label: t("acct.date") }, { key: "category", label: t("acct.category") }, { key: "description", label: t("acct.description") },
          { key: "payee", label: t("acct.exp.payee") }, { key: "project_name", label: t("acct.project") }, { key: "payment_method", label: t("acct.method") },
          { key: "receipt_ref", label: t("acct.exp.receipt") }, { key: "amount", label: t("acct.amount") },
        ])}><Download className="mr-2 h-4 w-4" />CSV</Button>
        <Button variant="brand" onClick={() => { setForm(blank); setOpen(true) }}><Plus className="mr-2 h-4 w-4" />{t("acct.exp.new")}</Button>
      </>}
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat title={t("acct.exp.totalPeriod")} value={fmtMoney(total, locale)} icon={Receipt} hint={`${exp.rows.length} ${t("acct.records")}`} />
        <Stat title={t("acct.exp.topCategory")} value={byCat[0] ? t(`acct.cat.${byCat[0][0]}`) : "—"} icon={Tags} hint={byCat[0] ? fmtMoney(byCat[0][1], locale) : ""} />
        <Stat title={t("acct.exp.onProjects")} value={fmtMoney(projTotal, locale)} icon={Briefcase} />
        <Stat title={t("acct.exp.overhead")} value={fmtMoney(total - projTotal, locale)} icon={Receipt} />
      </div>

      {byCat.length > 0 && (
        <Card><CardContent className="grid gap-2 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          {byCat.map(([c, v]) => (
            <div key={c} className="space-y-1">
              <div className="flex justify-between text-sm"><span>{t(`acct.cat.${c}`)}</span><span className="tabular-nums text-muted-foreground">{fmtMoney(v, locale)}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${total ? (v / total) * 100 : 0}%` }} /></div>
            </div>
          ))}
        </CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <DateRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt) }} />
            <div className="flex flex-wrap gap-2">
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">{t("acct.allCategories")}</SelectItem>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`acct.cat.${c}`)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={proj} onValueChange={setProj}>
                <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">{t("acct.allProjects")}</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {exp.rows.length === 0 ? (exp.loading ? <TableSkeleton /> : <Empty text={t("acct.exp.empty")} />) : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead>{t("acct.date")}</TableHead><TableHead>{t("acct.category")}</TableHead><TableHead className="hidden md:table-cell">{t("acct.exp.payee")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("acct.project")}</TableHead><TableHead className="text-right">{t("acct.amount")}</TableHead><TableHead className="w-20" />
              </TableRow></TableHeader>
              <TableBody>{exp.rows.map((e, __i: number) => (
                <FadeRow index={__i} key={e.id}>
                  <TableCell className="whitespace-nowrap">{fmtDate(e.expense_date, locale)}</TableCell>
                  <TableCell><Badge variant="outline">{t(`acct.cat.${e.category}`)}</Badge>{e.description && <div className="mt-1 text-xs text-muted-foreground">{e.description}</div>}</TableCell>
                  <TableCell className="hidden md:table-cell">{e.payee || "—"}<div className="text-xs text-muted-foreground">{e.payment_method ? t(`acct.method.${e.payment_method}`) : ""}{e.receipt_ref ? ` · ${e.receipt_ref}` : ""}</div></TableCell>
                  <TableCell className="hidden lg:table-cell">{e.project_name || "—"}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{fmtMoney(e.amount, locale)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button size="icon" variant="ghost" aria-label={t("acct.edit")} onClick={() => { setForm({ ...blank, ...e, amount: String(e.amount), project_id: e.project_id ? String(e.project_id) : "none" }); setOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label={t("acct.delete")} onClick={() => del(e.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </FadeRow>
              ))}</TableBody>
              <TableFooter><TableRow><TableCell colSpan={2}>{t("acct.total")}</TableCell><TableCell className="hidden md:table-cell" /><TableCell className="hidden lg:table-cell" /><TableCell className="text-right">{fmtMoney(total, locale)}</TableCell><TableCell /></TableRow></TableFooter>
            </Table></div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{form.id ? t("acct.exp.edit") : t("acct.exp.new")}</DialogTitle><DialogDescription>{t("acct.exp.formHint")}</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("acct.date") + " *"}><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></Field>
            <Field label={t("acct.amount") + " (USD) *"}><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label={t("acct.category")}><Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`acct.cat.${c}`)}</SelectItem>)}</SelectContent></Select></Field>
            <Field label={t("acct.method")}><Select value={form.payment_method || "cash"} onValueChange={(v) => setForm({ ...form, payment_method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{t(`acct.method.${m}`)}</SelectItem>)}</SelectContent></Select></Field>
            <Field label={t("acct.description")} className="sm:col-span-2"><Input value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label={t("acct.exp.payee")}><Input value={form.payee || ""} onChange={(e) => setForm({ ...form, payee: e.target.value })} /></Field>
            <Field label={t("acct.project")}><Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{t("acct.noProject")}</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent></Select></Field>
            <Field label={t("acct.exp.receipt")} className="sm:col-span-2"><Input value={form.receipt_ref || ""} placeholder={t("acct.exp.receiptPh")} onChange={(e) => setForm({ ...form, receipt_ref: e.target.value })} /></Field>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("acct.cancel")}</Button><Button onClick={save}>{t("acct.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
