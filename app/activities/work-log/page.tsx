"use client"

import { useState } from "react"
import { MainLayout } from "@/components/main-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDataStore, Worker, WorkerDay, ProjectAccounting } from "@/lib/data-store"
import { useI18n } from "@/lib/i18n"
import { useAuthStore } from "@/lib/auth-store"
import { formatUSD } from "@/lib/money"

function formatUSDate(dateStr: string) {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

export default function WorkLogPage() {
  const authUsers = useAuthStore((s) => s.users)
  const teamMembers = (authUsers || []).filter((u) => String(u.role || '').toLowerCase() === 'worker')
  const projectAccounting = useDataStore((s) => s.projectAccounting)
        // getWorkerStatus is declared later (after selectedEmployees is defined)
  const addProjectAccounting = useDataStore((s) => s.updateProjectAccounting)
  const changeWorkerStatusStore = useDataStore((s) => (s as any).changeWorkerStatus)
  const approveWorkerDayStore = useDataStore((s) => (s as any).approveWorkerDay)

  const [jobDate, setJobDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [durationDays, setDurationDays] = useState<number>(1)
  const [selectedEmployees, setSelectedEmployees] = useState<
    Record<
      string,
      {
        name: string
        payment: number
        status: "AVAILABLE" | "WORKING" | "PAID"
        salaryType?: "daily" | "hourly"
        salaryRate?: number
        days?: WorkerDay[]
      }
    >
  >({})

  const [useStandardPricing, setUseStandardPricing] = useState<boolean>(false)
  const [standardDailyRate, setStandardDailyRate] = useState<number>(0)

  const [laborCost, setLaborCost] = useState<number>(0)
  const [materialsCost, setMaterialsCost] = useState<number>(0)
  const [materialsCharged, setMaterialsCharged] = useState<number>(0)
  const [insuranceCost, setInsuranceCost] = useState<number>(0)
  const [otherExpenses, setOtherExpenses] = useState<number>(0)
  const [additionalRevenue, setAdditionalRevenue] = useState<number>(0)
  const [note, setNote] = useState<string>("")

  const toggleEmployee = (id: string, name: string) => {
    setSelectedEmployees((s) => {
      const copy = { ...s }
      if (copy[id]) delete copy[id]
      else
          copy[id] = {
            name,
            payment: useStandardPricing ? standardDailyRate * durationDays : 0,
            status: "AVAILABLE",
            salaryType: "daily",
            salaryRate: useStandardPricing ? standardDailyRate : 0,
            days: [],
          }
      return copy
    })
  }

  const getWorkerStatus = (id: string) => {
    for (const acct of projectAccounting) {
      const w = (acct.workers || []).find((x) => x.id === id)
      if (w) return w.status || 'AVAILABLE'
    }
    return selectedEmployees[id]?.status || 'AVAILABLE'
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'WORKING':
        return 'bg-blue-100 text-blue-800'
      case 'PAID':
        return 'bg-green-100 text-green-800'
      case 'ON_COMPLAINT':
        return 'bg-yellow-100 text-yellow-800'
      case 'PENDING_PAYMENT':
        return 'bg-amber-100 text-amber-800'
      case 'AVAILABLE':
        return 'bg-muted text-muted-foreground'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const updateEmployeePayment = (id: string, value: number) => {
    setSelectedEmployees((s) => ({ ...s, [id]: { ...s[id], payment: value } }))
  }

  // When standard pricing or duration changes, update selected employee payments
  const applyStandardRateToSelected = () => {
    if (!useStandardPricing) return
    setSelectedEmployees((s) => {
      const out: typeof s = {}
      for (const [id, e] of Object.entries(s)) {
        out[id] = {
          ...e,
          payment: standardDailyRate * durationDays,
          salaryRate: standardDailyRate,
        }
      }
      return out
    })
  }

  // call apply when relevant values change
  // lightweight manual effect replacement (called in handlers)

  const computeTotals = () => {
    const employeePayments = Object.values(selectedEmployees).reduce((sum, e) => {
      const daysTotal = (e.days && e.days.length > 0) ? e.days.reduce((s, d) => s + d.payment, 0) : 0
      return sum + (daysTotal || e.payment || 0)
    }, 0)
    const totalCosts = laborCost + materialsCost + insuranceCost + otherExpenses + employeePayments
    const totalRevenue = materialsCharged + additionalRevenue
    const profit = totalRevenue - totalCosts
    const materialsProfit = materialsCharged - materialsCost
    return { employeePayments, totalCosts, totalRevenue, profit, materialsProfit }
  }

  const handleSave = () => {
    if (useStandardPricing) applyStandardRateToSelected()
    const { profit } = computeTotals()

    const workers: Worker[] = Object.entries(selectedEmployees).map(([id, e]) => {
      const days = e.days && e.days.length > 0
        ? e.days
        : [
            {
              id: `${id}-${Date.now()}`,
              dayOfWeek: formatUSDate(jobDate),
              hours: durationDays * 8,
              payment: e.payment || 0,
            },
          ]

      const totalPayment = days.reduce((sum, d) => sum + d.payment, 0)

      return {
        id,
        name: e.name,
        days,
        totalPayment,
        status: e.status,
        salaryType: e.salaryType,
        salaryRate: e.salaryRate,
      } as Worker
    })

    const accounting: ProjectAccounting = {
      projectId: `worklog-${Date.now()}`,
      totalPrice: materialsCharged + additionalRevenue,
      labor: laborCost,
      materials: materialsCost,
      insurance: insuranceCost,
      profit,
      workers,
    }

    addProjectAccounting(accounting)
    // After persisting accounting, call store methods to record confirmations and paid status
    const pid = accounting.projectId
    // approve confirmed days and record paid status
    Object.entries(selectedEmployees).forEach(([id, e]) => {
      ;(e.days || []).forEach((d) => {
        if (d.confirmed) {
          try {
            approveWorkerDayStore(pid, id, d.id, "admin")
          } catch (err) {
            // ignore in client-side dev
          }
        }
      })
      if (e.status === "PAID") {
        try {
          changeWorkerStatusStore(pid, id, "PAID", "admin")
        } catch (err) {
          // ignore
        }
      }
    })

    alert("Work entry saved (English UI).")
  }

  const changeLocalWorkerStatus = (id: string, status: "AVAILABLE" | "WORKING" | "PAID") => {
    setSelectedEmployees((s) => ({ ...s, [id]: { ...s[id], status } }))
  }

  const handleAdminEditStatus = (memberId: string) => {
    const options = ['AVAILABLE','WAITING_FOR_ASSIGNMENT','WORKING','PENDING_PAYMENT','ON_COMPLAINT','PAID','RESIGNED']
    const choice = window.prompt(`Set status for worker ${memberId}. Options: ${options.join(', ')}`)
    if (!choice) return
    const status = choice.trim().toUpperCase()
    if (!options.includes(status)) {
      alert('Invalid status')
      return
    }
    const acct = projectAccounting.find((p) => (p.workers || []).some((w) => w.id === memberId))
    const currentUser = useAuthStore.getState().user
    if (acct) {
      try {
        changeWorkerStatusStore(acct.projectId, memberId, status as any, currentUser?.id || 'admin')
      } catch (err) {
        console.error('changeWorkerStatus failed', err)
        alert('Failed to change status')
      }
    } else if (selectedEmployees[memberId]) {
      // fallback to local selection
      changeLocalWorkerStatus(memberId, status === 'PAID' ? 'PAID' : (status === 'WORKING' ? 'WORKING' : 'AVAILABLE'))
    } else {
      alert('Worker is not attached to a project accounting entry. Create a work entry first or select the worker locally.')
    }
  }

  const addDayForLocalWorker = (id: string, dateStr: string, payment: number, confirmed = false) => {
    setSelectedEmployees((s) => {
      const cur = s[id]
      if (!cur) return s
      if (cur.status !== "WORKING") return s
      const newDay: WorkerDay = { id: `${id}-${Date.now()}`, dayOfWeek: formatUSDate(dateStr), hours: 8, payment, confirmed }
      const days = [...(cur.days || []), newDay]
      return { ...s, [id]: { ...cur, days, payment: days.reduce((sum, d) => sum + d.payment, 0) } }
    })
  }

  const removeLocalDay = (id: string, dayId: string) => {
    setSelectedEmployees((s) => {
      const cur = s[id]
      if (!cur) return s
      if (cur.status === "PAID") return s
      const days = (cur.days || []).filter((d) => d.id !== dayId)
      return { ...s, [id]: { ...cur, days, payment: days.reduce((sum, d) => sum + d.payment, 0) } }
    })
  }

  const generatePrintableHTML = (accounting: ProjectAccounting, noteText: string) => {
    const rows = accounting.workers
      .map((w) => `<tr><td>${w.name}</td><td>${w.days.map((d) => d.dayOfWeek).join(', ')}</td><td>${formatUSD(w.totalPayment)}</td></tr>`)
      .join('')

    return `
      <html>
        <head>
          <title>Work Entry ${accounting.projectId}</title>
          <style>body{font-family:Arial,Helvetica,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}</style>
        </head>
        <body>
          <h1>Work Entry</h1>
          <p><strong>Date:</strong> ${formatUSDate(jobDate)}</p>
          <p><strong>Duration (days):</strong> ${durationDays}</p>
          <h2>Workers</h2>
          <table>
            <thead><tr><th>Name</th><th>Days</th><th>Payment</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <h2>Accounting</h2>
          <p>Labor: ${formatUSD(accounting.labor)}</p>
          <p>Materials cost: ${formatUSD(accounting.materials)}</p>
          <p>Materials charged: ${formatUSD(accounting.totalPrice)}</p>
          <p>Insurance: ${formatUSD(accounting.insurance)}</p>
          <p><strong>Profit:</strong> ${formatUSD(accounting.profit)}</p>
          <h3>Note</h3>
          <p>${noteText}</p>
        </body>
      </html>
    `
  }

  const handleExportPDF = () => {
    if (useStandardPricing) applyStandardRateToSelected()
    const { profit } = computeTotals()
    const workers: Worker[] = Object.entries(selectedEmployees).map(([id, e]) => {
      const day: WorkerDay = {
        id: `${id}-${Date.now()}`,
        dayOfWeek: formatUSDate(jobDate),
        hours: durationDays * 8,
        payment: e.payment || 0,
      }

      return {
        id,
        name: e.name,
        days: [day],
        totalPayment: day.payment,
      }
    })

    const accounting: ProjectAccounting = {
      projectId: `worklog-${Date.now()}`,
      totalPrice: materialsCharged + additionalRevenue,
      labor: laborCost,
      materials: materialsCost,
      insurance: insuranceCost,
      profit,
      workers,
    }

    const html = generatePrintableHTML(accounting, note)
    const w = window.open('', '_blank')
    if (!w) {
      alert('Unable to open print window; allow popups or use the Save action.')
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()
    // small timeout to ensure render then print
    setTimeout(() => {
      w.print()
    }, 500)
  }

  const totals = computeTotals()

  const [newDayInputs, setNewDayInputs] = useState<Record<string, { date: string; payment: number; confirmed?: boolean }>>({})

  const { t } = useI18n()

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">{t("worklog.title")}</h2>
          <p className="text-muted-foreground">{t("worklog.description")}</p>
        </div>

        <Card>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                <Label>{t("worklog.dateLabel")}</Label>
                <Input type="date" value={jobDate} onChange={(e) => setJobDate(e.target.value)} />
                <div className="text-sm text-muted-foreground mt-1">{t("worklog.preview")}: {formatUSDate(jobDate)}</div>
              </div>

              <div>
                <Label>{t("worklog.durationLabel")}</Label>
                <Input type="number" value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} />
              </div>
            </div>

            <div className="mt-4">
              <Label>{t("worklog.employeesLabel")}</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {teamMembers.length === 0 && <div className="text-sm text-muted-foreground">{t("worklog.noTeamMembers")}</div>}
                {teamMembers.map((m) => {
                  const sel = selectedEmployees[m.id]
                  const acct = projectAccounting.find((p) => (p.workers || []).some((w) => w.id === m.id))
                  const workerStatus = getWorkerStatus(m.id)
                  const currentUser = useAuthStore.getState().user
                  return (
                    <div key={m.id} className="border p-2 rounded">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={!!sel} onChange={() => toggleEmployee(m.id, m.name)} />
                        <div className="flex-1">
                          <div className="font-medium">{m.name}</div>
                          <div className="text-sm text-muted-foreground">{m.role}</div>
                        </div>
                        {sel && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{t("worklog.statusLabel")}</span>
                              <Badge className={statusColor(workerStatus)}>{workerStatus}</Badge>
                            </div>
                            {/* Allow quick local changes */}
                            <Button size="icon" variant="ghost" onClick={() => changeLocalWorkerStatus(m.id, "AVAILABLE")}>{t("btn.tbh")}</Button>
                            <Button size="icon" variant="ghost" onClick={() => changeLocalWorkerStatus(m.id, "WORKING")}>{t("btn.wrk")}</Button>
                            <Button size="icon" variant="ghost" onClick={() => changeLocalWorkerStatus(m.id, "PAID")}>{t("btn.pd")}</Button>
                            {/* If worker exists in project accounting and current user is admin, call store change */}
                            {currentUser?.role === 'admin' && acct && (
                              <div className="flex items-center gap-1">
                                <Button size="icon" variant="outline" onClick={() => changeWorkerStatusStore(acct.projectId, m.id, 'WAITING_FOR_ASSIGNMENT', currentUser.id)}>A</Button>
                                <Button size="icon" variant="outline" onClick={() => changeWorkerStatusStore(acct.projectId, m.id, 'WORKING', currentUser.id)}>W</Button>
                                <Button size="icon" variant="outline" onClick={() => changeWorkerStatusStore(acct.projectId, m.id, 'PENDING_PAYMENT', currentUser.id)}>C</Button>
                                <Button size="icon" variant="outline" onClick={() => changeWorkerStatusStore(acct.projectId, m.id, 'PAID', currentUser.id)}>P</Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {sel && (
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                          <div>
                            <Label>{t("worklog.salaryRate")}</Label>
                            <Input type="number" value={sel.salaryRate || 0} onChange={(e) => setSelectedEmployees((s) => ({ ...s, [m.id]: { ...s[m.id], salaryRate: Number(e.target.value) } }))} />
                          </div>
                          <div>
                            <Label>{t("worklog.currentTotal")}</Label>
                            <div className="font-semibold">{formatUSD((sel.payment || 0))}</div>
                          </div>
                          <div>
                            <Label>{t("worklog.manualOverride")}</Label>
                            <Input type="number" value={sel.payment} onChange={(e) => updateEmployeePayment(m.id, Number(e.target.value))} disabled={sel.status === "PAID"} />
                          </div>
                        </div>
                      )}

                      {sel && (
                        <div className="mt-3">
                          <div className="text-sm font-medium">{t("worklog.workedDays")}</div>
                          <div className="space-y-2 mt-2">
                            {(sel.days || []).map((d) => (
                              <div key={d.id} className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="text-sm">{d.dayOfWeek}</div>
                                  <div className="text-xs text-muted-foreground">{t("worklog.hoursLabel")} {d.hours}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="font-medium">{formatUSD(d.payment)}</div>
                                  <Button variant="ghost" size="icon" onClick={() => removeLocalDay(m.id, d.id)} disabled={sel.status === "PAID"}>{t("worklog.remove")}</Button>
                                </div>
                              </div>
                            ))}
                            {sel.status === "WORKING" && (
                              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                                <div>
                                  <Label>{t("worklog.dateLabel")}</Label>
                                  <Input type="date" value={(newDayInputs[m.id] && newDayInputs[m.id].date) || ""} onChange={(e) => setNewDayInputs((p) => ({ ...p, [m.id]: { ...(p[m.id] || { date: "", payment: 0 }), date: e.target.value } }))} />
                                </div>
                                <div>
                                  <Label>{t("worklog.paymentLabel")}</Label>
                                  <Input type="number" value={(newDayInputs[m.id] && newDayInputs[m.id].payment) || 0} onChange={(e) => setNewDayInputs((p) => ({ ...p, [m.id]: { ...(p[m.id] || { date: "", payment: 0, confirmed: false }), payment: Number(e.target.value) } }))} />
                                </div>
                                <div>
                                  <Label className="flex items-center gap-2"><input type="checkbox" checked={(newDayInputs[m.id] && newDayInputs[m.id].confirmed) || false} onChange={(e) => setNewDayInputs((p) => ({ ...p, [m.id]: { ...(p[m.id] || { date: "", payment: 0, confirmed: false }), confirmed: e.target.checked } }))} /> {t("worklog.confirmed")}</Label>
                                  <Button onClick={() => { const val = newDayInputs[m.id] || { date: jobDate, payment: sel.salaryRate || sel.payment || 0, confirmed: false }; addDayForLocalWorker(m.id, val.date, val.payment, !!val.confirmed); setNewDayInputs((p) => ({ ...p, [m.id]: { date: "", payment: 0, confirmed: false } })); }}>{t("worklog.addDay")}</Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <Label>Labor cost</Label>
                <Input type="number" value={laborCost} onChange={(e) => setLaborCost(Number(e.target.value))} />
              </div>
              <div>
                <Label>Materials cost</Label>
                <Input type="number" value={materialsCost} onChange={(e) => setMaterialsCost(Number(e.target.value))} />
              </div>
              <div>
                <Label>Materials charged (revenue)</Label>
                <Input type="number" value={materialsCharged} onChange={(e) => setMaterialsCharged(Number(e.target.value))} />
              </div>
              <div>
                <Label>Insurance</Label>
                <Input type="number" value={insuranceCost} onChange={(e) => setInsuranceCost(Number(e.target.value))} />
              </div>
              <div>
                <Label>Other expenses</Label>
                <Input type="number" value={otherExpenses} onChange={(e) => setOtherExpenses(Number(e.target.value))} />
              </div>
              <div>
                <Label>Additional revenue</Label>
                <Input type="number" value={additionalRevenue} onChange={(e) => setAdditionalRevenue(Number(e.target.value))} />
              </div>
            </div>

            <div className="mt-4">
              <Label>{t("worklog.note")}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("worklog.notePlaceholder")} />
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded">
                <div className="text-sm text-muted-foreground">{t("worklog.employeePayments")}</div>
                <div className="font-semibold">{formatUSD(totals.employeePayments)}</div>
              </div>
              <div className="p-4 border rounded">
                <div className="text-sm text-muted-foreground">{t("worklog.materialsProfit")}</div>
                <div className="font-semibold">{formatUSD(totals.materialsProfit)}</div>
              </div>
              <div className="p-4 border rounded">
                <div className="text-sm text-muted-foreground">{t("worklog.totalProfit")}</div>
                <div className="font-semibold">{formatUSD(totals.profit)}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={useStandardPricing} onChange={(e) => { setUseStandardPricing(e.target.checked); if (e.target.checked) applyStandardRateToSelected() }} />
                <span>{t("worklog.useStandardRate")}</span>
              </label>
              {useStandardPricing && (
                <div className="flex items-center gap-2">
                  <Label>{t("worklog.standardDailyRate")}</Label>
                  <Input type="number" value={standardDailyRate} onChange={(e) => { setStandardDailyRate(Number(e.target.value)); applyStandardRateToSelected() }} />
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>{t("worklog.cancel")}</Button>
              <Button onClick={handleSave}>{t("worklog.save")}</Button>
              <Button onClick={handleExportPDF}>{t("worklog.export")}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
