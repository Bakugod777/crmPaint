"use client"

import { useState } from "react"
import { MainLayout } from "@/components/main-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useI18n } from "@/lib/i18n"
import { Send, Inbox, Star, Archive, Trash2, Reply, Forward, MoreVertical, Paperclip, Search } from "lucide-react"

const emails = [
  {
    id: 1,
    from: "John Smith",
    email: "john@smithresidence.com",
    subject: "Re: Exterior Painting Project",
    preview: "Thank you for the quote. I'd like to proceed with the project...",
    date: "10:30 AM",
    read: false,
    starred: true,
    folder: "inbox",
  },
  {
    id: 2,
    from: "Acme Corporation",
    email: "facilities@acme.com",
    subject: "Invoice Payment Confirmation",
    preview: "We have processed payment for invoice INV-2024-001...",
    date: "Yesterday",
    read: true,
    starred: false,
    folder: "inbox",
  },
  {
    id: 3,
    from: "Sarah Johnson",
    email: "sarah@paintpower.com",
    subject: "Team Meeting Notes",
    preview: "Here are the notes from today's team meeting...",
    date: "Yesterday",
    read: true,
    starred: false,
    folder: "inbox",
  },
  {
    id: 4,
    from: "Downtown Retail LLC",
    email: "manager@downtownretail.com",
    subject: "Project Completion Feedback",
    preview: "We're very satisfied with the work completed on our storefront...",
    date: "Feb 5",
    read: true,
    starred: true,
    folder: "inbox",
  },
  {
    id: 5,
    from: "Johnson Property Group",
    email: "info@johnsonproperty.com",
    subject: "Additional Units Inquiry",
    preview: "We have 5 more units that need painting. Can you provide a quote?",
    date: "Feb 4",
    read: false,
    starred: false,
    folder: "inbox",
  },
]

export default function EmailPage() {
  const { t } = useI18n()
  const [selectedEmail, setSelectedEmail] = useState(emails[0])
  const [searchQuery, setSearchQuery] = useState("")
  const [composing, setComposing] = useState(false)

  return (
    <MainLayout>
      <div className="flex flex-col lg:flex-row gap-4 pb-4">
        {/* Sidebar */}
        <Card className="w-full lg:w-64 flex-shrink-0">
          <CardContent className="p-4 space-y-2">
            <Button className="w-full" onClick={() => setComposing(true)}>
              <Send className="mr-2 h-4 w-4" />
              Compose
            </Button>
            <Separator className="my-4" />
            <Button variant="ghost" className="w-full justify-start">
              <Inbox className="mr-2 h-4 w-4" />
              Inbox
              <Badge className="ml-auto" variant="secondary">
                5
              </Badge>
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Star className="mr-2 h-4 w-4" />
              Starred
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Send className="mr-2 h-4 w-4" />
              Sent
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Trash2 className="mr-2 h-4 w-4" />
              Trash
            </Button>
          </CardContent>
        </Card>

        {/* Email List */}
        <Card className="w-full lg:w-96 flex-shrink-0 max-h-[calc(100vh-12rem)]">
          <CardContent className="p-0 flex flex-col h-full">
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Separator />
            <ScrollArea className="flex-1">
              {emails.map((email) => (
                <div key={email.id}>
                  <div
                    className={`p-4 cursor-pointer hover:bg-accent transition-colors ${
                      selectedEmail.id === email.id ? "bg-accent" : ""
                    } ${!email.read ? "bg-accent/50" : ""}`}
                    onClick={() => setSelectedEmail(email)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`text-sm font-medium truncate ${!email.read ? "font-bold" : ""}`}>
                            {email.from}
                          </p>
                          {email.starred && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />}
                        </div>
                        <p className={`text-sm truncate ${!email.read ? "font-semibold" : "text-muted-foreground"}`}>
                          {email.subject}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-1">{email.preview}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{email.date}</span>
                    </div>
                  </div>
                  <Separator />
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Email Content */}
        <Card className="flex-1 min-w-0 max-h-[calc(100vh-12rem)]">
          <CardContent className="p-0 flex flex-col h-full">
            {composing ? (
              <div className="p-4 md:p-6 space-y-4 flex-1 flex flex-col overflow-auto">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">{t("email.newMessage")}</h2>
                  <Button variant="ghost" size="sm" onClick={() => setComposing(false)}>
                    Close
                  </Button>
                </div>
                <div className="space-y-4 flex-1">
                  <div className="space-y-2">
                    <Label htmlFor="to">{t("email.to")}</Label>
                    <Input id="to" placeholder="recipient@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">{t("email.subject")}</Label>
                    <Input id="subject" placeholder="Enter subject" />
                  </div>
                  <div className="space-y-2 flex-1 flex flex-col">
                    <Label htmlFor="message">{t("email.message")}</Label>
                    <Textarea id="message" placeholder="Type your message here..." className="flex-1 min-h-[300px]" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t">
                  <Button variant="outline" size="sm">
                    <Paperclip className="mr-2 h-4 w-4" />
                    Attach
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setComposing(false)}>
                      Cancel
                    </Button>
                    <Button>
                      <Send className="mr-2 h-4 w-4" />
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="p-4 md:p-6 border-b">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl md:text-2xl font-semibold mb-2 break-words">{selectedEmail.subject}</h2>
                      <div className="flex flex-col md:flex-row md:items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground truncate">{selectedEmail.from}</span>
                        <span className="truncate">&lt;{selectedEmail.email}&gt;</span>
                        <span className="md:ml-auto whitespace-nowrap">{selectedEmail.date}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost">
                        <Star className={selectedEmail.starred ? "fill-yellow-400 text-yellow-400" : ""} />
                      </Button>
                      <Button size="icon" variant="ghost">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <ScrollArea className="flex-1 p-4 md:p-6">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p>{selectedEmail.preview}</p>
                    <p className="mt-4">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
                      labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
                    </p>
                    <p className="mt-4">
                      Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
                      pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
                      mollit anim id est laborum.
                    </p>
                    <p className="mt-4">
                      Best regards,
                      <br />
                      {selectedEmail.from}
                    </p>
                  </div>
                </ScrollArea>
                <div className="p-4 border-t flex flex-wrap gap-2">
                  <Button className="flex-1 md:flex-none">
                    <Reply className="mr-2 h-4 w-4" />
                    Reply
                  </Button>
                  <Button variant="outline" className="flex-1 md:flex-none bg-transparent">
                    <Forward className="mr-2 h-4 w-4" />
                    Forward
                  </Button>
                  <Button variant="outline" className="flex-1 md:flex-none md:ml-auto bg-transparent">
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </Button>
                  <Button variant="outline" className="flex-1 md:flex-none bg-transparent">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
