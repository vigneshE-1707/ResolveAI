import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { KeyRound, MapPin, Save } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { useRole } from "@/app/role-context"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

const profileSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  email: z.email("Enter a valid email"),
  phone: z
    .string()
    .min(7, "Enter a valid phone number")
    .regex(/^[+\d][\d\s()-]{6,}$/, "Use digits, spaces, or +()-"),
})

type ProfileForm = z.infer<typeof profileSchema>

export function ProfilePage() {
  const { user, role } = useRole()
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user.fullName,
      email: user.email,
      phone: "+1 (503) 555-0144",
    },
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
            <CardDescription>Updates persist after Milestone 3 wires the profile API.</CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            <form
              className="space-y-3"
              onSubmit={form.handleSubmit(() => {
                toast.success("Profile saved locally", {
                  description: "The account API arrives in Milestone 3.",
                })
              })}
            >
              <div className="flex items-center gap-3">
                <Avatar className="size-14">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-[18px] font-semibold text-white">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[13px] font-semibold">{user.fullName}</p>
                  <p className="text-[11px] text-muted-foreground">Avatar upload arrives with storage support</p>
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
                  <Input id="email" type="email" {...form.register("email")} />
                  {form.formState.errors.email && (
                    <p className="text-[11px] text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 sm:max-w-[50%]">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...form.register("phone")} />
                {form.formState.errors.phone && (
                  <p className="text-[11px] text-destructive">{form.formState.errors.phone.message}</p>
                )}
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" className="gap-1.5" disabled={!form.formState.isDirty}>
                  <Save className="size-3.5" /> Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3.5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-[14px]">
                <MapPin className="size-4 text-slate-400" /> Default address
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-[12px] leading-relaxed text-slate-600">
              221 Lake Street, Apt 4B
              <br />
              Portland, OR 97209
              <br />
              United States
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => toast.info("Address editing arrives with the customer API")}
              >
                Edit address
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-[14px]">
                <KeyRound className="size-4 text-slate-400" /> Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0 text-[11.5px]">
              <p className="text-muted-foreground">
                Passwords use argon2id hashing; sessions use short-lived JWTs with refresh rotation
                (Milestone 3).
              </p>
              <Button variant="outline" size="sm" className="w-full" disabled>
                Change password
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
