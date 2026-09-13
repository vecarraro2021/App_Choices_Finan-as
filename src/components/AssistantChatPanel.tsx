import React, { useState, useEffect, useRef } from 'react'
import { sendAssistantChatMessage, getLearnedRules, CategoryRule } from '@/services/aiService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: any[]
  created?: string
}

const SUGGESTED_QUESTIONS = [
  'Quanto gastei com Moradia até agora?',
  'Quais foram as maiores despesas do mês passado?',
  'Como foram os gastos de alimentação fora vs mercado?',
  'Quais categorias ultrapassaram o orçamento estimado?',
]

export default function AssistantChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Olá! Sou o seu Assistente de Inteligência Financeira. Posso analisar suas despesas, tirar dúvidas sobre seu orçamento, verificar categorias e aprender com as suas classificações de faturas. Como posso ajudar hoje?',
    },
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [learnedRules, setLearnedRules] = useState<CategoryRule[]>([])
  const [loadingRules, setLoadingRules] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const loadRules = async () => {
    try {
      setLoadingRules(true)
      const list = await getLearnedRules()
      setLearnedRules(list)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingRules(false)
    }
  }

  useEffect(() => {
    loadRules()
  }, [])

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim()
    if (!text || loading) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      created: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputMessage('')
    setLoading(true)

    try {
      const res = await sendAssistantChatMessage(text, conversationId)
      if (res.conversation_id) {
        setConversationId(res.conversation_id)
      }

      const botMsg: Message = {
        id: res.message_id || `bot-${Date.now()}`,
        role: 'assistant',
        content: res.content || 'Não consegui obter uma resposta.',
        citations: res.citations,
        created: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, botMsg])
    } catch (err: any) {
      console.error('Erro no chat:', err)
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          err.message ||
          'Desculpe, ocorreu uma instabilidade temporária ao falar com a IA. Por favor, tente novamente.',
        created: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Chat Area */}
      <Card className="lg:col-span-2 border-slate-200 shadow-sm flex flex-col h-[650px]">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Assistente Financeiro
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-medium">
                  Nativo Skip Cloud
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Pergunte sobre gastos, orçamentos, categorias ou histórico
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMessages([
                {
                  id: 'welcome',
                  role: 'assistant',
                  content: 'Conversa reiniciada. Em que posso te ajudar agora com suas finanças?',
                },
              ])
              setConversationId(null)
            }}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Nova Conversa
          </Button>
        </CardHeader>

        {/* Message Stream */}
        <CardContent className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`rounded-xl px-3.5 py-2.5 text-xs max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white font-medium rounded-tr-xs'
                    : 'bg-slate-100 text-slate-800 border border-slate-200 rounded-tl-xs'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5 items-center text-xs text-slate-400">
              <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                <span>O assistente está analisando seus dados...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Suggested chips */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="text-slate-500 shrink-0 font-medium">Sugestões:</span>
          {SUGGESTED_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              disabled={loading}
              onClick={() => handleSend(q)}
              className="bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-slate-700 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Chat Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="p-3 border-t border-slate-200 flex gap-2 bg-white"
        >
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Pergunte sobre seus gastos, faturas ou categorias..."
            className="text-xs h-10"
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={loading || !inputMessage.trim()}
            className="bg-blue-600 hover:bg-blue-700 font-semibold px-4 h-10"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </Card>

      {/* Side Knowledge & Learned Memory Card */}
      <div className="space-y-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600" />
              Padrões Aprendidos pela IA
            </CardTitle>
            <CardDescription className="text-xs">
              Quando você confirma categorias na importação, a IA memoriza a regra para os próximos
              extratos.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {loadingRules ? (
              <div className="py-6 text-center text-xs text-slate-400">Carregando regras...</div>
            ) : learnedRules.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                <HelpCircle className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
                <p className="font-medium text-slate-600">Nenhum padrão aprendido ainda</p>
                <p className="mt-0.5">
                  Importe uma fatura e classifique lançamentos para ensinar a IA.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {learnedRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-800 block truncate">
                        "{rule.pattern}"
                      </span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        {rule.expand?.category?.name || 'Categoria associada'}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0 bg-white">
                      Auto
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tips card */}
        <Card className="border-blue-100 bg-blue-50/50 shadow-xs">
          <CardContent className="p-4 text-xs text-blue-900 space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-blue-950">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Como a IA Categoriza?
            </div>
            <p className="leading-relaxed text-blue-800">
              1. <strong>Regras do Usuário:</strong> Padrões confirmados por você têm prioridade
              máxima.
            </p>
            <p className="leading-relaxed text-blue-800">
              2. <strong>Árvore Oficial:</strong> A IA sugere categorias com rótulos de confiança
              (provável ou possível).
            </p>
            <p className="leading-relaxed text-blue-800">
              3. <strong>IA precisa de ajuda:</strong> Lançamentos desconhecidos são destacados com
              combobox pesquisável para sua validação rápida.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
