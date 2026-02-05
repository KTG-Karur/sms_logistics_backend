'use strict';

function ResponseEntry() {
    this.data = [];
    this.error = false;
    this.message = 'Success';
    this.code = 200;
}

module.exports.ResponseEntry = ResponseEntry;