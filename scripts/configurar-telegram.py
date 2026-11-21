#!/usr/bin/env python3
"""Liga o Assistente GM&Co ao Telegram sem expor nenhum segredo na tela.

Uso:
  1) Crie o bot no @BotFather e COPIE o token (não cole em lugar nenhum).
  2) python3 scripts/configurar-telegram.py            → salva token, descobre seu chat, testa
  3) python3 scripts/configurar-telegram.py --vercel   → copia cada variável para colar na Vercel
  4) Depois do deploy: python3 scripts/configurar-telegram.py --webhook
"""
import json, os, re, secrets, subprocess, sys, time, urllib.parse, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(RAIZ, '.env.local')
WEBHOOK = 'https://www.gmeco.com.br/api/assistente/telegram'
VARS = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'TELEGRAM_WEBHOOK_SECRET', 'CRON_SECRET']


def ler_env():
    out = {}
    if os.path.exists(ENV):
        for linha in open(ENV, encoding='utf-8'):
            m = re.match(r'^([A-Z0-9_]+)=(.*)$', linha.strip())
            if m:
                out[m.group(1)] = m.group(2).strip().strip('"')
    return out


def gravar_env(chave, valor):
    linhas = open(ENV, encoding='utf-8').read().splitlines() if os.path.exists(ENV) else []
    linhas = [l for l in linhas if not l.startswith(f'{chave}=')]
    linhas.append(f'{chave}={valor}')
    open(ENV, 'w', encoding='utf-8').write('\n'.join(linhas) + '\n')


def clip_ler():
    return subprocess.run(['pbpaste'], capture_output=True, text=True).stdout.strip()


def clip_set(txt):
    subprocess.run(['pbcopy'], input=txt, text=True)


def tg(token, metodo, **params):
    url = f'https://api.telegram.org/bot{token}/{metodo}'
    dados = urllib.parse.urlencode(params).encode() if params else None
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=dados), timeout=40) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return json.load(e)


def configurar():
    token = clip_ler()
    if not re.fullmatch(r'\d{6,12}:[A-Za-z0-9_-]{30,}', token):
        sys.exit('✗ A área de transferência não tem um token do BotFather. Copie o token e rode de novo.')
    clip_set('')  # limpa o token da área de transferência
    me = tg(token, 'getMe')
    if not me.get('ok'):
        sys.exit('✗ O Telegram recusou esse token. Gere outro no @BotFather (/token).')
    bot = me['result']['username']
    gravar_env('TELEGRAM_BOT_TOKEN', token)
    env = ler_env()
    for chave in ('TELEGRAM_WEBHOOK_SECRET', 'CRON_SECRET'):
        if not env.get(chave):
            gravar_env(chave, secrets.token_hex(24))
    print(f'✓ Bot @{bot} conectado e token salvo no .env.local')

    tg(token, 'deleteWebhook')  # para conseguir ler a primeira mensagem
    print(f'\n→ Abra https://t.me/{bot} no Telegram e toque em INICIAR (ou mande /start).')
    print('  Esperando sua mensagem (até 3 minutos)…')
    fim = time.time() + 180
    while time.time() < fim:
        r = tg(token, 'getUpdates', timeout=25)
        for u in r.get('result', []):
            chat = (u.get('message') or {}).get('chat') or {}
            if chat.get('type') == 'private':
                gravar_env('TELEGRAM_CHAT_ID', str(chat['id']))
                tg(token, 'sendMessage', chat_id=chat['id'], text='✅ Conectado! Sou o seu assistente da GM&Co. Amanhã às 7h30 chega o primeiro plano do dia.')
                print(f"✓ Conversa encontrada ({chat.get('first_name', '')}). Mandei uma mensagem de teste.")
                print('\nPróximo passo: python3 scripts/configurar-telegram.py --vercel')
                return
    sys.exit('✗ Não chegou mensagem. Rode de novo e mande /start para o bot.')


def vercel():
    env = ler_env()
    faltam = [v for v in VARS if not env.get(v)]
    if faltam:
        sys.exit(f'✗ Faltam no .env.local: {", ".join(faltam)}. Rode primeiro sem --vercel.')
    print('Na Vercel: projeto → Settings → Environment Variables → Add (Production).')
    print('Para cada uma, eu copio o valor; você cola na Vercel e aperta Enter aqui.\n')
    for v in VARS:
        clip_set(env[v])
        input(f'  📋 {v} copiado. Cole o NOME "{v}" e o valor (Cmd+V) na Vercel, salve e aperte Enter…')
    clip_set('')
    print('\n✓ Pronto. Faça o redeploy na Vercel e depois: python3 scripts/configurar-telegram.py --webhook')


def webhook():
    env = ler_env()
    r = tg(env['TELEGRAM_BOT_TOKEN'], 'setWebhook', url=WEBHOOK, secret_token=env['TELEGRAM_WEBHOOK_SECRET'],
           allowed_updates='["message"]', drop_pending_updates='true')
    print('✓ Webhook ligado: os comandos /hoje /amanha /contas já respondem.' if r.get('ok') else f"✗ {r.get('description')}")
    tg(env['TELEGRAM_BOT_TOKEN'], 'setMyCommands', commands=json.dumps([
        {'command': 'hoje', 'description': 'O plano do dia'},
        {'command': 'amanha', 'description': 'O que vem amanhã'},
        {'command': 'contas', 'description': 'Contas a pagar do mês'},
    ]))


if __name__ == '__main__':
    {'--vercel': vercel, '--webhook': webhook}.get(sys.argv[1] if len(sys.argv) > 1 else '', configurar)()
