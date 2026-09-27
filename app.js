const firebaseConfig={
  apiKey:"AIzaSyD6b5UZEOXW53NQT8AavY5df2T0by5bL7M",
  authDomain:"decor-shargh.firebaseapp.com",
  projectId:"decor-shargh",
  storageBucket:"decor-shargh.firebasestorage.app",
  messagingSenderId:"773782150656",
  appId:"1:773782150656:web:80344bf7889e51b8fc02e5",
  measurementId:"G-54J4STYEY4"
};

let auth=null;
let db=null;
let currentAdmin=null;
let appStarted=false;

function authEls(){
  return {
    gate:document.getElementById('authGate'),
    shell:document.getElementById('appShell'),
    form:document.getElementById('loginForm'),
    email:document.getElementById('loginEmail'),
    password:document.getElementById('loginPassword'),
    button:document.getElementById('loginBtn'),
    message:document.getElementById('authMessage')
  };
}
function setAuthMessage(message,type=''){
  const el=document.getElementById('authMessage');
  if(!el)return;
  el.textContent=message||'';
  el.className='auth-message'+(type?' '+type:'');
}
function showLogin(message=''){
  const e=authEls();
  e.shell?.classList.add('is-hidden');
  e.gate?.classList.remove('is-hidden');
  if(message)setAuthMessage(message,'error');
}
function showApp(){
  const e=authEls();
  e.gate?.classList.add('is-hidden');
  e.shell?.classList.remove('is-hidden');
  if(!appStarted){appStarted=true;renderAll();}
  else renderAll();
}
function authErrorMessage(err){
  const code=err?.code||'';
  if(code.includes('invalid-credential')||code.includes('wrong-password')||code.includes('user-not-found'))return 'ایمیل یا رمز عبور صحیح نیست.';
  if(code.includes('too-many-requests'))return 'تلاش‌های ورود زیاد بوده؛ کمی بعد دوباره امتحان کنید.';
  if(code.includes('network-request-failed'))return 'ارتباط با Firebase برقرار نشد. اینترنت یا دسترسی به Firebase را بررسی کنید.';
  if(code.includes('unauthorized-domain'))return 'دامنه سایت هنوز در Firebase مجاز نشده است.';
  if(code.includes('permission-denied'))return 'دسترسی این حساب به پنل مجاز نیست.';
  return 'ورود انجام نشد. دوباره تلاش کنید.';
}
async function verifyAdmin(user){
  const snap=await db.collection('users').doc(user.uid).get();
  if(!snap.exists)throw Object.assign(new Error('admin-profile-missing'),{code:'permission-denied'});
  const profile=snap.data()||{};
  if(profile.active!==true||profile.role!=='admin')throw Object.assign(new Error('not-admin'),{code:'permission-denied'});
  currentAdmin={uid:user.uid,email:user.email||profile.email||'',...profile};
  return currentAdmin;
}
function initFirebaseAuth(){
  if(typeof firebase==='undefined'){
    showLogin('کتابخانه Firebase بارگذاری نشد. دسترسی شبکه به Firebase را بررسی کنید.');
    return;
  }
  try{
    if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
    auth=firebase.auth();
    db=firebase.firestore();
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{});
    auth.onAuthStateChanged(async user=>{
      if(!user){currentAdmin=null;showLogin();setAuthMessage('ایمیل و رمز عبور ادمین را وارد کنید.');return;}
      setAuthMessage('در حال بررسی دسترسی ادمین...');
      try{await verifyAdmin(user);showApp();}
      catch(err){currentAdmin=null;await auth.signOut().catch(()=>{});showLogin(authErrorMessage(err));}
    });
  }catch(err){showLogin(authErrorMessage(err));}
}

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
function freshState(){return {contracts:[],library:initialLibrary.map((c,ci)=>({id:uid('cat'),name:c.name,items:c.items.map(i=>({id:uid('act'),name:i[0],volume:i[1],cost:i[2],duration:i[3],score:score(i[1],i[2],i[3])}))}))}}
let state=load();
function load(){try{const s=JSON.parse(localStorage.getItem(STORAGE_KEY));return s&&s.library?s:freshState()}catch{return freshState()}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function toFa(v){return String(v).replace(/\d/g,d=>faDigits[d])}
function toEn(v=''){return String(v).replace(/[۰-۹]/g,d=>faDigits.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))}
function money(v){const n=Number(toEn(v).replace(/,/g,''))||0;return toFa(n.toLocaleString('en-US'))+' تومان'}
function normalizeDate(v){v=toEn(v).trim().replace(/[-.]/g,'/');const m=v.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);if(!m)return '';return `${m[1]}/${String(m[2]).padStart(2,'0')}/${String(m[3]).padStart(2,'0')}`}

