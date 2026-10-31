import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { Plus, Ticket as TicketIcon } from "lucide-react"
import { toast } from "sonner"

import { TicketCard } from "@/components/cards/ticket-card"
import { EmptyState } from "@/components/feedback/states"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/api/client"
import { useCreateTicket, useMyTickets } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"

const ticketSchema = z.object({
  subject: z.string().min(6, "Use at least 6 characters"),
  category: z.enum(["order_status", "delivery_issue", "wrong_item", "return_request", "refund", "other"]),
  orderNumber: z.string().optional(),
  description: z.string().min(20, "Describe the issue in at least 20 characters"),
})

type TicketForm = z.infer<typeof ticketSchema>

const filters = ["all", "open", "in_progress", "resolved"] as const

export function CustomerTicketsPage() {
  const ticketsQuery = useMyTickets()
  const createTicket = useCreateTicket()
  const tickets = ticketsQuery.data?.data ?? []
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<(typeof filters)[number]>("all")
  const form = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { subject: "", category: "delivery_issue", orderNumber: "", description: "" },
  })
  const category = useWatch({ control: form.control, name: "category" })

  const visible = tickets.filter((t) => filter === "all" || t.status === filter)

  const onSubmit = form.handleSubmit((values) => {
    createTicket.mutate(
      {
        subject: values.subject,
        category: values.category,
        description: values.description,
        orderNumber: values.orderNumber || undefined,
      },
      {
        onSuccess: (ticket) => {
          toast.success("Ticket created", {
            description: `${ticket.ticketNumber} — ${ticket.subject}`,
          })
          setOpen(false)
          form.reset()
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : "Could not create the ticket")
        },
      }
    )
  })

  return (
    <div>
      <PageHeader
        eyebrow="Customer portal"
        title="My Tickets"
        description="Support requests linked to your account. AI-created and manual tickets appear here."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="size-3.5" /> New ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a support ticket</DialogTitle>
                <DialogDescription>
                  Prefer the assistant? It can create a ticket automatically after checking your order.
                </DialogDescription>
              </DialogHeader>
              <form id="new-ticket-form" className="space-y-3" onSubmit={onSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" placeholder="Short summary" {...form.register("subject")} />
                  {form.formState.errors.subject && (
                    <p className="text-[11px] text-destructive">{form.formState.errors.subject.message}</p>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={category}
                      onValueChange={(value) => form.setValue("category", value as TicketForm["category"])}
                    >
                      <SelectTrigger id="category" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="order_status">Order status</SelectItem>
                        <SelectItem value="delivery_issue">Delivery issue</SelectItem>
                        <SelectItem value="wrong_item">Wrong item</SelectItem>
                        <SelectItem value="return_request">Return request</SelectItem>
                        <SelectItem value="refund">Refund</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="orderNumber">Order number (optional)</Label>
                    <Input id="orderNumber" placeholder="ORD-1024" {...form.register("orderNumber")} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    rows={4}
                    placeholder="What happened? Include dates if relevant."
                    {...form.register("description")}
                  />
                  {form.formState.errors.description && (
                    <p className="text-[11px] text-destructive">
                      {form.formState.errors.description.message}
                    </p>
                  )}
                </div>
              </form>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" form="new-ticket-form" disabled={createTicket.isPending}>
                  {createTicket.isPending ? "Creating…" : "Create ticket"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {filters.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-full border px-3 py-1 text-[12px] font-medium capitalize transition-colors",
              filter === id
                ? "border-primary/20 bg-blue-50 text-primary"
                : "border-border bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            {id.replace("_", " ")}
          </button>
        ))}
      </div>

      {ticketsQuery.isLoading ? (
        <div className="grid gap-2.5 lg:grid-cols-2" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading tickets…</span>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : ticketsQuery.isError ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={TicketIcon}
            title="Could not load your tickets"
            description="The ticket service did not respond. Check your connection and try again."
            action={
              <Button size="sm" variant="outline" onClick={() => void ticketsQuery.refetch()}>
                Try again
              </Button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={TicketIcon}
            title="No tickets here"
            description="Create a ticket or ask the assistant to raise one for you."
            action={
              <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                <Plus className="size-3.5" /> New ticket
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {visible.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  )
}
