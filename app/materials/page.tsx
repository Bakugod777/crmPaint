"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, Trash2, Download, Package, AlertTriangle, ShoppingCart, Truck, HandCoins } from "lucide-react"
import { PageShell, Stat, Empty, Field } from "@/components/accounting/page-shell"
import { DateRange } from "@/components/accounting/date-range"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FadeRow } from "@/components/motion/fade-row"
import { TableSkeleton } from "@/components/motion/table-skeleton"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/hooks/use-toast"
import { api, useResource, fmtMoney, fmtNum, fmtDate, todayStr, monthStartStr, downloadCSV, useProjectsList, PAYMENT_METHODS } from "@/lib/acct-client"

type DialogKind = null | "material" | "purchase" | "usage" | "supplier" | "supplierPay"

export default function MaterialsPage() {
  const { t, locale } = useI18n()
  const { toast } = useToast()
  const [from, setFrom] = useState(monthStartStr())
  const [to, setTo] = useState(todayStr())
  const mats = useResource<any>("materials")
  const sups = useResource<any>("suppliers")
  const purchases = useResource<any>("material_purchases", { from, to })
  const usage = useResource<any>("material_usage", { from, to })
  const supPays = useResource<any>("supplier_payments", { from, to })
  const projects = useProjectsList()
  const [payables, setPayables] = useState<any[]>([])
  const [dlg, setDlg] = useState<DialogKind>(null)
  const [form, setForm] = useState<any>({})

  useEffect(() => {
    api("accounting/summary", { params: { from, to } }).then((d: any) => setPayables(d.payables?.suppliers || [])).catch(() => {})
  }, [from, to, purchases.rows.length, supPays.rows.length])

  const reloadAll = () => { mats.reload(); purchases.reload(); usage.reload(); supPays.reload() }
  const run = async (fn: () => Promise<any>) => {
    try { await fn(); toast({ title: t("acct.saved") }); setDlg(null); reloadAll() } catch (e: any) { toast({ title: t("acct.error"), description: e.message, variant: "destructive" }) }
  }
  const del = async (res: { remove: (id: any) => Promise<any> }, id: number) => {
    if (!confirm(t("acct.confirmDelete"))) return
    try { await res.remove(id); reloadAll() } catch (e: any) { toast({ title: t("acct.error"), description: e.message, variant: "destructive" }) }
  }

  const invValue = mats.rows.reduce((s, m) => s + Math.max(0, Number(m.stock)) * Number(m.avg_cost), 0)
  const low = mats.rows.filter((m) => m.active && Number(m.stock) <= Number(m.min_stock))
  const purchTotal = purchases.rows.reduce((s, p) => s + Number(p.total), 0)
  const usageTotal = usage.rows.reduce((s, p) => s + Number(p.total), 0)
  const payableTotal = payables.reduce((s, p) => s + Math.max(0, p.balance), 0)

  const projSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{t("acct.noProject")}</SelectItem>
        {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
      </SelectContent>
    </Select>
  )
  const supSelect = (value: string, onChange: (v: string) => void, allowNone = true) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={t("acct.mat.supplier")} /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="none">—</SelectItem>}
        {sups.rows.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
      </SelectContent>
    </Select>
  )
  const matSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={t("acct.mat.material")} /></SelectTrigger>
      <SelectContent>{mats.rows.filter((m) => m.active).map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name} ({m.unit})</SelectItem>)}</SelectContent>
    </Select>
  )
  const idOrNull = (v: string) => (v && v !== "none" ? Number(v) : null)

  return (
    <PageShell title={t("acct.mat.title")} subtitle={t("acct.mat.subtitle")}
      actions={
        <>
          <Button variant="outline" onClick={() => { setForm({ purchase_date: todayStr(), material_id: "", supplier_id: "none", project_id: "none", quantity: "", unit_cost: "", payment_status: "paid", payment_method: "cash", due_date: "", invoice_ref: "", consume: true }); setDlg("purchase") }}><ShoppingCart className="mr-2 h-4 w-4" />{t("acct.mat.newPurchase")}</Button>
          <Button variant="outline" onClick={() => { setForm({ usage_date: todayStr(), material_id: "", project_id: "none", quantity: "", notes: "" }); setDlg("usage") }}><Truck className="mr-2 h-4 w-4" />{t("acct.mat.newUsage")}</Button>
          <Button variant="brand" onClick={() => { setForm({ id: 0, name: "", sku: "", category: "", unit: "gal", unit_cost: "", sale_price: "", supplier_id: "none", min_stock: "0", active: true }); setDlg("material") }}><Plus className="mr-2 h-4 w-4" />{t("acct.mat.newMaterial")}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat title={t("acct.mat.invValue")} value={fmtMoney(invValue, locale)} icon={Package} hint={`${mats.rows.length} ${t("acct.mat.items")}`} />
        <Stat title={t("acct.mat.lowStock")} value={low.length} tone={low.length ? "warn" : "good"} icon={AlertTriangle} hint={low.slice(0, 3).map((m) => m.name).join(", ")} />
        <Stat title={t("acct.mat.purchasedPeriod")} value={fmtMoney(purchTotal, locale)} icon={ShoppingCart} hint={`${t("acct.mat.usedPeriod")}: ${fmtMoney(usageTotal, locale)}`} />
        <Stat title={t("acct.mat.payables")} value={fmtMoney(payableTotal, locale)} tone={payableTotal > 0 ? "warn" : "good"} icon={HandCoins} />
      </div>

      <Tabs defaultValue="catalog" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="catalog">{t("acct.mat.tabCatalog")}</TabsTrigger>
            <TabsTrigger value="purchases">{t("acct.mat.tabPurchases")}</TabsTrigger>
            <TabsTrigger value="usage">{t("acct.mat.tabUsage")}</TabsTrigger>
            <TabsTrigger value="suppliers">{t("acct.mat.tabSuppliers")}</TabsTrigger>
          </TabsList>
          <DateRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt) }} />
        </div>

        <TabsContent value="catalog">
          <Card><CardContent className="px-0 pt-4 sm:px-6">
            <div className="mb-2 flex justify-end px-3 sm:px-0"><Button size="sm" variant="outline" onClick={() => downloadCSV("inventario.csv", mats.rows, [
              { key: "name", label: t("acct.mat.material") }, { key: "category", label: t("acct.category") }, { key: "unit", label: t("acct.unit") },
              { key: "stock", label: t("acct.mat.stock") }, { key: "avg_cost", label: t("acct.mat.avgCost") }, { key: "sale_price", label: t("acct.mat.salePrice") }, { key: "supplier_name", label: t("acct.mat.supplier") },
            ])}><Download className="mr-2 h-4 w-4" />CSV</Button></div>
            {mats.rows.length === 0 ? (mats.loading ? <TableSkeleton /> : <Empty text={t("acct.mat.empty")} />) : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead>{t("acct.mat.material")}</TableHead><TableHead className="hidden md:table-cell">{t("acct.mat.supplier")}</TableHead>
                  <TableHead className="text-right">{t("acct.mat.stock")}</TableHead><TableHead className="text-right">{t("acct.mat.avgCost")}</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">{t("acct.mat.salePrice")}</TableHead><TableHead className="hidden lg:table-cell text-right">{t("acct.mat.value")}</TableHead><TableHead className="w-10" />
                </TableRow></TableHeader>
                <TableBody>{mats.rows.map((m, __i: number) => {
                  const isLow = m.active && Number(m.stock) <= Number(m.min_stock)
                  return (
                    <FadeRow index={__i} key={m.id} className={!m.active ? "opacity-60" : ""}>
                      <TableCell><div className="font-medium">{m.name}</div><div className="text-xs text-muted-foreground">{[m.category, m.sku].filter(Boolean).join(" · ")}</div></TableCell>
                      <TableCell className="hidden md:table-cell">{m.supplier_name || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{isLow && <Badge variant="destructive" className="mr-1">{t("acct.mat.low")}</Badge>}{fmtNum(m.stock, 3)} <span className="text-xs text-muted-foreground">{m.unit}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(m.avg_cost, locale)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-right tabular-nums">{fmtMoney(m.sale_price, locale)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">{fmtMoney(Math.max(0, m.stock) * m.avg_cost, locale)}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" aria-label={t("acct.edit")} onClick={() => { setForm({ ...m, supplier_id: m.supplier_id ? String(m.supplier_id) : "none", unit_cost: String(m.unit_cost), sale_price: String(m.sale_price), min_stock: String(m.min_stock), active: !!m.active }); setDlg("material") }}><Pencil className="h-4 w-4" /></Button></TableCell>
                    </FadeRow>
                  )
                })}</TableBody>
              </Table></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="purchases">
          <Card><CardContent className="px-0 pt-4 sm:px-6">
            <div className="mb-2 flex justify-end px-3 sm:px-0"><Button size="sm" variant="outline" onClick={() => downloadCSV(`compras-${from}-${to}.csv`, purchases.rows, [
              { key: "purchase_date", label: t("acct.date") }, { key: "material_name", label: t("acct.mat.material") }, { key: "quantity", label: t("acct.qty") }, { key: "unit", label: t("acct.unit") },
              { key: "unit_cost", label: t("acct.unitCost") }, { key: "total", label: t("acct.total") }, { key: "supplier_name", label: t("acct.mat.supplier") }, { key: "project_name", label: t("acct.project") },
              { key: "payment_status", label: t("acct.mat.payStatus") }, { key: "invoice_ref", label: t("acct.mat.invoiceRef") },
            ])}><Download className="mr-2 h-4 w-4" />CSV</Button></div>
            {purchases.rows.length === 0 ? <Empty text={t("acct.mat.noPurchases")} /> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead>{t("acct.date")}</TableHead><TableHead>{t("acct.mat.material")}</TableHead><TableHead className="text-right">{t("acct.qty")}</TableHead>
                  <TableHead className="text-right">{t("acct.total")}</TableHead><TableHead className="hidden md:table-cell">{t("acct.mat.supplier")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("acct.project")}</TableHead><TableHead>{t("acct.mat.payStatus")}</TableHead><TableHead className="w-10" />
                </TableRow></TableHeader>
                <TableBody>{purchases.rows.map((p, __i: number) => (
                  <FadeRow index={__i} key={p.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(p.purchase_date, locale)}</TableCell>
                    <TableCell><div className="font-medium">{p.material_name}</div>{p.invoice_ref && <div className="text-xs text-muted-foreground">#{p.invoice_ref}</div>}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(p.quantity, 3)} {p.unit}<div className="text-[10px] text-muted-foreground">@ {fmtMoney(p.unit_cost, locale)}</div></TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{fmtMoney(p.total, locale)}</TableCell>
                    <TableCell className="hidden md:table-cell">{p.supplier_name || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{p.project_name || "—"}{Number(p.auto_consumed) > 0 && <Badge variant="outline" className="ml-1">{t("acct.mat.consumed")}</Badge>}</TableCell>
                    <TableCell><Badge variant={p.payment_status === "credit" ? "secondary" : "default"}>{t(`acct.mat.status.${p.payment_status}`)}</Badge>{p.due_date && p.payment_status === "credit" && <div className="text-[10px] text-muted-foreground">{t("acct.due")} {fmtDate(p.due_date, locale)}</div>}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" aria-label={t("acct.delete")} onClick={() => del(purchases, p.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </FadeRow>
                ))}</TableBody>
                <TableFooter><TableRow><TableCell colSpan={3}>{t("acct.total")}</TableCell><TableCell className="text-right">{fmtMoney(purchTotal, locale)}</TableCell><TableCell colSpan={4} /></TableRow></TableFooter>
              </Table></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="usage">
          <Card><CardContent className="px-0 pt-4 sm:px-6">
            <div className="mb-2 flex justify-end px-3 sm:px-0"><Button size="sm" variant="outline" onClick={() => downloadCSV(`consumo-${from}-${to}.csv`, usage.rows, [
              { key: "usage_date", label: t("acct.date") }, { key: "material_name", label: t("acct.mat.material") }, { key: "quantity", label: t("acct.qty") }, { key: "unit", label: t("acct.unit") },
              { key: "unit_cost", label: t("acct.unitCost") }, { key: "total", label: t("acct.total") }, { key: "project_name", label: t("acct.project") }, { key: "notes", label: t("acct.notes") },
            ])}><Download className="mr-2 h-4 w-4" />CSV</Button></div>
            {usage.rows.length === 0 ? <Empty text={t("acct.mat.noUsage")} /> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead>{t("acct.date")}</TableHead><TableHead>{t("acct.mat.material")}</TableHead><TableHead>{t("acct.project")}</TableHead>
                  <TableHead className="text-right">{t("acct.qty")}</TableHead><TableHead className="text-right">{t("acct.cost")}</TableHead><TableHead className="w-10" />
                </TableRow></TableHeader>
                <TableBody>{usage.rows.map((u, __i: number) => (
                  <FadeRow index={__i} key={u.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(u.usage_date, locale)}</TableCell>
                    <TableCell><div className="font-medium">{u.material_name}</div>{u.notes && <div className="text-xs text-muted-foreground">{u.notes}</div>}</TableCell>
                    <TableCell>{u.project_name || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(u.quantity, 3)} {u.unit}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(u.total, locale)}</TableCell>
                    <TableCell>{!u.purchase_id && <Button size="icon" variant="ghost" aria-label={t("acct.delete")} onClick={() => del(usage, u.id)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
                  </FadeRow>
                ))}</TableBody>
                <TableFooter><TableRow><TableCell colSpan={4}>{t("acct.total")}</TableCell><TableCell className="text-right">{fmtMoney(usageTotal, locale)}</TableCell><TableCell /></TableRow></TableFooter>
              </Table></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => { setForm({ supplier_id: "", pay_date: todayStr(), amount: "", method: "transfer", reference: "", notes: "" }); setDlg("supplierPay") }}><HandCoins className="mr-2 h-4 w-4" />{t("acct.mat.paySupplier")}</Button>
              <Button size="sm" onClick={() => { setForm({ id: 0, name: "", contact: "", phone: "", email: "", payment_terms_days: "30", notes: "" }); setDlg("supplier") }}><Plus className="mr-2 h-4 w-4" />{t("acct.mat.newSupplier")}</Button>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              {sups.rows.length === 0 ? <Empty text={t("acct.mat.noSuppliers")} /> : (
                <div className="overflow-x-auto"><Table>
                  <TableHeader><TableRow>
                    <TableHead>{t("acct.mat.supplier")}</TableHead><TableHead className="hidden md:table-cell">{t("acct.contact")}</TableHead>
                    <TableHead className="text-right">{t("acct.mat.purchasedPeriod")}</TableHead><TableHead className="text-right">{t("acct.mat.balanceOwed")}</TableHead><TableHead className="w-10" />
                  </TableRow></TableHeader>
                  <TableBody>{sups.rows.map((s, __i: number) => {
                    const pb = payables.find((p) => p.id === s.id) || {}
                    return (
                      <FadeRow index={__i} key={s.id}>
                        <TableCell><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{t("acct.mat.terms")}: {s.payment_terms_days} {t("acct.daysShort")}</div></TableCell>
                        <TableCell className="hidden md:table-cell">{[s.contact, s.phone].filter(Boolean).join(" · ") || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtMoney(pb.purchased_period || 0, locale)}</TableCell>
                        <TableCell className={`text-right font-semibold tabular-nums`}>{fmtMoney(pb.balance || 0, locale)}</TableCell>
                        <TableCell><Button size="icon" variant="ghost" aria-label={t("acct.edit")} onClick={() => { setForm({ ...s, payment_terms_days: String(s.payment_terms_days) }); setDlg("supplier") }}><Pencil className="h-4 w-4" /></Button></TableCell>
                      </FadeRow>
                    )
                  })}</TableBody>
                </Table></div>
              )}
            </CardContent>
          </Card>
          {supPays.rows.length > 0 && (
            <Card><CardContent className="px-0 pt-4 sm:px-6">
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>{t("acct.date")}</TableHead><TableHead>{t("acct.mat.supplier")}</TableHead><TableHead className="hidden sm:table-cell">{t("acct.method")}</TableHead><TableHead className="text-right">{t("acct.amount")}</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>{supPays.rows.map((p, __i: number) => (
                  <FadeRow index={__i} key={p.id}>
                    <TableCell>{fmtDate(p.pay_date, locale)}</TableCell><TableCell>{p.supplier_name}{p.reference && <span className="text-xs text-muted-foreground"> · {p.reference}</span>}</TableCell>
                    <TableCell className="hidden sm:table-cell">{p.method ? t(`acct.method.${p.method}`) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(p.amount, locale)}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" aria-label={t("acct.delete")} onClick={() => del(supPays, p.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </FadeRow>
                ))}</TableBody>
              </Table></div>
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ---------- dialogs ---------- */}
      <Dialog open={dlg !== null} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {dlg === "material" && (<>
            <DialogHeader><DialogTitle>{form.id ? t("acct.mat.editMaterial") : t("acct.mat.newMaterial")}</DialogTitle><DialogDescription>{t("acct.mat.materialHint")}</DialogDescription></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("acct.name") + " *"} className="sm:col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label={t("acct.category")}><Input value={form.category || ""} placeholder={t("acct.mat.categoryPh")} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
              <Field label={t("acct.unit")}><Input value={form.unit} placeholder="gal, cubeta, rollo…" onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
              <Field label={t("acct.unitCost") + " (USD)"}><Input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} /></Field>
              <Field label={t("acct.mat.salePrice") + " (USD)"}><Input type="number" min="0" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} /></Field>
              <Field label={t("acct.mat.supplier")}>{supSelect(form.supplier_id, (v) => setForm({ ...form, supplier_id: v }))}</Field>
              <Field label={t("acct.mat.minStock")}><Input type="number" min="0" step="1" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></Field>
              <Field label="SKU"><Input value={form.sku || ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm sm:mt-7"><Checkbox checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: !!v })} />{t("acct.status.active")}</label>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDlg(null)}>{t("acct.cancel")}</Button>
              <Button onClick={() => run(() => { const body = { ...form, supplier_id: idOrNull(form.supplier_id), unit_cost: Number(form.unit_cost) || 0, sale_price: Number(form.sale_price) || 0, min_stock: Number(form.min_stock) || 0 }; return form.id ? mats.update(body) : mats.create(body) })}>{t("acct.save")}</Button></DialogFooter>
          </>)}

          {dlg === "purchase" && (<>
            <DialogHeader><DialogTitle>{t("acct.mat.newPurchase")}</DialogTitle><DialogDescription>{t("acct.mat.purchaseHint")}</DialogDescription></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("acct.date") + " *"}><Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></Field>
              <Field label={t("acct.mat.material") + " *"}>{matSelect(form.material_id, (v) => { const m = mats.rows.find((x) => String(x.id) === v); setForm({ ...form, material_id: v, unit_cost: m ? String(m.unit_cost) : form.unit_cost, supplier_id: m?.supplier_id ? String(m.supplier_id) : form.supplier_id }) })}</Field>
              <Field label={t("acct.qty") + " *"}><Input type="number" min="0" step="0.001" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
              <Field label={t("acct.unitCost") + " (USD)"}><Input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} /></Field>
              <Field label={t("acct.mat.supplier")}>{supSelect(form.supplier_id, (v) => setForm({ ...form, supplier_id: v }))}</Field>
              <Field label={t("acct.project")}>{projSelect(form.project_id, (v) => setForm({ ...form, project_id: v }))}</Field>
              <Field label={t("acct.mat.payStatus")}>
                <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="paid">{t("acct.mat.status.paid")}</SelectItem><SelectItem value="credit">{t("acct.mat.status.credit")}</SelectItem></SelectContent>
                </Select>
              </Field>
              {form.payment_status === "credit"
                ? <Field label={t("acct.due")}><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
                : <Field label={t("acct.method")}><Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{t(`acct.method.${m}`)}</SelectItem>)}</SelectContent></Select></Field>}
              <Field label={t("acct.mat.invoiceRef")}><Input value={form.invoice_ref} onChange={(e) => setForm({ ...form, invoice_ref: e.target.value })} /></Field>
              <div className="flex items-end text-sm font-semibold sm:justify-end">{t("acct.total")}: {fmtMoney((Number(form.quantity) || 0) * (Number(form.unit_cost) || 0), locale)}</div>
              {form.project_id !== "none" && <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={form.consume} onCheckedChange={(v) => setForm({ ...form, consume: !!v })} />{t("acct.mat.consumeDirect")}</label>}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDlg(null)}>{t("acct.cancel")}</Button>
              <Button onClick={() => run(() => purchases.create({ ...form, material_id: Number(form.material_id), supplier_id: idOrNull(form.supplier_id), project_id: idOrNull(form.project_id), quantity: Number(form.quantity), unit_cost: Number(form.unit_cost) || 0, due_date: form.payment_status === "credit" ? form.due_date || null : null, consume_to_project: form.consume && form.project_id !== "none" }))}>{t("acct.save")}</Button></DialogFooter>
          </>)}

          {dlg === "usage" && (<>
            <DialogHeader><DialogTitle>{t("acct.mat.newUsage")}</DialogTitle><DialogDescription>{t("acct.mat.usageHint")}</DialogDescription></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("acct.date") + " *"}><Input type="date" value={form.usage_date} onChange={(e) => setForm({ ...form, usage_date: e.target.value })} /></Field>
              <Field label={t("acct.mat.material") + " *"}>{matSelect(form.material_id, (v) => setForm({ ...form, material_id: v }))}</Field>
              <Field label={t("acct.qty") + " *"}><Input type="number" min="0" step="0.001" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
              <Field label={t("acct.project")}>{projSelect(form.project_id, (v) => setForm({ ...form, project_id: v }))}</Field>
              <Field label={t("acct.notes")} className="sm:col-span-2"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              {form.material_id && <p className="text-xs text-muted-foreground sm:col-span-2">{t("acct.mat.stock")}: {fmtNum(mats.rows.find((m) => String(m.id) === form.material_id)?.stock, 3)} · {t("acct.mat.avgCost")}: {fmtMoney(mats.rows.find((m) => String(m.id) === form.material_id)?.avg_cost, locale)}</p>}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDlg(null)}>{t("acct.cancel")}</Button>
              <Button onClick={() => run(() => usage.create({ ...form, material_id: Number(form.material_id), project_id: idOrNull(form.project_id), quantity: Number(form.quantity) }))}>{t("acct.save")}</Button></DialogFooter>
          </>)}

          {dlg === "supplier" && (<>
            <DialogHeader><DialogTitle>{form.id ? t("acct.edit") : t("acct.mat.newSupplier")}</DialogTitle><DialogDescription>{t("acct.mat.supplierHint")}</DialogDescription></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("acct.name") + " *"} className="sm:col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label={t("acct.contact")}><Input value={form.contact || ""} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
              <Field label={t("acct.phone")}><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label={t("acct.email")}><Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label={t("acct.mat.terms") + ` (${t("acct.daysShort")})`}><Input type="number" min="0" value={form.payment_terms_days} onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })} /></Field>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDlg(null)}>{t("acct.cancel")}</Button>
              <Button onClick={() => run(() => { const b = { ...form, payment_terms_days: Number(form.payment_terms_days) || 0 }; return form.id ? sups.update(b) : sups.create(b) })}>{t("acct.save")}</Button></DialogFooter>
          </>)}

          {dlg === "supplierPay" && (<>
            <DialogHeader><DialogTitle>{t("acct.mat.paySupplier")}</DialogTitle><DialogDescription>{t("acct.mat.paySupplierHint")}</DialogDescription></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("acct.mat.supplier") + " *"} className="sm:col-span-2">{supSelect(form.supplier_id, (v) => { const pb = payables.find((p) => String(p.id) === v); setForm({ ...form, supplier_id: v, amount: pb && pb.balance > 0 ? String(pb.balance) : form.amount }) }, false)}</Field>
              <Field label={t("acct.date")}><Input type="date" value={form.pay_date} onChange={(e) => setForm({ ...form, pay_date: e.target.value })} /></Field>
              <Field label={t("acct.amount") + " (USD) *"}><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
              <Field label={t("acct.method")}><Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{t(`acct.method.${m}`)}</SelectItem>)}</SelectContent></Select></Field>
              <Field label={t("acct.reference")}><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDlg(null)}>{t("acct.cancel")}</Button>
              <Button onClick={() => run(() => supPays.create({ ...form, supplier_id: Number(form.supplier_id), amount: Number(form.amount) }))}>{t("acct.save")}</Button></DialogFooter>
          </>)}
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
