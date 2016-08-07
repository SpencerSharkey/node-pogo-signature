var utils = require('./utils');
var protobuf = require('protobufjs');
var path = require('path');
var crypto = require('crypto');
var longjs = require('long');

var PROTO_Signature = protobuf.loadProtoFile(path.join(__dirname, 'proto', 'Signature.proto')).build().Signature;
var PROTO_u6 = protobuf.loadProtoFile(path.join(__dirname, 'proto', 'Unknown6.proto')).build().Unknown6;

var Signature = function(options) {
    this.initTime = new Date().getTime();
    this.unk22 = crypto.randomBytes(32); // unk22 persists for the app's lifetime
};

Signature.prototype.setLocation = function(lat, lng, alt) {
    if (!alt) alt = 0;
    this.lat = lat;
    this.lng = lng;
    this.alt = alt;
}

Signature.prototype.setAuthTicket = function(authTicket, isEncoded) {
    if (isEncoded) {
        this.authTicket = authTicket;
    } else {
        if (authTicket.encode) {
            this.authTicket = authTicket.encode().toBuffer();
        } else {
            console.error('please pass true as a second parameter to `setAuthTicket` with an encoded authTicket');
        }
    }
}

Signature.prototype.buildSignature = function(requests, retRawBytes) {
    const self = this;

    if (!Array.isArray(requests)) {
        requests = [requests];
    }

    var signature = new PROTO_Signature({
        location_hash1: utils.hashLocation1(this.authTicket, this.lat, this.lng, this.alt).toNumber(),
        location_hash2: utils.hashLocation2(this.lat, this.lng, this.alt).toNumber(),
        unk22: crypto.randomBytes(32),
        timestamp: new Date().getTime(),
        timestamp_since_start: (new Date().getTime() - this.initTime),
    });

    requests.forEach(function(request) {
        var requestBytes = (request.encode) ? request.encode().toBuffer() : request;
        var reqHash = utils.hashRequest(self.authTicket, requestBytes).toString();
        signature.request_hash.push(longjs.fromString(reqHash, true, 10));
    });

    if (retRawBytes) {
        return signature.encode().toBuffer();
    }
    return signature;
}

Signature.prototype.encrypt = function(requests, cb) {
    var signature = this.buildSignature(requests, true);
    utils.encrypt(signature, crypto.randomBytes(32), cb);
}

Signature.prototype.encryptSync = function(requests) {
    var signature = this.buildSignature(requests, true);
    return utils.encryptSync(signature, crypto.randomBytes(32));
}

Signature.prototype.getUnknown6 = function(requests, cb) {
    this.encrypt(requests, function(err, result) {
        if (err) return cb(err);
        cb(null, new PROTO_u6({
            request_type: 6,
            unknown2: new PROTO_u6.Unknown2({
                encrypted_signature: result
            })
        }));
    });
}

module.exports = Signature;
