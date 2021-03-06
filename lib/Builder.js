'use strict';

const protobuf = require('protobufjs');
const Utils = require('./utils');
const crypto = require('crypto');
const longjs = require('long');
const path = require('path');

const errors = require('./errors');

/**
 * the signature builder
 * @constructor
 * @param {Object} [options] - a set of options and defaults to send to the signature builder
 * @param {number} [options[].initTime] - time in ms to use as the app's startup time
 * @param {Buffer} [options[].unk22] - a 32-byte Buffer to use as `unk22`
 * @param {String} [options[].version] - The version to run on, defaults to 0.45
 */
let Builder = function(options) {
    if (!options) options = {}
    this.initTime = options.initTime || new Date().getTime();
    this.time_since_start = options.time_since_start || null;
    this.time = options.time || null;
    this.version = options.version || "0.45";
    this.forcedUk25 = options.uk25 || null;
    
    if (options.protos) {
        this.signature = options.protos.Networking.Envelopes.Signature;
    } else {
        throw new Error("Signature proto is required");
    }

    this.utils = new Utils();
    
    this.fields = {
        session_hash: options.session_hash || options.unk22 || crypto.randomBytes(16)
    };
    
    /// We don't want to proxy requests to the hashing server
    const noproxy = "azurewebsites.net,pogodev.io";
    if (process.env.no_proxy) {
        process.env.no_proxy += "," + noproxy;
    } else {
        process.env.no_proxy = noproxy;
    }
};

/**
 * sets the location to be used in signature building
 * @param {number} lat - latitude
 * @param {number} lng - longitude
 * @param {number} [accuracy=0] - accuracy
 */
Builder.prototype.setLocation = function(lat, lng, accuracy) {
    this.lat = lat;
    this.lng = lng;
    this.accuracy = accuracy || 0;
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
        this.authTicket = authTicket.constructor.encode(authTicket).finish();
    }
}

/**
 * merges a set of key-values into the internally stored fields for the signature
 * @param {Object} fields - key-value mapping for siganture fields
 */
Builder.prototype.setFields = function(fields) {
    for (let field in fields) {
        this.fields[field] = fields[field];
    }
}


/**
 * Enables hashing server rather than native
 */
Builder.prototype.useHashingServer = function(url, key){
    this.utils.useHashingServer(url, key);
}

/**
 * builds an unencrypted signature returned as a protobuf object or Buffer
 * @param {Object|Object[]|Buffer|Buffer[]} requests - array of RPC requests (protobuf objects or encoded protobuf Buffers) to be used in the signature generation
 * @returns {Promise}
 */
Builder.prototype.buildSignature = function(requests) {
    if (!Array.isArray(requests)) {
        requests = [requests];
    }
    
    /// 0.45 supports both hashing server and native
    if(this.version.startsWith('0.45')) {
        return new Promise((success, fail) => {
            this._hashFourtyFive(success, fail, requests);
        });
    /// later version
    } else {
        return this._hashWithServer(requests);
    }
}

/**
 * builds a signature given requests, and encrypts it afterwards
 * @global
 * @param {Object|Object[]|Buffer|Buffer[]} requests - array of RPC requests (protobuf objects or encoded protobuf Buffers) to be used in the signature generation
 * @param {Number} timestamp_since_start - the time since your request started, must match what you're sending in the signture
 * @param {encryptCallback} cb - function to be called when encryption is completed
 */
Builder.prototype.encrypt = function(requests, cb) {
    this.buildSignature(requests)
    .then(response => {
        this.utils.encrypt(response.constructor.encode(response).finish(), +response.timestamp_since_start, this.version, cb);
    })
    .catch(e => {
        cb(e, null);
    });
}


/// ================
/// 0.45
/// ================


/**
 * @private
 * hashes for 0.45
 */
