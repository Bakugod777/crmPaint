"use client"

import { useState } from "react"
import Link from "next/link"
import { Download, Save, Tag, Package, Search } from "lucide-react"
import { PageShell, Stat, Empty } from "@/components/accounting/page-shell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FadeRow } from "@/components/motion/fade-row"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/hooks/use-toast"
import { useResource, fmtMoney, downloadCSV } from "@/lib/acct-client"

// Price list = services/products (products table) + material sale prices (materials table).
// These prices are offered as line items when creating invoices.
export default function PriceListPage() {
  const { t, locale } = useI18n()
  const { toast } = useToast()
  const products = useResource<any>("products")
  const mats = useResource<any>("materials", { active: 1 })
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")
  const match = (s: string) => !search || s.toLowerCase().includes(search.toLowerCase())

  const saveRow = async (kind: "p" | "m", row: any) => {
    const v = edits[`${kind}${row.id}`]
    if (v === undefined) return
    try {
      if (kind === "p") await products.update({ id: row.id, price: Number(v) || 0 })
      else await mats.update({ id: row.id, sale_price: Number(v) || 0 })
      setEdits((e) => { const c = { ...e }; delete c[`${kind}${row.id}`]; return c })
      toast({ title: t("acct.saved") })
    } catch (e: any) { toast({ title: t("acct.error"), description: e.message, variant: "destructive" }) }
  }

  const margin = (m: any) => (Number(m.sale_price) > 0 ? ((Number(m.sale_price) - Number(m.avg_cost)) / Number(m.sale_price)) * 100 : null)
  const avgMargin = (() => { const ms = mats.rows.map(margin).filter((x) => x !== null) as number[]; return ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : null })()

  const exportAll = () => downloadCSV("lista-de-precios.csv", [
    ...products.rows.map((p) => ({ type: t("acct.price.service"), name: p.name, category: p.category, unit: p.unit, cost: "", price: p.price })),
    ...mats.rows.map((m) => ({ type: t("acct.mat.material"), name: m.name, category: m.category, unit: m.unit, cost: m.avg_cost, price: m.sale_price })),
  ], [{ key: "type", label: t("acct.type") }, { key: "name", label: t("acct.name") }, { key: "category", label: t("acct.category") }, { key: "unit", label: t("acct.unit") }, { key: "cost", label: t("acct.cost") }, { key: "price", label: t("acct.price.price") }])

  return (
    <PageShell title={t("acct.price.title")} subtitle={t("acct.price.subtitle")}
      actions={<Button variant="outline" onClick={exportAll}><Download className="mr-2 h-4 w-4" />CSV</Button>}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat title={t("acct.price.services")} value={products.rows.length} icon={Tag} />
        <Stat title={t("acct.price.materials")} value={mats.rows.length} icon={Package} />
        <Stat title={t("acct.price.avgMargin")} value={avgMargin === null ? "—" : `${avgMargin.toFixed(1)}%`} tone={avgMargin !== null && avgMargin < 15 ? "warn" : "good"} />
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder={t("acct.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div><CardTitle>{t("acct.price.services")}</CardTitle><CardDescription>{t("acct.price.servicesHint")}</CardDescription></div>
          <Button asChild size="sm" variant="outline"><Link href="/products">{t("acct.price.manageProducts")}</Link></Button>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {products.rows.length === 0 ? <Empty text={t("acct.price.noServices")} /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>{t("acct.name")}</TableHead><TableHead className="hidden sm:table-cell">{t("acct.category")}</TableHead><TableHead>{t("acct.unit")}</TableHead><TableHead className="w-[180px] text-right">{t("acct.price.price")}</TableHead></TableRow></TableHeader>
              <TableBody>{products.rows.filter((p) => match(`${p.name} ${p.category}`)).map((p, __i: number) => {
                const k = `p${p.id}`
                return (
                  <FadeRow index={__i} key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="hidden sm:table-cell"><Badge variant="outline">{p.category || "—"}</Badge></TableCell>
                    <TableCell>{p.unit || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Input aria-label={t("acct.price.price")} type="number" min="0" step="0.01" className="h-8 w-28 text-right" value={edits[k] ?? String(p.price)} onChange={(e) => setEdits({ ...edits, [k]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && saveRow("p", p)} />
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={edits[k] === undefined} aria-label={t("acct.save")} onClick={() => saveRow("p", p)}><Save className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </FadeRow>
                )
              })}</TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div><CardTitle>{t("acct.price.materials")}</CardTitle><CardDescription>{t("acct.price.materialsHint")}</CardDescription></div>
          <Button asChild size="sm" variant="outline"><Link href="/materials">{t("acct.mat.title")}</Link></Button>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {mats.rows.length === 0 ? <Empty text={t("acct.mat.empty")} /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>{t("acct.mat.material")}</TableHead><TableHead>{t("acct.unit")}</TableHead><TableHead className="text-right">{t("acct.mat.avgCost")}</TableHead><TableHead className="hidden sm:table-cell text-right">{t("acct.price.margin")}</TableHead><TableHead className="w-[180px] text-right">{t("acct.mat.salePrice")}</TableHead></TableRow></TableHeader>
              <TableBody>{mats.rows.filter((m) => match(`${m.name} ${m.category}`)).map((m, __i: number) => {
                const k = `m${m.id}`; const mg = margin(m)
                return (
                  <FadeRow index={__i} key={m.id}>
                    <TableCell className="font-medium">{m.name}<div className="text-xs text-muted-foreground">{m.category}</div></TableCell>
                    <TableCell>{m.unit}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(m.avg_cost, locale)}</TableCell>
                    <TableCell className={`hidden sm:table-cell text-right tabular-nums`}>{mg === null ? "—" : `${mg.toFixed(1)}%`}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Input aria-label={t("acct.mat.salePrice")} type="number" min="0" step="0.01" className="h-8 w-28 text-right" value={edits[k] ?? String(m.sale_price)} onChange={(e) => setEdits({ ...edits, [k]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && saveRow("m", m)} />
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={edits[k] === undefined} aria-label={t("acct.save")} onClick={() => saveRow("m", m)}><Save className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </FadeRow>
                )
              })}</TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}
