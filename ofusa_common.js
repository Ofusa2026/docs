/**
 * ofusa_common.js - OFUSA書類作成システム 共通モジュール
 * ver.20260818.03
 * - fix(loadCaseToForm): 実費フラグ橋渡しで hasOwnProperty 判定に変更。
 *   案シス側で明示的にキー削除された案件は既存 saysay 側 Est/Jippi 状態を維持する。
 *   案シスと連動する形で、案シス側は「OFF時にキー削除」する仕様(ver.20260818.08)。
 * ver.20260818.02
 * - feat(loadCaseToForm): 案シスから渡される es.deductXxxType(boolean)を
 *   既存の実費フラグUI(es_deductXxxJippi/es_deductXxxEst)に橋渡し。
 *   案シス側で「実費」チェックした食費・居住費・水道光熱・その他①/②が
 *   書類の「（実費）」表記に自動反映されるようになった。
 *   従来はsaysay側でチェックしないと反映されず、案シスとの二重管理だった。
 * ver.20260811.02
 * - fix(loadCaseToForm): 契約期間・入国予定日(Y/M/D)欄が空欄になる不具合を追加修正。
 *   独自loadFromDB(1_6.html等)が cases.contract_start / cases.contract_end / persons.entry_date から
 *   Y/M/Dに分割して先にセットした値を、8/5導入の "es_* クリアループ" が消してしまい、
 *   emp_set側に contractStart / contractEnd の値が無い案件では空欄のまま残っていた。
 *   contractStartY/M/D / contractEndY/M/D / entryY/M/D を _ES_SKIP に追加し、
 *   案件由来の値をクリアループで保護。
 * ver.20260811.01
 * - fix(loadCaseToForm): 8/9 b289ab7 (ver.20260808.06) の loadFromDB → loadCaseToForm 順序変更で、
 *   後勝ちの loadCaseToForm 側が別名対応を持たず、独自loadFromDB(setFormValues)が正しく埋めた
 *   1-6等の欄(officeAddress・officeTel・weeklyMin/monthlyMin/yearlyMin・contractStartY/M/D・
 *   contractEndY/M/D 他)が空欄・古値焼付けになる不具合が発生していた。
 *   1_6.html の _FORM_TO_DB と同じ別名対応、および contractStart/End の Y/M/D 分割
 *   ("2026-08-20"・"2026年8月20日" 両対応)をここでも行うことで復旧。
 * ver.20260806.01
 * - loadCaseToForm: 業務区分2(category2/category2En)に emp_sets の生値「建築（建設分野・特定技能１号）」等が
 *   括弧付きのまま入り、fBunyaPair表示とサイドバー入力欄がズレる／サイドバーで消しても復活する不具合を修正。
 *   2つ目の区分は「categoryのカンマ2件目」優先、無ければ別フィールドcategory2を括弧除去して採用し、
 *   どちらも無ければ空にして生値の残存を防ぐようにした。
 * ver.20260805.01
 * - loadCaseToForm: 案件ID読込時の「前案件データ残存」バグを修正。emp_setsに手当等のキーが
 *   無い案件でも、前案件の es_a1Name/es_fixedOT* 等がフォームに残り雇用条件書に無い手当・別案件の
 *   金額が焼き付く事故があった（三谷総建で発覚）。emp_setsループ直前に es_* ・ f_* 入力欄を
 *   一旦クリア[氏名・職種・年齢性別経験・作成者、所属機関、代表者、住所など案件由来は除外]してから
 *   今の案件のemp_setsで再セットするよう変更。
 * ver.20260801.01
 * - DB復元時に直接編集版へ applyBindings() を適用し、サイド編集値が消える不具合を修正
 * - 書類プレビューの値クリックで対応入力欄へジャンプ＆フォーカス（全書類）
 * - sb() GET(読込)に cache:no-store を付与し、編集の即時反映を阻む約5分のHTTPキャッシュを解消
 * - 書類別の作成責任者(companies.extra.docAuthors)に対応。項目単位で無ければ既定author_*
 * - promptEmpSaveMode 保存モーダル: 上書き/新規作成の上下を入替、新規作成ボタンの青強調を解除し両ボタンを対等なグレー表示に
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
  // ver.20260731: GET(読込)はHTTPキャッシュ（ブラウザ/CDN）で古い応答が最大約5分返り、
  // 案シスでの編集がSaySayに即時反映されない事象があったため、GETは常に最新をDBから取得する。
  // 書込(POST/PATCH/DELETE等)には影響しない。呼び出し側が cache を明示していればそれを優先。
  const _method = (restOpts.method || 'GET').toUpperCase();
  if(_method === 'GET' && restOpts.cache === undefined) restOpts.cache = 'no-store';
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
// ver.20260731: 書類プレビューの値（.f[data-bind]）をクリックすると、対応する入力欄へスクロール＆フォーカスして即編集できる。
// f() が出力する全項目が data-bind に入力欄ID(es_xxx / f_xxx)を持つため、1箇所の委譲クリックで全書類に効く。印刷時は無効。
(function(){
  try{
    var st=document.createElement('style');
    st.textContent='.f[data-bind]{cursor:pointer;}'
      +'.f[data-bind]:hover{background:rgba(74,144,217,.15);border-radius:2px;outline:1px dashed rgba(74,144,217,.6);}'
      /* ver.20260819.02: 直接編集モード中はクリック機能を無効化するため、ホバーの視覚効果も消す */
      +'body.doc-editing .f[data-bind]{cursor:text;}'
      +'body.doc-editing .f[data-bind]:hover{background:none;outline:none;}'
      +'@media print{.f[data-bind]{cursor:auto;background:none!important;outline:none!important;}}';
    (document.head||document.documentElement).appendChild(st);
  }catch(e){}
  document.addEventListener('click',function(e){
    // ver.20260819.02: 直接編集モード中は、クリック→サイドバーフォーカスを無効化。
    //   有効にすると contenteditable にカーソルが立たず、書類プレビュー上で直接編集できなくなる。
    if(typeof _editMode !== 'undefined' && _editMode) return;
    var t=e.target;
    var el=(t&&t.closest)?t.closest('.f[data-bind]'):null;
    if(!el) return;
    // 画面編集モード中や選択操作を優先したい場合はここでガード可能（現状は常に有効）
    var id=el.getAttribute('data-bind'); if(!id) return;
    var inp=document.getElementById(id); if(!inp) return;
    // 折りたたみセクション内なら開く（親の details / .collapsed 等に対応）
    try{ var d=inp.closest && inp.closest('details'); if(d && !d.open) d.open=true; }catch(e){}
    try{ inp.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e){ try{inp.scrollIntoView();}catch(e2){} }
    try{ inp.focus({preventScroll:true}); }catch(e){ try{inp.focus();}catch(e2){} }
    try{ if(inp.select && (inp.type==='text'||inp.tagName==='TEXTAREA')) inp.select(); }catch(e){}
    var prev=inp.style.boxShadow;
    inp.style.transition='box-shadow .2s'; inp.style.boxShadow='0 0 0 2px #4a90d9';
    setTimeout(function(){ inp.style.boxShadow=prev; }, 1200);
  }, false);
})();
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
  // ver.20260827.03: 保存済みの直接編集版HTMLは修正前マークアップのスナップショットのため、
  //   テンプレ側のレイアウト修正（合計金額の1行化・Ⅷ退職の分割禁止 ver.20260827.02）が
  //   届かない。編集版を持つ案件にも効くよう、復元後にスタイルを後付けする。
  try{
    ['es_deductTotal','es_netPay','es_salaryTotal'].forEach(function(k){
      area.querySelectorAll('span.f[data-bind="'+k+'"]').forEach(function(sp){
        var td=sp.closest('td'); if(td) td.style.whiteSpace='nowrap';
      });
    });
    Array.from(area.querySelectorAll('div')).forEach(function(h){
      var t=(h.textContent||'').trim();
      if(t.indexOf('Ⅷ．退職に関する事項')===0 && h.children.length<=2){
        var blk=h.parentElement;
        if(blk){ blk.style.breakInside='avoid'; blk.style.pageBreakInside='avoid'; }
      }
    });
  }catch(_e){}
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
// ver.20260808.07: 保存用のプレースホルダ化されたHTMLを取得（元DOMは変更しない）
//   直接編集版DB保存の際、data-bindスパンに焼き込まれた値を含んだまま保存すると
//   別案件から戻ってきた時にその値が焼き込まれたまま残る問題がある。
//   保存時にはプレースホルダ化して、復元時にapplyBindings()で正しい値を流し込む。
function getBindResetHtml(){
  const area=document.getElementById('pageArea');
  if(!area) return '';
  const snapshot = area.cloneNode(true);
  try{
    snapshot.querySelectorAll('[data-bind]').forEach(function(span){
      const id = span.getAttribute('data-bind');
      const label = id.replace(/^es_/,'es.').replace(/^f_/,'');
      span.innerHTML = '';
      span.textContent = label;
      span.style.color = '';
      span.style.fontSize = '';
      span.style.fontFamily = '';
    });
  }catch(e){ console.warn('[getBindResetHtml]', e); return area.innerHTML; }
  return snapshot.innerHTML;
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
    // ver.20260820.09: applicantName (プレフィックスなし) も候補に追加。
    //   1_6.html は id="applicantName" で保存しており、従来の候補では拾えなかった。
    var ids=['applicantName','es_applicantName','f_applicant','f_applicantName','es_applicant'];
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
    // ③ 親フレームの _lastCaseInfo から取得
    if(window._lastCaseInfo && window._lastCaseInfo.applicant) return String(window._lastCaseInfo.applicant).trim();
    // ④ 親フレーム(index.html)側の情報
    try{
      if(window.parent && window.parent !== window){
        var p = window.parent;
        if(p.idxSelectedCase && p.idxSelectedCase.applicant) return String(p.idxSelectedCase.applicant).trim();
      }
    }catch(_pe){}
    if(window._empCtx && window._empCtx.applicant) return String(window._empCtx.applicant).trim();
  }catch(_e){}
  return '';
}
// ver.20260820.10: docKey → 書類日本語名（ファイル名用、番号なし）
var _PRINT_DOC_NAMES = {
  '1_3':'受診者の申告書',
  '1_4':'報酬に関する説明書',
  '1_5':'雇用契約書',
  '1_6':'雇用条件書',
  '1_11':'健康診断個人票',
  '1_16':'事前ガイダンス確認書',
  '1_17':'支援計画書',
  '1_23':'役員に関する誓約書',
  '1_25':'支援委託契約に関する説明書',
  '1_27':'公的義務履行に関する説明書',
  '1_29':'書類省略に当たっての誓約書',
  '1_30':'休業期間に関する申立書',
  '1_31':'通算在留期間を超える在留に関する申立書',
  'shozoku_daihyou':'所属機関の代表者に関する申告書',
  'iko':'移行準備説明書',
  'irai':'依頼書',
  'ininjou':'委任状',
  'henkou':'変更申出書',
  'juuyou':'重要事項説明書',
  'madoguchi':'窓口',
  'suisenhyo':'推薦票',
  'torisage':'取り下げ書',
  'shinsei_henkou':'申請書(変更)',
  'shinsei_koushin':'申請書(更新)',
  'shinsei_gjk':'申請書(認定)',
  'kyoryoku':'協力確認書',
  'kyoryoku_kaigo':'協力確認書(介護)'
};

