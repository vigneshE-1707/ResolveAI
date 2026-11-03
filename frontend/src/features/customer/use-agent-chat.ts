import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { mapCard } from "@/lib/api/mappers"
import { customerApi } from "@/lib/api/endpoints"
import type { ChatMessage, MessageCard } from "@/types"

/**
 * Streams agent turns over SSE and keeps an optimistic transcript.
 *
 * The server transcript (React Query) stays the source of truth: the local copy
 * exists only while a turn is in flight, then gives way to the refetched
 * messages. A failed turn keeps the local copy so the customer can see what
 * happened and send again.
 */
export interface AgentChatOptions {
  conversationId?: string
  seedMessages: ChatMessage[]
  /** Creates a conversation for a draft thread and returns its id. */
  ensureConversation: (subject: string) => Promise<string>
}

interface LocalThread {
  id: string
  messages: ChatMessage[]
  typing: boolean
  /** True when the thread began as a draft and the page has not selected it yet. */
  draft?: boolean
}

const PENDING_ID = "draft"

export function useAgentChat({ conversationId, seedMessages, ensureConversation }: AgentChatOptions) {
  const queryClient = useQueryClient()
  const [thread, setThread] = useState<LocalThread | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const busyRef = useRef(false)

  // A turn keeps streaming if the customer browses other threads; only leaving
  // the page cancels it.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  // The server transcript is the source of truth. Once it contains everything
  // we rendered locally, derive the transcript from the query instead.
  const matchesThread = (candidate: LocalThread) =>
    candidate.id === conversationId || (Boolean(candidate.draft) && !conversationId)
  const serverCaughtUp = (candidate: LocalThread) =>
    !candidate.typing && seedMessages.length >= candidate.messages.length

  const activeThread = thread && matchesThread(thread) && !serverCaughtUp(thread) ? thread : null
  const messages = activeThread?.messages ?? seedMessages
  const typing = activeThread?.typing ?? false

  const patchMessage = useCallback(
    (messageId: string, update: (message: ChatMessage) => ChatMessage) => {
      setThread((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map((message) =>
                message.id === messageId ? update(message) : message
              ),
            }
          : prev
      )
    },
    []
  )

  const send = useCallback(
    async (value: string) => {
      const text = value.trim()
      if (!text || busyRef.current) return
      busyRef.current = true

      const base = activeThread?.messages ?? seedMessages
      const turnId = crypto.randomUUID()
      const now = new Date().toISOString()
      const userMessage: ChatMessage = {
        id: `local_user_${turnId}`,
        conversationId: conversationId ?? PENDING_ID,
        role: "user",
        content: text,
        createdAt: now,
      }
      const assistantId = `local_assistant_${turnId}`
      const assistantMessage: ChatMessage = {
        id: assistantId,
        conversationId: conversationId ?? PENDING_ID,
        role: "assistant",
        content: "",
        createdAt: now,
        authorName: "ResolveAI Assistant",
        pending: true,
      }

      let targetId = conversationId
      if (!targetId) {
        // A draft thread only becomes real when the customer sends something.
        try {
          targetId = await ensureConversation(text.slice(0, 120))
        } catch (error) {
          busyRef.current = false
          setThread({
            id: PENDING_ID,
            messages: [
              ...base,
              userMessage,
              {
                ...assistantMessage,
                content:
                  error instanceof Error && error.message
                    ? error.message
                    : "Could not start a conversation. Please try again.",
                failed: true,
                pending: false,
              },
            ],
            typing: false,
            draft: true,
          })
          return
        }
      }

      setThread({
        id: targetId,
        messages: [...base, userMessage, assistantMessage],
        typing: true,
        draft: !conversationId,
      })

      try {
        const controller = new AbortController()
        abortRef.current = controller

        let content = ""
        let card: MessageCard | undefined
        let failure: string | null = null

        for await (const frame of customerApi.chatStream(targetId, text, turnId, controller.signal)) {
          if (frame.type === "token" && typeof frame.value === "string") {
            content += frame.value
            patchMessage(assistantId, (message) => ({ ...message, content }))
          } else if (frame.type === "card") {
            card = mapCard(frame.data)
            if (card) patchMessage(assistantId, (message) => ({ ...message, card }))
          } else if (frame.type === "error") {
            failure =
              typeof frame.message === "string"
                ? frame.message
                : "The assistant could not finish this answer."
          }
        }

        if (failure) {
          patchMessage(assistantId, (message) => ({
            ...message,
            content: message.content || failure || "",
            failed: true,
            pending: false,
          }))
        } else {
          patchMessage(assistantId, (message) => ({ ...message, pending: false }))
        }
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return
        const message =
          error instanceof Error && error.message
            ? error.message
            : "The assistant is temporarily unavailable. Please try again."
        patchMessage(assistantId, (assistant) => ({
          ...assistant,
          content: assistant.content || message,
          failed: true,
          pending: false,
        }))
      } finally {
        busyRef.current = false
        abortRef.current = null
        setThread((prev) => (prev ? { ...prev, typing: false } : prev))
        if (targetId !== PENDING_ID) {
          void queryClient.invalidateQueries({
            queryKey: ["conversation", targetId, "messages"],
          })
        }
      }
    },
    [activeThread, conversationId, ensureConversation, patchMessage, queryClient, seedMessages]
  )

  return { messages, typing, send }
}
