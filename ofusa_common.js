/**
 * ofusa_common.js - OFUSA書類作成システム 共通モジュール
 * ver.20260717.04
 */

// ===== Supabase =====
const SB_URL='https://ehwlgbwpycglmopiqyty.supabase.co';
const SB_KEY='sb_publishable_3ptyILIpGIcNA5sUBhFMbA_n0VxpY2u';
// ver.20260611: 親index.htmlのSupabase Authログインで保存されたセッショントークンを使う。
// cases/companies等がRLS(authenticated限定)のため、anonキーのままだと読めず会社が(none)になる。
// 同一オリジンなのでlocalStorageのsupabase-jsセッションを共有して読み取る。
function _b64urlJson(seg){
  var b=String(seg).replace(/-/g,'+').replace(/_/g,'/'); while(b.length%4) b+='=';
  var bin=atob(b), pct=''; for(var i=0;i<bin.length;i++){ pct+='%'+('00'+bin.charCodeAt(i).toString(16)).slice(-2); }
  return JSON.parse(decodeURIComponent(pct));
}
function _jwtExpMs(t){ try{ var p=_b64urlJson(String(t).split('.')[1]); return (p&&p.exp)?p.exp*1000:0; }catch(e){ return 0; } }
// localStorageのsupabase-jsセッション（親index.htmlが自動更新）から最新access_tokenを取得
function _sbTokenFromLS(){
  try{
    var keys = ['sb-ehwlgbwpycglmopiqyty-auth-token'];
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i);
      if(k && k.indexOf('sb-')===0 && k.indexOf('-auth-token')>=0 && keys.indexOf(k)<0) keys.push(k);
    }
    for(var j=0;j<keys.length;j++){
      var raw = localStorage.getItem(keys[j]);
      if(!raw) continue;
      var p = JSON.parse(raw);
      var tok = (p && p.access_token) || (p && p.currentSession && p.currentSession.access_token);
      if(tok) return tok;
    }
  }catch(e){}
  return '';
}
// ver.20260710: window.__OFUSA_SB_TOKEN は案件読込時の一度きりのスナップショットで更新されない。
// 約1時間で失効すると、時間が経ってからの保存(PATCH)が401で失敗する。
// window側が有効期限内ならそれを、失効/期限間近なら localStorage(supabase-jsが自動更新する最新)を使う。
function _sbToken(){
  var now = Date.now();
  var wt=''; try{ wt = window.__OFUSA_SB_TOKEN || ''; }catch(e){}
  if(wt && _jwtExpMs(wt) > now + 30000) return wt;   // window側トークンが有効
  var lt = _sbTokenFromLS();                          // 失効/不明 → 最新セッションへ
  if(lt) return lt;
  return wt || SB_KEY;                                // 最後の手段
}
async function sb(path,opts={}){
  const headers = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + _sbToken(),
    'Content-Type': 'application/json',
    ...(opts.headers || {})
  };
  // opts から headers を除外してから spread（headers が上書きされないように）
  const { headers: _hdr, ...restOpts } = opts;
  const r = await fetch(SB_URL + '/rest/v1/' + path, { ...restOpts, headers });
  const t = await r.text();
  if(!r.ok){ const e = t ? JSON.parse(t) : {}; throw new Error(e.message || e.hint || ('HTTP ' + r.status)); }
  return t ? JSON.parse(t) : null;
}

// ===== 登録支援機関(support_orgs)の名前照合 =====
// ver.20260715: cases.org は「株式会社KMT(82)」のように末尾に括弧サフィックスが付いたり、
// 「JHesperus Japan株式会社」のように空白の有無が support_orgs.name と揃わないことがある。
// 従来は name=eq.（完全一致）のみだったため、これらの案件で登録支援機関が空欄になっていた。
// ①完全一致 → ②正規化一致（末尾括弧・空白・大小文字を無視／候補が1件のときのみ採用）の順で引く。
// ※誤った支援機関名を誓約書等に載せないため、正規化して2件以上ヒットした場合は採用しない（空欄のまま）。
const _soCache={};
function _soNorm(s){
  return String(s||'')
    .replace(/[（(][^）)]*[）)]\s*$/,'')   // 末尾の括弧サフィックス（(82)等）を除去
    .replace(/[\s\u3000]/g,'')            // 半角/全角スペースを除去
    .toUpperCase();
}
async function findSupportOrg(name, cols){
  const raw=String(name||'').trim();
  if(!raw) return null;
  const sel=cols||'name,address,support_manager';
  // ① 完全一致（従来どおり）
  try{
    const r=await sb('support_orgs?select='+sel+'&name=eq.'+encodeURIComponent(raw));
    if(r&&r[0]) return r[0];
  }catch(e){}
  // ② 正規化一致（selごとにキャッシュ）
  try{
    const key=_soNorm(raw);
    if(!key) return null;
    if(!_soCache[sel]) _soCache[sel]=await sb('support_orgs?select='+sel+'&limit=500');
    const hits=(_soCache[sel]||[]).filter(o=>_soNorm(o.name)===key);
    if(hits.length===1) return hits[0];
  }catch(e){}
  return null;
}

// ===== 賃金締切日／支払日の文言組み立て =====
// ver.20260715: アンシスの値が「毎月末日」「25」「末」「翌月5日」等と揺れており、
// テンプレ側で「毎月」＋値＋「日」と組み立てると「毎月毎月末日日」のように二重になっていた。
// 値から完成した文言を作り、テンプレ側は接頭辞・接尾辞を付けない方式に変更する。
// ※12文字超（説明文つき）や入力ミスは触らずそのまま返す（書類側で勝手に補正しない）。
function payPhrase(raw, defPrefix){
  var s=String(raw||'').trim().replace(/[\s\u3000]/g,'');
  if(!s) return '';
  if(s.length>12) return s;                        // 「翌月25日（金融機関休業日の…）」等はそのまま
  var m=s.match(/^(毎月|翌月|当月|翌)/);
  var prefix = m ? (m[1]==='翌'?'翌月':m[1]) : (defPrefix||'毎月');
  var body   = m ? s.slice(m[1].length) : s;
  if(body==='月末') body='末';
  if(!body) return prefix;                         // 値が「毎月」だけ
  if(/日$/.test(body))   return prefix+body;       // 既に「…日」で終わる
  if(body==='末')        return prefix+'末日';
  if(/^\d+$/.test(body)) return prefix+body+'日';  // 数字だけ
  return prefix+body;
}
// f() と同じく data-bind を保持し、直接編集・連動ジャンプが効く状態で整形値を出す
const fPay=(id,defPrefix)=>{
  const raw=v(id);
  if(!raw) return f(id);                           // 未入力ならプレースホルダ表示のまま
  return `<span class="f" data-bind="${id}">${esc(payPhrase(raw,defPrefix))}</span>`;
};

// ===== 自動補完（既定値）の管理 =====
// ver.20260715: 重説の昇給額/条件/時期のように、アンシスに元データが無く書類側で既定値を
// 補完する欄がある。これをそのまま emp_sets に書き戻すと企業の実データを潰し、
// 1-6号など他書類にも波及するため、「自動補完した値は emp_sets に書かない」ことを保証する。
// 利用者が手で直したときだけ書き戻す（input で印を外す）。
function setAutoDefault(id, val){
  const e = document.getElementById(id);
  if(!e || val == null || val === '') return;
  e.value = val;
  e.dataset.autofill = '1';   // 自動補完の印
}
document.addEventListener('input', function(ev){
  const t = ev.target;
  if(t && t.dataset && t.dataset.autofill === '1') delete t.dataset.autofill;  // 手入力されたら印を外す
}, true);

// ===== ユーティリティ =====
const esc=s=>s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):'';
// ver.20260612: 入力欄が無い書類でも、DBから読み込んだ翻訳等をプレビューに出せるようフォールバック保持
window._fieldData=window._fieldData||{};
const v=id=>{const el=document.getElementById(id);if(el&&el.value!=='')return el.value;return (window._fieldData&&window._fieldData[id])||'';};
const fmt=n=>n?Number(String(n).replace(/,/g,'')).toLocaleString('ja-JP'):'';
const f=id=>{const raw=v(id);const val=esc(raw).replace(/\n/g,'<br>');const label=id.replace(/^es_/,'es.').replace(/^f_/,'');return val?`<span class="f" data-bind="${id}">${val}</span>`:`<span class="f" data-bind="${id}" style="color:#aaa;font-size:0.85em;font-family:monospace;">${label}</span>`;};
// 業務区分の冗長表示対策: 値の中の「（〜分野…）」「（〜特定技能…号）」など、分野名/号数の括弧書きを表示時に除去する。
// 例「飲食料品製造業全般（飲食料品製造業分野・特定技能１号）」→「飲食料品製造業全般」。他の括弧は残す。
const fBunya=id=>{const rawFull=v(id);const raw=String(rawFull||'').replace(/[（(][^）)]*(分野|特定技能)[^）)]*[）)]/g,'').replace(/[（(][^）)]*(分野|特定技能)[^）)]*$/,'').replace(/\s+$/,'').trim();const val=esc(raw).replace(/\n/g,'<br>');const label=id.replace(/^es_/,'es.').replace(/^f_/,'');return val?`<span class="f" data-bind="${id}">${val}</span>`:`<span class="f" data-bind="${id}" style="color:#aaa;font-size:0.85em;font-family:monospace;">${label}</span>`;};
/* 業務区分は「土木・建築」のように1行にまとめて表示する。
   ・分野名/号数の括弧書きは除去する
   ・1つ目と2つ目が同じ内容なら1つだけ出す（データ側の重複登録を吸収）
   ・どちらも空なら従来どおり空欄の目印を出す */
const fBunyaPair=(idA,idB)=>{
  var clean=function(s){
    return String(s||'')
      .replace(/[（(][^）)]*(分野|特定技能)[^）)]*[）)]/g,'')
      .replace(/[（(][^）)]*(分野|特定技能)[^）)]*$/,'')
      .trim();
  };
  // 1つの欄に「土木、建築」のように複数入っていることがあるので読点/カンマで分解する。
  // 中点は「ライフライン・設備」のような正式名称に含まれるため分解しない。
  // 重複判定だけは中点も含めて細かく見る（例:「土木・建築」と「建築」を重複扱いにする）。
  var list=[], seen={};
  [idA,idB].forEach(function(id){
    clean(v(id)).split(/[,、]\s*/).forEach(function(t){
      t=t.trim(); if(!t) return;
      var tokens=t.split(/[・]\s*/).map(function(x){return x.trim();}).filter(Boolean);
      var isNew=false;
      tokens.forEach(function(tk){ if(!seen[tk]){ seen[tk]=1; isNew=true; } });
      if(isNew) list.push({id:id,t:t});
    });
  });
  if(!list.length) return fBunya(idA);
  return list.map(function(x){ return '<span class="f" data-bind="'+x.id+'">'+esc(x.t)+'</span>'; }).join('・');
};
const ff=id=>{const raw=v(id);const label=id.replace(/^es_/,'es.').replace(/^f_/,'');if(raw){const num=Number(String(raw).replace(/,/g,''));return`<span class="f" data-bind="${id}" data-bind-fmt="1">${isNaN(num)?esc(raw):num.toLocaleString('ja-JP')}</span>`;}return`<span class="f" data-bind="${id}" data-bind-fmt="1" style="color:#aaa;font-size:0.85em;font-family:monospace;">${label}</span>`;};

