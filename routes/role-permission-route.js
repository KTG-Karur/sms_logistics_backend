"use strict";

const Validator = require('fastest-validator')
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const rolePermissionServices = require("../service/role-permission-service");
const _ = require('lodash');

const schema = {}

async function getRolePermission(req, res) {
    const responseEntries = new ResponseEntry();
    try {
        responseEntries.data = await rolePermissionServices.getRolePermission(req.query);
        if (!responseEntries.data) responseEntries.message = messages.DATA_NOT_FOUND;
    } catch (error) {
        responseEntries.error = true;
        responseEntries.message = error.message ? error.message : error;
        responseEntries.code = responseCode.BAD_REQUEST;
        res.status(responseCode.BAD_REQUEST);
    } finally {
        res.send(responseEntries);
    }
}

async function createRolePermission(req, res) {
    const responseEntries = new ResponseEntry();
    const v = new Validator()
    try {
        const validationResponse = await v.validate(req.body, schema)
        if (validationResponse != true) {
            throw new Error(messages.VALIDATION_FAILED);
        } else {            
            responseEntries.data = await rolePermissionServices.createRolePermission(req.body);
            if (!responseEntries.data) responseEntries.message = messages.DATA_NOT_FOUND;
        }
    } catch (error) {
        responseEntries.error = true;
        responseEntries.message = error.message ? error.message : error;
        responseEntries.code = responseCode.BAD_REQUEST;
        res.status(responseCode.BAD_REQUEST);
    } finally {
        res.send(responseEntries);
    }
}

async function updateRolePermission(req, res) {
    const responseEntries = new ResponseEntry();
    const v = new Validator()
    try {
        const filteredSchema = _.pick(schema, Object.keys(req.body));
        const validationResponse = v.validate(req.body, filteredSchema)
        if (validationResponse != true) {
            throw new Error(messages.VALIDATION_FAILED);
        } else {
            responseEntries.data = await rolePermissionServices.updateRolePermission(req.params.rolePermissionId, req.body);
            if (!responseEntries.data) responseEntries.message = messages.DATA_NOT_FOUND;
        }
    } catch (error) {
        responseEntries.error = true;
        responseEntries.message = error.message ? error.message : error;
        responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
        res.status(responseCode.BAD_REQUEST);
    } finally {
        res.send(responseEntries);
    }
}


module.exports = async function (fastify) {
    fastify.route({
        method: 'GET',
        url: '/role-permission',
        preHandler: verifyToken,
        handler: getRolePermission
    });

    fastify.route({
        method: 'POST',
        url: '/role-permission',
        preHandler: verifyToken,
        handler: createRolePermission
    });

    fastify.route({
        method: 'PUT',
        url: '/role-permission/:rolePermissionId',
        preHandler: verifyToken,
        handler: updateRolePermission
    });
};