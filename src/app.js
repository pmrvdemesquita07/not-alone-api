const express = require('express');
const apiRoutes = require('./routes/api');
const socialRoutes = require('./routes/social');

const app = express();
// limite alargado para caber fotos de perfil em base64 (ver MAX_AVATAR_LENGTH em store.js)
app.use(express.json({ limit: '3mb' }));

// CORS liberal — protótipo v1, sem dados sensíveis reais, para permitir
// testar a partir de uma página de demonstração num browser.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/', (req, res) => {
  res.json({ name: 'Not Alone Core API', status: 'ok', version: 'v1' });
});

app.use('/v1', apiRoutes);
app.use('/v1', socialRoutes);

module.exports = app;
