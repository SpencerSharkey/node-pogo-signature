'use strict';

const net = require("net");
const pcrypt = require("pcrypt");
const native = require("./U6Encrypt");
const http = require("http");
const https = require("https");
const errors = require('./errors');

const SEED = 0x46e945f8; 

const Utils = function(){};

/**
 * Enable this if you're offseting to a hashing server
 */
Utils.prototype.hashingServer = false;
Utils.prototype.pokeHashUrl = null;
Utils.prototype.pokeHashKey = null;

/**
 * Should we be using a hashing server to complete the requests
 */
Utils.prototype.useHashingServer = function(url, key) {
    this.hashingServer = true;
    this.pokeHashUrl = url;
    this.pokeHashKey = key;
}

/**
 * accepts an input buffer and returns the corresponding encrypted output
 * @param {Buffer} input - raw bytes to encrypt (typically encoded from a protobuf object)
 * @param {Number} timestamp_since_start - the time since your request started, must match what you're sending in the signture
 * @param {encryptCallback} cb - function to be called when encryption is completed
 */
Utils.prototype.encrypt = function(input, timestamp_since_start, version, cb) {
    if (isNaN(+timestamp_since_start)) {
         return cb('Must provide a valid timestamp'); 
    }
    let pcryptVersion = version.startsWith('0.45') ? 2 : 3;
    cb(null, pcrypt.encrypt(input, timestamp_since_start, pcryptVersion));
};

/**
 * accepts an input buffer and synchronously returns the corresponding encrypted output
 * @param {Buffer} input - raw bytes to encrypt (typically encoded from a protobuf object)
 * @param {Number} timestamp_since_start - the time since your request started, must match what you're sending in the signture
 * @returns {Buffer} encrypted output
 */
Utils.prototype.encryptSync = function(input, timestamp_since_start) {
    if (isNaN(+timestamp_since_start)) {
        throw new Error("timestamp_since_start required"); 
    }
    
    return pcrypt.encrypt(input, timestamp_since_start);
};

/**
 * Converts the location into a buffer
 */
Utils.prototype.locationToBuffer = function(lat, lng, accuracy) {
    let payload = new Buffer(24);
    payload.writeDoubleBE(lat, 0);
    payload.writeDoubleBE(lng, 8);
    payload.writeDoubleBE(accuracy || 0, 16);
    return payload;
}

/**
 * 
 * ==================================
 *         0.51 and later
 * ==================================
 * 
 */

function doubleToLong(value) {
    var view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value);
    return new long(view.getInt32(4), view.getInt32(0), false).toString();
}

/**
 * hashing function used to generate the full hash, returns raw ready to be put into signature
 * @param {Buffer} authTicket - Buffer containing the protobuf encoded auth_ticket to use for hashing
 * @param {number} latitude - latitude
 * @param {number} longitude - longitude
 * @param {number} accuracy - accuracy
 * @param {long} timestamp - Timestamp since start
 * @param {ByteArray} sessionData - Array of requests in byte format 
 * @param {request[]} requests - requests to hash
 */
