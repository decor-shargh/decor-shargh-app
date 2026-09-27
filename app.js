const firebaseConfig={
  apiKey:"AIzaSyD6b5UZEOXW53NQT8AavY5df2T0by5bL7M",
  authDomain:"decor-shargh.firebaseapp.com",
  projectId:"decor-shargh",
  storageBucket:"decor-shargh.firebasestorage.app",
  messagingSenderId:"773782150656",
  appId:"1:773782150656:web:80344bf7889e51b8fc02e5",
  measurementId:"G-54J4STYEY4"
};

const APP_VERSION="15.0.0";

let auth=null;
let db=null;
let currentAdmin=null;
let currentUserProfile=null;
let profileUnsub=null;
let signupInProgress=false;
let profileCreationPromise=null;
let usersAdminCache=[];
let usersAdminRawCache=[];
let pendingRememberIntent=null;
const REMEMBERED_LOGIN_STORAGE_KEY='decor-shargh-remembered-login-v2';
const REMEMBERED_LOGIN_DB='decor-shargh-secure-login';
const REMEMBERED_LOGIN_KEY_ID='remember-key-v1';
let appStarted=false;
let libraryReady=false;
let libraryCategoryDocs=[];
let libraryActivityDocs=[];
let libraryUnsubs=[];
let contractsReady=false;
let contractsUnsub=null;
let contractFormActivities=[];
let contractFormSelectedLibraryActivity=null;

let authResolved=false;
let deferredInstallPrompt=null;
let installPromptShownThisSession=false;
let installUiReady=false;

function hideBootSplash(){
  const splash=document.getElementById('bootSplash');
  if(!splash)return;
  splash.classList.add('is-hidden');
  installUiReady=true;
  window.setTimeout(()=>maybeShowInstallPrompt(),180);
}
function isStandaloneMode(){
  return window.matchMedia?.('(display-mode: standalone)').matches===true || window.navigator.standalone===true;
}
function isIosDevice(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
}
function hideInstallPrompt(){
  const sheet=document.getElementById('installPrompt');
  if(!sheet)return;
  sheet.classList.add('is-hidden');
  sheet.setAttribute('aria-hidden','true');
}
function maybeShowInstallPrompt(){
  if(!installUiReady || isStandaloneMode() || installPromptShownThisSession)return;
  const sheet=document.getElementById('installPrompt');
  const btn=document.getElementById('installAppBtn');
  const text=document.getElementById('installText');
  if(!sheet||!btn||!text)return;
  if(deferredInstallPrompt){
    text.textContent='برای دسترسی سریع‌تر، اپلیکیشن را روی دستگاهت نصب کن.';
    btn.textContent='نصب اپلیکیشن';
  }else if(isIosDevice()){
    text.textContent='در Safari روی دکمه Share بزن و «Add to Home Screen» را انتخاب کن.';
    btn.textContent='متوجه شدم';
  }else{
    return;
  }
  installPromptShownThisSession=true;
  sheet.classList.remove('is-hidden');
  sheet.setAttribute('aria-hidden','false');
}
async function triggerInstall(){
  if(deferredInstallPrompt){
    const prompt=deferredInstallPrompt;
    deferredInstallPrompt=null;
    hideInstallPrompt();
    try{
      await prompt.prompt();
      await prompt.userChoice;
    }catch{}
    return;
  }
  hideInstallPrompt();
}
function setupPwaInstall(){
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredInstallPrompt=e;
    maybeShowInstallPrompt();
  });
  window.addEventListener('appinstalled',()=>{
    deferredInstallPrompt=null;
    hideInstallPrompt();
    try{localStorage.setItem('decorSharghPwaInstalled','1')}catch{}
  });
  document.getElementById('installAppBtn')?.addEventListener('click',triggerInstall);
  document.getElementById('dismissInstallBtn')?.addEventListener('click',hideInstallPrompt);
  document.querySelectorAll('[data-install-dismiss]').forEach(el=>el.addEventListener('click',hideInstallPrompt));
  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).then(reg=>reg.update()).catch(()=>{});
    });
  }
}


function authEls(){
  return {
    gate:document.getElementById('authGate'),
    pending:document.getElementById('pendingGate'),
    blocked:document.getElementById('blockedGate'),
    shell:document.getElementById('appShell'),
    form:document.getElementById('loginForm'),
    email:document.getElementById('loginEmail'),
    password:document.getElementById('loginPassword'),
    remember:document.getElementById('rememberMe'),
    button:document.getElementById('loginBtn'),
    signup:document.getElementById('signupBtn'),
    message:document.getElementById('authMessage')
  };
}
function setAuthMessage(message,type=''){
  const el=document.getElementById('authMessage');
  if(!el)return;
  el.textContent=message||'';
  el.className='auth-message'+(type?' '+type:'');
}
function hideAllAuthScreens(){
  const e=authEls();
  e.gate?.classList.add('is-hidden');
  e.pending?.classList.add('is-hidden');
  e.blocked?.classList.add('is-hidden');
  document.getElementById('roleGate')?.classList.add('is-hidden');
  e.shell?.classList.add('is-hidden');
}
function showLogin(message=''){addSystemLog('نمایش صفحه ورود',message||'');
  hideAllAuthScreens();
  const e=authEls();
  e.gate?.classList.remove('is-hidden');
  hideBootSplash();
  if(message)setAuthMessage(message,'error');
}
function showPending(profile,user){addSystemLog('حساب در انتظار تأیید',user?.email||profile?.email||'');
  hideAllAuthScreens();
  const email=document.getElementById('pendingEmail');
  if(email)email.textContent=user?.email||profile?.email||'';
  document.getElementById('pendingGate')?.classList.remove('is-hidden');
  hideBootSplash();
}
function showBlocked(){addSystemLog('نمایش حساب مسدود','');
  hideAllAuthScreens();
  document.getElementById('blockedGate')?.classList.remove('is-hidden');
  hideBootSplash();
}
function roleFa(role){
  return role==='admin'?'ادمین':role==='projectManager'?'مدیر پروژه':role==='siteSupervisor'?'سرپرست اجرا':role==='pending'?'در انتظار تأیید':role==='blocked'?'مسدود':'کاربر';
}
function currentRole(){return currentUserProfile?.role||'';}
function isAdminRole(){return currentRole()==='admin'&&currentUserProfile?.active===true;}
function isSiteSupervisor(){return currentRole()==='siteSupervisor'&&currentUserProfile?.active===true;}
function uiRole(){return uiPreviewRole||currentRole();}
function isSupervisorUi(){return uiRole()==='siteSupervisor';}
function isAdminUi(){return uiRole()==='admin';}
function profileSignature(p={}){return [p.role||'',p.active===true?'1':'0',p.blocked===true?'1':'0'].join('|');}
function configureRoleUi(){
  const shell=document.getElementById('appShell');
  if(!shell)return;
  shell.classList.toggle('role-supervisor',isSupervisorUi());
  shell.classList.toggle('role-admin',!isSupervisorUi());
  const badge=document.getElementById('panelBadge');
  if(badge)badge.textContent=isSupervisorUi()?'Site Supervisor':'Admin Panel';
  document.title=isSupervisorUi()?'Decor Shargh | Site Supervisor':'Decor Shargh | Admin Panel';
  const banner=document.getElementById('previewRoleBanner');
  if(banner){
    banner.classList.toggle('is-hidden',!uiPreviewRole);
    const txt=banner.querySelector('[data-preview-label]');
    if(txt)txt.textContent=uiPreviewRole==='siteSupervisor'?'پیش‌نمایش پنل سرپرست اجرا':'پیش‌نمایش پنل ادمین';
  }
  if(isSupervisorUi()&&['library','more'].includes(document.querySelector('.view.active')?.dataset?.view||''))switchView('home');
}

function showRoleGate(profile,user){addSystemLog('نمایش پنل نقشِ آماده‌نشده',user?.email||profile?.email||'');
  hideAllAuthScreens();
  const role=profile?.role||'';
  const title=document.getElementById('roleGateTitle');
  const copy=document.getElementById('roleGateCopy');
  if(title)title.textContent=`دسترسی ${roleFa(role)} تأیید شد`;
  if(copy)copy.textContent=`حساب ${user?.email||profile?.email||''} فعال است، اما پنل «${roleFa(role)}» هنوز در این نسخه ساخته نشده است.`;
  document.getElementById('roleGate')?.classList.remove('is-hidden');
  hideBootSplash();
}
function showApp(){
  hideAllAuthScreens();
  configureRoleUi();
  document.getElementById('appShell')?.classList.remove('is-hidden');
  hideBootSplash();
  renderAll();
  appStarted=true;
}

function authErrorMessage(err){
  const code=err?.code||'';
  if(code.includes('invalid-credential')||code.includes('wrong-password')||code.includes('user-not-found'))return 'ایمیل یا رمز عبور صحیح نیست.';
  if(code.includes('email-already-in-use'))return 'این ایمیل قبلاً ثبت شده — به‌جای «ساخت حساب جدید» از «ورود» استفاده کنید.';
  if(code.includes('invalid-email'))return 'فرمت ایمیل صحیح نیست.';
  if(code.includes('weak-password'))return 'رمز عبور باید حداقل ۶ کاراکتر باشد.';
  if(code.includes('too-many-requests'))return 'تلاش‌های ورود زیاد بوده؛ کمی بعد دوباره امتحان کنید.';
  if(code.includes('network-request-failed'))return 'ارتباط با Firebase برقرار نشد. VPN یا دسترسی به Firebase را بررسی کنید.';
  if(code.includes('unauthorized-domain'))return 'دامنه سایت هنوز در Firebase مجاز نشده است.';
  if(code.includes('permission-denied'))return 'ثبت یا خواندن پروفایل کاربر در Firestore مجاز نشد. Rules را بررسی کنید.';
  return 'عملیات ورود انجام نشد. دوباره تلاش کنید.';
}

function bytesToBase64(bytes){
  let binary=''; const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
  return btoa(binary);
}
function base64ToBytes(value){
  const binary=atob(value||'');const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes;
}
function openRememberKeyDb(){
  return new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error('indexeddb-unavailable'));return;}
    const req=indexedDB.open(REMEMBERED_LOGIN_DB,1);
    req.onupgradeneeded=()=>{const x=req.result;if(!x.objectStoreNames.contains('keys'))x.createObjectStore('keys');};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('indexeddb-open-failed'));
  });
}
async function getRememberCryptoKey(){
  if(!window.crypto||!crypto.subtle)throw new Error('webcrypto-unavailable');
  const dbi=await openRememberKeyDb();
  try{
    const existing=await new Promise((resolve,reject)=>{
      const tx=dbi.transaction('keys','readonly');const req=tx.objectStore('keys').get(REMEMBERED_LOGIN_KEY_ID);
      req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error||new Error('remember-key-read-failed'));
    });
    if(existing)return existing;
    const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    await new Promise((resolve,reject)=>{
      const tx=dbi.transaction('keys','readwrite');tx.objectStore('keys').put(key,REMEMBERED_LOGIN_KEY_ID);
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('remember-key-write-failed'));
    });
    return key;
  }finally{try{dbi.close()}catch{}}
}
async function saveRememberedLogin(email,pass){
  if(!email||!pass){clearRememberedLogin();return;}
  try{
    const key=await getRememberCryptoKey(),iv=crypto.getRandomValues(new Uint8Array(12));
    const plain=new TextEncoder().encode(JSON.stringify({email:String(email),pass:String(pass)}));
    const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain));
    localStorage.setItem(REMEMBERED_LOGIN_STORAGE_KEY,JSON.stringify({v:2,iv:bytesToBase64(iv),data:bytesToBase64(encrypted)}));
  }catch{
    try{localStorage.setItem(REMEMBERED_LOGIN_STORAGE_KEY,JSON.stringify({v:2,email:String(email),noPassword:true}))}catch{}
  }
}
function clearRememberedLogin(){try{localStorage.removeItem(REMEMBERED_LOGIN_STORAGE_KEY)}catch{}}
async function loadRememberedLogin(){
  let raw=null;try{raw=localStorage.getItem(REMEMBERED_LOGIN_STORAGE_KEY)}catch{}
  if(!raw)return null;
  try{
    const payload=JSON.parse(raw);
    if(payload?.noPassword)return payload.email?{email:String(payload.email),pass:''}:null;
    if(!payload||payload.v!==2||!payload.iv||!payload.data)return null;
    const key=await getRememberCryptoKey();
    const plainBuf=await crypto.subtle.decrypt({name:'AES-GCM',iv:base64ToBytes(payload.iv)},key,base64ToBytes(payload.data));
    const data=JSON.parse(new TextDecoder().decode(plainBuf));
    return data?.email?{email:String(data.email),pass:String(data.pass||'')}:null;
  }catch{clearRememberedLogin();return null;}
}
async function storeNativePasswordCredential(email,pass){
  if(!email||!pass)return;
  try{
    if(window.PasswordCredential&&navigator.credentials?.store){
      await navigator.credentials.store(new PasswordCredential({id:email,password:pass,name:'Decor Shargh'}));
    }
  }catch{}
}
async function applyRememberPreference(email,pass,remember,role){
  if(role==='admin'||!remember){clearRememberedLogin();return;}
  await saveRememberedLogin(email,pass);storeNativePasswordCredential(email,pass);
}
async function hydrateRememberedLogin(){
  const emailEl=document.getElementById('loginEmail'),passEl=document.getElementById('loginPassword'),rememberEl=document.getElementById('rememberMe');
  if(!emailEl||!passEl||!rememberEl)return;
  const saved=await loadRememberedLogin();if(!saved)return;
  if(!emailEl.value)emailEl.value=saved.email||'';
  if(!passEl.value&&saved.pass)passEl.value=saved.pass;
  rememberEl.checked=!!(saved.email&&saved.pass);
}
function stopProfileSync(){if(profileUnsub){try{profileUnsub()}catch{}profileUnsub=null;}}
async function ensureOwnProfile(user){
  if(profileCreationPromise)return profileCreationPromise;
  profileCreationPromise=(async()=>{
    const ref=db.collection('users').doc(user.uid);
    const snap=await ref.get();
    if(snap.exists)return snap;
    try{
      await ref.set({
        email:user.email||'',
        name:(user.email||'').split('@')[0]||'کاربر',
        role:'pending',
        active:false,
        requestedAt:firebase.firestore.FieldValue.serverTimestamp(),
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:false});
    }catch(err){
      // اگر هم‌زمان onAuthStateChanged همان پروفایل را ساخته باشد، سند را دوباره می‌خوانیم.
      const retry=await ref.get().catch(()=>null);
      if(!retry||!retry.exists)throw err;
      return retry;
    }
    return ref.get();
  })();
  try{return await profileCreationPromise;}finally{profileCreationPromise=null;}
}
async function applyPendingRemember(role,user){
  if(!pendingRememberIntent){
    if(role==='admin')clearRememberedLogin();
    return;
  }
  const intent=pendingRememberIntent;pendingRememberIntent=null;
  await applyRememberPreference(intent.email||user?.email||'',intent.pass||'',intent.remember===true,role);
}

function timestampMs(v){
  try{if(!v)return 0;if(typeof v.toMillis==='function')return v.toMillis();if(typeof v.toDate==='function')return v.toDate().getTime();const d=new Date(v);return Number.isFinite(d.getTime())?d.getTime():0}catch{return 0}
}
function presenceDateTime(v){
  const ms=timestampMs(v);if(!ms)return 'ثبت نشده';
  try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ms))}catch{return 'ثبت نشده'}
}
function stopPresenceTracking(){
  if(presenceHeartbeatTimer){clearInterval(presenceHeartbeatTimer);presenceHeartbeatTimer=null}
}
function queuePresenceWrite(state='online'){
  if(!db||!currentAdmin?.uid||currentUserProfile?.active!==true)return;
  const payload={
    lastActiveAt:firebase.firestore.FieldValue.serverTimestamp(),
    presenceState:state,
    presenceUpdatedAt:firebase.firestore.FieldValue.serverTimestamp()
  };
  if(state!=='online')payload.lastSeenAt=firebase.firestore.FieldValue.serverTimestamp();
  db.collection('users').doc(currentAdmin.uid).set(payload,{merge:true}).catch(()=>{});
}
function startPresenceTracking(){
  stopPresenceTracking();
  queuePresenceWrite('online');
  presenceHeartbeatTimer=setInterval(()=>{if(document.visibilityState==='visible')queuePresenceWrite('online')},PRESENCE_HEARTBEAT_MS);
}
function isUserOnline(u){
  if(u?.active!==true||u?.blocked===true||u?.presenceState==='away')return false;
  return Date.now()-timestampMs(u?.lastActiveAt)<=PRESENCE_ONLINE_MS;
}
document.addEventListener('visibilitychange',()=>{
  if(!currentAdmin?.uid||currentUserProfile?.active!==true)return;
  if(document.visibilityState==='visible')queuePresenceWrite('online');else queuePresenceWrite('away');
});
async function routeUserByProfile(user,profile){
  currentUserProfile={uid:user.uid,email:user.email||profile?.email||'',...(profile||{})};
  const role=profile?.role||'pending',active=profile?.active===true;
  await applyPendingRemember(role,user);
  if(role==='admin'&&active){
    currentAdmin=currentUserProfile;startPresenceTracking();showApp();
    if(!libraryUnsubs.length)initLibraryFirestore().catch(err=>toast(firestoreErrorMessage(err)));
    if(!contractsUnsub)initContractsFirestore().catch(err=>toast(firestoreErrorMessage(err)));
    return;
  }
  if(role==='siteSupervisor'&&active){
    currentAdmin=currentUserProfile;startPresenceTracking();stopLibrarySync();state.library=[];showApp();
    if(!contractsUnsub)initContractsFirestore().catch(err=>toast(firestoreErrorMessage(err)));
    return;
  }
  stopPresenceTracking();currentAdmin=null;stopLibrarySync();stopContractSync();
  if(role==='blocked'||profile?.blocked===true){showBlocked();return;}
  if(role==='pending'||!active){showPending(profile,user);return;}
  if(role==='projectManager'){showRoleGate(profile,user);return;}
  showPending(profile,user);
}