// ===== チェックボックス =====
window.cbState=window.cbState||{};
let _cbSeq=0;
function resetCbSeq(){_cbSeq=0;}
const cb=(on,id)=>{const state=id&&window.cbState[id]!==undefined?window.cbState[id]:on;return`<span class="cb-click" onclick="toggleCb('${id||''}')" data-cbid="${id||''}">${state?'■':'□'}</span>`;};
function toggleCb(id){if(!id)return;window.cbState[id]=!window.cbState[id];document.querySelectorAll(`[data-cbid="${id}"]`).forEach(el=>{el.textContent=window.cbState[id]?'■':'□';});}
// 保険の加入判定：読込済みemp_set(window._empLoadedSet)の値を見て、未加入系のみ false。
// 未設定/空は従来どおり「加入(true)」を既定にする。プレビューの cb() の既定値に使う。
function insEnrolled(dbKey){
  try{
    var s=window._empLoadedSet||{}; var v=s[dbKey];
    if(v==null) return true;
    v=String(v).trim(); if(v==='') return true;
    return !/^(未加入|未加入です|なし|無|false|no|0|×|✕|x)$/i.test(v);
  }catch(_e){ return true; }
}
// 定期健診の頻度フレーズ（日本語）。healthCheckFreqが年2回/半年系のときだけ「半年ごと」。既定は「1年ごと」。
function healthFreqJP(){
  try{
    var s=window._empLoadedSet||{}; var v=String(s.healthCheckFreq||'').trim();
    if(/年\s*2\s*回|半年|2\s*回|半期|setengah|twice/i.test(v)) return 'その後半年ごとに実施';
    return 'その後１年ごとに実施';
  }catch(_e){ return 'その後１年ごとに実施'; }
}
// ⑤: 現在ログイン中のユーザー識別子（メール等）を認証トークンから取得（保存ログ用）
function _currentUserId(){
  try{ var t=_sbToken(); if(!t) return ''; var seg=t.split('.')[1]; if(!seg) return ''; var p=JSON.parse(decodeURIComponent(escape(atob(seg.replace(/-/g,'+').replace(/_/g,'/'))))); return p.email||p.sub||''; }catch(e){ return ''; }
}

/* ============================================================
   applyBindings: 編集呼び出し後に data-bind スパンへ現在値を差し込む
   p()（全再描画）を使わずに変数スパンだけ更新する
   ============================================================ */
function applyBindings(){
  const area=document.getElementById('pageArea');if(!area)return;
  const spans=area.querySelectorAll('[data-bind]');
  spans.forEach(span=>{
    const id=span.getAttribute('data-bind');
    const raw=(typeof v==='function'?v(id):'')|| (window._fieldData&&window._fieldData[id])||'';
    const label=id.replace(/^es_/,'es.').replace(/^f_/,'');
    if(raw){
      span.style.color='';span.style.fontSize='';span.style.fontFamily='';
      const isMoney=span.getAttribute('data-bind-fmt')==='1';
      if(isMoney){const num=Number(String(raw).replace(/,/g,''));span.innerHTML=isNaN(num)?esc(raw):num.toLocaleString('ja-JP');}
      else{span.innerHTML=esc(raw).replace(/\n/g,'<br>');}
    }else{
      span.style.color='#aaa';span.style.fontSize='0.85em';span.style.fontFamily='monospace';
      span.textContent=label;
    }
  });
  return spans.length; // data-bind スパン数を返す（0=旧形式）
}
/* data-bind スパンをプレースホルダー（変数名）に戻す */
function resetBindings(){
  const area=document.getElementById('pageArea');if(!area)return;
  area.querySelectorAll('[data-bind]').forEach(span=>{
    const id=span.getAttribute('data-bind');
    const label=id.replace(/^es_/,'es.').replace(/^f_/,'');
    span.style.color='#aaa';span.style.fontSize='0.85em';span.style.fontFamily='monospace';
    span.textContent=label;
  });
}
/* 編集呼び出し後のフリーズ管理 */
window._htmlFrozen=window._htmlFrozen||false;
function freezeLoadedHtml(){window._htmlFrozen=true;}
function unfreezeLoadedHtml(){window._htmlFrozen=false;if(typeof p==='function')p();}

// ===== 直接編集の未保存検知（ver.20260717） =====
// 直接編集は「✏️直接編集 → 編集 → 💾DB保存」で companies.extra['_edited'] に保存される。
// 保存せずにタブを閉じたり案件を切り替えると編集内容は消えるが、
// 画面上は編集後の見た目のままなので気づけない。未保存のまま離脱する前に知らせる。
window._editedDirty = false;
function markEditedDirty(){ window._editedDirty = true; }
function clearEditedDirty(){ window._editedDirty = false; }
window.addEventListener('beforeunload', function(e){
  if(window._editedDirty){
    e.preventDefault();
    e.returnValue = '直接編集した内容がまだ保存されていません。';
    return e.returnValue;
  }
});

// ===== 印刷・トースト =====
// ver.20260710: 空欄フィールドのプレースホルダ(es.xxx / f_xxx 等の変数名)は
//   画面編集用の目印であり、PDF/印刷には出さない。
//   f()/ff()/applyBindings/resetBindings が空欄時に付与する monospace スパンを印刷時のみ隠す。
(function(){
  try{
    if(document.getElementById('__ph_print_style')) return;
    var st=document.createElement('style');
    st.id='__ph_print_style';
    st.textContent='@media print{span.f[style*="monospace"]{visibility:hidden!important;}}';
    (document.head||document.documentElement).appendChild(st);
  }catch(e){}
})();
/* 印刷・PDF保存時のファイル名を「人材名_様式名」にする（例：IMROY SYAHPUTRA_1-6）。
   ブラウザはPDF保存時のファイル名に document.title を使うため、印刷の間だけ書き換えて元に戻す。 */
