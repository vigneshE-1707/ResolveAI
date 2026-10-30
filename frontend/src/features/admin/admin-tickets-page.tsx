import { useState } from "react"
import { Link } from "react-router-dom"
import { Filter } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { agents, customers, tickets } from "@/mocks/data"
import { formatDateShort } from "@/lib/format"
import { priorityTone, ticketCategoryLabel, ticketStatusTone } from "@/lib/status"

export function AdminTicketsPage() {
  const [status, setStatus] = useState<string>("all")
  const [assignee, setAssignee] = useState<string>("all")

  const visible = tickets.filter((ticket) => {
    if (status !== "all" && ticket.status !== status) return false
    if (assignee === "unassigned" && ticket.assignedAgentId) return false
    if (assignee !== "all" && assignee !== "unassigned" && ticket.assignedAgentId !== assignee) return false
    return true
  })

  return (
    <div>
      <PageHeader
        eyebrow="Admin · Operations"
        title="Tickets"
        description="Full ticket pipeline with ownership and escalation visibility."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => toast.info("Bulk assignment arrives in Milestone 8")}
          >
            <Filter className="size-3.5" /> Bulk assign
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger size="sm" className="w-[150px] text-[12px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="pending_customer">Pending customer</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger size="sm" className="w-[170px] text-[12px]">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-[11px] text-muted-foreground">{visible.length} tickets · demo data</span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((ticket) => {
                const customer = customers.find((c) => c.id === ticket.customerId)
                const agent = agents.find((a) => a.id === ticket.assignedAgentId)
                return (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <Link to={`/tickets/${ticket.ticketNumber}`} className="font-mono text-[10.5px] font-semibold text-primary hover:underline">
                        {ticket.ticketNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate font-medium">{ticket.subject}</TableCell>
                    <TableCell className="text-muted-foreground">{customer?.fullName ?? "—"}</TableCell>
                    <TableCell className="text-[11.5px] text-muted-foreground">
                      {ticketCategoryLabel[ticket.category]}
                    </TableCell>
                    <TableCell><StatusBadge tone={ticketStatusTone[ticket.status]} /></TableCell>
                    <TableCell><StatusBadge tone={priorityTone[ticket.priority]} withDot={false} /></TableCell>
                    <TableCell className="text-[11.5px] text-muted-foreground">
                      {agent?.fullName ?? "Unassigned"}
                    </TableCell>
                    <TableCell className="text-right text-[11px] text-muted-foreground">
                      {formatDateShort(ticket.updatedAt)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {visible.length === 0 && (
            <p className="py-8 text-center text-[12px] text-muted-foreground">No tickets match these filters.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
