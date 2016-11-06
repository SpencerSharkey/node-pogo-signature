var index = require("./index.js");
var assert = require("assert");

/// SET YOUR HASHING SERVER
// index.utils.useHashingServer("your ip", 1500);

/// Simple test to ensure that responses are correct from each value

index.utils.hashLocation2(0,0,0,true).then((res) => {
    const debug_payload = res[1];
    res = res[0];
    console.log(`0,0,0 = ${res} | hi: ${debug_payload.high.toString(16)} lo: ${debug_payload.low.toString(16)} | 0x${debug_payload.high.toString(16)}${debug_payload.low.toString(16)}`);
    assert(res === 3937442440);
});

index.utils.hashLocation2(50,10,20,true).then((res) => {
    const debug_payload = res[1];
    res = res[0];
    console.log(`50,10,20 = ${res} | hi: ${debug_payload.high.toString(16)} lo: ${debug_payload.low.toString(16)} | 0x${debug_payload.high.toString(16)}${debug_payload.low.toString(16)}`);
    assert(res === 1063829902);
});

index.utils.hashLocation2(53,18,25,true).then((res) => {
    const debug_payload = res[1];
    res = res[0];
    console.log(`53,18,25 = ${res} | hi: ${debug_payload.high.toString(16)} lo: ${debug_payload.low.toString(16)} | 0x${debug_payload.high.toString(16)}${debug_payload.low.toString(16)}`);
    assert(res === 1362775368);
});

index.utils.hashLocation2(55,22,18,true).then((res) => {
    const debug_payload = res[1];
    res = res[0];
    console.log(`55,22,18 = ${res} | hi: ${debug_payload.high.toString(16)} lo: ${debug_payload.low.toString(16)} | 0x${debug_payload.high.toString(16)}${debug_payload.low.toString(16)}`);
    assert(res === 4126390853);
});

index.utils.hashLocation2(42,-18,11,true).then((res) => {
    const debug_payload = res[1];
    res = res[0];
    console.log(`42,-18,11 = ${res} | hi: ${debug_payload.high.toString(16)} lo: ${debug_payload.low.toString(16)} | 0x${debug_payload.high.toString(16)}${debug_payload.low.toString(16)}`);
    assert(res === 1567044474);
});

const test = new Buffer(24);
for(let i = 0; i < 24; i++) {
    test[i] = 0;
};

index.utils.hashLocation1(test, 0, 0, 0, true).then((res) => {
    const debug_payload = res[1];
    res = res[0];
    console.log(`all 0 = ${res} | hi: ${debug_payload.high.toString(16)} lo: ${debug_payload.low.toString(16)} | 0x${debug_payload.high.toString(16)}${debug_payload.low.toString(16)}`);
    assert(res === 1345880194);
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
    assert(encryptedSig.toString("hex") === "000001f4f709274ec09e849273e90957837ee4d0a06dbb6af9aae307535e94af95dfee5153b3664b8339334564e4fd6fcf7acbb599ddcaa29babaa8de7627161014507750ca57b897d07de8b780e555304cce4fa61e54d6ca3a6ef39317af0c611013cdc10f93ed1aeabbaad39682cf57b9c0146ba29424c11bc26cce0778bcdef50aa3e44599b2c20987d23b405e12d04e4b553026d1b3fd9e39d99c86716af880c6db557c1e85ed9db13fe71522da7f3bc2b9d8b0a0a39654e90d667de464a4fd07bca9aca910ac7b88e946d05db38d6276161dbbd8d6358fc9401cf2de012208a0ff6fa7d59f2095538cde6903576163d5ff57d95f441811bebd84cf0daa45d4402319a");
});