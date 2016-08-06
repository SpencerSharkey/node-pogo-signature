var NativeExtension = require('bindings')('node-pogo-u6');

module.exports = {
    encrypt: NativeExtension.encrypt
}
