'use client'

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { api } from '@/lib/api'

type Tipo = 'pessoal' | 'corporativa'

interface Linha {
  incluir: boolean
  descricao: string
  valor: string
  tipo: Tipo
  pago: boolean
  vencimento: string
  repetida: boolean
}

interface ContaLida {
  descricao: string
  valor: number
  valor_pago: number
  vencimento: string
  tipo: Tipo
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.'))
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Reduz o print para no máximo 1800px e devolve um data URL JPEG (cabe no limite de upload da Vercel). */
function comprimir(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, 1800 / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * escala)
      canvas.height = Math.round(img.height * escala)
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(img.src)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = () => reject(new Error('Arquivo de imagem inválido.'))
    img.src = URL.createObjectURL(arquivo)
  })
}

/** Uma conta parcialmente paga vira duas linhas: a parte paga e o restante. */
function paraLinhas(contas: ContaLida[], existentes: Set<string>): Linha[] {
  return contas.flatMap(c => {
    const base = { incluir: true, tipo: c.tipo, vencimento: c.vencimento, repetida: existentes.has(normal(c.descricao)) }
    const parcial = c.valor_pago > 0 && c.valor_pago < c.valor
    if (parcial) {
      return [
        { ...base, descricao: c.descricao, valor: fmt(c.valor - c.valor_pago), pago: false },
        { ...base, descricao: `${c.descricao} (parcial pago)`, valor: fmt(c.valor_pago), pago: true },
      ]
    }
    return [{ ...base, descricao: c.descricao, valor: fmt(c.valor), pago: c.valor_pago >= c.valor && c.valor > 0 }]
  }).map(l => ({ ...l, incluir: !l.repetida }))
}

