const express = require('express');
const routes = require('./routes');
const { errorHandler, router_not_matched} = require('./controllers/errorControllers');
const app = express();

app.use(express.json());
app.use('/api', routes);
app.use(router_not_matched);
app.use(errorHandler);

module.exports = app;