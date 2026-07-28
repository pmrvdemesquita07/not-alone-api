// Not Alone Core — armazenamento em memória (protótipo).
// Em produção, trocar por Postgres/Supabase mantendo a mesma interface.

const checkins = []; // { id, user_id, date, state, note, is_crisis_flag, created_at }
let nextId = 1;

// Estados possíveis — o utilizador escolhe sempre um destes.
// "difficult" marca estados que contam para o cálculo de isolamento.
const STATES = {
  dia_dificil: { label: 'Hoje custou-me sair da cama', difficult: true },
  treino_cancelado_cabeca: { label: 'Treino cancelado, cabeça não ajudou', difficult: true },
  lesionado_sozinho: { label: 'Lesionado e sozinho no ginásio', difficult: true },
  parte_de_algo: { label: 'Voltei a sentir-me parte de algo', difficult: false },
  dia_normal: { label: 'Dia normal, sem grande história', difficult: false },
  nao_consigo_hoje: { label: 'Hoje não consigo, nem isto', difficult: true },
};

// Recursos de crise — Portugal. Nunca inferidos por texto: só entram em jogo
// quando o próprio utilizador marca is_crisis_flag=true, ou por regra explícita
// (ex: 3+ estados "difficult" nos últimos 5 dias -> nível "attention", não "crisis").
const CRISIS_RESOURCES_PT = [
  { name: 'Emergência', contact: '112', note: 'Perigo de vida imediato' },
  {
    name: 'SNS 24 — Linha de Apoio Psicológico',
    contact: '808 24 24 24 (opção 4)',
    note: '24h/dia, 7 dias por semana',
  },
  {
    name: 'SOS Voz Amiga',
    contact: '213 544 545 / 912 802 669 / 963 524 660',
    note: 'Diariamente das 15:30 às 00:30',
  },
];

function addCheckin({ user_id, state, note, is_crisis_flag }) {
  if (!STATES[state]) throw new Error(`Estado inválido: ${state}`);
  const entry = {
    id: nextId++,
    user_id,
    state,
    note: note || null,
    is_crisis_flag: !!is_crisis_flag,
    created_at: new Date().toISOString(),
    date: new Date().toISOString().slice(0, 10),
  };
  checkins.push(entry);
  return entry;
}

function getTodayCircle(user_id, state, limit = 5) {
  const today = new Date().toISOString().slice(0, 10);
  return checkins
    .filter((c) => c.date === today && c.state === state && c.user_id !== user_id)
    .slice(-limit)
    .map((c) => ({ alias: `user_${c.user_id}`, state: c.state, note: c.note }));
}

// Regra de isolamento: puramente baseada em campos estruturados (nunca em NLP
// sobre texto livre). Olha para os últimos N check-ins do utilizador.
function getIsolationSignal(user_id, lookback = 5) {
  const userCheckins = checkins
    .filter((c) => c.user_id === user_id)
    .slice(-lookback);

  const difficultCount = userCheckins.filter((c) => STATES[c.state]?.difficult).length;
  const hasCrisisFlag = userCheckins.some((c) => c.is_crisis_flag);

  let level = 'normal';
  if (hasCrisisFlag) level = 'crisis';
  else if (difficultCount >= 3) level = 'attention';

  return {
    level,
    difficult_count: difficultCount,
    lookback_checkins: userCheckins.length,
  };
}

module.exports = {
  STATES,
  CRISIS_RESOURCES_PT,
  addCheckin,
  getTodayCircle,
  getIsolationSignal,
};