export function ImportarDespesas({
  mes,
  ano,
  existentes,
  onFechar,
  onImportado,
}: {
  mes: number
  ano: number
  existentes: string[]
  onFechar: () => void
  onImportado: () => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [obs, setObs] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [arrastando, setArrastando] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function ler(arquivo: File) {
    if (!arquivo.type.startsWith('image/')) {
      setErro('Envie uma imagem: print, foto ou PNG/JPG.')
      return
    }
    setErro('')
    setObs('')
    setLinhas([])
    setLendo(true)
    try {
      const imagem = await comprimir(arquivo)
      setPreview(imagem)
      const res = await api('/api/despesas/ler', { method: 'POST', body: JSON.stringify({ imagem, mes, ano }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao ler a imagem.')
      const lidas = paraLinhas(json.contas, new Set(existentes.map(normal)))
      if (lidas.length === 0) setErro('Não encontrei contas com valor nessa imagem.')
      setLinhas(lidas)
      setObs(json.observacao)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao ler a imagem.')
    } finally {
      setLendo(false)
    }
  }

  // Colar um print direto (Cmd+V) enquanto o painel está aberto
  useEffect(() => {
    function colar(e: ClipboardEvent) {
      const arquivo = Array.from(e.clipboardData?.files ?? []).find(f => f.type.startsWith('image/'))
      if (arquivo) {
        e.preventDefault()
        ler(arquivo)
      }
    }
    window.addEventListener('paste', colar)
    return () => window.removeEventListener('paste', colar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, ano])

  const atualizar = (i: number, campo: Partial<Linha>) =>
    setLinhas(prev => prev.map((l, j) => (j === i ? { ...l, ...campo } : l)))

  const selecionadas = linhas.filter(l => l.incluir && l.descricao.trim() && !isNaN(num(l.valor)))
  const total = selecionadas.reduce((s, l) => s + num(l.valor), 0)

  async function lancar() {
    setSalvando(true)
    setErro('')
    const agora = new Date().toISOString()
    try {
      for (const l of selecionadas) {
        const res = await api('/api/despesas', {
          method: 'POST',
          body: JSON.stringify({
            tipo: l.tipo,
            descricao: l.descricao.trim(),
            valor: num(l.valor),
            mes,
            ano,
            vencimento: l.vencimento || null,
            pago: l.pago,
            pago_em: l.pago ? agora : null,
          }),
        })
        if (!res.ok) throw new Error(`Falha ao lançar "${l.descricao}".`)
      }
      onImportado()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao lançar.')
      setSalvando(false)
    }
  }

  const CAMPO = 'w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-gm-accent'

  return (
    <div className="px-4 md:px-6 py-4 border-b border-slate-100 bg-slate-50">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">Lançar por print</p>
          <p className="text-xs text-slate-400">
            Solte, cole (⌘V) ou escolha um print de contas. A IA lê e você confere antes de lançar.
          </p>
        </div>
        <button onClick={onFechar} className="text-xs text-slate-400 hover:text-slate-600">Fechar</button>
      </div>

      {linhas.length === 0 && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={e => { e.preventDefault(); setArrastando(true) }}
          onDragLeave={() => setArrastando(false)}
          onDrop={e => {
            e.preventDefault()
            setArrastando(false)
            const f = e.dataTransfer.files[0]
            if (f) ler(f)
          }}
          disabled={lendo}
          className={clsx(
            'w-full rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
            arrastando ? 'border-gm-accent bg-gm-accent/10' : 'border-slate-300 bg-white hover:border-gm-accent'
          )}
        >
          {lendo ? (
            <span className="inline-flex items-center gap-2 text-sm text-slate-600">
              <span className="h-4 w-4 rounded-full border-2 border-gm-accent/30 border-t-gm-accent animate-spin" />
              Lendo as contas do print…
            </span>
          ) : (
            <>
              <span className="block text-2xl mb-1">🧾</span>
              <span className="block text-sm font-medium text-slate-700">Arraste o print aqui ou clique para escolher</span>
              <span className="block text-xs text-slate-400 mt-1">Planilha, boleto, fatura ou foto · também dá para colar com ⌘V</span>
            </>
          )}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) ler(f); e.target.value = '' }}
      />

      {erro && <p role="alert" className="mt-3 text-sm text-red-600">{erro}</p>}

      {linhas.length > 0 && (
        <div className="grid gap-4 md:grid-cols-[180px_1fr]">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Print enviado" className="hidden md:block w-full rounded-lg border border-slate-200 object-contain max-h-80 bg-white" />
          )}
          <div className="min-w-0">
            {obs && (
              <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">⚠ {obs}</p>
            )}
            <div className="space-y-2">
              {linhas.map((l, i) => (
                <div
                  key={i}
                  className={clsx(
                    'grid grid-cols-[auto_1fr_88px_auto] sm:grid-cols-[auto_1fr_110px_120px_auto] gap-2 items-center rounded-lg bg-white border px-2 py-1.5',
                    l.incluir ? 'border-slate-200' : 'border-slate-100 opacity-50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={l.incluir}
                    onChange={e => atualizar(i, { incluir: e.target.checked })}
                    aria-label={`Incluir ${l.descricao}`}
                    className="rounded border-slate-300"
                  />
                  <div className="min-w-0">
                    <input value={l.descricao} onChange={e => atualizar(i, { descricao: e.target.value })} className={CAMPO} />
                    {l.repetida && <p className="text-[10px] text-amber-600 mt-0.5">Já existe uma despesa com esse nome neste mês</p>}
                  </div>
                  <input
                    value={l.valor}
                    onChange={e => atualizar(i, { valor: e.target.value })}
                    inputMode="decimal"
                    aria-label="Valor"
                    className={clsx(CAMPO, 'text-right')}
                  />
                  <select
                    value={l.tipo}
                    onChange={e => atualizar(i, { tipo: e.target.value as Tipo })}
                    aria-label="Tipo"
                    className={clsx(CAMPO, 'hidden sm:block')}
                  >
                    <option value="pessoal">Pessoal</option>
                    <option value="corporativa">Corporativa</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs text-slate-600 whitespace-nowrap cursor-pointer">
                    <input type="checkbox" checked={l.pago} onChange={e => atualizar(i, { pago: e.target.checked })} className="rounded border-slate-300" />
                    Pago
                  </label>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => { setLinhas([]); setPreview(null); setObs('') }}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Trocar imagem
              </button>
              <button
                onClick={lancar}
                disabled={salvando || selecionadas.length === 0}
                className="text-sm px-4 py-2 rounded-lg text-white hover:opacity-90 disabled:opacity-50"
                style={{ background: 'rgb(var(--gm-accent))' }}
              >
                {salvando ? 'Lançando…' : `Lançar ${selecionadas.length} ${selecionadas.length === 1 ? 'despesa' : 'despesas'} · R$ ${fmt(total)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
