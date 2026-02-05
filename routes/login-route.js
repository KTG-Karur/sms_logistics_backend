"use strict";

const fastify = require("../app");
const { verifyToken } = require("../middleware/auth");
const Validator = require('fastest-validator')
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const _ = require('lodash');
const loginServices = require("../service/login-service");


async function getOrganizationLogin(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    responseEntries.data = await loginServices.getOrganizationLogin(req.query);
    if (!responseEntries.data) responseEntries.message = messages.DATA_NOT_FOUND;
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message;
    responseEntries.code = responseCode.UNAUTHORIZED;
    responseEntries.token = null
    res.status(responseCode.UNAUTHORIZED);
  } finally {
    res.send(responseEntries);
  }
}

module.exports = async function (fastify) {

  fastify.route({
    method: 'GET',
    url: '/organization-login',
    handler: getOrganizationLogin
  });

};