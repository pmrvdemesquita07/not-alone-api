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

test('GET /v1/states lista os estados possíveis', async () => {
  const res = await get('/v1/states');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.states.dia_dificil);
  assert.equal(body.states.dia_dificil.difficult, true);
});

test('POST /v1/checkin sem user_id ou state devolve 422', async () => {
  const res = await post('/v1/checkin', { state: 'dia_normal' });
  assert.equal(res.status, 422);
});

test('POST /v1/checkin com estado inválido devolve 422', async () => {
  const res = await post('/v1/checkin', { user_id: 'u_invalid_state', state: 'nao_existe' });
  assert.equal(res.status, 422);
});

test('POST /v1/checkin regista o check-in e devolve isolation normal', async () => {
  const res = await post('/v1/checkin', { user_id: 'u_normal', state: 'dia_normal' });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.checkin.user_id, 'u_normal');
  assert.equal(body.isolation.level, 'normal');
  assert.equal(body.crisis_resources, undefined);
});

test('circle mostra outros utilizadores com o mesmo estado hoje', async () => {
  await post('/v1/checkin', { user_id: 'u_circle_1', state: 'lesionado_sozinho' });
  const res = await post('/v1/checkin', { user_id: 'u_circle_2', state: 'lesionado_sozinho' });
  const body = await res.json();
  assert.equal(body.circle.length, 1);
  assert.equal(body.circle[0].alias, 'user_u_circle_1');
});

test('isolation-signal passa a "attention" ao 3º estado difícil nos últimos 5 check-ins', async () => {
  const user = 'u_attention';
  await post('/v1/checkin', { user_id: user, state: 'dia_dificil' });
  await post('/v1/checkin', { user_id: user, state: 'treino_cancelado_cabeca' });
  const res = await post('/v1/checkin', { user_id: user, state: 'nao_consigo_hoje' });
  const body = await res.json();
  assert.equal(body.isolation.level, 'attention');
  assert.equal(body.isolation.difficult_count, 3);

  const signal = await (await get(`/v1/isolation-signal/${user}`)).json();
  assert.equal(signal.level, 'attention');
});

test('is_crisis_flag leva a level "crisis" mesmo com estado não-difícil, e devolve crisis_resources', async () => {
  const res = await post('/v1/checkin', {
    user_id: 'u_crisis',
    state: 'dia_normal',
    is_crisis_flag: true,
  });
  const body = await res.json();
  assert.equal(body.isolation.level, 'crisis');
  assert.ok(Array.isArray(body.crisis_resources));
  assert.ok(body.crisis_resources.some((r) => r.contact === '112'));
});

test('POST /v1/escalate devolve recursos reais para PT', async () => {
  const res = await post('/v1/escalate', { user_id: 'u_escalate', country: 'PT' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.crisis_resources.some((r) => r.name.includes('SNS 24')));
});

test('POST /v1/escalate devolve 501 para país sem recursos configurados', async () => {
  const res = await post('/v1/escalate', { user_id: 'u_escalate', country: 'ES' });
  assert.equal(res.status, 501);
});
