'use strict';

const protobuf = require('protobufjs');
const utils = require('./utils');
const crypto = require('crypto');
const longjs = require('long');
const path = require('path');

const PROTO_Signature = protobuf.loadProtoFile(path.join(__dirname, 'proto', 'Signature.proto')).build().Signature;
const PROTO_u6 = protobuf.loadProtoFile(path.join(__dirname, 'proto', 'Unknown6.proto')).build().Unknown6;

/**
 * the signature builder
 * @constructor
 * @param {Object} [options] - a set of options and defaults to send to the signature builder
 * @param {number} [options[].initTime] - time in ms to use as the app's startup time
 * @param {Buffer} [options[].unk22] - a 32-byte Buffer to use as `unk22`
 */
let Builder = function(options) {
    if (!options) options = {}
    this.initTime = options.initTime || new Date().getTime();
    this.unk22 = options.unk22 || crypto.randomBytes(32);
};

/**
 * sets the location to be used in signature building
 * @param {number} lat - latitude
 * @param {number} lng - longitude
 * @param {number} [alt=0] - altitude
 */
Builder.prototype.setLocation = function(lat, lng, alt) {
    if (!alt) alt = 0;
    this.lat = lat;
    this.lng = lng;
    this.alt = alt;
}

/**
 * sets the auth_ticket to be used in signature building
 * @param {Buffer|Object} authTicket - protobufjs constructor OR raw buffer containing bytes (must pass true for `isEncoded` when passing a Buffer)
 * @param {boolean} [isEncoded=false] - set to true if the authTicket is a protobuf encoded Buffer
 */
Builder.prototype.setAuthTicket = function(authTicket, isEncoded) {
    if (isEncoded) {
        this.authTicket = authTicket;
    } else {
        if (authTicket.encode) {
            this.authTicket = authTicket.encode().toBuffer();
        }
    }
}

/**
 * builds an unencrypted signature returned as a protobuf object or Buffer
 * @param {Object|Object[]|Buffer|Buffer[]} requests - array of RPC requests (protobuf objects or encoded protobuf Buffers) to be used in the signature generation
 * @param {boolean} [retRawBytes=false] - if true, will return a protobuf encoded Buffer of the resulting signature rather than a protobuf object
 * @returns {Object|Buffer}
 */
Builder.prototype.buildSignature = function(requests, retRawBytes) {
    if (!Array.isArray(requests)) {
        requests = [requests];
    }

    let signature = new PROTO_Signature({
        location_hash1: utils.hashLocation1(this.authTicket, this.lat, this.lng, this.alt).toNumber(),
        location_hash2: utils.hashLocation2(this.lat, this.lng, this.alt).toNumber(),
        unk22: this.unk22,
        timestamp: new Date().getTime(),
        timestamp_since_start: (new Date().getTime() - this.initTime),
    });

    requests.forEach(request => {
        const requestBytes = (request.encode) ? request.encode().toBuffer() : request;
        const reqHash = utils.hashRequest(this.authTicket, requestBytes).toString();
        signature.request_hash.push(longjs.fromString(reqHash, true, 10));
    });

    if (retRawBytes) return signature.encode().toBuffer();
    return signature;
}

/**
 * builds a signature given requests, and encrypts it afterwards
 * @global
 * @param {Object|Object[]|Buffer|Buffer[]} requests - array of RPC requests (protobuf objects or encoded protobuf Buffers) to be used in the signature generation
 * @param {encryptCallback} cb - function to be called when encryption is completed
 */
Builder.prototype.encrypt = function(requests, cb) {
    const signature = this.buildSignature(requests, true);
    utils.encrypt(signature, crypto.randomBytes(32), cb);
}

/**
 * builds a signature given requests, and encrypts it afterwards
 * @global
 * @param {Object|Object[]|Buffer|Buffer[]} requests - array of RPC requests (protobuf objects or encoded protobuf Buffers) to be used in the signature generation
 * @returns {Buffer} encrypted bytes returned from encryption
 */
Builder.prototype.encryptSync = function(requests) {
    const signature = this.buildSignature(requests, true);
    return utils.encryptSync(signature, crypto.randomBytes(32));
}

/**
 * returns a completely-populated unknown6 protobuf object to be used in a Request Envelope
 * @param {Object|Object[]|Buffer|Buffer[]} requests - array of RPC requests (protobuf objects or encoded protobuf Buffers) to be used in the signature generation
 * @param {Function} callback - Callback executed when encryption and unknown6 constructing is complete.
 */
Builder.prototype.getUnknown6 = function(requests, cb) {
    this.encrypt(requests, (err, result) => {
        if (err) return cb(err);
        cb(null, new PROTO_u6({
            request_type: 6,
            unknown2: new PROTO_u6.Unknown2({
                encrypted_signature: result
            })
        }));
    });
}

module.exports = Builder;