function div(a,b){return Math.trunc(a/b)}
function jalCal(jy){const breaks=[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];let bl=breaks.length,gy=jy+621,leapJ=-14,jp=breaks[0],jm,jump,n,i;if(jy<jp||jy>=breaks[bl-1])throw Error('Invalid Jalaali year '+jy);for(i=1;i<bl;i+=1){jm=breaks[i];jump=jm-jp;if(jy<jm)break;leapJ+=div(jump,33)*8+div(jump%33,4);jp=jm}n=jy-jp;leapJ+=div(n,33)*8+div((n%33)+3,4);if(jump%33===4&&jump-n===4)leapJ+=1;const leapG=div(gy,4)-div((div(gy,100)+1)*3,4)-150;const march=20+leapJ-leapG;if(jump-n<6)n=n-jump+div(jump+4,33)*33;let leap=((n+1)%33-1)%4;if(leap===-1)leap=4;return {leap,gy,march}}
function g2d(gy,gm,gd){let d=div((gy+div(gm-8,6)+100100)*1461,4)+div(153*((gm+9)%12)+2,5)+gd-34840408;d=d-div(div(gy+100100+div(gm-8,6),100)*3,4)+752;return d}
function d2g(jdn){let j=4*jdn+139361631;j=j+div(div(4*jdn+183187720,146097)*3,4)*4-3908;const i=div((j%1461),4)*5+308;const gd=div(i%153,5)+1;const gm=(div(i,153)%12)+1;const gy=div(j,1461)-100100+div(8-gm,6);return {gy,gm,gd}}
function j2d(jy,jm,jd){const r=jalCal(jy);return g2d(r.gy,3,r.march)+(jm-1)*31-div(jm,7)*(jm-7)+jd-1}
function jalaliToDate(s){const n=normalizeDate(s);if(!n)return null;const [jy,jm,jd]=n.split('/').map(Number);try{const g=d2g(j2d(jy,jm,jd));return new Date(g.gy,g.gm-1,g.gd,12,0,0)}catch{return null}}
function daysUntilContract(c){const ref=c.compDate||c.endDate;const d=jalaliToDate(ref);if(!d)return null;const t=new Date();const today=new Date(t.getFullYear(),t.getMonth(),t.getDate(),12);return Math.ceil((d-today)/86400000)}
function dueState(c){if(c.status==='completed')return {key:'completed',text:'خاتمه‌یافته'};if(c.status==='stopped')return {key:'stopped',text:'متوقف'};if(c.status==='terminated')return {key:'terminated',text:'فسخ‌شده'};const n=daysUntilContract(c);if(n===null)return {key:'normal',text:'بدون تاریخ معتبر'};if(n<0)return {key:'overdue',text:`${toFa(Math.abs(n))} روز از سررسید گذشته`};if(n<=3)return {key:'critical',text:n===0?'امروز سررسید':`${toFa(n)} روز تا سررسید`};if(n<=7)return {key:'near',text:`${toFa(n)} روز تا سررسید`};return {key:'normal',text:`${toFa(n)} روز تا سررسید`}}
function contractProgress(c){if(!c.activities?.length)return 0;const total=c.activities.reduce((s,a)=>s+(Number(a.baseScore)||0),0);if(!total)return 0;return +c.activities.reduce((s,a)=>s+((Number(a.progress)||0)*(Number(a.baseScore)||0)/total),0).toFixed(1)}
function activityWeight(c,a){const total=c.activities.reduce((s,x)=>s+(Number(x.baseScore)||0),0);return total?+(a.baseScore/total*100).toFixed(1):0}
function syncAutoCompleted(c){if(c.activities?.length&&c.activities.every(a=>Number(a.progress)===100)){c.status='completed';c.completedAt=new Date().toISOString()}else if(c.status==='completed'){c.status='active';delete c.completedAt}}
function statusClass(c){const d=dueState(c);return d.key}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),1800)}

