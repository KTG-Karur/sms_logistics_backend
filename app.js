'use strict';
require('dotenv').config();
const Fastify = require('fastify');
const fastifyJWT = require('@fastify/jwt');
const routesPlugin = require('./routes');
const helmet = require('@fastify/helmet');
const path = require('path');
const fastifyStatic = require('@fastify/static');
const fastify = Fastify();
const fs = require('fs');

// Register @fastify/multipart FIRST
fastify.register(require("@fastify/multipart"), {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10, // Max 10 file per request
  },
  attachFieldsToBody: true, // This attaches form fields to req.body
  sharedSchemaId: "#multipartSchema"
});

//Swagger Docs---->
fastify.register(require('@fastify/swagger'));
fastify.register(require('@fastify/swagger-ui'), {
    routePrefix: '/docs',
});
//CORS------>
fastify.register(require("@fastify/cors", {
    origin: "*",
    allowedHeaders: [
        "origin",
        "X-Requested-With",
        "Accept",
        "Content-Type",
        "Authorization"
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTION"]
}));
//JWT---->
fastify.register(fastifyJWT, {
    secret: "KtgUserToken@2011", verify: {
        extractToken: (req) => req.headers?.auth || req.headers?.authorization.split(' ')[1]
    }
});
//HELMET---->
fastify.register(helmet);
//ROUTE----->
fastify.register(routesPlugin);

// GET UPLOADED IMAGES
fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'uploads'),
    prefix: '/uploads/',
});



module.exports = fastify;