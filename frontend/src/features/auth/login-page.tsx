import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { ArrowRight, BriefcaseBusiness, Loader2, ShieldCheck, UserRound } from "lucide-react"
import { toast } from "sonner"

import { AuthLayout } from "@/features/auth/auth-layout"
import { homePath } from "@/app/navigation"
import { useAuth } from "@/app/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError } from "@/lib/api/client"
import { isDemoMode } from "@/lib/env"
import { cn } from "@/lib/utils"
import type { Role } from "@/types"

const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type LoginForm = z.infer<typeof loginSchema>

/** Credentials created by `backend/scripts/seed_demo.py`. */
const demoAccounts: {
  role: Role
  label: string
  description: string
  email: string
  icon: typeof UserRound
}[] = [
  {
    role: "CUSTOMER",
    label: "Customer",
    description: "John Doe",
    email: "john.doe@email.com",
    icon: UserRound,
  },
  {
    role: "SUPPORT_AGENT",
    label: "Agent",
    description: "Maya Fernandez",
    email: "maya.fernandez@resolveai.app",
    icon: BriefcaseBusiness,
  },
  {
    role: "ADMIN",
    label: "Admin",
    description: "Alex Morgan",
    email: "alex.morgan@resolveai.app",
    icon: ShieldCheck,
  },
]

const DEMO_PASSWORD = "ResolveAI#2026"

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const redirectTo = (role: Role) => {
    const state = location.state as { from?: string } | null
    const from = state?.from
    navigate(from && from !== "/login" ? from : homePath[role], { replace: true })
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true)
    setFormError(null)
    try {
      const user = await login(values.email, values.password)
      toast.success(`Signed in as ${user.fullName}`)
      redirectTo(user.role)
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Unable to sign in. Please try again."
      setFormError(message)
    } finally {
      setSubmitting(false)
    }
  })

  const fillDemo = (account: (typeof demoAccounts)[number]) => {
    form.setValue("email", account.email, { shouldValidate: true })
    form.setValue("password", DEMO_PASSWORD, { shouldValidate: true })
    setFormError(null)
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your ResolveAI workspace with your account credentials."
      footer={
        <>
          New to ResolveAI?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-3" onSubmit={onSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
          {form.formState.errors.email && (
            <p className="text-[11px] text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              className="text-[11px] font-medium text-primary hover:underline"
              onClick={() => toast.info("Password reset is not available yet")}
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-[11px] text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>
        {formError && (
          <p role="alert" className="rounded-md bg-destructive/10 px-2.5 py-2 text-[11.5px] text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" className="w-full gap-1.5" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Sign in <ArrowRight className="size-4" />
        </Button>
      </form>

      {isDemoMode && (
        <>
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                or use a seeded demo account
              </span>
            </div>
          </div>

          <div className="grid gap-2">
            {demoAccounts.map((account) => (
              <button
                key={account.role}
                type="button"
                onClick={() => fillDemo(account)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors",
                  "hover:border-blue-200 hover:bg-blue-50/40"
                )}
              >
                <span className="flex size-7 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                  <account.icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium">{account.label}</span>
                  <span className="block text-[10.5px] text-muted-foreground">
                    {account.description}
                  </span>
                </span>
                <span className="text-[10px] text-muted-foreground">Fill</span>
              </button>
            ))}
          </div>

          <p className="mt-4 text-center text-[10px] text-muted-foreground">
            Seeded demo accounts use password {DEMO_PASSWORD}. Credentials are sent to the local API.
          </p>
        </>
      )}
    </AuthLayout>
  )
}