function getContract(id){return state.contracts.find(c=>c.id===id)}
function activeContracts(){return state.contracts.filter(c=>c.status==='active')}
function contractCard(c){const p=contractProgress(c),ds=dueState(c);const acts=(c.activities||[]).map(a=>`<span class="act-chip">${escapeHtml(a.name)} — ${toFa(a.progress)}٪</span>`).join('')||'<span class="muted small">هنوز فعالیتی تعریف نشده</span>';return `<article class="contract-card ${statusClass(c)}" data-open-contract="${c.id}">
<div class="contract-top"><div><div class="contract-title">${escapeHtml(c.customerName)}</div><div class="code">کد قلم: ${escapeHtml(c.penCode)}</div></div><div class="amount">${money(c.amount)}</div></div>
<div class="contract-meta"><span class="badge ${ds.key}">${escapeHtml(ds.text)}</span><span class="badge">${escapeHtml(statusLabels[c.status]||'')}</span></div>
<div class="progress-row"><span class="small">پیشرفت</span><div class="progress-track"><div class="progress-fill" style="width:${p}%"></div></div><strong>${toFa(p)}٪</strong></div>
<div class="activities-mini">${acts}</div>
<div class="card-actions"><button class="secondary" data-action="view" data-id="${c.id}">مشاهده قرارداد</button><button class="secondary" data-action="edit" data-id="${c.id}">ویرایش</button></div>
</article>`}

function renderHome(){const active=activeContracts();const near=active.filter(c=>dueState(c).key==='near');const critical=active.filter(c=>['critical','overdue'].includes(dueState(c).key));const avg=active.length?+(active.reduce((s,c)=>s+contractProgress(c),0)/active.length).toFixed(1):0;document.getElementById('kpiGrid').innerHTML=[
 ['فعال',active.length,'blue','active'],['نزدیک سررسید',near.length,'orange','near'],['بحرانی',critical.length,'red','critical'],['میانگین پیشرفت',`${avg}٪`,'','progress']
].map(([l,v,cl,key])=>`<div class="kpi ${cl}" data-kpi="${key}"><div class="label">${l}</div><div class="value">${toFa(v)}</div></div>`).join('');
 const attention=[...critical,...state.contracts.filter(c=>c.status==='stopped'),...near].filter((c,i,a)=>a.findIndex(x=>x.id===c.id)===i);document.getElementById('attentionCount').textContent=attention.length?`${toFa(attention.length)} مورد`:'';document.getElementById('attentionList').innerHTML=attention.length?attention.map(c=>{const ds=dueState(c);return `<div class="attention-item" data-open-contract="${c.id}"><div><strong>${escapeHtml(c.customerName)}</strong><div class="small muted">کد ${escapeHtml(c.penCode)} • پیشرفت ${toFa(contractProgress(c))}٪</div></div><span class="badge ${ds.key}">${escapeHtml(ds.text)}</span></div>`}).join(''):'<div class="empty">مورد نیازمند توجهی وجود ندارد.</div>';
 document.getElementById('activeProjects').innerHTML=active.length?active.sort((a,b)=>jalaliToDate(b.contractDate)-jalaliToDate(a.contractDate)).map(contractCard).join(''):'<div class="empty">هنوز قرارداد فعالی ثبت نشده.</div>';
 renderCharts(active);
}
function renderCharts(active){const pc=document.getElementById('progressChart');pc.innerHTML=active.length?active.map(c=>{const p=contractProgress(c);return `<div class="bar-row"><div class="small">${escapeHtml(c.customerName)}</div><div class="bar-bg"><div class="bar" style="width:${p}%"></div></div><strong>${toFa(p)}٪</strong></div>`}).join(''):'<div class="empty">داده‌ای برای نمودار پیشرفت وجود ندارد.</div>';
 const counts={active:0,near:0,critical:0,stopped:0};state.contracts.forEach(c=>{if(c.status==='stopped')counts.stopped++;else if(c.status==='active'){const d=dueState(c).key;if(d==='near')counts.near++;else if(d==='critical'||d==='overdue')counts.critical++;else counts.active++;}});const total=Object.values(counts).reduce((a,b)=>a+b,0);document.getElementById('donutTotal').textContent=toFa(total);const colors=['#2563eb','#f59e0b','#dc2626','#6b7280'];let acc=0,parts=[];Object.values(counts).forEach((v,i)=>{const start=total?acc/total*100:0;acc+=v;const end=total?acc/total*100:100;parts.push(`${colors[i]} ${start}% ${end}%`)});document.getElementById('statusDonut').style.background=total?`conic-gradient(${parts.join(',')})`:'#e5e7eb';const labels=[['فعال',counts.active],['نزدیک سررسید',counts.near],['بحرانی',counts.critical],['متوقف',counts.stopped]];document.getElementById('statusLegend').innerHTML=labels.map((x,i)=>`<div class="legend-row"><span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${colors[i]};margin-left:7px"></span>${x[0]}</span><strong>${toFa(x[1])}</strong></div>`).join('')}

