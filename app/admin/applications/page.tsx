"use client"

import React, { useEffect, useState } from "react"
import { MainLayout } from "@/components/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/lib/auth-store"
import { useToast } from "@/hooks/use-toast"

export default function ApplicationsPage() {
  const { getApplications, reviewApplication, loadUsers } = useAuthStore()
  const { toast } = useToast()
  const [apps, setApps] = useState<any[]>([])

  const load = async () => {
    try {
      const rows = await getApplications()
      setApps(rows || [])
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => { load() }, [])

  const handleReview = async (id: number, status: 'APPROVED'|'REJECTED') => {
    const reason = prompt('Provide a reason (required)') || ''
    if (reason.trim().length === 0) {
      alert('Reason required')
      return
    }
    const ok = await reviewApplication(id, status, reason)
    if (ok) {
      toast({ title: 'Success', description: `Application ${status}` })
      await load()
      try { await loadUsers() } catch (e) {}
    } else {
      toast({ title: 'Error', description: 'Failed to update application', variant: 'destructive' })
    }
  }

  return (
    <MainLayout>
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">Job Applications</h2>
        <div className="space-y-4">
          {apps.length === 0 && <div className="text-sm text-muted-foreground">No applications</div>}
          {apps.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle>{a.name} — <span className="text-xs">{a.status}</span></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-2">Email: {a.email}</div>
                <div className="mb-2">Skills: {a.skills}</div>
                <div className="mb-2">Availability: {a.availability}</div>
                <div className="mb-2">Message: {a.message}</div>
                <div className="flex gap-2">
                  <Button onClick={() => handleReview(a.id, 'APPROVED')}>Approve</Button>
                  <Button variant="outline" onClick={() => handleReview(a.id, 'REJECTED')}>Reject</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  )
}