async function watchOwnProfile(user){
  stopProfileSync();
  const ref=db.collection('users').doc(user.uid);
  profileUnsub=ref.onSnapshot(async snap=>{
    try{
      if(!snap.exists){
        const created=await ensureOwnProfile(user);profileAccessSignature='';
        await routeUserByProfile(user,created.data()||{});return;
      }
      const data=snap.data()||{};
      const sig=profileSignature(data);
      if(currentUserProfile?.uid===user.uid&&profileAccessSignature===sig){
        currentUserProfile={...currentUserProfile,...data,uid:user.uid,email:user.email||data.email||currentUserProfile.email||''};
        if(currentAdmin?.uid===user.uid)currentAdmin=currentUserProfile;
        return;
      }
      profileAccessSignature=sig;
      await routeUserByProfile(user,data);
    }catch(err){showLogin(authErrorMessage(err));}
  },err=>showLogin(authErrorMessage(err)));
}

async function initFirebaseAuth(){
  if(typeof firebase==='undefined'){
    authResolved=true;showLogin('کتابخانه Firebase بارگذاری نشد. دسترسی شبکه به Firebase را بررسی کنید.');return;
  }
  try{
    if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
    auth=firebase.auth();db=firebase.firestore();
    try{await db.enablePersistence({synchronizeTabs:true})}catch(err){if(!['failed-precondition','unimplemented'].some(x=>String(err?.code||'').includes(x)))console.warn('Firestore persistence',err)}
    try{await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)}catch{}
    await hydrateRememberedLogin();
    auth.onAuthStateChanged(async user=>{
      authResolved=true;
      if(!user){
        stopPresenceTracking();profileAccessSignature='';currentAdmin=null;currentUserProfile=null;stopProfileSync();stopLibrarySync();stopContractSync();showLogin();
        setAuthMessage('ایمیل و رمز عبور را وارد کنید.');return;
      }
      try{await ensureOwnProfile(user);await watchOwnProfile(user);}
      catch(err){showLogin(authErrorMessage(err));}
    },err=>{authResolved=true;showLogin(authErrorMessage(err));});
  }catch(err){authResolved=true;showLogin(authErrorMessage(err));}
}



