'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'

// ── Node customizado ──────────────────────────────────────────────
type NodeData = {
  label: string
  color: string
}

const NODE_COLORS = [
  { id: 'slate',  bg: '#1e293b', text: '#f8fafc', border: '#334155' },
  { id: 'gold',   bg: '#92400e', text: '#fef3c7', border: '#C5A880' },
  { id: 'green',  bg: '#14532d', text: '#dcfce7', border: '#16a34a' },
  { id: 'blue',   bg: '#1e3a5f', text: '#dbeafe', border: '#3b82f6' },
  { id: 'purple', bg: '#3b0764', text: '#f3e8ff', border: '#9333ea' },
  { id: 'red',    bg: '#7f1d1d', text: '#fee2e2', border: '#ef4444' },
  { id: 'white',  bg: '#ffffff', text: '#1e293b', border: '#e2e8f0' },
]

function getColor(id: string) {
  return NODE_COLORS.find(c => c.id === id) ?? NODE_COLORS[0]
}

function MindNode({ data, selected }: { data: NodeData; selected: boolean }) {
  const c = getColor(data.color)
  return (
    <div
      style={{
        background: c.bg,
        color: c.text,
        border: `2px solid ${selected ? '#C5A880' : c.border}`,
        borderRadius: 12,
        padding: '10px 16px',
        minWidth: 120,
        maxWidth: 220,
        fontSize: 13,
        fontWeight: 500,
        boxShadow: selected ? '0 0 0 3px rgba(197,168,128,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
        textAlign: 'center',
        lineHeight: 1.4,
        transition: 'box-shadow 0.15s',
        wordBreak: 'break-word',
      }}
    >
      <Handle type="source" position={Position.Left}   style={{ background: c.border, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right}  style={{ background: c.border, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Top}    style={{ background: c.border, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: c.border, width: 8, height: 8 }} />
      {data.label}
    </div>
  )
}

const nodeTypes: NodeTypes = { mind: MindNode }

// ── Painel de edição do nó selecionado ───────────────────────────
function NodePanel({
  node,
  onChange,
  onDelete,
}: {
  node: Node<NodeData>
  onChange: (id: string, data: Partial<NodeData>) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="absolute top-4 right-4 z-10 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 w-64 space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Editar nó</p>
      <textarea
        value={node.data.label}
        onChange={e => onChange(node.id, { label: e.target.value })}
        rows={3}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C5A880] resize-none"
        placeholder="Texto do nó..."
      />
      <div>
        <p className="text-[11px] text-slate-400 mb-1.5">Cor</p>
        <div className="flex flex-wrap gap-2">
          {NODE_COLORS.map(c => (
            <button
              key={c.id}
              title={c.id}
              onClick={() => onChange(node.id, { color: c.id })}
              style={{ background: c.bg, border: `2px solid ${node.data.color === c.id ? '#C5A880' : c.border}` }}
              className="w-7 h-7 rounded-full transition-transform hover:scale-110"
            />
          ))}
        </div>
      </div>
      <button
        onClick={() => onDelete(node.id)}
        className="w-full text-xs py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
      >
        Excluir nó
      </button>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────
interface Estrategia {
  id: string
  titulo: string
  descricao: string | null
  nodes: Node<NodeData>[]
  edges: Edge[]
  visivel_portal: boolean
  cliente_fixo_id: string | null
}

export default function EstrategiaEditor() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [estrategia, setEstrategia] = useState<Estrategia | null>(null)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [visivelPortal, setVisivelPortal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodeIdCounter = useRef(1)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/admin/login')
    })
  }, [router])

  useEffect(() => {
    if (!id) return
    api(`/api/estrategias/${id}`).then(r => r.json()).then((e: Estrategia) => {
      setEstrategia(e)
      setTitulo(e.titulo)
      setDescricao(e.descricao ?? '')
      setVisivelPortal(e.visivel_portal)
      setNodes((e.nodes ?? []) as Node<NodeData>[])
      setEdges(e.edges ?? [])
      if (e.nodes?.length) {
        const ids = e.nodes.map(n => parseInt(n.id.replace('n', '')) || 0)
        nodeIdCounter.current = Math.max(...ids) + 1
      }
    })
  }, [id, setNodes, setEdges])

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      setSaved(false)
    }, 200)
  }, [])

  useEffect(() => { triggerAutoSave() }, [nodes, edges, triggerAutoSave])

  async function save(overrideNodes?: Node<NodeData>[], overrideEdges?: Edge[]) {
    if (!id) return
    setSaving(true)
    await api(`/api/estrategias/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo,
        descricao: descricao || null,
        visivel_portal: visivelPortal,
        nodes: overrideNodes ?? nodes,
        edges: overrideEdges ?? edges,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges(eds =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, color: '#C5A880' },
            style: { stroke: '#C5A880', strokeWidth: 2 },
            animated: false,
          },
          eds
        )
      ),
    [setEdges]
  )

  function addNode() {
    const newId = `n${nodeIdCounter.current++}`
    const newNode: Node<NodeData> = {
      id: newId,
      type: 'mind',
      position: { x: 200 + Math.random() * 200, y: 200 + Math.random() * 100 },
      data: { label: 'Novo nó', color: 'slate' },
    }
    setNodes(nds => [...nds, newNode])
  }

  function updateNodeData(nodeId: string, data: Partial<NodeData>) {
    setNodes(nds =>
      nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)
    )
    if (selectedNode?.id === nodeId) {
      setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, ...data } } : null)
    }
  }

  function deleteNode(nodeId: string) {
    setNodes(nds => nds.filter(n => n.id !== nodeId))
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId))
    setSelectedNode(null)
  }

  function onNodeClick(_: React.MouseEvent, node: Node) {
    setSelectedNode(node as Node<NodeData>)
  }

  function onPaneClick() {
    setSelectedNode(null)
  }

  if (!estrategia) {
    return (
      <div className="min-h-screen bg-[#0d0c0b] flex items-center justify-center">
        <p className="text-white/40 text-sm">Carregando estratégia...</p>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#0f0e0c] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#1a1814] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (estrategia.cliente_fixo_id) {
                router.push(`/admin/cliente/${estrategia.cliente_fixo_id}`)
              } else {
                router.push('/admin/clientes')
              }
            }}
            className="text-white/40 hover:text-white/80 transition-colors text-sm"
          >
            ‹ Voltar
          </button>
          <div className="w-px h-4 bg-white/10" />
          <input
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            onBlur={() => save()}
            className="bg-transparent text-white font-semibold text-base focus:outline-none placeholder:text-white/30 min-w-0 w-64"
            placeholder="Nome da estratégia..."
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Visível no portal */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-white/50">Portal</span>
            <div
              onClick={() => {
                const novo = !visivelPortal
                setVisivelPortal(novo)
              }}
              className={`w-9 h-5 rounded-full transition-colors relative ${visivelPortal ? 'bg-[#C5A880]' : 'bg-white/20'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow ${visivelPortal ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </label>

          {/* Adicionar nó */}
          <button
            onClick={addNode}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            + Nó
          </button>

          {/* Salvar */}
          <button
            onClick={() => save()}
            disabled={saving}
            className="text-xs px-4 py-1.5 rounded-lg text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ background: '#C5A880' }}
          >
            {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Descrição */}
      <div className="px-4 py-2 border-b border-white/5 bg-[#1a1814] flex-shrink-0">
        <input
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          onBlur={() => save()}
          placeholder="Descrição ou contexto da estratégia (opcional)..."
          className="w-full bg-transparent text-white/50 text-xs focus:outline-none placeholder:text-white/20 focus:text-white/80"
        />
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          defaultEdgeOptions={{
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, color: '#C5A880' },
            style: { stroke: '#C5A880', strokeWidth: 2 },
          }}
          style={{ background: '#0f0e0c' }}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={['Backspace', 'Delete']}
        >
          <Background color="#2a2520" gap={24} size={1} />
          <Controls style={{ background: '#1a1814', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
          <MiniMap
            style={{ background: '#1a1814', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            nodeColor={(n) => {
              const c = getColor((n.data as NodeData)?.color ?? 'slate')
              return c.bg
            }}
          />
        </ReactFlow>

        {/* Painel lateral do nó selecionado */}
        {selectedNode && (
          <NodePanel
            node={selectedNode}
            onChange={updateNodeData}
            onDelete={deleteNode}
          />
        )}

        {/* Hint quando vazio */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-white/20 text-sm">Clique em "+ Nó" para começar</p>
              <p className="text-white/10 text-xs mt-1">Conecte os nós arrastando de uma alça para outra</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
