import { useState } from "react"
import { Outlet } from "react-router-dom"

import { AppSidebar, SidebarMobileDrawer } from "@/components/layout/app-sidebar"
import { TopNavbar } from "@/components/layout/top-navbar"

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <div className="sticky top-0 hidden h-screen lg:block">
        <AppSidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)} />
      </div>

      <SidebarMobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-4 lg:px-6 lg:py-5">
          <div className="mx-auto w-full max-w-[1560px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
