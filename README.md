## node-pogo-signature
signature (aka "unknown6") protobuf builder + encryption for node

currently implemented + working in:
* https://github.com/cyraxx/pogobuf ( :sparkles: `npm install pogobuf` )
* https://github.com/Armax/Pokemon-GO-node-api ( `npm install pokemon-go-node-api` )

## use either a hashing server, or native
```javascript
/// Use hashing
utils.useHashingServer("your ip", 1500);
builder.useHashingServer("your ip", 1500);
/// Do not call this to use native
```

## encrypt usage
```javascript
module.encrypt(<Buffer> input, <Number> timestamp_since_start, <function> callback)
// or
module.encryptSync(<Buffer> input, <Number> timestamp_since_start)
```

## one-step encrypt usage
If you just want to get stuck in and not worry about setting up your signature, you can use the builder to create everything for you
```javascript
const builder = new Builder();
builder.setAuthTicket(/* YOUR AUTH TICKET */, true /* true if you've already done encoding */);
builder.setLocation(0,0,0); /* Your location */
builder.encrypt([/* Array of requests */], (err, encryptedSig) => {
    console.log("Builder response " + encryptedSig.toString("hex"));
	/// You can now create the final part of your protobuf
	f_req.unknown6 = new RequestEnvelop.Unknown6({
		unknown1: 6,
		unknown2: new RequestEnvelop.Unknown6.Unknown2({
			unknown1: encryptedSig
		})
	});
});

/* Working example with assertion */
const test = new Buffer(24);
for(let i = 0; i < 24; i++) {
    test[i] = 0;
};

const bytes = new Buffer(32);
for(let i = 0; i < bytes.length; i++) {
    bytes[i] = i;
};

const builder = new index.Builder({unk22: bytes, time_since_start: 500, time: 1478434897578 });
builder.setAuthTicket(test, true);
builder.setLocation(0,0,0);
builder.encrypt([test], (err, encryptedSig) => {
    console.log("Builder response " + encryptedSig.toString("hex"));
    assert(encryptedSig.toString("hex") === "000001f4f709274ec09e849273e90957837ee4d0a06dbb6af9aae307535e94af95dfee5153b3664b8339334564e4fd6fcf7acbb599ddcaa29babaa8de7627161014507750ca57b897d07de8b780e555304cce4fa61e54d6ca3a6ef39317af0c611013cdc10f93ed1aeabbaad39682cf57b9c0146ba29424c11bc26cce0778bcdef50aa3e44599b2c20987d23b405e12d04e4b553026d1b3fd9e39d99c86716af880c6db557c1e85ed9db13fe71522da7f3bc2b9d8b0a0a39654e90d667de464a4fd07bca9aca910ac7b88e946d05db38d6276161dbbd8d6358fc9401cf2de012208a0ff6fa7d59f2095538cde6903576163d5ff57d95f441811bebd84cf0daa45d4402319a");
});
```

##### Info:

simply passes `input` and `timestamp_since_start` through the encrypt method found in the native module.
returns (or via callback for async method) the raw encrypted bytes.

##### Arguments:
* **`input`** _(Buffer)_: a protobuf-encoded signature message to encrypt
* **`timestamp_since_start`** _(Number)_: The timestamp since your first request
* **`cb(err, encryptedSignature)`** _(Func)_: a callback function to execute when encryption by the module has been completed. success when `err` is null. `encryptedSignature` is a buffer containing the encrypted information.

### basic example
the following will read an input buffer read directly from a file, in the real world this will most likely come from an encoded protobuf structure you generated with your api requests.
```javascript
var crypto = require('crypto');
var pogoSignature = require('node-pogo-signature');

var dump = fs.readFileSync('./signatureBinary.bin');
var time_since = 500;

var encryptedSignature = pogoSignature.encryptSync(dump, time_since);
console.log('sync output length: ', encryptedsignature.length);

// or, async w/ a callback

pogoSignature.encrypt(dump, time_since, function(err, result) {
	if (err) return console.error(err);

	console.log('output length: ', result.length)
});
```

## notes

* contribute whatever you can
* credit for original `encrypt.c` goes to friends @ [/r/pkmngodev](https://github.com/pkmngodev/Unknown6) (repo is gone)
