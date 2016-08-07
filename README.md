## node-pogo-signature
signature (aka "unknown6") encryption bindings for node

may include some signature building utils soon

currently implemented + working in:
* https://github.com/Armax/Pokemon-GO-node-api

# todo
* look into native js implementation of encrypt.c (in progress)
* start writing signature builder (in progress)
* submit PRs to node apis with signature patches (1 down)

### install
on `npm install` the module will self-build. the c/c++ code is located within the _/src_ directory.

you may require the [node-gyp](https://github.com/nodejs/node-gyp) package installed globally to build:

`npm install node-gyp -g`

## usage
```javascript
module.encrypt(<Buffer> input, <Buffer> iv, <function> callback)
```
##### Info:

simply passes `input` and `iv` through the encrypt method found in the native module.

the callback's `err` is truthy when input validation occurs _(note: `iv` must be 32 bytes long)_

##### Arguments:
* **`input`** _(Buffer)_: a protobuf-encoded signature message to encrypt
* **`initVector`** _(Buffer)_: a 32-byte random initialization vector to encrypt the data against
* **`cb(err, encryptedSignature)`** _(Func)_: a callback function to execute when encryption by the moldue has been completed. success when `err` is null. `encryptedSignature` is a buffer containing the encrypted information.

### example
the following will read an input buffer read directly from a file, in the real world this will most likely come from an encoded protobuf structure you generated with your api requests.
```javascript
var pogoSignature = require('node-pogo-signature');

var dump = fs.readFileSync('./signatureBinary.bin');
var iv = crypto.randomBytes(32);


pogoSignature.encrypt(dump, iv, function(err, result) {
	if (err) return console.error(err);

	console.log('output length: ', result.length)
    console.log('output iv: ', result.slice(0, 32).toString('hex'));
});
```

## notes

* contribute whatever you can
* credit for `encrypt.c` goes to friends @ [/r/pkmngodev](https://github.com/pkmngodev/Unknown6) (repo is gone)
