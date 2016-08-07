var utils = require('./lib/utils');
var Builder = require('./lib/Builder');

module.exports = {
    utils: utils,
    Builder: Builder,
    encrypt: utils.encrypt,
    encryptSync: utils.encryptSync
}
