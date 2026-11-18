-- Extensão para UUID
create extension if not exists "uuid-ossp";

-- Tabela principal de chamados
create table public.tickets (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Informações do cliente
  client_name text not null,
  client_email text,
  company text,

  -- O pedido
  request_type text not null default 'outro',
  title text not null,
  description text,

  -- 5W (cliente responde)
  where_used text,
  deadline date,
  purpose text,
  expected_result text,

  -- Controle (admin)
  status text not null default 'novo',
  priority text not null default 'normal',
  admin_notes text,

  -- Histórico da conversa
  chat_transcript jsonb default '[]'::jsonb,

  -- Constraints
  constraint tickets_request_type_check check (request_type in ('gravacao', 'conteudo', 'arte', 'edicao', 'outro')),
  constraint tickets_status_check check (status in ('novo', 'em_andamento', 'em_revisao', 'concluido', 'cancelado')),
  constraint tickets_priority_check check (priority in ('normal', 'alta', 'urgente'))
);

-- Atualiza updated_at automaticamente
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger update_tickets_updated_at
  before update on public.tickets
  for each row execute procedure public.update_updated_at_column();

-- Row Level Security
alter table public.tickets enable row level security;

-- Qualquer pessoa pode criar um ticket (formulário público)
create policy "Público pode criar tickets"
  on public.tickets for insert
  with check (true);

-- Qualquer pessoa pode ler o próprio ticket por ID (para acompanhamento)
create policy "Público pode ler tickets por ID"
  on public.tickets for select
  using (true);

-- Índices para performance
create index tickets_status_idx on public.tickets(status);
create index tickets_created_at_idx on public.tickets(created_at desc);
create index tickets_client_email_idx on public.tickets(client_email);

-- Migração: dados fiscais para emissão de NF/boleto (tabela propostas)
-- A tabela propostas já existe no banco mas não está versionada neste arquivo.
alter table public.propostas
  add column if not exists dados_fiscais_status text not null default 'pendente',
  add column if not exists cliente_cnpj text,
  add column if not exists cliente_razao_social text,
  add column if not exists cliente_telefone text,
  add column if not exists dados_fiscais_em timestamp with time zone;

-- Migração: dados fiscais para emissão de recibo (tabela clientes_fixos)
alter table public.clientes_fixos
  add column if not exists cnpj text,
  add column if not exists razao_social text,
  add column if not exists telefone text;

-- Migração: programa de parceiros / indicadores
create table if not exists public.parceiros (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  nome text not null,
  email text not null,
  whatsapp text not null,
  cidade text,
  como text,
  status text not null default 'novo',
  observacoes_internas text,
  constraint parceiros_status_check check (status in ('novo', 'aprovado', 'ativo', 'inativo', 'rejeitado'))
);

create trigger update_parceiros_updated_at
  before update on public.parceiros
  for each row execute procedure public.update_updated_at_column();

alter table public.parceiros enable row level security;

create policy "Público pode se cadastrar como parceiro"
  on public.parceiros for insert
  with check (true);

create index parceiros_status_idx on public.parceiros(status);
create index parceiros_created_at_idx on public.parceiros(created_at desc);

-- Migração: despesas recorrentes
alter table public.despesas
  add column if not exists recorrente boolean not null default false,
  add column if not exists recorrencia_meses integer,
  add column if not exists recorrencia_grupo_id uuid;

create index if not exists despesas_recorrencia_grupo_idx on public.despesas(recorrencia_grupo_id);

-- Migração: distinguir cliente de serviço vs outras receitas recorrentes (comissão, aluguel, etc.)
alter table public.clientes_fixos
  add column if not exists tipo text not null default 'cliente';

alter table public.clientes_fixos
  add constraint clientes_fixos_tipo_check check (tipo in ('cliente', 'outras_receitas'));

-- Migração: Portal do Cliente (login próprio, logo, sucesso do cliente)
alter table public.clientes_fixos
  add column if not exists portal_email text,
  add column if not exists portal_senha_hash text,
  add column if not exists portal_ativo boolean not null default false,
  add column if not exists logo_url text;

create unique index if not exists clientes_fixos_portal_email_idx on public.clientes_fixos(portal_email) where portal_email is not null;

-- Migração: visibilidade de demandas no portal do cliente
alter table public.tickets
  add column if not exists visivel_portal boolean not null default true;

