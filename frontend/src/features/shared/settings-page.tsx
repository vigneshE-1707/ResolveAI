import { useState } from "react"
import { Bell, Database, Globe, Lock, Palette, ServerCog, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useRole } from "@/app/auth-context"
import { useAdminSettings } from "@/lib/api/hooks"
import { apiBaseUrl } from "@/lib/env"

export function SettingsPage() {
  const { role } = useRole()
  const isAdmin = role === "ADMIN"
  const platform = useAdminSettings({ enabled: isAdmin })
  const [emailUpdates, setEmailUpdates] = useState(true)
  const [productNews, setProductNews] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState(true)

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Environment, notifications, and platform configuration."
        actions={<Badge variant="success">Live API</Badge>}
      />

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-[14px]">
              <Globe className="size-4 text-slate-400" /> Environment
            </CardTitle>
            <CardDescription>Read-only mirrors of the frontend configuration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-[12px]">
            <div className="flex items-center justify-between rounded-lg border border-border bg-slate-50/60 px-2.5 py-2">
              <span className="text-muted-foreground">API base URL</span>
              <span className="font-mono text-[10.5px]">{apiBaseUrl}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-slate-50/60 px-2.5 py-2">
              <span className="text-muted-foreground">Data source</span>
              <Badge variant="success">Backend API</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-slate-50/60 px-2.5 py-2">
              <span className="text-muted-foreground">Router / build</span>
              <span className="text-[10.5px]">React 19 · Vite · Tailwind 4</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-[14px]">
              <Bell className="size-4 text-slate-400" /> Notifications
            </CardTitle>
            <CardDescription>Applies to this browser profile only; nothing is persisted yet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {[
              { id: "email", label: "Email updates for my tickets", value: emailUpdates, set: setEmailUpdates },
              { id: "news", label: "Product news and tips", value: productNews, set: setProductNews },
              { id: "ai", label: "AI suggestions in chat", value: aiSuggestions, set: setAiSuggestions },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <label htmlFor={item.id} className="text-[12px] text-slate-700">
                  {item.label}
                </label>
                <Switch id={item.id} checked={item.value} onCheckedChange={item.set} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-[14px]">
              <Palette className="size-4 text-slate-400" /> Appearance
            </CardTitle>
            <CardDescription>Light theme is the reference design; dark mode is post-MVP.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg border-2 border-primary/40 bg-white p-2">
                <div className="h-8 rounded brand-gradient" />
                <p className="mt-1.5 text-[11px] font-medium">Light (active)</p>
              </div>
              <div className="flex-1 rounded-lg border border-border bg-slate-900 p-2 opacity-60">
                <div className="h-8 rounded bg-slate-800" />
                <p className="mt-1.5 text-[11px] font-medium text-slate-400">Dark — later</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-[14px]">
              <Database className="size-4 text-slate-400" /> Data & integrations
            </CardTitle>
            <CardDescription>Implementation status across the roadmap.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-[11.5px]">
            {[
              { name: "PostgreSQL + pgvector", status: "Implemented" },
              { name: "LangGraph agent", status: "Milestone 4" },
              { name: "MCP business tools", status: "Milestone 5" },
              { name: "LangSmith tracing", status: "Milestone 4 / 9" },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-lg border border-border px-2.5 py-1.5">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Sparkles className="size-3 text-slate-400" /> {item.name}
                </span>
                <span className="text-[10px] text-muted-foreground">{item.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-[14px]">
                <ServerCog className="size-4 text-slate-400" /> Platform configuration
              </CardTitle>
              <CardDescription>Server-side settings reported by `/admin/settings`.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 pt-0 text-[12px] sm:grid-cols-2">
              {platform.isLoading ? (
                <>
                  <Skeleton className="h-8 rounded-md" />
                  <Skeleton className="h-8 rounded-md" />
                </>
              ) : platform.isError ? (
                <p className="text-[11.5px] text-muted-foreground">Could not load platform settings.</p>
              ) : (
                <>
                  {[
                    { label: "Environment", value: platform.data?.app_env ?? "—" },
                    { label: "LLM provider", value: platform.data?.llm_provider ?? "—" },
                    { label: "LLM model", value: platform.data?.llm_model ?? "—" },
                    {
                      label: "LangSmith tracing",
                      value: platform.data?.langsmith_tracing ? "Enabled" : "Disabled",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-lg border border-border bg-slate-50/60 px-2.5 py-2"
                    >
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-mono text-[10.5px]">{item.value}</span>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-[14px]">
              <Lock className="size-4 text-slate-400" /> Security
            </CardTitle>
            <CardDescription>
              JWT access tokens with rotating HttpOnly refresh cookies and argon2id password hashing.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-0">
            <p className="text-[11.5px] text-muted-foreground">
              Sessions are verified against the database on every request. Sign out from the account menu.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled
              onClick={() => toast.info("Session management is not available yet")}
            >
              Manage sessions
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