const THEME_STORAGE_KEY='decorSharghTheme';
function currentTheme(){return document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light';}
function syncThemeButton(){const b=document.getElementById('themeToggleBtn');if(b){const dark=currentTheme()==='dark';b.textContent=dark?'☀':'☾';b.title=dark?'حالت روشن':'حالت تیره';b.setAttribute('aria-label',b.title);}}
function setTheme(theme){if(theme==='dark')document.documentElement.setAttribute('data-theme','dark');else document.documentElement.removeAttribute('data-theme');try{localStorage.setItem(THEME_STORAGE_KEY,theme)}catch{}syncThemeButton();}
function toggleTheme(){setTheme(currentTheme()==='dark'?'light':'dark');}

const STORAGE_KEY='decorSharghAdminV1';
const faDigits='۰۱۲۳۴۵۶۷۸۹';
const statusLabels={active:'فعال',stopped:'متوقف',terminated:'فسخ‌شده',completed:'خاتمه‌یافته'};
const initialLibrary=[
 {name:'سقف',items:[['سقف کاذب کناف',7,7,6],['سقف رابیتس',8,7,8],['سقف کشسان',4,5,3],['سقف PVC',4,4,3],['سقف چوبی / دکوراتیو',6,7,5],['باکس نور مخفی',4,4,4],['نورپردازی سقف',4,5,4],['ترمیم سقف موجود',3,3,3]]},
 {name:'کف',items:[['سرامیک کف',7,7,6],['سنگ کف',8,8,7],['پارکت',5,6,4],['لمینت',4,5,3],['کفپوش',3,4,3]]},
 {name:'دیوار',items:[['تخریب دیوار',5,4,4],['دیوارچینی',7,6,6],['گچ و خاک',6,5,5],['سفیدکاری',5,4,5],['نقاشی',5,4,5],['کاغذ دیواری',3,4,3]]},
 {name:'برق',items:[['سیم‌کشی / اصلاح برق',7,7,7],['نصب کلید و پریز',3,3,3],['نورپردازی',4,5,4],['تابلو برق',5,6,4]]},
 {name:'مکانیک',items:[['لوله‌کشی آب',7,7,7],['لوله‌کشی فاضلاب',8,7,7],['نصب شیرآلات',3,4,2],['رادیاتور / گرمایش',5,6,4]]},
 {name:'سرویس و حمام',items:[['تخریب سرویس',5,4,4],['عایق‌کاری',5,5,4],['کاشی و سرامیک',7,7,7],['نصب روشویی',3,4,2],['نصب توالت',3,4,2],['نصب دوش و متعلقات',2,3,2]]},
 {name:'آشپزخانه',items:[['تخریب کابینت',4,3,3],['ساخت و نصب کابینت',9,9,8],['صفحه کابینت',4,6,3],['بین کابینتی',3,4,3],['نصب سینک',2,3,2],['نصب هود',2,3,2]]},
 {name:'درب و پنجره',items:[['درب داخلی',4,5,3],['درب ورودی',5,6,4],['پنجره',6,7,5],['شیشه',3,5,3]]},
 {name:'دکوراتیو',items:[['تی‌وی وال',6,7,5],['دیوارکوب',4,5,4],['ترمووال',4,5,4],['آینه دکوراتیو',3,5,3],['قرنیز',3,3,3]]},
 {name:'سایر',items:[]}
];

function score(v,l,c){return +(v*.4+l*.35+c*.25).toFixed(2)}
function uid(prefix='id'){return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
function freshState(){return {contracts:[],library:[]}}
let state=freshState();
let libraryExpandedCats=new Set();
let systemLogs=[];
let uiPreviewRole='';
let historyCache=new Map();
let historyUnsub=null;
let issuesCache=new Map();
let issuesUnsub=null;
let usersAdminUnsub=null;
let usersPresenceTimer=null;
let presenceHeartbeatTimer=null;
let profileAccessSignature='';
let auditLogUnsub=null;
let auditLogCache=[];
const AUDIT_COLLECTION='auditLogs';
const PRESENCE_ONLINE_MS=120000;
const PRESENCE_HEARTBEAT_MS=55000;
let contractRenderFrame=0;
function scheduleContractViewsRender(){
  if(contractRenderFrame)return;
  contractRenderFrame=requestAnimationFrame(()=>{
    contractRenderFrame=0;
    renderHome();
    renderContracts();
  });
}
function legacyLocalContracts(){try{const s=JSON.parse(localStorage.getItem(STORAGE_KEY));return Array.isArray(s?.contracts)?s.contracts:[]}catch{return []}}
function save(){/* Firestore is the source of truth. Kept as a no-op for legacy call safety. */}
function addSystemLog(action,detail=''){/* V15: لاگ قابل مشاهده فقط تغییرات واقعی و دائمی Firestore است. */}

function systemLogTime(iso){
  try{return new Intl.DateTimeFormat('fa-IR',{hour:'2-digit',minute:'2-digit',second:'2-digit',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));}
  catch{return iso||'';}
}
addSystemLog('راه‌اندازی نسخه',APP_VERSION);


const LIB_CAT_COLLECTION='activityCategories';
const LIB_ACT_COLLECTION='activityLibrary';
const LIB_META_DOC='appMeta/activityLibrary';

function stopLibrarySync(){
  libraryUnsubs.forEach(fn=>{try{fn()}catch{}});
  libraryUnsubs=[];
  libraryReady=false;
}
function firestoreErrorMessage(err){
  const code=err?.code||'';
  if(code.includes('permission-denied'))return 'دسترسی به اطلاعات Firestore مجاز نیست.';
  if(code.includes('unavailable')||code.includes('network'))return 'ارتباط با Firestore برقرار نشد.';
  return 'عملیات Firestore انجام نشد.';
}
function rebuildLibraryFromRemote(){
  const cats=[...libraryCategoryDocs].filter(x=>x.active!==false).sort((a,b)=>(a.order??0)-(b.order??0)||String(a.name||'').localeCompare(String(b.name||''),'fa'));
  const acts=[...libraryActivityDocs].filter(x=>x.active!==false).sort((a,b)=>(a.order??0)-(b.order??0)||String(a.name||'').localeCompare(String(b.name||''),'fa'));
  state.library=cats.map(cat=>({
    id:cat.id,
    name:cat.name,
    order:cat.order??0,
    items:acts.filter(a=>a.categoryId===cat.id).map(a=>({
      id:a.id,
      name:a.name,
      categoryId:a.categoryId,
      volume:Number(a.volume)||0,
      cost:Number(a.cost)||0,
      duration:Number(a.duration)||0,
      score:Number(a.score)||score(Number(a.volume)||0,Number(a.cost)||0,Number(a.duration)||0),
      order:a.order??0
    }))
  }));
  libraryReady=true;
  if(document.getElementById('libraryList'))renderLibrary();
}
async function seedInitialLibraryIfNeeded(){
  const metaRef=db.doc(LIB_META_DOC);
  const meta=await metaRef.get();
  if(meta.exists)return;
  const existing=await db.collection(LIB_CAT_COLLECTION).limit(1).get();
  if(!existing.empty){
    await metaRef.set({seeded:true,seededAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
    return;
  }
  const batch=db.batch();
  let activityCounter=1;
  initialLibrary.forEach((cat,ci)=>{
    const catId=`cat_${String(ci+1).padStart(2,'0')}`;
    batch.set(db.collection(LIB_CAT_COLLECTION).doc(catId),{
      name:cat.name,order:ci+1,active:true,createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    cat.items.forEach((item,ai)=>{
      const actId=`act_${String(activityCounter++).padStart(3,'0')}`;
      const [name,volume,cost,duration]=item;
      batch.set(db.collection(LIB_ACT_COLLECTION).doc(actId),{
        name,categoryId:catId,volume,cost,duration,score:score(volume,cost,duration),order:ai+1,active:true,createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    });
  });
  batch.set(metaRef,{seeded:true,version:1,seededAt:firebase.firestore.FieldValue.serverTimestamp()});
  await batch.commit();
}
async function loadLibraryOnce(){
  const [catsSnap,actsSnap]=await Promise.all([db.collection(LIB_CAT_COLLECTION).get(),db.collection(LIB_ACT_COLLECTION).get()]);
  libraryCategoryDocs=catsSnap.docs.map(d=>({id:d.id,...d.data()}));
  libraryActivityDocs=actsSnap.docs.map(d=>({id:d.id,...d.data()}));
  rebuildLibraryFromRemote();
}
function startLibrarySync(){
  stopLibrarySync();
  libraryUnsubs.push(db.collection(LIB_CAT_COLLECTION).onSnapshot(snap=>{
    libraryCategoryDocs=snap.docs.map(d=>({id:d.id,...d.data()}));
    rebuildLibraryFromRemote();
  },err=>toast(firestoreErrorMessage(err))));
  libraryUnsubs.push(db.collection(LIB_ACT_COLLECTION).onSnapshot(snap=>{
    libraryActivityDocs=snap.docs.map(d=>({id:d.id,...d.data()}));
    rebuildLibraryFromRemote();
  },err=>toast(firestoreErrorMessage(err))));
}
async function initLibraryFirestore(){
  if(!db)return;
  await seedInitialLibraryIfNeeded();
  await loadLibraryOnce();
  startLibrarySync();
}
async function createCategoryRemote(name){
  const nextOrder=(libraryCategoryDocs.reduce((m,x)=>Math.max(m,Number(x.order)||0),0)||0)+1;
  await db.collection(LIB_CAT_COLLECTION).add({name,order:nextOrder,active:true,createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
}
async function updateCategoryRemote(id,name){
  await db.collection(LIB_CAT_COLLECTION).doc(id).update({name,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
}
async function deleteCategoryRemote(id){
  await db.collection(LIB_CAT_COLLECTION).doc(id).delete();
}
async function createActivityRemote(catId,data){
  const inCat=libraryActivityDocs.filter(x=>x.categoryId===catId);
  const nextOrder=(inCat.reduce((m,x)=>Math.max(m,Number(x.order)||0),0)||0)+1;
  const payload={...data,categoryId:catId,score:score(data.volume,data.cost,data.duration),order:nextOrder,active:true,createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  await db.collection(LIB_ACT_COLLECTION).add(payload);
}
async function updateActivityRemote(id,data){
  const payload={...data,score:score(data.volume,data.cost,data.duration),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  await db.collection(LIB_ACT_COLLECTION).doc(id).update(payload);
}
async function deleteActivityRemote(id){
  await db.collection(LIB_ACT_COLLECTION).doc(id).delete();
}

const CONTRACT_COLLECTION='contracts';
const CONTRACT_META_DOC='appMeta/contractsMigration';

function stopContractSync(){
  if(contractsUnsub){try{contractsUnsub()}catch{}contractsUnsub=null}
  contractsReady=false;
}
function contractDocPayload(c){
  return {
    customerName:String(c.customerName||'').trim(),
    penCode:String(c.penCode||'').trim(),
    amount:String(c.amount||''),
    contractDate:String(c.contractDate||''),
    endDate:String(c.endDate||''),
    compDate:String(c.compDate||''),
    notes:String(c.notes||''),
    status:c.status||'active',
    activities:Array.isArray(c.activities)?c.activities.map(a=>({
      id:a.id||uid('ca'),
      libraryId:a.libraryId||'',
      categoryId:a.categoryId||'',
      categoryName:a.categoryName||'',
      name:String(a.name||''),
      baseScore:Number(a.baseScore)||0,
      progress:Math.max(0,Math.min(100,Number(a.progress)||0))
    })):[],
    statusReason:String(c.statusReason||''),
    statusDate:String(c.statusDate||''),
    completedAt:c.completedAt||null,
    progressByActivity:(c.progressByActivity&&typeof c.progressByActivity==='object')?Object.fromEntries(Object.entries(c.progressByActivity).map(([k,v])=>[k,Math.max(0,Math.min(100,Number(v)||0))])):{}
  };
}
async function migrateLegacyContractsIfNeeded(){
  // Migration is intentionally PER DEVICE, not controlled by one global Firestore flag.
  // Older cached builds could still have contracts only in this browser's LocalStorage.
  // On every startup we safely copy only missing legacy contract IDs to Firestore.
  const legacy=legacyLocalContracts();
  if(!legacy.length)return;

  let migratedCount=0;
  let batch=db.batch();
  let ops=0;
  for(const raw of legacy){
    const legacyId=String(raw?.id||'').trim();
    if(!legacyId)continue;
    const ref=db.collection(CONTRACT_COLLECTION).doc(legacyId);
    const remote=await ref.get();
    if(remote.exists)continue;
    const payload=contractDocPayload({...raw,id:legacyId});
    batch.set(ref,{
      ...payload,
      createdAt:raw.createdAt||firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
      migratedFromLocalStorage:true,
      migratedBy:currentAdmin?.uid||'',
      migratedAt:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true});
    migratedCount++;
    ops++;
    if(ops>=400){await batch.commit();batch=db.batch();ops=0}
  }
  if(ops)await batch.commit();

  // Keep a browser-local backup, then clear the old source so stale local data is never treated as live data again.
  if(migratedCount){
    try{
      localStorage.setItem(`${STORAGE_KEY}_backup_${Date.now()}`,JSON.stringify({contracts:legacy,migratedAt:new Date().toISOString()}));
      localStorage.removeItem(STORAGE_KEY);
    }catch{}
    toast(`${toFa(migratedCount)} قرارداد محلی به Firestore منتقل شد`);
  }
}

function startContractsSync(){
  stopContractSync();
  contractsUnsub=db.collection(CONTRACT_COLLECTION).onSnapshot(snap=>{
    state.contracts=snap.docs.map(d=>({id:d.id,...d.data()}));
    contractsReady=true;
    if(appStarted)scheduleContractViewsRender();
  },err=>toast(firestoreErrorMessage(err)));
}
async function initContractsFirestore(){
  if(!db||contractsUnsub)return;
  contractsReady=false;
  contractsUnsub=db.collection(CONTRACT_COLLECTION).onSnapshot({includeMetadataChanges:true},snap=>{
    state.contracts=snap.docs.map(d=>({id:d.id,...d.data()}));
    contractsReady=true;
    if(appStarted)scheduleContractViewsRender();
  },err=>toast(firestoreErrorMessage(err)));
  if(isAdminRole()){
    migrateLegacyContractsIfNeeded().catch(()=>{});
    db.doc('appMeta/runtime').set({appVersion:APP_VERSION,lastSeenAt:firebase.firestore.FieldValue.serverTimestamp(),lastSeenBy:currentAdmin?.uid||''},{merge:true}).catch(()=>{});
  }
}

function contractChangeSummary(before={},after={}){
  const defs=[
    ['customerName','نام مشتری',v=>String(v||'')],
    ['penCode','کد قلم',v=>String(v||'')],
    ['amount','مبلغ',v=>money(v)],
    ['contractDate','تاریخ قرارداد',v=>String(v||'—')],
    ['endDate','سررسید',v=>String(v||'—')],
    ['compDate','سررسید جبرانی',v=>String(v||'—')],
    ['notes','توضیحات',v=>String(v||'—')]
  ];
  const parts=[];
  defs.forEach(([key,label,fmt])=>{
    const a=String(before?.[key]??''),b=String(after?.[key]??'');
    if(a!==b)parts.push(`${label}: «${fmt(before?.[key])}» ← «${fmt(after?.[key])}»`);
  });
  return parts;
}
function auditContractCreated(contract){
  writeAuditLog('ایجاد قرارداد',`قرارداد «${contract.customerName||''}» با کد قلم «${contract.penCode||''}» ایجاد شد.`,{contractId:contract.id||'',contractName:contract.customerName||'',penCode:contract.penCode||'',kind:'contractCreate'});
}
function auditContractEdited(before,after){
  const changes=contractChangeSummary(before,after);
  if(!changes.length)return;
  writeAuditLog('ویرایش قرارداد',changes.join(' | '),{contractId:after.id||before.id||'',contractName:after.customerName||before.customerName||'',penCode:after.penCode||before.penCode||'',kind:'contractEdit'});
}

async function createContractRemote(data){
  if(!db||!currentAdmin||!isAdminRole())throw Object.assign(new Error('permission-denied'),{code:'permission-denied'});
  const ref=db.collection(CONTRACT_COLLECTION).doc();
  const payload=contractDocPayload({...data,id:ref.id,status:'active'});
  await ref.set({...payload,createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp(),createdBy:currentAdmin.uid,appVersion:APP_VERSION});
  // Read-after-write verification: do not tell the user it saved unless Firestore can read it back.
  const check=await ref.get();
  if(!check.exists)throw Object.assign(new Error('firestore-write-not-confirmed'),{code:'unavailable'});
  return ref.id;
}
async function updateContractRemote(id,patch){
  if(!db||!currentAdmin||!isAdminRole())throw Object.assign(new Error('permission-denied'),{code:'permission-denied'});
  const current=getContract(id)||{};
  const merged={...current,...patch,id};
  const payload=contractDocPayload(merged);
  const ref=db.collection(CONTRACT_COLLECTION).doc(id);
  await ref.set({...payload,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:currentAdmin.uid||''},{merge:true});
  // Read-after-write verification + immediate local refresh. This prevents the edit modal
  // from closing while the cards still show the stale pre-edit snapshot.
  const check=await ref.get();
  if(!check.exists)throw Object.assign(new Error('firestore-update-not-confirmed'),{code:'unavailable'});
  const saved={id:check.id,...check.data()};
  const idx=state.contracts.findIndex(c=>c.id===id);
  if(idx>=0)state.contracts[idx]=saved;else state.contracts.push(saved);
  return saved;
}
async function persistContract(c){
  syncAutoCompleted(c);
  await updateContractRemote(c.id,c);
}

function actorAuditFields(){return {actorUid:currentAdmin?.uid||'',actorName:currentAdmin?.name||'',actorEmail:currentAdmin?.email||'',actorRole:currentRole()}}
function makeAuditData(title,detail='',extra={}){
  return {title:String(title||''),detail:String(detail||''),...extra,...actorAuditFields(),createdAt:firebase.firestore.FieldValue.serverTimestamp(),createdAtClient:new Date().toISOString(),appVersion:APP_VERSION};
}
function writeAuditLog(title,detail='',extra={}){
  if(!db||!currentAdmin?.uid)return;
  db.collection(AUDIT_COLLECTION).add(makeAuditData(title,detail,extra)).catch(()=>{});
}
function addAuditToBatch(batch,title,detail='',extra={}){
  const ref=db.collection(AUDIT_COLLECTION).doc();batch.set(ref,makeAuditData(title,detail,extra));return ref;
}
function refreshProgressUi(c,activityId){
  const a=(c.activities||[]).find(x=>x.id===activityId);if(!a)return;
  const progress=effectiveActivityProgress(c,a),done=progress===100;
  const row=document.querySelector(`[data-activity-row="${CSS.escape(activityId)}"]`);
  if(row){row.classList.toggle('done',done);const txt=row.querySelector('.supervisor-activity-title span');if(txt)txt.textContent=`پیشرفت فعلی: ${toFa(progress)}٪`;const title=row.querySelector('.supervisor-activity-title strong,.activity-title-text');if(title)title.classList.toggle('done',done);const input=row.querySelector('input[type="number"]');if(input)input.value=progress;const doneBtn=row.querySelector('[data-supervisor-done],[data-done]');if(doneBtn){doneBtn.disabled=done;doneBtn.classList.toggle('is-done',done)}}
  const total=document.querySelector('.detail-total-progress');if(total)total.textContent=`${toFa(contractProgress(c))}٪`;
  scheduleContractViewsRender();
}
async function updateActivityProgressRemote(c,activityId,newProgress,action='manual'){
  if(!db||!currentAdmin||!(isAdminRole()||isSiteSupervisor()))throw Object.assign(new Error('permission-denied'),{code:'permission-denied'});
  const activity=(c.activities||[]).find(a=>a.id===activityId);if(!activity)throw new Error('activity-not-found');
  const nextProgress=Math.max(0,Math.min(100,Number(newProgress)||0));
  const oldProgress=effectiveActivityProgress(c,activity);
  if(oldProgress===nextProgress)return {saved:c,changed:false};
  const previousMap={...(c.progressByActivity||{})};const previousStatus=c.status;const previousCompleted=c.completedAt;
  c.progressByActivity={...previousMap,[activityId]:nextProgress};syncAutoCompleted(c);
  refreshProgressUi(c,activityId);
  const ref=db.collection(CONTRACT_COLLECTION).doc(c.id),historyRef=ref.collection('history').doc();
  const batch=db.batch();
  const patch={
    [`progressByActivity.${activityId}`]:nextProgress,
    status:c.status||'active',completedAt:c.completedAt||null,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:currentAdmin.uid||'',appVersion:APP_VERSION
  };
  batch.update(ref,patch);
  batch.set(historyRef,{contractId:c.id,activityId:activity.id,activityName:String(activity.name||''),oldProgress,newProgress:nextProgress,action:action==='done'?'done':'manual',changedByUid:currentAdmin.uid||'',changedByEmail:currentAdmin.email||'',changedByName:currentAdmin.name||'',changedByRole:currentRole(),changedAt:firebase.firestore.FieldValue.serverTimestamp(),changedAtClient:new Date().toISOString(),appVersion:APP_VERSION});
  addAuditToBatch(batch,action==='done'?'انجام شدن فعالیت':'ثبت پیشرفت',`فعالیت «${activity.name||'فعالیت'}» از ${toFa(oldProgress)}٪ به ${toFa(nextProgress)}٪ تغییر کرد.`,{contractId:c.id,contractName:c.customerName||'',penCode:c.penCode||'',activityId:activity.id,activityName:activity.name||'',oldValue:oldProgress,newValue:nextProgress,kind:action==='done'?'activityDone':'progress'});
  const pending=batch.commit();
  pending.catch(err=>{
    if(String(err?.code||'').includes('permission-denied')){
      c.progressByActivity=previousMap;c.status=previousStatus;c.completedAt=previousCompleted;refreshProgressUi(c,activityId);toast('ذخیره مجاز نشد؛ مقدار قبلی برگردانده شد.');
    }
  });
  return {saved:c,changed:true,pending:true};
}

function toFa(v){return String(v).replace(/\d/g,d=>faDigits[d])}
function toEn(v=''){return String(v).replace(/[۰-۹]/g,d=>faDigits.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))}
function money(v){const n=Number(toEn(v).replace(/,/g,''))||0;return toFa(n.toLocaleString('en-US'))+' ریال'}
function normalizeDate(v){v=toEn(v).trim().replace(/[-.]/g,'/');const m=v.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);if(!m)return '';return `${m[1]}/${String(m[2]).padStart(2,'0')}/${String(m[3]).padStart(2,'0')}`}
function normalizeYear(v=''){return toEn(v).replace(/\D/g,'').slice(0,4)}

function div(a,b){return Math.trunc(a/b)}
function jalCal(jy){const breaks=[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];let bl=breaks.length,gy=jy+621,leapJ=-14,jp=breaks[0],jm,jump,n,i;if(jy<jp||jy>=breaks[bl-1])throw Error('Invalid Jalaali year '+jy);for(i=1;i<bl;i+=1){jm=breaks[i];jump=jm-jp;if(jy<jm)break;leapJ+=div(jump,33)*8+div(jump%33,4);jp=jm}n=jy-jp;leapJ+=div(n,33)*8+div((n%33)+3,4);if(jump%33===4&&jump-n===4)leapJ+=1;const leapG=div(gy,4)-div((div(gy,100)+1)*3,4)-150;const march=20+leapJ-leapG;if(jump-n<6)n=n-jump+div(jump+4,33)*33;let leap=((n+1)%33-1)%4;if(leap===-1)leap=4;return {leap,gy,march}}
function g2d(gy,gm,gd){let d=div((gy+div(gm-8,6)+100100)*1461,4)+div(153*((gm+9)%12)+2,5)+gd-34840408;d=d-div(div(gy+100100+div(gm-8,6),100)*3,4)+752;return d}
function d2g(jdn){let j=4*jdn+139361631;j=j+div(div(4*jdn+183187720,146097)*3,4)*4-3908;const i=div((j%1461),4)*5+308;const gd=div(i%153,5)+1;const gm=(div(i,153)%12)+1;const gy=div(j,1461)-100100+div(8-gm,6);return {gy,gm,gd}}
function j2d(jy,jm,jd){const r=jalCal(jy);return g2d(r.gy,3,r.march)+(jm-1)*31-div(jm,7)*(jm-7)+jd-1}
function jalaliToDate(s){const n=normalizeDate(s);if(!n)return null;const [jy,jm,jd]=n.split('/').map(Number);try{const g=d2g(j2d(jy,jm,jd));return new Date(g.gy,g.gm-1,g.gd,12,0,0)}catch{return null}}
function daysUntilDate(dateStr){
  const d=jalaliToDate(dateStr);if(!d)return null;
  const t=new Date();const today=new Date(t.getFullYear(),t.getMonth(),t.getDate(),12);
  return Math.ceil((d-today)/86400000);
}
function daysUntilContract(c){return daysUntilDate(c.endDate)}
function duePhrase(n,label){
  if(n===null)return `${label}: تاریخ نامعتبر`;
  if(n<0)return `${label}: ${toFa(Math.abs(n))} روز گذشته`;
  if(n===0)return `${label}: امروز`;
  return `${label}: ${toFa(n)} روز مانده`;
}
function dueState(c){
  if(c.status==='completed')return {key:'completed',text:'خاتمه‌یافته'};
  if(c.status==='stopped')return {key:'stopped',text:'متوقف'};
  if(c.status==='terminated')return {key:'terminated',text:'فسخ‌شده'};
  const original=daysUntilDate(c.endDate);
  if(original===null)return {key:'normal',text:'بدون تاریخ معتبر'};
  const revised=c.compDate?daysUntilDate(c.compDate):null;
  let key='normal';
  // The original contractual due date remains the criticality baseline even when a
  // compensatory/revised date exists. Once the original due date is passed, the
  // contract is critical until it is completed/stopped/terminated.
  if(original<0)key='overdue';
  else if(original<=3)key='critical';
  else if(original<=7)key='near';
  if(c.compDate){
    const originalText=original<0
      ? `${toFa(Math.abs(original))} روز تأخیر نسبت به پایان قرارداد`
      : original===0?'امروز تاریخ پایان قرارداد':`${toFa(original)} روز تا پایان قرارداد`;
    const revisedText=revised===null?'تاریخ جبرانی نامعتبر':revised<0
      ? `${toFa(Math.abs(revised))} روز از تاریخ جبرانی گذشته`
      : revised===0?'امروز تاریخ جبرانی':`${toFa(revised)} روز تا تاریخ جبرانی`;
    return {key,text:`${originalText} | ${revisedText}`,originalDays:original,revisedDays:revised};
  }
  if(original<0)return {key,text:`${toFa(Math.abs(original))} روز از سررسید گذشته`,originalDays:original};
  if(original===0)return {key,text:'امروز سررسید',originalDays:original};
  return {key,text:`${toFa(original)} روز تا سررسید`,originalDays:original};
}
function effectiveActivityProgress(c,a){
  const map=c?.progressByActivity;
  if(map&&Object.prototype.hasOwnProperty.call(map,a.id))return Math.max(0,Math.min(100,Number(map[a.id])||0));
  return Math.max(0,Math.min(100,Number(a?.progress)||0));
}
function contractProgress(c){if(!c.activities?.length)return 0;const total=c.activities.reduce((s,a)=>s+(Number(a.baseScore)||0),0);if(!total)return 0;return +c.activities.reduce((s,a)=>s+(effectiveActivityProgress(c,a)*(Number(a.baseScore)||0)/total),0).toFixed(1)}
function activityWeight(c,a){const total=c.activities.reduce((s,x)=>s+(Number(x.baseScore)||0),0);return total?+(a.baseScore/total*100).toFixed(1):0}
function syncAutoCompleted(c){if(c.activities?.length&&c.activities.every(a=>effectiveActivityProgress(c,a)===100)){c.status='completed';c.completedAt=new Date().toISOString()}else if(c.status==='completed'){c.status='active';delete c.completedAt}}
function statusClass(c){const d=dueState(c);return d.key}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),1800)}

function getContract(id){return state.contracts.find(c=>c.id===id)}
function activeContracts(){return state.contracts.filter(c=>c.status==='active')}

function contractIssueBadge(c){
  const count=Math.max(0,Number(c?.openIssueCount)||0),latest=c?.latestOpenIssue;
  if(!count||!latest?.text)return '';
  return `<div class="contract-issue-preview"><span class="issue-count-badge">${toFa(count)} مورد باز</span><span class="issue-latest-text">${escapeHtml(latest.text)}</span></div>`;
}
function adminContractCard(c){const p=contractProgress(c),ds=dueState(c);const acts=(c.activities||[]).map(a=>`<span class="act-chip">${escapeHtml(a.name)} — ${toFa(effectiveActivityProgress(c,a))}٪</span>`).join('')||'<span class="muted small">هنوز فعالیتی تعریف نشده</span>';return `<article class="contract-card ${statusClass(c)}" data-open-contract="${c.id}">
<div class="contract-top"><div><div class="contract-title">${escapeHtml(c.customerName)}</div><div class="code">کد قلم: ${escapeHtml(c.penCode)}</div></div><div class="amount">${money(c.amount)}</div></div>
<div class="contract-meta"><span class="badge ${ds.key}">${escapeHtml(ds.text)}</span><span class="badge">${escapeHtml(statusLabels[c.status]||'')}</span></div>
${contractIssueBadge(c)}
<div class="progress-row"><span class="small">پیشرفت</span><div class="progress-track"><div class="progress-fill" style="width:${p}%"></div></div><strong>${toFa(p)}٪</strong></div>
<div class="activities-mini">${acts}</div>
<div class="card-actions"><button class="secondary" data-action="view" data-id="${c.id}">مشاهده قرارداد</button><button class="secondary" data-action="edit" data-id="${c.id}">ویرایش</button></div>
</article>`}

function supervisorContractCard(c){const p=contractProgress(c),ds=dueState(c);return `<article class="contract-card supervisor-contract-card ${statusClass(c)}" data-open-contract="${c.id}">
<div class="contract-top"><div><div class="contract-title">${escapeHtml(c.customerName)}</div><div class="code">کد قلم: ${escapeHtml(c.penCode)}</div></div><div class="supervisor-card-status">${escapeHtml(statusLabels[c.status]||'')}</div></div>
<div class="supervisor-contract-due badge ${ds.key}">${escapeHtml(ds.text)}</div>
${contractIssueBadge(c)}
<div class="progress-row supervisor-progress-row"><span class="small">پیشرفت کل</span><div class="progress-track"><div class="progress-fill" style="width:${p}%"></div></div><strong>${toFa(p)}٪</strong></div>
<div class="supervisor-card-foot"><span>${toFa((c.activities||[]).length)} فعالیت</span><span>${money(c.amount)}</span></div>
</article>`}

function contractCard(c){return isSupervisorUi()?supervisorContractCard(c):adminContractCard(c)}


function renderHome(){const active=activeContracts();const near=active.filter(c=>dueState(c).key==='near');const critical=active.filter(c=>['critical','overdue'].includes(dueState(c).key));const avg=active.length?+(active.reduce((s,c)=>s+contractProgress(c),0)/active.length).toFixed(1):0;document.getElementById('kpiGrid').innerHTML=[
 ['فعال',active.length,'blue','active'],['نزدیک سررسید',near.length,'orange','near'],['بحرانی',critical.length,'red','critical'],['میانگین پیشرفت',`${avg}٪`,'','progress']
].map(([l,v,cl,key])=>`<div class="kpi ${cl}" data-kpi="${key}"><div class="label">${l}</div><div class="value">${toFa(v)}</div></div>`).join('');
 const attention=[...critical,...state.contracts.filter(c=>c.status==='stopped'),...near].filter((c,i,a)=>a.findIndex(x=>x.id===c.id)===i);document.getElementById('attentionCount').textContent=attention.length?`${toFa(attention.length)} مورد`:'';document.getElementById('attentionList').innerHTML=attention.length?attention.map(c=>{const ds=dueState(c);return `<div class="attention-item" data-open-contract="${c.id}"><div><strong>${escapeHtml(c.customerName)}</strong><div class="small muted">کد ${escapeHtml(c.penCode)} • پیشرفت ${toFa(contractProgress(c))}٪</div></div><span class="badge ${ds.key}">${escapeHtml(ds.text)}</span></div>`}).join(''):'<div class="empty">مورد نیازمند توجهی وجود ندارد.</div>';
 
 renderCharts(active);
}
function renderCharts(active){const pc=document.getElementById('progressChart');pc.innerHTML=active.length?active.map(c=>{const p=contractProgress(c);return `<div class="bar-row"><div class="small">${escapeHtml(c.customerName)}</div><div class="bar-bg"><div class="bar" style="width:${p}%"></div></div><strong>${toFa(p)}٪</strong></div>`}).join(''):'<div class="empty">داده‌ای برای نمودار پیشرفت وجود ندارد.</div>';
 const counts={active:0,near:0,critical:0,stopped:0};state.contracts.forEach(c=>{if(c.status==='stopped')counts.stopped++;else if(c.status==='active'){const d=dueState(c).key;if(d==='near')counts.near++;else if(d==='critical'||d==='overdue')counts.critical++;else counts.active++;}});const total=Object.values(counts).reduce((a,b)=>a+b,0);document.getElementById('donutTotal').textContent=toFa(total);const colors=['#2563eb','#f59e0b','#dc2626','#6b7280'];let acc=0,parts=[];Object.values(counts).forEach((v,i)=>{const start=total?acc/total*100:0;acc+=v;const end=total?acc/total*100:100;parts.push(`${colors[i]} ${start}% ${end}%`)});document.getElementById('statusDonut').style.background=total?`conic-gradient(${parts.join(',')})`:'#e5e7eb';const labels=[['فعال',counts.active],['نزدیک سررسید',counts.near],['بحرانی',counts.critical],['متوقف',counts.stopped]];document.getElementById('statusLegend').innerHTML=labels.map((x,i)=>`<div class="legend-row"><span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${colors[i]};margin-left:7px"></span>${x[0]}</span><strong>${toFa(x[1])}</strong></div>`).join('')}

function renderContracts(){let arr=[...state.contracts].sort((a,b)=>(jalaliToDate(b.contractDate)||0)-(jalaliToDate(a.contractDate)||0));const name=document.getElementById('filterCustomer').value.trim();const year=normalizeYear(document.getElementById('filterYear').value);const month=document.getElementById('filterMonth').value;const st=document.getElementById('filterStatus').value;if(name)arr=arr.filter(c=>String(c.customerName||'').includes(name));if(st)arr=arr.filter(c=>c.status===st);if(year)arr=arr.filter(c=>normalizeDate(c.contractDate).startsWith(`${year}/`));if(month)arr=arr.filter(c=>{const parts=normalizeDate(c.contractDate).split('/');return parts[1]===month});document.getElementById('contractsList').innerHTML=arr.length?arr.map(contractCard).join(''):'<div class="empty">قراردادی با این فیلتر پیدا نشد.</div>'}

function renderLibrary(){const root=document.getElementById('libraryList');if(!root)return;if(!libraryReady){root.innerHTML='<div class="empty">در حال بارگذاری کتابخانه از Firestore...</div>';return}root.innerHTML=state.library.map(cat=>{const expanded=libraryExpandedCats.has(cat.id);const body=cat.items.length?cat.items.map(a=>`<div class="library-activity"><strong>${escapeHtml(a.name)}</strong><span class="score-pill">حجم ${toFa(a.volume)}</span><span class="score-pill">هزینه ${toFa(a.cost)}</span><span class="score-pill hide-mobile">مدت ${toFa(a.duration)}</span><span class="score-pill hide-mobile">ضریب ${toFa(a.score)}</span><span><button class="secondary" data-lib-edit-act="${a.id}" data-cat="${cat.id}">ویرایش</button> <button class="danger" data-lib-del-act="${a.id}" data-cat="${cat.id}">حذف</button></span></div>`).join(''):'<div class="empty compact-empty">فعالیتی در این دسته نیست.</div>';return `<section class="category-card ${expanded?'open':''}"><div class="category-head"><button class="category-toggle" type="button" data-lib-toggle="${cat.id}" aria-expanded="${expanded?'true':'false'}"><div><strong>${escapeHtml(cat.name)}</strong><div class="small muted">${toFa(cat.items.length)} فعالیت</div></div><span class="category-chevron">${expanded?'▾':'▸'}</span></button><div class="category-actions"><button class="secondary" data-lib-add="${cat.id}">+ فعالیت</button><button class="secondary" data-lib-edit-cat="${cat.id}">ویرایش</button><button class="danger" data-lib-del-cat="${cat.id}">حذف</button></div></div><div class="category-body ${expanded?'':'is-hidden'}">${body}</div></section>`}).join('')}

function renderAll(){renderHome();renderContracts();renderLibrary()}
function switchView(name){
  if(isSupervisorUi()&&['library','more'].includes(name))name='home';
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===name));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===name));
  if(name==='contracts')renderContracts();if(name==='library')renderLibrary();
  window.scrollTo({top:0,behavior:'auto'});
}


function openContractForm(c=null){
  if(!isAdminRole())return;
  document.getElementById('contractForm').reset();
  document.getElementById('contractId').value=c?.id||'';
  document.getElementById('contractModalTitle').textContent=c?'ویرایش قرارداد':'قرارداد جدید';
  contractFormActivities=(c?.activities||[]).map(a=>({...a,progress:c?effectiveActivityProgress(c,a):(Number(a.progress)||0)}));
  contractFormSelectedLibraryActivity=null;
  if(c){customerName.value=c.customerName;penCode.value=c.penCode;contractAmount.value=c.amount;contractDate.value=c.contractDate;endDate.value=c.endDate;compDate.value=c.compDate||'';contractNotes.value=c.notes||''}
  openModal('contractModal');
  renderContractFormActivities();
  wireContractFormActivityPicker();
}
function renderContractFormActivities(){
  const root=document.getElementById('contractFormActivityList');
  if(!root)return;
  root.innerHTML=contractFormActivities.length?contractFormActivities.map(a=>`<div class="form-activity-item"><div><strong>${escapeHtml(a.name)}</strong><div class="small muted">${escapeHtml(a.categoryName||'سایر')} • ضریب ${toFa(a.baseScore||0)}${Number(a.progress)>0?` • پیشرفت ${toFa(a.progress)}٪`:''}</div></div><button type="button" class="danger compact" data-form-remove-activity="${a.id}">حذف</button></div>`).join(''):'<div class="empty compact-empty">هنوز فعالیتی انتخاب نشده است.</div>';
  root.querySelectorAll('[data-form-remove-activity]').forEach(btn=>btn.onclick=()=>{
    const a=contractFormActivities.find(x=>x.id===btn.dataset.formRemoveActivity);
    if(!a)return;
    if(Number(a.progress)>0&&!confirm(`فعالیت «${a.name}» دارای ${toFa(a.progress)}٪ پیشرفت است. از قرارداد حذف شود؟`))return;
    contractFormActivities=contractFormActivities.filter(x=>x.id!==a.id);
    renderContractFormActivities();
    wireContractFormActivityPicker();
  });
}
function wireContractFormActivityPicker(){
  const search=document.getElementById('contractActivitySearch'),box=document.getElementById('contractActivitySuggestions'),add=document.getElementById('addContractActivity');
  if(!search||!box||!add)return;
  search.value='';box.style.display='none';add.disabled=true;contractFormSelectedLibraryActivity=null;
  search.oninput=()=>{
    contractFormSelectedLibraryActivity=null;add.disabled=true;
    const q=search.value.trim();if(!q){box.style.display='none';return}
    const used=new Set(contractFormActivities.map(a=>a.libraryId).filter(Boolean));
    const results=flattenLibrary().filter(a=>!used.has(a.id)&&(a.name.includes(q)||a.categoryName.includes(q))).slice(0,14);
    box.innerHTML=results.length?results.map(a=>`<div class="suggestion" data-form-suggest="${a.id}"><strong>${escapeHtml(a.name)}</strong><div class="small muted">${escapeHtml(a.categoryName)} • ضریب ${toFa(a.score)}</div></div>`).join(''):'<div class="suggestion muted">موردی پیدا نشد</div>';
    box.style.display='block';
    box.querySelectorAll('[data-form-suggest]').forEach(el=>el.onclick=()=>{
      contractFormSelectedLibraryActivity=flattenLibrary().find(a=>a.id===el.dataset.formSuggest)||null;
      if(!contractFormSelectedLibraryActivity)return;
      search.value=contractFormSelectedLibraryActivity.name;box.style.display='none';add.disabled=false;
    });
  };
  add.onclick=()=>{
    const selected=contractFormSelectedLibraryActivity;if(!selected)return;
    contractFormActivities.push({id:uid('ca'),libraryId:selected.id,categoryId:selected.categoryId,categoryName:selected.categoryName,name:selected.name,baseScore:selected.score,progress:0});
    renderContractFormActivities();wireContractFormActivityPicker();toast('فعالیت به قرارداد اضافه شد');
  };
}
function openModal(id){const m=document.getElementById(id);m.classList.add('open');m.setAttribute('aria-hidden','false')}
function closeModal(id){const m=document.getElementById(id);if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true');if(id==='detailModal'){stopHistoryListener();stopIssuesListener()}if(id==='systemLogModal'){if(auditLogUnsub){try{auditLogUnsub()}catch{}auditLogUnsub=null}}}


function flattenLibrary(){return state.library.flatMap(cat=>cat.items.map(a=>({...a,categoryId:cat.id,categoryName:cat.name})))}
function detailDueHtml(c,ds){
  const full=String(ds?.text||'');
  if(!c?.compDate||!full.includes(' | '))return escapeHtml(full);
  const parts=full.split(' | ');
  const original=parts.shift()||'';
  const revised=parts.join(' | ');
  let cls='neutral';
  if(Number.isFinite(ds?.revisedDays)){
    if(ds.revisedDays>0)cls='future';
    else if(ds.revisedDays<0)cls='late';
    else cls='today';
  }
  return `${escapeHtml(original)} <span class="timing-sep">|</span> <span class="comp-date-state ${cls}">${escapeHtml(revised)}</span>`;
}
function activityTitleClass(name=''){
  const n=String(name).length;
  return n>38?'activity-title-xlong':n>28?'activity-title-long':'';
}
function historyDateTime(value){
  try{
    const d=value?.toDate?value.toDate():new Date(value);
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d);
  }catch{return '—';}
}
function historyRoleLabel(role){return role==='siteSupervisor'?'سرپرست اجرا':role==='admin'?'ادمین':roleFa(role)}
function historyEntriesHtml(items,contractId=''){
  if(!items.length)return '<div class="empty compact-empty">هنوز تغییری برای درصد فعالیت‌های این قرارداد ثبت نشده است.</div>';
  return items.map(item=>`<div class="contract-history-entry">
    <div class="history-entry-main"><strong>${escapeHtml(item.activityName||'فعالیت')}</strong><div class="history-progress-change"><span>${toFa(item.oldProgress??0)}٪</span><b>←</b><span>${toFa(item.newProgress??0)}٪</span>${item.action==='done'?'<em>انجام شد</em>':''}</div></div>
    <div class="history-entry-meta"><span>${escapeHtml(item.changedByName||item.changedByEmail||'کاربر')}</span><span>${escapeHtml(historyRoleLabel(item.changedByRole||''))}</span><time>${escapeHtml(historyDateTime(item.changedAt||item.changedAtClient))}</time>${isAdminRole()&&!isSupervisorUi()?`<button type="button" class="history-delete-one" data-history-delete="${item.id}" data-history-contract="${contractId}">حذف</button>`:''}</div>
  </div>`).join('');
}


function sortHistoryItems(items){return [...items].sort((a,b)=>(timestampMs(b.changedAt)||timestampMs(b.changedAtClient))-(timestampMs(a.changedAt)||timestampMs(a.changedAtClient)))}
function renderHistoryPanel(contractId){
  const panel=document.getElementById('contractHistoryPanel');if(!panel||panel.dataset.historyContract!==contractId)return;
  const items=sortHistoryItems(historyCache.get(contractId)||[]);
  panel.innerHTML=`<div class="contract-history-head"><strong>تاریخچه بروزرسانی فعالیت‌ها</strong><div class="history-head-actions"><span>${toFa(items.length)} مورد</span>${isAdminRole()&&!isSupervisorUi()&&items.length?`<button type="button" class="history-clear-all" data-history-clear="${contractId}">پاک کردن تاریخچه</button>`:''}</div></div>${historyEntriesHtml(items,contractId)}`;
  panel.querySelectorAll('[data-history-delete]').forEach(b=>b.onclick=()=>deleteHistoryEntry(contractId,b.dataset.historyDelete));
  panel.querySelector('[data-history-clear]')?.addEventListener('click',()=>clearContractHistory(contractId));
}
function stopHistoryListener(){if(historyUnsub){try{historyUnsub()}catch{}historyUnsub=null}}
async function deleteHistoryEntry(contractId,historyId){
  if(!isAdminRole()||!confirm('این رکورد از تاریخچه قرارداد حذف شود؟'))return;
  const ref=db.collection(CONTRACT_COLLECTION).doc(contractId).collection('history').doc(historyId);
  const item=(historyCache.get(contractId)||[]).find(x=>x.id===historyId);
  try{await ref.delete();writeAuditLog('حذف رکورد تاریخچه',item?`رکورد فعالیت «${item.activityName||'فعالیت'}» از تاریخچه قرارداد حذف شد.`:'یک رکورد از تاریخچه قرارداد حذف شد.',{contractId,kind:'historyDelete'});toast('رکورد تاریخچه حذف شد')}catch(err){toast(firestoreErrorMessage(err))}
}
async function clearContractHistory(contractId){
  if(!isAdminRole()||!confirm('کل تاریخچه این قرارداد پاک شود؟ این عمل قابل بازگشت نیست.'))return;
  try{
    const snap=await db.collection(CONTRACT_COLLECTION).doc(contractId).collection('history').get();
    const docs=snap.docs;
    for(let i=0;i<docs.length;i+=400){const batch=db.batch();docs.slice(i,i+400).forEach(d=>batch.delete(d.ref));await batch.commit()}
    const c=getContract(contractId);writeAuditLog('پاک کردن تاریخچه قرارداد',`تاریخچه قرارداد «${c?.customerName||''}» پاک شد.`,{contractId,contractName:c?.customerName||'',penCode:c?.penCode||'',kind:'historyClear'});toast('تاریخچه قرارداد پاک شد');
  }catch(err){toast(firestoreErrorMessage(err))}
}
function prewarmContractHistory(contractId){
  if(!db||!contractId||historyCache.has(contractId))return;
  const q=db.collection(CONTRACT_COLLECTION).doc(contractId).collection('history');
  q.get({source:'cache'}).then(snap=>{
    if(!snap.empty&&!historyCache.has(contractId))historyCache.set(contractId,snap.docs.map(d=>({id:d.id,...d.data()})));
  }).catch(()=>{});
  q.get().then(snap=>{
    historyCache.set(contractId,snap.docs.map(d=>({id:d.id,...d.data()})));
    const panel=document.getElementById('contractHistoryPanel');
    if(panel&&!panel.classList.contains('is-hidden')&&panel.dataset.historyContract===contractId)renderHistoryPanel(contractId);
  }).catch(()=>{});
}

async function toggleContractHistory(contractId,button){
  const panel=document.getElementById('contractHistoryPanel');if(!panel)return;
  const isOpen=!panel.classList.contains('is-hidden');
  if(isOpen){panel.classList.add('is-hidden');if(button)button.textContent='تاریخچه تغییرات';stopHistoryListener();return;}
  panel.classList.remove('is-hidden');if(button)button.textContent='بستن تاریخچه';
  if(historyCache.has(contractId))renderHistoryPanel(contractId);else panel.innerHTML='<div class="history-loading">در حال دریافت تاریخچه...</div>';
  stopHistoryListener();
  historyUnsub=db.collection(CONTRACT_COLLECTION).doc(contractId).collection('history').onSnapshot({includeMetadataChanges:true},snap=>{
    const items=snap.docs.map(d=>({id:d.id,...d.data()}));historyCache.set(contractId,items);renderHistoryPanel(contractId);
  },err=>{if(!historyCache.has(contractId))panel.innerHTML=`<div class="empty compact-empty">${escapeHtml(firestoreErrorMessage(err))}</div>`});
}


function issueOwnerCanManage(issue){return (isAdminRole()&&!isSupervisorUi())||issue?.createdByUid===currentAdmin?.uid}
function issueSortMs(i){return timestampMs(i?.updatedAt)||timestampMs(i?.createdAt)||timestampMs(i?.updatedAtClient)||timestampMs(i?.createdAtClient)}
function issueSummary(items){
  const open=[...(items||[])].filter(x=>x.status!=='done').sort((a,b)=>issueSortMs(b)-issueSortMs(a));
  return {openIssueCount:open.length,latestOpenIssue:open[0]?{id:open[0].id,text:String(open[0].text||''),createdByName:String(open[0].createdByName||open[0].createdByEmail||''),atClient:open[0].updatedAtClient||open[0].createdAtClient||''}:null};
}
function issueListHtml(contractId){
  const items=[...(issuesCache.get(contractId)||[])].sort((a,b)=>(a.status==='done')-(b.status==='done')||issueSortMs(b)-issueSortMs(a));
  if(!items.length)return '<div class="empty compact-empty">هنوز مورد یا مشکلی ثبت نشده است.</div>';
  return items.map(i=>`<div class="contract-issue-row ${i.status==='done'?'done':''}" data-issue-id="${i.id}"><div class="issue-row-main"><div class="issue-row-title"><span class="issue-status ${i.status==='done'?'done':'open'}">${i.status==='done'?'انجام شد':'باز'}</span><strong>${escapeHtml(i.text||'')}</strong></div><div class="issue-row-meta">${escapeHtml(i.createdByName||i.createdByEmail||'کاربر')} • ${escapeHtml(historyDateTime(i.updatedAt||i.createdAt||i.updatedAtClient||i.createdAtClient))}</div></div>${issueOwnerCanManage(i)?`<div class="issue-row-actions"><button type="button" class="secondary" data-issue-edit="${i.id}">ویرایش</button>${i.status!=='done'?`<button type="button" class="secondary" data-issue-done="${i.id}">انجام شد</button>`:''}<button type="button" class="danger" data-issue-delete="${i.id}">حذف</button></div>`:''}</div>`).join('');
}
function issuesSectionHtml(contractId){return `<section class="panel contract-issues-panel" style="box-shadow:none"><div class="section-head"><div><h3>موارد و مشکلات</h3><span class="muted small">موارد اجرایی این قرارداد</span></div></div><div class="issue-compose"><textarea id="newIssueText" rows="2" placeholder="مورد یا مشکل را بنویسید..."></textarea><button type="button" class="primary" id="addIssueBtn">ثبت مورد</button></div><div id="contractIssuesList" class="contract-issues-list"><div class="history-loading">در حال دریافت موارد...</div></div></section>`}
function renderIssuesPanel(contractId){const box=document.getElementById('contractIssuesList');if(!box)return;box.innerHTML=issueListHtml(contractId);wireIssueActions(contractId)}
function stopIssuesListener(){if(issuesUnsub){try{issuesUnsub()}catch{}issuesUnsub=null}}
function startIssuesRealtime(contractId){
  stopIssuesListener();if(issuesCache.has(contractId))renderIssuesPanel(contractId);
  issuesUnsub=db.collection(CONTRACT_COLLECTION).doc(contractId).collection('issues').onSnapshot({includeMetadataChanges:true},snap=>{
    const items=snap.docs.map(d=>({id:d.id,...d.data()}));issuesCache.set(contractId,items);renderIssuesPanel(contractId);
    const summary=issueSummary(items),c=getContract(contractId);if(c){c.openIssueCount=summary.openIssueCount;c.latestOpenIssue=summary.latestOpenIssue;renderContracts()}
  },err=>{const box=document.getElementById('contractIssuesList');if(box&&!issuesCache.has(contractId))box.innerHTML=`<div class="empty compact-empty">${escapeHtml(firestoreErrorMessage(err))}</div>`});
}
function applyIssueSummaryLocal(contractId,items){
  issuesCache.set(contractId,items);const summary=issueSummary(items),c=getContract(contractId);if(c){c.openIssueCount=summary.openIssueCount;c.latestOpenIssue=summary.latestOpenIssue;renderContracts()}renderIssuesPanel(contractId);return summary;
}
function writeIssueMutation(contractId,nextItems,issueWrite,auditTitle,auditDetail,auditExtra={}){
  const summary=applyIssueSummaryLocal(contractId,nextItems);const batch=db.batch();issueWrite(batch);
  batch.set(db.collection(CONTRACT_COLLECTION).doc(contractId),{openIssueCount:summary.openIssueCount,latestOpenIssue:summary.latestOpenIssue,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:currentAdmin?.uid||'',appVersion:APP_VERSION},{merge:true});
  const c=getContract(contractId);addAuditToBatch(batch,auditTitle,auditDetail,{contractId,contractName:c?.customerName||'',penCode:c?.penCode||'',...auditExtra});
  batch.commit().catch(err=>{if(String(err?.code||'').includes('permission-denied'))toast('ذخیره مورد مجاز نشد.')});
}
function addContractIssue(contractId,text){
  text=String(text||'').trim();if(!text)return toast('متن مورد یا مشکل را وارد کنید.');
  const ref=db.collection(CONTRACT_COLLECTION).doc(contractId).collection('issues').doc();const now=new Date().toISOString();
  const item={id:ref.id,contractId,text,status:'open',createdByUid:currentAdmin?.uid||'',createdByName:currentAdmin?.name||'',createdByEmail:currentAdmin?.email||'',createdByRole:currentRole(),createdAtClient:now,updatedAtClient:now};
  const next=[item,...(issuesCache.get(contractId)||[])];
  writeIssueMutation(contractId,next,batch=>batch.set(ref,{...item,createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()}),'ثبت مشکل',`مورد «${text}» ثبت شد.`,{kind:'issueCreate',issueId:ref.id});
  const input=document.getElementById('newIssueText');if(input)input.value='';toast('مورد ثبت شد');
}
function editContractIssue(contractId,issueId){
  const issue=(issuesCache.get(contractId)||[]).find(x=>x.id===issueId);if(!issue||!issueOwnerCanManage(issue))return;
  showPrompt('ویرایش مورد',`<form id="editIssueForm"><label>شرح مورد<textarea id="editIssueText" rows="3" required>${escapeHtml(issue.text||'')}</textarea></label><div class="form-actions" style="margin-top:12px"><button type="button" class="secondary" data-close-prompt>انصراف</button><button class="primary">ذخیره</button></div></form>`);
  document.getElementById('editIssueForm').onsubmit=e=>{e.preventDefault();const text=document.getElementById('editIssueText').value.trim();if(!text)return;const old=issue.text;const now=new Date().toISOString();const next=(issuesCache.get(contractId)||[]).map(x=>x.id===issueId?{...x,text,updatedAtClient:now}:x);const ref=db.collection(CONTRACT_COLLECTION).doc(contractId).collection('issues').doc(issueId);writeIssueMutation(contractId,next,b=>b.set(ref,{text,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAtClient:now},{merge:true}),'ویرایش مشکل',`مورد «${old}» به «${text}» ویرایش شد.`,{kind:'issueEdit',issueId});closeModal('promptModal');toast('مورد ویرایش شد')};
}
function completeContractIssue(contractId,issueId){
  const issue=(issuesCache.get(contractId)||[]).find(x=>x.id===issueId);if(!issue||!issueOwnerCanManage(issue))return;const now=new Date().toISOString();const next=(issuesCache.get(contractId)||[]).map(x=>x.id===issueId?{...x,status:'done',updatedAtClient:now}:x);const ref=db.collection(CONTRACT_COLLECTION).doc(contractId).collection('issues').doc(issueId);writeIssueMutation(contractId,next,b=>b.set(ref,{status:'done',completedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAtClient:now},{merge:true}),'بستن مشکل',`مورد «${issue.text||''}» انجام شد.`,{kind:'issueDone',issueId});toast('مورد انجام شد');
}
function deleteContractIssue(contractId,issueId){
  const issue=(issuesCache.get(contractId)||[]).find(x=>x.id===issueId);if(!issue||!issueOwnerCanManage(issue)||!confirm('این مورد حذف شود؟'))return;const next=(issuesCache.get(contractId)||[]).filter(x=>x.id!==issueId);const ref=db.collection(CONTRACT_COLLECTION).doc(contractId).collection('issues').doc(issueId);writeIssueMutation(contractId,next,b=>b.delete(ref),'حذف مشکل',`مورد «${issue.text||''}» حذف شد.`,{kind:'issueDelete',issueId});toast('مورد حذف شد');
}
function wireIssueActions(contractId){
  document.querySelectorAll('[data-issue-edit]').forEach(b=>b.onclick=()=>editContractIssue(contractId,b.dataset.issueEdit));
  document.querySelectorAll('[data-issue-done]').forEach(b=>b.onclick=()=>completeContractIssue(contractId,b.dataset.issueDone));
  document.querySelectorAll('[data-issue-delete]').forEach(b=>b.onclick=()=>deleteContractIssue(contractId,b.dataset.issueDelete));
}
function wireIssueComposer(contractId){const btn=document.getElementById('addIssueBtn');if(btn)btn.onclick=()=>addContractIssue(contractId,document.getElementById('newIssueText')?.value||'');startIssuesRealtime(contractId)}
function supervisorActivityRow(c,a){
  const progress=effectiveActivityProgress(c,a),done=progress===100;
  return `<div class="supervisor-activity-row ${done?'done':''}" data-activity-row="${a.id}">
    <div class="supervisor-activity-title"><strong>${escapeHtml(a.name)}</strong><span>پیشرفت فعلی: ${toFa(progress)}٪</span></div>
    <div class="supervisor-activity-controls">
      <div class="supervisor-progress-editor"><input type="number" inputmode="decimal" min="0" max="100" value="${progress}" data-supervisor-progress="${a.id}" aria-label="درصد پیشرفت ${escapeHtml(a.name)}"><span>٪</span><button type="button" class="save-progress-v2" data-supervisor-save="${a.id}">ثبت</button></div>
      <button type="button" class="done-act-v2 ${done?'is-done':''}" data-supervisor-done="${a.id}" ${done?'disabled':''}>انجام شد</button>
    </div>
  </div>`;
}
function openSupervisorDetail(id){
  const c=getContract(id);if(!c)return;stopHistoryListener();stopIssuesListener();prewarmContractHistory(id);
  const p=contractProgress(c),ds=dueState(c);
  document.getElementById('detailTitle').textContent=c.customerName;
  document.getElementById('detailSubtitle').textContent=`کد قلم ${c.penCode} • ${statusLabels[c.status]}`;
  const sorted=[...(c.activities||[])].sort((a,b)=>(effectiveActivityProgress(c,a)===100)-(effectiveActivityProgress(c,b)===100));
  document.getElementById('detailContent').innerHTML=`
  <div class="detail-summary-v2 supervisor-summary"><div class="detail-summary-main"><div class="summary-box compact-summary"><span>مبلغ قرارداد</span><strong>${money(c.amount)}</strong></div><div class="summary-box compact-summary"><span>پیشرفت کل</span><strong class="detail-total-progress">${toFa(p)}٪</strong></div><div class="summary-box compact-summary"><span>وضعیت قرارداد</span><strong>${statusLabels[c.status]}</strong></div></div><div class="timing-strip"><span>وضعیت زمانی</span><strong>${detailDueHtml(c,ds)}</strong></div></div>
  <div class="supervisor-detail-tools"><button class="secondary history-toggle-btn" data-toggle-history="${c.id}">تاریخچه تغییرات</button></div>
  <div id="contractHistoryPanel" class="contract-history-panel is-hidden" data-history-contract="${c.id}"></div>
  <section class="panel supervisor-activities-panel" style="box-shadow:none"><div class="section-head"><h3>فعالیت‌ها</h3><span class="muted small">درصد را وارد و «ثبت» را بزنید</span></div><div class="supervisor-activity-list">${sorted.length?sorted.map(a=>supervisorActivityRow(c,a)).join(''):'<div class="empty">فعالیتی برای این قرارداد تعریف نشده است.</div>'}</div></section>
  ${issuesSectionHtml(c.id)}
  ${c.notes?`<section class="panel supervisor-notes" style="box-shadow:none"><h3>توضیحات</h3><p>${escapeHtml(c.notes)}</p></section>`:''}`;
  openModal('detailModal');wireSupervisorDetail(c);wireIssueComposer(c.id);
}

function wireSupervisorDetail(c){
  document.querySelectorAll('[data-supervisor-progress]').forEach(inp=>{const selectAll=()=>window.setTimeout(()=>{try{inp.select()}catch{}},0);inp.addEventListener('focus',selectAll);inp.addEventListener('click',()=>{if(document.activeElement===inp)selectAll()});inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.querySelector(`[data-supervisor-save="${inp.dataset.supervisorProgress}"]`)?.click()}})});
  document.querySelectorAll('[data-supervisor-save]').forEach(btn=>btn.onclick=async()=>{const id=btn.dataset.supervisorSave,inp=document.querySelector(`[data-supervisor-progress="${id}"]`),a=(c.activities||[]).find(x=>x.id===id);if(!inp||!a)return;const value=Math.max(0,Math.min(100,Number(inp.value)||0));inp.value=value;const result=await updateActivityProgressRemote(c,id,value,'manual');if(result.changed){toast(navigator.onLine?'درصد ثبت شد':'درصد ذخیره شد؛ پس از اتصال همگام می‌شود')}else toast('درصد تغییری نکرده است')});
  document.querySelectorAll('[data-supervisor-done]').forEach(btn=>btn.onclick=async()=>{const id=btn.dataset.supervisorDone;if(!(c.activities||[]).some(a=>a.id===id))return;const result=await updateActivityProgressRemote(c,id,100,'done');if(result.changed){toast(navigator.onLine?'فعالیت انجام شد':'انجام شد؛ پس از اتصال همگام می‌شود')}});
  document.querySelector('[data-toggle-history]')?.addEventListener('click',e=>toggleContractHistory(c.id,e.currentTarget));
}

function openDetail(id){if(isSupervisorUi())return openSupervisorDetail(id);return openAdminDetail(id)}

function openAdminDetail(id){
  const c=getContract(id);if(!c)return;stopHistoryListener();stopIssuesListener();prewarmContractHistory(id);
  const p=contractProgress(c),ds=dueState(c);
  document.getElementById('detailTitle').textContent=c.customerName;document.getElementById('detailSubtitle').textContent=`کد قلم ${c.penCode} • ${statusLabels[c.status]}`;
  const sorted=[...(c.activities||[])].sort((a,b)=>(effectiveActivityProgress(c,a)===100)-(effectiveActivityProgress(c,b)===100));
  document.getElementById('detailContent').innerHTML=`
<div class="detail-summary-v2"><div class="detail-summary-main"><div class="summary-box compact-summary"><span>مبلغ قرارداد</span><strong>${money(c.amount)}</strong></div><div class="summary-box compact-summary"><span>پیشرفت کل</span><strong class="detail-total-progress">${toFa(p)}٪</strong></div><div class="summary-box compact-summary"><span>وضعیت قرارداد</span><strong>${statusLabels[c.status]}</strong></div></div><div class="timing-strip"><span>وضعیت زمانی</span><strong>${detailDueHtml(c,ds)}</strong></div></div>
<div class="detail-toolbar"><button class="secondary" data-detail-edit="${c.id}">ویرایش اطلاعات قرارداد</button><button class="secondary" data-status-change="${c.id}">تغییر وضعیت</button><button class="secondary history-toggle-btn" data-toggle-history="${c.id}">تاریخچه تغییرات</button></div>
<div id="contractHistoryPanel" class="contract-history-panel is-hidden" data-history-contract="${c.id}"></div>
<section class="panel detail-activities-panel" style="box-shadow:none"><div class="section-head"><h3>فعالیت‌ها</h3><span class="muted small">جمع وزن‌ها: ۱۰۰٪</span></div><div class="activity-add"><input id="activitySearch" placeholder="جستجو در کتابخانه؛ مثلاً سقف" autocomplete="off"><button class="primary" id="addSelectedActivity" disabled>+ اضافه کردن</button><div id="activitySuggestions" class="suggestions" style="display:none"></div></div><div class="activity-table" id="activityRows">${sorted.length?sorted.map(a=>activityRow(c,a)).join(''):'<div class="empty">هنوز فعالیتی برای این قرارداد تعریف نشده.</div>'}</div></section>
${issuesSectionHtml(c.id)}
${c.notes?`<section class="panel" style="box-shadow:none"><h3>توضیحات</h3><p>${escapeHtml(c.notes)}</p></section>`:''}`;
  openModal('detailModal');wireDetail(c);wireIssueComposer(c.id);
}

function activityRow(c,a){
  const cat=state.library.find(x=>x.id===a.categoryId)?.name||a.categoryName||'سایر';
  const w=activityWeight(c,a);
  const progress=effectiveActivityProgress(c,a);
  const done=progress===100;
  return `<div class="activity-row-v2 ${done?'done':''}" data-activity-row="${a.id}">
    <div class="activity-top-v2">
      <div class="activity-name-v2">
        <strong class="activity-title-text ${activityTitleClass(a.name)}">${escapeHtml(a.name)}</strong>
        <div class="activity-meta-v2"><span>${escapeHtml(cat)}</span><span>وزن <b>${toFa(w)}٪</b></span><span>ضریب <b>${toFa(a.baseScore)}</b></span></div>
      </div>
    </div>
    <div class="activity-bottom-v2">
      <div class="activity-actions-v2">
        <button type="button" title="حذف فعالیت" class="delete-act-v2" data-del-act="${a.id}">حذف</button>
        <button type="button" title="ویرایش فعالیت" class="edit-act-v2" data-edit-act="${a.id}">ویرایش</button>
        <button type="button" title="تکمیل مستقیم فعالیت" class="done-act-v2 ${done?'is-done':''}" data-done="${a.id}" ${done?'disabled':''}>انجام شد</button>
      </div>
      <div class="progress-editor-v2">
        <input type="number" inputmode="decimal" min="0" max="100" value="${progress}" data-progress="${a.id}" aria-label="درصد پیشرفت ${escapeHtml(a.name)}">
        <span class="progress-percent-sign">٪</span>
        <button type="button" class="save-progress-v2" data-save-progress="${a.id}">ثبت</button>
      </div>
    </div>
  </div>`;
}
function wireDetail(c){
  let selected=null;
  const search=document.getElementById('activitySearch'),box=document.getElementById('activitySuggestions'),add=document.getElementById('addSelectedActivity');
  search.addEventListener('input',()=>{
    selected=null;add.disabled=true;
    const q=search.value.trim();if(!q){box.style.display='none';return}
    const used=new Set((c.activities||[]).map(a=>a.libraryId));
    const results=flattenLibrary().filter(a=>!used.has(a.id)&&(a.name.includes(q)||a.categoryName.includes(q))).slice(0,12);
    box.innerHTML=results.length?results.map(a=>`<div class="suggestion" data-suggest="${a.id}"><strong>${escapeHtml(a.name)}</strong><div class="small muted">${escapeHtml(a.categoryName)} • ضریب ${toFa(a.score)}</div></div>`).join(''):'<div class="suggestion muted">موردی پیدا نشد</div>';
    box.style.display='block';
    box.querySelectorAll('[data-suggest]').forEach(el=>el.onclick=()=>{selected=flattenLibrary().find(a=>a.id===el.dataset.suggest);search.value=selected.name;box.style.display='none';add.disabled=false});
  });
  add.onclick=async()=>{
    if(!selected)return;add.disabled=true;
    c.activities=c.activities||[];
    c.activities.push({id:uid('ca'),libraryId:selected.id,categoryId:selected.categoryId,categoryName:selected.categoryName,name:selected.name,baseScore:selected.score,progress:0});
    try{await persistContract(c);writeAuditLog('افزودن فعالیت',`فعالیت «${selected.name}» به قرارداد اضافه شد.`,{contractId:c.id,contractName:c.customerName||'',penCode:c.penCode||'',activityName:selected.name,kind:'activityCreate'});openDetail(c.id);toast('فعالیت اضافه شد')}catch(err){toast(firestoreErrorMessage(err));add.disabled=false}
  };
  document.querySelectorAll('[data-progress]').forEach(inp=>{
    const selectAll=()=>window.setTimeout(()=>{try{inp.select()}catch{}},0);
    inp.addEventListener('focus',selectAll);
    inp.addEventListener('click',()=>{if(document.activeElement===inp)selectAll()});
    inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.querySelector(`[data-save-progress="${inp.dataset.progress}"]`)?.click();}});
  });
  document.querySelectorAll('[data-save-progress]').forEach(b=>b.onclick=async()=>{
    const id=b.dataset.saveProgress;
    const inp=document.querySelector(`[data-progress="${id}"]`);
    const a=c.activities.find(x=>x.id===id);if(!a||!inp)return;
    const value=Math.max(0,Math.min(100,Number(inp.value)||0));
    inp.value=value;b.disabled=true;
    try{const result=await updateActivityProgressRemote(c,id,value,'manual');b.disabled=false;if(result.changed){toast(navigator.onLine?'درصد ثبت شد':'درصد ذخیره شد؛ پس از اتصال همگام می‌شود')}else toast('درصد تغییری نکرده است')}catch(err){toast(firestoreErrorMessage(err));b.disabled=false}
  });
  document.querySelectorAll('[data-done]').forEach(b=>b.onclick=async()=>{
    b.disabled=true;
    const a=c.activities.find(x=>x.id===b.dataset.done);if(!a)return;
    try{await updateActivityProgressRemote(c,a.id,100,'done');toast(navigator.onLine?'فعالیت انجام شد':'انجام شد؛ پس از اتصال همگام می‌شود')}catch(err){toast(firestoreErrorMessage(err));b.disabled=false}
  });
  document.querySelectorAll('[data-edit-act]').forEach(b=>b.onclick=()=>editContractActivity(c,b.dataset.editAct));
  document.querySelectorAll('[data-del-act]').forEach(b=>b.onclick=()=>deleteContractActivity(c,b.dataset.delAct));
  document.querySelector('[data-detail-edit]')?.addEventListener('click',()=>{closeModal('detailModal');openContractForm(c)});
  document.querySelector('[data-status-change]')?.addEventListener('click',()=>openStatusPrompt(c));
  document.querySelector('[data-toggle-history]')?.addEventListener('click',e=>toggleContractHistory(c.id,e.currentTarget));
}
function editContractActivity(c,id){const a=c.activities.find(x=>x.id===id);showPrompt('ویرایش نام فعالیت',`<form id="editActForm"><label>نام فعالیت<input id="editActName" value="${escapeHtml(a.name)}" required></label><div class="form-actions" style="margin-top:12px"><button type="button" class="secondary" data-close-prompt>انصراف</button><button class="primary">ذخیره</button></div></form>`);document.getElementById('editActForm').onsubmit=async e=>{e.preventDefault();const btn=e.submitter;if(btn)btn.disabled=true;a.name=document.getElementById('editActName').value.trim();try{await persistContract(c);writeAuditLog('ویرایش فعالیت قرارداد',`نام فعالیت قرارداد به «${a.name}» تغییر کرد.`,{contractId:c.id,contractName:c.customerName||'',penCode:c.penCode||'',activityName:a.name,kind:'activityEdit'});closeModal('promptModal');openDetail(c.id)}catch(err){toast(firestoreErrorMessage(err));if(btn)btn.disabled=false}}}
function deleteContractActivity(c,id){const a=c.activities.find(x=>x.id===id);const currentProgress=effectiveActivityProgress(c,a);const msg=currentProgress>0?`این فعالیت دارای ${toFa(currentProgress)}٪ پیشرفت ثبت‌شده است. مطمئن هستید؟`:'این فعالیت حذف شود؟';showPrompt('حذف فعالیت',`<div class="danger-note"><strong>${escapeHtml(a.name)}</strong><br>${msg}</div><div class="form-actions" style="margin-top:14px"><button class="secondary" data-close-prompt>لغو</button><button class="danger" id="confirmDeleteActivity">حذف فعالیت</button></div>`);document.getElementById('confirmDeleteActivity').onclick=async()=>{const btn=document.getElementById('confirmDeleteActivity');btn.disabled=true;c.activities=c.activities.filter(x=>x.id!==id);if(c.progressByActivity)delete c.progressByActivity[id];try{await persistContract(c);writeAuditLog('حذف فعالیت',`فعالیت «${a.name||''}» از قرارداد حذف شد.`,{contractId:c.id,contractName:c.customerName||'',penCode:c.penCode||'',activityName:a.name||'',kind:'activityDelete'});closeModal('promptModal');openDetail(c.id);toast('فعالیت حذف شد')}catch(err){toast(firestoreErrorMessage(err));btn.disabled=false}}}
function openStatusPrompt(c){showPrompt('تغییر وضعیت قرارداد',`<form id="statusForm"><label>وضعیت<select id="newStatus"><option value="active">فعال</option><option value="stopped">متوقف</option><option value="terminated">فسخ‌شده</option>${c.status==='completed'?'<option value="completed">خاتمه‌یافته</option>':''}</select></label><div id="reasonWrap" class="reason-box" style="display:none"><label>علت<input id="statusReason"></label><label style="display:block;margin-top:8px">تاریخ<input id="statusDate" placeholder="۱۴۰۵/۰۷/۰۱"></label></div><div class="form-actions" style="margin-top:14px"><button type="button" class="secondary" data-close-prompt>انصراف</button><button class="primary">ذخیره</button></div></form>`);const sel=document.getElementById('newStatus');sel.value=c.status==='completed'?'completed':c.status;const rw=document.getElementById('reasonWrap');const toggle=()=>rw.style.display=['stopped','terminated'].includes(sel.value)?'block':'none';sel.onchange=toggle;toggle();document.getElementById('statusForm').onsubmit=async e=>{e.preventDefault();const btn=e.submitter;if(btn)btn.disabled=true;if(['stopped','terminated'].includes(sel.value)){const r=document.getElementById('statusReason').value.trim(),d=normalizeDate(document.getElementById('statusDate').value);if(!r||!d){if(btn)btn.disabled=false;return toast('علت و تاریخ الزامی است')}c.statusReason=r;c.statusDate=d}else{c.statusReason='';c.statusDate=''}c.status=sel.value;try{await updateContractRemote(c.id,c);writeAuditLog('تغییر وضعیت قرارداد',`وضعیت قرارداد «${c.customerName||''}» به «${statusLabels[c.status]||c.status}» تغییر کرد.`,{contractId:c.id,contractName:c.customerName||'',penCode:c.penCode||'',kind:'contractStatus'});closeModal('promptModal');openDetail(c.id);renderAll()}catch(err){toast(firestoreErrorMessage(err));if(btn)btn.disabled=false}}}
function showPrompt(title,html){document.getElementById('promptTitle').textContent=title;document.getElementById('promptBody').innerHTML=html;openModal('promptModal');document.querySelectorAll('[data-close-prompt]').forEach(b=>b.onclick=()=>closeModal('promptModal'))}

