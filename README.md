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

## Próximos passos óbvios

- Trocar armazenamento em memória por Postgres/Supabase (mesma interface do
  `store.js`, só trocar a implementação).
- Autenticação (API key por cliente/instituição).
- Idade mínima 18+ na camada de registo (fora desta API, no onboarding).
- Painel de moderação humana para casos sinalizados como `attention`/`crisis`.
