var xxhash = require('xxhashjs'),
    xxh32 = xxhash.h32,
    xxh64 = xxhash.h64;

var locationToBuffer = function(lat, lng, alt) {
    var payload = new Buffer(24);
    payload.writeDoubleBE(lat, 0);
    payload.writeDoubleBE(lng, 8);
    payload.writeDoubleBE(alt || 0, 16);
    return payload;
}

module.exports.hashLocation1 = function(authTicket, lat, lng, alt) {
    var seed = xxh32(authTicket, 0x1B845238);
    var payload = locationToBuffer(lat, lng, alt);
    return xxh32(payload, seed);
};

module.exports.hashLocation2 = function(lat, lng, alt) {
    if (!alt) alt = 0x00;
    var payload = locationToBuffer(lat, lng, alt);
    return xxh32(payload, 0x1B845238);
};

module.exports.hashRequest = function(authTicket, request) {
    var seed = xxh64(authTicket, 0x1B845238);
    return xxh64(request, seed);
};
