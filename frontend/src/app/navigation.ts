import {
  Activity,
  BarChart3,
  BookOpen,
  Headset,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  ShoppingBag,
  Ticket,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react"

import type { Role } from "@/types"

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
  end?: boolean
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

export const navigationByRole: Record<Role, NavGroup[]> = {
  CUSTOMER: [
    {
      label: "Support",
      items: [
        { to: "/support", label: "Customer Support", icon: Headset },
        { to: "/orders", label: "My Orders", icon: ShoppingBag },
        { to: "/tickets", label: "My Tickets", icon: Ticket, badge: 1 },
      ],
    },
    {
      label: "Account",
      items: [
        { to: "/profile", label: "Profile", icon: UserCircle },
        { to: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  SUPPORT_AGENT: [
    {
      label: "Workspace",
      items: [
        { to: "/agent", label: "Agent Console", icon: LayoutDashboard, end: true },
        { to: "/agent/conversations", label: "Conversations", icon: MessagesSquare, badge: 3 },
        { to: "/agent/tickets", label: "Tickets", icon: Ticket, badge: 2 },
        { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      ],
    },
    {
      label: "Knowledge",
      items: [{ to: "/admin/knowledge", label: "Knowledge Base", icon: BookOpen }],
    },
    {
      label: "Account",
      items: [
        { to: "/profile", label: "Profile", icon: UserCircle },
        { to: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  ADMIN: [
    {
      label: "Overview",
      items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true }],
    },
    {
      label: "Operations",
      items: [
        { to: "/admin/customers", label: "Customers", icon: Users },
        { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
        { to: "/admin/tickets", label: "Tickets", icon: Ticket, badge: 2 },
      ],
    },
    {
      label: "Intelligence",
      items: [
        { to: "/admin/knowledge", label: "Knowledge Base", icon: BookOpen },
        { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
        { to: "/admin/monitoring", label: "AI Monitoring", icon: Activity },
      ],
    },
    {
      label: "System",
      items: [{ to: "/settings", label: "Settings", icon: Settings }],
    },
  ],
}

export const homePath: Record<Role, string> = {
  CUSTOMER: "/support",
  SUPPORT_AGENT: "/agent",
  ADMIN: "/admin",
}

export const roleLabel: Record<Role, string> = {
  CUSTOMER: "Customer",
  SUPPORT_AGENT: "Support agent",
  ADMIN: "Administrator",
}
