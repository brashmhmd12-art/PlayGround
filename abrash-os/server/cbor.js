// Minimal CBOR encode/decode (RFC 7049) for WebAuthn: ints, bytes, text, arrays, maps, bool/null.
// Zero-dep, shared by server + tests.
function head(major,n){if(n<24)return Buffer.from([(major<<5)|n]);
  if(n<256)return Buffer.from([(major<<5)|24,n]);
  if(n<65536){const b=Buffer.alloc(3);b[0]=(major<<5)|25;b.writeUInt16BE(n,1);return b}
  const b=Buffer.alloc(5);b[0]=(major<<5)|26;b.writeUInt32BE(n,1);return b}
export function cborEncode(v){
  if(typeof v==='number'){if(!Number.isInteger(v))throw new Error('no floats');return v>=0?head(0,v):head(1,-1-v)}
  if(typeof v==='bigint')return head(0,Number(v));
  if(typeof v==='string'){const b=Buffer.from(v,'utf8');return Buffer.concat([head(3,b.length),b])}
  if(Buffer.isBuffer(v)||v instanceof Uint8Array){const b=Buffer.from(v);return Buffer.concat([head(2,b.length),b])}
  if(v===null||v===undefined)return Buffer.from([0xf6]);
  if(typeof v==='boolean')return Buffer.from([v?0xf5:0xf4]);
  if(Array.isArray(v))return Buffer.concat([head(4,v.length),...v.map(cborEncode)]);
  if(typeof v==='object'){const ks=Object.keys(v);return Buffer.concat([head(5,ks.length),...ks.flatMap(k=>[cborEncode(isNaN(+k)?k:+k),cborEncode(v[k])])])}
  throw new Error('cbor: unsupported '+typeof v)}
export function cborDecode(buf){let off=0;
  function item(){const ib=buf[off++];const major=ib>>5,ai=ib&31;
    let n;if(ai<24)n=ai;else if(ai===24)n=buf[off++];else if(ai===25){n=buf.readUInt16BE(off);off+=2}
    else if(ai===26){n=buf.readUInt32BE(off);off+=4}else throw new Error('cbor: long ints unsupported');
    if(major===0)return n;if(major===1)return -1-n;
    if(major===2){const b=buf.subarray(off,off+n);off+=n;return b}
    if(major===3){const s=buf.subarray(off,off+n).toString('utf8');off+=n;return s}
    if(major===4){const a=[];for(let i=0;i<n;i++)a.push(item());return a}
    if(major===5){const o={};for(let i=0;i<n;i++){const k=item();o[k]=item()}return o}
    if(major===7){if(n===20)return false;if(n===21)return true;if(n===22||n===23)return null;throw new Error('cbor: simple '+n)}
    throw new Error('cbor: major '+major)}
  const v=item();return {value:v,rest:buf.subarray(off)}}
