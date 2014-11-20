var maxInt = Math.pow(2, 32);
function fixInt(int) {
  if (int >= maxInt) {
    return int - maxInt;
  }
  return int;
}
function ROTATE(v, c) {
  return (v << c) | (v >>> (32 - c));
}
module.exports = Chacha20;
function Chacha20(key, nonce) {
  this.input = new Uint32Array(16);

  // https://tools.ietf.org/html/draft-irtf-cfrg-chacha20-poly1305-01#section-2.3
  this.input[0] = 1634760805;
  this.input[1] =  857760878;
  this.input[2] = 2036477234;
  this.input[3] = 1797285236;
  this.input[4] = key.readUInt32LE(0);
  this.input[5] = key.readUInt32LE(4);
  this.input[6] = key.readUInt32LE(8);
  this.input[7] = key.readUInt32LE(12);
  this.input[8] = key.readUInt32LE(16);
  this.input[9] = key.readUInt32LE(20);
  this.input[10] = key.readUInt32LE(24);
  this.input[11] = key.readUInt32LE(28);
  this.input[12] = 0;
  if (nonce.length === 8) {
    this.input[13] =0;
    this.input[14] = nonce.readUInt32LE(0);
    this.input[15] = nonce.readUInt32LE(4);
  } else {

    this.input[13] = nonce.readUInt32LE(0);
    this.input[14] = nonce.readUInt32LE(4);
    this.input[15] = nonce.readUInt32LE(8);
  }
  this.cachePos = 64;
  this.buffer = new Uint32Array(16);
  this.output = new Buffer(64);
}

Chacha20.prototype.quarterRound = function(a, b, c, d) {
  var x = this.buffer;
  x[a] += x[b]; x[d] = ROTATE(x[d] ^ x[a], 16);
  x[c] += x[d]; x[b] = ROTATE(x[b] ^ x[c], 12);
  x[a] += x[b]; x[d] = ROTATE(x[d] ^ x[a],  8);
  x[c] += x[d]; x[b] = ROTATE(x[b] ^ x[c],  7);
};
Chacha20.prototype.makeBlock = function (output, start) {
  var i = -1;
  // copy input into working buffer
  while (++i < 16) {
    this.buffer[i] = this.input[i];
  }
  i = -1;
  while (++i < 10) {
    // straight round
    this.quarterRound(0, 4, 8,12);
    this.quarterRound(1, 5, 9,13);
    this.quarterRound(2, 6,10,14);
    this.quarterRound(3, 7,11,15);


    //diaganle round
    this.quarterRound(0, 5,10,15);
    this.quarterRound(1, 6,11,12);
    this.quarterRound(2, 7, 8,13);
    this.quarterRound(3, 4, 9,14);
  }
  i = -1;
  // copy working buffer into output
  while (++i < 16) {
    this.buffer[i] += this.input[i];
    output.writeUInt32LE(this.buffer[i], start);
    start += 4;
  }

  this.input[12]++;
  if (!this.input[12]) {
    throw new Error('counter is exausted');
  }
};
Chacha20.prototype.getBytes = function(len) {
  var dpos = 0;
  var dst = new Buffer(len);
  var cacheLen = 64 - this.cachePos;
  if (cacheLen) {
    if (cacheLen >= len) {
      this.output.copy(dst, 0, this.cachePos, 64);
      this.cachePos += len;
      return dst;
    } else {
      this.output.copy(dst, 0, this.cachePos, 64);
      len -= cacheLen;
      dpos += cacheLen;
      this.cachePos = 64;
    }
  }
  while (len > 0 ) {
    
    if (len <= 64) {
      this.makeBlock(this.output, 0);
      this.output.copy(dst, dpos, 0, len);
      if (len < 64) {
        this.cachePos = len;
      }
      return dst;
    } else {
      this.makeBlock(dst, dpos);
    }
    len -= 64;
    dpos += 64;
  }
  throw new Error('something bad happended');
};

Chacha20.prototype.keystream = function(dst, len) {
  var pad = this.getBytes(len);
  var i = -1;
  pad.copy(dst, 0, len);
  while (++i < len) {
    dst[i] = pad[i];
  }
};