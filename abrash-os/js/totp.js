// TOTP (RFC 6238, SHA-1) — pure JS, zero-dep, sync. Shared by browser + server.
// Secrets are base32. Verify with ±1 step window (30s steps).
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function b32dec(s){s=String(s).toUpperCase().replace(/=+$/,'');let bits=0,val=0;const out=[];
  for(const c of s){const i=B32.indexOf(c);if(i<0)throw new Error('bad base32');val=(val<<5)|i;bits+=5;
    if(bits>=8){bits-=8;out.push((val>>>bits)&255);val&=(1<<bits)-1}}return new Uint8Array(out)}
export function b32enc(bytes){let bits=0,val=0,o='';for(const b of bytes){val=(val<<8)|b;bits+=8;
  while(bits>=5){bits-=5;o+=B32[(val>>>bits)&31]}}if(bits)o+=B32[(val<<(5-bits))&31];return o}
function sha1(msg){ // msg: Uint8Array → 20-byte digest
  const ml=msg.length;const bitLen=ml*8;const pad=((ml+8)>>6)+1<<6;const m=new Uint8Array(pad);
  m.set(msg);m[ml]=0x80;const dv=new DataView(m.buffer);
  dv.setUint32(pad-4,bitLen>>>0);dv.setUint32(pad-8,Math.floor(bitLen/2**32));
  let h0=0x67452301,h1=0xEFCDAB89,h2=0x98BADCFE,h3=0x10325476,h4=0xC3D2E1F0;const w=new Uint32Array(80);
  const rot=(x,n)=>(x<<n)|(x>>>(32-n));
  for(let i=0;i<pad;i+=64){for(let t=0;t<16;t++)w[t]=dv.getUint32(i+t*4);
    for(let t=16;t<80;t++)w[t]=rot(w[t-3]^w[t-8]^w[t-14]^w[t-16],1);
    let a=h0,b=h1,c=h2,d=h3,e=h4;
    for(let t=0;t<80;t++){let f,k;if(t<20){f=(b&c)|(~b&d);k=0x5A827999}else if(t<40){f=b^c^d;k=0x6ED9EBA1}
      else if(t<60){f=(b&c)|(b&d)|(c&d);k=0x8F1BBCDC}else{f=b^c^d;k=0xCA62C1D6}
      const tmp=(rot(a,5)+f+e+k+w[t])>>>0;e=d;d=c;c=rot(b,30);b=a;a=tmp}
    h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0}
  const o=new Uint8Array(20);const od=new DataView(o.buffer);
  od.setUint32(0,h0);od.setUint32(4,h1);od.setUint32(8,h2);od.setUint32(12,h3);od.setUint32(16,h4);return o}
function hmacSha1(key,msg){if(key.length>64)key=sha1(key);const k=new Uint8Array(64);k.set(key);
  const ip=new Uint8Array(64),op=new Uint8Array(64);
  for(let i=0;i<64;i++){ip[i]=k[i]^0x36;op[i]=k[i]^0x5c}
  const inner=new Uint8Array(64+msg.length);inner.set(ip);inner.set(msg,64);
  const outer=new Uint8Array(64+20);outer.set(op);outer.set(sha1(inner),64);return sha1(outer)}
export function totp(secretB32,at=Date.now(),step=30,digits=6){const key=b32dec(secretB32);
  let ctr=Math.floor(at/1000/step);const msg=new Uint8Array(8);
  for(let i=7;i>=0;i--){msg[i]=ctr&255;ctr=Math.floor(ctr/256)}
  const h=hmacSha1(key,msg);const o=h[19]&15;
  const v=((h[o]&127)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3];
  return String(v%10**digits).padStart(digits,'0')}
export function verifyTotp(secretB32,code,at=Date.now(),window=1){code=String(code).trim();
  for(let w=-window;w<=window;w++)if(totp(secretB32,at+w*30000)===code)return true;return false}
export function newSecret(n=20){const b=new Uint8Array(n);if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(b);else for(let i=0;i<n;i++)b[i]=Math.floor(Math.random()*256);return b32enc(b)}
export const otpUri=(secret,user)=>`otpauth://totp/ABRASH-OS:${encodeURIComponent(user)}?secret=${secret}&issuer=ABRASH-OS&period=30&digits=6`;
