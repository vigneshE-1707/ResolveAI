import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Bot, Headset, ShieldCheck, Sparkles } from "lucide-react"

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-sidebar px-10 py-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-10 size-80 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -right-16 bottom-0 size-96 rounded-full bg-violet-600/20 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:26px_26px]" />
        </div>

        <Link to="/" className="relative flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl brand-gradient shadow-lg">
            <Headset className="size-5" strokeWidth={2.4} />
          </span>
          <span className="text-[20px] font-bold tracking-tight">
            Resolve<span className="text-blue-400">AI</span>
          </span>
        </Link>

        <div className="relative mt-auto max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] backdrop-blur">
            <Sparkles className="size-3" /> Agentic support
          </span>
          <h2 className="mt-4 text-[34px] font-bold leading-[1.1] tracking-tight">
            Resolve more tickets.
            <br />
            <span className="bg-gradient-to-r from-blue-300 to-violet-300 bg-clip-text text-transparent">
              Escalate less.
            </span>
          </h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-slate-400">
            ResolveAI grounds every answer in your order data and policy library, executes only
            authorized actions, and hands off to humans when judgement is required.
          </p>

          <div className="mt-6 grid gap-2.5">
            {[
              { icon: Bot, text: "LangGraph agent with real tool calls, not canned replies" },
              { icon: ShieldCheck, text: "Customer-scoped MCP tools with deterministic validation" },
              { icon: Headset, text: "Human approval gates for returns, refunds, cancellations" },
            ].map((item) => (
              <div key={item.text} className="flex items-start gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                <item.icon className="mt-0.5 size-4 shrink-0 text-blue-400" />
                <p className="text-[12px] leading-snug text-slate-300">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-8 flex items-center justify-between text-[10.5px] text-slate-500">
          <span>© 2026 ResolveAI</span>
          <span>Milestone 2 preview · UI foundation</span>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-xl brand-gradient">
              <Headset className="size-4.5 text-white" strokeWidth={2.4} />
            </span>
            <span className="text-[18px] font-bold tracking-tight">
              Resolve<span className="text-blue-600">AI</span>
            </span>
          </Link>

          <h1 className="text-[24px] font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>

          <div className="mt-6">{children}</div>

          <div className="mt-5 text-center text-[12.5px] text-muted-foreground">{footer}</div>

          <Link
            to="/support"
            className="mt-8 flex items-center justify-center gap-1 text-[11.5px] font-medium text-primary hover:underline"
          >
            Continue to demo workspace <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