function _printApplicantName(){
  try{
    // ① 書類ごとの申請人欄（書類により名前が異なるので順に探す）
    var ids=['es_applicantName','f_applicant','f_applicantName','es_applicant'];
    for(var i=0;i<ids.length;i++){
      var el=document.getElementById(ids[i]);
      if(el && String(el.value||'').trim()) return String(el.value).trim();
    }
    // ② 案件選択（indexから渡された情報）
    var sel=document.getElementById('caseSelect');
    if(sel && sel.value){
      try{ var d=JSON.parse(sel.value); if(d && d.applicant) return String(d.applicant).trim(); }catch(_e){}
      var t=sel.options[sel.selectedIndex]?sel.options[sel.selectedIndex].textContent:'';
      t=String(t||'').split('　(')[0].replace(/^\d+\.\s*/,'').trim();
      if(t && t!=='(名前なし)') return t;
    }
    if(window._empCtx && window._empCtx.applicant) return String(window._empCtx.applicant).trim();
  }catch(_e){}
  return '';
}
function _printDocLabel(){
  // <title>「参考様式第１－６号 …」から「1-6」を作る。取れなければタイトルをそのまま使う。
  var t=String(document.title||'').trim();
  var zen='０１２３４５６７８９';
  var norm=t.replace(/[０-９]/g,function(c){ return String(zen.indexOf(c)); });
  var m=norm.match(/第\s*(\d+)\s*[－\-−ー]\s*(\d+)\s*号/);
  if(m) return m[1]+'-'+m[2];
  m=norm.match(/様式第\s*(\d+)\s*号?/);
  if(m) return m[1];
  return t.replace(/[\\\/:*?"<>|]/g,'').slice(0,40);
}
function doPrint(){
  var orig=document.title;
  try{
    var who=_printApplicantName();
    var doc=_printDocLabel();
    var name=(who? who+'_' : '')+doc;
    document.title=name.replace(/[\\\/:*?"<>|]/g,'_');
  }catch(_e){}
  try{ window.print(); }
  finally{ setTimeout(function(){ document.title=orig; }, 1000); }
}
function showToast(msg){const t=document.createElement('div');t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e293b;color:white;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,.3);font-family:sans-serif;';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3000);}

// ===== 文字サイズ =====
let _fontSize=8.5,_editMode=false,_editLock=false;
function _applyFontSize(){let st=document.getElementById('_fontSizeStyle');if(!st){st=document.createElement('style');st.id='_fontSizeStyle';document.head.appendChild(st);}st.textContent=`.doc{font-size:${_fontSize}pt!important;}.doc .id{font-size:${(_fontSize*7.5/8.5).toFixed(2)}pt!important;}.doc [style*="font-size:9pt"]{font-size:${(_fontSize*9/8.5).toFixed(2)}pt!important;}.doc [style*="font-size:8pt"]{font-size:${(_fontSize*8/8.5).toFixed(2)}pt!important;}.doc [style*="font-size:8.5pt"]{font-size:${_fontSize}pt!important;}.doc [style*="font-size:7.5pt"]{font-size:${(_fontSize*7.5/8.5).toFixed(2)}pt!important;}.doc [style*="font-size:7pt"]{font-size:${(_fontSize*7/8.5).toFixed(2)}pt!important;}.doc [style*="font-size:6.5pt"]{font-size:${(_fontSize*6.5/8.5).toFixed(2)}pt!important;}.doc [style*="font-size:6pt"]{font-size:${(_fontSize*6/8.5).toFixed(2)}pt!important;}.doc [style*="font-size:15pt"]{font-size:${(_fontSize*15/8.5).toFixed(2)}pt!important;}.doc [style*="font-size:10pt"]{font-size:${(_fontSize*10/8.5).toFixed(2)}pt!important;}`;}
function changeFontSize(delta){if(_editMode){const sel=window.getSelection();if(sel&&!sel.isCollapsed){const range=sel.getRangeAt(0);const newSize=delta===0?8.5:Math.round(Math.max(5,Math.min(14,_fontSize+delta))*2)/2;const span=document.createElement('span');span.style.fontSize=newSize+'pt';try{range.surroundContents(span);sel.removeAllRanges();}catch(e){const frag=range.extractContents();span.appendChild(frag);range.insertNode(span);}}const lbl=document.getElementById('fontSizeLabel');if(lbl)lbl.textContent=(delta===0?8.5:Math.round(Math.max(5,Math.min(14,_fontSize+delta))*2)/2)+'pt';return;}if(delta===0){_fontSize=8.5;}else{_fontSize=Math.round(Math.max(5,Math.min(14,_fontSize+delta))*2)/2;}_applyFontSize();const lbl=document.getElementById('fontSizeLabel');if(lbl)lbl.textContent=_fontSize+'pt';}

// ===== 直接編集モード =====
function toggleEditMode(){
  _editMode=!_editMode;
  const btn=document.getElementById('editModeBtn');
  const area=document.getElementById('pageArea');
  if(_editMode){
    _editLock=true;
    if(btn){btn.textContent='✏️ 編集中（クリックで終了）';btn.classList.add('edit-mode-on');}
    if(area)area.classList.add('edit-mode');
    enableDocEditing(true);
  }else{
    _editLock=false;
    if(btn){btn.textContent='✏️ 直接編集';btn.classList.remove('edit-mode-on');}
    if(area)area.classList.remove('edit-mode');
    enableDocEditing(false);
    // 直接編集した内容を破棄しないよう、終了時にHTMLをフリーズして保持する。
    // （以前はここで p() を呼んでフォーム値から作り直していたため、手編集が消えていた）
    // フリーズ後もフォームの変数(data-bind)は applyBindings() 経由で更新される。
    window._htmlFrozen=true;
  }
}
function enableDocEditing(on){
  const area=document.getElementById('pageArea');
  if(!area)return;
  // ver.20260717: 直接編集の未保存を検知する。editable 中の入力を1度だけ拾えばよい。
  if(on && !area.dataset.dirtyHooked){
    area.dataset.dirtyHooked='1';
    area.addEventListener('input', function(){ if(_editMode) markEditedDirty(); });
  }
  area.querySelectorAll('.doc').forEach(doc=>{
    if(on){
      doc.setAttribute('contenteditable','true');
      doc.classList.add('doc-editable');
      doc.querySelectorAll('.cb-click').forEach(cb=>cb.setAttribute('contenteditable','false'));
      // ※ 変数スパン(.f)は空にしない → data-bind で applyBindings() が値を流せるようにする
    }else{
      doc.removeAttribute('contenteditable');
      doc.classList.remove('doc-editable');
    }
  });
}


// ===== スタイル編集モード =====
let _styleMode = false;
let _styleTarget = null;

function toggleStyleMode(){
  _styleMode = !_styleMode;
  const btn = document.getElementById('styleModeBtn');
  const panel = document.getElementById('stylePanel');
  const area = document.getElementById('pageArea');
  if(_styleMode){
    if(btn){btn.textContent='🎨 スタイル編集中';btn.style.background='#d97706';btn.style.color='white';}
    if(panel) panel.style.display='flex';
    if(area) area.querySelectorAll('.doc *').forEach(el=>{
      el.style.cursor='pointer';
      el.addEventListener('click',_styleClickHandler,true);
    });
  }else{
    if(btn){btn.textContent='🎨 スタイル編集';btn.style.background='';btn.style.color='';}
    if(panel) panel.style.display='none';
    _styleTarget=null;
    if(area) area.querySelectorAll('.doc *').forEach(el=>{
      el.style.cursor='';
      el.removeEventListener('click',_styleClickHandler,true);
    });
    // ハイライト解除
    document.querySelectorAll('.__style-selected').forEach(el=>el.classList.remove('__style-selected'));
  }
}

function _styleClickHandler(e){
  if(!_styleMode) return;
  e.preventDefault(); e.stopPropagation();
  document.querySelectorAll('.__style-selected').forEach(el=>el.classList.remove('__style-selected'));
  _styleTarget = e.currentTarget;
  _styleTarget.classList.add('__style-selected');
  _syncStylePanel(_styleTarget);
}

function _syncStylePanel(el){
  if(!el) return;
  const cs = window.getComputedStyle(el);
  const s = el.style;
  // 外枠
  const bv = s.border||s.borderTop||'';
  document.getElementById('sp_borderType').value = bv.includes('dashed')?'dashed':bv.includes('dotted')?'dotted':bv.includes('double')?'double':bv?'solid':'none';
  const bm = (s.border||'').match(/\d+/); 
  document.getElementById('sp_borderWidth').value = bm?bm[0]:'1';
  const bc = (s.border||'').match(/#[0-9a-fA-F]{3,6}/);
  document.getElementById('sp_borderColor').value = bc?bc[0]:'#333333';
  // 背景色
  document.getElementById('sp_bgColor').value = _rgbToHex(cs.backgroundColor)||'#ffffff';
  // テキスト色
  document.getElementById('sp_textColor').value = _rgbToHex(cs.color)||'#000000';
  // アンダーライン
  const td = s.textDecoration||cs.textDecoration||'';
  document.getElementById('sp_underline').value = td.includes('double')?'double':td.includes('underline')?'underline':'none';
  // 余白
  document.getElementById('sp_paddingT').value = parseInt(s.paddingTop)||0;
  document.getElementById('sp_paddingB').value = parseInt(s.paddingBottom)||0;
  document.getElementById('sp_paddingL').value = parseInt(s.paddingLeft)||0;
  document.getElementById('sp_paddingR').value = parseInt(s.paddingRight)||0;
}

function _rgbToHex(rgb){
  if(!rgb||rgb==='rgba(0, 0, 0, 0)'||rgb==='transparent') return null;
  const m=rgb.match(/\d+/g); if(!m||m.length<3) return null;
  return '#'+[m[0],m[1],m[2]].map(x=>parseInt(x).toString(16).padStart(2,'0')).join('');
}

function applyStyle(){
  if(!_styleTarget) return;
  const borderType = document.getElementById('sp_borderType').value;
  const borderWidth = document.getElementById('sp_borderWidth').value;
  const borderColor = document.getElementById('sp_borderColor').value;
  const bgColor = document.getElementById('sp_bgColor').value;
  const textColor = document.getElementById('sp_textColor').value;
  const underline = document.getElementById('sp_underline').value;
  const pt = document.getElementById('sp_paddingT').value;
  const pb = document.getElementById('sp_paddingB').value;
  const pl = document.getElementById('sp_paddingL').value;
  const pr = document.getElementById('sp_paddingR').value;

  _styleTarget.style.border = borderType==='none' ? 'none' : `${borderWidth}px ${borderType} ${borderColor}`;
  _styleTarget.style.backgroundColor = bgColor==='#ffffff' ? '' : bgColor;
  _styleTarget.style.color = textColor==='#000000' ? '' : textColor;
  _styleTarget.style.textDecoration = underline==='none' ? '' : underline==='double' ? 'underline double' : 'underline';
  _styleTarget.style.padding = `${pt}px ${pr}px ${pb}px ${pl}px`;
}

function clearStyle(){
  if(!_styleTarget) return;
  _styleTarget.style.border='';
  _styleTarget.style.backgroundColor='';
  _styleTarget.style.color='';
  _styleTarget.style.textDecoration='';
  _styleTarget.style.padding='';
  _syncStylePanel(_styleTarget);
}

// スタイルパネルのHTML（page-navの後に挿入）
function _injectStylePanel(){
  if(document.getElementById('stylePanel')) return;
  const panel = document.createElement('div');
  panel.id='stylePanel';
  panel.style.cssText='display:none;align-items:center;gap:8px;padding:4px 10px;background:#1e293b;border-bottom:1px solid #334155;flex-wrap:wrap;font-size:11px;font-family:sans-serif;color:#e2e8f0;';
  panel.innerHTML=`
    <span style="color:#f59e0b;font-weight:700;">🎨 クリックで要素を選択</span>
    <span style="color:#64748b;">｜</span>
    <label>外枠:
      <select id="sp_borderType" style="background:#334155;color:#e2e8f0;border:none;padding:2px;">
        <option value="none">なし</option>
        <option value="solid">実線</option>
        <option value="dashed">点線</option>
        <option value="dotted">破線</option>
        <option value="double">二重線</option>
      </select>
    </label>
    <input id="sp_borderWidth" type="number" min="1" max="5" value="1" style="width:36px;background:#334155;color:#e2e8f0;border:none;padding:2px;">px
    <input id="sp_borderColor" type="color" value="#333333" style="width:28px;height:24px;border:none;cursor:pointer;">
    <span style="color:#64748b;">｜</span>
    <label>背景: <input id="sp_bgColor" type="color" value="#ffffff" style="width:28px;height:24px;border:none;cursor:pointer;"></label>
    <label>文字色: <input id="sp_textColor" type="color" value="#000000" style="width:28px;height:24px;border:none;cursor:pointer;"></label>
    <span style="color:#64748b;">｜</span>
    <label>下線:
      <select id="sp_underline" style="background:#334155;color:#e2e8f0;border:none;padding:2px;">
        <option value="none">なし</option>
        <option value="underline">実線</option>
        <option value="double">二重線</option>
      </select>
    </label>
    <span style="color:#64748b;">｜</span>
    <label>余白(上): <input id="sp_paddingT" type="number" value="0" style="width:36px;background:#334155;color:#e2e8f0;border:none;padding:2px;"></label>
    <label>下: <input id="sp_paddingB" type="number" value="0" style="width:36px;background:#334155;color:#e2e8f0;border:none;padding:2px;"></label>
    <label>左: <input id="sp_paddingL" type="number" value="0" style="width:36px;background:#334155;color:#e2e8f0;border:none;padding:2px;"></label>
    <label>右: <input id="sp_paddingR" type="number" value="0" style="width:36px;background:#334155;color:#e2e8f0;border:none;padding:2px;"></label>
    <span style="color:#64748b;">｜</span>
    <button onclick="applyStyle()" style="background:#059669;color:white;border:none;padding:3px 10px;border-radius:4px;cursor:pointer;">✅ 適用</button>
    <button onclick="clearStyle()" style="background:#dc2626;color:white;border:none;padding:3px 10px;border-radius:4px;cursor:pointer;">🗑 クリア</button>
  `;
  // page-navの後に挿入
  const nav = document.querySelector('.page-nav');
  if(nav) nav.parentNode.insertBefore(panel, nav.nextSibling);
}

// .__style-selected のCSS
function _injectStyleCSS(){
  if(document.getElementById('__styleEditorCSS')) return;
  const st=document.createElement('style');
  st.id='__styleEditorCSS';
  st.textContent='.__style-selected{outline:2px solid #f59e0b!important;outline-offset:1px!important;}';
  document.head.appendChild(st);
}

// 初期化（DOMContentLoaded後）
document.addEventListener('DOMContentLoaded',()=>{_injectStylePanel();_injectStyleCSS();});

// ===== ページナビ =====
function scrollToPage(n){const area=document.getElementById('pageArea');if(!area)return;const docs=area.querySelectorAll('.doc');if(docs[n-1])docs[n-1].scrollIntoView({behavior:'smooth',block:'start'});document.querySelectorAll('.pn-btn-page').forEach((b,i)=>b.classList.toggle('active',i===n-1));}
function setupPageTracker(){const area=document.getElementById('pageArea');if(!area)return;area.addEventListener('scroll',()=>{const docs=area.querySelectorAll('.doc');const areaTop=area.getBoundingClientRect().top;let active=0;docs.forEach((d,i)=>{if(d.getBoundingClientRect().top-areaTop<100)active=i;});document.querySelectorAll('.pn-btn-page').forEach((b,i)=>b.classList.toggle('active',i===active));});}

// ===== 案件選択 =====
let _allCases=[],_companyFolderMap={},_orgFolderMap={};
async function initCaseSelect(){
  const sel=document.getElementById('caseSelect');if(!sel)return;
  sel.innerHTML='<option value="">読込中...</option>';
  try{
    const [cosRes,sosRes]=await Promise.all([
      sb('companies?select=id,name,folder_no,support_org_name&limit=2000'),
      sb('support_orgs?select=name,folder_no&limit=500')
    ]);
    _companyFolderMap={};window._companyNameFolderMap={};window._allCompanies=[];
    (cosRes||[]).forEach(c=>{const n=parseInt(c.folder_no)||99999;_companyFolderMap[c.id]=n;if(!window._companyNameFolderMap[c.name]||n<window._companyNameFolderMap[c.name])window._companyNameFolderMap[c.name]=n;window._allCompanies.push({name:c.name,folderNo:n,orgName:c.support_org_name||''});});
    _orgFolderMap={};(sosRes||[]).forEach(s=>{_orgFolderMap[s.name||'']=parseInt(s.folder_no)||99999;});
    let all=[],offset=0,pageSize=1000;
    while(true){
      const chunk=await sb('cases?select=id,name,applicant,company,company_id,org,emp_set_idx,applicant_field,applicant_field_en&order=created_at.desc&limit='+pageSize+'&offset='+offset);
      if(!chunk||!chunk.length)break;
      all=all.concat(chunk);
      if(chunk.length<pageSize)break;
      offset+=pageSize;
    }
    _allCases=all;buildFilterOptions();filterCases();
  }catch(e){console.warn('案件取得エラー:',e);if(sel)sel.innerHTML='<option value="">取得エラー</option>';}
}
function _sortOrgs(arr){return[...arr].sort((a,b)=>{const fa=_orgFolderMap[a]||99999,fb=_orgFolderMap[b]||99999;return fa!==fb?fa-fb:a.localeCompare(b,'ja');});}
function buildFilterOptions(){const orgSel=document.getElementById('filterOrg');if(!orgSel)return;const orgs=_sortOrgs([...new Set(_allCases.map(r=>r.org||'').filter(Boolean))]);const prevOrg=orgSel.value;orgSel.innerHTML='<option value="">── すべて ──</option>';orgs.forEach(o=>{const el=document.createElement('option');el.value=o;const fn=_orgFolderMap[o];el.textContent=(fn&&fn<99999?fn+'. ':'')+o;orgSel.appendChild(el);});if(prevOrg)orgSel.value=prevOrg;rebuildCompanyList(orgSel.value);}
function rebuildCompanyList(orgV){const coSel=document.getElementById('filterCompany');if(!coSel)return;const prevCo=coSel.value;const allCos=window._allCompanies||[];const filtered=orgV?allCos.filter(c=>c.orgName===orgV):allCos;const seen={},unique=[];filtered.forEach(c=>{if(!seen[c.name]){seen[c.name]=true;unique.push(c);}});unique.sort((a,b)=>a.folderNo!==b.folderNo?a.folderNo-b.folderNo:a.name.localeCompare(b.name,'ja'));coSel.innerHTML='<option value="">── すべて ──</option>';unique.forEach(c=>{const el=document.createElement('option');el.value=c.name;el.textContent=(c.folderNo<99999?c.folderNo+'. ':'')+c.name;coSel.appendChild(el);});if(unique.some(c=>c.name===prevCo))coSel.value=prevCo;}
function filterCases(){const orgV=(document.getElementById('filterOrg')||{}).value||'';const coV=(document.getElementById('filterCompany')||{}).value||'';const txtV=((document.getElementById('filterText')||{}).value||'').trim().toLowerCase();rebuildCompanyList(orgV);const words=txtV?txtV.split(/\s+/).filter(Boolean):[];let filtered=_allCases.filter(r=>{if(orgV&&(r.org||'')!==orgV)return false;if(coV&&(r.company||'')!==coV)return false;if(words.length){const hay=((r.name||'')+' '+(r.applicant||'')+' '+(r.company||'')+' '+(r.org||'')).toLowerCase();if(!words.every(w=>hay.includes(w)))return false;}return true;});const sel=document.getElementById('caseSelect');const cnt=document.getElementById('caseCount');const MAX=200;if(filtered.length>MAX&&!coV&&!words.length){sel.innerHTML='<option value="">← 登録支援機関・所属機関で絞り込むか、名前を入力してください</option>';sel.disabled=true;if(cnt)cnt.textContent='('+filtered.length+'件・絞り込んでください)';return;}sel.disabled=false;const prev=sel.value;sel.innerHTML='<option value="">── 選択 ──</option>';const frag=document.createDocumentFragment();filtered.forEach(r=>{const o=document.createElement('option');o.value=JSON.stringify({caseId:r.id,companyId:r.company_id,companyName:r.company||'',orgName:r.org||'',empSetIdx:r.emp_set_idx,applicantField:r.applicant_field||'',applicantFieldEn:r.applicant_field_en||''});o.textContent=(r.applicant||r.name||'(名前なし)')+'　('+(r.company||'')+')';frag.appendChild(o);});sel.appendChild(frag);if(cnt)cnt.textContent='('+filtered.length+'件)';if(prev)sel.value=prev;}

// ===== 編集内容の保存・呼び出し =====
function saveEditedHTML(){
  const area = document.getElementById('pageArea');
  if(!area){ showToast('⚠️ プレビューがありません'); return; }
  const html = area.innerHTML;
  // 入力フォームの値を収集
  const formData = {};
  document.querySelectorAll('.fp-inner input, .fp-inner textarea, .fp-inner select').forEach(el=>{
    if(el.id) formData[el.id] = el.value;
  });
  // HTMLと入力値をまとめて保存
  const saveData = JSON.stringify({html, formData});
  const blob = new Blob([saveData], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const now = new Date();
  const ts = now.getFullYear()+('0'+(now.getMonth()+1)).slice(-2)+('0'+now.getDate()).slice(-2)+'_'+('0'+now.getHours()).slice(-2)+('0'+now.getMinutes()).slice(-2);
  const title = document.getElementById('docTitle')?.textContent||'doc';
  a.download = title.replace(/[📄📋\s]/g,'').replace(/[^\w　-鿿]/g,'_').slice(0,20)+'_'+ts+'.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('💾 保存しました（入力値込み）');
}

function loadEditedHTML(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.html,.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const area = document.getElementById('pageArea');
      if(!area) return;
      const text = ev.target.result;
      // JSONファイル（新形式：html+formData）
      if(file.name.endsWith('.json')){
        try{
          const data = JSON.parse(text);
          if(data.html) area.innerHTML = data.html;
          // ① 読込直後にデータ入り変数スパンをプレースホルダーに戻す
          resetBindings();
          // ② 入力フォームの値を復元（給与・手当等の設定値を保持）
          if(data.formData){
            Object.entries(data.formData).forEach(([id,val])=>{
              const el = document.getElementById(id);
              if(el) el.value = val;
            });
          }
        }catch(err){
          area.innerHTML = text;
          resetBindings();
        }
      } else {
        // 旧形式（.html）
        area.innerHTML = text;
        resetBindings();
      }
      // 編集モードをONに
      _editMode = true;
      const btn = document.getElementById('editModeBtn');
      if(btn){ btn.textContent='✏️ 編集中（クリックで終了）'; btn.classList.add('edit-mode-on'); }
      enableDocEditing(true);
      // フリーズ＋現在フォーム値でスパンを更新（案件選択済みならデータが入る）
      freezeLoadedHtml();
      applyBindings();
      showToast('📂 読み込みました（案件を選ぶと変数欄が自動更新されます）');
    };
    reader.readAsText(file);
  };
  input.click();
}


/* ==========================================================
   汎用: 親index.htmlからのSELECT_CASE受信＆案件データ展開
   各書類の入力欄プレフィックスに幅広く対応
   (es_*, f_*, 接頭辞なし) すべて試して存在するものだけセット
   ========================================================== */
async function loadCaseToForm(info, docKey){
  if(!info||!info.caseId) return;
  // ver.20260717: 直接編集が未保存のまま別の案件に切り替えると編集内容が失われる。
  // 画面は編集後の見た目のままなので気づけないため、切り替える前に確認する。
  // 同じ案件の再読込（言語切替など）では聞かない。
  try{
    const _prev = window._lastCaseInfo && window._lastCaseInfo.caseId;
    if(window._editedDirty && _prev && _prev !== info.caseId){
      if(!confirm('直接編集した内容がまだ保存されていません。\n案件を切り替えると編集内容は失われます。\n\n切り替えますか？\n（保存する場合は「キャンセル」を押して「💾 DB保存」）')){
        return;
      }
    }
    if(_prev !== info.caseId) clearEditedDirty();
  }catch(e){}
  // ver.20260611: 親から渡されたログイントークンを保持（RLS用）
  try{ if(info.token) window.__OFUSA_SB_TOKEN = info.token; }catch(e){}
  // グローバルに最新の案件情報を保存（DB保存・他機能で使う）
  window._lastCaseInfo = info;
  window._fieldData = {}; // ver.20260612: 案件読込ごとにDBフォールバック値をリセット
  console.log('[doc] loadCaseToForm:', info);
  const {caseId, companyId, companyName, empSetIdx} = info;
  try {
    const [cases, persons] = await Promise.all([
      sb('cases?select=*&id=eq.'+caseId),
      sb('persons?select=*&case_id=eq.'+caseId)
    ]);
    const cas = cases && cases[0];
    const _pdRaw = persons && persons[0];
    const pd = (_pdRaw && _pdRaw.data) || _pdRaw || {};

    // 会社取得（companyId → companyName → cas.company → cas.org の順）
    let co = null;
    if(companyId){
      const r = await sb('companies?select=*&id=eq.'+companyId);
      if(r && r[0]) co = r[0];
    }
    if(!co && companyName){
      const r = await sb('companies?select=*&name=eq.'+encodeURIComponent(companyName));
      if(r && r[0]) co = r[0];
    }
    if(!co && cas && cas.company){
      const r = await sb('companies?select=*&name=eq.'+encodeURIComponent(cas.company));
      if(r && r[0]) co = r[0];
    }
    if(!co && cas && cas.org){
      const r = await sb('companies?select=*&name=eq.'+encodeURIComponent(cas.org));
      if(r && r[0]) co = r[0];
    }
    co = co || {};
    console.log('[doc] company loaded:', co.name || '(none)');

    // emp_sets 取得
    const idx = parseInt(empSetIdx||0)||0;
    const es = (co.emp_sets||[])[idx] || {};
    // ①: 雇用条件セットセレクタを描画（#empSetSelectorSlot がある書類のみ）
    window._empDocKey = docKey;
    window._empLoadedIdx = idx;
    try{ window._empLoadedSet = JSON.parse(JSON.stringify(es)); }catch(_e){ window._empLoadedSet = {}; }
    try{ if(typeof renderEmpSetSelector==='function') renderEmpSetSelector(co, idx, info); }catch(_e){}

    // 入力欄にセット：複数のID候補を試して存在するものにセット
    const setValMulti = (ids, val) => {
      if(val===undefined || val===null || String(val)==='') return;
      const list = Array.isArray(ids) ? ids : [ids];
      let elSet = false;
      for(const id of list){
        // ver.20260612: 入力欄の有無に関わらず全候補idをフォールバックへ。要素があれば先頭の1つに値もセット
        window._fieldData[id] = val;
        if(!elSet){ const el = document.getElementById(id); if(el){ el.value = val; elSet = true; } }
      }
    };

    // 現在値チェック（空なら新値をセット用）
    const getEl = (id) => document.getElementById(id);
    const isEmpty = (ids) => {
      const list = Array.isArray(ids) ? ids : [ids];
      for(const id of list){
        const el = getEl(id);
        if(el && el.value) return false;
      }
      return true;
    };

    // === 所属機関情報 ===
    const companyAddress = (co.pref||'')+(co.city||'')+(co.address||'');
    setValMulti(['es_orgName','f_company','f_orgName'], es.orgName || co.name);
    setValMulti(['es_orgNameEn','f_companyEn','f_orgNameEn'], es.orgNameEn || co.name_en);
    setValMulti(['es_orgAddress','f_address','f_orgAddress'], es.orgAddress || companyAddress);
    setValMulti(['es_orgAddressEn','f_addressEn','f_orgAddressEn'], es.orgAddressEn || co.address_en);
    setValMulti(['es_orgTel','f_tel','f_orgTel'], es.orgTel || co.tel);
    setValMulti(['es_repName','f_repName'], es.repName || co.rep_name);
    setValMulti(['es_repTitle','f_repTitle'], es.repTitle || co.rep_title);
    setValMulti(['es_repNameEn','f_repNameEn'], es.repNameEn || co.rep_name_en);
    setValMulti(['es_repTitleEn','f_repTitleEn'], es.repTitleEn || co.rep_title_en);

    // 作成責任者
    setValMulti(['f_author'], [co.author_title, co.author_name].filter(Boolean).join('　'));
    setValMulti(['es_authorName','f_authorName'], co.author_name);
    setValMulti(['es_authorTitle','f_authorTitle'], co.author_title);

    // === 申請人 ===
    const applicantNameJp = pd.name_jp || pd.applicant_name || (cas && cas.applicant) || '';
    const applicantNameEn = pd.name_en || pd.applicant_name_en || '';
    setValMulti(['es_applicantName','applicantName','f_applicant','f_applicantName'], applicantNameJp);
    setValMulti(['es_applicantNameEn','f_applicantEn','f_applicantNameEn'], applicantNameEn);
    // ver.20260612: 職種(分野)の和文・翻訳。emp_sets優先、無ければ案件情報(info)から補完
    const _stripP=s=>s?String(s).replace(/[（(][^）)]*[）)]/g,'').trim():'';
    setValMulti(['es_applicantField','f_applicantField'], _stripP(es.applicantField || info.applicantField));
    setValMulti(['es_applicantFieldEn','f_applicantFieldEn'], _stripP(es.applicantFieldEn || info.applicantFieldEn));

    // 性別・年齢・経験（persons由来）
    setValMulti(['f_age','es_age'], pd.age);
    setValMulti(['f_gender','es_gender'], pd.gender);
    setValMulti(['f_exp','es_experience','es_exp'], pd.experience);

    // === emp_sets 全フィールドを自動で es_xxx / f_xxx にセット ===
    // ver.20260717: emp_sets は「会社の雇用条件のひな形」で案件IDを持たず、複数案件で使い回される。
    // そこに氏名が焼き付いていると、このループが上の「案件から入れた氏名」を後から上書きし、
    // 別人の氏名が法定書類に載る事故が起きた（1-5号 case_1783414630377 で発覚）。
    // 氏名は案件(cases.applicant / persons)からのみ引くべきなので、ここでは流し込まない。
    // ※ nationality / birthdate / passport 等は persons 由来の経路が無く、
    //   ここで流し込まないと31書類が空欄になるため、除外対象に含めない。
    const _ES_SKIP = ['applicantName','applicantNameEn'];
    Object.keys(es).forEach(k => {
      if(_ES_SKIP.includes(k)) return;   // 氏名はひな形から流さない
      setValMulti(['es_'+k, 'f_'+k], es[k]);
    });

    // 業務区分・分野: Object.keys(es)ループ後にまとめて括弧除去
    // applicantField / applicantFieldEn は単純除去
    ['applicantField','applicantFieldEn'].forEach(k=>{
      const raw=(window._fieldData&&window._fieldData['es_'+k])||'';
      if(raw) setValMulti(['es_'+k,'f_'+k], _stripP(raw));
    });
    // category / categoryEn は括弧除去＋カンマ区切りで category2 に分割
    ['category','categoryEn'].forEach(k=>{
      const raw=(window._fieldData&&window._fieldData['es_'+k])||'';
      if(!raw) return;
      const parts=raw.split(/[,、]\s*/).map(s=>_stripP(s)).filter(Boolean);
      setValMulti(['es_'+k,'f_'+k], parts[0]||'');
      if(parts[1]) setValMulti(['es_'+k+'2','f_'+k+'2'], parts[1]);
    });

    // === 作成日 ===
    // ver.20260710: 全書類の作成日を案件の書類作成日(cases.doc_create_date)に統一する。
    // 1-17と同じ単一ソース。優先順: cases.doc_create_date → emp_sets(es_createY/M/D) → 今日。
    // doc_create_dateがある場合は、既にセットされた今日/emp_sets値も上書きして必ず揃える。
    const n = new Date();
    let _y, _m, _d, _hasDcd = false;
    const _dcd = (cas && cas.doc_create_date) ? String(cas.doc_create_date) : '';
    const _dcdP = _dcd ? _dcd.split(/[-\/]/) : [];
    if(_dcdP.length >= 3 && _dcdP[0] && _dcdP[1] && _dcdP[2]){
      _y = parseInt(_dcdP[0],10); _m = parseInt(_dcdP[1],10); _d = parseInt(_dcdP[2],10);
      _hasDcd = true;
    } else {
      // doc_create_dateが無ければ emp_sets(展開済みes_createY/M/D)→今日
      const _cy = v('es_createY') || v('f_createY') || v('f_docYear');
      const _cm = v('es_createM') || v('f_createM') || v('f_docMonth');
      const _cd = v('es_createD') || v('f_createD') || v('f_docDay');
      const _hasSaved = _cy && _cm && _cd;
      _y = _hasSaved ? parseInt(_cy,10) : n.getFullYear();
      _m = _hasSaved ? parseInt(_cm,10) : (n.getMonth()+1);
      _d = _hasSaved ? parseInt(_cd,10) : n.getDate();
    }
    if(_hasDcd || isEmpty(['es_createY','f_createY','f_docYear'])) setValMulti(['es_createY','f_createY','f_docYear'], String(_y));
    if(_hasDcd || isEmpty(['es_createM','f_createM','f_docMonth'])) setValMulti(['es_createM','f_createM','f_docMonth'], String(_m));
    if(_hasDcd || isEmpty(['es_createD','f_createD','f_docDay'])) setValMulti(['es_createD','f_createD','f_docDay'], String(_d));
    // f_docDate(令和形式) — 案件の書類作成日から生成（無ければemp_sets/今日）
    if(_hasDcd || isEmpty(['f_docDate'])){
      setValMulti(['f_docDate'], `令和${_y-2018}年${_m}月${_d}日`);
    }

    // プレビュー再描画（直接編集中・フリーズ中はapplyBindingsで変数スパンのみ更新）
    if((window._htmlFrozen||_editMode) && typeof applyBindings==='function'){
      const updated=applyBindings();
      // 旧形式（data-bind なし）なら _editMode を一時解除して p() を実行
      if(updated===0 && typeof p==='function'){
        const prev=_editMode; _editMode=false; p(); _editMode=prev;
      }
    }else if(typeof p==='function') p();
    // 金額系フィールドにカンマ整形を適用
    applyMoneyFormatting();
    // 書類固有DB保存データがあれば上書き読込
    if(docKey && typeof loadFormGenericFromDB === 'function'){
      await loadFormGenericFromDB(docKey, info);
    }
    if(typeof showToast==='function') showToast('✅ 案件データを読み込みました');
  } catch(e) {
    console.error('[doc] loadCaseToForm error:', e);
    if(typeof showToast==='function') showToast('⚠️ 読込エラー: ' + e.message);
  }
}

/* ==========================================================
   金額系フィールドに3桁カンマ整形を適用
   - 既存の値にカンマを付与
   - oninput で手入力時もリアルタイム整形
   - text型inputのみ対象（number型は対象外：カンマが入らない）
   ========================================================== */
const MONEY_FIELD_PATTERNS = [
  // 賃金
  /salary(Monthly|Daily|Hourly|Total)?(En)?$/i,
  /totalMonthly(En)?$/i,
  /netPay(En)?$/i,
  /calc(Hourly|Monthly)(En)?$/i,
  // 控除
  /^(es_|f_)?deduct/i,
  // 手当
  /allowance\d*Amount(En)?$/i,
  /fixedOT?Amount(En)?$/i,
  // 日本人比較報酬
  /jpCompSalary(En)?$/i,
  /jpCompAllow\d+Amt(En)?$/i,
  /jpSalary$/i,
  // 1_4系
  /^f_salaryM$/,
  /^f_salaryH$/,
  /^f_jpSalary$/,
];

function isMoneyField(id){
  if(!id) return false;
  // es_xxx / f_xxx プレフィックスと中身の部分でマッチ
  const stripped = id.replace(/^(es_|f_)/,'');
  return MONEY_FIELD_PATTERNS.some(p => p.test(id) || p.test(stripped));
}

// カンマ付き文字列にする（数値以外はそのまま）
function formatMoney(val){
  if(val===null || val===undefined || val==='') return '';
  const raw = String(val).replace(/,/g,'');
  const num = Number(raw);
  if(isNaN(num)) return String(val);
  return num.toLocaleString('ja-JP');
}

// 単一input要素に整形を適用
function formatMoneyInput(el){
  if(!el) return;
  if(el.type === 'number') return; // number型は不可
  const cur = el.value;
  if(!cur) return;
  const formatted = formatMoney(cur);
  if(formatted !== cur){
    el.value = formatted;
  }
}

// 画面上の全金額フィールドに整形＋oninputハンドラ装着
function applyMoneyFormatting(){
  const inputs = document.querySelectorAll('input');
  inputs.forEach(el => {
    if(!isMoneyField(el.id)) return;
    // 既存値を整形
    formatMoneyInput(el);
    // 装着済みならスキップ
    if(el.dataset.moneyFmtAttached === '1') return;
    el.dataset.moneyFmtAttached = '1';
    // 入力時にも整形（カーソル位置は近似維持）
    el.addEventListener('input', function(){
      const before = el.value;
      const selStart = el.selectionStart;
      const digitsBefore = (before.slice(0, selStart).match(/\d/g)||[]).length;
      const formatted = formatMoney(before);
      if(formatted !== before){
        el.value = formatted;
        // カーソル位置調整：整形後の同じ桁数に対応する位置へ
        let count = 0, pos = 0;
        for(; pos < formatted.length && count < digitsBefore; pos++){
          if(/\d/.test(formatted[pos])) count++;
        }
        el.setSelectionRange(pos, pos);
      }
      // プレビュー再描画（pが定義されていれば）
      if(typeof p === 'function') p();
    });
    // blurでも整形
    el.addEventListener('blur', function(){ formatMoneyInput(el); });
  });
}

// ページ読み込み時にも適用（既存の手入力欄対応）
if(typeof window !== 'undefined'){
  window.addEventListener('load', function(){
    setTimeout(applyMoneyFormatting, 300);
  });
}



/* ==========================================================
   iframe側: 親へ「準備完了」を通知し、案件情報の再送を要求
   - 各書類のリスナー登録より後で読み込まれるよう配置
   - 親が SELECT_CASE を送り損ねていても、こちらから要求して再送させる
   ========================================================== */
if(typeof window !== 'undefined' && window.parent && window.parent !== window){
  // 親に DOC_READY 通知（複数回送信 = 読み込みタイミングのバラツキ吸収）
  function _notifyDocReady(){
    try {
      window.parent.postMessage({type:'DOC_READY'}, '*');
    } catch(e){}
  }
  // DOMContentLoaded 直後 + 少し遅延 + load 後 にも送信
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
      _notifyDocReady();
      setTimeout(_notifyDocReady, 300);
      setTimeout(_notifyDocReady, 1000);
    });
  } else {
    _notifyDocReady();
    setTimeout(_notifyDocReady, 300);
    setTimeout(_notifyDocReady, 1000);
  }
  window.addEventListener('load', () => {
    _notifyDocReady();
    setTimeout(_notifyDocReady, 200);
  });
}

