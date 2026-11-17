'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import type { Acesso } from '@/lib/acesso'

// Um pedido por login: o menu, o bloqueio das telas e as telas que escondem
// valores compartilham a mesma resposta de /api/equipe/me.
let cache: { token: string; pedido: Promise<Acesso | null> } | null = null

async function carregar(): Promise<Acesso | null> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return null
  if (cache?.token !== token) {
    cache = {
      token,
      pedido: api('/api/equipe/me')
        .then(r => (r.ok ? (r.json() as Promise<Acesso>) : null))
        .catch(() => null),
    }
  }
  return cache.pedido
}

/** undefined = carregando · null = sem acesso ao painel */
export function useAcesso() {
  const [acesso, setAcesso] = useState<Acesso | null | undefined>(undefined)
  useEffect(() => {
    let vivo = true
    carregar().then(a => vivo && setAcesso(a))
    const { data } = supabase.auth.onAuthStateChange(() => {
      carregar().then(a => vivo && setAcesso(a))
    })
    return () => {
      vivo = false
      data.subscription.unsubscribe()
    }
  }, [])
  return acesso
}
