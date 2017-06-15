const express = require('express');

module.exports = {
  create: () => express().set('json spaces', 2),
  defaults: require('./defaults'),
  mockServer: require('./mock-server'),
  router: require('./router'),
  routerMocker: require('./router-mocker'),
  rewriter: require('./rewriter'),
  bodyParser: require('./body-parser')
};