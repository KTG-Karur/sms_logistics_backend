const ROLES = {
    BRANCH_ADMIN: 'BRANCH_ADMIN',
    BRANCH_MANAGER: 'BRANCH_MANAGER',
    RELATIONSHIP_MANAGER: 'RELATIONSHIP_MANAGER',
    OTHER: 'OTHER',
}
module.exports.ROLES = ROLES;
/** @typedef {keyof typeof ROLES} TRoleName */

const TEMPLATE_TYPES = {
    NOTIFICATION: "NOTIFICATION",
    SMS: "SMS",
}
module.exports.TEMPLATE_TYPES = TEMPLATE_TYPES;
/** @typedef {keyof typeof TEMPLATE_TYPES} TTemplateType */

//GOWIN

const GENERAL_TYPES = {
    REGION: "REGION",
    STATE: "STATE",
    DESIGNATION: "DESIGNATION",
    TEAM: "TEAM",
    PARTNER_TYPE: "PARTNER_TYPE",
    INSURER: "INSURER",
    MAKE: "MAKE",
}
module.exports.GENERAL_TYPES = GENERAL_TYPES
/** @typedef {keyof typeof GENERAL_TYPES} TGeneralTypes */

const ACC_HOLDER_TYPES = {
    BRANCH: "BRANCH",
    PARTNER: "PARTNER",
    BROKER: "BROKER",
    VENDOR: "VENDOR",
}
module.exports.ACC_HOLDER_TYPES = ACC_HOLDER_TYPES
/** @typedef {keyof typeof ACC_HOLDER_TYPES} TAccountHolder */

const PAYMENT_MODES = {
    BANK: "BANK",
    ONLINE: "ONLINE",
    GPAY: "GPAY",
    CHEQUE: "CHEQUE",
    NEFT: "NEFT",
}
module.exports.PAYMENT_MODES = PAYMENT_MODES;
/** @typedef {keyof typeof PAYMENT_MODES} TPaymentMode */

const PARTY_TYPES = {
    BRANCH: "BRANCH",
    PARTNER: "PARTNER",
}
module.exports.PARTY_TYPES = PARTY_TYPES;
/** @typedef {keyof typeof PARTY_TYPES} TPartyType */

const COMMISSION_TYPES = {
    BASE: "BASE",
    REWARD_1: "REWARD_1",
    REWARD_2: "REWARD_2",
}
module.exports.COMMISSION_TYPES = COMMISSION_TYPES;
/** @typedef {keyof typeof COMMISSION_TYPES} TCommissionType */
