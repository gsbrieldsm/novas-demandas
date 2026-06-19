'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AdminNav } from '@/components/AdminNav'
import { valorPorExtenso } from '@/lib/extenso'

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ReciboContent() {
  const router = useRouter()
  const search = useSearchParams()

  const [form, setForm] = useState({
    nome: search.get('nome') ?? '',
    cnpj: search.get('cnpj') ?? '',
    valor: search.get('valor') ?? '',
    referente: search.get('referente') ?? '',
    data: format(new Date(), 'yyyy-MM-dd'),
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const valorNum = parseFloat(form.valor.replace(',', '.')) || 0

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <div className="print:hidden">
        <AdminNav onLogout={handleLogout} />
      </div>

      <div className="max-w-2xl mx-auto w-full px-4 md:px-6 py-4 md:py-8 space-y-4 print:p-0 print:max-w-full">

        {/* Edição (escondido no print) */}
        <div className="print:hidden bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Dados do recibo</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Recebido de (nome / razão social)">
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
            </Field>
            <Field label="CNPJ / CPF">
              <input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
            </Field>
            <Field label="Valor recebido (R$)">
              <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} inputMode="decimal" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
            </Field>
            <Field label="Data">
              <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Referente a">
                <input value={form.referente} onChange={e => setForm(f => ({ ...f, referente: e.target.value }))} placeholder="ex: Mensalidade de junho/2026" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]" />
              </Field>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            disabled={!form.nome.trim() || !valorNum}
            className="text-sm px-4 py-2 rounded-lg text-white disabled:opacity-50 font-medium"
            style={{ background: '#C5A880' }}
          >
            🖨 Imprimir / Salvar PDF
          </button>
        </div>

        {/* Documento imprimível */}
        <div className="bg-white border border-slate-200 print:border-none rounded-2xl print:rounded-none p-10 md:p-14 print:p-10">
          <div className="flex items-center gap-3 mb-10">
            <Image src="/logo-symbol.png" alt="GM&Co" width={36} height={36} />
            <div>
              <p className="text-[12px] font-bold tracking-[0.2em] uppercase leading-none" style={{ color: '#2a3340' }}>
                Gabriel Moraes <span style={{ color: '#c9a96e' }}>&amp;</span> Co
              </p>
              <p className="text-[9px] tracking-[0.18em] text-slate-400 uppercase mt-1">Marketing &amp; Estratégia</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-1 tracking-tight" style={{ color: '#2a3340' }}>RECIBO</h1>
          <p className="text-center text-sm font-bold mb-10 tabular-nums" style={{ color: '#c9a96e' }}>
            {valorNum ? formatBRL(valorNum) : 'R$ —'}
          </p>

          <p className="text-[15px] leading-[1.9] text-justify" style={{ color: '#2a3340' }}>
            Recebi de <strong>{form.nome.trim() || '_________________________'}</strong>
            {form.cnpj.trim() && <>, CNPJ/CPF nº <strong>{form.cnpj.trim()}</strong></>}, a importância de{' '}
            <strong>{valorNum ? formatBRL(valorNum) : '_________________________'}</strong>
            {valorNum > 0 && <> ({valorPorExtenso(valorNum)})</>}, referente a{' '}
            <strong>{form.referente.trim() || '_________________________'}</strong>.
          </p>

          <p className="text-sm text-slate-500 mt-10">
            {form.data
              ? format(new Date(form.data + 'T12:00:00'), "'Santa Catarina,' d 'de' MMMM 'de' yyyy", { locale: ptBR })
              : ''}
          </p>

          <div className="mt-16 pt-4 border-t border-slate-300 max-w-xs">
            <p className="text-sm font-bold" style={{ color: '#2a3340' }}>Gabriel Moraes &amp; Co</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  )
}

export default function ReciboPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Carregando...</div>}>
      <ReciboContent />
    </Suspense>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">{label}</label>
      {children}
    </div>
  )
}