/* ==========================================================
   汎用DB保存: companies.extra に書類ごとのフォーム値を保存
   - 書類ID は引数で渡す（'1_4', '1_23', '2_1' 等）
   - 各書類HTMLから saveFormGeneric('1_4') のように呼び出す
   ========================================================== */
async function saveFormGeneric(docKey, opts){
  opts = opts || {};
  // 案件情報を取得：caseSelect → window._lastCaseInfo → 親から問い合わせ
  let info = null;
  const sel = document.getElementById('caseSelect');
  if(sel && sel.value){
    try{ info = JSON.parse(sel.value); }catch(e){}
  }
  // SELECT_CASE 受信時に保存された最新infoを使う
  if((!info || !info.caseId) && window._lastCaseInfo && window._lastCaseInfo.caseId){
    info = window._lastCaseInfo;
  }
  if(!info || !info.caseId){
    info = await new Promise((resolve) => {
      const handler = (e) => {
        if(e.data && e.data.type === 'CASE_INFO_RESPONSE'){
          window.removeEventListener('message', handler);
          resolve(e.data.info || null);
        }
      };
      window.addEventListener('message', handler);
      try{ window.parent.postMessage({type:'GET_CASE_INFO'}, '*'); }catch(e){}
      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, 1000);
    });
  }
  if(!info || !info.caseId){
    if(typeof showToast==='function') showToast('⚠️ 案件が選択されていません');
    else alert('案件が選択されていません');
    return;
  }
  let {companyId, companyName, empSetIdx} = info;

  // companyId が無ければ、name で探す（cas.companyにフォールバック）
  if(!companyId){
    try {
      const cases = await sb('cases?select=company,company_id&id=eq.'+info.caseId);
      const cas = cases && cases[0];
      if(cas){
        if(cas.company_id) companyId = cas.company_id;
        else if(cas.company){
          const cos = await sb('companies?select=id&name=eq.'+encodeURIComponent(cas.company));
          if(cos && cos[0]) companyId = cos[0].id;
        }
      }
    } catch(e){}
  }
  if(!companyId){
    if(typeof showToast==='function') showToast('⚠️ 会社情報が取得できません');
    else alert('会社情報が取得できません');
    return;
  }

  try{
    // 全 input/select/textarea の値を収集（id が es_xxx, f_xxx, applicantName 等）
    const values = collectAllFormValues();
    const idx = parseInt(empSetIdx||0)||0;

    // 既存の extra を取得
    let cos = await sb('companies?select=id,extra&id=eq.'+companyId);
    let co = cos && cos[0];
    // ver.20260717: cases.company_id が実在しない会社を指している案件が19件あり（会社の作り直し等が原因）、
    // その場合ここで0件になり「会社レコードが見つかりません」で保存が丸ごと失敗していた。
    // うち10件は会社名なら引けるので、id で駄目なら会社名にフォールバックする。
    if(!co){
      let _nm = (typeof companyName!=='undefined' && companyName) || '';
      if(!_nm && info && info.caseId){
        try{
          const _cs = await sb('cases?select=company&id=eq.'+info.caseId);
          if(_cs && _cs[0]) _nm = _cs[0].company || '';
        }catch(e){}
      }
      if(_nm){
        const _r = await sb('companies?select=id,extra&name=eq.'+encodeURIComponent(_nm));
        if(_r && _r[0]){
          co = _r[0];
          companyId = co.id;   // 以降の更新も正しい会社に向ける
          console.warn('[save] company_id が実在しないため会社名で解決:', _nm, '→', companyId);
        }
      }
    }
    if(!co){
      // ver.20260717: ここに来る原因は2通りある。文言が「会社レコードが見つかりません」だけだと
      // 認証切れなのかデータ不備なのか判別できず、原因究明に時間がかかったため切り分けて出す。
      //  ① 認証トークンの失効 → RLSで0件が返る（画面を長時間開いたまま保存すると起きる）
      //  ② cases.company_id が実在しない会社を指している（会社の作り直し等）
      let _alive = null;
      try{
        const _probe = await sb('companies?select=id&limit=1');
        _alive = !!(_probe && _probe.length);
      }catch(e){ _alive = false; }
      if(_alive === false){
        throw new Error('ログインの有効期限が切れています。画面を再読み込み（Ctrl+Shift+R）してから、もう一度保存してください');
      }
      throw new Error('この案件の所属機関が見つかりません（会社ID: '+companyId+' / 会社名: '+(companyName||'不明')+'）。アンシスで所属機関を選び直してください');
    }

    const extra = co.extra && typeof co.extra === 'object' ? JSON.parse(JSON.stringify(co.extra)) : {};
    if(!extra[docKey]) extra[docKey] = {};
    extra[docKey][String(idx)] = {
      ...values,
      _savedAt: new Date().toISOString(),
    };

    // 直接編集版HTMLも保存（編集中/フリーズ時のみ・ファイル名単位のキーで言語別に分離）
    // ※ toggleEditMode() は編集終了時に _htmlFrozen=true を立てるため、
    //   「✏️直接編集をON→編集→OFF→DB保存」でも保存対象になる（検証済み）。
    try{
      if(window._htmlFrozen || (typeof _editMode !== 'undefined' && _editMode)){
        const _area = document.getElementById('pageArea');
        if(_area && info.caseId){
          const _edKey = ((location.pathname.split('/').pop()||docKey).replace(/\.html.*$/,'')) || docKey;
          if(!extra['_edited']) extra['_edited'] = {};
          if(!extra['_edited'][_edKey]) extra['_edited'][_edKey] = {};
          extra['_edited'][_edKey][info.caseId] = { html: _area.innerHTML, _savedAt: new Date().toISOString() };
          window._editedJustSaved = true;
        }
      }
    }catch(_e){ console.warn('[edited save]', _e); }

    // PATCH で保存
    await sb('companies?id=eq.'+companyId, {
      method: 'PATCH',
      headers: {'Prefer':'return=minimal'},
      body: JSON.stringify({ extra })
    });

    // opts.revMap があれば、確認済みマップの欄だけ emp_sets（案件マスタ）にも反映
    // ルール: ホワイトリストのみ / 空欄はスキップ / 差分のみ書込（破損防止）
    let nShared = 0;
    if(opts.revMap){
      try{
        const cos2 = await sb('companies?select=id,emp_sets&id=eq.'+companyId);
        const co2 = cos2 && cos2[0];
        if(co2){
          const empSets = co2.emp_sets ? JSON.parse(JSON.stringify(co2.emp_sets)) : [];
          while(empSets.length <= idx) empSets.push({setName:'条件'+(empSets.length+1)});
          const es = empSets[idx];
          Object.keys(opts.revMap).forEach(fid => {
            const key = opts.revMap[fid];
            [[fid, key], [fid+'En', key+'En']].forEach(([f,k]) => {
              const el = document.getElementById(f);
              if(!el) return;
              // ver.20260715: 書類側で自動補完した既定値は emp_sets に書き戻さない（実データ保護）
              if(el.dataset && el.dataset.autofill === '1') return;
              const val = (el.type === 'checkbox') ? el.checked : el.value;
              if(val === '' || val == null) return;
              if(es[k] !== val){ es[k] = val; nShared++; }
            });
          });
          if(nShared > 0){
            await sb('companies?id=eq.'+companyId, { method:'PATCH', headers:{'Prefer':'return=minimal'}, body: JSON.stringify({ emp_sets: empSets }) });
          }
        }
      }catch(e){ console.warn('[saveFormGeneric empSets]', e); }
    }
    let msg = nShared > 0 ? ('✅ DBに保存しました（アンシスにも'+nShared+'項目反映）') : '✅ DBに保存しました';
    if(window._editedJustSaved){ msg += '＋直接編集版も保存'; window._editedJustSaved = false; }
    if(typeof showToast==='function') showToast(msg);
    else alert(msg);
    clearEditedDirty();   // 保存できたので離脱警告を解除
  } catch(err){
    console.error('[saveFormGeneric]', err);
    if(typeof showToast==='function') showToast('⚠️ 保存エラー: ' + err.message);
    else alert('保存エラー: ' + err.message);
  }
}

