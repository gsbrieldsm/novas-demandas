# Guia de Setup — Chamados IA

## O que você vai precisar (tudo gratuito)

| Serviço | Para quê | Link |
|---------|----------|------|
| Node.js | Rodar o projeto | nodejs.org/pt-br |
| Supabase | Banco de dados | supabase.com |
| Anthropic | IA (Claude) | console.anthropic.com |
| Vercel | Hospedagem | vercel.com |
| GitHub | Código na nuvem | github.com |

---

## Passo 1 — Instalar Node.js

1. Acesse **nodejs.org/pt-br**
2. Baixe a versão **LTS** (recomendada)
3. Instale normalmente
4. Abra o Terminal e confirme: `node --version`

---

## Passo 2 — Instalar dependências do projeto

No Terminal, navegue até a pasta do projeto:

```bash
cd ~/chamados-ia
npm install
```

---

## Passo 3 — Criar projeto no Supabase

1. Acesse **supabase.com** e crie uma conta
2. Clique em **New Project**
3. Defina nome, senha e região (escolha São Paulo se disponível)
4. Aguarde criar (2–3 minutos)
5. Vá em **Settings > API** e copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon / public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### Criar o banco de dados

1. No Supabase, vá em **SQL Editor**
2. Clique em **New query**
3. Cole todo o conteúdo do arquivo `supabase/schema.sql`
4. Clique em **Run**

### Criar sua conta de admin

1. No Supabase, vá em **Authentication > Users**
2. Clique em **Add user > Create new user**
3. Coloque seu e-mail e uma senha forte
4. Esse é o login do seu painel `/admin`

---

## Passo 4 — Obter chave da API da Anthropic

1. Acesse **console.anthropic.com**
2. Crie uma conta (você ganha créditos grátis para testar)
3. Vá em **API Keys > Create Key**
4. Copie a chave → `ANTHROPIC_API_KEY`

---

## Passo 5 — Configurar variáveis de ambiente

1. Na pasta `chamados-ia`, copie o arquivo de exemplo:
   ```bash
   cp .env.local.example .env.local
   ```
2. Abra `.env.local` em qualquer editor de texto
3. Preencha todas as variáveis com os valores dos passos acima
4. Coloque seu nome em `NEXT_PUBLIC_PROFESSIONAL_NAME`

---

## Passo 6 — Testar localmente

```bash
npm run dev
```

Abra no navegador:
- **Portal do cliente**: http://localhost:3000/chat
- **Painel admin**: http://localhost:3000/admin

---

## Passo 7 — Colocar no ar (Vercel + GitHub)

### 7.1 — Subir para o GitHub

1. Crie uma conta em **github.com**
2. Crie um novo repositório (privado)
3. Na pasta do projeto, rode:
   ```bash
   git init
   git add .
   git commit -m "primeiro commit"
   git remote add origin https://github.com/SEU_USUARIO/chamados-ia.git
   git push -u origin main
   ```

### 7.2 — Deploy no Vercel

1. Acesse **vercel.com** e faça login com o GitHub
2. Clique em **Add New > Project**
3. Selecione o repositório `chamados-ia`
4. Em **Environment Variables**, adicione todas as variáveis do `.env.local`
5. Clique em **Deploy**

Pronto! O sistema estará disponível em:
- `https://seu-projeto.vercel.app/chat` → link para os clientes
- `https://seu-projeto.vercel.app/admin` → seu painel

---

## Como usar no dia a dia

1. **Envie o link do chat** para o cliente: `seudominio.vercel.app/chat`
2. A IA conduz a conversa estratégica com o cliente
3. Você recebe o chamado no painel `/admin` com o briefing completo
4. **Arraste o card** entre colunas para atualizar o status
5. O cliente pode acompanhar em `/acompanhar/[id]`

---

## Personalizar a IA

Para ajustar as perguntas e o comportamento da IA, edite o arquivo:
```
src/lib/system-prompt.ts
```

Altere o texto do `SYSTEM_PROMPT` para refletir ainda mais sua metodologia.
Depois rode `npm run dev` para ver as mudanças.

---

## Dúvidas frequentes

**A IA está falando coisas erradas?**
Edite `src/lib/system-prompt.ts` e ajuste o prompt.

**Quero adicionar um novo tipo de pedido?**
Edite `src/types/index.ts` e adicione ao enum `RequestType`.

**Como adicionar domínio próprio?**
No Vercel, vá em Settings > Domains e adicione seu domínio.
