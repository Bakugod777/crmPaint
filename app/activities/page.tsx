"use client"

import { useState } from "react"
import type { Activity } from "@/lib/data-store"
import { MainLayout } from "@/components/main-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Phone, Mail, CalendarIcon, Users, Clock, Plus, Star } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDataStore } from "@/lib/data-store"
import { Trash } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Activities are now provided by `useDataStore` (no hardcoded examples)

export default function ActivitiesPage() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const activities = useDataStore((s) => s.activities || [])
  const createActivity = useDataStore((s) => s.createActivity)
  const updateActivity = useDataStore((s) => s.updateActivity)
  const deleteActivity = useDataStore((s) => s.deleteActivity)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<any>(null)
  const [editForm, setEditForm] = useState({ title: "", client: "", status: "scheduled", date: "", duration: "" })
  const [newActivity, setNewActivity] = useState({
    type: "call",
    title: "",
    client: "",
    date: "",
    duration: "",
  })

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-5 w-5" />
      case "email":
        return <Mail className="h-5 w-5" />
      case "meeting":
        return <Users className="h-5 w-5" />
      default:
        return <CalendarIcon className="h-5 w-5" />
    }
  }

  const toggleStar = (id: string | number) => {
    const act = activities.find((a) => String(a.id) === String(id))
    if (!act) return
    ;(async () => {
      const ok = await updateActivity(id, { starred: !act.starred })
      if (!ok) alert('Failed to update activity star on server')
    })()
  }

  const handleScheduleActivity = () => {
    const payload = { ...newActivity, status: "scheduled", starred: false } as Partial<Activity>
    setIsScheduleOpen(false)
    setNewActivity({ type: "call", title: "", client: "", date: "", duration: "" })
    ;(async () => {
      const ok = await createActivity(payload)
      if (!ok) alert('Failed to create activity on server')
    })()
  }

  async function handleUpdateActivity(id: string | number, payload: any) {
    const ok = await updateActivity(id, payload)
    if (!ok) {
      alert('Failed to update activity on server')
      // ideally re-fetch; simple reload for now
      location.reload()
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Activities</h2>
            <p className="text-muted-foreground">Manage your calls, meetings, and tasks</p>
          </div>
          <Button variant="brand" onClick={() => setIsScheduleOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Schedule Activity
          </Button>
        </div>

        <Tabs defaultValue="list" className="space-y-6">
          <TabsList>
            <TabsTrigger value="list">List View</TabsTrigger>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            {activities.map((activity) => (
              <Card key={activity.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <h3 className="font-semibold">{activity.title}</h3>
                      <p className="text-sm text-muted-foreground">{activity.client}</p>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        <span>{activity.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{activity.duration}</span>
                      </div>
                      <Badge variant={String(activity.status).toLowerCase() === "upcoming" ? "default" : "secondary"}>
                        {String(activity.status).charAt(0).toUpperCase() + String(activity.status).slice(1)}
                      </Badge>
                    </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => toggleStar(activity.id)}>
                          <Star className={activity.starred ? "fill-yellow-400 text-yellow-400" : ""} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedActivity(activity)
                            setEditForm({ title: activity.title || "", client: activity.client || "", status: (activity.status || "scheduled").toLowerCase(), date: activity.date || "", duration: activity.duration || "" })
                            setIsEditOpen(true)
                          }}
                        >
                          Edit
                        </Button>
                        <Button size="sm">Start</Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (!confirm('Delete this activity?')) return
                            const ok = await deleteActivity(activity.id)
                            if (!ok) alert('Failed to delete activity on server')
                          }}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="calendar">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardContent className="p-6">
                  <div className="flex items-center justify-center">
                    <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4">Activities for {date?.toLocaleDateString()}</h3>
                  <div className="space-y-4">
                    {activities.slice(0, 2).map((activity) => (
                      <div key={activity.id} className="space-y-1">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">{activity.date}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Activity</DialogTitle>
              <DialogDescription>Create a new activity or task</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={newActivity.type}
                  onValueChange={(value) => setNewActivity({ ...newActivity, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={newActivity.title}
                  onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                  placeholder="Activity title"
                />
              </div>
              <div className="space-y-2">
                <Label>Client</Label>
                <Input
                  value={newActivity.client}
                  onChange={(e) => setNewActivity({ ...newActivity, client: e.target.value })}
                  placeholder="Client name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="datetime-local"
                    value={newActivity.date}
                    onChange={(e) => setNewActivity({ ...newActivity, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Input
                    value={newActivity.duration}
                    onChange={(e) => setNewActivity({ ...newActivity, duration: e.target.value })}
                    placeholder="e.g., 30 min"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsScheduleOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleScheduleActivity}>Schedule</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Activity</DialogTitle>
              <DialogDescription>Update activity details</DialogDescription>
            </DialogHeader>
            {selectedActivity && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={editForm.title} onChange={(e) => setEditForm((s) => ({ ...s, title: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Input value={editForm.client} onChange={(e) => setEditForm((s) => ({ ...s, client: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm((s) => ({ ...s, status: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      await handleUpdateActivity(selectedActivity.id, editForm)
                      setIsEditOpen(false)
                    }}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