-- Migração: documentos vivos do portal (Plano de Marketing e afins, em blocos editáveis)
create table if not exists public.documentos_cliente (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  cliente_fixo_id uuid not null references public.clientes_fixos(id) on delete cascade,
  titulo text not null,
  blocos jsonb not null default '[]'::jsonb,
  visivel_portal boolean not null default true
);

create trigger update_documentos_cliente_updated_at
  before update on public.documentos_cliente
  for each row execute procedure public.update_updated_at_column();

create index if not exists documentos_cliente_cliente_fixo_idx on public.documentos_cliente(cliente_fixo_id);

-- Fix: documentos_cliente foi criada com RLS habilitado por padrão (sem políticas),
-- o que bloqueava o acesso até do usuário autenticado (Gabriel). Desabilitando,
-- consistente com o padrão das demais tabelas do projeto (a proteção é via
-- requireAuth na API, não via RLS).
alter table public.documentos_cliente disable row level security;

-- Migração: cliente pode complementar a demanda com uma nota própria, pelo portal
alter table public.tickets
  add column if not exists nota_cliente text,
  add column if not exists nota_cliente_em timestamp with time zone;

-- Migração: estratégias (mapas mentais / fluxos por cliente)
create table if not exists public.estrategias (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  cliente_fixo_id uuid references public.clientes_fixos(id) on delete cascade,
  titulo text not null default 'Nova Estratégia',
  descricao text,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  visivel_portal boolean not null default false
);

create trigger update_estrategias_updated_at
  before update on public.estrategias
  for each row execute procedure public.update_updated_at_column();

create index if not exists estrategias_cliente_idx on public.estrategias(cliente_fixo_id);

alter table public.estrategias disable row level security;

-- Migração: receitas avulsas (entradas pontuais que não são serviço prestado)
create table if not exists public.receitas_avulsas (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  descricao text not null,
  valor numeric not null,
  mes integer not null,
  ano integer not null,
  recebido boolean not null default false,
  recebido_em timestamp with time zone
);

create trigger update_receitas_avulsas_updated_at
  before update on public.receitas_avulsas
  for each row execute procedure public.update_updated_at_column();

create index if not exists receitas_avulsas_mes_ano_idx on public.receitas_avulsas(mes, ano);

-- Fix: "estrategia" já era uma opção válida no app (RequestType, REQUEST_TYPE_LABELS,
-- system-prompt) mas a constraint do banco nunca foi atualizada — bloqueava a criação
-- de qualquer demanda do tipo Estratégia.
alter table public.tickets drop constraint if exists tickets_request_type_check;
alter table public.tickets
  add constraint tickets_request_type_check
  check (request_type in ('estrategia', 'gravacao', 'conteudo', 'arte', 'edicao', 'outro'));

-- Migração: estúdio de social media (pautas, roteiros e planos de marketing por cliente)
create table if not exists public.social_conteudos (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  cliente_fixo_id uuid not null references public.clientes_fixos(id) on delete cascade,
  tipo text not null check (tipo in ('pauta', 'roteiro', 'plano')),
  titulo text not null,
  briefing text,
  conteudo jsonb not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovado')),
  -- [{ chave, ticket_id }] — o que já virou demanda
  demandas jsonb not null default '[]'::jsonb
);

drop trigger if exists update_social_conteudos_updated_at on public.social_conteudos;
create trigger update_social_conteudos_updated_at
  before update on public.social_conteudos
  for each row execute procedure public.update_updated_at_column();

create index if not exists social_conteudos_cliente_idx on public.social_conteudos(cliente_fixo_id);

-- Só usuários autenticados (o admin) leem e escrevem; a chave pública não tem acesso.
alter table public.social_conteudos enable row level security;

drop policy if exists "Autenticados gerenciam social_conteudos" on public.social_conteudos;
create policy "Autenticados gerenciam social_conteudos"
  on public.social_conteudos for all
  to authenticated
  using (true)
  with check (true);

-- ─── Tráfego pago ────────────────────────────────────────────────────────────
-- Uma conta de anúncios do Meta por cliente, o plano de ação e o link público
-- que o cliente usa para acompanhar as métricas.
create table if not exists public.trafego_contas (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  cliente_fixo_id uuid not null unique references public.clientes_fixos(id) on delete cascade,
  -- ex.: act_611355219446795
  meta_ad_account_id text not null,
  -- segredo do link público (/trafego/<link_token>)
  link_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  link_ativo boolean not null default true,
  -- recado da agência mostrado no topo da página do cliente
  recado text,
  -- [{ id, titulo, descricao, prazo, status: proposto|aprovado|em_andamento|concluido }]
  plano jsonb not null default '[]'::jsonb
);

