'use strict';

const protobuf = require('protobufjs');
const Utils = require('./Utils');
const crypto = require('crypto');
const longjs = require('long');
const path = require('path');
const pcrypt = require("pcrypt");

const PROTO_Signature = protobuf.loadProtoFile(path.join(__dirname, 'proto', 'Signature.proto')).build().Signature;
const PROTO_u6 = protobuf.loadProtoFile(path.join(__dirname, 'proto', 'Unknown6.proto')).build().Unknown6;

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
    this.utils = new Utils();
    
    this.fields = {
        session_hash: options.session_hash || options.unk22 || crypto.randomBytes(32)
    };
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
 * 0.45: IP/Port
 * 0.51: IP or DOMAIN / Port
 */
Builder.prototype.useHashingServer = function(hashingServerIP, hashingServerPort, pokeHashKey, pokeHashVersion){
    this.utils.useHashingServer(hashingServerIP, hashingServerPort, pokeHashKey, pokeHashVersion);
}

/**
 * builds an unencrypted signature returned as a protobuf object or Buffer
 * @param {Object|Object[]|Buffer|Buffer[]} requests - array of RPC requests (protobuf objects or encoded protobuf Buffers) to be used in the signature generation
 * @returns {Object|Buffer}
 */
Builder.prototype.buildSignature = function(requests) {
    return new Promise((success, fail) => {
        if (!Array.isArray(requests)) {
            requests = [requests];
        }
        
        /// 0.45 supports both hashing server and native
        if(this.version === "0.45") {
            this._hashFourtyFive(success, fail, requests);
        /// 0.51 supports only hashing server
        } else {
            this._hashFifthOne(success, fail, requests);
        }
    })
}

/**
 * builds a signature given requests, and encrypts it afterwards
 * @global
 * @param {Object|Object[]|Buffer|Buffer[]} requests - array of RPC requests (protobuf objects or encoded protobuf Buffers) to be used in the signature generation
 * @param {Number} timestamp_since_start - the time since your request started, must match what you're sending in the signture
 * @param {encryptCallback} cb - function to be called when encryption is completed
 */
Builder.prototype.encrypt = function(requests, cb) {
    let signature = this.buildSignature(requests).then((response) => {
        this.utils.encrypt(response.encode().toBuffer(), +response.timestamp_since_start, this.version, cb);
    }, () => {
        console.log("Failed to encrypt");
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
    this.utils.hashLocation1(this.authTicket, this.lat, this.lng, this.alt).then((hash1) => {
        this.utils.hashLocation2(this.lat, this.lng, this.alt).then((hash2) => {
            let signature = new PROTO_Signature({
                location_hash1: hash1,
                location_hash2: hash2,
                timestamp: this.time || new Date().getTime(),
                timestamp_since_start: this.time_since_start || (new Date().getTime() - this.initTime),
                unknown25: longjs.fromString("16892874496697272497", true, 10)
            });
            
            for(let field in this.fields) {
                signature[field] = this.fields[field];
            }
            
            if(!Array.isArray(requests)) {
                req = [req];
            }
            
            let request_hash = [];
            const authTicket = this.authTicket;
            
            for(const request of requests){
                this.utils.hashRequest(authTicket, request.encode ? request.encode().toBuffer() : request).then((hashRequest) => {
                    request_hash.push(longjs.fromBits(hashRequest.low, hashRequest.high, true));
                    if(request_hash.length === requests.length) {
                        signature.request_hash = request_hash;
                        success(signature);
                    };
                }, fail);
            };  
        }, fail);
    }, fail);
}


/// ================
/// 0.51
/// ================


/**
 * @private
 * hashes for 0.51
 */
Builder.prototype._hashFifthOne = function(success, fail, requests) {
    /// This is getting messy because of 0.45 and 0.51 at the same time, can't override these values higher up
    const byteRequests = [];
    for(const request of requests) {
        if(request.encode){
            byteRequests.push(request.encode().toBuffer().toString("base64"));
        } else {
            byteRequests.push(request.toString("base64"));
        }
    }
    
    const time_since_start = this.time_since_start || (new Date().getTime() - this.initTime);
    const timestamp = this.time || new Date().getTime();
    
    /// Do the hashing, get the response back and build the signature
    this.utils.hashFiftyOne(this.authTicket, this.lat, this.lng, this.alt, timestamp, this.fields.session_hash, byteRequests)
    .then((response) => {
        let signature = new PROTO_Signature({
            location_hash1: response.location1,
            location_hash2: response.location2,
            timestamp: timestamp,
            timestamp_since_start: time_since_start,
            /// Signed, negative number. Unsigned will convert to positive and invalidate
            unknown25: longjs.fromString("-8832040574896607694", false)
        });
        
        for(let field in this.fields) {
            signature[field] = this.fields[field];
        }
        
        if(!Array.isArray(response.request_hash)) {
            response.request_hash = [response.request_hash];
        }
        
        let request_hash = [];
        const authTicket = this.authTicket;
        
        for(let element of response.request_hash) {
            request_hash.push(longjs.fromString(element, true, 10));
        }
        
        signature.request_hash = request_hash;
        success(signature);
    }, (reason) => {
        console.warn(reason);
        fail();
    })
}

module.exports = Builder;