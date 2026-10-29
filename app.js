(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const escapeHTML = (value="") => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const demoSubjects = [
    {id:"demo-1",semester:1,name:"أساسيات الإلكترونيات",description:"المحاضرات والملخصات النظرية",icon:"ϟ",accent:"#8b7cff",sort_order:1,notes:[{id:"n1",title:"أساسيات الإلكترونيات — المحاضرة الأولى",description:"ملزمة تجريبية؛ استبدل الرابط من لوحة الإدارة",drive_url:"https://drive.google.com/drive/my-drive",sort_order:1},{id:"n2",title:"ملخص المادة",description:"أضف رابط الملزمة الحقيقي من لوحة الإدارة",drive_url:"https://drive.google.com/drive/my-drive",sort_order:2}]},
    {id:"demo-2",semester:1,name:"الرياضيات الهندسية",description:"المفاهيم والقوانين والمسائل",icon:"∑",accent:"#4ed6c7",sort_order:2,notes:[]},
    {id:"demo-3",semester:1,name:"جرائم حزب البعث",description:"المحاضرات والمصادر الدراسية",icon:"▤",accent:"#f1a86a",sort_order:3,notes:[]},
    {id:"demo-4",semester:1,name:"لينكس عملي",description:"الأوامر والتطبيقات العملية",icon:"⌘",accent:"#61a7ff",sort_order:4,notes:[]},
    {id:"demo-5",semester:1,name:"لينكس نظري",description:"مفاهيم أنظمة التشغيل",icon:"⌁",accent:"#ed80b5",sort_order:5,notes:[]},
    {id:"demo-6",semester:2,name:"أساسيات الإلكترونيات",description:"مواد الكورس الثاني",icon:"ϟ",accent:"#8b7cff",sort_order:1,notes:[]},
    {id:"demo-7",semester:2,name:"الرياضيات الهندسية",description:"مواد الكورس الثاني",icon:"∑",accent:"#4ed6c7",sort_order:2,notes:[]},
    {id:"demo-8",semester:2,name:"لينكس عملي",description:"مواد الكورس الثاني",icon:"⌘",accent:"#61a7ff",sort_order:3,notes:[]}
  ];
  let subjects = demoSubjects.map(s=>({...s,notes:[...s.notes]}));
  let semester = 1, courses=[{id:1,name:"الكورس الأول",subtitle:"الفصل الدراسي الأول",is_visible:true},{id:2,name:"الكورس الثاني",subtitle:"الفصل الدراسي الثاني",is_visible:true}], view = localStorage.getItem("riwaq-view") || "grid", currentSubject = null, db = null, toastTimer;
  const icons = ["ϟ","∑","▤","⌘","⌁","▣","⌂","✦"];
  const accentColors = ["#8b7cff","#4ed6c7","#f1a86a","#61a7ff","#ed80b5","#9acb6b"];
  const cfg = window.PORTAL_CONFIG || {};
  if (cfg.SITE_TITLE) { $("#site-title").textContent = cfg.SITE_TITLE; document.title = `${cfg.SITE_TITLE} | الملازم الجامعية`; }
  if (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    try { db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY); } catch(e) { console.error(e); }
  }
  const showToast = (msg) => { const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),3000); };
  const getRecent = () => { try{return JSON.parse(localStorage.getItem("riwaq-recent")||"[]")}catch{return []} };
  const setRecent = (item) => { const all=[item,...getRecent().filter(x=>x.id!==item.id)].slice(0,6);localStorage.setItem("riwaq-recent",JSON.stringify(all));renderRecent(); };
  const noteCount = s => (s.notes||[]).length;
  const allNotes = () => subjects.flatMap(s=>(s.notes||[]).map(n=>({...n,subjectName:s.name,semester:s.semester,subjectId:s.id})));
  let authMode = "login", currentUser = null;
  const authDialog = $("#auth-dialog");
  function setAuthMessage(message, isError=false) { const el=$("#auth-message"); el.textContent=message; el.style.color=isError?"var(--danger)":"var(--accent-2)"; }
  function setAuthMode(mode) {
    authMode=mode;
    document.querySelectorAll("[data-auth-mode]").forEach(b=>b.classList.toggle("active",b.dataset.authMode===mode));
    $("#display-name-wrap").hidden=mode!=="signup";
    $("#auth-name").required=mode==="signup";
    $("#auth-name").disabled=mode!=="signup";
    $("#auth-title").textContent=mode==="signup"?"أنشئ حسابك في رِواق":"أهلاً بعودتك";
    $("#auth-subtitle").textContent=mode==="signup"?"أدخل اسمك وبريدك الإلكتروني وكلمة المرور لإنشاء حساب.":"أدخل بريدك الإلكتروني وكلمة المرور فقط.";
    $("#auth-submit").textContent=mode==="signup"?"إنشاء الحساب":"تسجيل الدخول";
    $("#auth-password").autocomplete=mode==="signup"?"new-password":"current-password";
    $("#auth-name").value=mode==="signup"?$("#auth-name").value:"";
    $("#auth-forgot").hidden=mode!=="login";
    setAuthMessage("");
  }
  async function syncAccount(user) {
    currentUser=user||null;
    const logged=!!user;
    $("#account-label").textContent=logged?(user.user_metadata?.display_name || user.email?.split("@")[0] || "حسابي"):"تسجيل الدخول";
    $("#account-avatar").textContent=logged?((user.user_metadata?.display_name || user.email || "ط").trim().charAt(0).toLocaleUpperCase("ar")):"♙";
    const isAdmin=logged && cfg.ADMIN_EMAIL && user.email?.toLowerCase()===cfg.ADMIN_EMAIL.toLowerCase();
    $("#admin-shortcut").hidden=!isAdmin;
    if(logged){
      $("#auth-forms").hidden=true;$("#account-panel").hidden=false;
      $("#account-panel-name").textContent=user.user_metadata?.display_name || user.email?.split("@")[0] || "طالب رِواق";
      $("#account-panel-email").textContent=user.email||"";
      $("#account-panel-avatar").textContent=(user.user_metadata?.display_name || user.email || "ط").trim().charAt(0).toLocaleUpperCase("ar");
    }else{
      $("#auth-forms").hidden=false;$("#account-panel").hidden=true;
    }
  }
  async function initializeAuth() {
    if(!db){$("#auth-submit").disabled=true;setAuthMessage("فعّل الاتصال بـ Supabase أولاً من config.js حتى تعمل الحسابات.",true);return;}
    try {
      const {data:{session}}=await db.auth.getSession();
      await syncAccount(session?.user||null);
      if(session?.user){try{await db.from("user_activity").insert({user_id:session.user.id,event_type:"visit",details:"زيارة الموقع"});}catch(_){}}
      db.auth.onAuthStateChange((_event,session)=>{ syncAccount(session?.user||null); });
    } catch(err) { console.error(err); }
  }
  setAuthMode("login");
  $("#account-open").addEventListener("click",()=>{if(!currentUser)setAuthMode("login");authDialog.showModal();});
  $("#auth-close").addEventListener("click",()=>authDialog.close());
  authDialog.addEventListener("click",e=>{if(e.target===authDialog)authDialog.close();});
  document.querySelectorAll("[data-auth-mode]").forEach(b=>b.addEventListener("click",()=>setAuthMode(b.dataset.authMode)));
  $("#auth-form").addEventListener("submit",async e=>{
    e.preventDefault();
    if(!db){setAuthMessage("الاتصال بقاعدة البيانات غير مهيأ. راجع config.js وREADME.md.",true);return;}
    const email=$("#auth-email").value.trim().toLowerCase(), password=$("#auth-password").value;
    const submit=$("#auth-submit");submit.disabled=true;submit.textContent="جارٍ المعالجة...";setAuthMessage("");
    try {
      if(authMode==="signup"){
        const displayName=$("#auth-name").value.trim();
        if(!displayName){setAuthMessage("اكتب اسمك لإنشاء الحساب.",true);return;}
        if(displayName.length>80){setAuthMessage("الاسم يجب ألا يتجاوز 80 حرفاً.",true);return;}
        const {data,error}=await db.auth.signUp({email,password,options:{data:{display_name:displayName},emailRedirectTo:window.location.href.split("#")[0]}});
        if(error)throw error;
        if(data.session){await syncAccount(data.user);setAuthMessage("تم إنشاء الحساب بنجاح.");showToast("أهلاً بك في رِواق!");}
        else setAuthMessage("تم إرسال رسالة تأكيد إلى بريدك إذا كان تأكيد البريد مفعّلاً. افتح الرسالة ثم سجّل الدخول.");
      }else{
        const {data,error}=await db.auth.signInWithPassword({email,password});
        if(error)throw error;
        await syncAccount(data.user);
        try { await db.from("user_activity").insert({user_id:data.user.id,event_type:"login",details:"تسجيل الدخول"}); } catch (_) {}
        showToast("تم تسجيل الدخول بنجاح.");
        if(cfg.ADMIN_EMAIL && data.user.email?.toLowerCase()===cfg.ADMIN_EMAIL.toLowerCase()) { window.location.href="admin.html"; return; }
        authDialog.close();
      }
    } catch(err) {
      console.error(err);
      const message=String(err?.message||"").toLowerCase();
      setAuthMessage(message.includes("invalid login")?"البريد الإلكتروني أو كلمة المرور غير صحيحة.":message.includes("already registered")?"هذا البريد مسجل مسبقاً؛ جرّب تسجيل الدخول.":message.includes("password")?"تحقق من كلمة المرور؛ يجب أن تكون 8 أحرف على الأقل.":(err?.message||"تعذر إكمال العملية. تحقق من الاتصال والإعدادات."),true);
    } finally {submit.disabled=false;submit.textContent=authMode==="signup"?"إنشاء الحساب":"تسجيل الدخول";}
  });
  $("#auth-forgot").addEventListener("click",async()=>{
    if(!db)return setAuthMessage("فعّل الاتصال بـ Supabase أولاً.",true);
    const email=$("#auth-email").value.trim().toLowerCase();
    if(!email)return setAuthMessage("اكتب بريدك الإلكتروني أولاً.",true);
    const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:window.location.href.split("#")[0]});
    setAuthMessage(error?"تعذر إرسال رابط الاستعادة. تحقق من إعدادات Supabase.":"إذا كان البريد مسجلاً، فستصلك رسالة لاستعادة كلمة المرور.",!!error);
  });
  $("#account-signout").addEventListener("click",async()=>{if(!db)return;const {error}=await db.auth.signOut();if(error){$("#account-message").textContent="تعذر تسجيل الخروج؛ حاول مجدداً.";return;}await syncAccount(null);authDialog.close();showToast("تم تسجيل الخروج.");});

  async function loadSiteSettings(){
    const cfg=window.PORTAL_CONFIG||{};let settings={site_title:cfg.SITE_TITLE||"رِواق الجامعي",site_tagline:"مرجعك الدراسي، مرتب وبسيط.",telegram_url:cfg.TELEGRAM_URL||"",contact_email:cfg.CONTACT_EMAIL||"",contact_message:"تواصل معي للاستفسارات والاقتراحات."};
    if(db){try{const {data,error}=await db.from("site_settings").select("settings").eq("id",1).maybeSingle();if(!error&&data?.settings)settings={...settings,...data.settings}}catch(_){}}
    if(settings.site_title){$("#site-title").textContent=settings.site_title;document.title=`${settings.site_title} | الملازم الجامعية`}
    $("#footer-tagline").textContent=settings.site_tagline||"مرجعك الدراسي، مرتب وبسيط.";
    $("#contact-message").textContent=settings.contact_message||"للاستفسارات والاقتراحات";
    const tg=$("#contact-telegram"),mail=$("#contact-email"),empty=$("#contact-empty");
    if(settings.telegram_url&&/^https:\/\/(t\.me|telegram\.me)\//i.test(settings.telegram_url)){tg.href=settings.telegram_url;tg.hidden=false}else tg.hidden=true;
    if(settings.contact_email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contact_email)){mail.href=`mailto:${settings.contact_email}`;mail.textContent=`✉ البريد الإلكتروني (${settings.contact_email})`;mail.hidden=false}else mail.hidden=true;
    empty.hidden=!tg.hidden||!mail.hidden;
  }
  function initImageToPdf(){
    const dialog=$("#image-pdf-dialog"),picker=$("#image-pdf-files"),preview=$("#image-pdf-preview"),create=$("#image-pdf-create"),message=$("#image-pdf-message");if(!dialog)return;let files=[];
    $("#image-pdf-open").addEventListener("click",()=>dialog.showModal());$("#image-pdf-close").addEventListener("click",()=>dialog.close());dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});
    picker.addEventListener("change",()=>{files=Array.from(picker.files||[]).filter(f=>/^image\/(jpeg|png)$/.test(f.type));preview.innerHTML="";files.forEach(file=>{const url=URL.createObjectURL(file),card=document.createElement("div");card.className="pdf-thumb";card.innerHTML=`<img alt="معاينة الصورة"><small></small>`;card.querySelector("img").src=url;card.querySelector("small").textContent=file.name;preview.appendChild(card)});create.disabled=!files.length;message.textContent=files.length?`تم اختيار ${files.length} صورة.`:"اختر صورة واحدة على الأقل."});
    create.addEventListener("click",async()=>{if(!files.length)return;if(!window.jspdf?.jsPDF){message.textContent="تعذر تحميل أداة PDF. تحقق من الاتصال بالإنترنت ثم أعد المحاولة.";return}create.disabled=true;message.textContent="جارٍ تجهيز ملف PDF...";try{const mode=$("#pdf-page-size").value;let pdf=null;for(let i=0;i<files.length;i++){const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(files[i])});const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=data});let w=595.28,h=841.89;if(mode==="letter"){w=612;h=792}else if(mode==="fit"){const scale=72/96;w=img.width*scale;h=img.height*scale}if(!pdf)pdf=new window.jspdf.jsPDF({orientation:w>h?"landscape":"portrait",unit:"pt",format:[w,h]});else pdf.addPage([w,h],w>h?"landscape":"portrait");const ratio=Math.min(w/img.width,h/img.height),iw=img.width*ratio,ih=img.height*ratio;pdf.addImage(data,files[i].type==="image/png"?"PNG":"JPEG",(w-iw)/2,(h-ih)/2,iw,ih);}
      pdf.save("riwaq-images.pdf");message.textContent="تم إنشاء ملف PDF وتحميله إلى جهازك.";showToast("تم إنشاء ملف PDF بنجاح.");}catch(err){console.error(err);message.textContent="تعذر إنشاء الملف. جرّب صور JPG أو PNG أخرى."}finally{create.disabled=false}});
  }
  async function loadData() {
    await loadSiteSettings();
    if (db) {
      try {
        const [{data:subData,error:subErr},{data:noteData,error:noteErr},{data:courseData,error:courseErr}] = await Promise.all([
          db.from("subjects").select("*").eq("is_visible",true).order("sort_order"),
          db.from("notes").select("*").eq("is_visible",true).order("sort_order"),
          db.from("courses").select("*").eq("is_visible",true).order("sort_order")
        ]);
        if (subErr) throw subErr; if (noteErr) throw noteErr;
        if(!courseErr && courseData?.length) courses=courseData;
        subjects = (subData||[]).map(s=>({...s,semester:Number(s.semester),notes:(noteData||[]).filter(n=>n.subject_id===s.id)}));
      } catch(err) {
        console.error("Supabase read failed:",err);
        showToast("تعذر تحميل البيانات المباشرة؛ نعرض بيانات تجريبية حالياً.");
      }
    }
    render();
  }
  function renderCourseTabs(){const host=$("#semester-tabs");const visible=courses.filter(c=>c.is_visible!==false);if(!visible.length){host.innerHTML="";$("#subjects").hidden=true;$("#empty-state").hidden=false;$("#empty-state h3").textContent="لا توجد كورسات منشورة حالياً";$("#empty-state p").textContent="سيتم نشر الكورسات عند تحديث المحتوى.";return}if(!visible.some(c=>Number(c.id)===Number(semester)))semester=Number(visible[0].id);host.innerHTML=visible.map((c,i)=>`<button class="semester-tab ${Number(c.id)===Number(semester)?"active":""}" data-semester="${c.id}" role="tab" aria-selected="${Number(c.id)===Number(semester)}"><span class="tab-number">${String(i+1).padStart(2,"0")}</span><span><strong>${escapeHTML(c.name)}</strong><small>${escapeHTML(c.subtitle||"المواد الدراسية")}</small></span><span class="tab-arrow">↙</span></button>`).join("");}
  const courseName=id=>courses.find(c=>Number(c.id)===Number(id))?.name||`الكورس ${id}`;
  function render() {
    renderCourseTabs();
    $("#stat-courses").textContent=courses.filter(c=>c.is_visible!==false).length;
    $("#stat-subjects").textContent=subjects.length;
    $("#stat-notes").textContent=subjects.reduce((sum,s)=>sum+noteCount(s),0);
    renderSubjects();renderRecent();
  }
  function getSearch() { return $("#global-search").value.trim().toLocaleLowerCase("ar"); }
  function renderSubjects() {
    const q=getSearch(), container=$("#subjects");
    let filtered=subjects.filter(s=>s.semester===semester && (!q || `${s.name} ${s.description||""}`.toLocaleLowerCase("ar").includes(q) || (s.notes||[]).some(n=>`${n.title} ${n.description||""}`.toLocaleLowerCase("ar").includes(q))));
    $("#semester-title").textContent=`مواد ${courseName(semester)}`;
    $("#semester-subtitle").textContent=q?`نتائج البحث ضمن ${courseName(semester)}`:"اختر المادة لعرض الملازم المتوفرة";
    $("#subject-count").textContent=`${filtered.length} مواد`;
    $("#search-result-count").textContent=q?`${filtered.length} مادة مطابقة`:"";
    $("#clear-search").hidden=!q;
    container.className=`subjects-grid ${view==="list"?"list-view":""}`;
    container.innerHTML="";
    filtered.forEach((s,i)=>{
      const card=document.createElement("button");
      card.type="button";card.className=`subject-card ${view==="list"?"list-card":""}`;card.style.setProperty("--card-accent",s.accent||accentColors[i%accentColors.length]);card.style.animationDelay=`${i*35}ms`;
      card.innerHTML=`<div class="subject-card-top"><span class="subject-icon">${escapeHTML(s.icon||icons[i%icons.length])}</span><div><h4 class="subject-name">${escapeHTML(s.name)}</h4><div class="subject-meta">${escapeHTML(s.description||"الملازم والمحاضرات الدراسية")}</div></div></div><div class="subject-card-bottom"><span class="pill">${noteCount(s)} ${noteCount(s)===1?"ملزمة":"ملازم"}</span><span class="subject-link">عرض الملازم <span>←</span></span></div>`;
      card.addEventListener("click",()=>openSubject(s.id));container.appendChild(card);
    });
    $("#empty-state").hidden=filtered.length>0;
    container.hidden=filtered.length===0;
  }
  function openSubject(id) {
    currentSubject=subjects.find(s=>s.id===id);if(!currentSubject)return;
    $("#dialog-title").textContent=currentSubject.name;$("#dialog-description").textContent=currentSubject.description||"اختر الملزمة التي تريد فتحها أو تحميلها.";
    $("#note-search").value="";renderNotes();
    const dlg=$("#subject-dialog");if(!dlg.open)dlg.showModal();
    setRecent({id:currentSubject.id,name:currentSubject.name,semester:currentSubject.semester,icon:currentSubject.icon||"▤",accent:currentSubject.accent||accentColors[0]});
  }
  function renderNotes() {
    if(!currentSubject)return;
    const q=$("#note-search").value.trim().toLocaleLowerCase("ar");
    const notes=(currentSubject.notes||[]).filter(n=>!q||`${n.title} ${n.description||""}`.toLocaleLowerCase("ar").includes(q));
    $("#dialog-note-count").textContent=`${notes.length} ملازم`;
    $("#notes-list").innerHTML=notes.map(n=>`<article class="note-row"><div class="file-icon">PDF</div><div class="note-info"><strong>${escapeHTML(n.title)}</strong><small>${escapeHTML(n.description||"ملزمة دراسية")} ${n.updated_at?` · تحديث ${escapeHTML(new Date(n.updated_at).toLocaleDateString("ar-IQ"))}`:""}</small></div><div class="note-actions"><button class="note-action primary" data-open="${escapeHTML(n.id)}">فتح الملزمة ↗</button><button class="note-action" data-copy="${escapeHTML(n.id)}">نسخ الرابط</button></div></article>`).join("");
    $("#notes-empty").hidden=notes.length>0;
    $("#notes-list").querySelectorAll("[data-open]").forEach(btn=>btn.addEventListener("click",()=>{const n=notes.find(x=>String(x.id)===btn.dataset.open);if(n?.drive_url && /^https:\/\/(drive\.google\.com|docs\.google\.com)\//.test(n.drive_url)){window.open(n.drive_url,"_blank","noopener,noreferrer")}else showToast("رابط الملزمة غير مضاف أو غير صالح.");}));
    $("#notes-list").querySelectorAll("[data-copy]").forEach(btn=>btn.addEventListener("click",async()=>{const n=notes.find(x=>String(x.id)===btn.dataset.copy);if(!n)return;try{await navigator.clipboard.writeText(n.drive_url||"");showToast("تم نسخ رابط الملزمة.");}catch{showToast("تعذر النسخ تلقائياً؛ افتح الملزمة وانسخ رابطها.");}}));
  }
  function renderRecent() {
    const list=getRecent(), section=$("#recent-section");section.hidden=!list.length;
    $("#recent-list").innerHTML=list.map(x=>`<button class="recent-item" data-recent="${escapeHTML(x.id)}"><span class="subject-icon" style="--card-accent:${escapeHTML(x.accent||accentColors[0])}">${escapeHTML(x.icon||"▤")}</span><span><strong>${escapeHTML(x.name)}</strong><small>${escapeHTML(courseName(x.semester))} · فتح المادة</small></span></button>`).join("");
    $("#recent-list").querySelectorAll("[data-recent]").forEach(b=>b.addEventListener("click",()=>openSubject(b.dataset.recent)));
  }
  $("#semester-tabs").addEventListener("click",e=>{const b=e.target.closest("[data-semester]");if(!b)return;semester=Number(b.dataset.semester);renderCourseTabs();renderSubjects();});
  $("#global-search").addEventListener("input",renderSubjects);
  $("#clear-search").addEventListener("click",()=>{$("#global-search").value="";renderSubjects();$("#global-search").focus();});
  $("#reset-search").addEventListener("click",()=>{$("#global-search").value="";renderSubjects();});
  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{view=b.dataset.view;localStorage.setItem("riwaq-view",view);document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("active",x===b));renderSubjects();}));
  $("#close-dialog").addEventListener("click",()=>$("#subject-dialog").close());
  $("#subject-dialog").addEventListener("click",e=>{if(e.target===$("#subject-dialog"))$("#subject-dialog").close();});
  $("#note-search").addEventListener("input",renderNotes);
  $("#clear-recent").addEventListener("click",()=>{localStorage.removeItem("riwaq-recent");renderRecent();});
  const savedTheme=localStorage.getItem("riwaq-theme")||"dark";document.documentElement.dataset.theme=savedTheme;
  $("#theme-toggle").textContent=savedTheme==="dark"?"☼":"☾";
  $("#theme-toggle").addEventListener("click",()=>{const next=document.documentElement.dataset.theme==="dark"?"light":"dark";document.documentElement.dataset.theme=next;localStorage.setItem("riwaq-theme",next);$("#theme-toggle").textContent=next==="dark"?"☼":"☾";});
  document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  initializeAuth();
  initImageToPdf();
  loadData();
})();
