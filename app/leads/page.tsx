"use client"

import React, { useEffect, useState } from "react"
import { MainLayout } from "@/components/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, Search, Mail, Phone, MapPin, Trash2, Edit } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { useDataStore, Lead } from "@/lib/data-store"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from "@/lib/auth-store"
import { formatUSD } from "@/lib/money"

export default function LeadsPage() {
  const { t } = useI18n()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    source: "Website",
    status: "new" as const,
    value: 0,
  })

  const { leads, addLead, deleteLead } = useDataStore()
  const { toast } = useToast()
  const { user } = useAuthStore()

  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Lead>>({})

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const resp = await fetch('/api/db/data')
        const data = await resp.json()
        if (!mounted) return
        const rows = Array.isArray(data?.leads) ? data.leads : []
        useDataStore.setState({ 
          leads: rows.map((r: any) => ({
            id: r.id?.toString() || String(Date.now()),
            name: r.name || r.fullName || r.client || 'Unknown',
            company: r.company || r.organization || '',
            email: r.email || '',
            phone: r.phone || '',
            status: r.status || 'new',
            source: r.source || 'Website',
            value: Number(r.value) || 0,
            assignedTo: r.assignedTo || '',
            createdAt: r.createdAt || new Date().toISOString(),
          })) 
        })
      } catch (err) {
        console.error('load leads', err)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleSubmit = () => {
    if (!formData.name || !formData.company || !formData.email || !formData.phone) {
      alert(t('leads.alerts.fillRequired'))
      return
    }

    addLead({
      id: Date.now().toString(),
      ...formData,
      assignedTo: user?.email || 'Admin',
      createdAt: new Date().toISOString(),
    })

    setFormData({ 
      name: "", 
      company: "", 
      email: "", 
      phone: "", 
      source: "Website", 
      status: "new", 
      value: 0 
    })
    setIsDialogOpen(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-foreground text-background"
      case "contacted":
        return "bg-secondary text-secondary-foreground"
      case "qualified":
        return "border border-foreground/30 bg-transparent text-foreground"
      case "lost":
        return "bg-muted text-muted-foreground line-through"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new':
        return t('leads.status.new')
      case 'contacted':
        return t('leads.status.contacted')
      case 'qualified':
        return t('leads.status.qualified')
      case 'lost':
        return t('leads.status.lost')
      default:
        return status
    }
  }

  const handleEdit = async () => {
    if (!editingLead) return
    
    const changed: string[] = []
    const before = editingLead as any
    const after = editForm as any
    
    for (const k of ['name','company','email','phone','source','value']) {
      if ((after[k] ?? '') !== (before[k] ?? '')) {
        changed.push(k)
      }
    }
    
    const res = await useDataStore.getState().updateLead(editingLead.id, editForm)
    setIsEditOpen(false)
    setEditingLead(null)
    
    if (res && res.audit) {
      const a = res.audit
      toast({ 
        title: t('leads.toast.editedTitle'), 
        description: `${a.edited_by || t('leads.toast.unknown')} ${t('leads.toast.at')} ${a.edited_at}: ${t('leads.toast.modified')} ${changed.join(', ') || t('leads.toast.fields')}` 
      })
    } else if (res && res.ok) {
      toast({ 
        title: t('leads.toast.editedTitle'), 
        description: `${t('leads.toast.updated')}: ${changed.join(', ') || t('leads.toast.fields')}` 
      })
    } else {
      toast({ 
        title: t('leads.toast.errorTitle'), 
        description: String(res?.error || t('leads.toast.unknownError')) 
      })
    }
  }

  const handleStatusChange = async (lead: Lead) => {
    const order = ['new','contacted','qualified','lost']
    const idx = order.indexOf(lead.status)
    const next = order[(idx + 1) % order.length] as Lead['status']
    await useDataStore.getState().updateLead(lead.id, { status: next })
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {t('leads.title')}
              </h2>
              <p className="text-sm text-muted-foreground sm:text-base">
                {t('leads.description')}
              </p>
            </div>

            {/* Add Lead Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="brand">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('leads.addButton')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('leads.add.title')}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('leads.label.name')} *</Label>
                      <Input 
                        placeholder={t('leads.label.name')} 
                        value={formData.name} 
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('leads.label.company')} *</Label>
                      <Input 
                        placeholder={t('leads.label.company')} 
                        value={formData.company} 
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('leads.label.email')} *</Label>
                      <Input 
                        type="email" 
                        placeholder={t('leads.label.email')} 
                        value={formData.email} 
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('leads.label.phone')} *</Label>
                      <Input 
                        placeholder={t('leads.label.phone')} 
                        value={formData.phone} 
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('leads.label.source')}</Label>
                      <Select 
                        value={formData.source} 
                        onValueChange={(value) => setFormData({ ...formData, source: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Website">{t('leads.source.website')}</SelectItem>
                          <SelectItem value="Referral">{t('leads.source.referral')}</SelectItem>
                          <SelectItem value="LinkedIn">{t('leads.source.linkedin')}</SelectItem>
                          <SelectItem value="Cold Call">{t('leads.source.coldcall')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('leads.label.value')}</Label>
                      <Input 
                        type="number" 
                        placeholder={t('leads.label.value')} 
                        value={formData.value || ""} 
                        onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })} 
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)} 
                      className="flex-1 bg-transparent"
                    >
                      {t('contacts.button.cancel')}
                    </Button>
                    <Button onClick={handleSubmit} className="flex-1">
                      {t('leads.button.create')}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder={t('leads.searchPlaceholder')} 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="pl-9" 
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('leads.filter.all')}</SelectItem>
                <SelectItem value="new">{t('leads.status.new')}</SelectItem>
                <SelectItem value="contacted">{t('leads.status.contacted')}</SelectItem>
                <SelectItem value="qualified">{t('leads.status.qualified')}</SelectItem>
                <SelectItem value="lost">{t('leads.status.lost')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Leads Grid */}
          {filteredLeads.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-[300px] sm:min-h-[400px] items-center justify-center px-4">
                <div className="text-center space-y-2">
                  <p className="text-muted-foreground">{t('leads.noResults')}</p>
                  <p className="text-sm text-muted-foreground">{t('leads.noResultsSub')}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {filteredLeads.map((lead) => (
                <Card key={lead.id} className="transition-all hover:shadow-md active:scale-[0.98]">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="truncate text-lg">{lead.name}</CardTitle>
                        <p className="truncate text-sm text-muted-foreground">{lead.company}</p>
                      </div>
                      <button
                        onClick={() => handleStatusChange(lead)}
                        aria-label={`${t('leads.aria.changeState')} ${lead.name}`}
                        className="cursor-pointer"
                      >
                        <Badge className={getStatusColor(lead.status)}>
                          {getStatusLabel(lead.status)}
                        </Badge>
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-muted-foreground">{lead.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">{lead.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">{lead.source}</span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-3">
                      <span className="text-sm font-semibold">
                        {formatUSD(lead.value)}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 hover:bg-muted/5" 
                          onClick={() => { 
                            setEditingLead(lead)
                            setEditForm({ ...lead })
                            setIsEditOpen(true) 
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                          onClick={() => deleteLead(lead.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Edit Lead Dialog */}
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('leads.edit.title')}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('leads.label.name')} *</Label>
                    <Input 
                      value={editForm?.name || ''} 
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('leads.label.company')} *</Label>
                    <Input 
                      value={editForm?.company || ''} 
                      onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} 
                    />
                  </div>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('leads.label.email')} *</Label>
                    <Input 
                      type="email" 
                      value={editForm?.email || ''} 
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('leads.label.phone')} *</Label>
                    <Input 
                      value={editForm?.phone || ''} 
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} 
                    />
                  </div>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('leads.label.source')}</Label>
                    <Select 
                      value={(editForm?.source as string) || 'Website'} 
                      onValueChange={(v) => setEditForm({ ...editForm, source: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Website">{t('leads.source.website')}</SelectItem>
                        <SelectItem value="Referral">{t('leads.source.referral')}</SelectItem>
                        <SelectItem value="LinkedIn">{t('leads.source.linkedin')}</SelectItem>
                        <SelectItem value="Cold Call">{t('leads.source.coldcall')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('leads.label.value')}</Label>
                    <Input 
                      type="number" 
                      value={editForm?.value as any || ''} 
                      onChange={(e) => setEditForm({ ...editForm, value: Number(e.target.value) })} 
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditOpen(false)} 
                    className="flex-1 bg-transparent"
                  >
                    {t('contacts.button.cancel')}
                  </Button>
                  <Button onClick={handleEdit} className="flex-1">
                    {t('leads.button.save')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

        </div>
      </div>
    </MainLayout>
  )
}