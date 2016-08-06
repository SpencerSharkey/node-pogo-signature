var enctypex = require('./');
var fs = require('fs');

console.log('--- i know this is not a real test ---');

var raw = fs.readFileSync('C:/dump1.bin');
var encrypted = fs.readFileSync('C:/dump1_encrypted.bin');
var iv = encrypted.slice(0, 32);

console.log('unencrypted len:', raw.length);
console.log('encrypted len:', encrypted.length)

console.log('iv:', iv.toString('hex'));
console.log('iv Length: ', iv.length);

var expectedLength = raw.length + (256 - (raw.length % 256)) + 32;
console.log('expected output len: ', expectedLength);

enctypex.encrypt(raw, iv, function(err, result) {
    if (err) {
        console.log('reached an error');
        return console.log(err);
    }

    console.log('output len: ', result.length)
    console.log('output iv: ', result.slice(0, 32).toString('hex'));

    if (result.compare(encrypted) === 0) {
        console.log('pass!')
    } else {
        console.log('no');
    }

});
