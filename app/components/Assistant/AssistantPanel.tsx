'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from 'ai'
import {
  X,
  Send,
  Loader2,
  Check,
  Ban,
  Wrench,
  History,
  SquarePen,
  ArrowLeft,
  Trash2,
} from 'lucide-react'

/** Minimal structural view of a tool UI part (states we render). */
interface ToolPartView {
  type: string
  state:
    | 'input-streaming'
    | 'input-available'
    | 'approval-requested'
    | 'approval-responded'
    | 'output-available'
    | 'output-error'
  input?: Record<string, unknown>
  output?: unknown
  errorText?: string
  approval?: { id: string; approved?: boolean; reason?: string }
}

interface ChatThread {
  id: string
  title: string | null
  updated_at: string
}

const WRITE_TOOLS = new Set([
  'create_collection',
  'add_items_to_collection',
  'remove_items_from_collection',
])

const TOOL_LABELS: Record<string, string> = {
  list_collections: 'listing collections',
  get_collection_items: 'reading collection',
  search_items: 'searching items',
  create_collection: 'create collection',
  add_items_to_collection: 'add items',
  remove_items_from_collection: 'remove items',
}

function toolName(partType: string): string {
  return partType.replace(/^tool-/, '')
}

function extractCollectionId(pathname: string): string | null {
  const match = pathname.match(/^\/collections\/([0-9a-f-]{36})/)
  return match ? match[1] : null
}

/** One-line human summary of a pending write tool call. */
function describeWrite(name: string, input: Record<string, unknown> | undefined): string {
  const itemCount = Array.isArray(input?.item_ids) ? (input!.item_ids as unknown[]).length : 0
  switch (name) {
    case 'create_collection':
      return `Create "${input?.name}" (${input?.visibility ?? 'private'})${
        itemCount ? ` and add ${itemCount} item${itemCount === 1 ? '' : 's'}` : ''
      }`
    case 'add_items_to_collection':
      return `Add ${itemCount} item${itemCount === 1 ? '' : 's'} to collection`
    case 'remove_items_from_collection':
      return `Remove ${itemCount} item${itemCount === 1 ? '' : 's'} from collection`
    default:
      return name
  }
}

function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// ── Chat view (one thread; remounted via key when the thread changes) ───────

function ChatView({
  chatId,
  initialMessages,
}: {
  chatId: string
  initialMessages: UIMessage[]
}) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const transportRef = useRef(
    new DefaultChatTransport({
      api: '/api/chat',
      // Evaluated per request, so context follows client-side navigation
      body: () => {
        const pathname =
          typeof window !== 'undefined' ? window.location.pathname : ''
        return {
          pathname,
          collectionId: extractCollectionId(pathname),
        }
      },
    })
  )

  const { messages, sendMessage, addToolApprovalResponse, status } = useChat({
    id: chatId,
    messages: initialMessages,
    transport: transportRef.current,
    sendAutomaticallyWhen: (options) =>
      lastAssistantMessageIsCompleteWithToolCalls(options) ||
      lastAssistantMessageIsCompleteWithApprovalResponses(options),
  })

  const busy = status === 'submitted' || status === 'streaming'

  // Keep the latest message in view
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, status])

  const handleSend = () => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    sendMessage({ text })
  }

  const renderToolPart = (part: ToolPartView, key: string) => {
    const name = toolName(part.type)
    const label = TOOL_LABELS[name] ?? name
    const isWrite = WRITE_TOOLS.has(name)

    // Pending approval → the confirm card
    if (isWrite && part.state === 'approval-requested' && part.approval) {
      const approvalId = part.approval.id
      return (
        <div
          key={key}
          className="bg-slate-deep border border-open-green/40 rounded-md p-3 space-y-2"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-open-green">
            Approval required
          </p>
          <p className="font-mono text-sm text-slate-200">
            {describeWrite(name, part.input)}
          </p>
          {name === 'create_collection' && typeof part.input?.description === 'string' && (
            <p className="font-mono text-xs text-slate-500">{part.input.description}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => addToolApprovalResponse({ id: approvalId, approved: true })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-open-green text-void font-mono text-xs font-bold hover:bg-emerald-400"
            >
              <Check className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() =>
                addToolApprovalResponse({
                  id: approvalId,
                  approved: false,
                  reason: 'User declined',
                })
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-700 text-slate-300 font-mono text-xs hover:border-slate-500"
            >
              <Ban className="w-3.5 h-3.5" /> Deny
            </button>
          </div>
        </div>
      )
    }

    if (isWrite && part.state === 'approval-responded') {
      return (
        <p key={key} className="font-mono text-xs text-slate-500">
          {part.approval?.approved ? '✓ approved' : '✗ denied'} — {label}
        </p>
      )
    }

    if (part.state === 'output-error') {
      return (
        <p key={key} className="font-mono text-xs text-red-400">
          ✗ {label} failed{part.errorText ? `: ${part.errorText}` : ''}
        </p>
      )
    }

    if (part.state === 'output-available') {
      const output = part.output as Record<string, unknown> | undefined
      const errored = output && typeof output === 'object' && 'error' in output && output.error
      return (
        <p
          key={key}
          className={`font-mono text-xs ${errored ? 'text-red-400' : 'text-slate-500'}`}
        >
          {errored ? `✗ ${label}: ${output!.error}` : `✓ ${label}`}
        </p>
      )
    }

    // input-streaming / input-available (running)
    return (
      <p key={key} className="flex items-center gap-1.5 font-mono text-xs text-slate-500">
        <Wrench className="w-3 h-3 animate-pulse" /> {label}…
      </p>
    )
  }

  return (
    <>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="font-mono text-sm text-slate-500 space-y-2">
            <p>Ask me about your Trove, or have me organize it. e.g.</p>
            <p className="text-slate-400">&gt; which of my watches cost over $5k?</p>
            <p className="text-slate-400">
              &gt; pull those into a new collection called grails
            </p>
            <p className="text-slate-400">&gt; what wine do I have from burgundy?</p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="space-y-2">
            {message.role === 'user' ? (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-md bg-slate-800 px-3 py-2 font-mono text-sm text-slate-200 whitespace-pre-wrap">
                  {message.parts
                    .filter((p) => p.type === 'text')
                    .map((p) => (p as { text: string }).text)
                    .join('')}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {message.parts.map((part, i) => {
                  if (part.type === 'text') {
                    const text = (part as { text: string }).text
                    if (!text.trim()) return null
                    return (
                      <p
                        key={`${message.id}-${i}`}
                        className="font-mono text-sm text-slate-300 whitespace-pre-wrap leading-relaxed"
                      >
                        {text}
                      </p>
                    )
                  }
                  if (part.type.startsWith('tool-')) {
                    return renderToolPart(
                      part as unknown as ToolPartView,
                      `${message.id}-${i}`
                    )
                  }
                  return null
                })}
              </div>
            )}
          </div>
        ))}

        {busy && (
          <p className="flex items-center gap-2 font-mono text-xs text-slate-500">
            <Loader2 className="w-3 h-3 animate-spin" /> thinking…
          </p>
        )}
      </div>

      {/* Input */}
      <div
        className="border-t border-slate-800 p-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            rows={1}
            placeholder="ask your trove…"
            className="flex-1 resize-none rounded-md bg-slate-deep border border-slate-800 px-3 py-2 font-mono text-base md:text-sm text-slate-200 placeholder:text-slate-600 focus:border-open-green focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="rounded-md bg-open-green p-2 text-void hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  )
}

