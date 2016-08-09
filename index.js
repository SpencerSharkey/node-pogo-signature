const Builder = require('./lib/Builder');
const utils = require('./lib/utils');

module.exports = {
    utils: utils,
    Builder: Builder,
    encrypt: utils.encrypt,
    encryptSync: utils.encryptSync
}
