// PBKDF2 210k + AES-GCM vault. No plaintext secrets stored.
const enc=new TextEncoder(), dec=new TextDecoder();
const b64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export const rnd=n=>{const a=new Uint8Array(n);crypto.getRandomValues(a);return b64(a.buffer)};
async function pbkdf2(pass,saltB64,iters=210000){const km=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:unb64(saltB64),iterations:iters,hash:'SHA-256'},km,256);return b64(bits)}
export async function hashPass(pass){const salt=rnd(16);const hash=await pbkdf2(pass,salt);return {salt,hash}}
export async function verifyPass(pass,salt,hash){const h=await pbkdf2(pass,salt);if(h.length!==hash.length)return false;let d=0;for(let i=0;i<h.length;i++)d|=h.charCodeAt(i)^hash.charCodeAt(i);return d===0}
export async function vaultKey(pin,saltB64){const km=await crypto.subtle.importKey('raw',enc.encode('vault:'+pin),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:unb64(saltB64),iterations:120000,hash:'SHA-256'},{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
export async function vaultEnc(key,obj){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(obj)));return {iv:b64(iv.buffer),ct:b64(ct)}}
export async function vaultDec(key,pack){const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(pack.iv)},key,unb64(pack.ct));return JSON.parse(dec.decode(pt))}
