import clsx from 'clsx'
import { PLANO_STATUS_LABEL, dataBR, type PlanoItem, type PlanoStatus } from '@/lib/trafego'

export const PLANO_COR: Record<PlanoStatus, string> = {
  proposto: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-violet-100 text-violet-700',
  em_andamento: 'bg-sky-100 text-sky-700',
  concluido: 'bg-emerald-100 text-emerald-700',
}

export function StatusPlano({ s }: { s: PlanoStatus }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap', PLANO_COR[s])}>
      {PLANO_STATUS_LABEL[s]}
    </span>
  )
}

/** Plano de ação somente leitura (página do cliente). */
export function PlanoLeitura({ plano }: { plano: PlanoItem[] }) {
  if (plano.length === 0) {
    return <p className="text-sm text-slate-500">O plano de ação aparece aqui assim que for aprovado.</p>
  }
  const feitos = plano.filter(p => p.status === 'concluido').length
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-gm-accent to-gm-glow" style={{ width: `${(feitos / plano.length) * 100}%` }} />
        </div>
        <p className="text-xs text-slate-500 tabular-nums whitespace-nowrap">{feitos} de {plano.length} concluídos</p>
      </div>
      <ol className="mt-4 space-y-3">
        {plano.map((p, i) => (
          <li key={p.id} className="grid grid-cols-[32px_1fr] gap-3 rounded-xl border border-slate-200 p-4">
            <span
              className={clsx(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold tabular-nums',
                p.status === 'concluido' ? 'bg-emerald-500 text-white' : 'bg-gm-accent/10 text-gm-accent'
              )}
            >
              {p.status === 'concluido' ? '✓' : i + 1}
            </span>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <p className={clsx('font-semibold text-slate-900', p.status === 'concluido' && 'line-through decoration-slate-300')}>{p.titulo}</p>
                <div className="flex items-center gap-2">
                  {p.prazo && <span className="text-xs text-slate-500 tabular-nums">até {dataBR(p.prazo)}</span>}
                  <StatusPlano s={p.status} />
                </div>
              </div>
              {p.descricao && <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{p.descricao}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
