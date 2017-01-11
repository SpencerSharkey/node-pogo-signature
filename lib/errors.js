let util = require('util');

module.exports.HashServerError = function HashServerError(message, status, data) {
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = message;
    this.status = status;
    this.data = data;
}
util.inherits(module.exports.HashServerError, Error);