Builder.prototype._hashFourtyFive = function(success, fail, requests) {
    this.utils.hashLocation1(this.authTicket, this.lat, this.lng, this.accuracy).then((hash1) => {
        this.utils.hashLocation2(this.lat, this.lng, this.accuracy).then((hash2) => {
            let signatureData = {
                location_hash1: hash1,
                location_hash2: hash2,
                timestamp: this.time || new Date().getTime(),
                timestamp_since_start: this.time_since_start || (new Date().getTime() - this.initTime),
                unknown25: this.getUk25(),
            };
            
            for(let field in this.fields) {
                signatureData[field] = this.fields[field];
            }

            let signature = new this.signature(signatureData);
            
            if(!Array.isArray(requests)) {
                requests = [requests];
            }
            
            let request_hash = [];
            const authTicket = this.authTicket;
            
            if(requests.length > 0) {
                for(const request of requests){
                    this.utils.hashRequest(authTicket, request.constructor.encode ? request.constructor.encode(request).finish() : request).then((hashRequest) => {
                        request_hash.push(longjs.fromBits(hashRequest.low, hashRequest.high, true));
                        if(request_hash.length === requests.length) {
                            signature.request_hash = request_hash;
                            success(signature);
                        };
                    }, fail);
                };
            } else {
                success(signature);
            }
        }, fail);
    }, fail);
}

Builder.prototype.getUk25 = function() {
    // if forced uk25 was passed in option, use it
    // we suppose unsigned negative long is a string is passed
    if (this.forcedUk25) {
        if (Long.isLong(this.forcedUk25)) return this.forcedUk25;
        else return longjs.fromString(this.forcedUk25, false);
    }

    // note: 0.45 return 0.57 uk25 as old uk25 seems to be blocked
    if (this.version.startsWith('0.45')) return longjs.fromString('-816976800928766045', false);
    else if (this.version.startsWith('0.51')) return longjs.fromString('-8832040574896607694', false);
    else if (this.version.startsWith('0.53')) return longjs.fromString('-76506539888958491', false);
    else if (this.version.startsWith('0.55')) return longjs.fromString('-9156899491064153954', false);
    else if (this.version.startsWith('0.57')) return longjs.fromString('-816976800928766045', false);
    else if (this.version.startsWith('0.59')) return longjs.fromString('-3226782243204485589', false);
    else if (this.version.startsWith('0.61')) return longjs.fromString('1296456256998993698', false);
    else if (this.version.startsWith('0.63')) return longjs.fromString('5348175887752539474', false);
    else if (this.version.startsWith('0.67')) return longjs.fromString('5395925083854747393', false);
    else if (this.version.startsWith('0.69')) return longjs.fromString('5395925083854747393', false);
    else throw new Error('Unhandled config version: ' + this.version);
};

Builder.prototype._hashWithServer = function(requests) {
    const byteRequests = [];
    for(const request of requests) {
        if(request.constructor.encode){
            byteRequests.push(request.constructor.encode(request).finish().toString("base64"));
        } else {
            byteRequests.push(request.toString("base64"));
        }
    }
    
    const time_since_start = this.time_since_start || (new Date().getTime() - this.initTime);
    const timestamp = this.time || new Date().getTime();
    
    /// Do the hashing, get the response back and build the signature
    return this.utils.hashWithServer(this.authTicket, this.lat, this.lng, this.accuracy, timestamp, this.fields.session_hash, byteRequests)
    .then((response) => {
        this.rateInfos = this.utils.rateInfos;
        let signatureData = {
            location_hash1: response.location1,
            location_hash2: response.location2,
            timestamp: timestamp,
            timestamp_since_start: time_since_start,
            unknown25: this.getUk25()
        };

        for(let field in this.fields) {
            signatureData[field] = this.fields[field];
        }

        let signature = new this.signature(signatureData);
        
        let request_hash = [];
        if (response.request_hash) {
            if(!Array.isArray(response.request_hash)) {
                response.request_hash = [response.request_hash];
            }
            
            for(let element of response.request_hash) {
                request_hash.push(longjs.fromString(String(element), true, 10));
            }
        }
        
        signature.request_hash = request_hash;
        return signature;
    });
}


module.exports = Builder;
