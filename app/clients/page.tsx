
"use client"

import { useState } from "react"
import { MainLayout } from "@/components/main-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Mail, Phone, Building2, Plus, Search, Edit, Power } from "lucide-react"
import { useDataStore } from "@/lib/data-store"
import { AuthGuard } from "@/components/auth-guard"
import { Dialog, DialogTrigger, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useI18n } from "@/lib/i18n"

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const { contacts, addContact, updateContact, deleteContact } = useDataStore()
  const { t } = useI18n()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [position, setPosition] = useState("")
  const [company, setCompany] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [lastContact, setLastContact] = useState("")
  const [source, setSource] = useState("Website")
  const [value, setValue] = useState<number | "">(0)
  const [editId, setEditId] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const clients = contacts
    .filter((c) => {
      const matchesQuery = (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (c.company || '').toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchesQuery) return false
      if (showInactive) return true
      return c.status === "active"
    })

  function openCreate() {
    setEditId(null)
    setName("")
    setPosition("")
    setCompany("")
    setEmail("")
    setPhone("")
    setLastContact("")
    setSource("Website")
    setValue(0)
    setOpen(true)
  }

  function openEdit(client: any) {
    setEditId(client.id)
    setName(client.name || "")
    setPosition(client.position || "")
    setCompany(client.company || "")
    setEmail(client.email || "")
    setPhone(client.phone || "")
    setLastContact(client.lastContact || "")
    setSource(client.source || "Website")
    setValue(client.value ?? 0)
    setOpen(true)
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('accounts.title')}</h2>
                <p className="text-sm text-muted-foreground sm:text-base">{t('accounts.description')}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant={showInactive ? "default" : "ghost"} onClick={() => setShowInactive((v) => !v)}>
                  {showInactive ? t('accounts.hideInactive') : t('accounts.showInactive')}
                </Button>

                <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditId(null); setName(''); setPosition(''); setCompany(''); setEmail(''); setPhone(''); setLastContact('') } setOpen(v) }}>
                  <DialogTrigger asChild>
                    <Button variant="brand" onClick={openCreate}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t('accounts.addButton')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editId ? t('accounts.editTitle') || t('accounts.addButton') : t('accounts.addButton')}</DialogTitle>
                      <DialogDescription>{t('accounts.addDescription')}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t('contacts.label.name')} *</Label>
                          <Input
                            placeholder={t('contacts.label.name')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('contacts.label.company')} *</Label>
                          <Input
                            placeholder={t('contacts.label.company')}
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t('contacts.label.email')}</Label>
                          <Input
                            type="email"
                            placeholder={t('contacts.label.email')}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('contacts.label.phone')}</Label>
                          <Input
                            placeholder={t('contacts.label.phone')}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t('leads.label.source') || 'Source'}</Label>
                          <Select value={source} onValueChange={(v) => setSource(v)}>
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
                          <Label>{t('leads.label.value') || 'Value'}</Label>
                          <Input
                            type="number"
                            placeholder={t('leads.label.value')}
                            value={value as any}
                            onChange={(e) => setValue(Number(e.target.value) || 0)}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t('contacts.label.position')}</Label>
                          <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder={t('accounts.form.positionPlaceholder') || ''} />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('contacts.lastContact')}</Label>
                          <Input type="date" value={lastContact} onChange={(e) => setLastContact(e.target.value)} placeholder={t('accounts.form.lastContactPlaceholder') || ''} />
                        </div>
                      </div>
                    </div>

                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="ghost" onClick={() => setOpen(false)}>{t('contacts.button.cancel') || 'Cancel'}</Button>
                      </DialogClose>
                      <Button
                        onClick={async () => {
                          if (editId) {
                            const ok = await updateContact(editId, { name, email, phone, company, position, lastContact, source, value } as any)
                            if (!ok) console.warn('update contact failed')
                          } else {
                            const id = `temp-${Date.now()}`
                            const contact = { id, name, email, phone, company, position, status: 'active', lastContact, source, value }
                            const ok = await addContact(contact as any)
                            if (!ok) console.warn('add contact failed')
                          }

                          setOpen(false)
                          setEditId(null)
                          setName('')
                          setPosition('')
                          setCompany('')
                          setEmail('')
                          setPhone('')
                          setLastContact('')
                        }}
                      >
                        {editId ? t('contacts.button.save') : t('contacts.button.create')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <div className="ml-3 hidden sm:block">
                  <Input placeholder="Search accounts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-64" />
                </div>
              </div>
            
            
                        

            {/* Search (mobile) is integrated into header; keep a small spacer for layout */}

            {clients.length === 0 ? (
              <Card>
                <CardContent className="flex min-h-[300px] sm:min-h-[400px] items-center justify-center px-4">
                  <div className="text-center space-y-2">
                    <p className="text-muted-foreground">{t("clients.emptyActive")}</p>
                    <p className="text-sm text-muted-foreground">{t("clients.emptyHint")}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-4 w-full max-w-3xl">
                {clients.map((client) => (
                  <Card key={client.id} className="w-full transition-all hover:shadow-md active:scale-[0.98]">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                        <Avatar className="h-16 w-16 shrink-0">
                          <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-lg text-white">
                            {client.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <h3 className="truncate text-lg font-semibold">{client.name}</h3>
                              <p className="truncate text-sm text-muted-foreground">{client.position}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`w-fit ${client.status === 'active' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                                {client.status === 'active' ? t('contacts.status.active') : t('contacts.status.inactive')}
                              </Badge>

                              {client.status === 'active' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    const ok = confirm(t('contacts.confirm.deactivate') || 'Deactivate this contact?')
                                    if (!ok) return
                                    await updateContact(client.id, { status: 'inactive' } as any)
                                  }}
                                  aria-label={t('contacts.button.deactivate') || 'Deactivate'}
                                  title={t('contacts.button.deactivate') || 'Deactivate'}
                                >
                                  <Power className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    await updateContact(client.id, { status: 'active' } as any)
                                  }}
                                  aria-label={t('contacts.button.activate') || 'Activate'}
                                  title={t('contacts.button.activate') || 'Activate'}
                                >
                                  <Power className="h-4 w-4" />
                                </Button>
                              )}

                              <Button variant="ghost" size="sm" onClick={() => openEdit(client)} aria-label={t('contacts.button.edit')} title={t('contacts.button.edit')}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              
                            </div>
                          </div>

                            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="truncate text-muted-foreground">{client.company}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="truncate text-muted-foreground">{client.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="text-muted-foreground">{client.phone}</span>
                            </div>
                              <div className="flex items-center gap-2">
                                <svg className="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.567-3 3.5S10.343 15 12 15s3-1.567 3-3.5S13.657 8 12 8z"/></svg>
                                <span className="text-muted-foreground">{client.lastContact ? new Date(client.lastContact).toLocaleDateString() : '-'}</span>
                              </div>
                          </div>
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
    </AuthGuard>
  )
}