# Not Alone Core API — protótipo v1

Motor por trás da rede social "Not Alone": check-in diário, emparelhamento por
estado ("circle"), deteção de isolamento e escalada de crise.

## Correr localmente

```bash
npm install
node src/server.js
```

Fica a correr em `http://localhost:3000`.

## Endpoints

### `GET /v1/states`
Lista os estados possíveis para o ecrã de check-in.

### `POST /v1/checkin`
```json
{ "user_id": "42", "state": "treino_cancelado_cabeca", "note": "opcional" }
```
Regista o check-in e devolve, na mesma resposta: o check-in criado, o nível
de isolamento atual, e o "circle" de hoje (outras pessoas no mesmo estado).

### `GET /v1/circle/:user_id?state=...`
Devolve até 5 pessoas anonimizadas (`alias`) que hoje marcaram o mesmo estado.

### `GET /v1/isolation-signal/:user_id`
Devolve `level`: `normal` | `attention` | `crisis`, calculado só a partir de
campos estruturados dos últimos 5 check-ins — nunca por análise de texto livre.
- `attention`: 3+ estados marcados como "difficult" nos últimos 5 check-ins.
- `crisis`: o próprio utilizador marcou `is_crisis_flag: true` nalgum check-in.

### `POST /v1/escalate`
```json
{ "user_id": "42", "country": "PT" }
```
Devolve as linhas de apoio reais (Portugal, verificadas em julho 2026: SNS 24,
SOS Voz Amiga, 112). Disparado por ação explícita do utilizador — nunca
automático a partir de texto.

### Perfis

- `POST /v1/users` — `{ user_id, username }`, cria/atualiza o perfil.
- `GET /v1/users/:user_id` — perfil público (404 se não existir).
- `POST /v1/users/:user_id/photo` — `{ photo: "data:image/...;base64,..." }`,
  define a foto de perfil. Limite ~1.5MB, só aceita `data:image/`.

### Descoberta e amizades

- `GET /v1/discover/:user_id` — até 10 sugestões de pessoas com estados em
  comum recentemente, ordenadas por nº de estados partilhados. Nunca inclui
  amigos já aceites nem check-ins marcados `is_crisis_flag` (ver decisão 4).
- `POST /v1/friend-requests` — `{ from_user_id, to_user_id }`, cria pedido
  pendente e notifica o destinatário.
- `POST /v1/friend-requests/:id/respond` — `{ user_id, action: "accept" | "decline" }`,
  só o destinatário pode responder.
- `GET /v1/friend-requests/:user_id` — `{ incoming, outgoing }` pendentes.
- `GET /v1/friends/:user_id` — lista de `user_id` dos amigos aceites.

### Mensagens

- `POST /v1/messages` — `{ from_user_id, to_user_id, text }`. Devolve **403**
  se os dois utilizadores não forem amigos aceites (ver decisão 5).
- `GET /v1/messages/:user_id/:other_id` — últimas 50 mensagens da conversa.

### Notificações

- `GET /v1/notifications/:user_id` — mais recentes primeiro. Gera-se uma
  notificação automaticamente ao receber um pedido de amizade, ao ser aceite,
  ou ao receber uma mensagem.
- `POST /v1/notifications/:id/read` — `{ user_id }`, marca como lida.

## Decisões de segurança importantes (não mudar sem pensar bem)

1. **Nunca inferir crise a partir de texto livre.** A app não faz análise de
   sentimento a "notes". A única forma de chegar a `level: "crisis"` é o
   próprio utilizador marcar isso explicitamente, ou o padrão estrutural de
   `is_crisis_flag`.
2. **O "circle" nunca é a rede de segurança para crise.** Serve para isolamento
   do dia a dia. Crise real vai sempre para `/escalate`, nunca depende de outros
   utilizadores responderem a tempo.
3. **`CRISIS_RESOURCES_PT` tem de ser revisto periodicamente** — números de
   linhas de apoio mudam. Não hardcodar para sempre sem verificar.
4. **`/discover` nunca inclui check-ins de crise.** Um `is_crisis_flag: true`
   nunca entra na lógica de sugestão social — a mesma pessoa que acabou de
   sinalizar crise não pode ficar mais exposta a pedidos de amizade de
   estranhos por causa disso.
5. **Mensagens só entre amigos aceites, nunca DM aberto.** Alguém encontrado
   no `/circle` ou no `/discover` não pode mandar mensagem sem um pedido de
   amizade aceite primeiro — protege quem acabou de marcar um estado difícil
   de ser contactável por estranhos.

## Próximos passos óbvios

- Trocar armazenamento em memória por Postgres/Supabase (mesma interface do
  `store.js`, só trocar a implementação) — inclui as fotos de perfil, que
  neste protótipo vivem em memória como base64 e não devem ir assim para
  produção (usar object storage real).
- Autenticação (API key por cliente/instituição).
- Idade mínima 18+ na camada de registo (fora desta API, no onboarding).
- Painel de moderação humana para casos sinalizados como `attention`/`crisis`,
  e para denúncias de mensagens/pedidos de amizade abusivos.
