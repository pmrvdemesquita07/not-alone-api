const express = require('express');
const { STATES, CRISIS_RESOURCES_PT, addCheckin, getTodayCircle, getIsolationSignal } = require('../store');

const router = express.Router();

// GET /v1/states — lista os estados possíveis (para a app construir o ecrã de check-in)
router.get('/states', (req, res) => {
  res.json({ states: STATES });
});

// POST /v1/checkin — regista o estado diário de um utilizador
router.post('/checkin', (req, res) => {
  const { user_id, state, note, is_crisis_flag } = req.body;
  if (!user_id || !state) {
    return res.status(422).json({ error: 'user_id e state são obrigatórios' });
  }
  try {
    const entry = addCheckin({ user_id, state, note, is_crisis_flag });
    const isolation = getIsolationSignal(user_id);
    const circle = getTodayCircle(user_id, state);

    const response = { checkin: entry, isolation, circle };

    // Se o próprio utilizador sinalizou crise, ou a regra estrutural chegou a
    // "crisis", devolvemos já os recursos — sem esperar por um pedido separado.
    if (isolation.level === 'crisis') {
      response.crisis_resources = CRISIS_RESOURCES_PT;
    }

    res.status(201).json(response);
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

// GET /v1/circle/:user_id?state=... — quem mais está hoje no mesmo estado
router.get('/circle/:user_id', (req, res) => {
  const { user_id } = req.params;
  const { state } = req.query;
  if (!state) return res.status(422).json({ error: 'query param "state" é obrigatório' });
  res.json({ circle: getTodayCircle(user_id, state) });
});

// GET /v1/isolation-signal/:user_id — nível de isolamento (normal/attention/crisis)
router.get('/isolation-signal/:user_id', (req, res) => {
  res.json(getIsolationSignal(req.params.user_id));
});

// POST /v1/escalate — pedido explícito de ajuda (botão "preciso de ajuda agora")
router.post('/escalate', (req, res) => {
  const { user_id, country = 'PT' } = req.body;
  if (!user_id) return res.status(422).json({ error: 'user_id é obrigatório' });

  // v1: só temos recursos para PT. Estrutura já pronta para mais países.
  const resources = country === 'PT' ? CRISIS_RESOURCES_PT : null;
  if (!resources) {
    return res.status(501).json({ error: `Ainda sem recursos configurados para ${country}` });
  }
  res.json({ user_id, crisis_resources: resources });
});

module.exports = router;
