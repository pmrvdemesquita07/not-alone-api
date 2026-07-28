const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

let server;
let baseUrl;

before(() => {
  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => {
  server.close();
});

function post(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function get(path) {
  return fetch(`${baseUrl}${path}`);
}

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('POST /v1/users cria perfil e GET devolve-o', async () => {
  const created = await (await post('/v1/users', { user_id: 'soc_a', username: 'Ana' })).json();
  assert.equal(created.username, 'Ana');

  const fetched = await (await get('/v1/users/soc_a')).json();
  assert.equal(fetched.user_id, 'soc_a');
  assert.equal(fetched.username, 'Ana');
});

test('GET /v1/users/:id devolve 404 para utilizador inexistente', async () => {
  const res = await get('/v1/users/soc_never_existed');
  assert.equal(res.status, 404);
});

test('POST /v1/users/:id/photo aceita data URI e rejeita formato inválido', async () => {
  await post('/v1/users', { user_id: 'soc_photo' });
  const ok = await post('/v1/users/soc_photo/photo', { photo: TINY_PNG });
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.avatar, TINY_PNG);

  const bad = await post('/v1/users/soc_photo/photo', { photo: 'not-a-data-uri' });
  assert.equal(bad.status, 422);
});

test('pedido de amizade: enviar, listar, aceitar, e depois já são amigos', async () => {
  await post('/v1/users', { user_id: 'soc_req_a' });
  await post('/v1/users', { user_id: 'soc_req_b' });

  const created = await (
    await post('/v1/friend-requests', { from_user_id: 'soc_req_a', to_user_id: 'soc_req_b' })
  ).json();
  assert.equal(created.status, 'pending');

  const dup = await post('/v1/friend-requests', { from_user_id: 'soc_req_a', to_user_id: 'soc_req_b' });
  assert.equal(dup.status, 422);

  const incoming = await (await get('/v1/friend-requests/soc_req_b')).json();
  assert.equal(incoming.incoming.length, 1);

  const accepted = await (
    await post(`/v1/friend-requests/${created.id}/respond`, { user_id: 'soc_req_b', action: 'accept' })
  ).json();
  assert.equal(accepted.status, 'accepted');

  const friendsOfA = await (await get('/v1/friends/soc_req_a')).json();
  assert.ok(friendsOfA.friends.includes('soc_req_b'));
});

test('só o destinatário pode responder ao pedido de amizade', async () => {
  await post('/v1/users', { user_id: 'soc_perm_a' });
  await post('/v1/users', { user_id: 'soc_perm_b' });
  const created = await (
    await post('/v1/friend-requests', { from_user_id: 'soc_perm_a', to_user_id: 'soc_perm_b' })
  ).json();

  const res = await post(`/v1/friend-requests/${created.id}/respond`, {
    user_id: 'soc_perm_a',
    action: 'accept',
  });
  assert.equal(res.status, 422);
});

test('mensagens: bloqueadas entre estranhos (403), permitidas entre amigos', async () => {
  await post('/v1/users', { user_id: 'soc_msg_a' });
  await post('/v1/users', { user_id: 'soc_msg_b' });

  const blocked = await post('/v1/messages', {
    from_user_id: 'soc_msg_a',
    to_user_id: 'soc_msg_b',
    text: 'olá',
  });
  assert.equal(blocked.status, 403);

  const req = await (
    await post('/v1/friend-requests', { from_user_id: 'soc_msg_a', to_user_id: 'soc_msg_b' })
  ).json();
  await post(`/v1/friend-requests/${req.id}/respond`, { user_id: 'soc_msg_b', action: 'accept' });

  const sent = await post('/v1/messages', { from_user_id: 'soc_msg_a', to_user_id: 'soc_msg_b', text: 'olá!' });
  assert.equal(sent.status, 201);

  const thread = await (await get('/v1/messages/soc_msg_a/soc_msg_b')).json();
  assert.equal(thread.messages.length, 1);
  assert.equal(thread.messages[0].text, 'olá!');
});

test('discover sugere quem partilha estados recentes, sem incluir check-ins de crise', async () => {
  await post('/v1/checkin', { user_id: 'soc_disc_me', state: 'parte_de_algo' });
  await post('/v1/checkin', { user_id: 'soc_disc_other', state: 'parte_de_algo' });
  await post('/v1/checkin', {
    user_id: 'soc_disc_crisis_only',
    state: 'dia_normal',
    is_crisis_flag: true,
  });

  const res = await (await get('/v1/discover/soc_disc_me')).json();
  const ids = res.suggestions.map((s) => s.user_id);
  assert.ok(ids.includes('soc_disc_other'));
  assert.ok(!ids.includes('soc_disc_crisis_only'));
});

test('discover não sugere quem já é amigo', async () => {
  await post('/v1/users', { user_id: 'soc_disc_friend_a' });
  await post('/v1/users', { user_id: 'soc_disc_friend_b' });
  await post('/v1/checkin', { user_id: 'soc_disc_friend_a', state: 'dia_normal' });
  await post('/v1/checkin', { user_id: 'soc_disc_friend_b', state: 'dia_normal' });

  const req = await (
    await post('/v1/friend-requests', {
      from_user_id: 'soc_disc_friend_a',
      to_user_id: 'soc_disc_friend_b',
    })
  ).json();
  await post(`/v1/friend-requests/${req.id}/respond`, { user_id: 'soc_disc_friend_b', action: 'accept' });

  const res = await (await get('/v1/discover/soc_disc_friend_a')).json();
  const ids = res.suggestions.map((s) => s.user_id);
  assert.ok(!ids.includes('soc_disc_friend_b'));
});

test('notificações: pedido de amizade gera notificação para o destinatário, e fica marcada como lida', async () => {
  await post('/v1/users', { user_id: 'soc_notif_a' });
  await post('/v1/users', { user_id: 'soc_notif_b' });
  await post('/v1/friend-requests', { from_user_id: 'soc_notif_a', to_user_id: 'soc_notif_b' });

  const list = await (await get('/v1/notifications/soc_notif_b')).json();
  assert.equal(list.notifications.length, 1);
  assert.equal(list.notifications[0].type, 'friend_request');
  assert.equal(list.notifications[0].read, false);

  const marked = await post(`/v1/notifications/${list.notifications[0].id}/read`, {
    user_id: 'soc_notif_b',
  });
  assert.equal(marked.status, 200);
  const updated = await marked.json();
  assert.equal(updated.read, true);
});
