import { NavLink } from "react-router-dom"
import {
  ChevronLeft,
  ChevronRight,
  Headset,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react"

import { navigationByRole } from "@/app/navigation"
import { roleLabel, useRole } from "@/app/role-context"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Role } from "@/types"

interface AppSidebarProps {
  collapsed?: boolean
  onToggleCollapsed?: () => void
  onNavigate?: () => void
}

export function AppSidebar({
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}: AppSidebarProps) {
  const { role, user, setRole } = useRole()
  const groups = navigationByRole[role]
  const isAdmin = role === "ADMIN"

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      {/* Brand */}
      <div className={cn("flex h-16 items-center gap-2.5", collapsed ? "justify-center px-0" : "px-5")}>
        <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl brand-gradient shadow-[0_4px_14px_-4px_rgba(37,99,235,0.6)]">
          <Headset className="size-[18px] text-white" strokeWidth={2.4} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[17px] font-bold leading-none tracking-tight text-white">
              Resolve<span className="text-blue-400">AI</span>
            </p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
              {isAdmin ? "Admin workspace" : "Support platform"}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn("scrollbar-slim flex-1 overflow-y-auto pb-3", collapsed ? "px-2" : "px-3")}>
        {groups.map((group, groupIndex) => (
          <div key={group.label ?? groupIndex} className={cn(groupIndex > 0 && "mt-5")}>
            {group.label && !collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {group.label}
              </p>
            )}
            {group.label && collapsed && groupIndex > 0 && (
              <div className="mx-auto mb-2 h-px w-7 bg-white/10" />
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const link = (
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex h-10 items-center gap-3 rounded-lg text-[13.5px] font-medium transition-colors",
                        collapsed ? "justify-center px-0" : "px-3",
                        isActive
                          ? "bg-sidebar-active text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,0.9)]"
                          : "text-slate-400 hover:bg-sidebar-accent hover:text-slate-100"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn("size-[18px] shrink-0", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200")}
                          strokeWidth={2}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {!collapsed && item.badge ? (
                          <span
                            className={cn(
                              "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular",
                              isActive ? "bg-white/20 text-white" : "bg-white/10 text-slate-300"
                            )}
                          >
                            {item.badge}
                          </span>
                        ) : null}
                        {collapsed && item.badge ? (
                          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-blue-400" />
                        ) : null}
                      </>
                    )}
                  </NavLink>
                )

                return (
                  <li key={item.to}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {!collapsed && (
          <div className="mt-6 rounded-xl border border-white/5 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-200">
              <Sparkles className="size-3.5" />
              AI agent online
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Resolving 82% of requests end-to-end.
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Demo metrics</p>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className={cn("border-t border-sidebar-border p-3", collapsed && "px-2")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.04] p-2 text-left transition-colors hover:bg-white/[0.07]",
                collapsed && "justify-center border-transparent bg-transparent p-0"
              )}
            >
              <div className="relative shrink-0">
                <Avatar className="size-9 ring-2 ring-white/10">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-[12px] font-semibold text-white">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-sidebar bg-emerald-400" />
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-white">{user.fullName}</p>
                  <p className="truncate text-[11px] text-slate-400">{roleLabel[role]}</p>
                </div>
              )}
              {!collapsed && <ChevronRight className="size-4 shrink-0 text-slate-500" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56">
            <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
            <div className="px-2 pb-2">
              <p className="truncate text-[13px] font-medium">{user.fullName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1.5">
              <Users className="size-3" /> Preview as
            </DropdownMenuLabel>
            {(["CUSTOMER", "SUPPORT_AGENT", "ADMIN"] as Role[]).map((r) => (
              <DropdownMenuItem key={r} onSelect={() => setRole(r)} className="justify-between">
                <span>{roleLabel[r]}</span>
                {role === r && <Badge variant="secondary">Current</Badge>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="gap-2">
              <ShieldCheck className="size-4" />
              Sign out (after M3)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {onToggleCollapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapsed}
            className={cn(
              "mt-1 h-8 w-full justify-start gap-2 text-[12px] font-medium text-slate-400 hover:bg-white/5 hover:text-white",
              collapsed && "justify-center px-0"
            )}
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            {!collapsed && "Collapse"}
            {collapsed && <span className="sr-only">Expand sidebar</span>}
          </Button>
        )}
      </div>
    </aside>
  )
}

export function SidebarMobileDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-y-0 left-0 shadow-2xl">
        <AppSidebar onNavigate={onClose} />
      </div>
    </div>
  )
}
