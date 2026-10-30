import { Link, useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { ArrowRight } from "lucide-react"
import { toast } from "sonner"

import { AuthLayout } from "@/features/auth/auth-layout"
import { useRole } from "@/app/role-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Enter your full name"),
    email: z.email("Enter a valid email"),
    password: z
      .string()
      .min(10, "Use at least 10 characters")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[0-9]/, "Include a number"),
    confirm: z.string(),
    terms: z.boolean().refine((value) => value === true, {
      message: "Accept the terms to continue",
    }),
  })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  })

type RegisterForm = z.infer<typeof registerSchema>

export function RegisterPage() {
  const navigate = useNavigate()
  const { setRole } = useRole()
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirm: "", terms: false },
  })

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Customer accounts are created instantly in this preview."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={form.handleSubmit(() => {
          setRole("CUSTOMER")
          toast.success("Account created (demo)", {
            description: "Real registration with argon2 hashing arrives in Milestone 3.",
          })
          navigate("/support")
        })}
      >
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" placeholder="Jane Cooper" autoComplete="name" {...form.register("fullName")} />
          {form.formState.errors.fullName && (
            <p className="text-[11px] text-destructive">{form.formState.errors.fullName.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" {...form.register("email")} />
          {form.formState.errors.email && (
            <p className="text-[11px] text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
            {form.formState.errors.password && (
              <p className="text-[11px] text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm</Label>
            <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
            {form.formState.errors.confirm && (
              <p className="text-[11px] text-destructive">{form.formState.errors.confirm.message}</p>
            )}
          </div>
        </div>
        <label className="flex items-start gap-2 text-[11.5px] text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5 size-3.5 rounded border-slate-300 accent-primary"
            {...form.register("terms")}
          />
          <span>
            I agree to the <span className="text-primary">terms of service</span> and{" "}
            <span className="text-primary">privacy policy</span>.
          </span>
        </label>
        {form.formState.errors.terms && (
          <p className="text-[11px] text-destructive">{form.formState.errors.terms.message}</p>
        )}
        <Button type="submit" className="w-full gap-1.5">
          Create account <ArrowRight className="size-4" />
        </Button>
      </form>
    </AuthLayout>
  )
}
