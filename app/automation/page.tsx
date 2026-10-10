"use client"

import { MainLayout } from "@/components/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Plus, Zap, Mail, Bell, Calendar, TrendingUp } from "lucide-react"
import { useDataStore } from "@/lib/data-store"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"

// Read workflows from the centralized data store (populated from DB/file)
// Dashboard metrics are computed from the workflows list so nothing is hardcoded here.

export default function AutomationPage() {
  const workflows = useDataStore((s) => s.workflows ?? [])

  const totalCount = workflows.length
  const activeCount = workflows.filter((w) => (w.status || "").toString().toLowerCase() === "active").length
  const inactiveCount = totalCount - activeCount
  const totalRuns = workflows.reduce((sum, w) => sum + (Number((w as any).runs) || 0), 0)
  const timeSavedHours = Math.round(totalRuns * 0.05) // heuristic: 0.05h saved per run
  const successRate = totalCount > 0 ? Math.round((activeCount / totalCount) * 1000) / 10 : 0

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Automation</h2>
              <p className="text-muted-foreground">Streamline your workflows with automated processes</p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="brand">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Workflow
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Workflow</DialogTitle>
                  <DialogDescription>Define a workflow trigger and actions.</DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const form = e.target as HTMLFormElement & {
                      name: { value: string }
                      description: { value: string }
                      trigger: { value: string }
                      actions: { value: string }
                    }
                    const name = form.name.value
                    const description = form.description.value
                    const trigger = form.trigger.value
                    const actions = form.actions.value.split(",").map((a) => a.trim()).filter(Boolean)
                    const newWorkflow = {
                      id: String(Date.now()),
                      name,
                      description,
                      trigger,
                      actions,
                      status: "Active",
                      runs: 0,
                    }
                    useDataStore.getState().addWorkflow(newWorkflow as any)
                    ;(e.target as HTMLFormElement).reset()
                    // close dialog by clicking the close button programmatically
                  }}
                >
                  <div className="grid gap-2">
                    <div>
                      <Label>Nombre</Label>
                      <Input name="name" required />
                    </div>
                    <div>
                      <Label>Descripción</Label>
                      <Input name="description" />
                    </div>
                    <div>
                      <Label>Trigger</Label>
                      <Input name="trigger" placeholder="e.g. New Lead Created" />
                    </div>
                    <div>
                      <Label>Actions (separate by comma)</Label>
                      <Input name="actions" placeholder="Send Email,Create Task" />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="submit">Create</Button>
                    </DialogClose>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Workflows</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeCount}</div>
                <p className="text-xs text-muted-foreground">{inactiveCount} inactive</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Runs</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalRuns}</div>
                <p className="text-xs text-green-600">runs total</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Time Saved</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{timeSavedHours}h</div>
                <p className="text-xs text-muted-foreground">Estimated saved time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{successRate}%</div>
                <p className="text-xs text-green-600">active workflows</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4">
            {workflows.map((workflow) => (
              <Card key={workflow.id}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-600/10">
                      <Zap className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{workflow.name}</h3>
                          <p className="text-sm text-muted-foreground">{workflow.description}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={(workflow.status || "").toString().toLowerCase() === "active" ? "default" : "secondary"}>
                            {workflow.status}
                          </Badge>
                          <Switch checked={(workflow.status || "").toString().toLowerCase() === "active"} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">TRIGGER</p>
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-blue-600" />
                            <span>{workflow.trigger}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">ACTIONS</p>
                          <div className="flex flex-wrap gap-1">
                            {workflow.actions.map((action) => (
                              <Badge key={action} variant="outline" className="text-xs">
                                {action}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">PERFORMANCE</p>
                          <p className="text-sm">{workflow.runs} runs this month</p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button variant="outline" size="sm">
                          View Logs
                        </Button>
                        <Button variant="outline" size="sm">
                          Duplicate
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
