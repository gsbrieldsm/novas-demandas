'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { AdminNav } from '@/components/AdminNav'
import type { BlocoDocumento } from '@/types'

export default function DocumentoEditorPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [clienteFixoId, setClienteFixoId] = useState<string | null>(null)
  const [titulo, setTitulo] = useState('')
  const [blocos, setBlocos] = useState<BlocoDocumento[]>([])
  const [visivelPortal, setVisivelPortal] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
    api(`/api/documentos/${id}`).then(r => r.json()).then(data => {
      setClienteFixoId(data.cliente_fixo_id)
      setTitulo(data.titulo)
      setBlocos(data.blocos ?? [])
      setVisivelPortal(data.visivel_portal)
      setLoading(false)
    })
  }, [id, router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  async function salvar() {
    setSaving(true)
    await api(`/api/documentos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo, blocos, visivel_portal: visivelPortal }),
    })
    setSaving(false)
  }

  function adicionarBloco() {
    setBlocos(prev => [...prev, { id: crypto.randomUUID(), titulo: 'Novo bloco', conteudo: '' }])
  }

  function atualizarBloco(blocoId: string, campo: 'titulo' | 'conteudo', valor: string) {
    setBlocos(prev => prev.map(b => b.id === blocoId ? { ...b, [campo]: valor } : b))
  }

  function removerBloco(blocoId: string) {
    if (!confirm('Remover este bloco?')) return
    setBlocos(prev => prev.filter(b => b.id !== blocoId))
  }

  function moverBloco(index: number, direcao: -1 | 1) {
    setBlocos(prev => {
      const novo = [...prev]
      const destino = index + direcao
      if (destino < 0 || destino >= novo.length) return prev
      ;[novo[index], novo[destino]] = [novo[destino], novo[index]]
      return novo
    })
  }

  async function excluirDocumento() {
    if (!confirm('Excluir este documento permanentemente?')) return
    await api(`/api/documentos/${id}`, { method: 'DELETE' })
    if (clienteFixoId) router.push(`/admin/cliente/${clienteFixoId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-slate-400 text-sm">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav onLogout={handleLogout} />

      <div className="max-w-3xl mx-auto w-full px-4 md:px-6 py-4 md:py-8 space-y-4 pb-24">
        <button
          onClick={() => clienteFixoId && router.push(`/admin/cliente/${clienteFixoId}`)}
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          ← Voltar pro cliente
        </button>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap justify-between">
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              className="text-xl font-bold text-slate-900 border-none focus:outline-none focus:ring-2 focus:ring-[#C5A880] rounded-lg px-2 py-1 -ml-2 flex-1 min-w-[200px]"
            />
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer flex-shrink-0">
              <input type="checkbox" checked={visivelPortal} onChange={e => setVisivelPortal(e.target.checked)} className="rounded border-slate-300 text-[#C5A880] focus:ring-[#C5A880]" />
              Visível no portal do cliente
            </label>
          </div>
          <p className="text-xs text-slate-400">Esses blocos aparecem pro cliente exatamente na ordem de cima pra baixo, como uma proposta.</p>
        </div>

        <div className="space-y-3">
          {blocos.map((bloco, i) => (
            <div key={bloco.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C5A880] tabular-nums flex-shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <input
                  value={bloco.titulo}
                  onChange={e => atualizarBloco(bloco.id, 'titulo', e.target.value)}
                  className="flex-1 text-sm font-bold text-slate-800 border-none focus:outline-none focus:ring-2 focus:ring-[#C5A880] rounded-lg px-2 py-1"
                />
                <button onClick={() => moverBloco(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30 px-1">↑</button>
                <button onClick={() => moverBloco(i, 1)} disabled={i === blocos.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30 px-1">↓</button>
                <button onClick={() => removerBloco(bloco.id)} className="text-slate-300 hover:text-red-500 text-lg leading-none px-1">×</button>
              </div>
              <textarea
                value={bloco.conteudo}
                onChange={e => atualizarBloco(bloco.id, 'conteudo', e.target.value)}
                rows={5}
                placeholder="Escreva o conteúdo desse bloco..."
                className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
              />
            </div>
          ))}
        </div>

        <button
          onClick={adicionarBloco}
          className="w-full text-sm py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#C5A880] hover:text-[#C5A880] transition-colors"
        >
          + Adicionar bloco
        </button>

        <div className="flex items-center justify-between gap-2 pt-2">
          <button onClick={excluirDocumento} className="text-xs text-slate-300 hover:text-red-500 transition-colors">
            Excluir documento
          </button>
          <button
            onClick={salvar}
            disabled={saving}
            className="text-sm px-6 py-2.5 rounded-lg text-white font-medium disabled:opacity-50"
            style={{ background: '#C5A880' }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
