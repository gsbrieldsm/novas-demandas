'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import {
  format, addDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  isSameDay, isSameMonth, eachDayOfInterval, startOfDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import { AdminNav } from '@/components/AdminNav'
import type { Ticket } from '@/types'

type ViewMode = 'semana' | 'mes'
type EventoCor = 'azul' | 'verde' | 'roxo' | 'amarelo' | 'rosa' | 'slate'

interface Evento {
  id: string
  titulo: string
  descricao: string | null
  start_at: string
  end_at: string | null
  all_day: boolean
  cor: EventoCor
}

interface ClienteFixo {
  id: string
  nome: string
  valor_mensal: number
  dia_vencimento: number | null
  ativo: boolean
}

interface Despesa {
  id: string
  tipo: 'pessoal' | 'corporativa'
  descricao: string
  valor: number
  vencimento: string | null
}

type CalEventType = 'gravacao' | 'prazo' | 'vencimento_fixo' | 'despesa' | 'evento'

interface CalEvent {
  id: string
  type: CalEventType
  title: string
  subtitle?: string
  date: Date
  allDay: boolean
  link?: string
  raw?: Evento
}

const TYPE_COLORS: Record<CalEventType, { bg: string; bar: string; text: string; dot: string }> = {
  gravacao:        { bg: 'bg-purple-100',  bar: 'bg-purple-500',  text: 'text-purple-800',  dot: 'bg-purple-500' },
  prazo:           { bg: 'bg-red-100',     bar: 'bg-red-500',     text: 'text-red-800',     dot: 'bg-red-500' },
  vencimento_fixo: { bg: 'bg-green-100',   bar: 'bg-green-500',   text: 'text-green-800',   dot: 'bg-green-500' },
  despesa:         { bg: 'bg-amber-100',   bar: 'bg-amber-500',   text: 'text-amber-800',   dot: 'bg-amber-500' },
  evento:          { bg: 'bg-blue-100',    bar: 'bg-blue-500',    text: 'text-blue-800',    dot: 'bg-blue-500' },
}

const TYPE_ICON: Record<CalEventType, string> = {
  gravacao: '🎬',
  prazo: '⏰',
  vencimento_fixo: '💰',
  despesa: '💸',
  evento: '📝',
}

