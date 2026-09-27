import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Mic,
  Send,
  Loader2,
  AlertCircle,
  MessageSquare,
  Sparkles,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  listConsultantConversations,
  listConsultantMessages,
  sendConsultantMessage,
  type AgentConversationItem,
} from '@/services/consultantService'
import type { DisplayMessage } from '@/lib/skipAi'

interface ConsultantSidebarPanelProps {
  userName?: string
  className?: string
}

const DEFAULT_QUESTIONS = [
  'Gere um relatório deste mês?',
  'Liste minhas oportunidade de economia.',
  'Quais pontos mais críticos no último mês?',
]

export function ConsultantSidebarPanel({ userName, className = '' }: ConsultantSidebarPanelProps) {
  const navigate = useNavigate()
  const firstName = userName?.trim().split(' ')[0] || 'Usuário'

  const [conversations, setConversations] = useState<AgentConversationItem[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  const [inputMessage, setInputMessage] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingDelta, setStreamingDelta] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Carregar conversas recentes ao montar para descobrir se há alguma conversa ativa ou recente
  useEffect(() => {
    let isMounted = true
    const fetchConversations = async () => {
      try {
        const list = await listConsultantConversations()
        if (isMounted) {
          setConversations(list)
        }
      } catch (err) {
        console.warn('Erro ao carregar lista de conversas no painel lateral:', err)
      }
    }
    fetchConversations()
    return () => {
      isMounted = false
    }
  }, [])

  // Carregar mensagens quando uma conversa estiver selecionada
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      return
    }

    let isMounted = true
    const loadConversationHistory = async () => {
      try {
        setLoadingMessages(true)
        setErrorMsg(null)
        const msgs = await listConsultantMessages(activeConversationId)
        if (isMounted) {
          setMessages(msgs)
        }
      } catch (err: unknown) {
        if (isMounted) {
          const errObj = err as Error
          setErrorMsg(errObj.message || 'Erro ao carregar histórico.')
        }
      } finally {
        if (isMounted) {
          setLoadingMessages(false)
        }
      }
    }

    loadConversationHistory()
    return () => {
      isMounted = false
    }
  }, [activeConversationId])

  // Rolar para o final quando mensagens mudarem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingDelta, isStreaming])

  const handleStartNewChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setActiveConversationId(null)
    setMessages([])
    setStreamingDelta('')
    setIsStreaming(false)
    setErrorMsg(null)
    setInputMessage('')
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend !== undefined ? textToSend : inputMessage
    const text = rawText.trim()
    if (!text || isStreaming) return

    if (text.length > 600) {
      setErrorMsg('A mensagem deve ter no máximo 600 caracteres.')
      return
    }

    setErrorMsg(null)
    setInputMessage('')

    const userMsgId = 'user-' + Date.now()
    const userMsg: DisplayMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      created: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setIsStreaming(true)
    setStreamingDelta('')

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const isNewConversation = !activeConversationId
      const titleCandidate = text.length > 35 ? text.slice(0, 32) + '...' : text

      const result = await sendConsultantMessage({
        message: text,
        conversationId: activeConversationId,
        title: isNewConversation ? titleCandidate : undefined,
        signal: controller.signal,
        handlers: {
          onChunk: (_delta, full) => {
            setStreamingDelta(full)
          },
          onError: (errMsg) => {
            setErrorMsg(errMsg)
          },
        },
      })

      const assistantMsg: DisplayMessage = {
        id: result.message_id || 'assistant-' + Date.now(),
        role: 'assistant',
        content: result.content,
        citations: result.citations,
        created: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMsg])
      setStreamingDelta('')

      if (isNewConversation && result.conversationId) {
        setActiveConversationId(result.conversationId)
        try {
          const updatedList = await listConsultantConversations()
          setConversations(updatedList)
        } catch {
          // ignore
        }
      }
    } catch (err: unknown) {
      const errObj = err as Error
      if (errObj.name !== 'AbortError') {
        console.error('Erro na resposta do consultor:', err)
        setErrorMsg(
          errObj.message || 'Ocorreu um erro ao consultar o agente. Tente novamente mais tarde.',
        )
      }
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const hasMessages = messages.length > 0 || isStreaming

  return (
    <div
      className={`flex flex-col bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs transition-shadow w-full lg:w-[390px] shrink-0 ${className}`}
      style={{ minWidth: 0 }}
    >
      {/* Título do painel */}
      <h2 className="text-base font-bold text-slate-900 mb-3 tracking-tight">
        Meu Consultor Financeiro
      </h2>

      {/* Botão de Histórico de Chats */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate('/consultor')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold transition-colors border border-blue-100/80 shadow-2xs"
          title="Ver página completa do consultor e histórico"
        >
          <ArrowLeft className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>Histórico de chats</span>
        </button>

        {hasMessages && (
          <button
            type="button"
            onClick={handleStartNewChat}
            className="text-[11px] font-medium text-slate-500 hover:text-blue-600 transition-colors"
          >
            Novo chat
          </button>
        )}
      </div>

      {/* Área central com rolagem: ou Welcome State ou Conversa em andamento */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-0.5 max-h-[580px] lg:max-h-[calc(100vh-270px)]">
        {loadingMessages ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <p className="text-xs">Carregando conversa...</p>
          </div>
        ) : !hasMessages ? (
          /* Estado inicial conforme a imagem de referência */
          <div className="space-y-4">
            {/* Card do Consultor Virtual */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                  AI
                </div>
                <span className="font-bold text-xs text-slate-900">Consultor Virtual</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Olá {firstName}! Sou o seu consultor financeiro pessoal. Como posso ajudar com seu
                orçamento hoje?
              </p>
            </div>

            {/* Card "O que você gostaria de saber?" com sugestões */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
              <span className="text-xs font-bold text-slate-900 block">
                O que você gostaria de saber?
              </span>
              <div className="space-y-2">
                {DEFAULT_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(q)}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-200/80 bg-white hover:bg-blue-50/50 hover:border-blue-200 text-xs text-slate-700 font-medium transition-colors leading-snug shadow-2xs flex items-center justify-between group"
                  >
                    <span>{q}</span>
                    <Sparkles className="h-3 w-3 text-slate-300 group-hover:text-blue-500 shrink-0 ml-1 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Mensagens da conversa atual */
          <div className="space-y-3">
            {messages.map((m) => {
              const isUser = m.role === 'user'
              return (
                <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  {!isUser && (
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <div className="h-4 w-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                        AI
                      </div>
                      <span className="text-[10px] font-bold text-slate-600">Consultor</span>
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed max-w-[92%] whitespace-pre-wrap break-words shadow-2xs ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-br-xs font-normal'
                        : 'bg-white text-slate-800 rounded-bl-xs border border-slate-200/80'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              )
            })}

            {/* Streaming da resposta */}
            {isStreaming && (
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <div className="h-4 w-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                    AI
                  </div>
                  <span className="text-[10px] font-bold text-slate-600">Consultor</span>
                </div>
                <div className="rounded-2xl rounded-bl-xs px-3.5 py-2.5 text-xs leading-relaxed max-w-[92%] bg-white text-slate-800 border border-slate-200/80 shadow-2xs whitespace-pre-wrap">
                  {streamingDelta ? (
                    streamingDelta
                  ) : (
                    <div className="flex items-center gap-1 py-0.5 text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: '0.15s' }}
                      />
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: '0.3s' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input de Pergunta no rodapé do painel (Fiel à referência: pill rounded com "+" à esquerda, "Faça uma pergunta", "GPT-04 v" e Mic à direita) */}
      <div className="pt-3 mt-auto">
        <div className="flex items-center bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <button
            type="button"
            onClick={handleStartNewChat}
            disabled={isStreaming}
            title="Novo chat"
            className="h-6 w-6 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center shrink-0 transition-colors"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value.slice(0, 600))}
            onKeyDown={handleKeyDown}
            placeholder="Faça uma pergunta"
            disabled={isStreaming}
            className="flex-1 min-w-0 bg-transparent border-0 px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-0"
          />

          <div className="flex items-center gap-1.5 shrink-0">
            {inputMessage.trim() ? (
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={isStreaming}
                className="h-6 w-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors shadow-2xs"
                title="Enviar"
              >
                {isStreaming ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3 ml-0.5" />
                )}
              </button>
            ) : (
              <>
                <span className="text-[10px] font-medium text-slate-400 hidden sm:inline-flex items-center gap-0.5">
                  GPT-04 <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                </span>
                <button
                  type="button"
                  disabled
                  title="Entrada de áudio (em breve)"
                  className="h-6 w-6 rounded-full text-slate-400 hover:text-slate-500 flex items-center justify-center transition-colors cursor-not-allowed opacity-70"
                >
                  <Mic className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
