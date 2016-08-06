var NativeExtension = require('bindings')('node-pogo-signature');

module.exports = {
    encrypt: NativeExtension.encrypt
}