Utils.prototype.hashWithServer = function(authTicket, latitude, longitude, accuracy, timestamp, sessionData, requests){
    if(arguments.length !== 7){
        throw new Error(`Missing parameter, expected 7 got ${arguments.length}`);
    }
    
    let requestData = JSON.stringify({
        Timestamp: timestamp,
        Latitude64: 'LatValue',
        Longitude64: 'LngValue',
        Accuracy64: 'AccuracyValue',
        AuthTicket: authTicket.toString("base64"),
        SessionData: sessionData.toString("base64"),
        Requests: requests,
    });

    // dirty hack to be able to send int64 as number in JSON
    requestData = requestData.replace('"LatValue"', doubleToLong(latitude));
    requestData = requestData.replace('"LngValue"', doubleToLong(longitude));
    requestData = requestData.replace('"AccuracyValue"', doubleToLong(accuracy));
    
    return new Promise((resolve, fail) => {
        let url = require('url').parse(this.pokeHashUrl);
        const _http = url.protocol == 'https' ? https : http;

        const req = _http.request({
            host: url.hostname,
            port: url.port,
            method: "POST",
            path: url.path,
            headers: {
                "X-AuthToken": this.pokeHashKey,
                "content-type": "application/json"
            }
        }, (res) => {
            let data = "";
            res.setEncoding("utf-8");
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                this.rateInfos = {
                    authtoken: res.headers['x-authtoken'],
                    maxrequestcount: res.headers['x-maxrequestcount'],
                    ratelimitseconds: res.headers['x-ratelimitseconds'],
                    rateperiodend: res.headers['x-rateperiodend'],
                    raterequestsremaining: res.headers['x-raterequestsremaining'],
                    expiration: res.headers['x-authtokenexpiration'],
                };
                switch(res.statusCode) {
                    case 200:
                        try {
                            let body = data.replace(/(\-?\d{16,})/g, '"$1"');
                            let result = JSON.parse(body);
                            if (!result && !result.locationHash) throw new Error();
                            resolve ({
                                location1: result.locationAuthHash, 
                                location2: result.locationHash, 
                                request_hash: result.requestHashes,
                            });
                        } catch(e) {
                            fail(new errors.HashServerError('Error parsing data', res.statusCode, data));
                        }
                    break;
                    
                    case 400:
                        fail(new errors.HashServerError("Bad request to hashing server", res.statusCode, data));
                    break;
                    
                    case 429:
                        fail(new errors.HashServerError("Request limited", res.statusCode, data));
                    break;
                    
                    case 401:
                        fail(new errors.HashServerError("Invalid key sent to hashing server", res.statusCode, data));
                    break;
                    
                    default:
                        fail(new errors.HashServerError(`Unknown failure ${res.statusCode}`, res.statusCode, data));
                    break;
                }
            })
        });
        req.write(requestData);
        req.end();
    });
}

/**
 * 
 * ==================================
 *              0.45
 * ==================================
 * 
 */

/**
 * hashing function used to generate 'hash_location1' for use in a Signature message
 * @param {Buffer} authTicket - Buffer containing the protobuf encoded auth_ticket to use for hashing
 * @param {number} lat - latitude
 * @param {number} lng - longitude
 * @param {number} [accuracy=0] - accuracy
 * @param {boolean} debug - Should the raw response also be returned (unit tests)
 * @returns {Promise} Promise returned with a successful callback giving the hashed response
 */
Utils.prototype.hashLocation1 = function(authTicket, lat, lng, accuracy, debug) {
    return new Promise((resolve, fail) => {
        /// Ticket first
        const hashTicket = this.hash32(authTicket, SEED).then((hashedTicket) => {
            if(!hashedTicket){
                throw new Error("Unable to hash auth ticket");
            }
            
            /// Then location with ticket as seed
            const payload = this.locationToBuffer(lat, lng, accuracy);
            this.hash32(payload, hashedTicket[0]).then((res) => {
                if(!res){
                    throw new Error("Unable to hash payload and auth ticket");
                }
                
                resolve(debug ? res : res[0]);
            })
        })
    })
};

/**
 * hashing function used to generate 'hash_location2' for use in a Signature message
 * @param {number} lat - latitude
 * @param {number} lng - longitude
 * @param {number} [accuracy=0] - accuracy
 * @param {boolean} debug - Should the raw response also be returned (unit tests)
 * @returns {Promise} Promise returned with a successful callback giving the hashed response
 */
Utils.prototype.hashLocation2 = function(lat, lng, accuracy, debug) {
    return new Promise((resolve, fail) => {
        /// Just location with standard seed into 32
        const payload = this.locationToBuffer(lat, lng, accuracy);
        const hash = this.hash32(payload, SEED).then((res) => {
            if(!res){
                throw new Error("Unable to hash payload");
            }
            
            resolve(debug ? res : res[0]);
        });
    })
};

