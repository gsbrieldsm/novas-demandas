'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { addDays, format } from 'date-fns'
import { AdminNav } from '@/components/AdminNav'
import type { PropostaModalidade } from '@/types'

function NovaPropostaForm() {
  const router = useRouter()
  const search = useSearchParams()
  const clienteFixoIdParam = search.get('cliente_fixo_id')
  const leadIdParam = search.get('lead_id')

  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [preLoad, setPreLoad] = useState(true)
  const [clientesFixos, setClientesFixos] = useState<Array<{ id: string; nome: string; valor_mensal: number; email: string | null }>>([])
  const [clienteFixoSelecionado, setClienteFixoSelecionado] = useState(clienteFixoIdParam ?? '')

  const APRESENTACAO_PADRAO = 'Marketing sem propósito é custo, não investimento. Cada ação que entregamos tem um porquê estratégico claro.\n\nSe você chegou aqui, é porque acredita que sua marca pode crescer com intencionalidade. Vamos juntos.'

  const [form, setForm] = useState({
    titulo: '',
    cliente_nome: '',
    cliente_empresa: '',
    cliente_email: '',
    modalidade: 'mensal' as PropostaModalidade,
    valor: '',
    prazo_dias: '',
    apresentacao: APRESENTACAO_PADRAO,
    escopo: '',
    observacoes: '',
    validade: format(addDays(new Date(), 15), 'yyyy-MM-dd'),
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })

    // Pré-carrega dados se vier de cliente fixo ou lead
    async function preencher() {
      const cfRes = await api(`/api/clientes-fixos`)
      let cs: Array<Record<string, unknown>> = []
      if (cfRes.ok) {
        cs = await cfRes.json()
        setClientesFixos(cs as Array<{ id: string; nome: string; valor_mensal: number; email: string | null }>)
      }
      if (clienteFixoIdParam) {
        const cf = cs.find(c => c.id === clienteFixoIdParam)
        if (cf) {
          setForm(f => ({
            ...f,
            titulo: `Renovação de Parceria · ${cf.nome}`,
            cliente_nome: cf.nome as string,
            cliente_email: (cf.email as string) ?? '',
            valor: cf.valor_mensal ? String(cf.valor_mensal) : '',
            escopo: (cf.escopo_mensal as string) ?? '',
          }))
        }
      }
      if (leadIdParam) {
        const res = await api(`/api/leads/${leadIdParam}`)
        if (res.ok) {
          const lead = await res.json()
          setForm(f => ({
            ...f,
            titulo: `Proposta de Parceria · ${lead.nome}`,
            cliente_nome: lead.nome,
            cliente_empresa: lead.empresa ?? '',
            valor: lead.valor_estimado ? String(lead.valor_estimado) : '',
          }))
        }
      }
      setPreLoad(false)
    }
    preencher()
  }, [clienteFixoIdParam, leadIdParam, router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  async function criar() {
    if (!form.titulo.trim() || !form.cliente_nome.trim()) {
      setErro('Título e nome do cliente são obrigatórios')
      return
    }
    setSaving(true)
    setErro(null)
    const body = {
      titulo: form.titulo.trim(),
      cliente_nome: form.cliente_nome.trim(),
      cliente_empresa: form.cliente_empresa.trim() || null,
      cliente_email: form.cliente_email.trim() || null,
      cliente_fixo_id: clienteFixoSelecionado || null,
      lead_id: leadIdParam || null,
      modalidade: form.modalidade,
      valor: form.valor ? parseFloat(form.valor.replace(',', '.')) : null,
      prazo_dias: form.prazo_dias ? parseInt(form.prazo_dias, 10) : null,
      apresentacao: form.apresentacao.trim() || null,
      escopo: form.escopo.trim() || null,
      observacoes: form.observacoes.trim() || null,
      validade: form.validade || null,
      status: 'rascunho',
    }
    const res = await api('/api/propostas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const nova = await res.json()
      router.push(`/admin/proposta/${nova.id}`)
    } else {
      const err = await res.json().catch(() => ({ error: 'erro' }))
      setErro(`Erro: ${err.error || res.status}`)
    }
    setSaving(false)
  }

  if (preLoad) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-slate-400 text-sm">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav onLogout={handleLogout} />

      <div className="max-w-2xl mx-auto w-full px-4 md:px-6 py-4 md:py-8 space-y-4">

        <button onClick={() => router.back()} className="text-sm text-slate-400 hover:text-slate-600">← Voltar</button>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-slate-400">Nova Proposta</p>
            <h1 className="text-xl font-bold text-slate-900 mt-1">Crie uma proposta personalizada</h1>
          </div>

          {erro && <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded">{erro}</div>}

          <Field label="Vincular a cliente existente (opcional)">
            <select
              value={clienteFixoSelecionado}
              onChange={e => {
                const novoId = e.target.value
                setClienteFixoSelecionado(novoId)
                const cf = clientesFixos.find(c => c.id === novoId)
                if (cf) {
                  setForm(f => ({
                    ...f,
                    cliente_nome: cf.nome,
                    cliente_email: cf.email ?? '',
                  }))
                }
              }}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
            >
              <option value="">— Novo cliente (não vincular) —</option>
              {clientesFixos.map(cf => (
                <option key={cf.id} value={cf.id}>{cf.nome}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Se selecionar, essa proposta fica vinculada à tela desse cliente fixo.
            </p>
          </Field>

          <Field label="Título da proposta *">
            <input
              value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              placeholder="Ex: Marketing Estratégico · Schornstein 2026"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Modalidade">
              <div className="flex rounded-lg overflow-hidden border border-slate-200 text-sm">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, modalidade: 'mensal' }))}
                  className={`flex-1 py-2 font-medium ${form.modalidade === 'mensal' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500'}`}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, modalidade: 'pontual' }))}
                  className={`flex-1 py-2 font-medium ${form.modalidade === 'pontual' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500'}`}
                >
                  Pontual
                </button>
              </div>
            </Field>
            <Field label={form.modalidade === 'mensal' ? 'Valor mensal (R$)' : 'Valor total (R$)'}>
              <input
                value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                inputMode="decimal"
                placeholder="0,00"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente *">
              <input
                value={form.cliente_nome}
                onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))}
                placeholder="Nome do destinatário"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
              />
            </Field>
            <Field label="Empresa">
              <input
                value={form.cliente_empresa}
                onChange={e => setForm(f => ({ ...f, cliente_empresa: e.target.value }))}
                placeholder="Opcional"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="E-mail">
              <input
                value={form.cliente_email}
                onChange={e => setForm(f => ({ ...f, cliente_email: e.target.value }))}
                type="email"
                placeholder="Opcional"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
              />
            </Field>
            <Field label="Validade">
              <input
                value={form.validade}
                onChange={e => setForm(f => ({ ...f, validade: e.target.value }))}
                type="date"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
              />
            </Field>
          </div>

          {form.modalidade === 'pontual' && (
            <Field label="Prazo de entrega (em dias)">
              <input
                value={form.prazo_dias}
                onChange={e => setForm(f => ({ ...f, prazo_dias: e.target.value }))}
                type="number"
                min="1"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
              />
            </Field>
          )}

          <Field label="Apresentação (vende você antes do escopo)">
            <textarea
              value={form.apresentacao}
              onChange={e => setForm(f => ({ ...f, apresentacao: e.target.value }))}
              rows={5}
              className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none italic"
              placeholder="Aparece como seção 00, antes do escopo..."
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Texto padrão já preenchido (sua filosofia). Edite ou apague se preferir não ter.
            </p>
          </Field>

          <Field label="Escopo detalhado">
            <textarea
              value={form.escopo}
              onChange={e => setForm(f => ({ ...f, escopo: e.target.value }))}
              rows={5}
              className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
              placeholder={'• 2 posts no Instagram por semana\n• 3 diárias gravadas no mês\n• 1 reunião estratégica mensal'}
            />
          </Field>

          <Field label="Observações / condições">
            <textarea
              value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
              placeholder="Forma de pagamento, fidelidade, multa de rescisão..."
            />
          </Field>

          <div className="flex gap-2 pt-2">
            <button
              onClick={criar}
              disabled={saving || !form.titulo.trim() || !form.cliente_nome.trim()}
              className="flex-1 text-sm px-4 py-2.5 rounded-lg text-white disabled:opacity-50"
              style={{ background: '#C5A880' }}
            >
              {saving ? 'Criando...' : 'Criar proposta'}
            </button>
            <button
              onClick={() => router.back()}
              className="text-sm px-4 py-2.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export default function NovaPropostaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Carregando...</div>}>
      <NovaPropostaForm />
    </Suspense>
  )
}
