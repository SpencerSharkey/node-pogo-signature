let Long = require('long');

class Long128 {
	constructor(lo, hi) {
		this.lo = lo;
		this.hi = hi;
	}

	static mul64(left, right) {
		let u1 = new Long(left.low, 0, true);
		let v1 = right.low >>> 0;
		let t = u1.mul(v1);
		let w3 = t.low >>> 0;
		let k = t.high >>> 0;

		let u = new Long(left.high, 0, true);
		t = u.mul(v1).add(k);
		k = t.low >>> 0;
		let w1 = new Long(t.high, 0, true);

		let v = right.high >>> 0;
		t = u1.mul(v).add(k);
		k = t.high >>> 0;

		return new Long128(
			new Long(0, t.low, true).add(w3),
			u.mul(v).add(w1).add(k)
		);
	}

	add(that) {
		let sum = new Long128(this.lo.add(that.lo), this.hi.add(that.hi));
		if (sum.lo.comp(that.lo) < 0) {
			sum.hi = sum.hi.add(1);
		}
		return sum;
	}

	and(that) {
		return new Long128(this.lo.and(that.lo), this.hi.and(that.hi));
	}

	comp(that) {
		let tmp = this.hi.comp(that.hi);
		if (tmp === 0) {
			return this.lo.comp(that.lo);
		} else {
			return tmp;
		}
	}
}

// iOS 1.13.x
let magicTable = [
	'95c05f4d1512959e', 'e4f3c46eef0dcf07',
	'6238dc228f980ad2', '53f3e3bc49607092',
	'4e7be7069078d625', '1016d709d1ad25fc',
	'044e89b8ac76e045', 'e0b684dda364bfa1',
	'90c533b835e89e5f', '3daf462a74fa874f',
	'fea54965dd3ef5a0', '287a5d7ccb31b970',
	'ae681046800752f8', '121c2d6eaf66ec6e',
	'ee8f8ca7e090fb20', 'ce1ae25f48fe0a52',
].map(hex => Long.fromString(hex, true, 16));
let magicRound = new Long128(Long.fromString('14c983660183c0ae', true, 16), Long.fromString('78f32468cd48d6de', true, 16));
let magicFinal = new Long128(Long.fromString('5b7e9e828a9b8abd', true, 16), Long.fromString('bdb31b10864f3f87', true, 16));

// Various constants
let kBlockSize = 128;
let u7fff = new Long128(Long.fromString('ffffffffffffffff', true, 16), Long.fromString('7fffffffffffffff', true, 16));
let u3fff = new Long128(Long.fromString('ffffffffffffffff', true, 16), Long.fromString('3fffffffffffffff', true, 16));
let fffffffffffffefe = Long.fromString('fffffffffffffefe', true, 16);

function hash64(input) {
	let numChunks = Math.floor(input.length / kBlockSize);

	// Copy tail, pad with zeroes to multiple of 16
	let tailLen = input.length % kBlockSize;
	let tail = new Buffer(16 * Math.ceil(tailLen / 16));
	input.copy(tail, 0, input.length - tailLen);
	tail.fill(0, tailLen);

	let hash;
	if (numChunks > 0) {
		// Hash the first 128 bytes
		hash = hashChunk(input.slice(0, kBlockSize));
	} else {
		// Hash the tail
		hash = hashChunk(tail);
	}
	hash = hash.add(magicRound);

	if (numChunks > 0) {
		for (let offset = kBlockSize; offset <= input.length - kBlockSize; offset += kBlockSize) {
			hash = hashMulAdd(hash, magicRound, hashChunk(input.slice(offset, offset + kBlockSize)));
		}
		if (tailLen > 0) {
			hash = hashMulAdd(hash, magicRound, hashChunk(tail));
		}
	}

	// Finalize the hash
	hash = hash.add(new Long128(new Long(0, 0, true), new Long(tailLen * 8, 0, true)));
	if (hash.comp(u7fff) >= 0) {
		hash = hash.add(new Long128(new Long(1, 0, true), new Long(0, 0, true)));
	}
	hash = hash.and(u7fff);

	let X = hash.hi.add(hash.lo.high >>> 0);
	X = hash.hi.add(X.add(X.high >>> 0).add(1).high >>> 0);
	let Y = X.shiftLeft(32).add(hash.lo);

	let A = X.add(magicFinal.hi);
	if (A.comp(X) < 0) {
		A = A.add(0x101);
	}

	let B = Y.add(magicFinal.lo);
	if (B.comp(Y) < 0) {
		B = B.add(0x101);
	}

	hash = Long128.mul64(A, B);
	hash = Long128.mul64(hash.hi, new Long(0x101, 0, true)).add(new Long128(hash.lo, new Long(0)));
	hash = Long128.mul64(hash.hi, new Long(0x101, 0, true)).add(new Long128(hash.lo, new Long(0)));
	
	let result = hash.lo;
	if (hash.hi.comp(0) !== 0) {
		result = result.add(0x101);
	}
	if (result.comp(fffffffffffffefe) > 0) {
		result = result.add(0x101);
	}
	return result;
}

