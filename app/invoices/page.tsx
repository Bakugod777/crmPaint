"use client"

import { useMemo, useState } from "react"
import { Plus, Search, FileText, Download, DollarSign, Trash, HandCoins, Trash2, Printer, AlertTriangle } from "lucide-react"
import { PageShell, Stat, Empty, Field } from "@/components/accounting/page-shell"
import { DateRange } from "@/components/accounting/date-range"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FadeRow } from "@/components/motion/fade-row"
import { TableSkeleton } from "@/components/motion/table-skeleton"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/hooks/use-toast"
import { api, useResource, fmtMoney, fmtDate, todayStr, addDaysStr, downloadCSV, useProjectsList, PAYMENT_METHODS } from "@/lib/acct-client"

const statusTone: Record<string, "default" | "secondary" | "destructive" | "outline"> = { paid: "default", pending: "secondary", partial: "outline", overdue: "destructive", cancelled: "outline" }
type Line = { item_type: string; ref_id: number | null; description: string; quantity: string; unit_price: string }
const esc = (s: any) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string))

export default function InvoicesPage() {
  const { t, locale } = useI18n()
  const { toast } = useToast()
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`)
  const [to, setTo] = useState(todayStr())
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const inv = useResource<any>("invoices", { from, to })
  const products = useResource<any>("products")
  const mats = useResource<any>("materials", { active: 1 })
  const projects = useProjectsList()
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<any>({ client: "", project: "", date: todayStr(), dueDate: addDaysStr(todayStr(), 30), tax: "0", lines: [] as Line[], amount: "" })
  const [payFor, setPayFor] = useState<any>(null)
  const [payData, setPayData] = useState<any>({ payments: [], items: [] })
  const [payForm, setPayForm] = useState<any>({ pay_date: todayStr(), amount: "", method: "transfer", reference: "" })

  const rows = inv.rows.filter((i) => {
    const s = search.toLowerCase()
    return (!s || `INV-${i.id} ${i.client} ${i.project}`.toLowerCase().includes(s)) && (statusFilter === "all" || i.status === statusFilter)
  })
  const total = inv.rows.reduce((s, i) => s + i.amount, 0)
  const paid = inv.rows.reduce((s, i) => s + i.paid, 0)
  const overdue = inv.rows.filter((i) => i.status === "overdue")
  const clients = useMemo(() => Array.from(new Set([...inv.rows.map((i) => i.client), ...projects.map((p) => p.client)].filter(Boolean))).sort(), [inv.rows, projects])

  const priceOptions = [
    ...products.rows.map((p) => ({ key: `product:${p.id}`, label: `${p.name} — ${fmtMoney(p.price, locale)}${p.unit ? "/" + p.unit : ""}`, line: { item_type: "product", ref_id: p.id, description: p.name, quantity: "1", unit_price: String(p.price) } })),
    ...mats.rows.filter((m) => Number(m.sale_price) > 0).map((m) => ({ key: `material:${m.id}`, label: `${m.name} — ${fmtMoney(m.sale_price, locale)}/${m.unit}`, line: { item_type: "material", ref_id: m.id, description: m.name, quantity: "1", unit_price: String(m.sale_price) } })),
  ]
  const subtotal = form.lines.reduce((s: number, l: Line) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)
  const taxAmt = Math.round(subtotal * (Number(form.tax) || 0)) / 100
  const grand = form.lines.length ? subtotal + taxAmt : Number(form.amount) || 0

  const create = async () => {
    if (!form.client.trim()) return toast({ title: t("acct.required"), description: t("acct.client"), variant: "destructive" })
    if (!(grand > 0)) return toast({ title: t("acct.required"), description: t("acct.amount"), variant: "destructive" })
    const items = form.lines.length ? [...form.lines.map((l: Line) => ({ ...l, quantity: Number(l.quantity) || 0, unit_price: Number(l.unit_price) || 0 })), ...(taxAmt > 0 ? [{ item_type: "tax", ref_id: null, description: `${t("acct.inv.tax")} ${form.tax}%`, quantity: 1, unit_price: taxAmt }] : [])] : undefined
    try {
      await inv.create({ client: form.client.trim(), project: form.project, date: form.date, dueDate: form.dueDate, amount: grand, items })
      toast({ title: t("acct.saved") }); setNewOpen(false)
    } catch (e: any) { toast({ title: t("acct.error"), description: e.message, variant: "destructive" }) }
  }

  const openPayments = async (i: any) => {
    setPayFor(i)
    setPayForm({ pay_date: todayStr(), amount: i.balance > 0 ? String(i.balance) : "", method: "transfer", reference: "" })
    try { const d: any = await api("invoices", { params: { id: i.id } }); setPayData({ payments: d.payments || [], items: d.items || [] }) } catch { setPayData({ payments: [], items: [] }) }
  }
  const addPayment = async () => {
    const amt = Number(payForm.amount)
    if (!(amt > 0)) return toast({ title: t("acct.required"), description: t("acct.amount"), variant: "destructive" })
    if (amt > payFor.balance + 0.001 && !confirm(t("acct.inv.overpayConfirm"))) return
    try {
      await api("invoice_payments", { method: "POST", body: { ...payForm, invoice_id: payFor.id, amount: amt } })
      toast({ title: t("acct.inv.paymentSaved") })
      await inv.reload()
      const d: any = await api("invoices", { params: { id: payFor.id } })
      setPayFor(d.invoices?.[0] || null); setPayData({ payments: d.payments || [], items: d.items || [] })
      setPayForm({ ...payForm, amount: d.invoices?.[0]?.balance > 0 ? String(d.invoices[0].balance) : "" })
    } catch (e: any) { toast({ title: t("acct.error"), description: e.message, variant: "destructive" }) }
  }
  const delPayment = async (id: number) => {
    if (!confirm(t("acct.confirmDelete"))) return
    try {
      await api("invoice_payments", { method: "DELETE", params: { id } })
      await inv.reload()
      const d: any = await api("invoices", { params: { id: payFor.id } })
      setPayFor(d.invoices?.[0] || null); setPayData({ payments: d.payments || [], items: d.items || [] })
    } catch (e: any) { toast({ title: t("acct.error"), description: e.message, variant: "destructive" }) }
  }
  const delInvoice = async (i: any) => {
    if (!confirm(t("acct.inv.deleteConfirm"))) return
    try { await api("invoices", { method: "DELETE", params: { id: i.id, force: i.paid > 0 ? 1 : undefined } }); inv.reload() } catch (e: any) { toast({ title: t("acct.error"), description: e.message, variant: "destructive" }) }
  }
  const printInvoice = async (i: any) => {
    let items: any[] = [], payments: any[] = []
    try { const d: any = await api("invoices", { params: { id: i.id } }); items = d.items || []; payments = d.payments || [] } catch {}
    const lines = items.length ? items : [{ description: t("acct.inv.total"), quantity: 1, unit_price: i.amount, total: i.amount }]
    const html = `<html><head><title>INV-${i.id}</title><style>body{font-family:system-ui,Arial;padding:40px;color:#111}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left}td.n,th.n{text-align:right}.h{display:flex;justify-content:space-between}</style></head><body>
      <div class="h"><div><h1>Paint Power</h1><h2>${esc(t("acct.inv.invoice"))} INV-${i.id}</h2><div>${esc(i.client)}</div><div>${esc(i.project)}</div></div>
      <div><div>${esc(t("acct.inv.issued"))}: ${esc(fmtDate(i.date, locale))}</div><div>${esc(t("acct.due"))}: ${esc(fmtDate(i.dueDate, locale))}</div></div></div>
      <table><thead><tr><th>${esc(t("acct.description"))}</th><th class="n">${esc(t("acct.qty"))}</th><th class="n">${esc(t("acct.inv.unitPrice"))}</th><th class="n">${esc(t("acct.total"))}</th></tr></thead><tbody>
      ${lines.map((l) => `<tr><td>${esc(l.description)}</td><td class="n">${esc(l.quantity)}</td><td class="n">${esc(fmtMoney(l.unit_price, locale))}</td><td class="n">${esc(fmtMoney(l.total, locale))}</td></tr>`).join("")}
      </tbody></table>
      <p style="text-align:right"><b>${esc(t("acct.total"))}: ${esc(fmtMoney(i.amount, locale))}</b><br/>${esc(t("acct.acc.paid"))}: ${esc(fmtMoney(i.paid, locale))}<br/><b>${esc(t("acct.balance"))}: ${esc(fmtMoney(i.balance, locale))}</b></p>
      ${payments.length ? `<h3>${esc(t("acct.inv.payments"))}</h3><table><tbody>${payments.map((p) => `<tr><td>${esc(fmtDate(p.pay_date, locale))}</td><td>${esc(p.method || "")}</td><td class="n">${esc(fmtMoney(p.amount, locale))}</td></tr>`).join("")}</tbody></table>` : ""}
      </body></html>`
    const w = window.open("", "_blank")
    if (!w) return toast({ title: t("acct.error"), description: t("acct.inv.popupBlocked"), variant: "destructive" })
    w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print() }, 300)
  }

  return (
    <PageShell title={t("acct.inv.title")} subtitle={t("acct.inv.subtitle")}
      actions={<>
        <Button variant="outline" onClick={() => downloadCSV(`facturas-${from}-${to}.csv`, rows.map((i) => ({ ...i, number: `INV-${i.id}` })), [
          { key: "number", label: "#" }, { key: "date", label: t("acct.date") }, { key: "dueDate", label: t("acct.due") }, { key: "client", label: t("acct.client") }, { key: "project", label: t("acct.project") },
          { key: "amount", label: t("acct.total") }, { key: "paid", label: t("acct.acc.paid") }, { key: "balance", label: t("acct.balance") }, { key: "status", label: t("acct.status") },
        ])}><Download className="mr-2 h-4 w-4" />CSV</Button>
        <Button variant="brand" onClick={() => { setForm({ client: "", project: "", date: todayStr(), dueDate: addDaysStr(todayStr(), 30), tax: "0", lines: [], amount: "" }); setNewOpen(true) }}><Plus className="mr-2 h-4 w-4" />{t("acct.inv.new")}</Button>
      </>}
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat title={t("acct.inv.billed")} value={fmtMoney(total, locale)} icon={DollarSign} hint={`${inv.rows.length} ${t("acct.acc.invoicesShort")}`} />
        <Stat title={t("acct.acc.paid")} value={fmtMoney(paid, locale)} tone="good" icon={DollarSign} />
        <Stat title={t("acct.inv.outstanding")} value={fmtMoney(total - paid, locale)} tone={total - paid > 0 ? "warn" : "good"} icon={DollarSign} hint={`${inv.rows.filter((i) => i.balance > 0).length} ${t("acct.inv.unpaid")}`} />
        <Stat title={t("acct.inv.overdue")} value={overdue.length} tone={overdue.length ? "bad" : "good"} icon={AlertTriangle} hint={fmtMoney(overdue.reduce((s, i) => s + i.balance, 0), locale)} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <DateRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt) }} />
            <div className="flex flex-wrap gap-2">
              <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-9 pl-9 sm:w-56" placeholder={t("acct.search")} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">{t("acct.all")}</SelectItem>{["pending", "partial", "overdue", "paid"].map((s) => <SelectItem key={s} value={s}>{t(`acct.inv.status.${s}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (inv.loading ? <TableSkeleton /> : <Empty text={t("acct.inv.empty")} />) : rows.map((i) => (
            <div key={i.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:flex"><FileText className="h-5 w-5 text-primary" /></div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">INV-{i.id}</span><Badge variant={statusTone[i.status] || "outline"}>{t(`acct.inv.status.${i.status}`)}</Badge>{i.itemCount > 0 && <span className="text-xs text-muted-foreground">{i.itemCount} {t("acct.inv.lines")}</span>}</div>
                  <p className="truncate text-sm font-medium">{i.client}</p>
                  {i.project && <p className="truncate text-sm text-muted-foreground">{i.project}</p>}
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground"><span>{t("acct.inv.issued")}: {fmtDate(i.date, locale)}</span>{i.dueDate && <span>{t("acct.due")}: {fmtDate(i.dueDate, locale)}</span>}{i.lastPayment && <span>{t("acct.inv.lastPayment")}: {fmtDate(i.lastPayment, locale)}</span>}</div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{i.balance > 0 ? t("acct.inv.balanceDue") : t("acct.total")}</p>
                  <p className={`text-2xl font-bold tabular-nums ${i.balance <= 0 ? "text-positive" : i.status === "overdue" ? "text-negative" : ""}`}>{fmtMoney(i.balance > 0 ? i.balance : i.amount, locale)}</p>
                  {i.balance > 0 && <p className="text-xs text-muted-foreground">{t("acct.acc.paid")} {fmtMoney(i.paid, locale)} {t("acct.of")} {fmtMoney(i.amount, locale)}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => openPayments(i)}><HandCoins className="mr-1 h-4 w-4" />{t("acct.inv.payments")}</Button>
                  <Button size="icon" variant="ghost" aria-label={t("acct.inv.print")} onClick={() => printInvoice(i)}><Printer className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={t("acct.delete")} onClick={() => delInvoice(i)}><Trash className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* New invoice */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{t("acct.inv.new")}</DialogTitle><DialogDescription>{t("acct.inv.formHint")}</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("acct.client") + " *"}><Input list="inv-clients" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /><datalist id="inv-clients">{clients.map((c) => <option key={c} value={c} />)}</datalist></Field>
            <Field label={t("acct.project")}>
              <Select value={form.project || "none"} onValueChange={(v) => { const p = projects.find((x) => x.name === v); setForm({ ...form, project: v === "none" ? "" : v, client: form.client || p?.client || "" }) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">{t("acct.noProject")}</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label={t("acct.date")}><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label={t("acct.due")}><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{t("acct.inv.lines")}</span>
              <div className="flex gap-2">
                <Select value="" onValueChange={(k) => { const o = priceOptions.find((x) => x.key === k); if (o) setForm({ ...form, lines: [...form.lines, { ...o.line }] }) }}>
                  <SelectTrigger className="h-8 w-[220px]"><SelectValue placeholder={t("acct.inv.addFromPrices")} /></SelectTrigger>
                  <SelectContent>{priceOptions.length === 0 ? <SelectItem value="__none" disabled>{t("acct.price.noServices")}</SelectItem> : priceOptions.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => setForm({ ...form, lines: [...form.lines, { item_type: "custom", ref_id: null, description: "", quantity: "1", unit_price: "" }] })}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            {form.lines.length === 0 ? (
              <Field label={t("acct.inv.amountNoLines") + " (USD)"}><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            ) : (
              <div className="space-y-2">
                {form.lines.map((l: Line, idx: number) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <Input aria-label={t("acct.description")} className="col-span-12 sm:col-span-6" value={l.description} placeholder={t("acct.description")} onChange={(e) => { const ls = [...form.lines]; ls[idx] = { ...l, description: e.target.value }; setForm({ ...form, lines: ls }) }} />
                    <Input aria-label={t("acct.qty")} className="col-span-3 sm:col-span-2" type="number" min="0" step="0.01" value={l.quantity} onChange={(e) => { const ls = [...form.lines]; ls[idx] = { ...l, quantity: e.target.value }; setForm({ ...form, lines: ls }) }} />
                    <Input aria-label={t("acct.inv.unitPrice")} className="col-span-4 sm:col-span-2" type="number" min="0" step="0.01" value={l.unit_price} onChange={(e) => { const ls = [...form.lines]; ls[idx] = { ...l, unit_price: e.target.value }; setForm({ ...form, lines: ls }) }} />
                    <div className="col-span-3 flex items-center justify-end text-sm tabular-nums sm:col-span-1">{fmtMoney((Number(l.quantity) || 0) * (Number(l.unit_price) || 0), locale)}</div>
                    <Button aria-label={t("acct.delete")} size="icon" variant="ghost" className="col-span-2 sm:col-span-1" onClick={() => setForm({ ...form, lines: form.lines.filter((_: any, j: number) => j !== idx) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-1 text-sm">
                  <span className="text-muted-foreground">{t("acct.inv.subtotal")} {fmtMoney(subtotal, locale)}</span>
                  <label className="flex items-center gap-1">{t("acct.inv.tax")} % <Input aria-label={t("acct.inv.tax")} type="number" min="0" step="0.01" className="h-8 w-20" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} /></label>
                </div>
              </div>
            )}
            <div className="text-right text-lg font-bold">{t("acct.total")}: {fmtMoney(grand, locale)}</div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setNewOpen(false)}>{t("acct.cancel")}</Button><Button onClick={create}>{t("acct.inv.create")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payments */}
      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          {payFor && (<>
            <DialogHeader>
              <DialogTitle>{t("acct.inv.payments")} · INV-{payFor.id}</DialogTitle>
              <DialogDescription>{payFor.client} — {t("acct.total")} {fmtMoney(payFor.amount, locale)} · {t("acct.acc.paid")} {fmtMoney(payFor.paid, locale)} · <b>{t("acct.balance")} {fmtMoney(payFor.balance, locale)}</b></DialogDescription>
            </DialogHeader>
            {payData.payments.length === 0 ? <p className="text-sm text-muted-foreground">{t("acct.inv.noPayments")}</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>{t("acct.date")}</TableHead><TableHead>{t("acct.method")}</TableHead><TableHead className="text-right">{t("acct.amount")}</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>{payData.payments.map((p: any, __i: number) => (
                  <FadeRow index={__i} key={p.id}><TableCell>{fmtDate(p.pay_date, locale)}</TableCell><TableCell>{p.method ? t(`acct.method.${p.method}`) : "—"}{p.reference && <span className="text-xs text-muted-foreground"> · {p.reference}</span>}</TableCell><TableCell className="text-right tabular-nums">{fmtMoney(p.amount, locale)}</TableCell><TableCell><Button size="icon" variant="ghost" aria-label={t("acct.delete")} onClick={() => delPayment(p.id)}><Trash2 className="h-4 w-4" /></Button></TableCell></FadeRow>
                ))}</TableBody>
              </Table>
            )}
            {payFor.balance > 0 && (
              <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
                <Field label={t("acct.date")}><Input type="date" value={payForm.pay_date} onChange={(e) => setPayForm({ ...payForm, pay_date: e.target.value })} /></Field>
                <Field label={t("acct.amount") + " (USD)"}><Input type="number" min="0" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></Field>
                <Field label={t("acct.method")}><Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{t(`acct.method.${m}`)}</SelectItem>)}</SelectContent></Select></Field>
                <Field label={t("acct.reference")}><Input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} /></Field>
                <Button className="sm:col-span-2" onClick={addPayment}><HandCoins className="mr-2 h-4 w-4" />{t("acct.inv.addPayment")}</Button>
              </div>
            )}
            <DialogFooter><Button variant="outline" onClick={() => setPayFor(null)}>{t("acct.close")}</Button></DialogFooter>
          </>)}
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
