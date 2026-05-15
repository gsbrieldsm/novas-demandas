'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import { AdminNav } from '@/components/AdminNav'
import type { Lead, LeadStatus, LeadCanal } from '@/app/admin/comercial/page'
import { REQUEST_TYPE_LABELS } from '@/types'
import type { RequestType } from '@/types'

const CANAL_LABELS: Record<LeadCanal, string> = {
  whatsapp: 'WhatsApp',
  pessoal: 'Pessoal',
  indicacao: 'Indicação',
  outro: 'Outro',
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  contato: 'Contato',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  fechado: 'Fechado',
  perdido: 'Perdido',
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface ConvertForm {
  request_type: RequestType
  title: string
  description: string
}

export default function LeadDetailPage() {
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [anotacoes, setAnotacoes] = useState('')
  const [savingNota, setSavingNota] = useState(false)
  const [showConvert, setShowConvert] = useState(false)
  const [converting, setConverting] = useState(false)
  const [convertForm, setConvertForm] = useState<ConvertForm>({ request_type: 'estrategia', title: '', description: '' })
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
    api(`/api/leads/${id}`).then(r => r.json()).then(data => {
      setLead(data)
      setAnotacoes(data.anotacoes ?? '')
      setLoading(false)
    })
  }, [id, router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  async function updateField(field: string, value: unknown) {
    const res = await api(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    const updated = await res.json()
    setLead(updated)
  }

  async function saveAnotacoes() {
    setSavingNota(true)
    await updateField('anotacoes', anotacoes)
    setSavingNota(false)
  }

  async function handleDelete() {
    if (!confirm('Excluir este lead?')) return
    await api(`/api/leads/${id}`, { method: 'DELETE' })
    router.push('/admin/comercial')
  }

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault()
    if (!lead) return
    setConverting(true)

    const ticketRes = await api('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: lead.nome,
        client_email: '',
        company: lead.empresa ?? null,
        request_type: convertForm.request_type,
        title: convertForm.title,
        description: convertForm.description || null,
        status: 'novo',
        priority: 'normal',
        is_fixed_client: false,
        pagamento_recebido: false,
      }),
    })
    const ticket = await ticketRes.json()

    await api(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'fechado',
        convertido_em: new Date().toISOString(),
        ticket_id: ticket.id,
      }),
    })

    router.push(`/admin/chamado/${ticket.id}`)
  }

  if (loading || !lead) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-slate-400 text-sm">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <AdminNav onLogout={handleLogout} />

      <div className="max-w-2xl mx-auto w-full px-6 py-8 space-y-6">

        {/* Voltar */}
        <button
          onClick={() => router.push('/admin/comercial')}
          className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
        >
          ← Comercial
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{lead.nome}</h1>
            {lead.empresa && <p className="text-slate-400 text-sm mt-0.5">{lead.empresa}</p>}
          </div>
          {lead.convertido_em ? (
            <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-green-100 text-green-700 mt-1">
              ✓ Convertido em chamado
            </span>
          ) : (
            <button
              onClick={() => setShowConvert(true)}
              className="text-sm font-medium px-4 py-2 rounded-xl bg-[#C5A880] text-white hover:bg-[#b39470] transition-colors"
            >
              Converter em Chamado
            </button>
          )}
        </div>

        {/* Info card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</p>
              <select
                value={lead.status}
                onChange={e => updateField('status', e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white w-full"
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Canal</p>
              <select
                value={lead.canal}
                onChange={e => updateField('canal', e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white w-full"
              >
                {Object.entries(CANAL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">WhatsApp</p>
              <input
                defaultValue={lead.telefone ?? ''}
                onBlur={e => updateField('telefone', e.target.value || null)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#C5A880] w-full"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Valor estimado</p>
              <input
                defaultValue={lead.valor_estimado ?? ''}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(',', '.'))
                  updateField('valor_estimado', isNaN(v) ? null : v)
                }}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#C5A880] w-full"
                placeholder="0,00"
                inputMode="decimal"
              />
              {lead.valor_estimado != null && (
                <p className="text-xs text-slate-400 mt-1">{formatBRL(lead.valor_estimado)}</p>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-50 flex items-center gap-4 text-xs text-slate-400">
            <span>Criado em {format(new Date(lead.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            {lead.convertido_em && (
              <span>Convertido em {format(new Date(lead.convertido_em), "d 'de' MMM", { locale: ptBR })}</span>
            )}
            {lead.ticket_id && (
              <button
                onClick={() => router.push(`/admin/chamado/${lead.ticket_id}`)}
                className="text-[#C5A880] hover:underline"
              >
                Ver chamado →
              </button>
            )}
          </div>
        </div>

        {/* Anotações */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Anotações</h2>
          </div>
          <div className="px-6 py-4 space-y-3">
            <textarea
              value={anotacoes}
              onChange={e => setAnotacoes(e.target.value)}
              className="w-full text-sm text-slate-700 placeholder-slate-300 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
              rows={5}
              placeholder="O que foi conversado, interesses, objeções, próximos passos..."
            />
            <button
              onClick={saveAnotacoes}
              disabled={savingNota}
              className="text-sm px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors disabled:opacity-60"
            >
              {savingNota ? 'Salvando...' : 'Salvar anotações'}
            </button>
          </div>
        </div>

        {/* Excluir */}
        <div className="flex justify-end">
          <button
            onClick={handleDelete}
            className="text-xs text-slate-300 hover:text-red-400 transition-colors"
          >
            Excluir lead
          </button>
        </div>
      </div>

      {/* Modal converter em chamado */}
      {showConvert && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Converter em Chamado</h2>
              <button onClick={() => setShowConvert(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>
            <form onSubmit={handleConvert} className="px-6 py-5 space-y-4">
              <div className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3">
                Será criado um chamado para <span className="font-semibold text-slate-600">{lead.nome}</span>
                {lead.empresa ? ` (${lead.empresa})` : ''}.
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Tipo de demanda</label>
                <select
                  value={convertForm.request_type}
                  onChange={e => setConvertForm(f => ({ ...f, request_type: e.target.value as RequestType }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
                >
                  {Object.entries(REQUEST_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Título *</label>
                <input
                  required
                  value={convertForm.title}
                  onChange={e => setConvertForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  placeholder="Ex: Criação de conteúdo mensal"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Descrição</label>
                <textarea
                  value={convertForm.description}
                  onChange={e => setConvertForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
                  rows={3}
                  placeholder="Opcional..."
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConvert(false)}
                  className="flex-1 text-sm py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={converting}
                  className="flex-1 text-sm py-2 rounded-lg bg-[#C5A880] text-white hover:bg-[#b39470] transition-colors disabled:opacity-60"
                >
                  {converting ? 'Criando...' : 'Criar chamado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