function hash32(input) {
	let result = hash64(input);
	return (result.low ^ result.high) >>> 0;
}

function hashChunk(chunk) {
	let hash = new Long128(new Long(0, 0, true), new Long(0, 0, true));
	for (let ii = 0, jj = 0; ii < chunk.length; ii += 16, jj += 2) {
		let a = new Long(chunk.readInt32LE(ii), chunk.readInt32LE(ii + 4), true);
		let b = new Long(chunk.readInt32LE(ii + 8), chunk.readInt32LE(ii + 12), true);
		hash = hash.add(Long128.mul64(
			a.add(magicTable[jj]),
			b.add(magicTable[jj + 1])
		));
	}
	return hash.and(u3fff);
}

function hashMulAdd(hash, mul, add) {
	let m0 = mul.lo.low >>> 0;
	let m1 = mul.lo.high >>> 0;
	let m2 = mul.hi.low >>> 0;
	let m3 = mul.hi.high >>> 0;

	let h0 = new Long(hash.lo.low, 0, true);
	let h1 = new Long(hash.lo.high, 0, true);
	let h2 = new Long(hash.hi.low, 0, true);
	let h3 = new Long(hash.hi.high, 0, true);

	let c0 = h0.mul(m0);
	let c1 = h0.mul(m1).add(h1.mul(m0));
	let c2 = h0.mul(m2).add(h1.mul(m1)).add(h2.mul(m0));
	let c3 = h0.mul(m3).add(h1.mul(m2)).add(h2.mul(m1)).add(h3.mul(m0));
	let c4 = h1.mul(m3).add(h2.mul(m2)).add(h3.mul(m1));
	let c5 = h2.mul(m3).add(h3.mul(m2));
	let c6 = h3.mul(m3);

	let r2 = c2.add(c6.shiftLeft(1)).add(add.hi);
	let r3 = c3.add(r2.high >>> 0);
	let r0 = c0.add(c4.shiftLeft(1)).add(add.lo.low >>> 0).add(r3.shiftRightUnsigned(31));
	let r1 = c1.add(c5.shiftLeft(1)).add(add.lo.high >>> 0).add(r0.high >>> 0);

	return new Long128(
		new Long(r0.low, r1.low, true),
		new Long(r2.low, r3.low & 0x7fffffff, true).add(r1.high >>> 0)
	);
}

function salt32(payload, salt) {
	let buf = new Buffer(payload.length + 4);
	buf.writeUInt32BE(salt >>> 0, 0);
	payload.copy(buf, 4);
	return buf;
}

function salt64(payload, salt) {
	let buf = new Buffer(payload.length + 8);
	buf.writeUInt32BE(salt.high >>> 0, 0);
	buf.writeUInt32BE(salt.low >>> 0, 4);
	payload.copy(buf, 8);
	return buf;
}

module.exports = { hash32, hash64, salt32, salt64 };