// 画面上の全入力欄を { id: value } で収集
function collectAllFormValues(){
  const result = {};
  const els = document.querySelectorAll('input, select, textarea');
  els.forEach(el => {
    if(!el.id) return;
    // フィルタ系の id は除外
    if(/^(filterOrg|filterCompany|filterText|caseSelect|caseCount|fontSizeLabel)$/.test(el.id)) return;
    if(el.type === 'checkbox' || el.type === 'radio'){
      result[el.id] = el.checked;
    } else {
      result[el.id] = el.value;
    }
  });
  return result;
}

// DBから書類別データを取得して入力欄に反映
async function loadFormGenericFromDB(docKey, info){
  if(!info || !info.caseId) return;
  let {companyId, empSetIdx} = info;
  if(!companyId){
    try {
      const cases = await sb('cases?select=company,company_id&id=eq.'+info.caseId);
      const cas = cases && cases[0];
      if(cas){
        if(cas.company_id) companyId = cas.company_id;
        else if(cas.company){
          const cos = await sb('companies?select=id&name=eq.'+encodeURIComponent(cas.company));
          if(cos && cos[0]) companyId = cos[0].id;
        }
      }
    } catch(e){}
  }
  if(!companyId) return;
  try {
    const cos = await sb('companies?select=extra&id=eq.'+companyId);
    const co = cos && cos[0];
    if(!co || !co.extra) return;
    const idx = parseInt(empSetIdx||0)||0;
    const data = co.extra && co.extra[docKey] && co.extra[docKey][String(idx)];
    // ver.20260717: ここで `if(!data) return;` していたため、通常のフォーム値(extra[docKey])が
    // 未保存の案件では、直接編集版(extra['_edited'])の復元処理まで到達せず、
    // 「保存しました」と出るのにリロードすると元に戻る、という状態になっていた。
    // フォーム値が無くても直接編集版の復元は行う。
    if(data){
      // 既存の値を上書きしない（loadCaseToFormで既にセットされている可能性）
      Object.keys(data).forEach(id => {
        if(id.startsWith('_')) return; // _savedAt等
        const el = document.getElementById(id);
        if(!el) return;
        if(el.type === 'checkbox' || el.type === 'radio'){
          el.checked = !!data[id];
        } else {
          // 既に値があってもDBの値で上書き(DBが正)
          el.value = data[id] || '';
        }
      });
      if(typeof p === 'function') p();
      if(typeof applyMoneyFormatting === 'function') applyMoneyFormatting();
    }
    // 直接編集版があれば復元（案件ID・ファイル名単位）
    try{
      const _edKey = ((location.pathname.split('/').pop()||docKey).replace(/\.html.*$/,'')) || docKey;
      const _ed = co.extra && co.extra['_edited'] && co.extra['_edited'][_edKey] && info && info.caseId && co.extra['_edited'][_edKey][info.caseId];
      const _area = document.getElementById('pageArea');
      if(_ed && _ed.html && _area){
        _area.innerHTML = _ed.html;
        window._htmlFrozen = true; window._editedRestored = true;
        if(typeof showToast === 'function') showToast('📝 直接編集版を復元しました');
      } else if(window._editedRestored && _area){
        window._htmlFrozen = false; window._editedRestored = false;
        if(typeof p === 'function') p();
      }
    }catch(_e){ console.warn('[edited restore]', _e); }
  } catch(e){
    console.warn('[loadFormGenericFromDB]', e);
  }
}

