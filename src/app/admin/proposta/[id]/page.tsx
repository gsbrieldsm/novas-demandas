'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import { AdminNav } from '@/components/AdminNav'
import type { Proposta, PropostaStatus, PropostaModalidade } from '@/types'
import { PROPOSTA_STATUS_LABELS } from '@/types'

function formatBRL(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_COLORS: Record<PropostaStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-600',
  enviada: 'bg-blue-100 text-blue-700',
  aceita: 'bg-green-100 text-green-700',
  recusada: 'bg-red-100 text-red-700',
  expirada: 'bg-amber-100 text-amber-700',
}

export default function PropostaPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [form, setForm] = useState({
    titulo: '',
    cliente_nome: '',
    cliente_empresa: '',
    cliente_email: '',
    modalidade: 'mensal' as PropostaModalidade,
    valor: '',
    prazo_dias: '',
    apresentacao: '',
    escopo: '',
    observacoes: '',
    validade: '',
  })
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [campoCopiado, setCampoCopiado] = useState<string | null>(null)

  function copiarCampo(campo: string, valor: string) {
    navigator.clipboard.writeText(valor)
    setCampoCopiado(campo)
    setTimeout(() => setCampoCopiado(null), 2000)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
    api(`/api/propostas/${id}`).then(r => r.json()).then(data => {
      setProposta(data)
      setForm({
        titulo: data.titulo,
        cliente_nome: data.cliente_nome,
        cliente_empresa: data.cliente_empresa ?? '',
        cliente_email: data.cliente_email ?? '',
        modalidade: data.modalidade,
        valor: data.valor ? String(data.valor) : '',
        prazo_dias: data.prazo_dias ? String(data.prazo_dias) : '',
        apresentacao: data.apresentacao ?? '',
        escopo: data.escopo ?? '',
        observacoes: data.observacoes ?? '',
        validade: data.validade ?? '',
      })
      setLoading(false)
    })
  }, [id, router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  async function salvar() {
    setSaving(true)
    setErro(null)
    const body = {
      titulo: form.titulo.trim(),
      cliente_nome: form.cliente_nome.trim(),
      cliente_empresa: form.cliente_empresa.trim() || null,
      cliente_email: form.cliente_email.trim() || null,
      modalidade: form.modalidade,
      valor: form.valor ? parseFloat(form.valor.replace(',', '.')) : null,
      prazo_dias: form.prazo_dias ? parseInt(form.prazo_dias, 10) : null,
      apresentacao: form.apresentacao.trim() || null,
      escopo: form.escopo.trim() || null,
      observacoes: form.observacoes.trim() || null,
      validade: form.validade || null,
    }
    const res = await api(`/api/propostas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const updated = await res.json()
      setProposta(updated)
      setEditando(false)
    } else {
      const err = await res.json().catch(() => ({ error: 'erro' }))
      setErro(`Erro ao salvar: ${err.error || res.status}`)
    }
    setSaving(false)
  }

  async function mudarStatus(novoStatus: PropostaStatus) {
    if (!proposta) return
    const body: Record<string, unknown> = { status: novoStatus }
    if (novoStatus === 'enviada' && !proposta.enviada_em) {
      body.enviada_em = new Date().toISOString()
    }
    if ((novoStatus === 'aceita' || novoStatus === 'recusada') && !proposta.resposta_em) {
      body.resposta_em = new Date().toISOString()
    }
    const res = await api(`/api/propostas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const updated = await res.json()
      setProposta(updated)

      // Se aceita E mensal E não tem cliente_fixo_id → cria cliente fixo
      if (novoStatus === 'aceita' && updated.modalidade === 'mensal' && !updated.cliente_fixo_id) {
        if (confirm('Proposta aceita! Deseja criar este cliente como cliente fixo agora?')) {
          const cfBody = {
            nome: updated.cliente_nome,
            email: updated.cliente_email,
            valor_mensal: updated.valor ?? 0,
            ativo: true,
            data_inicio: format(new Date(), 'yyyy-MM-dd'),
            escopo_mensal: updated.escopo,
          }
          const cfRes = await api('/api/clientes-fixos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cfBody),
          })
          if (cfRes.ok) {
            const cf = await cfRes.json()
            await api(`/api/propostas/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cliente_fixo_id: cf.id }),
            })
            router.push(`/admin/cliente/${cf.id}`)
          }
        }
      }
    }
  }

  async function excluir() {
    if (!confirm('Excluir esta proposta permanentemente?')) return
    await api(`/api/propostas/${id}`, { method: 'DELETE' })
    router.back()
  }

  if (loading || !proposta) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-slate-400 text-sm">Carregando...</div>
      </div>
    )
  }

  return (
    <>
      <div className="print:hidden">
        <AdminNav onLogout={handleLogout} />
      </div>

      <div className="bg-[#f5f6f8] min-h-screen print:bg-white print:min-h-0">

        {/* Toolbar (escondida no print) */}
        <div className="print:hidden max-w-[860px] mx-auto px-4 md:px-6 pt-4 md:pt-6 flex items-center justify-between gap-3 flex-wrap">
          <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700">← Voltar</button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx('text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full', STATUS_COLORS[proposta.status])}>
              {PROPOSTA_STATUS_LABELS[proposta.status]}
            </span>
            <select
              value={proposta.status}
              onChange={e => mudarStatus(e.target.value as PropostaStatus)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="rascunho">Rascunho</option>
              <option value="enviada">Enviada</option>
              <option value="aceita">Aceita</option>
              <option value="recusada">Recusada</option>
              <option value="expirada">Expirada</option>
            </select>
            <button
              onClick={() => setEditando(v => !v)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              {editando ? 'Cancelar edição' : '✎ Editar'}
            </button>
            <button
              onClick={() => window.print()}
              className="text-xs px-3 py-1.5 rounded-lg text-white hover:opacity-90 font-medium"
              style={{ background: '#C5A880' }}
            >
              🖨 Imprimir / PDF
            </button>
          </div>
        </div>

        {/* Link público + status do cliente */}
        <div className="print:hidden max-w-[860px] mx-auto px-4 md:px-6 pt-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-1">Link público pra mandar pro cliente</p>
              <p className="text-xs text-slate-700 font-mono truncate">
                {typeof window !== 'undefined' ? `${window.location.origin}/proposta/${id}` : `/proposta/${id}`}
              </p>
              <div className="flex items-center gap-3 mt-2 text-[11px]">
                {proposta.visto_em ? (
                  <span className="text-green-700 font-medium">
                    ✓ Cliente visualizou em {format(new Date(proposta.visto_em), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                  </span>
                ) : (
                  <span className="text-slate-400">Cliente ainda não abriu o link</span>
                )}
                {proposta.aceito_por_nome && (
                  <>
                    <span className="text-slate-200">·</span>
                    <span className="text-green-700 font-medium">Aceita por {proposta.aceito_por_nome}</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/proposta/${id}`)
                setLinkCopiado(true)
                setTimeout(() => setLinkCopiado(false), 2000)
              }}
              className="text-xs px-3 py-2 rounded-lg text-white font-medium whitespace-nowrap"
              style={{ background: '#C5A880' }}
            >
              {linkCopiado ? '✓ Copiado!' : '📋 Copiar link'}
            </button>
            <button
              onClick={() => window.open(`/proposta/${id}`, '_blank')}
              className="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 whitespace-nowrap"
            >
              ↗ Abrir
            </button>
          </div>
        </div>

        {/* Dados fiscais (NF/boleto) */}
        {proposta.status === 'aceita' && (
          <div className="print:hidden max-w-[860px] mx-auto px-4 md:px-6 pt-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-3">Dados para Nota Fiscal e Boleto</p>
              {proposta.dados_fiscais_status === 'preenchido' ? (
                <div className="space-y-2">
                  <CampoCopiavel label="CNPJ" valor={proposta.cliente_cnpj ?? ''} campo="cnpj" campoCopiado={campoCopiado} onCopy={copiarCampo} />
                  <CampoCopiavel label="Razão Social" valor={proposta.cliente_razao_social ?? ''} campo="razao_social" campoCopiado={campoCopiado} onCopy={copiarCampo} />
                  {proposta.cliente_telefone && (
                    <CampoCopiavel label="Telefone" valor={proposta.cliente_telefone} campo="telefone" campoCopiado={campoCopiado} onCopy={copiarCampo} />
                  )}
                  {proposta.dados_fiscais_em && (
                    <p className="text-[11px] text-slate-400 pt-1">
                      Enviado em {format(new Date(proposta.dados_fiscais_em), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                  <button
                    onClick={() => {
                      const params = new URLSearchParams({
                        nome: proposta.cliente_razao_social || proposta.cliente_nome,
                        cnpj: proposta.cliente_cnpj ?? '',
                        valor: proposta.valor != null ? String(proposta.valor) : '',
                        referente: proposta.titulo,
                      })
                      window.open(`/admin/recibo?${params.toString()}`, '_blank')
                    }}
                    className="text-xs px-3 py-2 rounded-lg text-white font-medium mt-1"
                    style={{ background: '#C5A880' }}
                  >
                    🧾 Gerar recibo
                  </button>
                </div>
              ) : proposta.dados_fiscais_status === 'nao_necessario' ? (
                <p className="text-sm text-slate-500">Cliente indicou que não precisa de contrato/nota fiscal.</p>
              ) : (
                <p className="text-sm text-slate-400">Aguardando o cliente preencher os dados fiscais.</p>
              )}
            </div>
          </div>
        )}

        {/* Form de edição (escondido no print) */}
        {editando && (
          <div className="print:hidden max-w-[860px] mx-auto px-4 md:px-6 pt-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
              {erro && <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded">{erro}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Título da proposta">
                  <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
                </Field>
                <Field label="Modalidade">
                  <select value={form.modalidade} onChange={e => setForm(f => ({ ...f, modalidade: e.target.value as PropostaModalidade }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white">
                    <option value="mensal">Mensal (recorrente)</option>
                    <option value="pontual">Pontual (projeto único)</option>
                  </select>
                </Field>
                <Field label="Cliente">
                  <input value={form.cliente_nome} onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
                </Field>
                <Field label="Empresa">
                  <input value={form.cliente_empresa} onChange={e => setForm(f => ({ ...f, cliente_empresa: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
                </Field>
                <Field label="E-mail">
                  <input value={form.cliente_email} onChange={e => setForm(f => ({ ...f, cliente_email: e.target.value }))} type="email" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
                </Field>
                <Field label={`Valor (R$ ${form.modalidade === 'mensal' ? '/mês' : 'total'})`}>
                  <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} inputMode="decimal" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
                </Field>
                {form.modalidade === 'pontual' && (
                  <Field label="Prazo de entrega (dias)">
                    <input value={form.prazo_dias} onChange={e => setForm(f => ({ ...f, prazo_dias: e.target.value }))} type="number" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
                  </Field>
                )}
                <Field label="Validade da proposta">
                  <input value={form.validade} onChange={e => setForm(f => ({ ...f, validade: e.target.value }))} type="date" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
                </Field>
              </div>
              <Field label="Apresentação (00) — vende você antes do escopo">
                <textarea
                  value={form.apresentacao}
                  onChange={e => setForm(f => ({ ...f, apresentacao: e.target.value }))}
                  rows={5}
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none italic"
                  placeholder={'Marketing sem propósito é custo, não investimento. Cada ação que entregamos tem um porquê estratégico claro.\n\nSe você chegou aqui, é porque acredita que sua marca pode crescer com intencionalidade. Vamos juntos.'}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Aparece como seção 00 antes do escopo. Use pra apresentar sua filosofia. Pode deixar vazio pra renovação de cliente fixo.
                </p>
              </Field>

              <Field label="Escopo detalhado">
                <textarea
                  value={form.escopo}
                  onChange={e => setForm(f => ({ ...f, escopo: e.target.value }))}
                  rows={6}
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
                  placeholder={'• 2 posts no Instagram por semana\n• 3 diárias gravadas no mês\n• 1 reunião estratégica mensal\n• Consultoria sob demanda'}
                />
              </Field>
              <Field label="Observações / condições especiais">
                <textarea
                  value={form.observacoes}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  rows={3}
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
                  placeholder="Forma de pagamento, fidelidade, multa, etc."
                />
              </Field>
              <div className="flex gap-2">
                <button onClick={salvar} disabled={saving} className="text-sm px-4 py-2 rounded-lg text-white" style={{ background: '#C5A880' }}>
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </button>
                <button onClick={excluir} className="text-xs text-slate-400 hover:text-red-500 ml-auto">Excluir proposta</button>
              </div>
            </div>
          </div>
        )}

        {/* ============ DOCUMENTO DA PROPOSTA ============ */}
        <div className="report-document max-w-[860px] mx-auto px-4 md:px-6 py-4 md:py-6 print:px-0 print:py-0 print:max-w-full">
          <article
            className="report-paper bg-white shadow-[0_8px_32px_rgba(8,12,16,0.12)] overflow-hidden print:shadow-none"
            style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}
          >

            {/* CAPA */}
            <header
              className="relative px-8 md:px-14 py-12 md:py-16 text-white overflow-hidden"
              style={{ background: '#080c10' }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse 65% 90% at 85% 0%, rgba(201,169,110,0.18) 0%, transparent 55%), radial-gradient(ellipse 50% 70% at 10% 100%, rgba(107,76,40,0.25) 0%, transparent 50%)',
                }}
              />
              <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              />

              <div className="relative">
                <div className="flex items-center gap-3 mb-12 md:mb-16">
                  <Image src="/logo-symbol.png" alt="GM&Co" width={32} height={32} style={{ filter: 'brightness(0) invert(1)' }} />
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.22em] text-white uppercase leading-none">
                      Gabriel Moraes <span style={{ color: '#c9a96e' }}>&amp;</span> Co
                    </p>
                    <p className="text-[9px] tracking-[0.18em] text-white/40 uppercase mt-1">Marketing &amp; Estratégia</p>
                  </div>
                </div>

                <div className="inline-block px-3 py-1.5 rounded-full mb-6" style={{ background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.3)' }}>
                  <p className="text-[10px] font-bold tracking-[0.22em] uppercase" style={{ color: '#e8c987' }}>
                    Proposta · {proposta.modalidade === 'mensal' ? 'Recorrente Mensal' : 'Projeto Pontual'}
                  </p>
                </div>

                <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-2 tracking-tight">
                  {proposta.titulo}
                </h1>
                <p className="text-base md:text-lg text-white/60">
                  para <em style={{ color: '#c9a96e', fontStyle: 'italic' }}>{proposta.cliente_nome}</em>
                  {proposta.cliente_empresa ? ` · ${proposta.cliente_empresa}` : ''}
                </p>

                <div className="mt-10 md:mt-12 pt-6 border-t border-white/10 grid grid-cols-3 gap-4">
                  <HeaderStat
                    label={proposta.modalidade === 'mensal' ? 'Investimento mensal' : 'Investimento total'}
                    value={formatBRL(proposta.valor)}
                  />
                  <HeaderStat
                    label={proposta.modalidade === 'mensal' ? 'Início' : 'Prazo de entrega'}
                    value={
                      proposta.modalidade === 'pontual' && proposta.prazo_dias
                        ? `${proposta.prazo_dias} dias`
                        : 'A combinar'
                    }
                  />
                  <HeaderStat
                    label="Validade"
                    value={proposta.validade ? format(new Date(proposta.validade + 'T12:00:00'), "d 'de' MMM", { locale: ptBR }) : '—'}
                  />
                </div>
              </div>
            </header>

            {/* CORPO */}
            <div className="px-8 md:px-14 py-10 md:py-14 space-y-12">

              {/* 00 APRESENTAÇÃO (se preenchida) */}
              {proposta.apresentacao && (
                <section>
                  <SectionHeader number="00" label="Antes de tudo" />
                  <div
                    className="text-[16px] leading-[1.85] whitespace-pre-wrap font-light italic"
                    style={{ color: '#3a4452' }}
                  >
                    {proposta.apresentacao}
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <div className="h-px w-8" style={{ background: '#c9a96e' }} />
                    <p className="text-[10px] font-bold tracking-[0.22em] uppercase" style={{ color: '#c9a96e' }}>
                      Gabriel Moraes &amp; Co
                    </p>
                  </div>
                </section>
              )}

              {/* 01 ESCOPO */}
              <section>
                <SectionHeader number="01" label="Escopo da Proposta" />
                {proposta.escopo ? (
                  <div className="text-[15px] leading-[1.85] whitespace-pre-wrap" style={{ color: '#2a3340' }}>
                    {proposta.escopo}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Escopo ainda não definido. Clique em &quot;Editar&quot; para detalhar.</p>
                )}
              </section>

              {/* 02 INVESTIMENTO */}
              <section>
                <SectionHeader number="02" label="Investimento" />
                <div
                  className="border-2 rounded-2xl p-6 md:p-8 text-center"
                  style={{ borderColor: '#c9a96e' }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] mb-2" style={{ color: '#c9a96e' }}>
                    {proposta.modalidade === 'mensal' ? 'Investimento Mensal' : 'Investimento Total do Projeto'}
                  </p>
                  <p className="text-4xl md:text-5xl font-bold tracking-tight tabular-nums" style={{ color: '#2a3340' }}>
                    {formatBRL(proposta.valor)}
                  </p>
                  {proposta.modalidade === 'mensal' && (
                    <p className="text-xs text-slate-500 mt-2">cobrado mensalmente · vencimento conforme contrato</p>
                  )}
                  {proposta.modalidade === 'pontual' && proposta.prazo_dias && (
                    <p className="text-xs text-slate-500 mt-2">entrega em até {proposta.prazo_dias} dias após aprovação</p>
                  )}
                </div>
              </section>

              {/* 03 OBSERVAÇÕES */}
              {proposta.observacoes && (
                <section>
                  <SectionHeader number="03" label="Condições" />
                  <div className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: '#5a6e84' }}>
                    {proposta.observacoes}
                  </div>
                </section>
              )}

              {/* 04 ACEITE */}
              <section>
                <SectionHeader number={proposta.observacoes ? '04' : '03'} label="Aceite" />
                <p className="text-sm leading-relaxed mb-6" style={{ color: '#5a6e84' }}>
                  Esta proposta é válida até{' '}
                  <strong style={{ color: '#2a3340' }}>
                    {proposta.validade
                      ? format(new Date(proposta.validade + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : format(addDays(new Date(), 15), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </strong>.
                  Para aceitar, basta confirmar este documento por escrito.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                  <div className="text-center">
                    <div className="border-t border-slate-300 pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{proposta.cliente_nome}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Contratante</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-slate-300 pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Gabriel Moraes</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Gabriel Moraes &amp; Co</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* RODAPÉ */}
            <footer
              className="px-8 md:px-14 py-8 text-center border-t"
              style={{ borderColor: '#eef0f3', background: '#fafbfc' }}
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="h-px w-12" style={{ background: '#c9a96e' }} />
                <Image src="/logo-symbol.png" alt="" width={20} height={20} style={{ filter: 'invert(60%) sepia(28%) saturate(488%) hue-rotate(2deg) brightness(91%) contrast(90%)' }} />
                <div className="h-px w-12" style={{ background: '#c9a96e' }} />
              </div>
              <p className="text-[11px] font-bold tracking-[0.22em] uppercase" style={{ color: '#2a3340' }}>
                Gabriel Moraes <span style={{ color: '#c9a96e' }}>&amp;</span> Co
              </p>
              <p className="text-[9px] tracking-[0.18em] text-slate-400 uppercase mt-1">
                Proposta gerada em {format(new Date(proposta.created_at), "d 'de' MMM yyyy", { locale: ptBR })}
              </p>
            </footer>
          </article>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .report-document { padding: 0 !important; max-width: 100% !important; }
          .report-paper { box-shadow: none !important; border-radius: 0 !important; }
          .report-paper, .report-paper * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </>
  )
}

function CampoCopiavel({
  label,
  valor,
  campo,
  campoCopiado,
  onCopy,
}: {
  label: string
  valor: string
  campo: string
  campoCopiado: string | null
  onCopy: (campo: string, valor: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <p className="text-sm text-slate-700 font-mono truncate">{valor}</p>
      </div>
      <button
        onClick={() => onCopy(campo, valor)}
        className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white whitespace-nowrap flex-shrink-0"
      >
        {campoCopiado === campo ? '✓ Copiado' : '📋 Copiar'}
      </button>
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

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold tracking-[0.22em] uppercase text-white/40 mb-1.5">{label}</p>
      <p className="text-xl md:text-2xl font-bold text-white leading-none tabular-nums">{value}</p>
    </div>
  )
}

function SectionHeader({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-6">
      <span className="text-[10px] font-bold tracking-[0.22em] uppercase tabular-nums" style={{ color: '#c9a96e' }}>
        {number}
      </span>
      <div className="h-px flex-1" style={{ background: '#e8ebf0' }} />
      <h2 className="text-[11px] font-bold tracking-[0.22em] uppercase" style={{ color: '#2a3340' }}>
        {label}
      </h2>
    </div>
  )
}
