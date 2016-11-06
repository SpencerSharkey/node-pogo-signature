'use strict';

const net = require("net");
const pcrypt = require("pcrypt");

const SEED = 0x61247FBF; 

/**
 * Enable this if you're offseting to a hashing server
 */
let useHashingServer = false;
let hashingServerIP = null;
let hashingServerPort = null;

/**
 * Should we be using a hashing server to complete the requests
 */
module.exports.enableHashingServer = function(ip, port) {
    if(!port){
        port = 80;
    }
    
    hashingServerIP = ip;
    hashingServerPort = port;
    useHashingServer = true;
    
    console.log(`Hashing server enabled on ${ip}:${port}`);
}

/**
 * accepts an input buffer and returns the corresponding encrypted output
 * @param {Buffer} input - raw bytes to encrypt (typically encoded from a protobuf object)
 * @param {Number} timestamp_since_start - the time since your request started, must match what you're sending in the signture
 * @param {encryptCallback} cb - function to be called when encryption is completed
 */
module.exports.encrypt = function(input, timestamp_since_start, cb) {
    if (isNaN(+timestamp_since_start)) {
         return cb('Must provide a valid timestamp'); 
    }
    
    cb(null, pcrypt.encrypt(input, timestamp_since_start));
};

/**
 * accepts an input buffer and synchronously returns the corresponding encrypted output
 * @param {Buffer} input - raw bytes to encrypt (typically encoded from a protobuf object)
 * @param {Number} timestamp_since_start - the time since your request started, must match what you're sending in the signture
 * @returns {Buffer} encrypted output
 */
module.exports.encryptSync = function(input, timestamp_since_start) {
    if (isNaN(+timestamp_since_start)) {
        throw new Error("timestamp_since_start required"); 
    }
    
    return pcrypt.encrypt(input, timestamp_since_start);
};

function locationToBuffer(lat, lng, alt) {
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
 * @param {boolean} debug - Should the raw response also be returned (unit tests)
 * @returns {Promise} Promise returned with a successful callback giving the hashed response
 */
module.exports.hashLocation1 = function(authTicket, lat, lng, alt, debug) {
    return new Promise((resolve, fail) => {
        /// Ticket first
        const hashTicket = hash32(authTicket, SEED).then((hashedTicket) => {
            if(!hashedTicket){
                throw new Error("Unable to hash auth ticket");
            }
            
            /// Then location with ticket as seed
            const payload = locationToBuffer(lat, lng, alt);
            hash32(payload, hashedTicket[0]).then((res) => {
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
module.exports.hashLocation2 = function(lat, lng, alt, debug) {
    return new Promise((resolve, fail) => {
        /// Just location with standard seed into 32
        const payload = locationToBuffer(lat, lng, alt);
        const hash = hash32(payload, SEED).then((res) => {
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
module.exports.hashRequest = function(authTicket, request) {
    return new Promise((resolve, fail) => {
        /// Auth ticket becomes seed
        hash64(authTicket, SEED).then((seed) => {
            if(!seed){
                throw new Error("Unable to generate hashrequest seed");
            }
            
            /// 6464 the request with seed
            hash64salt64(request, seed).then((hash) => {
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
function hash_server(message, success, fail) {
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
    client.on("error", () => {
        console.log("Failed to get response from socket");
    })
}


/**
 * Local native hashing
 */
function hash_local(message, success, fail){
    /// WIP
    console.log("WIP");
}


/**
 * Hash32
 */
function hash32(buffer, seed) {
    if(!seed){
        throw new Error("No seed provided for hash32!");
    }
    
    return new Promise((resolve, fail) => {
        /// pass into 64 to do the hashing
        const res = hash64(buffer, seed).then((res) => {
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
function hash64(buffer, seed) {
    if(!seed){
        throw new Error("No seed provided for hash64!");
    }
    
    return new Promise((resolve, fail) => {
        const newBuffer = new Buffer(buffer.length + 4);
        newBuffer.writeUInt32BE(seed, 0);
        buffer.copy(newBuffer, 4);
        
        /// hash method resolve or fail this
        if(useHashingServer){
            hash_server(newBuffer, resolve, fail);
        } else {
            hash_local(newBuffer, resolve, fail);
        }
    });
}


/**
 * Hash64salt64
 */
function hash64salt64(buffer, seed) {
    return new Promise((resolve, fail) => {
        const newBuffer = new Buffer(buffer.length + 8);
        newBuffer.writeUInt32BE(seed.high, 0);
        newBuffer.writeUInt32BE(seed.low, 4);
        buffer.copy(newBuffer, 8);
        
        /// hash method resolve or fail this
        if(useHashingServer){
            hash_server(newBuffer, (res) => {
                resolve(res);
            }, fail);
        } else {
            hash_local(newBuffer, resolve, fail);
        }
    });
}