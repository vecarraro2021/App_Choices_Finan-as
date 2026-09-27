import React, { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Send,
  Sparkles,
  Bot,
  MessageSquare,
  Loader2,
  AlertCircle,
  Menu,
  X,
  User as UserIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  listConsultantConversations,
  listConsultantMessages,
  sendConsultantMessage,
  type AgentConversationItem,
} from '@/services/consultantService'
import type { DisplayMessage } from '@/lib/skipAi'

interface SuggestionChip {
  label: string
  prompt: string
}

const SUGGESTION_CHIPS: SuggestionChip[] = [
  {
    label: 'Como está meu mês até agora?',
    prompt: 'Como está meu mês até agora? Analise gastos, receitas e o saldo parcial.',
  },
  {
    label: 'Quais os pontos mais críticos do último mês?',
    prompt:
      'Quais os pontos mais críticos do último mês? Mostre os meses com saldo negativo, o déficit de cada um, receitas vs despesas e uma sugestão prática.',
  },
  {
    label: 'Quais categorias mais pesaram este mês?',
    prompt:
      'Quais categorias mais pesaram este mês? Mostre as maiores despesas e se houve estouro do orçamento.',
  },
  {
    label: 'Crie um relatório do último mês',
    prompt:
      'Crie um relatório completo do último mês com balanço de receitas, despesas e sugestões práticas.',
  },
]

