const express = require('express');
const apiRoutes = require('./routes/api');

const app = express();
app.use(express.json());

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

module.exports = app;