function libraryPrompt(cat=null,act=null){
  const categoryOptions=state.library.map(c=>`<option value="${c.id}" ${act?.categoryId===c.id||(!act&&cat?.id===c.id)?'selected':''}>${escapeHtml(c.name)}</option>`).join('');
  if(act){
    showPrompt('ویرایش فعالیت',`<form id="libActForm"><label>نام فعالیت<input id="laName" value="${escapeHtml(act.name)}" required></label><label>دسته<select id="laCategory">${categoryOptions}</select></label><div class="status-form"><label>حجم کار (۱ تا ۱۰)<input id="laVolume" type="number" min="1" max="10" value="${act.volume}" required></label><label>هزینه (۱ تا ۱۰)<input id="laCost" type="number" min="1" max="10" value="${act.cost}" required></label><label>مدت (۱ تا ۱۰)<input id="laDuration" type="number" min="1" max="10" value="${act.duration}" required></label><label>ضریب نهایی<input value="${act.score}" disabled></label></div><div class="form-actions" style="margin-top:14px"><button type="button" class="secondary" data-close-prompt>انصراف</button><button class="primary">ذخیره</button></div></form>`);
    document.getElementById('libActForm').onsubmit=async e=>{
      e.preventDefault();
      const btn=e.submitter; if(btn)btn.disabled=true;
      try{
        await updateActivityRemote(act.id,{name:document.getElementById('laName').value.trim(),categoryId:document.getElementById('laCategory').value,volume:+document.getElementById('laVolume').value,cost:+document.getElementById('laCost').value,duration:+document.getElementById('laDuration').value});
        closeModal('promptModal');toast('فعالیت در Firestore ویرایش شد');
      }catch(err){toast(firestoreErrorMessage(err));if(btn)btn.disabled=false;}
    };
  }else{
    showPrompt('افزودن فعالیت',`<form id="libActForm"><label>نام فعالیت<input id="laName" required></label><label>دسته<select id="laCategory">${categoryOptions}</select></label><div class="status-form"><label>حجم کار (۱ تا ۱۰)<input id="laVolume" type="number" min="1" max="10" value="5" required></label><label>هزینه (۱ تا ۱۰)<input id="laCost" type="number" min="1" max="10" value="5" required></label><label>مدت (۱ تا ۱۰)<input id="laDuration" type="number" min="1" max="10" value="5" required></label></div><div class="form-actions" style="margin-top:14px"><button type="button" class="secondary" data-close-prompt>انصراف</button><button class="primary">اضافه کردن</button></div></form>`);
    document.getElementById('libActForm').onsubmit=async e=>{
      e.preventDefault();
      const btn=e.submitter; if(btn)btn.disabled=true;
      try{
        await createActivityRemote(document.getElementById('laCategory').value,{name:document.getElementById('laName').value.trim(),volume:+document.getElementById('laVolume').value,cost:+document.getElementById('laCost').value,duration:+document.getElementById('laDuration').value});
        closeModal('promptModal');toast('فعالیت در Firestore اضافه شد');
      }catch(err){toast(firestoreErrorMessage(err));if(btn)btn.disabled=false;}
    };
  }
}


