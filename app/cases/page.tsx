"use client"

import { useState } from "react"
import { useDataStore } from "@/lib/data-store"
import { MainLayout } from "@/components/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Search, Clock, AlertCircle } from "lucide-react"

const initialCases = [
  {
    id: "CASE-2024-001",
    client: "Acme Corporation",
    subject: "Paint color mismatch in conference room",
    priority: "high",
    status: "open",
    assignedTo: "Sarah Johnson",
    createdDate: "2024-02-01",
    lastUpdate: "2024-02-05",
    description: "Client reports that the paint color doesn't match the approved sample",
  },
  {
    id: "CASE-2024-002",
    client: "Smith Residence",
    subject: "Request for touch-up after inspection",
    priority: "medium",
    status: "in-progress",
    assignedTo: "Mike Chen",
    createdDate: "2024-02-03",
    lastUpdate: "2024-02-06",
    description: "Minor touch-ups needed on window frames",
  },
  {
    id: "CASE-2024-003",
    client: "Downtown Retail LLC",
    subject: "Additional coating request",
    priority: "low",
    status: "resolved",
    assignedTo: "Emily Brown",
    createdDate: "2024-01-28",
    lastUpdate: "2024-02-04",
    description: "Client requested additional protective coating, work completed",
  },
  {
    id: "CASE-2024-004",
    client: "Johnson Property Group",
    subject: "Paint peeling in unit 204",
    priority: "high",
    status: "open",
    assignedTo: "David Wilson",
    createdDate: "2024-02-06",
    lastUpdate: "2024-02-06",
    description: "Paint peeling observed, investigation needed",
  },
  {
    id: "CASE-2024-005",
    client: "Green Valley HOA",
    subject: "Schedule change request",
    priority: "low",
    status: "closed",
    assignedTo: "Sarah Johnson",
    createdDate: "2024-01-25",
    lastUpdate: "2024-01-26",
    description: "Request to reschedule work, resolved",
  },
]

const priorityConfig = {
  high: { icon: AlertCircle, color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-950", label: "High" },
  medium: { icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-100 dark:bg-yellow-950", label: "Medium" },
  low: { icon: Clock, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-950", label: "Low" },
}

const statusConfig = {
  open: { variant: "destructive" as const, label: "Open" },
  "in-progress": { variant: "default" as const, label: "In Progress" },
  resolved: { variant: "secondary" as const, label: "Resolved" },
  closed: { variant: "secondary" as const, label: "Closed" },
}

export default function CasesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [cases, setCases] = useState(initialCases)
  const store = useDataStore()

  const filteredCases = cases.filter((caseItem) => {
    const matchesSearch =
      caseItem.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      caseItem.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      caseItem.subject.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || caseItem.status === statusFilter
    const matchesPriority = priorityFilter === "all" || caseItem.priority === priorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  })

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cases</h1>
            <p className="text-muted-foreground">Manage customer support cases</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="brand">
                <Plus className="mr-2 h-4 w-4" />
                New Case
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Case</DialogTitle>
                <DialogDescription>Log a new customer support case</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client">Client</Label>
                    <Select>
                      <SelectTrigger id="client">
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="acme">Acme Corporation</SelectItem>
                        <SelectItem value="smith">Smith Residence</SelectItem>
                        <SelectItem value="downtown">Downtown Retail LLC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select>
                      <SelectTrigger id="priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" placeholder="Enter case subject" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" placeholder="Describe the issue or request" rows={4} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignTo">Assign To</Label>
                  <Select>
                    <SelectTrigger id="assignTo">
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sarah">Sarah Johnson</SelectItem>
                      <SelectItem value="mike">Mike Chen</SelectItem>
                      <SelectItem value="emily">Emily Brown</SelectItem>
                      <SelectItem value="david">David Wilson</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline">Cancel</Button>
                <Button>Create Case</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cases.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Open Cases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{cases.filter((c) => c.status === "open").length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {cases.filter((c) => c.status === "in-progress").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {cases.filter((c) => c.status === "resolved" || c.status === "closed").length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search cases..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredCases.map((caseItem) => {
                const priorityCfg = priorityConfig[caseItem.priority as keyof typeof priorityConfig]
                const statusCfg = statusConfig[caseItem.status as keyof typeof statusConfig]
                const PriorityIcon = priorityCfg.icon
                return (
                  <Card key={caseItem.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-lg ${priorityCfg.bgColor}`}
                          >
                            <PriorityIcon className={`h-6 w-6 ${priorityCfg.color}`} />
                          </div>
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{caseItem.id}</h3>
                              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                              <Badge variant="outline">{priorityCfg.label} Priority</Badge>
                            </div>
                            <p className="text-sm font-medium">{caseItem.subject}</p>
                            <p className="text-sm text-muted-foreground">{caseItem.client}</p>
                            <p className="text-sm text-muted-foreground">{caseItem.description}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                              <span>Created: {caseItem.createdDate}</span>
                              <span>Updated: {caseItem.lastUpdate}</span>
                              <span>Assigned to: {caseItem.assignedTo}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedCase(caseItem)
                              setIsDetailsOpen(true)
                            }}
                          >
                            View Details
                          </Button>
                          {caseItem.status !== 'closed' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={async (e) => {
                                e.stopPropagation()
                                if (!confirm('Close this case?')) return
                                // optimistic UI
                                setCases((prev) => prev.map((c) => (c.id === caseItem.id ? { ...c, status: 'closed' } : c)))
                                await store.updateCaseStatus(caseItem.id, 'closed')
                              }}
                            >
                              Close Case
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Case Details - {selectedCase?.id}</DialogTitle>
              <DialogDescription>View and manage case information</DialogDescription>
            </DialogHeader>
            {selectedCase && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Client</Label>
                    <p className="font-medium">{selectedCase.client}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Priority</Label>
                    <p className="font-medium capitalize">{selectedCase.priority}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <p className="font-medium capitalize">{selectedCase.status}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Assigned To</Label>
                    <p className="font-medium">{selectedCase.assignedTo}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Subject</Label>
                  <p className="font-medium">{selectedCase.subject}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <p className="text-sm">{selectedCase.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Created Date</Label>
                    <p className="text-sm">{selectedCase.createdDate}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Last Update</Label>
                    <p className="text-sm">{selectedCase.lastUpdate}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                    Close
                  </Button>
                  {selectedCase?.status !== 'closed' && (
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        if (!confirm('Mark case as closed?')) return
                        setCases((prev) => prev.map((c) => (c.id === selectedCase.id ? { ...c, status: 'closed' } : c)))
                        await store.updateCaseStatus(selectedCase.id, 'closed')
                        setIsDetailsOpen(false)
                      }}
                    >
                      Close Case
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
