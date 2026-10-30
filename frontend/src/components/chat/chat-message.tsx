import { Bot, ShieldCheck, Wrench } from "lucide-react"

import { InlineOrderCard } from "@/components/chat/order-tracking-stepper"
import { EscalationCard, TicketCreatedCard } from "@/components/cards/approval-card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatTime, initialsOf } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/types"

interface ChatMessageProps {
  message: ChatMessage
  onSuggestion?: (suggestion: string) => void
  compact?: boolean
}

export function ChatMessageBubble({ message, onSuggestion, compact = false }: ChatMessageProps) {
  if (message.role === "system") {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full border border-border bg-slate-50 px-2.5 py-1 text-[10.5px] text-muted-foreground">
          {message.content}
        </span>
      </div>
    )
  }

  const isUser = message.role === "user"
  const isAgent = message.role === "agent"

  return (
    <div className={cn("flex gap-2.5", isUser ? "flex-row" : "flex-row")}>
      {/* Avatar */}
      <div className="shrink-0 pt-0.5">
        {isUser ? (
          <Avatar className="size-8 ring-2 ring-white">
            <AvatarFallback className="bg-slate-200 text-[11px] font-semibold text-slate-600">
              {initialsOf(message.authorName ?? "John Doe")}
            </AvatarFallback>
          </Avatar>
        ) : isAgent ? (
          <Avatar className="size-8 ring-2 ring-violet-100">
            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[10.5px] font-semibold text-white">
              {initialsOf(message.authorName ?? "Support Agent")}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 shadow-sm ring-2 ring-indigo-100">
            <Bot className="size-4 text-white" strokeWidth={2.2} />
          </div>
        )}
      </div>

      <div className={cn("min-w-0 flex-1", isUser ? "max-w-[85%]" : "max-w-full")}>
        {/* Header */}
        {!isUser && (
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[11.5px] font-semibold text-slate-700">
              {message.authorName ?? (isAgent ? "Support agent" : "ResolveAI Assistant")}
            </span>
            <span className="text-[10.5px] text-muted-foreground">•</span>
            <span className="text-[10.5px] text-muted-foreground">{formatTime(message.createdAt)}</span>
            {isAgent ? (
              <Badge variant="violet" className="ml-1 h-4 px-1.5 text-[9.5px]">
                Human agent
              </Badge>
            ) : (
              <Badge variant="info" className="ml-1 h-4 gap-0.5 px-1.5 text-[9.5px]">
                <ShieldCheck className="size-2.5" /> AI
              </Badge>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          className={cn(
            "relative rounded-2xl border px-3.5 py-2.5 text-[13px] leading-relaxed",
            compact && "text-[12.5px]",
            isUser
              ? "rounded-tl-md border-indigo-100 bg-indigo-50/80 text-slate-800"
              : isAgent
                ? "rounded-tl-md border-violet-100 bg-violet-50/60 text-slate-800"
                : "rounded-tl-md border-slate-200/80 bg-slate-50/90 text-slate-800"
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>

          {message.card?.kind === "order_status" && <InlineOrderCard data={message.card} />}
          {message.card?.kind === "ticket_created" && <TicketCreatedCard data={message.card} />}
          {message.card?.kind === "escalation" && <EscalationCard data={message.card} />}

          {message.failed && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5">
              <span className="text-[11px] text-rose-700">
                Response interrupted. Your message is saved — retry when ready.
              </span>
              <Button size="xs" variant="outline" className="h-6 shrink-0 text-[11px]">
                Retry
              </Button>
            </div>
          )}
        </div>

        {/* Grounding / tool provenance */}
        {!isUser && !isAgent && message.card?.kind === "order_status" && (
          <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Wrench className="size-2.5" />
            Grounded in <span className="font-mono">get_order_info</span> · MCP business tool · demo
          </p>
        )}

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestion?.(suggestion)}
                className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {isUser && (
          <p className="mt-1 text-right text-[10px] text-muted-foreground">
            {formatTime(message.createdAt)}
          </p>
        )}
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 ring-2 ring-indigo-100">
        <Bot className="size-4 text-white" strokeWidth={2.2} />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-slate-200/80 bg-slate-50 px-3.5 py-3">
        <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-slate-400" />
        <span className="ml-1 text-[10.5px] text-muted-foreground">Checking your account…</span>
      </div>
    </div>
  )
}

export function MessageComposer({
  onSend,
  disabled,
  placeholder = "Type your message...",
  hint,
}: {
  onSend: (value: string) => void
  disabled?: boolean
  placeholder?: string
  hint?: string
}) {
  return (
    <form
      className="border-t border-border bg-white px-3 py-2.5"
      onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const input = form.elements.namedItem("message") as HTMLInputElement
        const value = input.value.trim()
        if (!value) return
        onSend(value)
        input.value = ""
      }}
    >
      <div className="flex items-center gap-1.5 rounded-xl border border-border bg-slate-50/70 px-1.5 py-1 transition-colors focus-within:border-primary/40 focus-within:bg-white">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="shrink-0 text-slate-400 hover:text-slate-600"
          aria-label="Attach a file"
          disabled
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Button>
        <input
          name="message"
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="h-8 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
        />
        <Button
          type="submit"
          size="icon-sm"
          className="size-8 shrink-0 rounded-lg bg-primary text-white shadow-sm hover:bg-primary/90"
          aria-label="Send message"
          disabled={disabled}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
            <path d="M22 2L11 13" strokeLinecap="round" />
            <path d="M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Button>
      </div>
      <p className="mt-1 px-1 text-center text-[10px] text-muted-foreground">
        {hint ?? "Demo mode — replies are simulated locally until Milestone 4"}
      </p>
    </form>
  )
}