function normalizeUserEmail(email){return String(email||'').trim().toLowerCase();}
function userState(u){
  if(u.role==='blocked'||u.blocked===true)return 'blocked';
  if(u.role==='pending'||u.active!==true)return 'pending';
  return 'active';
}
function groupUsersByEmail(rows){
  const groups=new Map();rows.forEach(u=>{if(u.hidden===true)return;const key=normalizeUserEmail(u.email)||('__uid__'+u.id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(u)});
  return [...groups.values()].map(group=>{
    const self=group.find(x=>x.id===currentAdmin?.uid),active=group.find(x=>userState(x)==='active'),blocked=group.find(x=>userState(x)==='blocked'),pending=group.find(x=>userState(x)==='pending');
    const base=self||active||blocked||pending||group[0],chosenState=active?'active':blocked?'blocked':'pending',source=chosenState==='active'?active:(chosenState==='blocked'?blocked:pending)||base;
    const newestActive=[...group].sort((a,b)=>timestampMs(b.lastActiveAt)-timestampMs(a.lastActiveAt))[0];const newestSeen=[...group].sort((a,b)=>timestampMs(b.lastSeenAt)-timestampMs(a.lastSeenAt))[0];
    return {...base,...source,id:base.id,email:source?.email||base.email||'',lastActiveAt:newestActive?.lastActiveAt||source?.lastActiveAt,lastSeenAt:newestSeen?.lastSeenAt||source?.lastSeenAt,_docIds:group.map(x=>x.id),_duplicateCount:group.length,_state:chosenState};
  }).sort((a,b)=>{const ap=isUserOnline(a)?0:a._state==='pending'?1:a._state==='active'?2:3,bp=isUserOnline(b)?0:b._state==='pending'?1:b._state==='active'?2:3;return ap-bp||normalizeUserEmail(a.email).localeCompare(normalizeUserEmail(b.email))});
}

async function updateUserGroup(u,payload){
  const ids=(u?._docIds?.length?u._docIds:[u?.id]).filter(Boolean);
  if(!ids.length)return;
  const batch=db.batch();
  ids.forEach(id=>batch.set(db.collection('users').doc(id),payload,{merge:true}));
  await batch.commit();
}

function stopUsersAdminRealtime(){if(usersAdminUnsub){try{usersAdminUnsub()}catch{}usersAdminUnsub=null}if(usersPresenceTimer){clearInterval(usersPresenceTimer);usersPresenceTimer=null}}
function closeUsersAdmin(){stopUsersAdminRealtime();closeModal('usersModal')}
function userPresenceHtml(u){if(isUserOnline(u))return '<span class="user-presence online"><i></i> آنلاین</span>';const v=u.lastSeenAt||u.lastActiveAt;return `<span class="user-presence offline">آخرین بازدید: ${escapeHtml(presenceDateTime(v))}</span>`}
async function openUsersAdmin(){
  if(!db||!currentAdmin||!isAdminRole())return;openModal('usersModal');const box=document.getElementById('usersAdminList');if(box)box.innerHTML='<div class="empty">در حال دریافت کاربران...</div>';stopUsersAdminRealtime();
  usersAdminUnsub=db.collection('users').onSnapshot({includeMetadataChanges:true},snap=>{usersAdminRawCache=snap.docs.map(d=>({id:d.id,...d.data()}));usersAdminCache=groupUsersByEmail(usersAdminRawCache);renderUsersAdmin()},err=>{if(box)box.innerHTML=`<div class="empty">${escapeHtml(authErrorMessage(err))}</div>`});
  usersPresenceTimer=setInterval(renderUsersAdmin,30000);
}

function renderUsersAdmin(){
  const box=document.getElementById('usersAdminList');if(!box)return;if(!usersAdminCache.length){box.innerHTML='<div class="empty">هنوز کاربری ثبت نشده است.</div>';return;}
  box.innerHTML=usersAdminCache.map(u=>{
    const self=(u._docIds||[u.id]).includes(currentAdmin?.uid),state=u._state||userState(u),stateLabel=state==='blocked'?'مسدود':state==='pending'?'در انتظار تأیید':'فعال';const actions=[];
    if(!self){actions.push(`<button class="secondary" type="button" data-user-approve="${u.id}">${state==='pending'?'تأیید و تعیین نقش':'ویرایش نقش'}</button>`);if(state==='blocked'){actions.push(`<button class="secondary" type="button" data-user-enable="${u.id}">فعال‌سازی</button>`);actions.push(`<button class="danger" type="button" data-user-delete="${u.id}">حذف</button>`)}else actions.push(`<button class="danger" type="button" data-user-block="${u.id}">مسدود</button>`)}actions.push(`<button class="text-btn" type="button" data-user-reset="${u.id}">بازیابی رمز</button>`);
    return `<div class="user-access-row"><div class="user-access-main"><strong class="user-access-email">${escapeHtml(u.email||'')}</strong><div class="user-primary-line"><span class="user-display-name">${escapeHtml(u.name||'بدون نام')}</span><span class="user-role-pill">${escapeHtml(roleFa(u.role))}${self?' · شما':''}</span><span class="user-state-pill ${state}">${stateLabel}</span></div><div class="user-access-meta">${userPresenceHtml(u)}</div></div><div class="user-access-actions">${actions.join('')}</div></div>`;
  }).join('');
}

function userById(uid){return usersAdminCache.find(u=>u.id===uid||(u._docIds||[]).includes(uid));}
function openUserApprove(uid){
  const u=userById(uid);if(!u)return;
  const role=(u.role&&u.role!=='pending'&&u.role!=='blocked')?u.role:'projectManager';
  showPrompt('تأیید و تعیین نقش',`<form id="userApproveForm"><label>نام نمایشی<input id="approveUserName" value="${escapeHtml(u.name||'')}" placeholder="نام کاربر"></label><label style="display:block;margin-top:10px">نقش<select id="approveUserRole"><option value="projectManager" ${role==='projectManager'?'selected':''}>مدیر پروژه</option><option value="siteSupervisor" ${role==='siteSupervisor'?'selected':''}>سرپرست اجرا</option><option value="admin" ${role==='admin'?'selected':''}>ادمین</option></select></label><div class="form-actions" style="margin-top:14px"><button type="button" class="secondary" data-close-prompt>انصراف</button><button class="primary">ذخیره دسترسی</button></div></form>`);
  document.getElementById('userApproveForm').onsubmit=async e=>{e.preventDefault();const btn=e.submitter;if(btn)btn.disabled=true;try{await updateUserGroup(u,{name:document.getElementById('approveUserName').value.trim(),role:document.getElementById('approveUserRole').value,active:true,blocked:false,hidden:false,approvedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});writeAuditLog('تغییر دسترسی کاربر',`دسترسی کاربر ${u.email||''} با نقش ${roleFa(document.getElementById('approveUserRole').value)} ذخیره شد.`,{kind:'userAccess',targetUserEmail:u.email||''});closeModal('promptModal');toast('دسترسی کاربر ذخیره شد');}catch(err){toast(authErrorMessage(err));if(btn)btn.disabled=false;}};
}
async function setUserBlocked(uid,blocked){
  const u=userById(uid);if(!u)return;
  if(blocked&&!confirm(`دسترسی «${u.email||''}» مسدود شود؟`))return;
  try{
    await updateUserGroup(u,blocked?{role:'blocked',active:false,blocked:true,hidden:false,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}:{role:'pending',active:false,blocked:false,hidden:false,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    writeAuditLog(blocked?'مسدود کردن کاربر':'فعال‌سازی مجدد کاربر',`وضعیت کاربر ${u.email||''} تغییر کرد.`,{kind:'userStatus',targetUserEmail:u.email||''});toast(blocked?'کاربر مسدود شد':'کاربر برای تأیید مجدد فعال شد');
  }catch(err){toast(authErrorMessage(err));}
}
async function deleteBlockedUser(uid){
  const u=userById(uid);if(!u||userState(u)!=='blocked')return;
  if(!confirm(`«${u.email||''}» از فهرست کاربران حذف شود؟\n\nحساب Firebase Authentication برای امنیت حذف نمی‌شود و این کاربر همچنان مسدود خواهد ماند.`))return;
  try{
    await updateUserGroup(u,{role:'blocked',active:false,blocked:true,hidden:true,hiddenAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    writeAuditLog('پنهان کردن کاربر مسدود',`کاربر ${u.email||''} از فهرست مدیریت پنهان شد.`,{kind:'userHide',targetUserEmail:u.email||''});toast('کاربر مسدود از فهرست حذف شد');
  }catch(err){toast(authErrorMessage(err));}
}
async function sendUserPasswordReset(uid){
  const u=userById(uid);if(!u?.email||!auth)return;
  if(!confirm(`ایمیل بازیابی رمز برای ${u.email} ارسال شود؟`))return;
  try{await auth.sendPasswordResetEmail(u.email);toast('ایمیل بازیابی رمز ارسال شد');}catch(err){toast(authErrorMessage(err));}
}

const BACKUP_COLLECTIONS=['contracts','activityCategories','activityLibrary','appMeta','users'];
let pendingRestorePayload=null;
function serializeFirestoreValue(value){
  if(value===null||value===undefined)return value??null;
  if(typeof firebase!=='undefined'&&firebase.firestore?.Timestamp&&value instanceof firebase.firestore.Timestamp){
    return {__type:'timestamp',seconds:value.seconds,nanoseconds:value.nanoseconds};
  }
  if(Array.isArray(value))return value.map(serializeFirestoreValue);
  if(typeof value==='object'){const out={};Object.entries(value).forEach(([k,v])=>out[k]=serializeFirestoreValue(v));return out;}
  return value;
}
function deserializeFirestoreValue(value){
  if(value===null||value===undefined)return value??null;
  if(Array.isArray(value))return value.map(deserializeFirestoreValue);
  if(typeof value==='object'){
    if(value.__type==='timestamp'&&Number.isFinite(value.seconds))return new firebase.firestore.Timestamp(value.seconds,Number(value.nanoseconds)||0);
    const out={};Object.entries(value).forEach(([k,v])=>out[k]=deserializeFirestoreValue(v));return out;
  }
  return value;
}
async function collectBackupPayload(){
  const collections={};
  for(const name of BACKUP_COLLECTIONS){
    const snap=await db.collection(name).get();
    collections[name]=snap.docs.map(d=>({id:d.id,data:serializeFirestoreValue(d.data())}));
  }
  const contractHistory={};
  for(const contract of collections.contracts||[]){
    const snap=await db.collection(CONTRACT_COLLECTION).doc(contract.id).collection('history').get();
    contractHistory[contract.id]=snap.docs.map(d=>({id:d.id,data:serializeFirestoreValue(d.data())}));
  }
  return {format:'decor-shargh-firestore-backup',schemaVersion:2,projectId:firebaseConfig.projectId,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),collections,contractHistory};
}
function persianFileDate(){
  try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replace(/[\/\\]/g,'-').replace(/\s/g,'');}
  catch{return new Date().toISOString().slice(0,10);}
}
function downloadJsonFile(payload,prefix='decor-shargh-backup'){
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${prefix}-${persianFileDate()}.json`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function downloadBackup(prefix='decor-shargh-backup'){
  if(!db||!currentAdmin||!isAdminRole())throw new Error('not-ready');
  const payload=await collectBackupPayload();downloadJsonFile(payload,prefix);return payload;
}
function validateBackupPayload(payload){
  if(!payload||payload.format!=='decor-shargh-firestore-backup')throw new Error('این فایل، بکاپ معتبر دکوراسیون شرق نیست.');
  if(payload.projectId!==firebaseConfig.projectId)throw new Error('این بکاپ متعلق به پروژه Firebase دیگری است.');
  if(!payload.collections||typeof payload.collections!=='object')throw new Error('ساختار بکاپ ناقص است.');
  return true;
}
function restoreSummaryHtml(payload){
  let rows=BACKUP_COLLECTIONS.map(name=>`<div class="restore-count-row"><span>${name}</span><strong>${toFa((payload.collections[name]||[]).length)}</strong></div>`).join('');
  if(payload.contractHistory){const total=Object.values(payload.contractHistory).reduce((sum,items)=>sum+(Array.isArray(items)?items.length:0),0);rows+=`<div class="restore-count-row"><span>contractHistory</span><strong>${toFa(total)}</strong></div>`;}
  return `<div class="danger-note">بازیابی، اطلاعات فعلی کالکشن‌های زیر را با محتوای فایل جایگزین می‌کند. قبل از شروع، بکاپ اضطراری فعلی به‌صورت خودکار دانلود می‌شود.</div><div class="restore-counts">${rows}</div><div class="form-actions"><button type="button" class="secondary" id="cancelRestoreBtn">انصراف</button><button type="button" class="danger" id="confirmRestoreBtn">تأیید و شروع بازیابی</button></div>`;
}
async function commitOpsInChunks(opsBuilder){
  let batch=db.batch(),count=0;
  async function flush(){if(count){await batch.commit();batch=db.batch();count=0;}}
  await opsBuilder({add(ref,type,data){if(type==='delete')batch.delete(ref);else batch.set(ref,data);count++;},flush,shouldFlush(){return count>=400;}});
  await flush();
}
async function replaceCollectionFromBackup(name,docs){
  const existing=await db.collection(name).get();
  const protectedId=(name==='users'&&currentAdmin?.uid)?currentAdmin.uid:null;
  await commitOpsInChunks(async h=>{
    for(const d of existing.docs){
      if(protectedId&&d.id===protectedId)continue;
      h.add(d.ref,'delete');if(h.shouldFlush())await h.flush();
    }
  });
  await commitOpsInChunks(async h=>{
    for(const item of docs||[]){
      if(!item?.id||(protectedId&&item.id===protectedId))continue;
      h.add(db.collection(name).doc(item.id),'set',deserializeFirestoreValue(item.data||{}));if(h.shouldFlush())await h.flush();
    }
  });
}
async function replaceContractHistoryFromBackup(historyByContract){
  if(!historyByContract||typeof historyByContract!=='object')return;
  for(const [contractId,items] of Object.entries(historyByContract)){
    const col=db.collection(CONTRACT_COLLECTION).doc(contractId).collection('history');
    const existing=await col.get();
    await commitOpsInChunks(async h=>{for(const d of existing.docs){h.add(d.ref,'delete');if(h.shouldFlush())await h.flush();}});
    await commitOpsInChunks(async h=>{for(const item of items||[]){if(!item?.id)continue;h.add(col.doc(item.id),'set',deserializeFirestoreValue(item.data||{}));if(h.shouldFlush())await h.flush();}});
  }
}
async function restoreBackup(payload){
  validateBackupPayload(payload);
  const adminSnap=await db.collection('users').doc(currentAdmin.uid).get();
  const adminSafety=adminSnap.exists?adminSnap.data():{email:currentAdmin.email||'',name:currentAdmin.name||'',role:'admin',active:true};
  for(const name of BACKUP_COLLECTIONS)await replaceCollectionFromBackup(name,payload.collections[name]||[]);
  if(payload.contractHistory)await replaceContractHistoryFromBackup(payload.contractHistory);
  await db.collection('users').doc(currentAdmin.uid).set({...adminSafety,email:currentAdmin.email||adminSafety.email||'',role:'admin',active:true,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
}
function openBackupModal(){addSystemLog('باز کردن پشتیبان‌گیری و بازیابی','');
  if(!isAdminRole())return;
  pendingRestorePayload=null;
  document.getElementById('restorePreview')?.classList.add('is-hidden');
  openModal('backupModal');
}

function systemLogSummaryRows(){
  const active=activeContracts();
  const totalActivities=state.library.reduce((sum,cat)=>sum+(cat.items?.length||0),0);
  const rows=[
    ['نسخه اپ',APP_VERSION],
    ['نقش',roleFa(currentRole())],
    ['کاربر فعلی',currentAdmin?.email||currentUserProfile?.email||'—'],
    ['قراردادها',toFa(state.contracts.length)],
    ['قراردادهای فعال',toFa(active.length)],
    ['تم',currentTheme()==='dark'?'Dark':'Light'],
    ['وضعیت شبکه',navigator.onLine?'Online':'Offline'],
    ['حالت نصب',isStandaloneMode()?'Installed PWA':'Browser'],
    ['آخرین بروزرسانی لاگ',systemLogs[0]?systemLogTime(systemLogs[0].time):'—']
  ];
  if(isAdminRole())rows.splice(5,0,['دسته‌های کتابخانه',toFa(state.library.length)],['فعالیت‌های کتابخانه',toFa(totalActivities)]);
  return rows.map(([k,v])=>`<div class="system-log-row"><span>${escapeHtml(k)}</span><strong>${escapeHtml(String(v))}</strong></div>`).join('');
}
function systemLogEntriesHtml(){
  if(!systemLogs.length)return '<div class="empty compact-empty">هنوز رویدادی ثبت نشده است.</div>';
  return systemLogs.slice(0,16).map(item=>`<div class="system-log-entry"><div><strong>${escapeHtml(item.action)}</strong>${item.detail?`<div class="small muted">${escapeHtml(item.detail)}</div>`:''}</div><time>${escapeHtml(systemLogTime(item.time))}</time></div>`).join('');
}

function auditTime(item){return historyDateTime(item.createdAt||item.createdAtClient)}
function auditLogHtml(items){
  if(!items.length)return '<div class="empty compact-empty">هنوز تغییری ثبت نشده است.</div>';
  return items.map(item=>`<article class="audit-log-card"><div class="audit-log-top"><strong>${escapeHtml(item.title||'تغییر')}</strong><time>${escapeHtml(auditTime(item))}</time></div>${item.contractName||item.penCode?`<div class="audit-contract">قرارداد: ${escapeHtml(item.contractName||'')} ${item.penCode?`— ${escapeHtml(item.penCode)}`:''}</div>`:''}<div class="audit-detail">${escapeHtml(item.detail||'')}</div><div class="audit-actor">${escapeHtml(item.actorName||item.actorEmail||'کاربر')} • ${escapeHtml(historyRoleLabel(item.actorRole||''))}</div></article>`).join('');
}
function renderAuditLog(){const box=document.getElementById('systemLogContent');if(box)box.innerHTML=`<div class="audit-log-list">${auditLogHtml(auditLogCache)}</div>`}
function openSystemLogModal(){
  if(!isAdminRole())return;openModal('systemLogModal');const box=document.getElementById('systemLogContent');if(box)box.innerHTML='<div class="history-loading">در حال دریافت تغییرات...</div>';if(auditLogCache.length)renderAuditLog();if(auditLogUnsub){try{auditLogUnsub()}catch{}}
  auditLogUnsub=db.collection(AUDIT_COLLECTION).orderBy('createdAt','desc').limit(80).onSnapshot({includeMetadataChanges:true},snap=>{auditLogCache=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(timestampMs(b.createdAt)||timestampMs(b.createdAtClient))-(timestampMs(a.createdAt)||timestampMs(a.createdAtClient)));renderAuditLog()},err=>{if(!auditLogCache.length&&box)box.innerHTML=`<div class="empty compact-empty">${escapeHtml(firestoreErrorMessage(err))}</div>`});
}



function openPanelsModal(){if(!isAdminRole())return;openModal('panelsModal')}
function enterPanelPreview(role){if(!isAdminRole())return;uiPreviewRole=role==='siteSupervisor'?'siteSupervisor':'';configureRoleUi();closeModal('panelsModal');switchView('home');renderAll()}
function exitPanelPreview(){uiPreviewRole='';configureRoleUi();switchView('home');renderAll()}
// Global events
document.addEventListener('click',e=>{const nav=e.target.closest('[data-nav]');if(nav)switchView(nav.dataset.nav);const go=e.target.closest('[data-go]');if(go)switchView(go.dataset.go);const open=e.target.closest('[data-open-contract]');if(open&&!e.target.closest('button'))openDetail(open.dataset.openContract);const action=e.target.closest('[data-action]');if(action){e.stopPropagation();const c=getContract(action.dataset.id);if(action.dataset.action==='view')openDetail(c.id);if(action.dataset.action==='edit')openContractForm(c)}const kpi=e.target.closest('[data-kpi]');if(kpi){switchView('contracts');if(kpi.dataset.kpi==='active')filterStatus.value='active';if(kpi.dataset.kpi==='near'||kpi.dataset.kpi==='critical'){filterStatus.value='active';}renderContracts()}});
document.getElementById('newContractBtn').onclick=()=>{if(isAdminRole())openContractForm()};
document.querySelectorAll('[data-close-modal]').forEach(b=>b.onclick=()=>closeModal('contractModal'));document.querySelectorAll('[data-close-detail]').forEach(b=>b.onclick=()=>closeModal('detailModal'));document.querySelectorAll('[data-close-prompt]').forEach(b=>b.onclick=()=>closeModal('promptModal'));
document.getElementById('contractForm').onsubmit=async e=>{
  e.preventDefault();
  const btn=e.submitter||document.querySelector('#contractForm button[type="submit"]');
  if(btn)btn.disabled=true;
  const $=id=>document.getElementById(id);
  const rawComp=$('compDate').value.trim();
  const data={
    customerName:$('customerName').value.trim(),
    penCode:$('penCode').value.trim(),
    amount:toEn($('contractAmount').value).replace(/,/g,''),
    contractDate:normalizeDate($('contractDate').value),
    endDate:normalizeDate($('endDate').value),
    compDate:normalizeDate(rawComp),
    notes:$('contractNotes').value.trim(),
    activities:contractFormActivities.map(a=>({...a}))
  };
  if(!data.customerName||!data.penCode||!data.amount){if(btn)btn.disabled=false;return toast('نام مشتری، کد قلم و مبلغ قرارداد الزامی است')}
  if(!data.contractDate||!data.endDate){if(btn)btn.disabled=false;return toast('فرمت تاریخ را مثل ۱۴۰۵/۰۷/۰۱ وارد کنید')}
  if(rawComp&&!data.compDate){if(btn)btn.disabled=false;return toast('فرمت تاریخ جبرانی را مثل ۱۴۰۵/۰۷/۰۱ وارد کنید')}
  try{
    const id=$('contractId').value.trim();
    if(id){
      const before={...(getContract(id)||{})};
      const saved=await updateContractRemote(id,data);
      auditContractEdited(before,saved);
      scheduleContractViewsRender();
      toast('اطلاعات قرارداد با موفقیت ویرایش شد');
    }else{
      const newId=await createContractRemote(data);
      auditContractCreated({id:newId,...data});
      toast('قرارداد آنلاین در Firestore ثبت شد');
    }
    closeModal('contractModal');
    switchView('contracts');
  }catch(err){
    toast(firestoreErrorMessage(err));
    if(btn)btn.disabled=false;
  }
};
['filterCustomer','filterYear','filterMonth','filterStatus'].forEach(id=>document.getElementById(id).addEventListener(id==='filterMonth'?'change':'input',renderContracts));document.getElementById('clearFilters').onclick=()=>{filterCustomer.value='';filterYear.value='';filterMonth.value='';filterStatus.value='';renderContracts()};
document.getElementById('addCategoryBtn').onclick=()=>{
  showPrompt('دسته جدید',`<form id="catForm"><label>نام دسته<input id="catName" required></label><div class="form-actions" style="margin-top:14px"><button type="button" class="secondary" data-close-prompt>انصراف</button><button class="primary">ایجاد</button></div></form>`);
  document.getElementById('catForm').onsubmit=async e=>{
    e.preventDefault();const btn=e.submitter;if(btn)btn.disabled=true;
    try{await createCategoryRemote(document.getElementById('catName').value.trim());closeModal('promptModal');toast('دسته در Firestore ایجاد شد')}catch(err){toast(firestoreErrorMessage(err));if(btn)btn.disabled=false;}
  };
};
document.getElementById('libraryList').addEventListener('click',async e=>{
  let b=e.target.closest('[data-lib-toggle]');
  if(b){const id=b.dataset.libToggle;libraryExpandedCats.has(id)?libraryExpandedCats.delete(id):libraryExpandedCats.add(id);renderLibrary();return;}
  b=e.target.closest('[data-lib-add]');
  if(b)return libraryPrompt(state.library.find(c=>c.id===b.dataset.libAdd));
  b=e.target.closest('[data-lib-edit-cat]');
  if(b){
    const cat=state.library.find(c=>c.id===b.dataset.libEditCat);
    showPrompt('ویرایش دسته',`<form id="editCat"><label>نام دسته<input id="editCatName" value="${escapeHtml(cat.name)}" required></label><div class="form-actions" style="margin-top:14px"><button type="button" class="secondary" data-close-prompt>انصراف</button><button class="primary">ذخیره</button></div></form>`);
    document.getElementById('editCat').onsubmit=async ev=>{ev.preventDefault();const btn=ev.submitter;if(btn)btn.disabled=true;try{await updateCategoryRemote(cat.id,document.getElementById('editCatName').value.trim());closeModal('promptModal');toast('دسته ویرایش شد')}catch(err){toast(firestoreErrorMessage(err));if(btn)btn.disabled=false;}};
    return;
  }
  b=e.target.closest('[data-lib-del-cat]');
  if(b){
    const cat=state.library.find(c=>c.id===b.dataset.libDelCat);
    if(cat.items.length)return toast('اول فعالیت‌های این دسته را حذف یا منتقل کنید');
    if(confirm(`دسته «${cat.name}» حذف شود؟`)){try{await deleteCategoryRemote(cat.id);toast('دسته حذف شد')}catch(err){toast(firestoreErrorMessage(err))}}
    return;
  }
  b=e.target.closest('[data-lib-edit-act]');
  if(b){const cat=state.library.find(c=>c.id===b.dataset.cat),act=cat.items.find(a=>a.id===b.dataset.libEditAct);libraryPrompt(cat,act);return}
  b=e.target.closest('[data-lib-del-act]');
  if(b){
    const cat=state.library.find(c=>c.id===b.dataset.cat),act=cat.items.find(a=>a.id===b.dataset.libDelAct);
    if(confirm(`فعالیت «${act.name}» از کتابخانه حذف شود؟\nقراردادهای قبلی تغییر نمی‌کنند.`)){try{await deleteActivityRemote(act.id);toast('از کتابخانه Firestore حذف شد')}catch(err){toast(firestoreErrorMessage(err))}}
    return;
  }
});



const loginFormEl=document.getElementById('loginForm');
if(loginFormEl)loginFormEl.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!auth){setAuthMessage('Firebase در دسترس نیست.','error');return;}
  const email=document.getElementById('loginEmail').value.trim(),password=document.getElementById('loginPassword').value;
  const remember=document.getElementById('rememberMe')?.checked===true,btn=document.getElementById('loginBtn'),signup=document.getElementById('signupBtn');
  if(!email||password.length<6){setAuthMessage('ایمیل و رمز حداقل ۶ کاراکتری را وارد کنید.','error');return;}
  pendingRememberIntent={email,pass:password,remember};
  btn.disabled=true;if(signup)signup.disabled=true;btn.textContent='در حال ورود...';setAuthMessage('در حال اتصال...');
  try{await auth.signInWithEmailAndPassword(email,password);}
  catch(err){pendingRememberIntent=null;setAuthMessage(authErrorMessage(err),'error');}
  finally{btn.disabled=false;if(signup)signup.disabled=false;btn.textContent='ورود';}
});
const signupBtn=document.getElementById('signupBtn');
if(signupBtn)signupBtn.addEventListener('click',async()=>{
  if(!auth||!db){setAuthMessage('Firebase در دسترس نیست.','error');return;}
  const email=document.getElementById('loginEmail').value.trim(),password=document.getElementById('loginPassword').value;
  const remember=document.getElementById('rememberMe')?.checked===true;
  if(!email||password.length<6){setAuthMessage('برای ساخت حساب، ایمیل و یک رمز حداقل ۶ کاراکتری وارد کنید.','error');return;}
  const loginBtn=document.getElementById('loginBtn');
  signupBtn.disabled=true;loginBtn.disabled=true;signupBtn.textContent='در حال ساخت حساب...';setAuthMessage('در حال ساخت حساب جدید...');signupInProgress=true;
  let createdUser=null;
  try{
    pendingRememberIntent={email,pass:password,remember};
    const cred=await auth.createUserWithEmailAndPassword(email,password);createdUser=cred.user;
    await ensureOwnProfile(createdUser);
    setAuthMessage('حساب ساخته شد و در انتظار تأیید مدیر است.','success');
  }catch(err){
    pendingRememberIntent=null;
    if(createdUser){try{await createdUser.delete()}catch{}}
    setAuthMessage(authErrorMessage(err),'error');
    if(auth.currentUser&&signupInProgress){await auth.signOut().catch(()=>{})}
  }finally{
    signupInProgress=false;signupBtn.disabled=false;loginBtn.disabled=false;signupBtn.textContent='ساخت حساب جدید';
  }
});
document.getElementById('togglePasswordBtn')?.addEventListener('click',()=>{
  const input=document.getElementById('loginPassword'),btn=document.getElementById('togglePasswordBtn');
  const show=input.type==='password';input.type=show?'text':'password';btn.classList.toggle('is-visible',show);btn.setAttribute('aria-label',show?'پنهان کردن رمز':'نمایش رمز');btn.title=show?'پنهان کردن رمز':'نمایش رمز';
});
async function doLogout(){
  if(!auth)return;
  if(!confirm('آیا مطمئن هستید که می‌خواهید از حساب کاربری خارج شوید؟'))return;
  const role=currentUserProfile?.role||'';
  queuePresenceWrite('away');stopPresenceTracking();stopProfileSync();await auth.signOut();
  const email=document.getElementById('loginEmail'),pass=document.getElementById('loginPassword'),remember=document.getElementById('rememberMe');
  if(role==='admin'){clearRememberedLogin();if(email)email.value='';if(pass)pass.value='';if(remember)remember.checked=false;}
  else{if(pass)pass.value='';await hydrateRememberedLogin();}
}
const logoutBtn=document.getElementById('logoutBtn');
if(logoutBtn)logoutBtn.addEventListener('click',async()=>{logoutBtn.disabled=true;try{await doLogout()}finally{logoutBtn.disabled=false}});
document.getElementById('pendingLogoutBtn')?.addEventListener('click',doLogout);
document.getElementById('blockedLogoutBtn')?.addEventListener('click',doLogout);
document.getElementById('roleGateLogoutBtn')?.addEventListener('click',doLogout);

document.getElementById('themeToggleBtn')?.addEventListener('click',toggleTheme);
syncThemeButton();
document.getElementById('openUsersBtn')?.addEventListener('click',openUsersAdmin);
document.querySelectorAll('[data-close-users]').forEach(b=>b.addEventListener('click',closeUsersAdmin));
document.getElementById('usersAdminList')?.addEventListener('click',e=>{
  const approve=e.target.closest('[data-user-approve]');if(approve){openUserApprove(approve.dataset.userApprove);return;}
  const block=e.target.closest('[data-user-block]');if(block){setUserBlocked(block.dataset.userBlock,true);return;}
  const enable=e.target.closest('[data-user-enable]');if(enable){setUserBlocked(enable.dataset.userEnable,false);return;}
  const del=e.target.closest('[data-user-delete]');if(del){deleteBlockedUser(del.dataset.userDelete);return;}
  const reset=e.target.closest('[data-user-reset]');if(reset){sendUserPasswordReset(reset.dataset.userReset);return;}
});

document.getElementById('openBackupBtn')?.addEventListener('click',openBackupModal);
document.getElementById('openSystemLogBtn')?.addEventListener('click',openSystemLogModal);
document.getElementById('openPanelsBtn')?.addEventListener('click',openPanelsModal);
document.querySelectorAll('[data-close-panels]').forEach(b=>b.addEventListener('click',()=>closeModal('panelsModal')));
document.querySelectorAll('[data-preview-role]').forEach(b=>b.addEventListener('click',()=>enterPanelPreview(b.dataset.previewRole)));
document.getElementById('exitPreviewBtn')?.addEventListener('click',exitPanelPreview);
document.querySelectorAll('[data-close-system-log]').forEach(b=>b.addEventListener('click',()=>closeModal('systemLogModal')));
document.querySelectorAll('[data-close-backup]').forEach(b=>b.addEventListener('click',()=>closeModal('backupModal')));
document.getElementById('downloadBackupBtn')?.addEventListener('click',async e=>{
  const btn=e.currentTarget;btn.disabled=true;btn.textContent='در حال آماده‌سازی...';
  try{await downloadBackup();addSystemLog('دانلود بکاپ','');toast('فایل بکاپ دانلود شد')}catch{toast('ساخت بکاپ انجام نشد')}
  finally{btn.disabled=false;btn.textContent='دانلود بکاپ';}
});
const restoreFileInput=document.getElementById('restoreFileInput');
document.getElementById('chooseRestoreFileBtn')?.addEventListener('click',()=>restoreFileInput?.click());
restoreFileInput?.addEventListener('change',async()=>{
  const file=restoreFileInput.files?.[0];if(!file)return;
  const preview=document.getElementById('restorePreview');
  try{
    const payload=JSON.parse(await file.text());validateBackupPayload(payload);pendingRestorePayload=payload;
    preview.innerHTML=restoreSummaryHtml(payload);preview.classList.remove('is-hidden');
    document.getElementById('cancelRestoreBtn').onclick=()=>{pendingRestorePayload=null;preview.classList.add('is-hidden');restoreFileInput.value='';};
    document.getElementById('confirmRestoreBtn').onclick=async e=>{
      if(!pendingRestorePayload)return;
      if(!confirm('بازیابی اطلاعات شروع شود؟ اطلاعات فعلی با محتوای بکاپ جایگزین خواهد شد.'))return;
      const btn=e.currentTarget;btn.disabled=true;btn.textContent='در حال بازیابی...';
      try{
        const emergency=await collectBackupPayload();downloadJsonFile(emergency,'decor-shargh-before-restore');
        await restoreBackup(pendingRestorePayload);addSystemLog('بازیابی بکاپ','');toast('بازیابی با موفقیت انجام شد');pendingRestorePayload=null;preview.classList.add('is-hidden');restoreFileInput.value='';closeModal('backupModal');
      }catch(err){console.error(err);toast(err?.message||'بازیابی انجام نشد');btn.disabled=false;btn.textContent='تأیید و شروع بازیابی';}
    };
  }catch(err){pendingRestorePayload=null;preview.classList.add('is-hidden');restoreFileInput.value='';toast(err?.message||'فایل بکاپ معتبر نیست');}
});


async function checkForAppUpdate(){
  try{
    const res=await fetch(`version.json?t=${Date.now()}`,{cache:'no-store'});
    if(!res.ok)return;
    const info=await res.json();
    if(info?.version&&info.version!==APP_VERSION){
      const regs='serviceWorker' in navigator?await navigator.serviceWorker.getRegistrations():[];
      await Promise.all(regs.map(r=>r.update().catch(()=>{})));
      location.reload();
    }
  }catch{}
}
window.addEventListener('focus',checkForAppUpdate);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkForAppUpdate()});

setupPwaInstall();
initFirebaseAuth();
checkForAppUpdate();
