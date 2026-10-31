import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Bell,
  LogOut,
  Menu,
  Search,
  Settings,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import { useAuth, useRole } from "@/app/auth-context"
import { roleLabel } from "@/app/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { isDemoMode } from "@/lib/env"
import { cn } from "@/lib/utils"

const notifications = [
  {
    id: "n1",
    title: "Conversation escalated",
    description: "Sofia Almeida — customs hold on ORD-1019",
    time: "9m",
    unread: true,
  },
  {
    id: "n2",
    title: "Ticket TKT-5687 opened",
    description: "Delivery delay reported by John Doe",
    time: "5m",
    unread: true,
  },
  {
    id: "n3",
    title: "Knowledge doc processing",
    description: "Customer FAQ (October update) is being embedded",
    time: "28m",
    unread: false,
  },
]

export function TopNavbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { role, user } = useRole()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-white/95 px-4 backdrop-blur lg:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onOpenMobile}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      {/* Service status */}
      <div className="hidden shrink-0 items-center gap-2 md:flex">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[12.5px] font-semibold text-slate-700">System Online</span>
        <span className="hidden text-[12.5px] text-muted-foreground xl:inline">
          • All Services Operational
        </span>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2.5">
        {/* Search */}
        <form
          className="relative hidden w-full max-w-md sm:block"
          onSubmit={(event) => {
            event.preventDefault()
            toast.info("Global search connects to the API in Milestone 3", {
              description: search ? `Query: “${search}”` : "Try order numbers, tickets, or questions.",
            })
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search orders, tickets, or ask a question..."
            className="h-9 rounded-full border-transparent bg-slate-100/80 pl-9 pr-16 text-[13px] shadow-none focus-visible:bg-white"
            aria-label="Search orders, tickets, or ask a question"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-slate-400 md:flex">
            ⌘K
          </kbd>
        </form>

        {isDemoMode && (
          <Badge variant="warning" className="hidden gap-1 md:flex">
            <Sparkles className="size-3" />
            Demo data
          </Badge>
        )}

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="relative text-slate-500" aria-label="Notifications">
              <Bell className="size-[18px]" />
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full border-2 border-white bg-red-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2 py-1.5">
              <p className="text-[13px] font-semibold">Notifications</p>
              <span className="text-[11px] text-muted-foreground">{notifications.length} new</span>
            </div>
            <DropdownMenuSeparator />
            {notifications.map((n) => (
              <DropdownMenuItem key={n.id} className="items-start gap-2.5 py-2">
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    n.unread ? "bg-primary" : "bg-slate-300"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium leading-tight">{n.title}</p>
                  <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{n.description}</p>
                </div>
                <span className="text-[10.5px] text-muted-foreground">{n.time}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-center text-[11px] text-muted-foreground">
              Notifications are demo content until Milestone 8
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-slate-100"
              aria-label="Open profile menu"
            >
              <Avatar className="size-9 ring-1 ring-slate-200">
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-[12.5px] font-semibold text-white">
                  {user.initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
            <div className="px-2 pb-2">
              <p className="truncate text-[13px] font-semibold">{user.fullName}</p>
              <p className="truncate text-[11.5px] text-muted-foreground">{user.email}</p>
              <Badge variant="secondary" className="mt-1.5">
                {roleLabel[role]}
              </Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="gap-2">
                <Settings className="size-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2"
              onSelect={() => {
                void logout().then(() => navigate("/login", { replace: true }))
              }}
            >
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