// ===== 直接編集版の破棄（saveFormGeneric系の全書類共通） =====
async function discardEditedGeneric(){
  let info = null;
  const sel = document.getElementById('caseSelect');
  if(sel && sel.value){ try{ info = JSON.parse(sel.value); }catch(e){} }
  if((!info || !info.caseId) && window._lastCaseInfo && window._lastCaseInfo.caseId) info = window._lastCaseInfo;
  if(!info || !info.caseId){ if(typeof showToast==='function') showToast('⚠️ 案件が選択されていません'); return; }
  if(!confirm('保存済みの直接編集版を破棄して、初期表示に戻します。よろしいですか？')) return;
  let cid = info.companyId;
  try{
    if(!cid){ const q = await sb('cases?select=company_id&id=eq.'+info.caseId); if(q && q[0]) cid = q[0].company_id; }
    if(!cid){ if(typeof showToast==='function') showToast('⚠️ 会社情報が取得できません'); return; }
    const _edKey = (location.pathname.split('/').pop()||'').replace(/\.html.*$/,'');
    const r = await sb('companies?select=id,extra&id=eq.'+cid);
    const c = r && r[0];
    const ex = c && c.extra && typeof c.extra === 'object' ? JSON.parse(JSON.stringify(c.extra)) : {};
    if(ex['_edited'] && ex['_edited'][_edKey] && ex['_edited'][_edKey][info.caseId]){
      delete ex['_edited'][_edKey][info.caseId];
      await sb('companies?id=eq.'+cid, { method:'PATCH', headers:{'Prefer':'return=minimal'}, body: JSON.stringify({ extra: ex }) });
    }
    window._htmlFrozen = false; window._editedRestored = false;
    // ver.20260716: 破棄後に_editModeを解除しないとp()が早期returnしてプレビューが空になるバグを修正
    if(typeof _editMode !== 'undefined') _editMode = false;
    try{ if(typeof enableDocEditing === 'function') enableDocEditing(false); }catch(e){}
    const _eb = document.getElementById('editModeBtn');
    if(_eb){ _eb.textContent = '✏️ 直接編集'; _eb.classList.remove('edit-mode-on'); }
    if(typeof p === 'function') p();
    if(typeof showToast==='function') showToast('♻️ 編集版を破棄しました');
  }catch(e){ console.error('[discardEditedGeneric]', e); if(typeof showToast==='function') showToast('⚠️ エラー: '+e.message); }
}
// 破棄ボタンの自動追加（DB保存(saveFormGeneric)ボタンの隣・対象書類のみ）
document.addEventListener('DOMContentLoaded', function(){
  try{
    if(document.getElementById('discardEditedBtn')) return;
    const btn = document.querySelector('button[onclick*="saveFormGeneric"]');
    const area = document.getElementById('pageArea');
    if(btn && area){
      const b = document.createElement('button');
      b.id = 'discardEditedBtn';
      b.className = btn.className || 'btn';
      b.textContent = '♻️ 編集版破棄';
      b.title = '保存済みの直接編集版を破棄して初期表示に戻す';
      b.onclick = discardEditedGeneric;
      btn.parentNode.insertBefore(b, btn.nextSibling);
    }
  }catch(e){}
});