/**
 * hashing function used to generate 'hash_location2' for use in a Signature message
 * @param {Buffer} authTicket - Buffer containing the protobuf encoded auth_ticket to use for hashing
 * @param {Buffer} request - protobuf encoded rpc request to hash
 * @returns {Object} UINT64 xxhash64 hashed output
 */
Utils.prototype.hashRequest = function(authTicket, request) {
    return new Promise((resolve, fail) => {
        /// Auth ticket becomes seed
        this.hash64(authTicket, SEED).then((seed) => {
            if(!seed){
                throw new Error("Unable to generate hashrequest seed");
            }
            
            /// 6464 the request with seed
            this.hash64salt64(request, seed).then((hash) => {
                if(!hash){
                    throw new Error("Unable to generate hash from 6464");
                }
                
                resolve(hash);
            })
        })
    });
};


/**
 * Connect to your hashing server
 */
Utils.prototype.hash_server = function(message, success, fail) {
    const client = new net.Socket();
    let url = require('url').parse(this.pokeHashUrl);
    client.connect(url.hostname, url.port, () => {
        client.write(message);
    });
    client.on("data", (data) => {
        /// convert the response from int8array to the correct value
        /// this is done using int64 in normal languages
        
        /// These values need to remain unsigned
        
        /// TEST: 0,0,0 should return 0x1d8e0a48f73e90c0
        /// valHI should be 0x1d8e0a48
        /// valLO should be 0xf73e90c0
        
        /// Long seems to mess these values up, so doing manually
        
        let valHI = 0;
        for(let i = 0; i < 4; i++) { 
            valHI = (valHI << 8) >>> 0; 
            valHI = (valHI | (data[7-i] >>> 0) & 0xff) >>> 0;
        }
        
        let valLO = 0; 
        for(let i = 4; i < 8; i++) { 
            valLO = (valLO << 8) >>> 0; 
            valLO = (valLO | (data[7-i] >>> 0) & 0xff) >>> 0; 
        }
        
        success({
            high: valHI,
            low: valLO
        });
        
        client.destroy();
    });
    client.on("error", (e) => {
        console.log("Failed to get response from socket :: " + e.message);
    })
}


/**
 * Local native hashing
 */
Utils.prototype.hash_local = function(message, success, fail){
    const response = native.hash64(message);
    
    if(response){
        success(response);
    } else {
        fail();
    }
}


/**
 * Hash32
 */
Utils.prototype.hash32 = function(buffer, seed) {
    if(!seed){
        throw new Error("No seed provided for hash32");
    }
    
    return new Promise((resolve, fail) => {
        /// pass into 64 to do the hashing
        const res = this.hash64(buffer, seed).then((res) => {
            if(!res){
                throw new Error("Invalid hash returned from hash64");
            }
            
            resolve([(res.low ^ res.high) >>> 0, res]);
        })
    });
}


/**
 * hash64
 */
Utils.prototype.hash64 = function(buffer, seed) {
    if(!seed){
        throw new Error("No seed provided for hash64");
    }
    
    return new Promise((resolve, fail) => {
        const newBuffer = new Buffer(buffer.length + 4);
        newBuffer.writeUInt32BE(seed >>> 0, 0);
        buffer.copy(newBuffer, 4);
        
        /// hash method resolve or fail this
        if(this.hashingServer){
            this.hash_server(newBuffer, resolve, fail);
        } else {
            this.hash_local(newBuffer, resolve, fail);
        }
    });
}


/**
 * Hash64salt64
 */
Utils.prototype.hash64salt64 = function(buffer, seed) {
    return new Promise((resolve, fail) => {
        const newBuffer = new Buffer(buffer.length + 8);
        newBuffer.writeUInt32BE(seed.high >>> 0, 0);
        newBuffer.writeUInt32BE(seed.low >>> 0, 4);
        buffer.copy(newBuffer, 8);
        
        /// hash method resolve or fail this
        if(this.hashingServer){
            this.hash_server(newBuffer, (res) => {
                resolve(res);
            }, fail);
        } else {
            this.hash_local(newBuffer, resolve, fail);
        }
    });
}

module.exports = Utils;