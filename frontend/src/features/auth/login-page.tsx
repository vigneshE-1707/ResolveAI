import { Link, useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { ArrowRight, BriefcaseBusiness, Loader2, ShieldCheck, UserRound } from "lucide-react"
import { toast } from "sonner"

import { AuthLayout } from "@/features/auth/auth-layout"
import { homePath } from "@/app/navigation"
import { useRole } from "@/app/role-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { Role } from "@/types"

const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type LoginForm = z.infer<typeof loginSchema>

const demoAccounts: { role: Role; label: string; description: string; icon: typeof UserRound }[] = [
  { role: "CUSTOMER", label: "Customer", description: "John Doe", icon: UserRound },
  { role: "SUPPORT_AGENT", label: "Agent", description: "Maya Fernandez", icon: BriefcaseBusiness },
  { role: "ADMIN", label: "Admin", description: "Alex Morgan", icon: ShieldCheck },
]

export function LoginPage() {
  const navigate = useNavigate()
  const { setRole } = useRole()
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "john.doe@email.com", password: "demo-password" },
  })

  const signIn = (role: Role) => {
    setRole(role)
    toast.success("Signed in to the demo workspace", {
      description: "Authentication is implemented with JWT in Milestone 3.",
    })
    navigate(homePath[role])
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your ResolveAI workspace. Demo mode accepts any valid credentials."
      footer={
        <>
          New to ResolveAI?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={form.handleSubmit(() => signIn("CUSTOMER"))}
      >
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
              onClick={() => toast.info("Password reset emails arrive with the auth API")}
            >
              Forgot password?
            </button>
          </div>
          <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
          {form.formState.errors.password && (
            <p className="text-[11px] text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>
        <Button type="submit" className="w-full gap-1.5">
          Sign in <ArrowRight className="size-4" />
        </Button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">
            or preview a portal
          </span>
        </div>
      </div>

      <div className="grid gap-2">
        {demoAccounts.map((account) => (
          <button
            key={account.role}
            type="button"
            onClick={() => signIn(account.role)}
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
              <span className="block text-[10.5px] text-muted-foreground">{account.description}</span>
            </span>
            <ArrowRight className="size-3.5 text-slate-300" />
          </button>
        ))}
      </div>

      <p className="mt-4 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
        <Loader2 className="size-2.5" /> Demo mode · no credentials are transmitted
      </p>
    </AuthLayout>
  )
}
