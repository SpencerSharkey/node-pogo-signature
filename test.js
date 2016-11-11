var index = require("./index.js");
var assert = require("assert");

/// SET YOUR HASHING SERVER
index.utils.useHashingServer("YOUR_SERVER_IP", 1501);

/// Simple test to ensure that responses are correct from each value

index.utils.hashLocation2(0,0,0,true).then((res) => {
    const debug_payload = res[1];
    res = res[0];
    console.log(`0,0,0 = ${res} | hi: ${debug_payload.high.toString(16)} lo: ${debug_payload.low.toString(16)} | 0x${debug_payload.high.toString(16)}${debug_payload.low.toString(16)}`);
    assert(res === 413437985);
});

index.utils.hashLocation2(50,10,20,true).then((res) => {
    const debug_payload = res[1];
    res = res[0];
    console.log(`50,10,20 = ${res} | hi: ${debug_payload.high.toString(16)} lo: ${debug_payload.low.toString(16)} | 0x${debug_payload.high.toString(16)}${debug_payload.low.toString(16)}`);
    assert(res === 1533251323);
});

index.utils.hashLocation2(53,18,25,true).then((res) => {
    const debug_payload = res[1];
    res = res[0];
    console.log(`53,18,25 = ${res} | hi: ${debug_payload.high.toString(16)} lo: ${debug_payload.low.toString(16)} | 0x${debug_payload.high.toString(16)}${debug_payload.low.toString(16)}`);
    assert(res === 336542163);
});

index.utils.hashLocation2(55,22,18,true).then((res) => {
    const debug_payload = res[1];
    res = res[0];
    console.log(`55,22,18 = ${res} | hi: ${debug_payload.high.toString(16)} lo: ${debug_payload.low.toString(16)} | 0x${debug_payload.high.toString(16)}${debug_payload.low.toString(16)}`);
    assert(res === 1970450721);
});

index.utils.hashLocation2(42,-18,11,true).then((res) => {
    const debug_payload = res[1];
    res = res[0];
    console.log(`42,-18,11 = ${res} | hi: ${debug_payload.high.toString(16)} lo: ${debug_payload.low.toString(16)} | 0x${debug_payload.high.toString(16)}${debug_payload.low.toString(16)}`);
    assert(res === 1477657678);
});

const test = new Buffer(24);
for(let i = 0; i < 24; i++) {
    test[i] = 0;
};

index.utils.hashLocation1(test, 0, 0, 0, true).then((res) => {
    const debug_payload = res[1];
    res = res[0];
    console.log(`all 0 = ${res} | hi: ${debug_payload.high.toString(16)} lo: ${debug_payload.low.toString(16)} | 0x${debug_payload.high.toString(16)}${debug_payload.low.toString(16)}`);
    assert(res === 2756660921);
});

const bytes = new Buffer(32);
for(let i = 0; i < bytes.length; i++) {
    bytes[i] = i;
};

const builder = new index.Builder({unk22: bytes, time_since_start: 500, time: 1478434897578 });
builder.setAuthTicket(test, true);
builder.setLocation(0,0,0);
builder.encrypt([test], (err, encryptedSig) => {
    console.log("Builder response " + encryptedSig.toString("hex"));
    assert(encryptedSig.toString("hex") === "000001f47248f3056bc3458ffd082194926e7edd852df7e5705647f45b1d47551812dbd06d12bf91a82bc873e2fadd44445ff560a79ac498bd550aa3c473db12b5483225aa5e82d8e01de0fd7b26154c229de9296de9aee92aff20b81db87dbc2acba36c1628f9280b811e5404f06b8e5a15f3bfae9220f11dc9c74d51d62b20fc792dde61a9ed09ae785e50a470e34722771df222fb10445f8efef25ae2556e9e1713c2648c1211d036ce5040a0d89ad9cf86168c173b1b5e03542dc2806929e0450444b163c8027e99e35b78c30f3be31621ae59e75afe544a7e147e229f7ea89daf044a4826aaaaaea64c57065f552e315e566e0e8a3822ed62cf43e96078f8c009029a");
});