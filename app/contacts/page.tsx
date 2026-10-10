"use client"

import { useState } from "react"
import { MainLayout } from "@/components/main-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Plus, Search, Mail, Phone, Building2, Calendar, Trash2, Edit } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDataStore, initializeDataStore } from "@/lib/data-store"

export default function ContactsPage() {
  const { t } = useI18n()
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState<{
    name: string
    email: string
    phone: string
    company: string
    position: string
    status: "active" | "inactive"
  }>({
    name: "",
    email: "",
    phone: "",
    company: "",
    position: "",
    status: "active",
  })

  const { contacts, addContact, deleteContact, updateContact } = useDataStore()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<Partial<typeof formData & { id?: string }>>({})

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleSubmit = () => {
    if (!formData.name || !formData.email || !formData.phone || !formData.company) {
      alert(t('leads.alerts.fillRequired'))
      return
    }

    addContact({
      id: Date.now().toString(),
      ...formData,
      lastContact: new Date().toISOString().split("T")[0],
    })

    setFormData({
      name: "",
      email: "",
      phone: "",
      company: "",
      position: "",
      status: "active",
    })
    setIsDialogOpen(false)
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('contacts.title')}</h2>
              <p className="text-sm text-muted-foreground sm:text-base">{t('contacts.description')}</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="brand">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('contacts.addButton')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('contacts.add.title')}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('contacts.label.name')} *</Label>
                      <Input
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('contacts.label.position')}</Label>
                      <Input
                        placeholder="CEO"
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('contacts.label.email')} *</Label>
                      <Input
                        type="email"
                        placeholder="john@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('contacts.label.phone')} *</Label>
                      <Input
                        placeholder="+1 234-567-8900"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('contacts.label.company')} *</Label>
                      <Input
                        placeholder="Company Name"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('contacts.label.status')}</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value: "active" | "inactive") => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">{t('contacts.status.active')}</SelectItem>
                          <SelectItem value="inactive">{t('contacts.status.inactive')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1 bg-transparent">{t('contacts.button.cancel')}</Button>
                    <Button onClick={handleSubmit} className="flex-1">{t('contacts.button.create')}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('contacts.edit.title')}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('contacts.label.name')} *</Label>
                      <Input placeholder="Nombre" value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('contacts.label.position')}</Label>
                      <Input placeholder="Posición" value={editForm.position || ''} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('contacts.label.email')} *</Label>
                      <Input type="email" placeholder="email@compania.com" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('contacts.label.phone')} *</Label>
                      <Input placeholder="Teléfono" value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('contacts.label.company')}</Label>
                      <Input placeholder="Empresa" value={editForm.company || ''} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('contacts.label.status')}</Label>
                      <Select value={(editForm.status as string) || 'active'} onValueChange={(v: any) => setEditForm({ ...editForm, status: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">{t('contacts.status.active')}</SelectItem>
                          <SelectItem value="inactive">{t('contacts.status.inactive')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsEditOpen(false)} className="flex-1 bg-transparent">{t('contacts.button.cancel')}</Button>
                    <Button
                      className="flex-1"
                      onClick={async () => {
                          if (!editForm.id) return alert(t('contacts.alerts.missingId'))
                        const payload: any = {
                          name: editForm.name,
                          email: editForm.email,
                          phone: editForm.phone,
                          company: editForm.company,
                          position: editForm.position,
                          status: editForm.status,
                        }
                        const ok = await updateContact(editForm.id as string, payload)
                        if (ok) {
                          try {
                            await initializeDataStore()
                          } catch (e) {}
                          setIsEditOpen(false)
                        } else {
                          alert(t('toast.errorTitle') + ': ' + t('contacts.alerts.saveError'))
                        }
                      }}
                    >{t('contacts.button.save')}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {filteredContacts.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-[300px] sm:min-h-[400px] items-center justify-center px-4">
                <div className="text-center space-y-2">
                  <p className="text-muted-foreground">{t('contacts.noResults')}</p>
                  <p className="text-sm text-muted-foreground">{t('contacts.noResultsSub')}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:gap-4">
              {filteredContacts.map((contact) => (
                <Card key={contact.id} className="transition-all hover:shadow-md active:scale-[0.98]">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                      <Avatar className="h-16 w-16 shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-lg text-white">
                          {contact.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <h3 className="truncate text-lg font-semibold">{contact.name}</h3>
                            <p className="truncate text-sm text-muted-foreground">{contact.position}</p>
                          </div>
                          <Badge
                            className={
                              contact.status === "active" ? "bg-foreground text-background" : ""
                            }
                          >
                            {t(`contacts.status.${contact.status}`)}
                          </Badge>
                        </div>
                        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate text-muted-foreground">{contact.company}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate text-muted-foreground">{contact.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="text-muted-foreground">{contact.phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="text-muted-foreground">Last: {contact.lastContact}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 sm:flex-col">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 bg-transparent sm:flex-none"
                          onClick={() => {
                            setEditForm({
                              id: contact.id,
                              name: contact.name,
                              email: contact.email,
                              phone: contact.phone,
                              company: contact.company,
                              position: contact.position,
                              status: contact.status,
                            })
                            setIsEditOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">{t("common.edit")}</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-destructive hover:bg-destructive/10 sm:flex-none bg-transparent"
                          onClick={async () => {
                            const ok = await deleteContact(contact.id)
                            if (ok) {
                              // refresh store from server to reflect DB state
                              try {
                                await initializeDataStore()
                              } catch (e) {
                                // ignore refresh errors — store already updated optimistically
                              }
                            } else {
                              alert(t('toast.errorTitle') + ': ' + t('contacts.alerts.deleteError'))
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">{t('contacts.button.delete')}</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