drop trigger if exists update_trafego_contas_updated_at on public.trafego_contas;
create trigger update_trafego_contas_updated_at
  before update on public.trafego_contas
  for each row execute procedure public.update_updated_at_column();

-- Só o admin lê e escreve; a página pública lê pelo servidor com a service role.
alter table public.trafego_contas enable row level security;

drop policy if exists "Autenticados gerenciam trafego_contas" on public.trafego_contas;
create policy "Autenticados gerenciam trafego_contas"
  on public.trafego_contas for all
  to authenticated
  using (true)
  with check (true);

-- ─── Instagram do cliente ────────────────────────────────────────────────────
-- ID da conta comercial do Instagram (Graph API) ligada ao cliente.
alter table public.clientes_fixos add column if not exists instagram_user_id text;

-- ─── Agentes: reuniões entre a IA de tráfego e a IA de social media ─────────
create table if not exists public.agentes_reunioes (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  cliente_fixo_id uuid not null references public.clientes_fixos(id) on delete cascade,
  -- pauta opcional dada pela agência antes da reunião
  foco text,
  -- [{ agente: 'trafego' | 'social', texto }]
  mensagens jsonb not null default '[]'::jsonb,
  -- { cenario, falta[], precisa[], melhorar[], acoes_trafego[], pautas_social[], briefing_social }
  resumo jsonb,
  -- o que já foi enviado: { plano_trafego: bool, estudio: bool }
  enviados jsonb not null default '{}'::jsonb
);

create index if not exists agentes_reunioes_cliente_idx on public.agentes_reunioes(cliente_fixo_id, created_at desc);

alter table public.agentes_reunioes enable row level security;

drop policy if exists "Autenticados gerenciam agentes_reunioes" on public.agentes_reunioes;
create policy "Autenticados gerenciam agentes_reunioes"
  on public.agentes_reunioes for all
  to authenticated
  using (true)
  with check (true);

-- ─── Equipes e acessos ──────────────────────────────────────────────────────
-- Quem pode entrar no painel e quais módulos vê. Dono vê tudo e gerencia a
-- equipe; membro vê só os módulos de `permissoes`. Login sem linha aqui não
-- entra no painel.
create table if not exists public.equipe_membros (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  nome text not null,
  email text not null,
  cargo text,
  papel text not null default 'membro' check (papel in ('dono', 'membro')),
  -- gestao, demandas, agenda, clientes, social, trafego, agentes, comercial, financeiro
  permissoes text[] not null default '{}',
  ativo boolean not null default true
);

drop trigger if exists update_equipe_membros_updated_at on public.equipe_membros;
create trigger update_equipe_membros_updated_at
  before update on public.equipe_membros
  for each row execute procedure public.update_updated_at_column();

-- Só o servidor (service role) lê e escreve a equipe.
alter table public.equipe_membros enable row level security;

create or replace function public.eh_dono()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.equipe_membros
    where user_id = auth.uid() and papel = 'dono' and ativo
  );
$$;

-- Primeiro dono: troque o e-mail pelo do login do dono antes de rodar.
insert into public.equipe_membros (user_id, nome, email, papel)
select id, coalesce(raw_user_meta_data->>'name', split_part(email, '@', 1)), email, 'dono'
from auth.users
where email = 'EMAIL_DO_DONO'
on conflict (user_id) do update set papel = 'dono', ativo = true;

-- Trava o acesso direto ao banco: todo o painel passa pelas rotas do
-- servidor, que conferem a permissão de cada membro. Pelo acesso direto
-- (chave pública + login), só o dono lê e escreve; visitantes não leem nada.
do $$
declare
  t record;
  p record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> 'equipe_membros'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t.tablename loop
      execute format('drop policy %I on public.%I', p.policyname, t.tablename);
    end loop;
    execute format(
      'create policy "Dono acessa direto" on public.%I for all to authenticated using (public.eh_dono()) with check (public.eh_dono())',
      t.tablename
    );
  end loop;
end $$;

-- Migração: metas de tráfego por cliente (CPA, ROAS, custo por conversa, verba mensal)
alter table public.trafego_contas
  add column if not exists metas jsonb not null default '{}'::jsonb;