// ===== 入力欄⇔書類の連動ジャンプ =====
function _flashEl(el){
  const o1=el.style.outline, o2=el.style.backgroundColor;
  el.style.outline='2px solid #f59e0b'; el.style.backgroundColor='#fef3c7';
  setTimeout(()=>{ el.style.outline=o1; el.style.backgroundColor=o2; }, 1200);
}
// 入力欄フォーカス → 書類の該当箇所へスクロール
document.addEventListener('focusin', function(e){
  try{
    if(window._noJump) return;
    const el=e.target;
    if(!el || !el.id || !(el.matches && el.matches('input,select,textarea'))) return;
    const area=document.getElementById('pageArea');
    if(!area) return;
    const span=area.querySelector('[data-bind="'+el.id+'"]');
    if(span){ span.scrollIntoView({behavior:'smooth',block:'center'}); _flashEl(span); }
  }catch(_e){}
});
// 書類の項目クリック → 入力欄へスクロール＆フォーカス（直接編集中は無効）
document.addEventListener('click', function(e){
  try{
    if(typeof _editMode!=='undefined' && _editMode) return;
    const area=document.getElementById('pageArea');
    if(!area || !area.contains(e.target)) return;
    const span=e.target.closest && e.target.closest('[data-bind]');
    if(!span) return;
    const id=span.getAttribute('data-bind');
    const input=document.getElementById(id);
    if(input){
      window._noJump=true;
      input.scrollIntoView({behavior:'smooth',block:'center'});
      _flashEl(input);
      try{ input.focus({preventScroll:true}); }catch(_e2){}
      setTimeout(()=>{ window._noJump=false; }, 600);
    }
  }catch(_e){}
});

/* =========================================================================
   雇用条件セット セレクタ＆保存モード（①②: ver.20260720 追加）
   - ①: 書類上部でどの emp_sets を使うか選び、選択時に cases.emp_set_idx を保存
   - ②: 保存時に編集の有無を見て「新セット作成＋紐付け(B)／元セット上書き(C)」を選ばせる
   すべて追記のみ・#empSetSelectorSlot が無い書類では何もしない（既存挙動を変えない）
   ========================================================================= */
(function(){
  function _empSetLabel(set,i){
    var nm=(set&&set.setName)?String(set.setName):('条件セット'+(i+1));
    return '['+i+'] '+nm;
  }
  // ① セレクタ描画（#empSetSelectorSlot がある書類でのみ）
  window.renderEmpSetSelector=function(co,idx,info){
    try{
      var slot=document.getElementById('empSetSelectorSlot');
      if(!slot) return;
      var sets=(co&&co.emp_sets)||[];
      window._empCtx={companyId:(co&&co.id)||info.companyId||'',empSets:sets,caseId:info.caseId};
      window._empDocKey=window._empDocKey||'';
      if(!co||!co.id||sets.length===0){
        slot.innerHTML='<div style="font-size:10px;color:#b45309;margin-top:6px;">📑 雇用条件セット: 会社未解決またはセット未登録</div>';
        return;
      }
      var empty=(info.empSetIdx===undefined||info.empSetIdx===null||String(info.empSetIdx)==='');
      var opts=sets.map(function(s,i){
        return '<option value="'+i+'"'+(i===idx?' selected':'')+'>'+_empSetLabel(s,i).replace(/</g,'&lt;')+'</option>';
      }).join('');
      var curName=_empSetLabel(sets[idx]||{},idx).replace(/</g,'&lt;');
      var html='';
      // 未紐付けのときは「先頭を仮表示中・こちらでよいですか？」の確認バナーを出す
      if(empty){
        html+='<div style="background:#fee2e2;border:1px solid #dc2626;border-radius:6px;padding:8px;margin-bottom:6px;">'+
          '<div style="font-size:12px;font-weight:bold;color:#b91c1c;">⚠️ 雇用条件が未紐付けです</div>'+
          '<div style="font-size:11px;color:#7f1d1d;line-height:1.5;margin:3px 0 6px;">先頭のセットを仮表示しています（全'+sets.length+'件）。<br>この内容でよろしいですか？ 違う場合は下のリストから選んでください。</div>'+
          '<div style="font-size:11px;color:#334155;margin-bottom:6px;">仮表示中：<b>'+curName+'</b></div>'+
          '<button onclick="confirmEmpSet()" style="width:100%;padding:7px;border:none;background:#16a34a;color:#fff;border-radius:6px;font-size:12px;font-weight:bold;cursor:pointer;">✅ これで確定（この案件に紐付け）</button>'+
          '</div>';
      }
      html+='<label style="font-size:11px;font-weight:bold;color:#334155;display:block;">📑 雇用条件セット'+
        (empty?' <span style="color:#b45309;">(未紐付け)</span>':'')+'</label>'+
        '<select id="empSetSelect" onchange="onEmpSetSelectChange()" style="width:100%;padding:4px;border:1px solid #bbb;border-radius:3px;font-size:11px;">'+opts+'</select>';
      slot.innerHTML=html;
    }catch(e){ console.warn('[empSel] render',e); }
  };
  // ① セレクタ変更 → その idx で再読込 ＋ cases.emp_set_idx を保存
  window.onEmpSetSelectChange=async function(){
    try{
      var sel=document.getElementById('empSetSelect'); if(!sel) return;
      var newIdx=parseInt(sel.value,10)||0;
      var info=window._lastCaseInfo; if(!info||!info.caseId) return;
      await sb('cases?id=eq.'+info.caseId,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({emp_set_idx:String(newIdx)})});
      info=Object.assign({},info,{empSetIdx:String(newIdx)});
      window._lastCaseInfo=info;
      if(typeof showToast==='function') showToast('雇用条件セットを['+newIdx+']に切替・保存しました');
      if(typeof loadCaseToForm==='function') await loadCaseToForm(info,window._empDocKey||'');
    }catch(e){ alert('雇用条件セットの切替に失敗: '+(e&&e.message||e)); }
  };
  // ①: 「これで確定」＝いま仮表示中のセットをこの案件に紐付け保存（フォームはそのまま）
  window.confirmEmpSet=async function(){
    try{
      var sel=document.getElementById('empSetSelect');
      var idx=sel?(parseInt(sel.value,10)||0):0;
      var info=window._lastCaseInfo; if(!info||!info.caseId) return;
      await sb('cases?id=eq.'+info.caseId,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({emp_set_idx:String(idx)})});
      info=Object.assign({},info,{empSetIdx:String(idx)});
      window._lastCaseInfo=info;
      if(typeof showToast==='function') showToast('雇用条件セット['+idx+']をこの案件に紐付けました');
      // 警告バナーを消すためセレクタだけ再描画（フォーム再読込は不要）
      if(window._empCtx) renderEmpSetSelector({id:window._empCtx.companyId, emp_sets:window._empCtx.empSets}, idx, info);
    }catch(e){ alert('紐付けの保存に失敗: '+(e&&e.message||e)); }
  };
  // ② 読込後のフォーム基準値スナップショット（es_* 欄）
  window.snapshotEmpBaseline=function(){
    var snap={};
    document.querySelectorAll('[id^="es_"]').forEach(function(el){ snap[el.id]=el.value; });
    window._empBaseline=snap;
  };
  // ② 基準値との差分（ユーザーが読込後に触ったか）
  window.isEmpDirtyByForm=function(){
    var snap=window._empBaseline; if(!snap) return false;
    var dirty=false;
    document.querySelectorAll('[id^="es_"]').forEach(function(el){
      if((snap[el.id]||'')!==(el.value||'')) dirty=true;
    });
    return dirty;
  };
  // ② 保存モード選択モーダル → Promise<'new'|'overwrite'|null>
  window.promptEmpSaveMode=function(companyId,idx){
    return new Promise(function(resolve){
      // フィル処理と同じ判定(parseInt(emp_set_idx||0)||0)で、この idx に化ける案件を数える
      // ＝空欄/未設定の案件も idx===0 のときに正しくカウントされる
      sb('cases?select=emp_set_idx&company_id=eq.'+encodeURIComponent(companyId))
        .then(function(rows){
          var cnt=(rows||[]).filter(function(r){ return (parseInt(r.emp_set_idx||0)||0)===idx; }).length;
          _showEmpModal(cnt,resolve);
        })
        .catch(function(){ _showEmpModal(null,resolve); });
    });
  };
  function _showEmpModal(cnt,resolve){
    var wrap=document.createElement('div');
    wrap.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:100000;display:flex;align-items:center;justify-content:center;';
    var cntTxt=(cnt==null)?'':('この条件セットを使う案件 '+cnt+'件に反映されます');
    wrap.innerHTML=
      '<div style="background:#fff;border-radius:12px;max-width:470px;width:92%;padding:20px 22px;box-shadow:0 8px 30px rgba(0,0,0,0.25);font-family:sans-serif;box-sizing:border-box;">'+
        '<div style="font-size:15px;font-weight:bold;margin-bottom:6px;color:#1e293b;">雇用条件を変更しました</div>'+
        '<div style="font-size:12px;color:#64748b;margin-bottom:16px;line-height:1.6;">保存方法を選んでください。</div>'+
        '<button id="_emNew" style="display:block;width:100%;text-align:left;margin-bottom:8px;padding:11px 12px;border:1px solid #2563eb;background:#eff6ff;color:#1e3a8a;border-radius:8px;cursor:pointer;font-size:13px;line-height:1.5;">🆕 新しい雇用条件セットとして作成し、この案件に紐付け<br><span style="font-size:11px;color:#475569;">他の案件には影響しません</span></button>'+
        '<button id="_emOver" style="display:block;width:100%;text-align:left;margin-bottom:14px;padding:11px 12px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;border-radius:8px;cursor:pointer;font-size:13px;line-height:1.5;">♻️ 元の雇用条件セットを上書き<br><span style="font-size:11px;color:#b45309;">'+cntTxt+'</span></button>'+
        '<div style="text-align:right;"><button id="_emCancel" style="padding:7px 16px;font-size:13px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;cursor:pointer;">キャンセル</button></div>'+
      '</div>';
    document.body.appendChild(wrap);
    function done(v){ try{document.body.removeChild(wrap);}catch(e){} resolve(v); }
    wrap.querySelector('#_emNew').onclick=function(){done('new');};
    wrap.querySelector('#_emOver').onclick=function(){done('overwrite');};
    wrap.querySelector('#_emCancel').onclick=function(){done(null);};
    wrap.onclick=function(e){ if(e.target===wrap) done(null); };
  }
  // ② 保存本体（mode: 'overwrite'|'new'）
  //   new: setNameを入力→emp_setsに追加→cases.emp_set_idxを新indexに更新
  //   overwrite: emp_sets[idx]を上書き（従来挙動）
  // 読み込み後にDB上のセットが変わっていないか比較するための安定文字列化
  function _empStableStr(o){
    if(o==null) return '';
    try{ return Object.keys(o).filter(function(k){return k!=='cbState';}).sort().map(function(k){return k+'='+(o[k]==null?'':String(o[k]));}).join('|'); }
    catch(e){ return String(o); }
  }
  // ①: 上書き競合ダイアログ → Promise<'overwrite'|'new'|null>
  window.promptEmpConflict=function(){
    return new Promise(function(resolve){
      var wrap=document.createElement('div');
      wrap.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100001;display:flex;align-items:center;justify-content:center;';
      wrap.innerHTML=
        '<div style="background:#fff;border-radius:12px;max-width:480px;width:92%;padding:20px 22px;box-shadow:0 8px 30px rgba(0,0,0,0.3);font-family:sans-serif;box-sizing:border-box;">'+
          '<div style="font-size:15px;font-weight:bold;color:#b91c1c;margin-bottom:6px;">⚠️ 他の場所で変更されています</div>'+
          '<div style="font-size:12px;color:#475569;line-height:1.6;margin-bottom:16px;">この会社の雇用条件は、あなたが開いたあとに別の画面/担当者によって変更されています。このまま上書きすると相手の変更が消えます。</div>'+
          '<button id="_ecNew" style="display:block;width:100%;text-align:left;margin-bottom:8px;padding:11px 12px;border:1px solid #2563eb;background:#eff6ff;color:#1e3a8a;border-radius:8px;cursor:pointer;font-size:13px;line-height:1.5;">🆕 新しいセットとして保存（相手の変更を残す・推奨）</button>'+
          '<button id="_ecOver" style="display:block;width:100%;text-align:left;margin-bottom:14px;padding:11px 12px;border:1px solid #dc2626;background:#fef2f2;color:#b91c1c;border-radius:8px;cursor:pointer;font-size:13px;line-height:1.5;">⚠️ あなたの変更で上書き（相手の変更は消えます）</button>'+
          '<div style="text-align:right;"><button id="_ecCancel" style="padding:7px 16px;font-size:13px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;cursor:pointer;">キャンセル</button></div>'+
        '</div>';
      document.body.appendChild(wrap);
      function done(v){ try{document.body.removeChild(wrap);}catch(e){} resolve(v); }
      wrap.querySelector('#_ecNew').onclick=function(){done('new');};
      wrap.querySelector('#_ecOver').onclick=function(){done('overwrite');};
      wrap.querySelector('#_ecCancel').onclick=function(){done(null);};
      wrap.onclick=function(e){ if(e.target===wrap) done(null); };
    });
  };
  window.saveEmpSetWithMode=async function(companyId,caseId,values,mode,curIdx,force){
    if(!companyId) throw new Error('会社IDが未解決です');
    var cos=await sb('companies?select=id,emp_sets&id=eq.'+companyId);
    var co=cos&&cos[0]; if(!co) throw new Error('会社が見つかりません');
    var empSets=co.emp_sets?JSON.parse(JSON.stringify(co.emp_sets)):[];
    var idx=parseInt(curIdx||0)||0;
    if(mode==='new'){
      var defName='条件セット'+(empSets.length+1);
      var nm=window.prompt('新しい雇用条件セットの名前を入力してください',defName);
      if(nm===null) return {saved:false};
      var newSet=Object.assign({},values,{setName:(nm||defName),_savedAt:new Date().toISOString(),_savedBy:_currentUserId()});
      empSets.push(newSet);
      var newIdx=empSets.length-1;
      var _rn=await sb('companies?id=eq.'+companyId+'&select=emp_sets',{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({emp_sets:empSets})});
      if(!_rn||!_rn.length) throw new Error('保存に失敗しました（対象の会社が見つからないか、権限がありません）');
      if(_empStableStr((_rn[0].emp_sets||[])[newIdx]||{})!==_empStableStr(newSet)) throw new Error('保存後の確認で内容が一致しませんでした。もう一度お試しください');
      var _rc=await sb('cases?id=eq.'+caseId+'&select=emp_set_idx',{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({emp_set_idx:String(newIdx)})});
      if(!_rc||!_rc.length) throw new Error('案件への紐付け保存に失敗しました');
      if(window._empCtx) window._empCtx.empSets=empSets;
      window._empLoadedSet=JSON.parse(JSON.stringify(newSet)); window._empLoadedIdx=newIdx;
      return {saved:true,mode:'new',newIdx:newIdx,setName:(nm||defName),empSets:empSets};
    }else{
      // ①: 楽観ロック（読み込み後にDB上のセットが変わっていたら競合として返す）
      if(!force){
        var loaded=window._empLoadedSet;
        var idxMatch=(window._empLoadedIdx==null)||(parseInt(window._empLoadedIdx)===idx);
        if(loaded && typeof loaded==='object' && Object.keys(loaded).length && idxMatch
           && _empStableStr(empSets[idx]||{})!==_empStableStr(loaded)){
          return {saved:false, conflict:true, currentSet:(empSets[idx]||{})};
        }
      }
      while(empSets.length<=idx) empSets.push({setName:'条件'+(empSets.length+1)});
      var keepName=(empSets[idx]&&empSets[idx].setName)||'ヒアリング取込';
      Object.assign(empSets[idx],values,{setName:keepName,_savedAt:new Date().toISOString(),_savedBy:_currentUserId()});
      var _r2=await sb('companies?id=eq.'+companyId+'&select=emp_sets',{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({emp_sets:empSets})});
      // ②: 読み戻し確認（0行更新やサイレント失敗・内容不一致を検知）
      if(!_r2||!_r2.length) throw new Error('保存に失敗しました（対象の会社が見つからないか、権限がありません）');
      if(_empStableStr((_r2[0].emp_sets||[])[idx]||{})!==_empStableStr(empSets[idx])) throw new Error('保存後の確認で内容が一致しませんでした。もう一度お試しください');
      if(window._empCtx) window._empCtx.empSets=empSets;
      window._empLoadedSet=JSON.parse(JSON.stringify(empSets[idx])); window._empLoadedIdx=idx;
      return {saved:true,mode:'overwrite',idx:idx,empSets:empSets};
    }
  };
})();

