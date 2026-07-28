const express = require('express');
const apiRoutes = require('./routes/api');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ name: 'Not Alone Core API', status: 'ok', version: 'v1' });
});

app.use('/v1', apiRoutes);

module.exports = app;