function renderContracts(){let arr=[...state.contracts].sort((a,b)=>(jalaliToDate(b.contractDate)||0)-(jalaliToDate(a.contractDate)||0));const name=document.getElementById('filterCustomer').value.trim();const from=normalizeDate(document.getElementById('filterFrom').value);const to=normalizeDate(document.getElementById('filterTo').value);const st=document.getElementById('filterStatus').value;if(name)arr=arr.filter(c=>c.customerName.includes(name));if(st)arr=arr.filter(c=>c.status===st);if(from){const fd=jalaliToDate(from);arr=arr.filter(c=>(jalaliToDate(c.contractDate)||0)>=fd)}if(to){const td=jalaliToDate(to);arr=arr.filter(c=>(jalaliToDate(c.contractDate)||0)<=td)}document.getElementById('contractsList').innerHTML=arr.length?arr.map(contractCard).join(''):'<div class="empty">قراردادی با این فیلتر پیدا نشد.</div>'}

function renderLibrary(){document.getElementById('libraryList').innerHTML=state.library.map(cat=>`<section class="category-card"><div class="category-head"><div><strong>${escapeHtml(cat.name)}</strong><div class="small muted">${toFa(cat.items.length)} فعالیت</div></div><div class="category-actions"><button class="secondary" data-lib-add="${cat.id}">+ فعالیت</button><button class="secondary" data-lib-edit-cat="${cat.id}">ویرایش</button><button class="danger" data-lib-del-cat="${cat.id}">حذف</button></div></div>${cat.items.length?cat.items.map(a=>`<div class="library-activity"><strong>${escapeHtml(a.name)}</strong><span class="score-pill">حجم ${toFa(a.volume)}</span><span class="score-pill">هزینه ${toFa(a.cost)}</span><span class="score-pill hide-mobile">مدت ${toFa(a.duration)}</span><span class="score-pill hide-mobile">ضریب ${toFa(a.score)}</span><span><button class="secondary" data-lib-edit-act="${a.id}" data-cat="${cat.id}">ویرایش</button> <button class="danger" data-lib-del-act="${a.id}" data-cat="${cat.id}">حذف</button></span></div>`).join(''):'<div class="empty">فعالیتی در این دسته نیست.</div>'}</section>`).join('')}

function renderAll(){state.contracts.forEach(syncAutoCompleted);save();renderHome();renderContracts();renderLibrary()}
function switchView(name){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===name));document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===name));if(name==='contracts')renderContracts();if(name==='library')renderLibrary();window.scrollTo({top:0,behavior:'smooth'})}

function openContractForm(c=null){document.getElementById('contractForm').reset();document.getElementById('contractId').value=c?.id||'';document.getElementById('contractModalTitle').textContent=c?'ویرایش قرارداد':'قرارداد جدید';if(c){customerName.value=c.customerName;penCode.value=c.penCode;contractAmount.value=c.amount;contractDate.value=c.contractDate;endDate.value=c.endDate;compDate.value=c.compDate||'';contractNotes.value=c.notes||''}openModal('contractModal')}
function openModal(id){const m=document.getElementById(id);m.classList.add('open');m.setAttribute('aria-hidden','false')}
function closeModal(id){const m=document.getElementById(id);m.classList.remove('open');m.setAttribute('aria-hidden','true')}

