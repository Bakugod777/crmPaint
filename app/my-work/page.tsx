"use client"

import { useEffect, useState } from "react"
import { CalendarDays, Wallet, HandCoins } from "lucide-react"
import { PageShell, Stat, Empty } from "@/components/accounting/page-shell"
import { DateRange } from "@/components/accounting/date-range"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FadeRow } from "@/components/motion/fade-row"
import { TableSkeleton } from "@/components/motion/table-skeleton"
import { useI18n } from "@/lib/i18n"
import { api, fmtMoney, fmtDate, monthStartStr, todayStr, useResource } from "@/lib/acct-client"

// Employee self-service: own attendance, own payments and balance (read-only).
export default function MyWorkPage() {
  const { t, locale } = useI18n()
  const [me, setMe] = useState<any>(null)
  const [from, setFrom] = useState(monthStartStr())
  const [to, setTo] = useState(todayStr())
  useEffect(() => { api("me").then(setMe).catch(() => setMe({ employee: null })) }, [])
  const hasEmp = !!me?.employee
  const att = useResource<any>(hasEmp ? "attendance" : "me", { from, to })
  const pays = useResource<any>(hasEmp ? "employee_payments" : "me", { from, to })
  const m = (n: any) => fmtMoney(n, locale)
  const periodAmt = att.rows.reduce((s, r) => s + Number(r.amount || 0), 0)

  return (
    <PageShell title={t("acct.my.title")} subtitle={me?.employee ? `${me.employee.name}${me.employee.position ? " · " + me.employee.position : ""}` : t("acct.my.subtitle")}>
      {!me ? <TableSkeleton rows={6} /> : !hasEmp ? <Empty text={t("acct.my.notLinked")} /> : (<>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat title={t("acct.my.totalDays")} value={me.totals.days} icon={CalendarDays} hint={me.employee.pay_type === "hourly" && me.totals.hours ? `${me.totals.hours} h` : undefined} />
          <Stat title={t("acct.my.earned")} value={m(me.totals.earned)} />
          <Stat title={t("acct.my.received")} value={m(me.totals.payment + me.totals.advance)} icon={HandCoins} />
          <Stat title={t("acct.pay.owed")} value={m(me.totals.owed)} tone={me.totals.owed > 0 ? "warn" : "good"} icon={Wallet} />
        </div>
        <Card><CardContent className="pt-6"><DateRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt) }} /></CardContent></Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("acct.att.title")} · {m(periodAmt)}</CardTitle></CardHeader>
            <CardContent>{att.rows.length === 0 ? <Empty text={t("acct.noData")} /> : (
              <Table>
                <TableHeader><TableRow><TableHead>{t("acct.date")}</TableHead><TableHead>{t("acct.project")}</TableHead><TableHead className="text-right">{t("acct.att.days")}</TableHead><TableHead className="text-right">{t("acct.amount")}</TableHead></TableRow></TableHeader>
                <TableBody>{att.rows.map((r, __i: number) => (
                  <FadeRow index={__i} key={r.id}><TableCell>{fmtDate(r.work_date, locale)}</TableCell><TableCell className="max-w-[140px] truncate">{r.project_name || "—"}</TableCell><TableCell className="text-right tabular-nums">{r.pay_type === "hourly" ? `${r.hours} h` : r.days}</TableCell><TableCell className="text-right tabular-nums">{m(r.amount)}</TableCell></FadeRow>
                ))}</TableBody>
              </Table>
            )}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">{t("acct.my.payments")}</CardTitle></CardHeader>
            <CardContent>{pays.rows.length === 0 ? <Empty text={t("acct.noData")} /> : (
              <Table>
                <TableHeader><TableRow><TableHead>{t("acct.date")}</TableHead><TableHead>{t("acct.type")}</TableHead><TableHead className="text-right">{t("acct.amount")}</TableHead></TableRow></TableHeader>
                <TableBody>{pays.rows.map((r, __i: number) => (
                  <FadeRow index={__i} key={r.id}><TableCell>{fmtDate(r.pay_date, locale)}</TableCell><TableCell>{t(`acct.pay.type.${r.type}`)}</TableCell><TableCell className="text-right tabular-nums">{m(r.amount)}</TableCell></FadeRow>
                ))}</TableBody>
              </Table>
            )}</CardContent>
          </Card>
        </div>
      </>)}
    </PageShell>
  )
}
