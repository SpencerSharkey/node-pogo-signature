'use strict';

const net = require("net");
const pcrypt = require("pcrypt");
const native = require("./U6Encrypt");
const http = require("http");
const https = require("https");

const SEED = 0x46e945f8; 

const Utils = function(){};

/**
 * Enable this if you're offseting to a hashing server
 */
Utils.prototype.hashingServer = false;
Utils.prototype.hashingServerIP = null;
Utils.prototype.hashingServerPort = null;

/**
 * If we're using the Pokehash server, which are we using
 */
Utils.prototype.pokeHashVersion = null;
Utils.prototype.pokeHashKey = null;

/**
 * Should we be using a hashing server to complete the requests
 */
Utils.prototype.useHashingServer = function(ip, port, pokeHashKey, pokeHashVersion) {
    if(!port){
        port = 80;
    }
    
    this.hashingServerIP = ip;
    this.hashingServerPort = port;
    this.hashingServer = true;
    this.pokeHashKey = pokeHashKey;
    this.pokeHashVersion = pokeHashVersion;
    
    console.log(`Requests using hashing server on ${this.hashingServerIP}:${this.hashingServerPort}/api/v${this.pokeHashVersion}/hash`);
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
    
    cb(null, pcrypt.encrypt(input, timestamp_since_start, version));
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
Utils.prototype.locationToBuffer = function(lat, lng, alt) {
    let payload = new Buffer(24);
    payload.writeDoubleBE(lat, 0);
    payload.writeDoubleBE(lng, 8);
    payload.writeDoubleBE(alt || 0, 16);
    return payload;
}

/**
 * 
 * ==================================
 *              0.51
 * ==================================
 * 
 */

/**
 * hashing function used to generate the full hash, returns raw ready to be put into signature
 * @param {Buffer} authTicket - Buffer containing the protobuf encoded auth_ticket to use for hashing
 * @param {number} lat - latitude
 * @param {number} lng - longitude
 * @param {long} timestamp - Timestamp since start
 * @param {ByteArray} sessionData - Array of requests in byte format 
 */
Utils.prototype.hashFiftyOne = function(authTicket, latitude, longitude, altitude, timestamp, sessionData, requests){
    if(arguments.length !== 7){
        throw new Error(`Missing parameter, expected 6 got ${arguments.length}`);
    }
    
    const requestData = JSON.stringify({
        Timestamp: timestamp,
        Latitude: latitude,
        Longitude: longitude,
        Altitude: altitude,
        AuthTicket: authTicket.toString("base64"),
        SessionData: sessionData.toString("base64"),
        Requests: requests
    });
    
    return new Promise((resolve, fail) => {
        const _http = this.hashingServerPort === 443 ? https : http;
        
        const req = _http.request({
            host: this.hashingServerIP,
            port: this.hashingServerPort,
            method: "POST",
            path: `/api/v${this.pokeHashVersion}/hash`,
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
                switch(res.statusCode) {
                    case 200:
                        /// JSON return is int64, which JS can't handle
                        /// Raised in re-private, won't be changed, need to ensure format doesn't change
                        let result = /(?:(?:"requestHashes"\:\[)((-?\d+,?)+))/g.exec(data);
                        if(!result){
                            return fail("Request failed, missing requestHashes");
                        }
                        
                        const res = JSON.parse(data);
                        resolve({location1: res.locationAuthHash, location2: res.locationHash, request_hash: result[1].split(",")});
                    break;
                    
                    case 400:
                        return fail("Bad request to hashing server");
                    break;
                    
                    case 429:
                        return fail("Request limited, exceeded requests per minute");
                    break;
                    
                    case 401:
                        return fail("Invalid key sent to hashing server");
                    break;
                    
                    default:
                        return fail("Unknown failure");
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
 * @param {number} [alt=0] - altitude
 * @param {boolean} debug - Should the raw response also be returned (unit tests)
 * @returns {Promise} Promise returned with a successful callback giving the hashed response
 */
Utils.prototype.hashLocation1 = function(authTicket, lat, lng, alt, debug) {
    return new Promise((resolve, fail) => {
        /// Ticket first
        const hashTicket = this.hash32(authTicket, SEED).then((hashedTicket) => {
            if(!hashedTicket){
                throw new Error("Unable to hash auth ticket");
            }
            
            /// Then location with ticket as seed
            const payload = this.locationToBuffer(lat, lng, alt);
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
 * @param {number} [alt=0] - altitude
 * @param {boolean} debug - Should the raw response also be returned (unit tests)
 * @returns {Promise} Promise returned with a successful callback giving the hashed response
 */
Utils.prototype.hashLocation2 = function(lat, lng, alt, debug) {
    return new Promise((resolve, fail) => {
        /// Just location with standard seed into 32
        const payload = this.locationToBuffer(lat, lng, alt);
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
    client.connect(hashingServerPort, hashingServerIP, () => {
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