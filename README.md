## node-pogo-signature
signature (aka "unknown6") protobuf builder + encryption for node

currently implemented + working in:
* https://github.com/cyraxx/pogobuf ( :sparkles: `npm install pogobuf` )
* https://github.com/Armax/Pokemon-GO-node-api ( `npm install pokemon-go-node-api` )

## 0.51 (current)
As of 0.51 native hashing is currently not supported. This library allows both 0.45 and 0.51. 

#### Upgrading to 0.51
If you already have a working 0.45 implementation, the only changes that you need to make are the below

```javascript
builder.version = "0.51";
builder.useHashingServer("hashing.pogodev.io", 80, "YOUR_KEY", "122");
```

#### Full working example
This example uses hardcoded buffers. In a real scenario, you would pass your AuthToken and a list of requests. These can be passed in as encoded protocol's or in their unencoded format.
```javascript
/// ==============================
/// 0.51 API
/// ==============================

/// Your auth ticket
const test = new Buffer(24);
for(let i = 0; i < 24; i++) {
    test[i] = 0;
};

/// Fake request
const test2 = new Buffer(24);
for(let i = 0; i < 24; i++) {
    test2[i] = 1;
};

/// Fake request #2
const test3 = new Buffer(24);
for(let i = 0; i < 24; i++) {
    test3[i] = 2;
};

/// "Unknown22"
const bytes = new Buffer(32);
for(let i = 0; i < bytes.length; i++) {
    bytes[i] = i;
};

const builder = new index.Builder({unk22: bytes, time_since_start: 500, time: 1478434897578 });
builder.version = "0.51";
builder.useHashingServer("hashing.pogodev.io", 80, "YOUR_KEY", "122");
builder.setAuthTicket(test, true);
builder.setLocation(0,0,0);
builder.encrypt([test, test2, test3], (err, encryptedSig) => {
    console.log("Builder response " + encryptedSig.toString("hex"));
    assert(encryptedSig.toString("hex") === "000001f4383d7db58229f72dc0c942eddb3c1cad4c80ef4c1c069bb0154d4f16726c5bb11d3587911fab3ce02aa431e4c3a808751503549b80d6e7e51dc17a7ae71e14f7e0a3af491b200dd94e2f777ce009809aeaa0c25c0e0a761768b2d8a0ab38ac7ec725a095b3bf9ff664251c590d62e457683019fbd975482e55cfe02a99a52bd4a8dabd861d6398b3567e1557663d2f74e85fc61f1b29e33bf98174e24b03f18a76c6e01b4e2b39234c8d151dde8900b144fe557d45fb8b9b5d6126a1150a0eee2e6951faf8f349787ed50121becd65c7cbc7ad85fd0191e25241892e2337631f314c691c37d3661b95f49cc8501b3f766bd480aea58a499c3e9cd109c5aae2569a");
});
```

## 0.45 (old, unsafe)
The below is for 0.45, which is native (or hash server) hashing. It is no longer considered safe.

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