const TYPE_LABEL: Record<CalEventType, string> = {
  gravacao: 'Gravação',
  prazo: 'Prazo',
  vencimento_fixo: 'Vencimento',
  despesa: 'Despesa',
  evento: 'Evento',
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function AgendaPage() {
  const [view, setView] = useState<ViewMode>('semana')
  const [ref, setRef] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [clientesFixos, setClientesFixos] = useState<ClienteFixo[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Evento | null>(null)
  const [form, setForm] = useState<{ titulo: string; data: string; hora: string; all_day: boolean; cor: EventoCor; descricao: string }>({
    titulo: '', data: format(new Date(), 'yyyy-MM-dd'), hora: '09:00', all_day: false, cor: 'azul', descricao: '',
  })

  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
  }, [router])

  // Carrega dados pra o range em volta da data atual
  useEffect(() => {
    setLoading(true)
    const m = ref.getMonth() + 1
    const a = ref.getFullYear()
    const from = startOfMonth(subMonths(ref, 1)).toISOString()
    const to = endOfMonth(addMonths(ref, 1)).toISOString()

    Promise.all([
      api('/api/tickets').then(r => r.json()),
      api('/api/clientes-fixos').then(r => r.json()),
      api(`/api/despesas?mes=${m}&ano=${a}`).then(r => r.json()),
      api(`/api/eventos?from=${from}&to=${to}`).then(r => r.json()),
    ]).then(([t, c, d, e]) => {
      setTickets(t)
      setClientesFixos(c)
      setDespesas(d)
      setEventos(e)
      setLoading(false)
    })
  }, [ref])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  // Calcula range visível
  const range = useMemo(() => {
    if (view === 'semana') {
      const start = startOfWeek(ref, { weekStartsOn: 1 })
      const end = endOfWeek(ref, { weekStartsOn: 1 })
      return { start, end, days: eachDayOfInterval({ start, end }) }
    } else {
      const start = startOfWeek(startOfMonth(ref), { weekStartsOn: 1 })
      const end = endOfWeek(endOfMonth(ref), { weekStartsOn: 1 })
      return { start, end, days: eachDayOfInterval({ start, end }) }
    }
  }, [view, ref])

  // Agrega eventos
  const calEvents = useMemo(() => {
    const out: CalEvent[] = []

    // 1. Gravações (scheduled_at)
    tickets.forEach(t => {
      if (t.scheduled_at && t.status !== 'cancelado') {
        out.push({
          id: `g-${t.id}`,
          type: 'gravacao',
          title: t.title,
          subtitle: t.client_name,
          date: new Date(t.scheduled_at),
          allDay: false,
          link: `/admin/chamado/${t.id}`,
        })
      }
    })

    // 2. Prazos (deadline)
    tickets.forEach(t => {
      if (t.deadline && !['concluido', 'cancelado'].includes(t.status)) {
        const d = new Date(t.deadline + 'T12:00:00')
        out.push({
          id: `p-${t.id}`,
          type: 'prazo',
          title: t.title,
          subtitle: t.client_name,
          date: d,
          allDay: true,
          link: `/admin/chamado/${t.id}`,
        })
      }
    })

    // 3. Vencimentos clientes fixos (recorrente no dia X de cada mês)
    clientesFixos.forEach(c => {
      if (!c.ativo || !c.dia_vencimento) return
      range.days.forEach(d => {
        if (d.getDate() === c.dia_vencimento) {
          out.push({
            id: `v-${c.id}-${d.toISOString().slice(0, 10)}`,
            type: 'vencimento_fixo',
            title: c.nome,
            subtitle: formatBRL(Number(c.valor_mensal)),
            date: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0),
            allDay: true,
            link: '/admin/financeiro',
          })
        }
      })
    })

    // 4. Despesas com vencimento
    despesas.forEach(d => {
      if (!d.vencimento) return
      const dt = new Date(d.vencimento + 'T12:00:00')
      out.push({
        id: `d-${d.id}`,
        type: 'despesa',
        title: d.descricao,
        subtitle: `- ${formatBRL(Number(d.valor))}`,
        date: dt,
        allDay: true,
        link: '/admin/financeiro',
      })
    })

    // 5. Eventos manuais
    eventos.forEach(e => {
      out.push({
        id: `e-${e.id}`,
        type: 'evento',
        title: e.titulo,
        subtitle: e.descricao ?? undefined,
        date: new Date(e.start_at),
        allDay: e.all_day,
        raw: e,
      })
    })

    return out
  }, [tickets, clientesFixos, despesas, eventos, range.days])

  function eventsOn(day: Date) {
    return calEvents
      .filter(ev => isSameDay(ev.date, day))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }

  function openNewEvent(presetDate?: Date, presetHour?: number) {
    const d = presetDate ?? new Date()
    setForm({
      titulo: '',
      data: format(d, 'yyyy-MM-dd'),
      hora: presetHour != null ? `${String(presetHour).padStart(2, '0')}:00` : '09:00',
      all_day: false,
      cor: 'azul',
      descricao: '',
    })
    setEditing(null)
    setShowForm(true)
  }

  function openEditEvent(ev: Evento) {
    const d = new Date(ev.start_at)
    setForm({
      titulo: ev.titulo,
      data: format(d, 'yyyy-MM-dd'),
      hora: format(d, 'HH:mm'),
      all_day: ev.all_day,
      cor: ev.cor,
      descricao: ev.descricao ?? '',
    })
    setEditing(ev)
    setShowForm(true)
  }

  async function saveEvent() {
    if (!form.titulo.trim()) return
    const start = form.all_day
      ? `${form.data}T00:00:00`
      : `${form.data}T${form.hora}:00`
    const body = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      start_at: new Date(start).toISOString(),
      all_day: form.all_day,
      cor: form.cor,
    }
    if (editing) {
      const res = await api(`/api/eventos/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const updated = await res.json()
      setEventos(prev => prev.map(e => e.id === editing.id ? updated : e))
    } else {
      const res = await api('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const novo = await res.json()
      setEventos(prev => [...prev, novo])
    }
    setShowForm(false)
    setEditing(null)
  }

  async function deleteEvent() {
    if (!editing || !confirm('Excluir este evento?')) return
    await api(`/api/eventos/${editing.id}`, { method: 'DELETE' })
    setEventos(prev => prev.filter(e => e.id !== editing.id))
    setShowForm(false)
    setEditing(null)
  }

  function handleClickEvent(ev: CalEvent) {
    if (ev.type === 'evento' && ev.raw) {
      openEditEvent(ev.raw)
    } else if (ev.link) {
      router.push(ev.link)
    }
  }

  // ============ Renderiza ============
  const today = startOfDay(new Date())

  const headerLabel = view === 'semana'
    ? `${format(range.start, "d 'de' MMM", { locale: ptBR })} — ${format(range.end, "d 'de' MMM yyyy", { locale: ptBR })}`
    : format(ref, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())

  function nav(direction: -1 | 1) {
    if (view === 'semana') setRef(d => direction === 1 ? addWeeks(d, 1) : subWeeks(d, 1))
    else setRef(d => direction === 1 ? addMonths(d, 1) : subMonths(d, 1))
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <AdminNav onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto w-full px-6 py-6 space-y-4 flex-1 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Agenda</p>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">{headerLabel}</h1>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <button onClick={() => nav(-1)} className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 transition-colors">‹</button>
              <button onClick={() => setRef(new Date())} className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 transition-colors">Hoje</button>
              <button onClick={() => nav(1)} className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 transition-colors">›</button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg overflow-hidden border border-slate-200 text-sm">
              <button
                onClick={() => setView('semana')}
                className={clsx('px-4 py-2 transition-colors', view === 'semana' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50')}
              >
                Semana
              </button>
              <button
                onClick={() => setView('mes')}
                className={clsx('px-4 py-2 transition-colors', view === 'mes' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50')}
              >
                Mês
              </button>
            </div>
            <button
              onClick={() => openNewEvent()}
              className="text-sm font-medium px-4 py-2 rounded-lg text-white hover:opacity-90 transition-opacity"
              style={{ background: '#C5A880' }}
            >
              + Novo evento
            </button>
          </div>
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-4 flex-wrap text-xs">
          {(Object.entries(TYPE_LABEL) as [CalEventType, string][]).map(([k, label]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className={clsx('w-2 h-2 rounded-full', TYPE_COLORS[k].dot)} />
              <span className="text-slate-500">{TYPE_ICON[k]} {label}</span>
            </div>
          ))}
        </div>

        {/* Calendário */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Carregando...</div>
        ) : view === 'semana' ? (
          <WeekView days={range.days} eventsOn={eventsOn} today={today} onClickEvent={handleClickEvent} onNewAt={openNewEvent} />
        ) : (
          <MonthView days={range.days} ref_={ref} eventsOn={eventsOn} today={today} onClickEvent={handleClickEvent} onClickDay={(d) => openNewEvent(d)} />
        )}
      </div>

      {/* Modal de evento */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">{editing ? 'Editar evento' : 'Novo evento'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Título *</label>
                <input
                  autoFocus
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  placeholder="Reunião com cliente, ligação, tarefa..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Data</label>
                  <input
                    type="date"
                    value={form.data}
                    onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  />
                </div>
                {!form.all_day && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Hora</label>
                    <input
                      type="time"
                      value={form.hora}
                      onChange={e => setForm(f => ({ ...f, hora: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                    />
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.all_day}
                  onChange={e => setForm(f => ({ ...f, all_day: e.target.checked }))}
                />
                Dia inteiro
              </label>

              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
                  rows={2}
                  placeholder="Detalhes (opcional)"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                {editing && (
                  <button
                    onClick={deleteEvent}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    Excluir
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => setShowForm(false)}
                  className="text-sm py-2 px-4 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveEvent}
                  className="text-sm py-2 px-4 rounded-lg text-white hover:opacity-90 transition-opacity"
                  style={{ background: '#C5A880' }}
                >
                  {editing ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ===================== WEEK VIEW =====================
function WeekView({
  days, eventsOn, today, onClickEvent, onNewAt,
}: {
  days: Date[]
  eventsOn: (d: Date) => CalEvent[]
  today: Date
  onClickEvent: (ev: CalEvent) => void
  onNewAt: (d: Date, h: number) => void
}) {
  const hours = Array.from({ length: 15 }, (_, i) => i + 7) // 7h - 21h

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
      {/* Header dos dias */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-100">
        <div />
        {days.map(d => {
          const isToday = isSameDay(d, today)
          return (
            <div key={d.toISOString()} className={clsx('py-3 text-center border-l border-slate-100', isToday && 'bg-amber-50/30')}>
              <p className="text-xs uppercase tracking-wider text-slate-400">{format(d, 'EEE', { locale: ptBR })}</p>
              <p className={clsx('text-2xl font-bold mt-0.5', isToday ? 'text-[#C5A880]' : 'text-slate-800')}>
                {format(d, 'd')}
              </p>
            </div>
          )
        })}
      </div>

      {/* All-day row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-100 bg-slate-50/40 min-h-[44px]">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 px-2 py-1.5 text-right pr-3 self-start">dia</div>
        {days.map(d => {
          const allDayEvents = eventsOn(d).filter(e => e.allDay)
          return (
            <div key={d.toISOString()} className="border-l border-slate-100 px-1 py-1.5 space-y-1">
              {allDayEvents.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => onClickEvent(ev)}
                  className={clsx(
                    'w-full text-left text-[11px] px-2 py-1 rounded-md truncate transition-opacity hover:opacity-80 flex items-center gap-1',
                    TYPE_COLORS[ev.type].bg, TYPE_COLORS[ev.type].text
                  )}
                  title={`${TYPE_LABEL[ev.type]}: ${ev.title}`}
                >
                  <span>{TYPE_ICON[ev.type]}</span>
                  <span className="truncate">{ev.title}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>

      {/* Grid de horários */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {hours.map(h => (
            <div key={h} className="contents">
              <div className="text-[11px] text-slate-400 px-2 py-1 text-right pr-3 border-t border-slate-100">
                {String(h).padStart(2, '0')}h
              </div>
              {days.map(d => {
                const slotEvents = eventsOn(d).filter(e => !e.allDay && e.date.getHours() === h)
                const isToday = isSameDay(d, today)
                return (
                  <div
                    key={d.toISOString() + h}
                    className={clsx('border-t border-l border-slate-100 min-h-[48px] p-1 group relative cursor-pointer hover:bg-slate-50', isToday && 'bg-amber-50/20')}
                    onClick={(e) => {
                      // Só dispara se o clique foi no fundo, não num evento
                      if (e.target === e.currentTarget) onNewAt(d, h)
                    }}
                  >
                    {slotEvents.map(ev => (
                      <button
                        key={ev.id}
                        onClick={(e) => { e.stopPropagation(); onClickEvent(ev) }}
                        className={clsx(
                          'w-full text-left text-[11px] px-2 py-1 rounded-md transition-opacity hover:opacity-80 mb-1 border-l-2',
                          TYPE_COLORS[ev.type].bg, TYPE_COLORS[ev.type].text, TYPE_COLORS[ev.type].bar.replace('bg-', 'border-')
                        )}
                      >
                        <p className="font-medium truncate flex items-center gap-1">
                          <span>{TYPE_ICON[ev.type]}</span>
                          <span className="truncate">{format(ev.date, 'HH:mm')} {ev.title}</span>
                        </p>
                        {ev.subtitle && <p className="truncate opacity-75 text-[10px]">{ev.subtitle}</p>}
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ===================== MONTH VIEW =====================
function MonthView({
  days, ref_, eventsOn, today, onClickEvent, onClickDay,
}: {
  days: Date[]
  ref_: Date
  eventsOn: (d: Date) => CalEvent[]
  today: Date
  onClickEvent: (ev: CalEvent) => void
  onClickDay: (d: Date) => void
}) {
  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
      {/* Header dias semana */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
          <div key={d} className="py-2 text-center text-xs uppercase tracking-wider text-slate-400 border-l first:border-l-0 border-slate-100">
            {d}
          </div>
        ))}
      </div>

      {/* Grid de semanas */}
      <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
            {week.map(d => {
              const dayEvents = eventsOn(d).slice(0, 4)
              const more = eventsOn(d).length - dayEvents.length
              const inMonth = isSameMonth(d, ref_)
              const isToday = isSameDay(d, today)
              return (
                <div
                  key={d.toISOString()}
                  onClick={(e) => { if (e.target === e.currentTarget) onClickDay(d) }}
                  className={clsx(
                    'border-l border-slate-100 first:border-l-0 p-2 min-h-[110px] cursor-pointer hover:bg-slate-50/50',
                    !inMonth && 'bg-slate-50/30',
                    isToday && 'bg-amber-50/30'
                  )}
                >
                  <p
                    className={clsx(
                      'text-xs font-semibold mb-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full',
                      isToday ? 'bg-[#C5A880] text-white' : !inMonth ? 'text-slate-300' : 'text-slate-700'
                    )}
                  >
                    {format(d, 'd')}
                  </p>
                  <div className="space-y-0.5">
                    {dayEvents.map(ev => (
                      <button
                        key={ev.id}
                        onClick={(e) => { e.stopPropagation(); onClickEvent(ev) }}
                        className={clsx(
                          'w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-1 hover:opacity-80',
                          TYPE_COLORS[ev.type].bg, TYPE_COLORS[ev.type].text
                        )}
                      >
                        <span className={clsx('w-1 h-1 rounded-full flex-shrink-0', TYPE_COLORS[ev.type].dot)} />
                        {!ev.allDay && <span className="font-semibold">{format(ev.date, 'HH:mm')}</span>}
                        <span className="truncate">{ev.title}</span>
                      </button>
                    ))}
                    {more > 0 && (
                      <p className="text-[10px] text-slate-400 px-1.5">+ {more} {more === 1 ? 'mais' : 'mais'}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