export default function ConsultantView() {
  const [conversations, setConversations] = useState<AgentConversationItem[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  const [inputMessage, setInputMessage] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingDelta, setStreamingDelta] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Carregar lista de conversas recentes
  const fetchConversations = async (autoSelectLatest = false) => {
    try {
      setLoadingConversations(true)
      const list = await listConsultantConversations()
      setConversations(list)
      if (autoSelectLatest && list.length > 0 && !activeConversationId) {
        // Não auto-seleciona para permitir tela inicial limpa se desejar, ou mantém
      }
    } catch (err: unknown) {
      console.error('Erro ao carregar conversas:', err)
    } finally {
      setLoadingConversations(false)
    }
  }

  useEffect(() => {
    fetchConversations()
  }, [])

  // Carregar mensagens quando uma conversa for selecionada
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
    setMobileHistoryOpen(false)
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
  }

  const handleSelectConversation = (convId: string) => {
    if (convId === activeConversationId) {
      setMobileHistoryOpen(false)
      return
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setActiveConversationId(convId)
    setStreamingDelta('')
    setIsStreaming(false)
    setErrorMsg(null)
    setMobileHistoryOpen(false)
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

    // Mensagem temporária do usuário
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

      // Finalizou stream
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
        fetchConversations()
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleChipClick = (chip: SuggestionChip) => {
    handleSendMessage(chip.prompt)
  }

  return (
    <div className="flex flex-1 w-full h-full min-h-0 bg-white overflow-hidden">
      {/* Sidebar de Histórico (Desktop) */}
      <aside className="hidden md:flex w-72 flex-col border-r border-slate-200/80 bg-slate-50/50 p-4 shrink-0">
        <Button
          onClick={handleStartNewChat}
          variant="outline"
          className="w-full justify-center gap-2 rounded-full border-slate-200 bg-white text-slate-800 font-semibold shadow-2xs hover:bg-slate-50 hover:border-slate-300 py-5 transition-all text-sm"
        >
          <Plus className="h-4 w-4 text-slate-600 stroke-[2.5]" />
          Novo chat
        </Button>

        <div className="mt-6 flex items-center justify-between px-1">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Recentes
          </span>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto space-y-1 pr-1">
          {loadingConversations ? (
            <div className="flex items-center justify-center py-8 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Carregando histórico...
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-8 px-2 text-center text-xs text-slate-400 font-normal">
              Nenhum histórico recente
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = conv.id === activeConversationId
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-colors truncate flex items-center gap-2.5 ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                  title={conv.title || 'Conversa'}
                >
                  <MessageSquare
                    className={`h-3.5 w-3.5 shrink-0 ${
                      isSelected ? 'text-blue-600' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{conv.title || 'Conversa sem título'}</span>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* Drawer Mobile para Recentes */}
      {mobileHistoryOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex">
          <div className="w-4/5 max-w-xs bg-white h-full shadow-2xl flex flex-col p-4 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="font-semibold text-slate-800 text-sm">Meu Consultor</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileHistoryOpen(false)}
                className="h-8 w-8 text-slate-500"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Button
              onClick={handleStartNewChat}
              variant="outline"
              className="mt-4 w-full justify-center gap-2 rounded-full border-slate-200 bg-white text-slate-800 font-semibold py-5 text-sm"
            >
              <Plus className="h-4 w-4 text-slate-600 stroke-[2.5]" />
              Novo chat
            </Button>

            <span className="mt-5 text-[11px] font-bold tracking-wider text-slate-400 uppercase px-1">
              Recentes
            </span>

            <div className="mt-2 flex-1 overflow-y-auto space-y-1">
              {loadingConversations ? (
                <div className="flex items-center justify-center py-6 text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Carregando...
                </div>
              ) : conversations.length === 0 ? (
                <div className="py-6 px-2 text-center text-xs text-slate-400 font-normal">
                  Nenhum histórico recente
                </div>
              ) : (
                conversations.map((conv) => {
                  const isSelected = conv.id === activeConversationId
                  return (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-colors truncate flex items-center gap-2.5 ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <MessageSquare
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isSelected ? 'text-blue-600' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{conv.title || 'Conversa sem título'}</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileHistoryOpen(false)} />
        </div>
      )}

      {/* Área Principal de Chat */}
      <section className="flex-1 flex flex-col min-w-0 bg-white relative h-full">
        {/* Barra superior de controle para telas pequenas */}
        <div className="md:hidden flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileHistoryOpen(true)}
            className="text-xs text-slate-600 flex items-center gap-1.5 px-2"
          >
            <Menu className="h-4 w-4" />
            Histórico
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartNewChat}
            className="text-xs text-blue-600 font-semibold flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo chat
          </Button>
        </div>

        {/* Mensagens ou Empty State */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          {loadingMessages ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <p className="text-xs">Carregando mensagens da conversa...</p>
            </div>
          ) : messages.length === 0 && !isStreaming ? (
            /* Empty State fiel ao mockup enviado */
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-2">
              {/* Ícone em quadrado arredondado escuro conforme imagem de referência */}
              <div className="h-14 w-14 rounded-2xl bg-[#1E293B] text-white flex items-center justify-center shadow-md mb-5">
                <MessageSquare className="h-7 w-7 text-white" />
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
                Comece uma conversa
              </h2>
              <p className="text-sm text-slate-500 max-w-md mb-8">
                Pergunte sobre gastos, limites, lançamentos ou planejamento financeiro.
              </p>

              {/* Grid 2x2 com os 4 chips de sugestão */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
                {SUGGESTION_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChipClick(chip)}
                    className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50/90 hover:border-blue-200 text-left text-xs sm:text-[13px] font-medium text-slate-700 shadow-2xs transition-all group"
                  >
                    <Sparkles className="h-4 w-4 text-emerald-500 shrink-0 group-hover:text-blue-600 transition-colors" />
                    <span className="flex-1 leading-snug">{chip.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Lista de Mensagens */
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((m) => {
                const isUser = m.role === 'user'
                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="h-8 w-8 rounded-xl bg-[#1E293B] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                        <MessageSquare className="h-4 w-4 text-white" />
                      </div>
                    )}

                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap break-words shadow-2xs ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-br-xs font-normal'
                          : 'bg-slate-100/90 text-slate-800 rounded-bl-xs border border-slate-200/60'
                      }`}
                    >
                      {m.content}
                    </div>

                    {isUser && (
                      <div className="h-8 w-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                        <UserIcon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Resposta em Streaming */}
              {isStreaming && (
                <div className="flex items-start gap-3 justify-start">
                  <div className="h-8 w-8 rounded-xl bg-[#1E293B] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs animate-pulse">
                    <MessageSquare className="h-4 w-4 text-white" />
                  </div>

                  <div className="rounded-2xl rounded-bl-xs px-4 py-3 text-sm leading-relaxed max-w-[85%] bg-slate-100/90 text-slate-800 border border-slate-200/60 shadow-2xs whitespace-pre-wrap">
                    {streamingDelta ? (
                      streamingDelta
                    ) : (
                      <div className="flex items-center gap-1.5 py-1 text-slate-400">
                        <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" />
                        <span
                          className="h-2 w-2 rounded-full bg-slate-400 animate-bounce"
                          style={{ animationDelay: '0.15s' }}
                        />
                        <span
                          className="h-2 w-2 rounded-full bg-slate-400 animate-bounce"
                          style={{ animationDelay: '0.3s' }}
                        />
                        <span className="text-xs ml-1 text-slate-500 font-medium">
                          Consultando seus dados...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar no final fiel ao mock */}
        <div className="p-4 sm:px-8 pb-5 pt-2 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="relative rounded-2xl border border-slate-200/90 bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all p-3.5">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value.slice(0, 600))}
                onKeyDown={handleKeyDown}
                placeholder="Digite uma dúvida ou peça para registrar uma transação..."
                rows={2}
                disabled={isStreaming}
                className="w-full resize-none border-0 bg-transparent p-0 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-0 leading-relaxed pr-24"
              />

              <div className="flex items-center justify-between pt-2 border-t border-slate-100/80 mt-1">
                <span
                  className={`text-[11px] font-mono ${
                    inputMessage.length >= 580 ? 'text-amber-600 font-bold' : 'text-slate-400'
                  }`}
                >
                  {inputMessage.length}/600
                </span>

                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isStreaming}
                  size="icon"
                  className="h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-transform active:scale-95 disabled:opacity-40"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 ml-0.5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Aviso no rodapé idêntico ao mock */}
            <p className="mt-2 text-center text-[11px] text-slate-400 leading-tight">
              Pode cometer erros. Por isso, limite-se ao conforto de informações relevantes.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
