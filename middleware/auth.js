const { UNAUTHORIZED } = require("../helpers/status-code");
const { decryptObject } = require("../utils/utility");

async function verifyToken(req, reply) {
    try {
        const decoded = await req.jwtVerify();
        const decrytAuth = await decryptObject(decoded.data);
        req.userData=decrytAuth;

        if (req.method === 'PUT') {
            if (req.body?.isActive || !("isActive" in req.body)) {
                req.body = {
                    ...req.body,
                    updatedBy: decrytAuth.staffId,
                    updatedAt: new Date(),
                    deletedAt: null
                };
            } else {
                req.body = {
                    ...req.body,
                    deletedAt: req.body?.isActive === 0 ? new Date() : null
                };
            }
        }
        if (req.method === 'POST') {
            req.body = {
                ...req.body,
                createdBy: decrytAuth.staffId,
                updatedBy: null,
                updatedAt: null,
                deletedAt: null
            };
        }

        return { success: true, decoded };
    } catch (error) {
        if (error.message === "Authorization token expired") {
            reply.code(401).send({
                code: UNAUTHORIZED,
                message: "Token has expired. Please login again.",
            });
        } else {
            reply.code(401).send({
                code: UNAUTHORIZED,
                message: "Access Denied...!",
            });
        }
    }
}

module.exports = {
    verifyToken,
};
