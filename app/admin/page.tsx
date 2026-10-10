"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { MainLayout } from "@/components/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useAuthStore } from "@/lib/auth-store"
import { useDataStore } from "@/lib/data-store"
import { AuthGuard } from "@/components/auth-guard"
import { Users, UserPlus, Shield, Briefcase, Trash2, Calendar } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function AdminPage() {
  const router = useRouter()
  const { user, getAllUsers, loadUsers, createWorker, createAdmin, deleteUser, getWorkers, getAdmins, updateUser } = useAuthStore()
  const { projects } = useDataStore()
  const changeWorkerStatus = useDataStore((s) => (s as any).changeWorkerStatus)
  const projectAccounting = useDataStore((s) => s.projectAccounting)
  const { toast } = useToast()
  const { t } = useI18n()

  const STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: "AVAILABLE", label: "Available" },
    { value: "WAITING_FOR_ASSIGNMENT", label: "Waiting for Assignment" },
    { value: "WORKING", label: "Working" },
    { value: "PENDING_PAYMENT", label: "Pending Payment" },
    { value: "ON_COMPLAINT", label: "On Complaint" },
    { value: "PAID", label: "Paid" },
    { value: "RESIGNED", label: "Resigned" },
  ]

  const [workerDialogOpen, setWorkerDialogOpen] = useState(false)
  const [adminDialogOpen, setAdminDialogOpen] = useState(false)

  // Worker form state
  const [workerForm, setWorkerForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    assignedProjects: [] as string[],
  })

  // Admin form state
  const [adminForm, setAdminForm] = useState({
    name: "",
    email: "",
    password: "",
    company: "",
    phone: "",
  })

  const allUsers = getAllUsers()
  const workers = getWorkers()
  const admins = getAdmins()
  const regularUsers = allUsers.filter((u) => u.role === "user")

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/")
    }
  }, [user, router])

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!workerForm.name || !workerForm.email || !workerForm.password) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    const success = await createWorker(workerForm)

    if (success) {
      toast({
        title: "Success",
        description: "Worker created successfully",
      })
      // reload from server to normalize ids
      try {
        await loadUsers()
      } catch (e) {
        // ignore
      }
      setWorkerDialogOpen(false)
      setWorkerForm({ name: "", email: "", password: "", phone: "", assignedProjects: [] })
    } else {
      toast({
        title: "Error",
        description: "Email already exists",
        variant: "destructive",
      })
    }
  }

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!adminForm.name || !adminForm.email || !adminForm.password) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    const success = await createAdmin(adminForm)

    if (success) {
      toast({
        title: "Success",
        description: "Administrator created successfully",
      })
      try {
        await loadUsers()
      } catch (e) {
        // ignore
      }
      setAdminDialogOpen(false)
      setAdminForm({ name: "", email: "", password: "", company: "", phone: "" })
    } else {
      toast({
        title: "Error",
        description: "Email already exists",
        variant: "destructive",
      })
    }
  }

  const handleDeleteUser = (userId: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      deleteUser(userId)
      toast({
        title: "Success",
        description: "User deleted successfully",
      })
      // refresh list from server
      try {
        loadUsers()
      } catch (e) {
        // ignore
      }
    }
  }

  useEffect(() => {
    // load users once on mount
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthGuard>
      <MainLayout>
        <div className="p-4 sm:p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">User Management</h2>
                <p className="text-sm text-muted-foreground sm:text-base">Manage users, workers, and administrators</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{allUsers.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Workers</CardTitle>
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{workers.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Administrators</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{admins.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Regular Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{regularUsers.length}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Users & Roles</CardTitle>
                <CardDescription>View and manage all system users</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="workers">Workers</TabsTrigger>
                    <TabsTrigger value="admins">Admins</TabsTrigger>
                    <TabsTrigger value="users">Users</TabsTrigger>
                  </TabsList>

                  <TabsContent value="all" className="space-y-4">
                    <div className="flex justify-end gap-2">
                      <Dialog open={workerDialogOpen} onOpenChange={setWorkerDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="brand" size="sm">
                            <UserPlus className="mr-2 h-4 w-4" />
                            Create Worker
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Create New Worker</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleCreateWorker} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="worker-name">Name *</Label>
                              <Input
                                id="worker-name"
                                value={workerForm.name}
                                onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="worker-email">Email *</Label>
                              <Input
                                id="worker-email"
                                type="email"
                                value={workerForm.email}
                                onChange={(e) => setWorkerForm({ ...workerForm, email: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="worker-password">Password *</Label>
                              <Input
                                id="worker-password"
                                type="password"
                                value={workerForm.password}
                                onChange={(e) => setWorkerForm({ ...workerForm, password: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="worker-phone">Phone</Label>
                              <Input
                                id="worker-phone"
                                value={workerForm.phone}
                                onChange={(e) => setWorkerForm({ ...workerForm, phone: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Assigned Projects</Label>
                              <Select
                                onValueChange={(value) => {
                                  if (!workerForm.assignedProjects.includes(value)) {
                                    setWorkerForm({
                                      ...workerForm,
                                      assignedProjects: [...workerForm.assignedProjects, value],
                                    })
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select projects" />
                                </SelectTrigger>
                                <SelectContent>
                                  {projects.map((project) => (
                                    <SelectItem key={project.id} value={project.id}>
                                      {project.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {workerForm.assignedProjects.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {workerForm.assignedProjects.map((projectId) => {
                                    const project = projects.find((p) => p.id === projectId)
                                    return (
                                      <Badge key={projectId} variant="secondary">
                                        {project?.name}
                                      </Badge>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                            <Button type="submit" className="w-full">
                              Create Worker
                            </Button>
                          </form>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Shield className="mr-2 h-4 w-4" />
                            Create Admin
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Create New Administrator</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleCreateAdmin} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="admin-name">Name *</Label>
                              <Input
                                id="admin-name"
                                value={adminForm.name}
                                onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="admin-email">Email *</Label>
                              <Input
                                id="admin-email"
                                type="email"
                                value={adminForm.email}
                                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="admin-password">Password *</Label>
                              <Input
                                id="admin-password"
                                type="password"
                                value={adminForm.password}
                                onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="admin-company">Company</Label>
                              <Input
                                id="admin-company"
                                value={adminForm.company}
                                onChange={(e) => setAdminForm({ ...adminForm, company: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="admin-phone">Phone</Label>
                              <Input
                                id="admin-phone"
                                value={adminForm.phone}
                                onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                              />
                            </div>
                            <Button type="submit" className="w-full">
                              Create Administrator
                            </Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="space-y-2">
                      {allUsers.map((u) => (
                        <Card key={u.id}>
                          <CardContent className="flex items-center justify-between p-4">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{u.name}</p>
                                <Badge
                                  variant={
                                    u.role === "admin" ? "default" : u.role === "worker" ? "secondary" : "outline"
                                  }
                                >
                                  {t(`acct.role.${u.role}`)}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{u.email}</p>
                              {u.phone && <p className="text-sm text-muted-foreground">{u.phone}</p>}
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {new Date(u.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            {u.id !== user?.id && (
                              <Select value={u.role} onValueChange={async (role) => {
                                const ok = await updateUser(u.id, { role: role as any })
                                toast({ title: ok ? t("acct.saved") : t("acct.error"), variant: ok ? "default" : "destructive" })
                                try { await loadUsers() } catch {}
                              }}>
                                <SelectTrigger className="mr-2 h-8 w-[130px]" aria-label={t("acct.users.role")}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {["admin", "contador", "empleado", "worker", "user"].map((r) => <SelectItem key={r} value={r}>{t(`acct.role.${r}`)}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                            {u.id !== user?.id && (
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(u.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="workers" className="space-y-2">
                    {workers.map((w) => (
                      <Card key={w.id}>
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{w.name}</p>
                              <Badge variant="secondary">worker</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{w.email}</p>
                            {w.assignedProjects && w.assignedProjects.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {w.assignedProjects.map((projectId) => {
                                  const project = projects.find((p) => p.id === projectId)
                                  return project ? (
                                    <Badge key={projectId} variant="outline" className="text-xs">
                                      {project.name}
                                    </Badge>
                                  ) : null
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Select onValueChange={(val) => {
                              const status = val as
                                | "AVAILABLE"
                                | "WAITING_FOR_ASSIGNMENT"
                                | "WORKING"
                                | "PENDING_PAYMENT"
                                | "ON_COMPLAINT"
                                | "PAID"
                                | "RESIGNED"
                              const matches = projectAccounting.filter((p) => (p.workers || []).some((wk) => wk.id === w.id))
                              if (matches.length === 0) {
                                toast({ title: 'Info', description: 'Worker is not attached to any project accounting. Use Work Log to create an entry first.', variant: 'default' })
                                return
                              }
                              try {
                                matches.forEach((m) => changeWorkerStatus(m.projectId, w.id, status, user?.id))
                                toast({ title: 'Success', description: 'Status updated for worker in project(s).' })
                              } catch (err) {
                                toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' })
                              }
                            }}>
                              <SelectTrigger>
                                <SelectValue placeholder="Set status" />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(w.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="admins" className="space-y-2">
                    {admins.map((a) => (
                      <Card key={a.id}>
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{a.name}</p>
                              <Badge>admin</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{a.email}</p>
                            {a.company && <p className="text-sm text-muted-foreground">{a.company}</p>}
                          </div>
                          {a.id !== user?.id && (
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(a.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="users" className="space-y-2">
                    {regularUsers.map((u) => (
                      <Card key={u.id}>
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{u.name}</p>
                              <Badge variant="outline">user</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                            {u.company && <p className="text-sm text-muted-foreground">{u.company}</p>}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(u.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    </AuthGuard>
  )
}