function _printDocLabel(){
  // ver.20260820.10: docKey → 書類日本語名で返す。
  //   例: 1_6 → 「雇用条件書」、1_5 → 「雇用契約書」、juuyou → 「重要事項説明書」
  //   フォールバック: title からパターン抽出（旧動作）
  try{
    var key = (typeof _dgjInferDocKey === 'function') ? _dgjInferDocKey() : null;
    if(key && _PRINT_DOC_NAMES[key]) return _PRINT_DOC_NAMES[key];
  }catch(_e){}
  // フォールバック: titleからキーワード抽出
  var t=String(document.title||'').trim();
  if(/重要事項/.test(t)) return '重要事項説明書';
  if(/移行準備/.test(t)) return '移行準備説明書';
  if(/委任状/.test(t)) return '委任状';
  if(/雇用契約書/.test(t)) return '雇用契約書';
  if(/雇用条件書/.test(t)) return '雇用条件書';
  return t.replace(/[\\\/:*?"<>|]/g,'').slice(0,40);
}
function doPrint(){
  var orig = document.title;
  // ver.20260820.08: 親フレーム(index.html)のtitleも書き換える。
  //   Chrome の PDF保存ダイアログの名前欄には、iframe内でwindow.print()を呼んでも
  //   親フレームの document.title が使われる仕様。iframe側のtitleだけ変えても
  //   「O-Link Saysay」というindex.htmlのtitleがファイル名になっていた。
  var parentOrig = null;
  try{
    if(window.parent && window.parent !== window){
      parentOrig = window.parent.document.title;
    }
  }catch(_ce){ /* cross-origin なら諦める */ }
  try{
    var who=_printApplicantName();
    var doc=_printDocLabel();
    // ver.20260820.10: フォーマットを「申請人名様_書類名」に変更
    var name=(who? who+'様_' : '')+doc;
    var sanitized = name.replace(/[\\\/:*?"<>|]/g,'_');
    document.title = sanitized;
    // 親フレームの title も書き換え
    try{
      if(parentOrig !== null){
        window.parent.document.title = sanitized;
      }
    }catch(_pe){}
  }catch(_e){}
  try{ window.print(); }
  finally{
    // 少し遅延させて元に戻す（印刷ダイアログが開ききってから）
    setTimeout(function(){
      document.title = orig;
      try{
        if(parentOrig !== null){
          window.parent.document.title = parentOrig;
        }
      }catch(_pe){}
    }, 1000);
  }
  // ver.20260808.05: 案件書類ジャーナルへ記録（MVP Component 1 - 全書類展開）
  try{ dgjLogFromContext('print'); }catch(_){}
}

/* ===== ver.20260808.05: 案件書類ジャーナル ヘルパー ===================
   全書類HTMLから共通利用。ファイル名から docKey / doc_label を自動判定し、
   window._lastCaseInfo の caseId を使って log_doc_generation RPC を呼ぶ。
   1_17.html（docx生成）は既に独自ログを持つため、ここでの記録対象外。
   ==================================================================*/
var DGJ_DOC_LABELS_JS = {
  '1_1':'1-1号', '1_3':'1-3号', '1_5':'1-5号 雇用契約書', '1_6':'1-6号 雇用条件書',
  '1_11':'1-11号', '1_16':'1-16号 事前ガイダンス確認書',
  '1_23':'1-23号', '1_25':'1-25号', '1_27':'1-27号', '1_29':'1-29号', '1_30':'1-30号', '1_31':'1-31号',
  'shozoku_daihyou':'所属機関の代表者に関する申告書',
  'iko':'移行準備説明書', 'irai':'依頼書', 'ininjou':'委任状', 'henkou':'変更申出書',
  'juuyou':'重要事項説明書', 'madoguchi':'窓口', 'suisenhyo':'推薦票', 'torisage':'取り下げ書',
  'shinsei_henkou':'申請書(変更)', 'shinsei_koushin':'申請書(更新)', 'shinsei_gjk':'申請書(認定)',
  'kyoryoku':'協力確認書', 'kyoryoku_kaigo':'協力確認書(介護)',
  '2_1':'2-1号', '3_1':'3-1号', '4_1':'4-1号', '5_1':'5-1号', '6_1':'6-1号',
  '7_1':'7-1号', '8_1':'8-1号', '9_1':'9-1号',
  '10_1':'10-1号','10_2':'10-2号','11_1':'11-1号','11_3':'11-3号','11_4':'11-4号',
  '12_1':'12-1号','12_2':'12-2号','13_1':'13-1号','13_2':'13-2号',
  '14_1':'14-1号','14_2':'14-2号','15_1':'15-1号','15_2':'15-2号',
  '16_1':'16-1号','16_2':'16-2号','17_1':'17-1号','18_1':'18-1号'
};
function _dgjInferDocKey(){
  try{
    var fn = (location.pathname.split('/').pop()||'').replace(/\?.*$/,'').replace(/\.html$/i,'');
    // 言語サフィックス除去（1_16_id → 1_16）
    var m = fn.match(/^(1_\d+|[a-z_]+?)(_(id|vi|my|ne|zh|en|th|km|ko))?$/i);
    if(m) return m[1];
    return fn || null;
  }catch(_){ return null; }
}
function _dgjInferLang(){
  try{
    var fn = (location.pathname.split('/').pop()||'').replace(/\?.*$/,'').replace(/\.html$/i,'');
    var m = fn.match(/_(id|vi|my|ne|zh|en|th|km|ko)$/i);
    return m ? m[1].toLowerCase() : null;
  }catch(_){ return null; }
}
async function dgjLog(docKey, docLabel, opts){
  opts = opts || {};
  try{
    // 案件情報取得
    var info = null;
    var sel = document.getElementById('caseSelect');
    if(sel && sel.value){ try{ info = JSON.parse(sel.value); }catch(_){} }
    if((!info || !info.caseId) && window._lastCaseInfo && window._lastCaseInfo.caseId){
      info = window._lastCaseInfo;
    }
    if(!info || !info.caseId) return; // 案件未選択なら黙って諦める
    var payload = {
      p_case_id: String(info.caseId),
      p_doc_key: docKey,
      p_doc_label: docLabel || DGJ_DOC_LABELS_JS[docKey] || docKey,
      p_language: opts.language || _dgjInferLang(),
      p_template_variant: opts.templateVariant || null,
      p_file_name: opts.fileName || null,
      p_file_size: opts.fileSize || null,
      p_status: opts.status || 'success',
      p_note: opts.note || null,
      p_warnings: opts.warnings || null
    };
    // sb() 経由でRPC POST
    await sb('rpc/log_doc_generation', {
      method:'POST',
      body: JSON.stringify(payload)
    });
    // 親（Saysay index.html）にリアルタイム通知
    try{ window.parent.postMessage({type:'DOC_GENERATED', caseId:info.caseId, docKey:docKey}, '*'); }catch(_){}
  }catch(e){ console.warn('dgjLog error:', e); }
}
// コンテキスト（現在のHTML）から自動判定してログ
function dgjLogFromContext(action){
  var docKey = _dgjInferDocKey();
  if(!docKey) return;
  var lang = _dgjInferLang();
  dgjLog(docKey, DGJ_DOC_LABELS_JS[docKey] || docKey, {
    language: lang,
    note: action==='print' ? '印刷/PDF出力' : action==='save' ? 'DB保存' : action==='downloadHtml' ? 'HTML保存' : null
  });
}

/* ===== 1-5 と 1-6 を1つのPDFにまとめて印刷 ===== */
function _pairFile(){
  // 現在のファイル名から相方(1-5⇔1-6)と言語サフィックスを判定
  var fn=(location.pathname.split('/').pop()||'').replace(/\?.*$/,'');
  var m=fn.match(/^1_(5|6)(_[a-z]+)?\.html$/i);
  if(!m) return null;
  var cur=m[1], suf=m[2]||'';
  var other=(cur==='5')?'6':'5';
  return { self:'1_'+cur+suf+'.html', other:'1_'+other+suf+'.html', selfNo:cur, otherNo:other };
}
async function printBoth(){
  var pair=_pairFile();
  if(!pair){ if(typeof showToast==='function') showToast('⚠️ この様式ではまとめ印刷は使えません'); return; }
  var info = window._lastCaseInfo || null;
  if((!info||!info.caseId)){
    var sel=document.getElementById('caseSelect');
    if(sel&&sel.value){ try{ info=JSON.parse(sel.value); }catch(e){} }
  }
  if(!info||!info.caseId){
    info = await new Promise(function(resolve){
      function h(e){ if(e.data&&e.data.type==='CASE_INFO_RESPONSE'){ window.removeEventListener('message',h); resolve(e.data.info||null); } }
      window.addEventListener('message',h);
      try{ window.parent.postMessage({type:'GET_CASE_INFO'},'*'); }catch(e){}
      setTimeout(function(){ window.removeEventListener('message',h); resolve(null); },1000);
    });
  }
  var _tst=document.createElement('div');
  _tst.id='__combinedProgress';
  _tst.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,.3);font-family:sans-serif;';
  _tst.textContent='📄 '+pair.selfNo+'号と'+pair.otherNo+'号をまとめています…';
  document.body.appendChild(_tst);
  function _killProgress(){ var p=document.getElementById('__combinedProgress'); if(p&&p.parentNode) p.parentNode.removeChild(p); }
  var q = info&&info.caseId ? ('?caseId='+encodeURIComponent(info.caseId)) : '';
  var ifr=document.createElement('iframe');
  ifr.style.cssText='position:fixed;left:-9999px;top:0;width:1024px;height:1400px;border:0;';
  ifr.src=pair.other+q;
  document.body.appendChild(ifr);
  await new Promise(function(res){ ifr.onload=function(){ setTimeout(res,150); }; });
  try{
    var idoc=ifr.contentDocument, iwin=ifr.contentWindow;
    if(info&&info.caseId&&iwin){
      try{ iwin.postMessage({type:'SELECT_CASE', info:info}, '*'); }catch(e){}
      if(typeof iwin.loadFromDB==='function'){ try{ await iwin.loadFromDB(info); }catch(e){} }
    }
    await new Promise(function(r){ setTimeout(r,900); });
    var otherDocs=idoc.querySelectorAll('.doc');
    if(!otherDocs.length){ if(typeof showToast==='function') showToast('⚠️ 相方書類の読込に失敗しました'); if(ifr.parentNode)ifr.parentNode.removeChild(ifr); return; }
    var host=document.createElement('div');
    host.id='__combinedPrintArea';
    // 相方のstyleを取り込み（レイアウト維持）
    idoc.querySelectorAll('style').forEach(function(st){ host.appendChild(st.cloneNode(true)); });
    otherDocs.forEach(function(d){ var c=d.cloneNode(true); host.appendChild(c); });
    // DOM順で 1-5 → 1-6 になるよう配置: 相方が5号なら本体の前、6号なら後ろ
    var pageArea=document.getElementById('pageArea')||document.querySelector('.main')||document.body;
    // 1-5と1-6を確実に別ページに: 空要素での改ページは空白ページを生むため、
    // 「先に来るブロックの末尾で改ページ」を動的CSSで指定する。
    // 配置は起動元によって変わる(下のif)ので、改ページCSSも配置確定後に生成する。
    var _pbStyle=document.createElement('style');
    _pbStyle.className='__combined-pb-style';
    document.head.appendChild(_pbStyle);
    if(pair.otherNo==='5'){
      // 相方=1-5 → host(1-5)を本体(1-6)の前に。DOM順: host(1-5) → pageArea(1-6)
      pageArea.parentNode.insertBefore(host, pageArea);
      _pbStyle.textContent='@media print{'+
        // 先頭ブロック(1-5=結合エリア)の最後のdocの後で改ページ
        '#__combinedPrintArea{page-break-after:always;break-after:page;}'+
        '#__combinedPrintArea .doc:last-child{page-break-after:always !important;break-after:page !important;}'+
        // 後続ブロック(1-6=本体)の先頭docは改ページ抑制(二重改ページ=空白ページ防止)
        '#pageArea > .doc:first-child{page-break-before:auto !important;break-before:auto !important;}'+
      '}';
    }
    else {
      // 相方=1-6 → host(1-6)を本体(1-5)の後に。DOM順: pageArea(1-5) → host(1-6)
      var ref=pageArea.nextSibling;
      if(ref){ pageArea.parentNode.insertBefore(host, ref); }
      else { pageArea.parentNode.appendChild(host); }
      _pbStyle.textContent='@media print{'+
        // 先頭ブロック(1-5=本体)の最後のdocの後で改ページ
        '#pageArea{page-break-after:always;break-after:page;}'+
        '#pageArea > .doc:last-child{page-break-after:always !important;break-after:page !important;}'+
        // 後続ブロック(1-6=結合エリア)の先頭docは改ページ抑制
        '#__combinedPrintArea .doc:first-child{page-break-before:auto !important;break-before:auto !important;}'+
      '}';
    }
    if(ifr.parentNode) ifr.parentNode.removeChild(ifr);
    var orig=document.title;
    // ver.20260820.08: 親フレームのtitleも書き換え（PDF保存名になる）
    var parentOrig = null;
    try{
      if(window.parent && window.parent !== window){
        parentOrig = window.parent.document.title;
      }
    }catch(_ce){}
    try{
      var who=(typeof _printApplicantName==='function')?_printApplicantName():'';
      // ver.20260820.10: フォーマットを「申請人名様_雇用契約書・雇用条件書」に変更
      var titleName = ((who?who+'様_':'')+'雇用契約書・雇用条件書').replace(/[\\\/:*?"<>|]/g,'_');
      document.title = titleName;
      try{
        if(parentOrig !== null){
          window.parent.document.title = titleName;
        }
      }catch(_pe){}
    }catch(_e){}
    // 印刷後クリーンアップ
    function cleanup(){
      document.title=orig;
      try{ if(parentOrig !== null){ window.parent.document.title = parentOrig; } }catch(_pe){}
      try{ if(window.__combinedMO){ window.__combinedMO.disconnect(); window.__combinedMO=null; } }catch(_e){}
      var p=document.getElementById('__combinedProgress'); if(p&&p.parentNode)p.parentNode.removeChild(p);
      var h=document.getElementById('__combinedPrintArea'); if(h&&h.parentNode) h.parentNode.removeChild(h);
      document.querySelectorAll('.__combined-pagebreak, .__combined-pb-style').forEach(function(x){x.remove();});
      window.removeEventListener('afterprint',cleanup);
    }
    _killProgress();
    if(typeof clearToasts==='function') clearToasts();
    // iframe側(相方書類)に出たトーストも消す
    try{ if(ifr&&ifr.contentDocument){ ifr.contentDocument.querySelectorAll('.__toast,#__combinedProgress').forEach(function(t){t.remove();}); } }catch(_e){}
    // 印刷の瞬間に残存トースト/進捗を全て物理削除（@media printに依存しない確実策）
    function _nukeToasts(){ document.querySelectorAll('.__toast,#__combinedProgress').forEach(function(t){ if(t&&t.parentNode) t.parentNode.removeChild(t); }); }
    _nukeToasts();
    // 印刷ダイアログ表示中に他処理がトーストを再生成しても即座に消す
    try{ window.__combinedMO=new MutationObserver(_nukeToasts); window.__combinedMO.observe(document.body,{childList:true,subtree:true}); }catch(_e){}
    window.addEventListener('afterprint',cleanup);
    // 進捗表示が確実にDOMから消え、再描画されてから印刷する
    await new Promise(function(r){ requestAnimationFrame(function(){ requestAnimationFrame(function(){ setTimeout(r,200); }); }); });
    _nukeToasts();
    window.print();
    setTimeout(cleanup, 3000);
    // ver.20260808.05: ジャーナル記録（1-5号と1-6号のペア両方）
    try{
      var _selfKey = '1_'+pair.selfNo;
      var _otherKey = '1_'+pair.otherNo;
      var _lang = _dgjInferLang();
      dgjLog(_selfKey, DGJ_DOC_LABELS_JS[_selfKey]||_selfKey, {note:'まとめ印刷/PDF', language:_lang});
      dgjLog(_otherKey, DGJ_DOC_LABELS_JS[_otherKey]||_otherKey, {note:'まとめ印刷/PDF（相方）', language:_lang});
    }catch(_){}
  }catch(e){
    console.error('[printBoth]',e);
    _killProgress();
    if(typeof showToast==='function') showToast('⚠️ まとめ印刷でエラー: '+e.message);
    if(ifr&&ifr.parentNode) ifr.parentNode.removeChild(ifr);
  }
}

function showToast(msg,ms){const t=document.createElement('div');t.className='__toast';t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e293b;color:white;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,.3);font-family:sans-serif;';t.textContent=msg;document.body.appendChild(t);var d=(ms===undefined?3000:ms);if(d>0)setTimeout(function(){t.remove();},d);return t;}
/* トーストは印刷・PDFに出さない（全書類共通） */
(function(){try{if(!document.getElementById('__toast-print-hide')){var s=document.createElement('style');s.id='__toast-print-hide';s.textContent='@media print{.__toast,#__combinedProgress{display:none !important;}}';document.head.appendChild(s);}}catch(e){}})();
function clearToasts(){document.querySelectorAll('.__toast').forEach(function(t){t.remove();});}

// ===== 文字サイズ =====
let _fontSize=8.5,_editMode=false,_editLock=false;
function _applyFontSize(){let st=document.getElementById('_fontSizeStyle');if(!st){st=document.createElement('style');st.id='_fontSizeStyle';document.head.appendChild(st);}st.textContent=`.doc{font-size:${_fontSize}pt!important;}.doc .id{font-size:${(_fontSize*7.5/8.5).toFixed(2)}pt!important;}.doc [style*="font-size:9pt"]{font-size:${(_fontSize*9/8.5).toFixed(2)}pt!important;}.doc [style*="font-size:8pt"]{font-size:${(_fontSize*8/8.5).toFixed(2)}pt!important;}.doc [style*="font-size:8.5pt"]{font-size:${_fontSize}pt!important;}.doc [style*="font-size:7.5pt"]{font-size:${(_fontSize*7.5/8.5).toFixed(2)}pt!important;}.doc [style*="font-size:7pt"]{font-size:${(_fontSize*7/8.5).toFixed(2)}pt!important;}.doc [style*="font-size:6.5pt"]{font-size:${(_fontSize*6.5/8.5).toFixed(2)}pt!important;}.doc [style*="font-size:6pt"]{font-size:${(_fontSize*6/8.5).toFixed(2)}pt!important;}.doc [style*="font-size:15pt"]{font-size:${(_fontSize*15/8.5).toFixed(2)}pt!important;}.doc [style*="font-size:10pt"]{font-size:${(_fontSize*10/8.5).toFixed(2)}pt!important;}`;}
function changeFontSize(delta){if(_editMode){const sel=window.getSelection();if(sel&&!sel.isCollapsed){const range=sel.getRangeAt(0);const newSize=delta===0?8.5:Math.round(Math.max(5,Math.min(14,_fontSize+delta))*2)/2;const span=document.createElement('span');span.style.fontSize=newSize+'pt';try{range.surroundContents(span);sel.removeAllRanges();}catch(e){const frag=range.extractContents();span.appendChild(frag);range.insertNode(span);}}const lbl=document.getElementById('fontSizeLabel');if(lbl)lbl.textContent=(delta===0?8.5:Math.round(Math.max(5,Math.min(14,_fontSize+delta))*2)/2)+'pt';return;}if(delta===0){_fontSize=8.5;}else{_fontSize=Math.round(Math.max(5,Math.min(14,_fontSize+delta))*2)/2;}_applyFontSize();const lbl=document.getElementById('fontSizeLabel');if(lbl)lbl.textContent=_fontSize+'pt';}

// ===== 直接編集モード =====
// ver.20260808.07: ワンクリック化＋自動保存（ドラフト）
//   - 編集モード終了時に自動的にDB保存を実行（従来は別途「💾 DB保存」が必要だった）
//   - 編集モード中は10秒ごとにバックグラウンドで自動保存（下書き扱い・トースト無し）
//   - ボタンラベルを状態に応じて動的に変える
function toggleEditMode(){
  _editMode=!_editMode;
  const btn=document.getElementById('editModeBtn');
  const area=document.getElementById('pageArea');
  if(_editMode){
    _editLock=true;
    if(btn){btn.textContent='✅ 完了して保存';btn.classList.add('edit-mode-on');btn.title='編集モードを終了して自動的にDB保存します';}
    if(area)area.classList.add('edit-mode');
    enableDocEditing(true);
    // ver.20260808.07: 編集中の自動保存を開始
    _startAutosave();
    // ver.20260808.07: 未保存表示（画面枠を赤くする）
    _showEditingIndicator(true);
  }else{
    _editLock=false;
    if(btn){btn.textContent='✏️ 直接編集';btn.classList.remove('edit-mode-on');btn.title='';}
    if(area)area.classList.remove('edit-mode');
    enableDocEditing(false);
    // 直接編集した内容を破棄しないよう、終了時にHTMLをフリーズして保持する。
    // （以前はここで p() を呼んでフォーム値から作り直していたため、手編集が消えていた）
    // フリーズ後もフォームの変数(data-bind)は applyBindings() 経由で更新される。
    window._htmlFrozen=true;
    // ver.20260808.07: 自動保存を停止＆最終保存を実行
    _stopAutosave();
    _showEditingIndicator(false);
    // 編集モード終了時に自動でDB保存
    _autoSaveOnExit();
  }
}

// ver.20260808.07: 編集モード終了時の自動保存
async function _autoSaveOnExit(){
  try{
    if(typeof showToast === 'function') showToast('💾 編集を保存しています...', 1500);
    // 書類側の独自保存関数を優先（1_6.htmlのsaveForm等）→ なければsaveFormGeneric
    if(typeof saveForm === 'function'){
      await saveForm();
    } else {
      const docKey = window._empDocKey || _dgjInferDocKey();
      if(!docKey){ console.warn('[autoSaveOnExit] docKey取得不可'); return; }
      if(typeof saveFormGeneric !== 'function'){ return; }
      await saveFormGeneric(docKey);
    }
    // 各保存関数の中でトーストが出るのでここでは追加しない
  }catch(e){
    console.warn('[autoSaveOnExit]', e);
    if(typeof showToast === 'function') showToast('⚠️ 自動保存に失敗しました。「💾 DB保存」を手動で押してください');
  }
}

// ver.20260808.07: 自動保存（下書き）
let _autosaveTimer = null;
let _autosaveInFlight = false;
const AUTOSAVE_INTERVAL_MS = 10000; // 10秒

function _startAutosave(){
  if(_autosaveTimer) return; // 既に起動中
  _autosaveTimer = setInterval(async function(){
    if(!window._editedDirty) return;        // 変更なし → スキップ
    if(_autosaveInFlight) return;            // 前回まだ進行中 → スキップ
    if(!_editMode) return;                   // 既に終了 → スキップ
    _autosaveInFlight = true;
    try{
      window._autosaving = true;
      _showAutosaveIndicator('saving');
      // 書類側の独自保存関数を優先（1_6.htmlのsaveForm等）→ なければsaveFormGeneric
      if(typeof saveForm === 'function'){
        await saveForm();
      } else {
        const docKey = window._empDocKey || _dgjInferDocKey();
        if(docKey && typeof saveFormGeneric === 'function'){
          await saveFormGeneric(docKey);
        }
      }
      _showAutosaveIndicator('saved');
      // 3秒後にインジケーターを消す
      setTimeout(function(){ _showAutosaveIndicator('idle'); }, 3000);
    }catch(e){
      console.warn('[autosave]', e);
      _showAutosaveIndicator('error');
    }finally{
      window._autosaving = false;
      _autosaveInFlight = false;
    }
  }, AUTOSAVE_INTERVAL_MS);
}

function _stopAutosave(){
  if(_autosaveTimer){ clearInterval(_autosaveTimer); _autosaveTimer = null; }
  _showAutosaveIndicator('idle');
}

// ver.20260808.07: 自動保存インジケーター（画面下・小さく）
function _showAutosaveIndicator(state){
  let el = document.getElementById('__autosaveIndicator');
  if(state === 'idle'){
    if(el && el.parentNode) el.parentNode.removeChild(el);
    return;
  }
  if(!el){
    el = document.createElement('div');
    el.id = '__autosaveIndicator';
    el.style.cssText = 'position:fixed;bottom:16px;left:16px;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:700;z-index:99998;box-shadow:0 2px 8px rgba(0,0,0,.15);font-family:sans-serif;transition:opacity .2s;';
    document.body.appendChild(el);
  }
  if(state === 'saving'){
    el.style.background = '#3b82f6'; el.style.color = 'white';
    el.textContent = '💾 自動保存中...';
  } else if(state === 'saved'){
    el.style.background = '#10b981'; el.style.color = 'white';
    el.textContent = '✅ 自動保存しました';
  } else if(state === 'error'){
    el.style.background = '#ef4444'; el.style.color = 'white';
    el.textContent = '⚠️ 自動保存に失敗';
  }
}

// ver.20260808.07: 編集モード中の視覚表示（画面枠を赤みがかった枠線に）
function _showEditingIndicator(on){
  let el = document.getElementById('__editingIndicator');
  if(!on){
    if(el && el.parentNode) el.parentNode.removeChild(el);
    return;
  }
  if(!el){
    el = document.createElement('div');
    el.id = '__editingIndicator';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#f59e0b,#ef4444,#f59e0b);background-size:200% 100%;animation:__editingPulse 2s linear infinite;z-index:99997;pointer-events:none;';
    // アニメーション定義
    if(!document.getElementById('__editingIndicatorCSS')){
      const st = document.createElement('style');
      st.id = '__editingIndicatorCSS';
      st.textContent = '@keyframes __editingPulse{0%{background-position:0% 0%}100%{background-position:200% 0%}}';
      document.head.appendChild(st);
    }
    document.body.appendChild(el);
  }
}
function enableDocEditing(on){
  const area=document.getElementById('pageArea');
  if(!area)return;
  // ver.20260819.01: 直接編集モードで Enter=<br> 挿入のみ有効化。
  //   以前(ver.20260818.05)で入れた「.doc-editable * { white-space:pre-wrap !important }」は
  //   HTMLソース内の改行・インデントまで空白として反映してしまい、書類が縦に大きく伸びる
  //   不具合があったため撤去。white-space は元のレイアウトのまま。
  //   Enterで<br>を挿入するだけで改行できる(<br>は white-space:normal でも折り返す)。
  //   前回入れてしまった __docEditableCSS の style タグが残っている環境では明示的に削除。
  var _oldCSS = document.getElementById('__docEditableCSS');
  if(_oldCSS && _oldCSS.parentNode) _oldCSS.parentNode.removeChild(_oldCSS);
  // ver.20260717: 直接編集の未保存を検知する。editable 中の入力を1度だけ拾えばよい。
  if(on && !area.dataset.dirtyHooked){
    area.dataset.dirtyHooked='1';
    area.addEventListener('input', function(){ if(_editMode) markEditedDirty(); });
  }
  // ver.20260818.05: 直接編集モードで Enter/Shift+Enter を確実に改行として扱う。
  //   contenteditable の既定挙動はブラウザ/ブロック親要素で <div><p><br> と揺れるため、
  //   常に <br> を挿入して自然な改行にする。td/span 内でも動くようにする。
  //   IMEの変換確定Enterはブラウザ側で処理させる（e.isComposing を確認）。
  if(on && !area.dataset.enterHooked){
    area.dataset.enterHooked='1';
    area.addEventListener('keydown', function(e){
      if(!_editMode) return;
      if(e.key !== 'Enter') return;
      if(e.isComposing || e.keyCode === 229) return; // IME変換中は素通し
      // Enter単独=改行 / Shift+Enter=改行 / Alt+Enter=改行 全て統一
      e.preventDefault();
      var sel = window.getSelection();
      if(!sel || sel.rangeCount === 0) return;
      var range = sel.getRangeAt(0);
      range.deleteContents();
      var br = document.createElement('br');
      range.insertNode(br);
      // カーソルを<br>の直後へ移動（連続Enterで空行が入るよう、ゼロ幅スペースは使わない）
      // 空行の高さを保つため、末尾に来た改行は追加の<br>を1個入れる
      var after = document.createTextNode('\u200B');
      br.parentNode.insertBefore(after, br.nextSibling);
      range.setStartAfter(br);
      range.setEndAfter(br);
      sel.removeAllRanges();
      sel.addRange(range);
      // dirtyフラグを立てる（inputイベントが飛ばない場合の保険）
      if(typeof markEditedDirty==='function') markEditedDirty();
    });
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
  // ver.20260819.02: body に doc-editing クラスをつけ外し、
  //   .f[data-bind] のホバー効果とクリック機能を無効化する（CSS制御）
  try{
    if(on) document.body.classList.add('doc-editing');
    else document.body.classList.remove('doc-editing');
  }catch(_e){}
}


// ===== ユーザー注記機能（v2: 行の下に挿入方式）=====
// ver.20260820.07: フリー配置(絶対座標)方式は印刷ズレが解消できなかったため、
//   「クリックした要素の直後に挿入」方式に変更。
//   - 直接編集モード中に書類上の任意の行(要素)をクリックしてアンカー選択
//   - 「➕ 注記を追加」で日本語+翻訳を入力するモーダル
//   - 注記はアンカー要素の直後にインラインで挿入される（絶対配置ではない）
//   - 印刷でもズレない（インライン挿入だから）
//   - companies.emp_sets[i]._userNotes 配列に保存（キー_userNotesは維持）
//   - 同じ雇用条件セットを使う他案件でも復元
//
// 注記データ構造 (v2 JSON):
// { id: 'note_xxxx', ja: '日本語文', tr: '翻訳文',
//   page: ページ番号(1..7),           # どのページか
//   anchorText: '対象行のテキスト先頭部分', # 最大80文字
//   anchorIndex: 0                      # 同じテキストが複数ある場合の番目(0始まり)
// }

// メモリ上の全注記
window._userNotes = [];
// 現在選択中のアンカー要素(_editMode中にクリックで選ぶ)
window._selectedAnchor = null;

// CSS注入
function _ensureUserNoteCSS(){
  if(document.getElementById('__userNoteCSS')) return;
  var st = document.createElement('style');
  st.id = '__userNoteCSS';
  st.textContent =
    /* インライン注記本体：地の文として表示 */
    '.user-note{display:block;color:#000;font-size:8.5pt;line-height:1.4;margin:2px 0;padding:0;white-space:pre-wrap;word-break:break-word;position:relative;}' +
    '.user-note .un-line-tr{font-size:7.5pt;color:#000;}' +
    /* 編集モード中だけ淡いハイライトとツール */
    'body.doc-editing .user-note{outline:1px dashed #a855f7;background:rgba(245,240,255,.4);padding:2px 4px;}' +
    'body.doc-editing .user-note:hover{outline:1px solid #7c3aed;background:rgba(245,240,255,.7);}' +
    '.user-note .un-tools{display:none;position:absolute;top:-22px;right:0;background:#fff;border:1px solid #ccc;border-radius:3px;padding:1px 4px;font-size:10px;z-index:100;}' +
    'body.doc-editing .user-note:hover .un-tools{display:inline-block;}' +
    '.user-note .un-btn{display:inline-block;margin:0 2px;padding:2px 6px;cursor:pointer;color:#374151;border-radius:3px;user-select:none;}' +
    '.user-note .un-btn:hover{background:#eee;}' +
    /* アンカー選択中の要素をハイライト */
    'body.doc-editing .__note-anchor-selected{outline:2px solid #7c3aed !important;outline-offset:2px;background:rgba(245,240,255,.5)!important;}' +
    /* 追加ボタン(フローティング) */
    '#userNoteAddBtn{display:none;position:fixed;bottom:70px;right:16px;z-index:9999;padding:10px 14px;background:#7c3aed;color:#fff;border:none;border-radius:24px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 8px rgba(0,0,0,.2);}' +
    '#userNoteAddBtn:hover{background:#6d28d9;}' +
    'body.doc-editing #userNoteAddBtn{display:inline-block;}' +
    /* 印刷時: 枠なし、地の文として表示、ツール非表示 */
    '@media print{' +
      '.user-note{outline:none!important;background:transparent!important;padding:0!important;}' +
      '.user-note .un-tools{display:none!important;}' +
      '#userNoteAddBtn{display:none!important;}' +
      '.__note-anchor-selected{outline:none!important;background:none!important;}' +
    '}';
  document.head.appendChild(st);
}

// 追加ボタン設置
function _ensureUserNoteAddBtn(){
  if(document.getElementById('userNoteAddBtn')) return;
  var btn = document.createElement('button');
  btn.id = 'userNoteAddBtn';
  btn.type = 'button';
  btn.textContent = '➕ 注記を追加';
  btn.title = '書類の任意の行をクリックしてから、このボタンで注記を追加します';
  btn.onclick = function(){ createUserNoteInteractive(); };
  document.body.appendChild(btn);
}

// アンカー選択ハンドラを設置（1度だけ）
function _ensureAnchorSelectionHandler(){
  var area = document.getElementById('pageArea');
  if(!area || area.dataset.anchorHooked) return;
  area.dataset.anchorHooked = '1';
  area.addEventListener('click', function(ev){
    if(typeof _editMode === 'undefined' || !_editMode) return;
    // 注記本体のクリックは無視（別のハンドラで処理）
    if(ev.target.closest('.user-note')) return;
    if(ev.target.closest('.un-tools')) return;
    // アンカー候補: 行相当の要素（div, tr, tdなど）
    var target = ev.target;
    // 適切な粒度の親を選ぶ（テキストを含む最小の block/inline要素）
    // 既存の選択を解除
    var doc = area.ownerDocument;
    doc.querySelectorAll('.__note-anchor-selected').forEach(function(el){
      el.classList.remove('__note-anchor-selected');
    });
    if(target && target.classList){
      target.classList.add('__note-anchor-selected');
      window._selectedAnchor = target;
    }
  });
}

function _generateUserNoteId(){
  return 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

// 要素からアンカー識別情報を取得
function _getAnchorInfo(element){
  if(!element) return null;
  var area = document.getElementById('pageArea');
  if(!area) return null;
  var pages = area.querySelectorAll('.doc');
  // 何ページ目か
  var page = 1;
  for(var i = 0; i < pages.length; i++){
    if(pages[i].contains(element)){ page = i + 1; break; }
  }
  // テキストの先頭部分(最大80文字)を保存
  var text = (element.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 80);
  if(!text) return null;
  // 同じテキスト先頭を持つ要素が複数あれば何番目か特定
  var allElements = pages[page - 1] ? pages[page - 1].querySelectorAll(element.tagName) : [];
  var index = 0, found = false;
  for(var j = 0; j < allElements.length; j++){
    var t = (allElements[j].textContent || '').replace(/\s+/g, ' ').trim().substring(0, 80);
    if(t === text){
      if(allElements[j] === element){ found = true; break; }
      index++;
    }
  }
  return {
    page: page,
    anchorText: text,
    anchorIndex: index,
    anchorTag: element.tagName
  };
}

// アンカー情報から実際の要素を再取得
function _findAnchorElement(anchorInfo){
  if(!anchorInfo) return null;
  var area = document.getElementById('pageArea');
  if(!area) return null;
  var pages = area.querySelectorAll('.doc');
  var pageEl = pages[(anchorInfo.page || 1) - 1];
  if(!pageEl) return null;
  var tag = anchorInfo.anchorTag || '*';
  var candidates = pageEl.querySelectorAll(tag);
  var matched = [];
  for(var i = 0; i < candidates.length; i++){
    var t = (candidates[i].textContent || '').replace(/\s+/g, ' ').trim().substring(0, 80);
    if(t === anchorInfo.anchorText) matched.push(candidates[i]);
  }
  return matched[anchorInfo.anchorIndex || 0] || matched[0] || null;
}

// 1件の注記を描画（アンカー要素の直後に挿入）
function _renderUserNote(note){
  // 既存要素を削除して再挿入
  var old = document.getElementById('un_' + note.id);
  if(old && old.parentNode) old.parentNode.removeChild(old);

  var anchor = _findAnchorElement(note);
  if(!anchor){
    console.warn('[userNote] anchor not found for:', note.anchorText);
    return null;
  }

  var el = document.createElement('div');
  el.id = 'un_' + note.id;
  el.className = 'user-note';
  el.dataset.noteId = note.id;
  // 日本語行
  var ja = document.createElement('div');
  ja.className = 'un-line-ja';
  ja.textContent = '※' + (note.ja || '');
  el.appendChild(ja);
  // 翻訳行
  if(note.tr){
    var tr = document.createElement('div');
    tr.className = 'un-line-tr';
    tr.textContent = '※' + note.tr;
    el.appendChild(tr);
  }
  // ツール（編集・削除）
  var tools = document.createElement('div');
  tools.className = 'un-tools';
  tools.setAttribute('contenteditable', 'false');
  var edit = document.createElement('span');
  edit.className = 'un-btn';
  edit.textContent = '✏️ 編集';
  edit.onclick = function(e){ e.stopPropagation(); e.preventDefault(); editUserNote(note.id); };
  var del = document.createElement('span');
  del.className = 'un-btn';
  del.textContent = '🗑️ 削除';
  del.style.color = '#dc2626';
  del.onclick = function(e){ e.stopPropagation(); e.preventDefault(); deleteUserNote(note.id); };
  tools.appendChild(edit);
  tools.appendChild(del);
  el.appendChild(tools);
  el.setAttribute('contenteditable', 'false');

  // アンカー要素の直後に挿入
  if(anchor.nextSibling){
    anchor.parentNode.insertBefore(el, anchor.nextSibling);
  } else {
    anchor.parentNode.appendChild(el);
  }
  return el;
}

function renderAllUserNotes(){
  _ensureUserNoteCSS();
  _ensureUserNoteAddBtn();
  _ensureAnchorSelectionHandler();
  // 既存の描画をクリア
  document.querySelectorAll('.user-note').forEach(function(el){ el.parentNode && el.parentNode.removeChild(el); });
  (window._userNotes || []).forEach(function(note){ _renderUserNote(note); });
}

// ===== モーダル =====
function _ensureUserNoteModal(){
  if(document.getElementById('userNoteModal')) return;
  var modal = document.createElement('div');
  modal.id = 'userNoteModal';
  modal.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:99999;align-items:center;justify-content:center;';
  modal.innerHTML =
    '<div style="background:#fff;border-radius:8px;padding:20px;max-width:520px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.3);">' +
      '<h3 id="unModalTitle" style="margin:0 0 12px;font-size:15px;color:#1f2937;">📝 注記を追加</h3>' +
      '<div id="unModalAnchor" style="margin-bottom:10px;padding:8px;background:#f3f4f6;border-radius:4px;font-size:11px;color:#4b5563;">挿入位置: (未選択)</div>' +
      '<div style="margin-bottom:10px;">' +
        '<label style="display:block;font-size:12px;color:#4b5563;margin-bottom:4px;font-weight:600;">日本語文（先頭に「※」は自動で付きます）</label>' +
        '<textarea id="unModalJa" rows="3" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:4px;font-size:13px;font-family:inherit;box-sizing:border-box;resize:vertical;" placeholder="例：シフト制につき一例"></textarea>' +
      '</div>' +
      '<div style="margin-bottom:12px;">' +
        '<label style="display:block;font-size:12px;color:#4b5563;margin-bottom:4px;font-weight:600;">翻訳文（不要なら空欄でOK）</label>' +
        '<textarea id="unModalTr" rows="3" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:4px;font-size:13px;font-family:inherit;box-sizing:border-box;resize:vertical;" placeholder="例：Salah satu contoh sistem per shift"></textarea>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;">' +
        '<button type="button" id="unModalCancel" style="padding:8px 16px;background:#e5e7eb;color:#374151;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;">キャンセル</button>' +
        '<button type="button" id="unModalOk" style="padding:8px 16px;background:#7c3aed;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:700;">保存</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){
    if(e.target === modal) _closeUserNoteModal();
  });
}

function _closeUserNoteModal(){
  var modal = document.getElementById('userNoteModal');
  if(modal) modal.style.display = 'none';
}

function _openUserNoteModal(opts){
  _ensureUserNoteModal();
  var modal = document.getElementById('userNoteModal');
  document.getElementById('unModalTitle').textContent = opts.title || '📝 注記';
  document.getElementById('unModalAnchor').textContent = '挿入位置: ' + (opts.anchorPreview || '(未選択)');
  var jaEl = document.getElementById('unModalJa');
  var trEl = document.getElementById('unModalTr');
  jaEl.value = opts.ja || '';
  trEl.value = opts.tr || '';
  modal.style.display = 'flex';
  var okBtn = document.getElementById('unModalOk');
  var newOk = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOk, okBtn);
  newOk.addEventListener('click', function(){
    var ja = jaEl.value.trim();
    var tr = trEl.value.trim();
    if(!ja){ alert('日本語文を入力してください'); jaEl.focus(); return; }
    _closeUserNoteModal();
    if(typeof opts.onSave === 'function') opts.onSave(ja, tr);
  });
  var caBtn = document.getElementById('unModalCancel');
  var newCa = caBtn.cloneNode(true);
  caBtn.parentNode.replaceChild(newCa, caBtn);
  newCa.addEventListener('click', function(){ _closeUserNoteModal(); });
  setTimeout(function(){ jaEl.focus(); }, 100);
}

// 新規注記作成
function createUserNoteInteractive(){
  var anchor = window._selectedAnchor;
  if(!anchor || !document.body.contains(anchor)){
    alert('注記を挿入したい行を書類上でクリックしてから、もう一度「➕ 注記を追加」を押してください。');
    return;
  }
  var anchorInfo = _getAnchorInfo(anchor);
  if(!anchorInfo){
    alert('アンカー位置を特定できませんでした。別の行を選択してください。');
    return;
  }
  _openUserNoteModal({
    title: '📝 新しい注記を追加',
    anchorPreview: '(P' + anchorInfo.page + ') ' + anchorInfo.anchorText.substring(0, 50),
    ja: '',
    tr: '',
    onSave: function(ja, tr){
      var note = {
        id: _generateUserNoteId(),
        ja: ja,
        tr: tr,
        page: anchorInfo.page,
        anchorText: anchorInfo.anchorText,
        anchorIndex: anchorInfo.anchorIndex,
        anchorTag: anchorInfo.anchorTag
      };
      window._userNotes = window._userNotes || [];
      window._userNotes.push(note);
      _renderUserNote(note);
      // アンカー選択解除
      var doc = anchor.ownerDocument;
      doc.querySelectorAll('.__note-anchor-selected').forEach(function(el){
        el.classList.remove('__note-anchor-selected');
      });
      window._selectedAnchor = null;
      if(typeof saveUserNotesOnly === 'function') saveUserNotesOnly();
    }
  });
}

// 注記編集
function editUserNote(noteId){
  var note = (window._userNotes || []).find(function(n){ return n.id === noteId; });
  if(!note) return;
  _openUserNoteModal({
    title: '✏️ 注記を編集',
    anchorPreview: '(P' + note.page + ') ' + (note.anchorText || '').substring(0, 50),
    ja: note.ja || '',
    tr: note.tr || '',
    onSave: function(ja, tr){
      note.ja = ja;
      note.tr = tr;
      _renderUserNote(note);
      if(typeof saveUserNotesOnly === 'function') saveUserNotesOnly();
    }
  });
}

// 注記削除
function deleteUserNote(noteId){
  if(!confirm('この注記を削除しますか？')) return;
  window._userNotes = (window._userNotes || []).filter(function(n){ return n.id !== noteId; });
  var el = document.getElementById('un_' + noteId);
  if(el && el.parentNode) el.parentNode.removeChild(el);
  if(typeof saveUserNotesOnly === 'function') saveUserNotesOnly();
}

window.createUserNoteInteractive = createUserNoteInteractive;
window.editUserNote = editUserNote;
window.deleteUserNote = deleteUserNote;
window.renderAllUserNotes = renderAllUserNotes;

// 注記のみを直接保存する専用関数
async function saveUserNotesOnly(){
  if(typeof sb !== 'function') return;
  var info = window._lastCaseInfo;
  if(!info || !info.companyId) return;
  var idx = info.empSetIdx != null && info.empSetIdx !== '' ? parseInt(info.empSetIdx, 10) : 0;
  if(isNaN(idx)) idx = 0;
  var notes = Array.isArray(window._userNotes) ? window._userNotes : [];
  try{
    // RPCがあれば優先
    var payload = { p_company_id: info.companyId, p_idx: idx, p_notes: notes };
    var res = await sb('rpc/set_emp_set_user_notes', {
      method: 'POST', body: JSON.stringify(payload)
    });
    console.log('[userNotes] saved:', notes.length);
    if(typeof showToast === 'function') showToast('💾 注記を保存しました', 1200);
    return res;
  }catch(e){
    // フォールバック: emp_sets 全体を read-modify-write
    console.warn('[userNotes] RPC failed, fallback:', e);
    try{
      var rows = await sb('companies?select=emp_sets&id=eq.' + encodeURIComponent(info.companyId));
      if(!rows || !rows[0]) return;
      var empSets = rows[0].emp_sets || [];
      if(!empSets[idx]) empSets[idx] = {};
      empSets[idx]._userNotes = notes;
      await sb('companies?id=eq.' + encodeURIComponent(info.companyId), {
        method: 'PATCH', body: JSON.stringify({ emp_sets: empSets })
      });
      if(typeof showToast === 'function') showToast('💾 注記を保存しました', 1200);
    }catch(e2){
      console.error('[userNotes] save failed:', e2);
      if(typeof showToast === 'function') showToast('⚠️ 注記の保存に失敗しました');
    }
  }
}
window.saveUserNotesOnly = saveUserNotesOnly;



// ===== スタイル編集モード =====
let _styleMode = false;
let _styleTarget = null;

// ver.20260801: スタイル編集/位置調整(文字サイズ・移動)をDB保存対象化
function toggleStyleMode(){
  _styleMode = !_styleMode; window._styleMode=_styleMode;
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

function spFont(d){
  if(!_styleTarget) return;
  var cur=parseFloat(getComputedStyle(_styleTarget).fontSize)||12;
  _styleTarget.style.fontSize=(cur+d*(96/72)).toFixed(1)+'px';
  window._styleDirty=true;
}
function spMove(dx,dy){
  if(!_styleTarget) return;
  var el=_styleTarget;
  if(getComputedStyle(el).position==='static'){ el.style.position='relative'; }
  var mm=96/25.4;
  el.style.left=((parseFloat(el.style.left)||0)+dx*mm).toFixed(1)+'px';
  el.style.top=((parseFloat(el.style.top)||0)+dy*mm).toFixed(1)+'px';
  window._styleDirty=true;
}
// スタイル編集モード中は選択要素をドラッグで移動
(function(){
  var drag=null;
  document.addEventListener('mousedown', function(e){
    if(!window._styleMode || !_styleTarget) return;
    if(!e.target.closest('#stylePanel') && (e.target===_styleTarget || _styleTarget.contains(e.target))){
      e.preventDefault();
      if(getComputedStyle(_styleTarget).position==='static'){ _styleTarget.style.position='relative'; }
      drag={sx:e.clientX, sy:e.clientY, l:parseFloat(_styleTarget.style.left)||0, t:parseFloat(_styleTarget.style.top)||0};
    }
  }, true);
  document.addEventListener('mousemove', function(e){
    if(!drag||!_styleTarget) return;
    _styleTarget.style.left=(drag.l+(e.clientX-drag.sx)).toFixed(1)+'px';
    _styleTarget.style.top=(drag.t+(e.clientY-drag.sy)).toFixed(1)+'px';
  }, true);
  document.addEventListener('mouseup', function(){ if(drag){ window._styleDirty=true; } drag=null; }, true);
})();


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
  window._styleDirty=true;
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
    <label>文字: <button type="button" onclick="spFont(-0.5)" style="background:#334155;color:#e2e8f0;border:none;padding:2px 7px;cursor:pointer;">A−</button>
      <button type="button" onclick="spFont(0.5)" style="background:#334155;color:#e2e8f0;border:none;padding:2px 7px;cursor:pointer;">A＋</button></label>
    <span style="color:#64748b;">｜</span>
    <label>位置:
      <button type="button" onclick="spMove(0,-0.5)" style="background:#334155;color:#e2e8f0;border:none;padding:2px 6px;cursor:pointer;">↑</button>
      <button type="button" onclick="spMove(0,0.5)" style="background:#334155;color:#e2e8f0;border:none;padding:2px 6px;cursor:pointer;">↓</button>
      <button type="button" onclick="spMove(-0.5,0)" style="background:#334155;color:#e2e8f0;border:none;padding:2px 6px;cursor:pointer;">←</button>
      <button type="button" onclick="spMove(0.5,0)" style="background:#334155;color:#e2e8f0;border:none;padding:2px 6px;cursor:pointer;">→</button>
      <span style="color:#94a3b8;font-size:10px;">(ドラッグも可)</span></label>
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
  // ver.20260808.05: ジャーナル記録
  try{ dgjLogFromContext('downloadHtml'); }catch(_){}
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
// ver.20260729: 書類別の作成責任者（companies.extra.docAuthors）。項目単位で無ければ既定(author_*)を使う
function getDocAuthor(co, docKey){
  var da = (co && co.extra && co.extra.docAuthors && docKey && co.extra.docAuthors[docKey]) || {};
  return {
    name:    da.name    || (co && co.author_name)     || '',
    title:   da.title   || (co && co.author_title)    || '',
    nameEn:  da.nameEn  || (co && co.author_name_en)  || '',
    titleEn: da.titleEn || (co && co.author_title_en) || ''
  };
}
async function loadCaseToForm(info, docKey, opts){
  // ver.20260825.03: opts.skipFieldRestore=true のとき、es_*/f_* のクリアと
  //   emp_sets からの verbatim 復元をスキップする。
  //   1-6系など独自の loadFromDB/setFormValues が全フィールドを変換込みで
  //   制御する書類では、この共通クリア＆復元が後から走ると
  //   変換済みの値（契約更新・手当別名など）を壊し、タイミング次第で
  //   「賃金がまっさら」「保存したのに反映されない」事故の原因になっていた。
  //   （その状態で保存すると空フィールドが emp_sets からも消える二次被害あり）
  opts = opts || {};
  if(!info||!info.caseId) return;
  // ver.20260717: 直接編集が未保存のまま別の案件に切り替えると編集内容が失われる。
  // 画面は編集後の見た目のままなので気づけないため、切り替える前に確認する。
  // 同じ案件の再読込（言語切替など）では聞かない。
  // ver.20260808.06: 「保存して切り替える」オプションを追加し、うっかり喪失を防ぐ。
  try{
    const _prev = window._lastCaseInfo && window._lastCaseInfo.caseId;
    if(window._editedDirty && _prev && _prev !== info.caseId){
      const _prevCaseId = _prev;
      const _choice = confirm('⚠️ 直接編集した内容がまだ保存されていません。\n案件を切り替える前に自動で保存しますか？\n\n・OK = 保存してから切り替える（推奨）\n・キャンセル = 保存せず切り替える（編集内容は失われます）');
      if(_choice){
        // 保存を試みる
        try{
          if(typeof saveFormGeneric === 'function' && window._empDocKey){
            await saveFormGeneric(window._empDocKey);
            if(typeof showToast === 'function') showToast('✅ 前の案件の編集内容を保存しました');
          }
        }catch(_saveErr){
          if(!confirm('保存に失敗しました。それでも切り替えますか？（編集内容は失われます）')){
            return;
          }
        }
      }
    }
    if(_prev !== info.caseId) clearEditedDirty();
  }catch(e){}
  // ver.20260611: 親から渡されたログイントークンを保持（RLS用）
  try{ if(info.token) window.__OFUSA_SB_TOKEN = info.token; }catch(e){}
  // グローバルに最新の案件情報を保存（DB保存・他機能で使う）
  window._lastCaseInfo = info;
  window._fieldData = {}; // ver.20260612: 案件読込ごとにDBフォールバック値をリセット
  // ver.20260819.06: 入力欄クリアは各書類の SELECT_CASE ハンドラ側で loadFromDB
  //   より先に実行するため、ここでは行わない（ここでクリアするとloadFromDBで
  //   セットされた値まで消えてしまう）。
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
    // ver.20260819.03: 空値もクリアするよう修正。従来は空スキップで前案件の値が
    //   サイドバーに残るバグがあった。ただし _fieldData への保存は続ける（emp_sets
    //   にはあるがサイドバー入力欄が無い項目のフォールバック用）。
    const setValMulti = (ids, val) => {
      const list = Array.isArray(ids) ? ids : [ids];
      const isEmpty = (val===undefined || val===null || String(val)==='');
      let elSet = false;
      for(const id of list){
        // 値が空でなければ _fieldData に保存（空は保存しない = 前値保持）
        if(!isEmpty) window._fieldData[id] = val;
        if(!elSet){
          const el = document.getElementById(id);
          if(el){
            el.value = isEmpty ? '' : val;
            elSet = true;
          }
        }
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
    // ver.20260729.02: 代表者が複数登録されている場合はプルダウンで選択（rep2/rep3対応。1人なら非表示）
    try{ renderRepSelect(co, es); }catch(e){ console.warn('repSelect', e); }

    // 作成責任者（ver.20260729: 書類別の個別設定(extra.docAuthors)があればそちらを優先。空欄は既定author_*）
    var _docKey = window.OFUSA_DOC_KEY || docKey || '';
    var _au = getDocAuthor(co, _docKey);
    setValMulti(['f_author'], [_au.title, _au.name].filter(Boolean).join('　'));
    setValMulti(['es_authorName','f_authorName'], _au.name);
    setValMulti(['es_authorTitle','f_authorTitle'], _au.title);
    setValMulti(['es_authorNameEn','f_authorNameEn'], _au.nameEn);
    setValMulti(['es_authorTitleEn','f_authorTitleEn'], _au.titleEn);

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
    // ver.20260804: 前案件の残存バグ対策。
    //   このループは emp_sets に存在するキーだけをセットするため、次の案件の emp_sets に
    //   手当等のキーが無いと、前案件で入った es_a1Name / es_fixedOT* 等がフォームに残り、
    //   雇用条件書に無い手当や別案件の金額が焼き付く事故が起きていた（三谷総建で発覚）。
    //   対策: ループ直前に「emp_sets由来の es_* フィールドだけ」を一旦クリアしてから再セットする。
    //   ただし氏名・職種・年齢性別経験・作成者/所属機関/代表者/住所など、
    //   案件(cases/persons)由来で既に上でセット済みのフィールドは消してはいけないため除外する。
    //   （消すと emp_sets に同名キーが無い場合に復活せず、逆に空欄事故になる）
    const _ES_SKIP = [
      'applicantName','applicantNameEn',        // 氏名（案件由来・従来からの除外）
      'applicantField','applicantFieldEn',      // 職種/分野（上で案件補完済み）
      'age','gender','experience','exp',        // persons由来
      'authorName','authorNameEn','authorTitle','authorTitleEn', // 作成者
      'orgName','orgNameEn','orgAddress','orgAddressEn','orgTel', // 所属機関
      'repName','repNameEn','repTitle','repTitleEn',              // 代表者
      'company','companyEn','address','addressEn','tel',         // 会社・住所・電話
      'createY','createM','createD',                             // 作成日(emp_sets/doc_create_date由来。後続の作成日処理が扱う)
      'docYear','docMonth','docDay','docDate',                    // 作成日の別ペア(f_*)。クリアすると作成日が今日に化ける
      // ver.20260811.02: 契約期間・入国予定日はcases.contract_start/end・persons.entry_date由来（案件由来）で、
      //   独自loadFromDB(1_6.html等)がY/M/Dに分割して先にセット済み。ここでクリアすると空欄事故になる。
      'contractStartY','contractStartM','contractStartD',
      'contractEndY','contractEndM','contractEndD',
      'entryY','entryM','entryD'
    ];
    // ★ クリア: フォーム上に存在する es_* / f_* 入力欄のうち、_ES_SKIP を除いて空にする。
    //   これで前案件の手当・控除・賃金・契約期間などの残存を消してから、
    //   今の案件の emp_sets で上書きし直す（キーが無ければ空のままになる＝正しい挙動）。
    if(!opts.skipFieldRestore)
    try {
      var _clrEls = document.querySelectorAll('[id^="es_"],[id^="f_"]');
      for (var _ci = 0; _ci < _clrEls.length; _ci++) {
        var _el = _clrEls[_ci];
        var _id = _el.id || '';
        var _key = _id.replace(/^es_/, '').replace(/^f_/, '');
        if (_ES_SKIP.indexOf(_key) !== -1) continue; // 案件由来は温存
        if (_el.tagName === 'INPUT' || _el.tagName === 'TEXTAREA' || _el.tagName === 'SELECT') {
          _el.value = '';
        }
      }
    } catch(_clrErr) { console.warn('[doc] es_* クリア失敗:', _clrErr); }

    // ver.20260811: 8/9のb289ab7で loadFromDB → loadCaseToForm の順に変更した際、
    //   ofusa_common.js側は emp_set のキーをそのまま es_<キー> に流すだけで別名対応が無く、
    //   loadFromDB(独自)がsetFormValues()で埋めた 1-6等の欄が総当たりループ(下)で
    //   上書き/焼付けされ、officeAddress・officeTel・weekly/monthly/yearlyMin・
    //   contractStartY/M/D・contractEndY/M/D 等が空欄になる不具合が発生していた。
    //   1_6.html の _FORM_TO_DB / setFormValues と同じ別名対応をここでも行い、
    //   総当たりループの前に「テンプレのプレースホルダ名」の側にも同時に値を入れる。
    const _ALIAS_DB2FORM = {
      officeAddr:'officeAddress', officeAddrEn:'officeAddressEn',
      officeContact:'officeTel',
      weeklyMins:'weeklyMin', weeklyMinsEn:'weeklyMinEn',
      monthlyMins:'monthlyMin', monthlyMinsEn:'monthlyMinEn',
      yearlyMins:'yearlyMin', yearlyMinsEn:'yearlyMinEn',
      totalMonthly:'salaryTotal',
      otRate60:'ot60under', otRate60En:'ot60underEn',
      otRate60over:'ot60over', otRate60overEn:'ot60overEn',
      otRateOver:'otPrescribed', otRateOverEn:'otPrescribedEn',
      nightRate:'nightPremium', nightRateEn:'nightPremiumEn',
      holidayRateLegal:'holidayLegal', holidayRateLegalEn:'holidayLegalEn',
      holidayRateNon:'holidayNonLegal', holidayRateNonEn:'holidayNonLegalEn',
      bonusCond:'bonusCondition', bonusCondEn:'bonusConditionEn',
      salaryRaiseCond:'raiseCondition', salaryRaiseCondEn:'raiseConditionEn',
      /* ver.20260819.08: 重要事項説明書(juuyou_*.html)用のフィールド名マッピング追加。
         従来はこれらが未マッピングで、案件を開くたびに空欄になり、
         毎回手入力が必要だった不具合の修正。 */
      category:'workType', categoryEn:'workTypeEn',
      category2:'workCat', category2En:'workCatEn',
      foreignerJobDesc:'workDetail', foreignerJobDescEn:'workDetailEn',
      payCutoffDay:'payCutoff', payCutoffDayEn:'payCutoffEn',
      otherHoliday:'otherHolidays',
      deductSocial:'deductSocialIns', deductEmployment:'deductEmpIns'
    };
    const _splitYMD = (v) => {
      if(v==null || String(v)==='') return null;
      const m = String(v).match(/(\d{4})[-\/年\.](\d{1,2})[-\/月\.](\d{1,2})/);
      return m ? {y:m[1], m:String(parseInt(m[2],10)), d:String(parseInt(m[3],10))} : null;
    };
    if(!opts.skipFieldRestore) Object.keys(es).forEach(k => {
      if(_ES_SKIP.includes(k)) return;
      setValMulti(['es_'+k, 'f_'+k], es[k]);
      // 別名にも同じ値を橋渡し（テンプレ側のプレースホルダ名）
      const alias = _ALIAS_DB2FORM[k];
      if(alias) setValMulti(['es_'+alias, 'f_'+alias], es[k]);
      // ver.20260821.04: 手当の動的別名（allowanceN* → es_aN*）。
      //   1-6号のフォームIDは es_a1Name〜es_a6CalcEn だが、emp_setのキーは
      //   allowance1Name〜allowance6CondEn。上のes_*全クリア後にここで流し込まないと、
      //   独自loadFromDB(setFormValues)とのタイミング次第で手当欄が空になる
      //   （contractRenewalと同型のrace。ver.20260821.03参照）。①〜⑥全対応。
      const _am = k.match(/^allowance(\d)(Name|NameEn|Amt|Amount|Cond|CondEn)$/);
      if(_am){
        const _pm = {Name:'Name',NameEn:'NameEn',Amt:'Amt',Amount:'Amt',Cond:'Calc',CondEn:'CalcEn'};
        setValMulti(['es_a'+_am[1]+(_pm[_am[2]]||_am[2])], es[k]);
      }
      // 単一日付 → Y/M/D 分割（"2026-08-20"・"2026年8月20日"両対応）
      if(k === 'contractStart' || k === 'contractEnd'){
        const ymd = _splitYMD(es[k]);
        if(ymd){
          setValMulti(['es_'+k+'Y'], ymd.y);
          setValMulti(['es_'+k+'M'], ymd.m);
          setValMulti(['es_'+k+'D'], ymd.d);
        }
      }
    });

    // ver.20260821.03: 契約更新の有無（contractRenewal → es_renewal）の値変換。
    //   上のes_*全クリア後、emp_setに'renewal'キーが無い（Saysay側で未保存の）ケースでは
    //   es_renewal(select)が空のままになり、1-6号の「２．契約の更新の有無」の
    //   チェックが一切付かない不具合があった（例: case_1784697558628）。
    //   1_6.html の setFormValues と同じ変換をここでも行い、案シスの日本語値
    //   （"更新する場合があり得る"等）を select の value に変換してセットする。
    if(!opts.skipFieldRestore && es.contractRenewal){
      const _rv = String(es.contractRenewal);
      const _renewMap = {'自動':'auto','possible':'possible','更新する場合':'possible','なし':'none','none':'none'};
      const _mapped = _renewMap[_rv] || (_rv.includes('自動') ? 'auto' : (_rv.includes('可能')||_rv.includes('あり')) ? 'possible' : 'none');
      setValMulti(['es_renewal'], _mapped);
    }

    // ver.20260819.08: 重要事項説明書(juuyou_*.html) 専用のフィールド名別名対応。
    //   juuyou は独自のフィールド名 (f_raiseCond/f_raiseCondEn) を使うため、
    //   共通の _ALIAS_DB2FORM (エイリアス名=1つ) では対応できない。
    //   ここで juuyou 用エイリアスを追加で橋渡しする。
    //   1_6.html 等の既存書類には影響しない (別の入力欄IDのため)。
    const _JUUYOU_ALIAS = {
      salaryRaiseCond: 'raiseCond', salaryRaiseCondEn: 'raiseCondEn'
    };
    Object.keys(_JUUYOU_ALIAS).forEach(dbKey => {
      const alias = _JUUYOU_ALIAS[dbKey];
      if(es[dbKey] != null && String(es[dbKey]) !== ''){
        setValMulti(['f_'+alias], es[dbKey]);
      }
    });
    // applicantField / applicantFieldEn は単純除去
    ['applicantField','applicantFieldEn'].forEach(k=>{
      const raw=(window._fieldData&&window._fieldData['es_'+k])||'';
      if(raw) setValMulti(['es_'+k,'f_'+k], _stripP(raw));
    });
    // category / categoryEn は括弧除去＋カンマ区切りで category2 に分割
    // ver.20260806: category2/category2En に生値（例「建築（建設分野・特定技能１号）」）が
    //   そのまま残り、サイドバーで消しても復活する不具合を修正。2つ目は
    //   「categoryのカンマ2件目」を優先し、無ければ別フィールドcategory2を括弧除去して採用。
    //   どちらも無ければ空にして生値の残存を防ぐ。
    ['category','categoryEn'].forEach(k=>{
      const raw=(window._fieldData&&window._fieldData['es_'+k])||'';
      const raw2=(window._fieldData&&window._fieldData['es_'+k+'2'])||'';
      const parts=raw.split(/[,、]\s*/).map(s=>_stripP(s)).filter(Boolean);
      setValMulti(['es_'+k,'f_'+k], parts[0]||'');
      const second = (parts.length>1) ? parts[1] : _stripP(raw2);
      setValMulti(['es_'+k+'2','f_'+k+'2'], second||'');
    });

    // ver.20260818.02: 案シスから渡される es.deductXxxType(boolean) を、
    //   既存の実費フラグ UI(チェックボックス es_deductXxxJippi + hidden es_deductXxxEst)に
    //   橋渡しする。これで案シスの実費チェックONの項目が書類の「（実費）」表記に反映される。
    //   ver.20260818.03: undefined/null/欠損キー は「無処理」で既存の saysay 側設定を維持。
    //   案シス側は OFF時にキーごと delete する仕様(ver.20260818.08)のため、
    //   キー未定義=既存維持、true=実費ON、false=実費OFFの三値扱いとなる。
    const _JIPPI_TYPE_MAP = {
      deductFoodType:    'deductFood',
      deductHousingType: 'deductHousing',
      deductUtilityType: 'deductUtility',
      deductOther1Type:  'deductOther1Amount',
      deductOther2Type:  'deductOther2Amount'
    };
    Object.keys(_JIPPI_TYPE_MAP).forEach(function(typeKey){
      // hasOwnProperty で判定(undefined 明示スキップ)。案シス側で削除された案件は
      // ここに来ないので既存 saysay 状態を維持
      if(!Object.prototype.hasOwnProperty.call(es, typeKey)) return;
      var val = es[typeKey];
      if(val === undefined || val === null) return;
      var isJippi = (val === true || val === 'true' || val === 1 || val === '1');
      var base = 'es_' + _JIPPI_TYPE_MAP[typeKey];
      var cb  = document.getElementById(base + 'Jippi');
      var est = document.getElementById(base + 'Est');
      // dataset.jippiInit=1 を立てておくと _syncJippi の初期化ロジックがスキップされ、
      // ここでセットした状態が保持される
      if(cb){ cb.checked = isJippi; cb.dataset.jippiInit = '1'; }
      if(est){ est.value = isJippi ? '実費' : ''; }
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
  // 会社情報の金額(売上高・資本金)
  /^(es_|f_)?sales$/i,
  /^(es_|f_)?capital$/i,
  /^f_gSal$/,
  /^f_gDpCap$/,
  /^f_gDpSales$/,
  /^f_pay$/,          // 月額報酬(変更様式)
  /^f_payH$/,         // 時給換算
  /^f_payJp$/,        // 日本人月額報酬
  /^f_fee$/,          // 支援委託手数料
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
      if(window._htmlFrozen || (typeof _editMode !== 'undefined' && _editMode) || window._styleDirty){
        const _area = document.getElementById('pageArea');
        if(_area && info.caseId){
          const _edKey = ((location.pathname.split('/').pop()||docKey).replace(/\.html.*$/,'')) || docKey;
          if(!extra['_edited']) extra['_edited'] = {};
          if(!extra['_edited'][_edKey]) extra['_edited'][_edKey] = {};
          // ver.20260808.07: 共通ヘルパーgetBindResetHtml()でプレースホルダ化
          //   別案件を開いた際にその案件のフォーム値が焼き込まれず、
          //   applyBindings()で正しい変数値が流れるようにする
          extra['_edited'][_edKey][info.caseId] = { 
            html: (typeof getBindResetHtml==='function' ? getBindResetHtml() : _area.innerHTML),
            _savedAt: new Date().toISOString(),
            _schemaVer: 2  // ver.20260808.06+ フォーマット（data-bindプレースホルダ化済み）
          };
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
    // ver.20260808.05: ジャーナル記録（docKey は saveFormGeneric の第1引数から）
    try{ dgjLog(docKey, DGJ_DOC_LABELS_JS[docKey]||docKey, {note:'DB保存', language:_dgjInferLang()}); }catch(_){}
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
        // ver.20260808.06: 復元中フラグを立てて他の書き換えをブロック
        window._editedRestoring = true;
        _area.innerHTML = _ed.html;
        window._htmlFrozen = true; window._editedRestored = true;
        // ver.20260801: 直接編集版を復元した後も、変数欄(data-bind)は最新のサイド値で上書きする。
        // これを呼ばないと、直接編集スナップショットの古い焼き込み値が残り、
        // 後からのサイド編集が反映されず「消えた」ように見える（ファイル呼出 loadEditedHTML と挙動統一）。
        if(typeof applyBindings === 'function') applyBindings();
        // ver.20260808.06: 金額整形も再適用
        try{ if(typeof applyMoneyFormatting === 'function') applyMoneyFormatting(); }catch(_){}
        window._editedRestoring = false;
        if(typeof showToast === 'function'){
          const _when = _ed._savedAt ? new Date(_ed._savedAt) : null;
          const _label = _when ? ('📝 直接編集版を復元しました ('+ _when.toLocaleString('ja-JP', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) +')') : '📝 直接編集版を復元しました';
          showToast(_label);
        }
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
        '<button id="_emOver" style="display:block;width:100%;text-align:left;margin-bottom:8px;padding:11px 12px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;border-radius:8px;cursor:pointer;font-size:13px;line-height:1.5;">♻️ 元の雇用条件セットを上書き<br><span style="font-size:11px;color:#b45309;">'+cntTxt+'</span></button>'+
        '<button id="_emNew" style="display:block;width:100%;text-align:left;margin-bottom:14px;padding:11px 12px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;border-radius:8px;cursor:pointer;font-size:13px;line-height:1.5;">🆕 新しい雇用条件セットとして作成し、この案件に紐付け<br><span style="font-size:11px;color:#475569;">他の案件には影響しません</span></button>'+
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

/* 休日日数の妥当性チェック（PDFのAI読取ミス対策）
   「週当たり休日数」に労働時間(例39.8)や年間休日(例77)が誤って入るケースが実在するため、
   ありえない値は書類に出さない。週は7日、月は31日が上限。
   数値でない記述（「シフトによる」等）はそのまま通す。 */
function _holidayDaysOK(val, max){
  var s = String(val == null ? '' : val).trim();
  if(!s) return false;
  if(!/^[0-9]+(\.[0-9]+)?$/.test(s)) return true;   // 数値以外の記述は判定しない
  var n = parseFloat(s);
  return n > 0 && n <= max;
}
function isWeeklyHolidayOK(id){ return _holidayDaysOK(v(id), 7); }
function isMonthlyHolidayOK(id){ return _holidayDaysOK(v(id), 31); }

// ===== ver.20260729.02: 代表者プルダウン（rep2/rep3対応） =====
// 会社マスタに代表者②③が登録されている場合、書類右上にプルダウンを出してどの代表者名で出すか選べる。
// 1人だけの会社は非表示（従来どおり代表者①を自動適用）。選択は localStorage（書類×会社ごと）に保存・復元。
function getRepList(co){
  var list=[];
  [['','①'],['2','②'],['3','③']].forEach(function(p){
    var nm=co['rep'+p[0]+'_name'];
    if(nm) list.push({ no:(p[0]||'1'), label:'代表者'+p[1]+'：'+nm,
      name:nm, title:co['rep'+p[0]+'_title']||'', nameEn:co['rep'+p[0]+'_name_en']||'', titleEn:co['rep'+p[0]+'_title_en']||'' });
  });
  return list;
}
function applyRepSelect(no){
  var co=window._ofusaRepCo, es=window._ofusaRepEs||{};
  if(!co) return;
  var list=getRepList(co);
  var pick=null;
  for(var i=0;i<list.length;i++){ if(list[i].no===String(no)){ pick=list[i]; break; } }
  if(!pick) pick=list[0]||{name:co.rep_name||'',title:co.rep_title||'',nameEn:co.rep_name_en||'',titleEn:co.rep_title_en||''};
  // ✏️直接編集(es)で手動上書きされている項目は尊重する
  setValMulti(['es_repName','f_repName'], es.repName || pick.name);
  setValMulti(['es_repTitle','f_repTitle'], es.repTitle || pick.title);
  setValMulti(['es_repNameEn','f_repNameEn'], es.repNameEn || pick.nameEn);
  setValMulti(['es_repTitleEn','f_repTitleEn'], es.repTitleEn || pick.titleEn);
}
function renderRepSelect(co, es){
  window._ofusaRepCo=co; window._ofusaRepEs=es||{};
  var list=getRepList(co);
  var docKey=window.OFUSA_DOC_KEY || location.pathname.split('/').pop().replace(/\.html.*$/,'');
  var lsKey='ofusa_repsel_'+docKey+'_'+(co.id||'');
  var old=document.getElementById('ofusaRepSelectBar');
  if(list.length<2){ if(old) old.remove(); return; } // 1人以下 → プルダウン非表示（①が自動適用済み）
  var saved=localStorage.getItem(lsKey)||'1';
  if(!list.some(function(x){return x.no===saved;})) saved='1';
  applyRepSelect(saved);
  var bar=old;
  if(!bar){
    bar=document.createElement('div');
    bar.id='ofusaRepSelectBar';
    bar.style.cssText='position:fixed;top:8px;right:8px;z-index:9999;background:#eff6ff;border:1.5px solid #93c5fd;border-radius:8px;padding:6px 10px;font-size:12px;color:#1e40af;box-shadow:0 4px 12px rgba(0,0,0,.15);';
    document.body.appendChild(bar);
    var st=document.createElement('style');
    st.textContent='@media print{#ofusaRepSelectBar{display:none!important;}}';
    document.head.appendChild(st);
  }
  bar.innerHTML='👤 代表者: <select onchange="localStorage.setItem(\''+lsKey+'\',this.value);applyRepSelect(this.value);" style="font-size:12px;padding:2px 6px;border:1px solid #93c5fd;border-radius:5px;background:white;">'
    + list.map(function(x){ return '<option value="'+x.no+'"'+(x.no===saved?' selected':'')+'>'+x.label.replace(/</g,'&lt;')+'</option>'; }).join('')
    + '</select>';
}
// ===== /代表者プルダウン =====

/* ===== マスター（テンプレ座標）編集：端末ゲート＆書き出し ver.20260806.02 =====
   位置調整ツールは「この端末に印がある人（＝あなた）だけ」表示する。
   印の付与/解除: URLに ?master=on / ?master=off（Saysay外で一度開けばOK。
   Saysayのiframeは同一オリジンなのでlocalStorageが共有され、Saysay内でもボタンが出る）。
   書き出し: 現在適用中(ドラッグ後)の .av 座標をそのまま絶対mmとして出力し、
   Claudeがソースへ焼き込む→全案件共通テンプレ位置になる。 */
function ofusaMasterGate(){
  try{
    var qs=new URLSearchParams(location.search);
    if(qs.get('master')==='on'){ try{localStorage.setItem('ofusaMasterEdit','1');}catch(_){}
      if(typeof showToast==='function') showToast('🔑 マスター編集モードON（この端末のみ）'); }
    if(qs.get('master')==='off'){ try{localStorage.removeItem('ofusaMasterEdit');}catch(_){}
      if(typeof showToast==='function') showToast('マスター編集モードOFF'); }
  }catch(_e){}
  var on=false; try{ on=localStorage.getItem('ofusaMasterEdit')==='1'; }catch(_){}
  var b=document.getElementById('adjModeBtn'); if(b) b.style.display=on?'':'none';
  var x=document.getElementById('tplExportBtn'); if(x) x.style.display=on?'':'none';
  return on;
}
window.ofusaMasterGate=ofusaMasterGate;
window._isMasterEdit=function(){ try{ return localStorage.getItem('ofusaMasterEdit')==='1'; }catch(_){ return false; } };

window.ofusaExportTplCoords=function(docKey){
  var store=document.getElementById('f__adjust');
  var A={}; try{ A=JSON.parse((store&&store.value)||'{}'); }catch(_){}
  var keys=Object.keys(A);
  if(!keys.length){ alert('調整された欄がありません。\n「🔧位置調整」でドラッグしてから書き出してください。'); return; }
  var out={_doc:docKey||'', fields:{}};
  keys.forEach(function(k){
    var el=document.querySelector('.doc .av[data-f="'+k+'"]');
    if(!el){ out.fields[k]={note:'element-not-found', d:A[k]}; return; }
    var L=parseFloat(el.style.left), T=parseFloat(el.style.top), S=parseFloat(el.style.fontSize);
    var o={ d:A[k] };
    if(!isNaN(L)) o.left=+L.toFixed(2);
    if(!isNaN(T)) o.top=+T.toFixed(2);
    if(!isNaN(S)) o.fs=+S.toFixed(1);
    // ver.20260808.08: 寄せ方を出力（元と違う場合のみ）
    var _cur = el.getAttribute('data-align') || (/translateX\(-50%\)/.test(el.style.transform||'') ? 'center' : 'left');
    var _base = el.dataset.ba || 'center';
    if(_cur !== _base) o.align = _cur;
    out.fields[k]=o;
  });
  var txt=JSON.stringify(out,null,2);
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;';
  var box=document.createElement('div');
  box.style.cssText='background:#fff;max-width:680px;width:92%;max-height:82vh;overflow:auto;border-radius:12px;padding:18px;font-family:sans-serif;';
  var h=document.createElement('div'); h.style.cssText='font-weight:800;font-size:15px;margin-bottom:8px;'; h.textContent='📐 テンプレ座標の書き出し';
  var p=document.createElement('div'); p.style.cssText='font-size:12.5px;color:#444;margin-bottom:10px;line-height:1.6;';
  p.textContent='この内容をコピーして Claude に貼り付けてください。ソース座標へ焼き込み→全案件共通のテンプレ位置に反映します。';
  var ta=document.createElement('textarea'); ta.readOnly=true;
  ta.style.cssText='width:100%;height:320px;font-family:monospace;font-size:12px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;box-sizing:border-box;';
  ta.value=txt;
  var row=document.createElement('div'); row.style.cssText='margin-top:10px;display:flex;gap:8px;justify-content:flex-end;';
  var cp=document.createElement('button'); cp.textContent='コピー'; cp.style.cssText='padding:6px 14px;background:#16a34a;color:#fff;border:none;border-radius:8px;cursor:pointer;';
  var cl=document.createElement('button'); cl.textContent='閉じる'; cl.style.cssText='padding:6px 14px;background:#64748b;color:#fff;border:none;border-radius:8px;cursor:pointer;';
  cp.onclick=function(){ ta.select(); try{ navigator.clipboard.writeText(txt); }catch(_){ try{document.execCommand('copy');}catch(__){} } cp.textContent='コピーしました'; };
  cl.onclick=function(){ ov.remove(); };
  ov.onclick=function(e){ if(e.target===ov) ov.remove(); };
  row.appendChild(cp); row.appendChild(cl);
  box.appendChild(h); box.appendChild(p); box.appendChild(ta); box.appendChild(row);
  ov.appendChild(box); document.body.appendChild(ov); ta.select();
};

if(document.readyState!=='loading') ofusaMasterGate();
else document.addEventListener('DOMContentLoaded', ofusaMasterGate);
/* ===== /マスター編集ゲート＆書き出し ===== */

/* ===== ver.20260831.01: 共通翻訳機能（全書類） =====
 * 翻訳欄（ID末尾 "En" で、対応する日本語欄 = "En" を外したIDが存在するもの）を自動検出し、
 * Edge Function translate-fields（Gemini）で書類の言語に一括翻訳して流し込む。
 * ・翻訳欄の横の 🌐 ボタンで、その項目だけ翻訳する（一括翻訳・自動翻訳はしない）
 * ・翻訳結果は入力欄に入るだけなので、各書類の 💾DB保存 で従来どおり emp_sets 等に保存される
 * ・翻訳欄が1つも無い書類（日本語のみの様式）ではボタンを出さない
 */
(function(){
  function _docLang(){
    try{
      var m = (location.pathname.split('/').pop()||'').match(/_(en|vi|th|ne|my|km|ko|zh|id)\.html$/i);
      if(m) return m[1].toLowerCase();
      var h = (document.documentElement.getAttribute('data-lang')||'').toLowerCase();
      if(h) return h;
    }catch(e){}
    return 'id'; // 無印ファイル（1_6.html 等）はインドネシア語版
  }
  var LANG_JA = {id:'インドネシア語',en:'英語',vi:'ベトナム語',th:'タイ語',ne:'ネパール語',my:'ミャンマー語',km:'クメール語',ko:'韓国語',zh:'中国語'};
  function _pairs(){
    var out=[];
    document.querySelectorAll('input[id$="En"],textarea[id$="En"]').forEach(function(en){
      var jaId = en.id.slice(0,-2);
      var ja = document.getElementById(jaId);
      if(!ja) return;
      if(ja.tagName==='SELECT') return;
      out.push({en:en, ja:ja});
    });
    return out;
  }
  async function _callTranslate(lang, items){
    var url = SB_URL + '/functions/v1/translate-fields';
    var r = await fetch(url, {method:'POST', headers:{
      'apikey': SB_KEY, 'Authorization':'Bearer '+(typeof _sbToken==='function'?_sbToken():SB_KEY), 'Content-Type':'application/json'
    }, body: JSON.stringify({lang:lang, items:items, context:(document.title||'')})});
    var j = await r.json().catch(function(){return {};});
    if(!r.ok || j.error) throw new Error(j.message||('HTTP '+r.status));
    return j.items||[];
  }
  window.translateEmptyFields = async function(onlyKey){
    var lang = _docLang();
    var pairs = _pairs().filter(function(p){
      if(onlyKey && p.en.id!==onlyKey) return false;
      var jaV = String(p.ja.value||'').trim();
      var enV = String(p.en.value||'').trim();
      if(!jaV) return false;
      if(onlyKey) return true;        // 個別ボタンは上書き可（明示操作）
      return !enV;                    // 一括は未翻訳のみ
    });
    if(!pairs.length){ if(typeof showToast==='function') showToast('日本語欄が空のため翻訳できません'); return; }
    try{
      var items = pairs.map(function(p){ return {key:p.en.id, text:p.ja.value}; });
      var res = await _callTranslate(lang, items);
      var n=0;
      res.forEach(function(it){
        var el=document.getElementById(it.key);
        if(el && it.translation){ el.value=it.translation; n++; el.style.background='#fef9c3'; setTimeout(function(){ el.style.background=''; },2500); }
      });
      if(typeof p==='function'){ try{ p(); }catch(e){} }
      if(typeof showToast==='function') showToast('🌐 '+(LANG_JA[lang]||lang)+'に翻訳しました（内容を確認してDB保存してください）');
    }catch(e){
      if(typeof showToast==='function') showToast('⚠️ 翻訳エラー: '+e.message); else alert('翻訳エラー: '+e.message);
    }
  };
  function _inject(){
    var pairs=_pairs();
    if(!pairs.length) return;
    // 一括翻訳ボタンは設けない（表示中の項目を個別に翻訳する運用）
    // 各翻訳欄の横に小ボタン（個別に翻訳し直す）
    pairs.forEach(function(pr){
      if(pr.en.parentElement && !pr.en.parentElement.querySelector('.tr-mini')){
        var s=document.createElement('button');
        s.type='button'; s.className='tr-mini'; s.textContent='🌐'; s.title='この欄だけ翻訳（上書き）';
        s.style.cssText='margin-left:4px;font-size:10px;padding:1px 5px;border:1px solid #cbd5e1;border-radius:4px;background:#f8fafc;cursor:pointer;vertical-align:middle;';
        s.onclick=function(ev){ ev.preventDefault(); window.translateEmptyFields(pr.en.id); };
        pr.en.insertAdjacentElement('afterend', s);
      }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(_inject,300); });
  else setTimeout(_inject,300);
})();
