import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { ArrowRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { AuthLayout } from "@/features/auth/auth-layout"
import { useAuth } from "@/app/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError } from "@/lib/api/client"

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Enter your full name"),
    email: z.email("Enter a valid email"),
    password: z
      .string()
      .min(10, "Use at least 10 characters")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[a-z]/, "Include a lowercase letter")
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
  const { register } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirm: "", terms: false },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true)
    setFormError(null)
    try {
      const user = await register(values.fullName, values.email, values.password)
      toast.success("Account created", {
        description: `Signed in as ${user.fullName}.`,
      })
      navigate("/support", { replace: true })
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Unable to create the account. Please try again."
      setFormError(message)
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Customer accounts are created instantly and signed in automatically."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-3" onSubmit={onSubmit} noValidate>
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
        {formError && (
          <p role="alert" className="rounded-md bg-destructive/10 px-2.5 py-2 text-[11.5px] text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" className="w-full gap-1.5" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Create account <ArrowRight className="size-4" />
        </Button>
      </form>
    </AuthLayout>
  )
}
