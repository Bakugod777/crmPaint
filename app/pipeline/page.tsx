"use client"

import { useState } from "react"
import { MainLayout } from "@/components/main-layout"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, DollarSign, Calendar, User, MoreVertical, MoveRight, Edit, X } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useDataStore } from "@/lib/data-store"
import { useI18n } from "@/lib/i18n"
import { formatUSD } from "@/lib/money"

export default function PipelinePage() {
  const { t, locale } = useI18n()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingDealId, setEditingDealId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState({
    title: "",
    client: "",
    value: 0,
    stage: "lead" as const,
    probability: 20,
    closeDate: "",
    description: "",
  })
  const [formData, setFormData] = useState({
    title: "",
    client: "",
    value: 0,
    stage: "lead" as const,
    probability: 20,
    closeDate: "",
    description: "",
  })

  const { deals, addDeal, updateDeal, deleteDeal } = useDataStore()

  const stages = [
    { id: "lead", name: t('pipeline.stage.lead'), color: "bg-foreground/25" },
    { id: "qualified", name: t('pipeline.stage.qualified'), color: "bg-foreground/40" },
    { id: "proposal", name: t('pipeline.stage.proposal'), color: "bg-foreground/55" },
    { id: "negotiation", name: t('pipeline.stage.negotiation'), color: "bg-foreground/70" },
    { id: "won", name: t('pipeline.stage.won'), color: "bg-positive" },
  ]

  const getDealsByStage = (stageId: string) => {
    return deals.filter((deal) => deal.stage === stageId)
  }

  const getStageTotal = (stageId: string) => {
    return getDealsByStage(stageId).reduce((sum, deal) => sum + deal.value, 0)
  }

  const formatCurrency = (value: number) => {
    const nfLocale = locale === 'es' ? 'es-ES' : 'en-US'
    return formatUSD(value)
  }

  const handleSubmit = async () => {
    if (!formData.title || !formData.client || !formData.closeDate) {
      alert("Please fill all required fields")
      return
    }
    const newDeal = {
      id: Date.now().toString(),
      ...formData,
      // DB `assigned_to` is INT; use null or a numeric user id. Using 1 (admin) for now.
      assignedTo: 1,
    }

    const ok = await addDeal(newDeal)
    if (!ok) {
      alert('Failed to save deal to server')
      return
    }

    setFormData({
      title: "",
      client: "",
      value: 0,
      stage: "lead",
      probability: 20,
      closeDate: "",
      description: "",
    })
    setIsDialogOpen(false)
  }

  const handleEditSubmit = async () => {
    if (!editingDealId) return
    if (!editFormData.title || !editFormData.client || !editFormData.closeDate) {
      alert("Please fill all required fields")
      return
    }
    const payload: any = {
      title: editFormData.title,
      client: editFormData.client,
      value: editFormData.value || 0,
      stage: editFormData.stage,
      probability: editFormData.probability || 0,
      closeDate: editFormData.closeDate || null,
      // assignedTo left unchanged here; backend will accept partial updates
      description: editFormData.description,
    }

    const ok = await updateDeal(editingDealId, payload)
    if (!ok) {
      alert('API update failed')
      return
    }
    setEditDialogOpen(false)
    setEditingDealId(null)
  }

  const moveToNextStage = async (dealId: string, currentStage: string) => {
    const stageIds = stages.map((s) => s.id)
    const currentIndex = stageIds.indexOf(currentStage)
    if (currentIndex < stageIds.length - 1) {
      const nextStage = stageIds[currentIndex + 1]
      await updateDeal(dealId, { stage: nextStage as any })
    }
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('pipeline.title')}</h2>
              <p className="text-sm text-muted-foreground sm:text-base">{t('pipeline.description')}</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="brand">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('pipeline.addButton')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('pipeline.add.title')}</DialogTitle>
                  <DialogDescription>{t('pipeline.add.description')}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('pipeline.form.title')} *</Label>
                      <Input
                        placeholder={t('pipeline.form.titlePlaceholder')}
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pipeline.form.client')} *</Label>
                      <Input
                        placeholder={t('pipeline.form.clientPlaceholder')}
                        value={formData.client}
                        onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('pipeline.form.value')}</Label>
                      <Input
                        type="number"
                        placeholder={t('pipeline.form.valuePlaceholder')}
                        value={formData.value || ""}
                        onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pipeline.form.stage')}</Label>
                      <Select
                        value={formData.stage}
                        onValueChange={(value: any) => setFormData({ ...formData, stage: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.slice(0, -1).map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              {stage.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('pipeline.form.closeDate')} *</Label>
                    <Input
                      type="date"
                      value={formData.closeDate}
                      onChange={(e) => setFormData({ ...formData, closeDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('pipeline.form.description')}</Label>
                    <Textarea
                      placeholder={t('pipeline.form.descriptionPlaceholder')}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1 bg-transparent">
                      {t('contacts.button.cancel')}
                    </Button>
                    <Button onClick={handleSubmit} className="flex-1">
                      {t('pipeline.addButton')}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('pipeline.edit.title') || 'Edit Deal'}</DialogTitle>
                  <DialogDescription>{t('pipeline.edit.description') || 'Edit deal details'}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('pipeline.form.title')} *</Label>
                      <Input
                        placeholder={t('pipeline.form.titlePlaceholder')}
                        value={editFormData.title}
                        onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pipeline.form.client')} *</Label>
                      <Input
                        placeholder={t('pipeline.form.clientPlaceholder')}
                        value={editFormData.client}
                        onChange={(e) => setEditFormData({ ...editFormData, client: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('pipeline.form.value')}</Label>
                      <Input
                        type="number"
                        placeholder={t('pipeline.form.valuePlaceholder')}
                        value={editFormData.value || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, value: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pipeline.form.stage')}</Label>
                      <Select
                        value={editFormData.stage}
                        onValueChange={(value: any) => setEditFormData({ ...editFormData, stage: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.slice(0, -1).map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              {stage.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('pipeline.form.closeDate')} *</Label>
                    <Input
                      type="date"
                      value={editFormData.closeDate}
                      onChange={(e) => setEditFormData({ ...editFormData, closeDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('pipeline.form.description')}</Label>
                    <Textarea
                      placeholder={t('pipeline.form.descriptionPlaceholder')}
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="flex-1 bg-transparent">
                      {t('contacts.button.cancel')}
                    </Button>
                    <Button onClick={handleEditSubmit} className="flex-1">
                      {t('contacts.button.save') || 'Save'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {/* Cancelados section */}
          {deals.filter(d => d.stage === 'lost').length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">{t('pipeline.cancelledSection')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {deals.filter(d => d.stage === 'lost').map((deal) => (
                  <Card key={`cancelled-${deal.id}`} className="cursor-default">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{deal.title}</h4>
                          <p className="text-sm text-muted-foreground">{deal.client}</p>
                        </div>
                        <Badge variant="destructive">{t('pipeline.cancelled')}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        <div>{formatCurrency(deal.value)}</div>
                        <div className="mt-2">{new Date(deal.closeDate).toLocaleDateString()}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin">
            {stages.map((stage) => {
              const stageDeals = getDealsByStage(stage.id)
              const stageTotal = getStageTotal(stage.id)

              return (
                <div key={stage.id} className="flex min-w-[280px] flex-1 flex-col sm:min-w-[320px] snap-start">
                  <div className="mb-3 sm:mb-4 rounded-lg border bg-card p-3 sm:p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-3 w-3 shrink-0 rounded-full ${stage.color}`} />
                        <h3 className="font-semibold truncate">{stage.name}</h3>
                        <Badge variant="secondary" className="shrink-0">
                          {stageDeals.length}
                        </Badge>
                      </div>
                      <div className="text-xs sm:text-sm font-semibold text-muted-foreground shrink-0">
                        {formatCurrency(stageTotal)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    {stageDeals.map((deal) => (
                      <Card key={deal.id} className="cursor-pointer transition-all hover:shadow-md active:scale-[0.98]">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="truncate font-semibold leading-none">{deal.title}</h4>
                              <p className="mt-1 truncate text-sm text-muted-foreground">{deal.client}</p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setEditingDealId(deal.id); setEditFormData({ title: deal.title || "", client: deal.client || "", value: deal.value || 0, stage: deal.stage || 'lead', probability: deal.probability || 0, closeDate: deal.closeDate || '', description: deal.description || '' }); setEditDialogOpen(true) }}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  {t('contacts.button.edit')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => moveToNextStage(deal.id, deal.stage)}>
                                  <MoveRight className="mr-2 h-4 w-4" />
                                  {t('pipeline.moveNext')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={async () => { const ok = await updateDeal(deal.id, { stage: 'lost' }); if (!ok) alert('Failed to mark cancelled') }}>
                                  <X className="mr-2 h-4 w-4" />
                                  {t('pipeline.cancel')}
                                </DropdownMenuItem>
                                {/* delete removed per UX request */}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1 font-semibold">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              {formatCurrency(deal.value)}
                            </div>
                            {deal.stage === 'lost' ? (
                              <Badge variant="destructive">{t('pipeline.cancelled')}</Badge>
                            ) : (
                              <Badge variant="outline">{deal.probability}%</Badge>
                            )}
                          </div>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate">{deal.assignedTo}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span>{new Date(deal.closeDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                          {deal.description && (
                            <p className="truncate text-xs text-muted-foreground">{deal.description}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {stageDeals.length === 0 && (
                      <div className="rounded-lg border border-dashed p-6 sm:p-8 text-center text-xs sm:text-sm text-muted-foreground">
                        {t('pipeline.noDealsInStage')}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
