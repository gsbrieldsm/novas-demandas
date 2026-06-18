'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'

function formatBRL(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface PublicProposta {
  id: string
  created_at: string
  cliente_nome: string
  cliente_empresa: string | null
  cliente_email: string | null
  titulo: string
  modalidade: 'mensal' | 'pontual'
  apresentacao: string | null
  escopo: string | null
  valor: number | null
  prazo_dias: number | null
  observacoes: string | null
  validade: string | null
  status: 'rascunho' | 'enviada' | 'aceita' | 'recusada' | 'expirada'
  resposta_em: string | null
  aceito_por_nome: string | null
  aceito_por_email: string | null
  dados_fiscais_status: 'pendente' | 'preenchido' | 'nao_necessario'
  cliente_cnpj: string | null
  cliente_razao_social: string | null
  cliente_telefone: string | null
}

function formatCNPJ(value: string) {
  return value
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function formatTelefone(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export default function PublicPropostaPage() {
  const params = useParams()
  const id = params.id as string

  const [proposta, setProposta] = useState<PublicProposta | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [aceitando, setAceitando] = useState(false)
  const [showAceite, setShowAceite] = useState(false)
  const [aceiteForm, setAceiteForm] = useState({ nome: '', email: '' })
  const [aceiteErro, setAceiteErro] = useState<string | null>(null)
  const [aceitouAgora, setAceitouAgora] = useState(false)
  const [fiscalForm, setFiscalForm] = useState({ cnpj: '', razao_social: '', telefone: '' })
  const [enviandoFiscal, setEnviandoFiscal] = useState(false)
  const [fiscalErro, setFiscalErro] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/public/proposta/${id}`)
      .then(async r => {
        if (!r.ok) { setNotFound(true); return null }
        return r.json()
      })
      .then(data => {
        if (data) {
          setProposta(data)
          setAceiteForm(f => ({
            ...f,
            nome: data.cliente_nome || '',
            email: data.cliente_email || '',
          }))
        }
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [id])

  async function confirmarAceite() {
    if (!aceiteForm.nome.trim()) {
      setAceiteErro('Por favor, confirme seu nome')
      return
    }
    setAceitando(true)
    setAceiteErro(null)
    const res = await fetch(`/api/public/proposta/${id}/aceitar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aceiteForm),
    })
    if (res.ok) {
      setAceitouAgora(true)
      setShowAceite(false)
      if (proposta) {
        setProposta({
          ...proposta,
          status: 'aceita',
          resposta_em: new Date().toISOString(),
          aceito_por_nome: aceiteForm.nome.trim(),
          aceito_por_email: aceiteForm.email.trim() || null,
        })
      }
    } else {
      const err = await res.json().catch(() => ({ error: 'Erro' }))
      setAceiteErro(err.error || 'Não foi possível aceitar')
    }
    setAceitando(false)
  }

  async function enviarDadosFiscais(tipo: 'preenchido' | 'nao_necessario') {
    if (tipo === 'preenchido') {
      if (!fiscalForm.cnpj.trim() || !fiscalForm.razao_social.trim()) {
        setFiscalErro('CNPJ e Razão Social são obrigatórios')
        return
      }
    }
    setEnviandoFiscal(true)
    setFiscalErro(null)
    const res = await fetch(`/api/public/proposta/${id}/dados-fiscais`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, ...fiscalForm }),
    })
    if (res.ok) {
      if (proposta) {
        setProposta({
          ...proposta,
          dados_fiscais_status: tipo,
          cliente_cnpj: tipo === 'preenchido' ? fiscalForm.cnpj.trim() : null,
          cliente_razao_social: tipo === 'preenchido' ? fiscalForm.razao_social.trim() : null,
          cliente_telefone: tipo === 'preenchido' ? (fiscalForm.telefone.trim() || null) : null,
        })
      }
    } else {
      const err = await res.json().catch(() => ({ error: 'Erro' }))
      setFiscalErro(err.error || 'Não foi possível enviar')
    }
    setEnviandoFiscal(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080c10' }}>
        <p className="text-white/50 text-sm">Carregando proposta...</p>
      </div>
    )
  }

  if (notFound || !proposta) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#080c10' }}>
        <div className="text-center max-w-md">
          <Image src="/logo-symbol.png" alt="GM&Co" width={48} height={48} className="mx-auto mb-4" style={{ filter: 'brightness(0) invert(1)' }} />
          <h1 className="text-white text-xl font-bold mb-2">Proposta não encontrada</h1>
          <p className="text-white/50 text-sm">O link pode ter expirado ou estar incorreto.</p>
        </div>
      </div>
    )
  }

  const aceita = proposta.status === 'aceita'
  const recusada = proposta.status === 'recusada'
  const expirada = proposta.status === 'expirada'
  const podeAceitar = !aceita && !recusada && !expirada

  return (
    <>
      <div className="bg-[#f5f6f8] min-h-screen print:bg-white print:min-h-0">

        <div className="max-w-[860px] mx-auto px-4 md:px-6 py-4 md:py-6 print:px-0 print:py-0 print:max-w-full">

          {/* Status banner (visível só se já tem resposta) */}
          {aceita && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex items-center gap-3 print:hidden">
              <span className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center text-lg flex-shrink-0">✓</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-green-900">
                  {aceitouAgora ? 'Proposta aceita com sucesso!' : 'Proposta aceita'}
                </p>
                <p className="text-xs text-green-700 mt-0.5">
                  {aceitouAgora
                    ? 'Gabriel entrará em contato em breve pra finalizar.'
                    : `Aceita em ${proposta.resposta_em ? format(new Date(proposta.resposta_em), "d 'de' MMM yyyy", { locale: ptBR }) : ''}${proposta.aceito_por_nome ? ` por ${proposta.aceito_por_nome}` : ''}`}
                </p>
              </div>
            </div>
          )}
          {recusada && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 print:hidden">
              <p className="text-sm font-semibold text-red-900">Esta proposta foi recusada.</p>
            </div>
          )}
          {expirada && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 print:hidden">
              <p className="text-sm font-semibold text-amber-900">Esta proposta expirou.</p>
              <p className="text-xs text-amber-700 mt-0.5">Entre em contato pra solicitar uma nova.</p>
            </div>
          )}

          {/* DOCUMENTO */}
          <article
            className="bg-white shadow-[0_8px_32px_rgba(8,12,16,0.12)] overflow-hidden print:shadow-none"
            style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}
          >

            {/* CAPA */}
            <header
              className="relative px-8 md:px-14 py-12 md:py-16 text-white overflow-hidden"
              style={{ background: '#080c10' }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 65% 90% at 85% 0%, rgba(201,169,110,0.18) 0%, transparent 55%), radial-gradient(ellipse 50% 70% at 10% 100%, rgba(107,76,40,0.25) 0%, transparent 50%)' }} />
              <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

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

                <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-2 tracking-tight">{proposta.titulo}</h1>
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
                    value={proposta.modalidade === 'pontual' && proposta.prazo_dias ? `${proposta.prazo_dias} dias` : 'A combinar'}
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

              {/* 00 APRESENTAÇÃO */}
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
                <SectionHeader number={proposta.apresentacao ? '01' : '01'} label="Escopo da Proposta" />
                {proposta.escopo ? (
                  <div className="text-[15px] leading-[1.85] whitespace-pre-wrap" style={{ color: '#2a3340' }}>
                    {proposta.escopo}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Escopo a definir.</p>
                )}
              </section>

              {/* 02 INVESTIMENTO */}
              <section>
                <SectionHeader number="02" label="Investimento" />
                <div className="border-2 rounded-2xl p-6 md:p-8 text-center" style={{ borderColor: '#c9a96e' }}>
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

                {podeAceitar ? (
                  <>
                    <p className="text-sm leading-relaxed mb-8 text-center" style={{ color: '#5a6e84' }}>
                      Esta proposta é válida até{' '}
                      <strong style={{ color: '#2a3340' }}>
                        {proposta.validade
                          ? format(new Date(proposta.validade + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : format(addDays(new Date(), 15), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </strong>.
                    </p>

                    {!showAceite ? (
                      <div className="text-center">
                        <button
                          onClick={() => setShowAceite(true)}
                          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-base shadow-lg transition-transform hover:scale-105 print:hidden"
                          style={{
                            background: 'linear-gradient(135deg, #c9a96e 0%, #8B6840 100%)',
                            boxShadow: '0 8px 24px rgba(201,169,110,0.4)',
                          }}
                        >
                          ✓ Aceitar Proposta
                        </button>
                        <p className="text-xs text-slate-400 mt-3 print:hidden">Clique pra confirmar e iniciar a parceria</p>
                      </div>
                    ) : (
                      <div className="max-w-md mx-auto bg-slate-50 rounded-2xl p-6 print:hidden">
                        <p className="text-sm text-slate-700 mb-4 text-center">Confirme seu nome para aceitar a proposta:</p>
                        {aceiteErro && <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded mb-3">{aceiteErro}</div>}
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 block mb-1">Seu nome *</label>
                            <input
                              autoFocus
                              value={aceiteForm.nome}
                              onChange={e => setAceiteForm(f => ({ ...f, nome: e.target.value }))}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
                              placeholder="Como você quer ser identificado"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 block mb-1">E-mail (opcional)</label>
                            <input
                              type="email"
                              value={aceiteForm.email}
                              onChange={e => setAceiteForm(f => ({ ...f, email: e.target.value }))}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
                              placeholder="contato@empresa.com.br"
                            />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => setShowAceite(false)}
                              className="flex-1 text-sm py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-white"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={confirmarAceite}
                              disabled={aceitando || !aceiteForm.nome.trim()}
                              className="flex-1 text-sm py-2 rounded-lg text-white disabled:opacity-50 font-bold"
                              style={{ background: 'linear-gradient(135deg, #c9a96e 0%, #8B6840 100%)' }}
                            >
                              {aceitando ? 'Confirmando...' : 'Confirmar aceite'}
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 text-center pt-1">
                            Ao confirmar, você concorda com os termos desta proposta.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : aceita ? (
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: 'rgba(201,169,110,0.15)' }}>
                      <span className="text-3xl" style={{ color: '#c9a96e' }}>✓</span>
                    </div>
                    <p className="text-base font-semibold" style={{ color: '#2a3340' }}>
                      Proposta aceita
                    </p>
                    {proposta.aceito_por_nome && (
                      <p className="text-sm text-slate-500 mt-1">
                        por <strong>{proposta.aceito_por_nome}</strong>
                        {proposta.resposta_em && ` em ${format(new Date(proposta.resposta_em), "d 'de' MMM yyyy", { locale: ptBR })}`}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center italic">Esta proposta não está disponível para aceite.</p>
                )}
              </section>

              {/* 05 DADOS FISCAIS */}
              {aceita && (
                <section className="print:hidden">
                  <SectionHeader number={proposta.observacoes ? '05' : '04'} label="Nota Fiscal e Boleto" />

                  {proposta.dados_fiscais_status === 'preenchido' ? (
                    <div className="max-w-md mx-auto bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                      <p className="text-sm font-semibold text-green-900 mb-1">✓ Dados recebidos</p>
                      <p className="text-xs text-green-700">
                        {proposta.cliente_razao_social} · CNPJ {proposta.cliente_cnpj}
                      </p>
                      <p className="text-xs text-green-700 mt-3">
                        Em breve você recebe o boleto e a nota fiscal por e-mail.
                      </p>
                    </div>
                  ) : proposta.dados_fiscais_status === 'nao_necessario' ? (
                    <div className="max-w-md mx-auto bg-slate-50 rounded-2xl p-6 text-center">
                      <p className="text-sm text-slate-500">Sem necessidade de contrato ou nota fiscal para este projeto.</p>
                    </div>
                  ) : (
                    <div className="max-w-md mx-auto bg-slate-50 rounded-2xl p-6">
                      <p className="text-sm text-slate-700 mb-4 text-center">
                        Pra emitir a nota fiscal e o boleto, preencha os dados da empresa:
                      </p>
                      {fiscalErro && <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded mb-3">{fiscalErro}</div>}
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 block mb-1">CNPJ *</label>
                          <input
                            value={fiscalForm.cnpj}
                            onChange={e => setFiscalForm(f => ({ ...f, cnpj: formatCNPJ(e.target.value) }))}
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
                            placeholder="00.000.000/0000-00"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 block mb-1">Razão Social *</label>
                          <input
                            value={fiscalForm.razao_social}
                            onChange={e => setFiscalForm(f => ({ ...f, razao_social: e.target.value }))}
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
                            placeholder="Razão social da empresa"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 block mb-1">Telefone (opcional)</label>
                          <input
                            value={fiscalForm.telefone}
                            onChange={e => setFiscalForm(f => ({ ...f, telefone: formatTelefone(e.target.value) }))}
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white"
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                        <button
                          onClick={() => enviarDadosFiscais('preenchido')}
                          disabled={enviandoFiscal || !fiscalForm.cnpj.trim() || !fiscalForm.razao_social.trim()}
                          className="w-full text-sm py-2 rounded-lg text-white disabled:opacity-50 font-bold"
                          style={{ background: 'linear-gradient(135deg, #c9a96e 0%, #8B6840 100%)' }}
                        >
                          {enviandoFiscal ? 'Enviando...' : 'Enviar dados'}
                        </button>
                        <button
                          onClick={() => enviarDadosFiscais('nao_necessario')}
                          disabled={enviandoFiscal}
                          className="w-full text-xs text-slate-400 hover:text-slate-600 underline disabled:opacity-50"
                        >
                          Não vou precisar de contrato/nota fiscal para este projeto
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}
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
                gmeco.com.br · Proposta gerada em {format(new Date(proposta.created_at), "d 'de' MMM yyyy", { locale: ptBR })}
              </p>
            </footer>
          </article>

          {/* Botão de impressão (escondido no print) */}
          <div className="text-center mt-4 print:hidden">
            <button
              onClick={() => window.print()}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              🖨 Imprimir esta proposta
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </>
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
