// Not Alone Core — armazenamento em memória (protótipo).
// Em produção, trocar por Postgres/Supabase mantendo a mesma interface.

const checkins = []; // { id, user_id, date, state, note, is_crisis_flag, created_at }
const users = new Map(); // user_id -> { user_id, username, avatar, created_at }
const friendRequests = []; // { id, from_user_id, to_user_id, status, created_at, responded_at }
const messages = []; // { id, from_user_id, to_user_id, text, created_at }
const notifications = []; // { id, user_id, type, payload, read, created_at }
let nextId = 1;
let nextFriendRequestId = 1;
let nextMessageId = 1;
let nextNotificationId = 1;

const MAX_AVATAR_LENGTH = 2_000_000; // ~1.5MB de imagem em base64 — limite generoso para protótipo

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

// -- perfis -----------------------------------------------------------------

function toPublicUser(user) {
  if (!user) return null;
  return { user_id: user.user_id, username: user.username, avatar: user.avatar };
}

function upsertUser({ user_id, username }) {
  const existing = users.get(user_id);
  const user = {
    user_id,
    username: username || existing?.username || `user_${user_id}`,
    avatar: existing?.avatar || null,
    created_at: existing?.created_at || new Date().toISOString(),
  };
  users.set(user_id, user);
  return toPublicUser(user);
}

function getUser(user_id) {
  return toPublicUser(users.get(user_id));
}

function setAvatar(user_id, avatarDataUri) {
  if (typeof avatarDataUri !== 'string' || !avatarDataUri.startsWith('data:image/')) {
    throw new Error('avatar tem de ser uma data URI de imagem (data:image/...)');
  }
  if (avatarDataUri.length > MAX_AVATAR_LENGTH) {
    throw new Error('imagem demasiado grande (limite ~1.5MB)');
  }
  const user = users.get(user_id) || upsertUser({ user_id });
  const stored = users.get(user_id) || user;
  stored.avatar = avatarDataUri;
  users.set(user_id, stored);
  return toPublicUser(stored);
}

// -- amigos -------------------------------------------------------------

function areFriends(userA, userB) {
  return friendRequests.some(
    (r) =>
      r.status === 'accepted' &&
      ((r.from_user_id === userA && r.to_user_id === userB) ||
        (r.from_user_id === userB && r.to_user_id === userA))
  );
}

function findPendingRequest(from_user_id, to_user_id) {
  return friendRequests.find(
    (r) => r.status === 'pending' && r.from_user_id === from_user_id && r.to_user_id === to_user_id
  );
}

function addNotification(user_id, type, payload) {
  const n = {
    id: nextNotificationId++,
    user_id,
    type,
    payload,
    read: false,
    created_at: new Date().toISOString(),
  };
  notifications.push(n);
  return n;
}

function createFriendRequest(from_user_id, to_user_id) {
  if (from_user_id === to_user_id) throw new Error('não podes pedir amizade a ti próprio');
  if (areFriends(from_user_id, to_user_id)) throw new Error('já são amigos');
  if (findPendingRequest(from_user_id, to_user_id)) throw new Error('já existe um pedido pendente');

  const request = {
    id: nextFriendRequestId++,
    from_user_id,
    to_user_id,
    status: 'pending',
    created_at: new Date().toISOString(),
    responded_at: null,
  };
  friendRequests.push(request);
  addNotification(to_user_id, 'friend_request', { request_id: request.id, from_user_id });
  return request;
}

function respondFriendRequest(request_id, responder_user_id, action) {
  const request = friendRequests.find((r) => r.id === Number(request_id));
  if (!request) throw new Error('pedido de amizade não encontrado');
  if (request.to_user_id !== responder_user_id) throw new Error('só o destinatário pode responder a este pedido');
  if (request.status !== 'pending') throw new Error('este pedido já foi respondido');
  if (!['accept', 'decline'].includes(action)) throw new Error('ação inválida: usa "accept" ou "decline"');

  request.status = action === 'accept' ? 'accepted' : 'declined';
  request.responded_at = new Date().toISOString();

  if (request.status === 'accepted') {
    addNotification(request.from_user_id, 'friend_request_accepted', {
      request_id: request.id,
      by_user_id: responder_user_id,
    });
  }
  return request;
}