function flattenLibrary(){return state.library.flatMap(cat=>cat.items.map(a=>({...a,categoryId:cat.id,categoryName:cat.name})))}
function openDetail(id){const c=getContract(id);if(!c)return;const p=contractProgress(c),ds=dueState(c);document.getElementById('detailTitle').textContent=c.customerName;document.getElementById('detailSubtitle').textContent=`کد قلم ${c.penCode} • ${statusLabels[c.status]}`;const sorted=[...(c.activities||[])].sort((a,b)=>(a.progress===100)-(b.progress===100));document.getElementById('detailContent').innerHTML=`
<div class="detail-summary"><div class="summary-box"><span>مبلغ قرارداد</span><strong>${money(c.amount)}</strong></div><div class="summary-box"><span>پیشرفت کل</span><strong>${toFa(p)}٪</strong></div><div class="summary-box"><span>وضعیت زمانی</span><strong>${escapeHtml(ds.text)}</strong></div><div class="summary-box"><span>وضعیت قرارداد</span><strong>${statusLabels[c.status]}</strong></div></div>
<div class="detail-toolbar"><button class="secondary" data-detail-edit="${c.id}">ویرایش اطلاعات قرارداد</button><button class="secondary" data-status-change="${c.id}">تغییر وضعیت</button></div>
<section class="panel" style="box-shadow:none"><div class="section-head"><h3>فعالیت‌ها</h3><span class="muted small">جمع وزن‌ها: ۱۰۰٪</span></div>
<div class="activity-add"><input id="activitySearch" placeholder="جستجو در کتابخانه؛ مثلاً سقف" autocomplete="off"><button class="primary" id="addSelectedActivity" disabled>+ اضافه کردن</button><div id="activitySuggestions" class="suggestions" style="display:none"></div></div>
<div class="activity-table" id="activityRows">${sorted.length?sorted.map(a=>activityRow(c,a)).join(''):'<div class="empty">هنوز فعالیتی برای این قرارداد تعریف نشده.</div>'}</div></section>
${c.notes?`<section class="panel" style="box-shadow:none"><h3>توضیحات</h3><p>${escapeHtml(c.notes)}</p></section>`:''}`;
openModal('detailModal');wireDetail(c)}
function activityRow(c,a){const cat=state.library.find(x=>x.id===a.categoryId)?.name||a.categoryName||'سایر';const w=activityWeight(c,a);return `<div class="activity-row ${a.progress===100?'done':''}"><div class="activity-name"><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(cat)}</small></div><div class="act-weight"><small class="muted">وزن</small><br><strong>${toFa(w)}٪</strong></div><div class="act-cat"><small class="muted">ضریب</small><br>${toFa(a.baseScore)}</div><div class="progress-input"><input type="number" min="0" max="100" value="${a.progress}" data-progress="${a.id}"><span>٪</span></div><div class="activity-actions"><button title="تکمیل" class="quick-done" data-done="${a.id}">✓</button><button title="ویرایش" class="edit-act" data-edit-act="${a.id}">✎</button><button title="حذف" class="delete-act" data-del-act="${a.id}">🗑</button></div></div>`}
function wireDetail(c){let selected=null;const search=document.getElementById('activitySearch'),box=document.getElementById('activitySuggestions'),add=document.getElementById('addSelectedActivity');search.addEventListener('input',()=>{selected=null;add.disabled=true;const q=search.value.trim();if(!q){box.style.display='none';return}const used=new Set((c.activities||[]).map(a=>a.libraryId));const results=flattenLibrary().filter(a=>!used.has(a.id)&&(a.name.includes(q)||a.categoryName.includes(q))).slice(0,12);box.innerHTML=results.length?results.map(a=>`<div class="suggestion" data-suggest="${a.id}"><strong>${escapeHtml(a.name)}</strong><div class="small muted">${escapeHtml(a.categoryName)} • ضریب ${toFa(a.score)}</div></div>`).join(''):'<div class="suggestion muted">موردی پیدا نشد</div>';box.style.display='block';box.querySelectorAll('[data-suggest]').forEach(el=>el.onclick=()=>{selected=flattenLibrary().find(a=>a.id===el.dataset.suggest);search.value=selected.name;box.style.display='none';add.disabled=false})});add.onclick=()=>{if(!selected)return;c.activities=c.activities||[];c.activities.push({id:uid('ca'),libraryId:selected.id,categoryId:selected.categoryId,categoryName:selected.categoryName,name:selected.name,baseScore:selected.score,progress:0});save();openDetail(c.id);toast('فعالیت اضافه شد')};document.querySelectorAll('[data-progress]').forEach(inp=>inp.onchange=()=>{const a=c.activities.find(x=>x.id===inp.dataset.progress);a.progress=Math.max(0,Math.min(100,Number(inp.value)||0));syncAutoCompleted(c);save();openDetail(c.id)});document.querySelectorAll('[data-done]').forEach(b=>b.onclick=()=>{c.activities.find(x=>x.id===b.dataset.done).progress=100;syncAutoCompleted(c);save();openDetail(c.id);toast('فعالیت ۱۰۰٪ شد')});document.querySelectorAll('[data-edit-act]').forEach(b=>b.onclick=()=>editContractActivity(c,b.dataset.editAct));document.querySelectorAll('[data-del-act]').forEach(b=>b.onclick=()=>deleteContractActivity(c,b.dataset.delAct));document.querySelector('[data-detail-edit]')?.addEventListener('click',()=>{closeModal('detailModal');openContractForm(c)});document.querySelector('[data-status-change]')?.addEventListener('click',()=>openStatusPrompt(c))}
function editContractActivity(c,id){const a=c.activities.find(x=>x.id===id);showPrompt('ویرایش نام فعالیت',`<form id="editActForm"><label>نام فعالیت<input id="editActName" value="${escapeHtml(a.name)}" required></label><div class="form-actions" style="margin-top:12px"><button type="button" class="secondary" data-close-prompt>انصراف</button><button class="primary">ذخیره</button></div></form>`);document.getElementById('editActForm').onsubmit=e=>{e.preventDefault();a.name=document.getElementById('editActName').value.trim();save();closeModal('promptModal');openDetail(c.id)}}
function deleteContractActivity(c,id){const a=c.activities.find(x=>x.id===id);const msg=a.progress>0?`این فعالیت دارای ${toFa(a.progress)}٪ پیشرفت ثبت‌شده است. مطمئن هستید؟`:'این فعالیت حذف شود؟';showPrompt('حذف فعالیت',`<div class="danger-note"><strong>${escapeHtml(a.name)}</strong><br>${msg}</div><div class="form-actions" style="margin-top:14px"><button class="secondary" data-close-prompt>لغو</button><button class="danger" id="confirmDeleteActivity">حذف فعالیت</button></div>`);document.getElementById('confirmDeleteActivity').onclick=()=>{c.activities=c.activities.filter(x=>x.id!==id);syncAutoCompleted(c);save();closeModal('promptModal');openDetail(c.id);toast('فعالیت حذف شد')}}
function openStatusPrompt(c){showPrompt('تغییر وضعیت قرارداد',`<form id="statusForm"><label>وضعیت<select id="newStatus"><option value="active">فعال</option><option value="stopped">متوقف</option><option value="terminated">فسخ‌شده</option>${c.status==='completed'?'<option value="completed">خاتمه‌یافته</option>':''}</select></label><div id="reasonWrap" class="reason-box" style="display:none"><label>علت<input id="statusReason"></label><label style="display:block;margin-top:8px">تاریخ<input id="statusDate" placeholder="۱۴۰۵/۰۷/۰۱"></label></div><div class="form-actions" style="margin-top:14px"><button type="button" class="secondary" data-close-prompt>انصراف</button><button class="primary">ذخیره</button></div></form>`);const sel=document.getElementById('newStatus');sel.value=c.status==='completed'?'completed':c.status;const rw=document.getElementById('reasonWrap');const toggle=()=>rw.style.display=['stopped','terminated'].includes(sel.value)?'block':'none';sel.onchange=toggle;toggle();document.getElementById('statusForm').onsubmit=e=>{e.preventDefault();if(['stopped','terminated'].includes(sel.value)){const r=document.getElementById('statusReason').value.trim(),d=normalizeDate(document.getElementById('statusDate').value);if(!r||!d)return toast('علت و تاریخ الزامی است');c.statusReason=r;c.statusDate=d}c.status=sel.value;save();closeModal('promptModal');openDetail(c.id);renderAll()}}
function showPrompt(title,html){document.getElementById('promptTitle').textContent=title;document.getElementById('promptBody').innerHTML=html;openModal('promptModal');document.querySelectorAll('[data-close-prompt]').forEach(b=>b.onclick=()=>closeModal('promptModal'))}

