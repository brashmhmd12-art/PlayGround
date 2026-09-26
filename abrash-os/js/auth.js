import {Store} from './store.js';
import {hashPass,verifyPass,rnd} from './crypto.js';
import {newSecret,verifyTotp,otpUri} from './totp.js';
import {nowISO,deviceFP} from './core.js';
const FAILS='fails';
export const Auth={
  user(){return Store.get('session',null)?.user||null},
  users(){return Store.col('users')},
  async signup(u,e,p){u=u.trim();e=e.trim().toLowerCase();
    if(Store.col('users').some(x=>x.u===u||x.e===e))throw new Error('المستخدم موجود / exists');
    if(p.length<12)throw new Error('كلمة مرور 12+ حرف');
    const {salt,hash}=await hashPass(p);
    Store.push('users',{u,e,salt,hash,role:'owner',totp:null});
    Store.audit('signup',{u});return true},
  fails(key){return Store.get(FAILS,{})[key]||[]},
  locked(key){const f=this.fails(key).filter(t=>Date.now()-t<60000);return f.length>=5},
  markFail(key){const all=Store.get(FAILS,{});all[key]=[...(all[key]||[]),Date.now()].slice(-10);Store.set(FAILS,all)},
  async login(id,p,otp){const key='k:'+id.toLowerCase();
    if(this.locked(key))throw new Error('محاولات كثيرة — انتظر 60 ثانية (Rate limit)');
    const usr=Store.col('users').find(x=>x.u===id||x.e===id.toLowerCase());
    const okU=usr&&await verifyPass(p,usr.salt,usr.hash);
    Store.push('logins',{user:usr?.u||id,ok:!!okU,ua:navigator.userAgent.slice(0,120),ip:'local',dev:deviceFP()});
    if(!okU){this.markFail(key);Store.audit('login_fail',{id});throw new Error('بيانات الدخول غير صحيحة')}
    if(usr.totp){if(!otp||!verifyTotp(usr.totp,String(otp))){this.markFail(key);Store.audit('login_fail_totp',{id});throw new Error('رمز المصادقة TOTP مطلوب/خاطئ')} }
    const sess={id:rnd(16),user:{u:usr.u,e:usr.e,role:usr.role},dev:deviceFP(),ua:navigator.userAgent.slice(0,120),ip:'local',at:nowISO(),last:Date.now(),trusted:Store.col('devices').some(d=>d.fp===deviceFP()&&d.trusted)};
    Store.set('session',sess);
    const ss=Store.col('sessions');ss.unshift({...sess});Store.set('sessions',ss.slice(0,50));
    if(!Store.col('devices').some(d=>d.fp===sess.dev))Store.push('devices',{fp:sess.dev,ua:sess.ua,trusted:false,at:nowISO()});
    Store.audit('login',{u:usr.u,newDevice:!sess.trusted});
    return sess},
  logout(all=false){const s=Store.get('session',null);Store.audit('logout',{u:s?.user?.u,all});
    if(all)Store.set('sessions',[]);Store.set('session',null)},
  touch(){const s=Store.get('session',null);if(s){if(Date.now()-s.last>30*60*1000){this.logout();location.reload();return}s.last=Date.now();Store.set('session',s)}},
  totpSetup(){const secret=newSecret();const me=this.user();return {secret,uri:otpUri(secret,me.u)}},
  totpEnable(secret,code){if(!verifyTotp(secret,code))return false;
    const us=Store.col('users');const me=this.user();us.find(x=>x.u===me.u).totp=secret;
    Store.set('users',us);Store.audit('2fa_enable',{u:me.u});return true},
  totpDisable(){const us=Store.col('users');const me=this.user();us.find(x=>x.u===me.u).totp=null;Store.set('users',us);Store.audit('2fa_disable',{u:me.u})},
  totpOn(){const me=this.user();return !!Store.col('users').find(x=>x.u===me.u)?.totp},
  async checkPass(p){const me=this.user();if(!me)return false;const u=Store.col('users').find(x=>x.u===me.u);return u&&verifyPass(p,u.salt,u.hash)},
};
