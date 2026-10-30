import { Link } from "react-router-dom"
import { ArrowUpRight, MessageSquare, Package, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"

function RobotMark() {
  return (
    <svg viewBox="0 0 200 200" className="size-full" role="img" aria-label="ResolveAI assistant">
      <defs>
        <linearGradient id="bot-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        <linearGradient id="bot-visor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="bot-accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>

      {/* body */}
      <rect x="52" y="128" width="96" height="56" rx="24" fill="url(#bot-face)" opacity="0.95" />
      <rect x="86" y="146" width="28" height="8" rx="4" fill="url(#bot-accent)" />

      {/* head */}
      <rect x="38" y="52" width="124" height="82" rx="34" fill="url(#bot-face)" />
      <rect x="52" y="68" width="96" height="50" rx="24" fill="url(#bot-visor)" />
      {/* eyes */}
      <circle cx="86" cy="93" r="7" fill="#38bdf8" />
      <circle cx="114" cy="93" r="7" fill="#38bdf8" />
      <circle cx="88" cy="90" r="2.4" fill="#e0f2fe" />
      <circle cx="116" cy="90" r="2.4" fill="#e0f2fe" />
      {/* smile */}
      <path d="M92 108 Q100 114 108 108" stroke="#38bdf8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* headset band */}
      <path d="M32 92 Q32 40 100 40 Q168 40 168 92" stroke="#e2e8f0" strokeWidth="9" fill="none" strokeLinecap="round" />
      {/* ear cups */}
      <rect x="24" y="80" width="16" height="30" rx="8" fill="#cbd5e1" />
      <rect x="160" y="80" width="16" height="30" rx="8" fill="#cbd5e1" />
      <circle cx="168" cy="95" r="5" fill="#38bdf8" />
      {/* mic boom */}
      <path d="M32 108 Q32 128 58 132" stroke="#cbd5e1" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="60" cy="132" r="4.5" fill="#38bdf8" />
    </svg>
  )
}

export function HeroBanner({
  title = "AI-Powered Customer Support, Made Easy",
  description = "Resolve customer issues faster with intelligent assistance and automated workflows.",
  actionLabel = "New Chat",
  actionTo = "/support",
  onAction,
}: {
  title?: string
  description?: string
  actionLabel?: string
  actionTo?: string
  onAction?: () => void
}) {
  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl brand-gradient px-6 py-5 text-white shadow-[0_12px_40px_-18px_rgba(37,99,235,0.9)] sm:px-8 lg:py-6">
      {/* decorative layers */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-10 -top-16 size-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 right-32 size-56 rounded-full bg-violet-400/30 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.15] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]" />
      </div>

      <div className="relative flex items-center justify-between gap-6">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] backdrop-blur">
            <Sparkles className="size-3" /> ResolveAI assistant
          </span>
          <h2 className="mt-2.5 text-[26px] font-bold leading-[1.15] tracking-tight sm:text-[30px]">
            {title}
          </h2>
          <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-blue-50/90">{description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {onAction ? (
              <Button
                onClick={onAction}
                className="h-9 gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-slate-900 shadow-sm hover:bg-blue-50"
              >
                <MessageSquare className="size-4" />
                {actionLabel}
                <ArrowUpRight className="size-3.5" />
              </Button>
            ) : (
              <Button
                asChild
                className="h-9 gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-slate-900 shadow-sm hover:bg-blue-50"
              >
                <Link to={actionTo}>
                  <MessageSquare className="size-4" />
                  {actionLabel}
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            )}
            <span className="hidden items-center gap-1.5 text-[11.5px] text-blue-100/80 sm:flex">
              <Package className="size-3.5" /> Grounded in your live order data
            </span>
          </div>
        </div>

        <div className="relative hidden shrink-0 pr-2 md:block lg:pr-8">
          <div className="absolute inset-0 -m-6 rounded-full bg-white/10 blur-2xl" />
          <div className="relative size-[132px] lg:size-[150px]">
            <RobotMark />
          </div>
          <div className="absolute -right-4 top-0 rounded-xl rounded-br-sm bg-white px-3 py-1.5 text-[11.5px] font-semibold text-slate-700 shadow-lg">
            How can I help you today?
          </div>
        </div>
      </div>
    </div>
  )
}