function libraryPrompt(cat=null,act=null){if(act){showPrompt('ویرایش فعالیت',`<form id="libActForm"><label>نام فعالیت<input id="laName" value="${escapeHtml(act.name)}" required></label><div class="status-form"><label>حجم کار (۱ تا ۱۰)<input id="laVolume" type="number" min="1" max="10" value="${act.volume}" required></label><label>هزینه (۱ تا ۱۰)<input id="laCost" type="number" min="1" max="10" value="${act.cost}" required></label><label>مدت (۱ تا ۱۰)<input id="laDuration" type="number" min="1" max="10" value="${act.duration}" required></label><label>ضریب نهایی<input value="${act.score}" disabled></label></div><div class="form-actions" style="margin-top:14px"><button type="button" class="secondary" data-close-prompt>انصراف</button><button class="primary">ذخیره</button></div></form>`);document.getElementById('libActForm').onsubmit=e=>{e.preventDefault();act.name=laName.value.trim();act.volume=+laVolume.value;act.cost=+laCost.value;act.duration=+laDuration.value;act.score=score(act.volume,act.cost,act.duration);save();closeModal('promptModal');renderLibrary();toast('فعالیت ویرایش شد')}}else{showPrompt('افزودن فعالیت',`<form id="libActForm"><label>نام فعالیت<input id="laName" required></label><div class="status-form"><label>حجم کار (۱ تا ۱۰)<input id="laVolume" type="number" min="1" max="10" value="5" required></label><label>هزینه (۱ تا ۱۰)<input id="laCost" type="number" min="1" max="10" value="5" required></label><label>مدت (۱ تا ۱۰)<input id="laDuration" type="number" min="1" max="10" value="5" required></label></div><div class="form-actions" style="margin-top:14px"><button type="button" class="secondary" data-close-prompt>انصراف</button><button class="primary">اضافه کردن</button></div></form>`);document.getElementById('libActForm').onsubmit=e=>{e.preventDefault();const v=+laVolume.value,l=+laCost.value,d=+laDuration.value;cat.items.push({id:uid('act'),name:laName.value.trim(),volume:v,cost:l,duration:d,score:score(v,l,d)});save();closeModal('promptModal');renderLibrary();toast('فعالیت اضافه شد')}}}

