const app = require('./app');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Not Alone Core API a correr em http://localhost:${PORT}`);
});