/* ③: 未保存のまま離脱するときに警告（読み込み後にユーザーが雇用条件を編集していたら）
   ※共有セットへの自動上書きは他案件を壊すため行わない。ここは「うっかり離脱で消える」防止。 */
(function(){
  window.addEventListener('beforeunload', function(e){
    try{
      if(typeof isEmpDirtyByForm==='function' && isEmpDirtyByForm()){
        e.preventDefault(); e.returnValue=''; return '';
      }
    }catch(_e){}
  });
})();

/* 休日の翻訳行用: 空なら空文字（プレースホルダを出さない） */
function fB(id){ try{ return (typeof v==='function' && String(v(id)||'').trim()) ? f(id) : ''; }catch(e){ return ''; } }
function fOr2B(){ try{ for(var i=0;i<arguments.length;i++){ if(String(v(arguments[i])||'').trim()) return f(arguments[i]); } }catch(e){} return ''; }

/* 印刷・PDF出力時は、空欄の目印（グレーのes.xxxラベル）を書類に出さない。
   画面では従来どおり表示され、どこが空欄か分かる。 */
(function(){
  try{
    var st=document.createElement('style');
    st.id='_phPrintStyle';
    st.textContent='@media print{ .doc [style*="color:#aaa"]{ display:none !important; } }';
    (document.head||document.documentElement).appendChild(st);
  }catch(_e){}
})();

/* ○で囲む選択（無・有 のように、どちらかに丸を付ける欄用）
   cbState に保存されるので、DB保存・再読込・印刷でも選択が残る。
   使い方: ${cir('無','renewLimit','none',true)}・${cir('有','renewLimit','yes')} */
function cir(text, groupId, value, defOn){
  var cur = (window.cbState && window.cbState[groupId] !== undefined) ? window.cbState[groupId] : (defOn ? value : '');
  var on = (cur === value);
  var st = 'display:inline-block;padding:0 5px;cursor:pointer;'
         + (on ? 'border:1px solid #333;border-radius:999px;' : 'border:1px solid transparent;border-radius:999px;');
  return '<span class="cb-click" data-cirgrp="' + groupId + '" data-cirval="' + value + '" onclick="toggleCir(\'' + groupId + '\',\'' + value + '\')" style="' + st + '">' + text + '</span>';
}
function toggleCir(groupId, value){
  if(!window.cbState) window.cbState = {};
  window.cbState[groupId] = (window.cbState[groupId] === value) ? '' : value;
  document.querySelectorAll('[data-cirgrp="' + groupId + '"]').forEach(function(el){
    var on = (el.getAttribute('data-cirval') === window.cbState[groupId]);
    el.style.border = on ? '1px solid #333' : '1px solid transparent';
  });
  // onchange相当：クリック直後にこの選択だけをDBへ自動保存（フォーム全体は保存しない）
  _cirAutoSave(groupId, window.cbState[groupId]);
}
/* 丸の選択だけをピンポイントでDB保存する。
   雇用条件は会社共有のため、フォーム全体を自動保存すると他の申請者の条件まで書き換わる。
   ここではDB側で該当箇所のみを書き換えるRPCを使い、影響範囲を最小にしている。 */
var _cirSaveTimer = null;
function _cirAutoSave(groupId, value){
  if(_cirSaveTimer) clearTimeout(_cirSaveTimer);
  _cirSaveTimer = setTimeout(function(){
    (async function(){
      try{
        var ctx = window._empCtx;
        var idx = window._empLoadedIdx;
        if(!ctx || !ctx.companyId || idx === null || idx === undefined || idx === ''){
          showToast('ℹ️ 案件が未選択のため保存していません（DB保存を押してください）');
          return;
        }
        var i = parseInt(idx) || 0;
        await sb('rpc/set_empset_cbstate', {method:'POST', body: JSON.stringify({
          p_company_id: ctx.companyId, p_idx: i, p_key: groupId, p_value: String(value == null ? '' : value)
        })});
        var r = await sb('companies?select=emp_sets&id=eq.' + ctx.companyId);
        var set = r && r[0] && r[0].emp_sets && r[0].emp_sets[i];
        var got = (set && set.cbState && set.cbState[groupId]) || '';
        if(String(got) !== String(value == null ? '' : value)) throw new Error('保存後の確認が一致しません');
        if(window._empLoadedSet){
          window._empLoadedSet.cbState = Object.assign({}, window._empLoadedSet.cbState || {});
          window._empLoadedSet.cbState[groupId] = value;
        }
        if(ctx.empSets && ctx.empSets[i]){
          ctx.empSets[i].cbState = Object.assign({}, ctx.empSets[i].cbState || {});
          ctx.empSets[i].cbState[groupId] = value;
        }
        showToast('💾 保存しました');
      }catch(e){
        showToast('⚠️ 保存に失敗しました: ' + (e && e.message ? e.message : e));
      }
    })();
  }, 400);
}

/* 再読み込み時、ブラウザが入力欄の値を復元してもプレビューは更新されない
   （値の復元では入力イベントが発生しないため）。読み込み完了後と、
   戻る/進むでの復帰時に、値が入っていればプレビューを描き直す。 */
(function(){
  function _redrawIfRestored(){
    try{
      if(typeof p!=='function') return;
      if(typeof _editMode!=='undefined' && _editMode) return;   // 直接編集中は触らない
      var has=false;
      var els=document.querySelectorAll('input[id^="es_"],textarea[id^="es_"],input[id^="f_"],textarea[id^="f_"]');
      for(var i=0;i<els.length;i++){ if(String(els[i].value||'').trim()){ has=true; break; } }
      if(has) p();
    }catch(_e){}
  }
  window.addEventListener('load', function(){ setTimeout(_redrawIfRestored, 0); });
  window.addEventListener('pageshow', function(e){ if(e.persisted) setTimeout(_redrawIfRestored, 0); });
})();
