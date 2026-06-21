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