// Global events
document.addEventListener('click',e=>{const nav=e.target.closest('[data-nav]');if(nav)switchView(nav.dataset.nav);const go=e.target.closest('[data-go]');if(go)switchView(go.dataset.go);const open=e.target.closest('[data-open-contract]');if(open&&!e.target.closest('button'))openDetail(open.dataset.openContract);const action=e.target.closest('[data-action]');if(action){e.stopPropagation();const c=getContract(action.dataset.id);if(action.dataset.action==='view')openDetail(c.id);if(action.dataset.action==='edit')openContractForm(c)}const kpi=e.target.closest('[data-kpi]');if(kpi){switchView('contracts');if(kpi.dataset.kpi==='active')filterStatus.value='active';if(kpi.dataset.kpi==='near'||kpi.dataset.kpi==='critical'){filterStatus.value='active';}renderContracts()}});
document.getElementById('newContractBtn').onclick=()=>openContractForm();
document.querySelectorAll('[data-close-modal]').forEach(b=>b.onclick=()=>closeModal('contractModal'));document.querySelectorAll('[data-close-detail]').forEach(b=>b.onclick=()=>closeModal('detailModal'));document.querySelectorAll('[data-close-prompt]').forEach(b=>b.onclick=()=>closeModal('promptModal'));
document.getElementById('contractForm').onsubmit=e=>{e.preventDefault();const data={customerName:customerName.value.trim(),penCode:penCode.value.trim(),amount:toEn(contractAmount.value).replace(/,/g,''),contractDate:normalizeDate(contractDate.value),endDate:normalizeDate(endDate.value),compDate:normalizeDate(compDate.value),notes:contractNotes.value.trim()};if(!data.contractDate||!data.endDate)return toast('فرمت تاریخ را مثل ۱۴۰۵/۰۷/۰۱ وارد کنید');const id=contractId.value;if(id){Object.assign(getContract(id),data);toast('قرارداد ویرایش شد')}else state.contracts.push({id:uid('c'),...data,status:'active',activities:[],createdAt:new Date().toISOString()});save();closeModal('contractModal');renderAll();switchView('contracts')};
['filterCustomer','filterFrom','filterTo','filterStatus'].forEach(id=>document.getElementById(id).addEventListener('input',renderContracts));document.getElementById('clearFilters').onclick=()=>{filterCustomer.value='';filterFrom.value='';filterTo.value='';filterStatus.value='';renderContracts()};
document.getElementById('addCategoryBtn').onclick=()=>{showPrompt('دسته جدید',`<form id="catForm"><label>نام دسته<input id="catName" required></label><div class="form-actions" style="margin-top:14px"><button type="button" class="secondary" data-close-prompt>انصراف</button><button class="primary">ایجاد</button></div></form>`);document.getElementById('catForm').onsubmit=e=>{e.preventDefault();state.library.push({id:uid('cat'),name:catName.value.trim(),items:[]});save();closeModal('promptModal');renderLibrary()}};
document.getElementById('libraryList').addEventListener('click',e=>{let b=e.target.closest('[data-lib-add]');if(b)return libraryPrompt(state.library.find(c=>c.id===b.dataset.libAdd));b=e.target.closest('[data-lib-edit-cat]');if(b){const cat=state.library.find(c=>c.id===b.dataset.libEditCat);showPrompt('ویرایش دسته',`<form id="editCat"><label>نام دسته<input id="editCatName" value="${escapeHtml(cat.name)}" required></label><div class="form-actions" style="margin-top:14px"><button type="button" class="secondary" data-close-prompt>انصراف</button><button class="primary">ذخیره</button></div></form>`);editCat.onsubmit=ev=>{ev.preventDefault();cat.name=editCatName.value.trim();save();closeModal('promptModal');renderLibrary()};return}b=e.target.closest('[data-lib-del-cat]');if(b){const cat=state.library.find(c=>c.id===b.dataset.libDelCat);if(cat.items.length)return toast('اول فعالیت‌های این دسته را حذف یا منتقل کنید');if(confirm(`دسته «${cat.name}» حذف شود؟`)){state.library=state.library.filter(c=>c.id!==cat.id);save();renderLibrary()}return}b=e.target.closest('[data-lib-edit-act]');if(b){const cat=state.library.find(c=>c.id===b.dataset.cat),act=cat.items.find(a=>a.id===b.dataset.libEditAct);libraryPrompt(cat,act);return}b=e.target.closest('[data-lib-del-act]');if(b){const cat=state.library.find(c=>c.id===b.dataset.cat),act=cat.items.find(a=>a.id===b.dataset.libDelAct);if(confirm(`فعالیت «${act.name}» از کتابخانه حذف شود؟\nقراردادهای قبلی تغییر نمی‌کنند.`)){cat.items=cat.items.filter(a=>a.id!==act.id);save();renderLibrary();toast('از کتابخانه حذف شد')}return}});


const loginFormEl=document.getElementById('loginForm');
if(loginFormEl)loginFormEl.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!auth){setAuthMessage('Firebase در دسترس نیست.','error');return;}
  const email=document.getElementById('loginEmail').value.trim();
  const password=document.getElementById('loginPassword').value;
  const btn=document.getElementById('loginBtn');
  btn.disabled=true;btn.textContent='در حال ورود...';setAuthMessage('در حال اتصال...');
  try{await auth.signInWithEmailAndPassword(email,password);}
  catch(err){setAuthMessage(authErrorMessage(err),'error');}
  finally{btn.disabled=false;btn.textContent='ورود';}
});
const logoutBtn=document.getElementById('logoutBtn');
if(logoutBtn)logoutBtn.addEventListener('click',async()=>{
  if(!auth)return;
  logoutBtn.disabled=true;
  try{await auth.signOut();}
  finally{logoutBtn.disabled=false;}
});

initFirebaseAuth();