// ── Threads view ─────────────────────────────────────────────────────────────

function ThreadsView({
  onSelect,
  activeChatId,
}: {
  onSelect: (chatId: string, messages: UIMessage[]) => void
  activeChatId: string
}) {
  const [threads, setThreads] = useState<ChatThread[] | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/chats')
      const data = await res.json()
      setThreads(res.ok ? (data.chats ?? []) : [])
    } catch {
      setThreads([])
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const openThread = async (id: string) => {
    setLoadingId(id)
    try {
      const res = await fetch(`/api/chats/${id}`)
      const data = await res.json()
      if (res.ok && data.chat) {
        onSelect(data.chat.id, (data.chat.messages ?? []) as UIMessage[])
      }
    } finally {
      setLoadingId(null)
    }
  }

  const deleteThread = async (id: string) => {
    setThreads((prev) => (prev ? prev.filter((t) => t.id !== id) : prev))
    await fetch(`/api/chats/${id}`, { method: 'DELETE' }).catch(() => refresh())
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
      {threads === null && (
        <p className="flex items-center gap-2 font-mono text-xs text-slate-500">
          <Loader2 className="w-3 h-3 animate-spin" /> loading threads…
        </p>
      )}
      {threads?.length === 0 && (
        <p className="font-mono text-sm text-slate-500">
          No previous conversations yet.
        </p>
      )}
      {threads?.map((thread) => (
        <div
          key={thread.id}
          className={`group flex items-center gap-2 rounded-md border px-3 py-2.5 ${
            thread.id === activeChatId
              ? 'border-open-green/40 bg-slate-deep'
              : 'border-slate-800 hover:border-slate-600'
          }`}
        >
          <button
            onClick={() => openThread(thread.id)}
            className="flex-1 min-w-0 text-left"
          >
            <p className="font-mono text-sm text-slate-200 truncate">
              {loadingId === thread.id ? 'loading…' : thread.title || 'Untitled chat'}
            </p>
            <p className="font-mono text-xs text-slate-600">
              {relativeTime(thread.updated_at)}
            </p>
          </button>
          <button
            onClick={() => deleteThread(thread.id)}
            aria-label="Delete chat"
            className="shrink-0 text-slate-600 hover:text-red-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Panel shell ──────────────────────────────────────────────────────────────

export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const [chatId, setChatId] = useState(() => crypto.randomUUID())
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([])
  const [view, setView] = useState<'chat' | 'threads'>('chat')

  const startNewChat = () => {
    setChatId(crypto.randomUUID())
    setInitialMessages([])
    setView('chat')
  }

  const resumeThread = (id: string, messages: UIMessage[]) => {
    setChatId(id)
    setInitialMessages(messages)
    setView('chat')
  }

  return (
    <div className="fixed inset-0 md:inset-y-0 md:left-auto md:right-0 md:w-[420px] z-[70] flex flex-col bg-void border-l border-slate-800 shadow-hard h-[100dvh]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          {view === 'threads' ? (
            <button
              onClick={() => setView('chat')}
              aria-label="Back to chat"
              className="text-slate-500 hover:text-slate-200"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : null}
          <p className="font-mono text-xs uppercase tracking-widest text-open-green">
            {view === 'threads' ? 'Conversations' : 'Trove Assistant'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {view === 'chat' && (
            <>
              <button
                onClick={() => setView('threads')}
                aria-label="Previous conversations"
                title="Previous conversations"
                className="text-slate-500 hover:text-slate-200"
              >
                <History className="w-4 h-4" />
              </button>
              <button
                onClick={startNewChat}
                aria-label="New chat"
                title="New chat"
                className="text-slate-500 hover:text-slate-200"
              >
                <SquarePen className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            aria-label="Close assistant"
            className="text-slate-500 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === 'threads' ? (
        <ThreadsView onSelect={resumeThread} activeChatId={chatId} />
      ) : (
        <ChatView key={chatId} chatId={chatId} initialMessages={initialMessages} />
      )}
    </div>
  )
}
