import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { KeyRound, MapPin, Save } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { useAuth, useRole } from "@/app/auth-context"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useMyAddresses } from "@/lib/api/hooks"
import { ApiError } from "@/lib/api/client"

const profileSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  phone: z
    .string()
    .regex(/^[+\d][\d\s()-]{6,}$/, "Use digits, spaces, or +()-")
    .or(z.literal("")),
})

type ProfileForm = z.infer<typeof profileSchema>

export function ProfilePage() {
  const { user, role } = useRole()
  const { updateProfile } = useAuth()
  const [saving, setSaving] = useState(false)
  const isCustomer = role === "CUSTOMER"
  const addresses = useMyAddresses()
  const defaultAddress = addresses.data?.find((address) => address.isDefault) ?? addresses.data?.[0]

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user.fullName,
      phone: "",
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setSaving(true)
    try {
      await updateProfile({
        fullName: values.fullName,
        ...(isCustomer && values.phone ? { phone: values.phone } : {}),
      })
      toast.success("Profile updated")
      form.reset({ fullName: values.fullName, phone: values.phone })
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save your profile")
    } finally {
      setSaving(false)
    }
  })

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Your identity across the support platform."
        actions={<Badge variant="secondary">{role.replace("_", " ").toLowerCase()}</Badge>}
      />

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px]">Personal details</CardTitle>
            <CardDescription>Name and phone changes are saved to your account.</CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            <form className="space-y-3" onSubmit={onSubmit}>
              <div className="flex items-center gap-3">
                <Avatar className="size-14">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-[18px] font-semibold text-white">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[13px] font-semibold">{user.fullName}</p>
                  <p className="text-[11px] text-muted-foreground">Avatar upload is not available yet</p>
                </div>
              </div>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" {...form.register("fullName")} />
                  {form.formState.errors.fullName && (
                    <p className="text-[11px] text-destructive">{form.formState.errors.fullName.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={user.email} readOnly disabled />
                  <p className="text-[10.5px] text-muted-foreground">
                    Email changes are not supported yet.
                  </p>
                </div>
              </div>
              {isCustomer && (
                <div className="space-y-1.5 sm:max-w-[50%]">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="+1 (555) 010-2030" {...form.register("phone")} />
                  {form.formState.errors.phone && (
                    <p className="text-[11px] text-destructive">{form.formState.errors.phone.message}</p>
                  )}
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  className="gap-1.5"
                  disabled={!form.formState.isDirty || saving}
                >
                  <Save className="size-3.5" /> Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3.5">
          {isCustomer && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[14px]">
                  <MapPin className="size-4 text-slate-400" /> Default address
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-[12px] leading-relaxed text-slate-600">
                {addresses.isLoading ? (
                  <p className="text-muted-foreground">Loading address…</p>
                ) : defaultAddress ? (
                  <>
                    {defaultAddress.line1}
                    {defaultAddress.line2 ? (
                      <>
                        <br />
                        {defaultAddress.line2}
                      </>
                    ) : null}
                    <br />
                    {defaultAddress.city}
                    {defaultAddress.region ? `, ${defaultAddress.region}` : ""} {defaultAddress.postalCode}
                    <br />
                    {defaultAddress.country}
                  </>
                ) : (
                  <p className="text-muted-foreground">No address on file.</p>
                )}
                <Button variant="outline" size="sm" className="mt-2 w-full" disabled>
                  Address editing is not available yet
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-[14px]">
                <KeyRound className="size-4 text-slate-400" /> Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0 text-[11.5px]">
              <p className="text-muted-foreground">
                Passwords use argon2id hashing; sessions use short-lived JWTs with refresh rotation.
              </p>
              <Button variant="outline" size="sm" className="w-full" disabled>
                Change password (not available yet)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
