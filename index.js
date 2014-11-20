var Chacha20 = require('./chacha20');
var Transform = require('readable-stream').Transform;
var inherits = require('inherits');
var Poly1305 = require('./poly1305');
exports.createCipher = createCipher;
function createCipher(key, iv) {
  return new Cipher(key, iv);
}
exports.createDecipher = createDecipher;
function createDecipher(key, iv) {
  return new Cipher(key, iv, true);
}
exports.createHmac = PolyStream;
exports.chacha20 = exports.ChaCha20 = ChaChaStream;
inherits(CipherBase, Transform);
function CipherBase() {
  Transform.call(this);
}
CipherBase.prototype.update = function (data, inputEnd, outputEnc) {
  this.write(data, inputEnd);
  var outData = new Buffer('');
  var chunk;
  while ((chunk = this.read())) {
    outData = Buffer.concat([outData, chunk]);
  }
  if (outputEnc) {
    outData = outData.toString(outputEnc);
  }
  return outData;
};
CipherBase.prototype.final = function (outputEnc) {
  this.end();
  var outData = new Buffer('');
  var chunk;
  while ((chunk = this.read())) {
    outData = Buffer.concat([outData, chunk]);
  }
  if (outputEnc) {
    outData = outData.toString(outputEnc);
  }
  return outData;
};
inherits(Cipher, CipherBase);
function Cipher(key, iv, decrypt){
  if (!(this instanceof Cipher)) {
    return new Cipher(key, iv, decrypt);
  }
  CipherBase.call(this);
  this.alen = 0;
  this.clen = 0;
  this.chacha = new Chacha20(key, iv);
  this.poly = new Poly1305(this.chacha.getBytes(64));
  this.tag = null;
  this._decrypt = decrypt;
}
Cipher.prototype.setAAD = function (aad) {
  if (this.alen || this.clen) {
    throw new Error('Attempting to set AAD in unsupported state');
  }
  this.alen = aad.length;
  this.poly.update(aad);
  var padding = new Buffer(padAmount(this.alen));
  if (padding.length) {
    padding.fill(0);
    this.poly.update(padding);
  }
};
Cipher.prototype._transform = function (chunk, _, next) {
  var len = chunk.length;
  if (!len) {
    return next();
  }
  this.clen += len;
  var pad = this.chacha.getBytes(len);
  var i = -1;
  while (++i < len) {
    pad[i] ^= chunk[i];
  }
  if (this._decrypt) {
    this.poly.update(chunk);
  } else {
    this.poly.update(pad);
  }
  this.push(pad);
  next();
};
Cipher.prototype._flush = function (next) {
  if (this._decrypt && !this.tag) {
    throw new Error('Unsupported state or unable to authenticate data');
  }
  var padding = new Buffer(padAmount(this.clen));
  if (padding.length) {
    padding.fill(0);
    this.poly.update(padding);
  }
  var lens = new Buffer(16);
  lens.fill(0);
  lens.writeUInt32LE(this.alen, 0);
  lens.writeUInt32LE(this.clen, 8);
  var tag = this.poly.update(lens).finish();
  if (this._decrypt) {
    if (xorTest(tag, this.tag)) {
      throw new Error('Unsupported state or unable to authenticate data');
    }
  } else {
    this.tag = tag;
  }
  next();
};
Cipher.prototype.getAuthTag = function () {
  if(this._decrypt || this.tag === null) {
    throw new Error('Attempting to get auth tag in unsupported state');
  }
  return this.tag;
};
Cipher.prototype.setAuthTag = function setAuthTag (tag) {
  if (this._decrypt) {
    this.tag = tag;
  } else {
    throw new Error('Attempting to set auth tag in unsupported state');
  }
};
inherits(ChaChaStream, CipherBase);
function ChaChaStream (key, iv) {
  if (!(this instanceof ChaChaStream)) {
    return new ChaChaStream(key, iv);
  }
  CipherBase.call(this);
  this.chacha = new Chacha20(key, iv);
}
ChaChaStream.prototype._transform = function (chunk, _, next) {
  var len = chunk.length;
  if (!len) {
    return next();
  }
  var pad = this.chacha.getBytes(len);
  var i = -1;
  while (++i < len) {
    pad[i] ^= chunk[i];
  }
  this.push(pad);
  next();
};
inherits(PolyStream, Transform);
function PolyStream (key) {
  if (!(this instanceof PolyStream)) {
    return new PolyStream(key);
  }
  Transform.call(this);
  this.poly = new Poly1305(key);
}
PolyStream.prototype.update = function (data, enc) {
  this.write(data, enc);
  return this;
};
PolyStream.prototype._transform = function (data, _, next) {
  this.poly.update(data);
  next();
};

PolyStream.prototype._flush = function (next) {
  this.push(this.poly.finish());
  next();
};
PolyStream.prototype.digest = function (outputEnc) {
  this.end();
  var outData = new Buffer('');
  var chunk;
  while ((chunk = this.read())) {
    outData = Buffer.concat([outData, chunk]);
  }
  if (outputEnc) {
    outData = outData.toString(outputEnc);
  }
  return outData;
};
function padAmount(len) {
  var rem = len % 16;
  if (rem === 16) {
    return 0;
  }
  return 16 - rem;
}
function xorTest(a, b) {
  var out = 0;
  if (a.length !== b.length) {
    out++;
  }
  var len = Math.min(a.length, b.length);
  var i = -1;
  while (++i < len) {
    out += (a[i] ^ b[i]);
  }
  return out;
}


