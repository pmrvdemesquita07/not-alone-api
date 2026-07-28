const express = require('express');
const {
  upsertUser,
  getUser,
  setAvatar,
  createFriendRequest,
  respondFriendRequest,
  listFriendRequests,
  listFriends,
  getDiscoverSuggestions,
  sendMessage,
  getConversation,
  listNotifications,
  markNotificationRead,
} = require('../store');

const router = express.Router();

// POST /v1/users — cria/atualiza o perfil (user_id, username)
router.post('/users', (req, res) => {
  const { user_id, username } = req.body;
  if (!user_id) return res.status(422).json({ error: 'user_id é obrigatório' });
  res.status(201).json(upsertUser({ user_id, username }));
});

// GET /v1/users/:user_id — perfil público
router.get('/users/:user_id', (req, res) => {
  const user = getUser(req.params.user_id);
  if (!user) return res.status(404).json({ error: 'utilizador não encontrado' });
  res.json(user);
});

// POST /v1/users/:user_id/photo — { photo: "data:image/...;base64,..." }
router.post('/users/:user_id/photo', (req, res) => {
  const { photo } = req.body;
  try {
    const user = setAvatar(req.params.user_id, photo);
    res.json(user);
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

// GET /v1/discover/:user_id — pessoas com estados em comum recentemente.
// Nunca inclui check-ins de crise — ver nota em store.js.
router.get('/discover/:user_id', (req, res) => {
  res.json({ suggestions: getDiscoverSuggestions(req.params.user_id) });
});

// POST /v1/friend-requests — { from_user_id, to_user_id }
router.post('/friend-requests', (req, res) => {
  const { from_user_id, to_user_id } = req.body;
  if (!from_user_id || !to_user_id) {
    return res.status(422).json({ error: 'from_user_id e to_user_id são obrigatórios' });
  }
  try {
    const request = createFriendRequest(from_user_id, to_user_id);
    res.status(201).json(request);
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

// POST /v1/friend-requests/:id/respond — { user_id, action: 'accept' | 'decline' }
router.post('/friend-requests/:id/respond', (req, res) => {
  const { user_id, action } = req.body;
  if (!user_id || !action) return res.status(422).json({ error: 'user_id e action são obrigatórios' });
  try {
    const request = respondFriendRequest(req.params.id, user_id, action);
    res.json(request);
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

// GET /v1/friend-requests/:user_id — pendentes recebidos e enviados
router.get('/friend-requests/:user_id', (req, res) => {
  res.json(listFriendRequests(req.params.user_id));
});

// GET /v1/friends/:user_id — lista de ids de amigos aceites
router.get('/friends/:user_id', (req, res) => {
  res.json({ friends: listFriends(req.params.user_id) });
});

// POST /v1/messages — { from_user_id, to_user_id, text } — só entre amigos
router.post('/messages', (req, res) => {
  const { from_user_id, to_user_id, text } = req.body;
  if (!from_user_id || !to_user_id) {
    return res.status(422).json({ error: 'from_user_id e to_user_id são obrigatórios' });
  }
  try {
    const message = sendMessage(from_user_id, to_user_id, text);
    res.status(201).json(message);
  } catch (err) {
    const status = err.message.includes('amigos') ? 403 : 422;
    res.status(status).json({ error: err.message });
  }
});

// GET /v1/messages/:user_id/:other_id — conversa entre dois utilizadores
router.get('/messages/:user_id/:other_id', (req, res) => {
  res.json({ messages: getConversation(req.params.user_id, req.params.other_id) });
});

// GET /v1/notifications/:user_id — mais recentes primeiro
router.get('/notifications/:user_id', (req, res) => {
  res.json({ notifications: listNotifications(req.params.user_id) });
});

// POST /v1/notifications/:id/read — { user_id }
router.post('/notifications/:id/read', (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(422).json({ error: 'user_id é obrigatório' });
  try {
    const n = markNotificationRead(req.params.id, user_id);
    res.json(n);
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

module.exports = router;