function listFriendRequests(user_id) {
  return {
    incoming: friendRequests.filter((r) => r.to_user_id === user_id && r.status === 'pending'),
    outgoing: friendRequests.filter((r) => r.from_user_id === user_id && r.status === 'pending'),
  };
}

function listFriends(user_id) {
  return friendRequests
    .filter((r) => r.status === 'accepted' && (r.from_user_id === user_id || r.to_user_id === user_id))
    .map((r) => (r.from_user_id === user_id ? r.to_user_id : r.from_user_id));
}

// -- discover -----------------------------------------------------------
// Sugere pessoas com estados em comum recentemente. Nunca inclui check-ins
// marcados como crise — essa sinalização é só entre o utilizador e /escalate,
// nunca entra em lógica de sugestão social (mesmo princípio do "circle").
function getDiscoverSuggestions(user_id, limit = 10) {
  const myStates = new Set(
    checkins.filter((c) => c.user_id === user_id && !c.is_crisis_flag).map((c) => c.state)
  );
  if (myStates.size === 0) return [];

  const friends = new Set(listFriends(user_id));
  const scoreByUser = new Map();

  checkins
    .filter((c) => c.user_id !== user_id && !c.is_crisis_flag && myStates.has(c.state))
    .forEach((c) => {
      if (friends.has(c.user_id)) return;
      scoreByUser.set(c.user_id, (scoreByUser.get(c.user_id) || 0) + 1);
    });

  return [...scoreByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([other_user_id, shared_states]) => ({
      user_id: other_user_id,
      username: users.get(other_user_id)?.username || `user_${other_user_id}`,
      avatar: users.get(other_user_id)?.avatar || null,
      shared_states,
    }));
}

// -- mensagens ------------------------------------------------------------
// Só entre amigos aceites — nunca DM aberto para alguém encontrado no
// circle/discover. Isto evita que utilizadores vulneráveis (ex: quem acabou
// de marcar um estado difícil) sejam contactáveis por estranhos.
function sendMessage(from_user_id, to_user_id, text) {
  if (!text || !text.trim()) throw new Error('mensagem vazia');
  if (!areFriends(from_user_id, to_user_id)) {
    throw new Error('só podes enviar mensagens a amigos aceites');
  }
  const message = {
    id: nextMessageId++,
    from_user_id,
    to_user_id,
    text: text.trim(),
    created_at: new Date().toISOString(),
  };
  messages.push(message);
  addNotification(to_user_id, 'message', { from_user_id, message_id: message.id });
  return message;
}

function getConversation(userA, userB, limit = 50) {
  return messages
    .filter(
      (m) =>
        (m.from_user_id === userA && m.to_user_id === userB) ||
        (m.from_user_id === userB && m.to_user_id === userA)
    )
    .slice(-limit);
}

// -- notificações ---------------------------------------------------------

function listNotifications(user_id) {
  return notifications
    .filter((n) => n.user_id === user_id)
    .slice()
    .reverse();
}

function markNotificationRead(notification_id, user_id) {
  const n = notifications.find((x) => x.id === Number(notification_id));
  if (!n) throw new Error('notificação não encontrada');
  if (n.user_id !== user_id) throw new Error('esta notificação não pertence a este utilizador');
  n.read = true;
  return n;
}

module.exports = {
  STATES,
  CRISIS_RESOURCES_PT,
  addCheckin,
  getTodayCircle,
  getIsolationSignal,
  upsertUser,
  getUser,
  setAvatar,
  createFriendRequest,
  respondFriendRequest,
  listFriendRequests,
  listFriends,
  areFriends,
  getDiscoverSuggestions,
  sendMessage,
  getConversation,
  listNotifications,
  markNotificationRead,
};
