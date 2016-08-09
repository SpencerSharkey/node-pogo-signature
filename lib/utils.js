'use strict';
/**
 * Module containing various util functions for use by the Builder, or your own code!
 * @exports utils
 */

const xxhash = require('xxhashjs'),
    xxh32 = xxhash.h32,
    xxh64 = xxhash.h64;

const nativeEncrypt = require('./U6Encrypt.js');

/**
 * This callback is displayed as a global member.
 * @callback encryptCallback
 * @param {boolean} err - truthy if an error occured during encryption
 * @param {Buffer} result - bytes from the encryption method
 */

/**
 * accepts an input buffer and returns the corresponding encrypted output
 * @param {Buffer} input - raw bytes to encrypt (typically encoded from a protobuf object)
 * @param {Buffer} iv - the initialization vector to be used during the encryption process (should be random)
 * @param {encryptCallback} cb - function to be called when encryption is completed
 */
module.exports.encrypt = function(input, iv, cb) {
    if (iv.length !== 32) { return cb('iv must be 32 in length'); }
    cb(null, nativeEncrypt.encrypt(input, iv));
};

/**
 * accepts an input buffer and synchronously returns the corresponding encrypted output
 * @param {Buffer} input - raw bytes to encrypt (typically encoded from a protobuf object)
 * @param {Buffer} iv - the initialization vector to be used during the encryption process (should be random)
 * @returns {Buffer} encrypted output
 */
module.exports.encryptSync = function(input, iv) {
    return nativeEncrypt.encrypt(input, iv);
};

var locationToBuffer = function(lat, lng, alt) {
    let payload = new Buffer(24);
    payload.writeDoubleBE(lat, 0);
    payload.writeDoubleBE(lng, 8);
    payload.writeDoubleBE(alt || 0, 16);
    return payload;
}

/**
 * hashing function used to generate 'hash_location1' for use in a Signature message
 * @param {Buffer} authTicket - Buffer containing the protobuf encoded auth_ticket to use for hashing
 * @param {number} lat - latitude
 * @param {number} lng - longitude
 * @param {number} [alt=0] - altitude
 * @returns {Object} UINT32 xxhash6432 hashed output
 */
module.exports.hashLocation1 = function(authTicket, lat, lng, alt) {
    const seed = xxh32(authTicket, 0x1B845238);
    const payload = locationToBuffer(lat, lng, alt);
    return xxh32(payload, seed);
};

/**
 * hashing function used to generate 'hash_location2' for use in a Signature message
 * @param {number} lat - latitude
 * @param {number} lng - longitude
 * @param {number} [alt=0] - altitude
 * @returns {Object} UINT32 xxhash32 hashed output
 */
module.exports.hashLocation2 = function(lat, lng, alt) {
    if (!alt) alt = 0x00;
    const payload = locationToBuffer(lat, lng, alt);
    return xxh32(payload, 0x1B845238);
};

/**
 * hashing function used to generate 'hash_location2' for use in a Signature message
 * @param {Buffer} authTicket - Buffer containing the protobuf encoded auth_ticket to use for hashing
 * @param {Buffer} request - protobuf encoded rpc request to hash
 * @returns {Object} UINT64 xxhash64 hashed output
 */
module.exports.hashRequest = function(authTicket, request) {
    const seed = xxh64(authTicket, 0x1B845238);
    return xxh64(request, seed);
};
