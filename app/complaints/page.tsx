"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { MainLayout } from "@/components/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDataStore } from "@/lib/data-store"
import { useAuthStore } from "@/lib/auth-store"
import { Plus, AlertCircle, Clock, CheckCircle2, XCircle, Upload, User } from "lucide-react"
import { AuthGuard } from "@/components/auth-guard"
import { useToast } from "@/hooks/use-toast"

const complaintCategories = [
  "Poor service",
  "Missed schedules",
  "Service error",
  "Inappropriate behavior",
  "Project issues",
  "Quality issues",
  "Lack of communication",
  "Other",
]

export default function ComplaintsPage() {
  const { user, getAllUsers, loadUsers } = useAuthStore()
  const { complaints, addComplaint, updateComplaint, getUserComplaints } = useDataStore()
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedTab, setSelectedTab] = useState("my-complaints")

  const [form, setForm] = useState({
    category: "",
    title: "",
    description: "",
    mentionedUser: "",
    images: [] as string[],
  })

  const allUsers = getAllUsers()
  const userComplaints = user ? getUserComplaints(user.id) : []
  const allComplaintsVisible = user?.role === "admin" ? complaints : userComplaints

  useEffect(() => {
    // /api/db/users is admin-only; other roles would just get a 403
    if (user?.role === "admin") loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.category || !form.title || !form.description || !user) {
      toast({
        title: "Error",
        description: "Please complete all required fields",
        variant: "destructive",
      })
      return
    }

    const newComplaint = {
      id: Date.now().toString(),
      type: user.role as "user" | "worker",
      category: form.category,
      title: form.title,
      description: form.description,
      images: form.images,
      mentionedUser: form.mentionedUser || undefined,
      status: "pending" as const,
      createdBy: user.id,
      createdByRole: user.role as "user" | "worker" | "admin",
      createdAt: new Date().toISOString(),
    }

    addComplaint(newComplaint)
    setDialogOpen(false)
    setForm({ category: "", title: "", description: "", mentionedUser: "", images: [] })

    toast({
      title: "Complaint created",
      description: "Your complaint has been submitted successfully",
    })
  }

  const handleAdminResponse = (id: string, response: string, newStatus: "resolved" | "rejected") => {
    updateComplaint(id, {
      status: newStatus,
      adminResponse: response,
      respondedAt: new Date().toISOString(),
    })

    toast({
      title: "Response sent",
      description: "The complaint has been updated",
    })
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pending":
        return {
          icon: Clock,
          color: "text-yellow-600",
          bgColor: "bg-yellow-100 dark:bg-yellow-950",
          label: "Pendiente",
        }
      case "in-review":
        return {
          icon: AlertCircle,
          color: "text-blue-600",
          bgColor: "bg-blue-100 dark:bg-blue-950",
          label: "En Revisión",
        }
      case "resolved":
        return {
          icon: CheckCircle2,
          color: "text-green-600",
          bgColor: "bg-green-100 dark:bg-green-950",
          label: "Resuelta",
        }
      case "rejected":
        return { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-950", label: "Rechazada" }
      default:
        return { icon: Clock, color: "text-gray-600", bgColor: "bg-gray-100", label: status }
    }
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Complaints & Reports</h1>
              <p className="text-sm text-muted-foreground sm:text-base">Complaint management system</p>
            </div>
            {user?.role !== "admin" && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="brand">
                    <Plus className="mr-2 h-4 w-4" />
                    New Complaint
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create New Complaint</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {complaintCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="Brief summary of the issue"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Detailed Description *</Label>
                      <Textarea
                        id="description"
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Describe the issue in detail"
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mention">Mention User (Optional)</Label>
                      <Select
                        value={form.mentionedUser}
                        onValueChange={(value) => setForm({ ...form, mentionedUser: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a user" />
                        </SelectTrigger>
                        <SelectContent>
                          {allUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              @{u.name} ({u.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Attach Images</Label>
                      <Button type="button" variant="outline" className="w-full bg-transparent">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Images
                      </Button>
                      <p className="text-xs text-muted-foreground">You can attach photographic evidence</p>
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Create Complaint</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Complaints</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{allComplaintsVisible.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {allComplaintsVisible.filter((c) => c.status === "pending").length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">In Review</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {allComplaintsVisible.filter((c) => c.status === "in-review").length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {allComplaintsVisible.filter((c) => c.status === "resolved").length}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>My Complaints</CardTitle>
              <CardDescription>Track your reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allComplaintsVisible.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>No complaints recorded</p>
                  </div>
                ) : (
                  allComplaintsVisible.map((complaint) => {
                    const statusConfig = getStatusConfig(complaint.status)
                    const StatusIcon = statusConfig.icon
                    const mentionedUser = complaint.mentionedUser
                      ? allUsers.find((u) => u.id === complaint.mentionedUser)
                      : null

                    return (
                      <Card key={complaint.id}>
                        <CardContent className="p-4 sm:p-6">
                          <div className="space-y-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <div
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${statusConfig.bgColor}`}
                                >
                                  <StatusIcon className={`h-5 w-5 ${statusConfig.color}`} />
                                </div>
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-semibold">{complaint.title}</h3>
                                    <Badge variant="outline">{complaint.category}</Badge>
                                    <Badge className={statusConfig.bgColor}>{statusConfig.label}</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{complaint.description}</p>
                                  {mentionedUser && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <User className="h-3 w-3" />
                                      <span>Mentioned: @{mentionedUser.name}</span>
                                    </div>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    Created: {new Date(complaint.createdAt).toLocaleString()}
                                  </p>
                                  {complaint.adminResponse && (
                                    <div className="mt-4 rounded-lg border bg-muted/50 p-3">
                                      <p className="text-sm font-medium mb-1">Admin Response:</p>
                                      <p className="text-sm text-muted-foreground">{complaint.adminResponse}</p>
                                      {complaint.respondedAt && (
                                        <p className="text-xs text-muted-foreground mt-2">
                                          {new Date(complaint.respondedAt).toLocaleString()}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {user?.role === "admin" && complaint.status === "pending" && (
                                <div className="flex gap-2">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button size="sm" variant="outline">
                                        Respond
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Respond to Complaint</DialogTitle>
                                      </DialogHeader>
                                      <form
                                        onSubmit={(e) => {
                                          e.preventDefault()
                                          const formData = new FormData(e.currentTarget)
                                          const response = formData.get("response") as string
                                          const status = formData.get("status") as "resolved" | "rejected"
                                          handleAdminResponse(complaint.id, response, status)
                                        }}
                                        className="space-y-4"
                                      >
                                        <div className="space-y-2">
                                          <Label htmlFor="response">Response</Label>
                                          <Textarea name="response" id="response" required rows={4} />
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="status">Status</Label>
                                          <Select name="status" required>
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="resolved">Resolve</SelectItem>
                                              <SelectItem value="rejected">Reject</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="flex justify-end gap-3">
                                          <Button type="button" variant="outline">
                                            Cancel
                                          </Button>
                                          <Button type="submit">Send Response</Button>
                                        </div>
                                      </form>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    </AuthGuard>
  )
}
