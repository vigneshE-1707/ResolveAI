import { Link } from "react-router-dom"
import { Compass, Home } from "lucide-react"

import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl brand-gradient text-white shadow-lg">
        <Compass className="size-6" />
      </div>
      <p className="mt-5 font-mono text-[12px] uppercase tracking-[0.2em] text-muted-foreground">404</p>
      <h1 className="mt-1 text-[24px] font-semibold tracking-tight">This page drifted away</h1>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
        The route you followed doesn't exist in this preview build.
      </p>
      <div className="mt-5 flex gap-2">
        <Button asChild size="sm" className="gap-1.5">
          <Link to="/support">
            <Home className="size-3.5" /> Customer support
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/agent">Agent console</Link>
        </Button>
      </div>
    </div>
  )
}
