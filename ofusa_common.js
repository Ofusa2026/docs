/**
 * ofusa_common.js - OFUSA書類作成システム 共通モジュール
 * ver.20260415.09
 */

// ===== Supabase =====
const SB_URL='https://ehwlgbwpycglmopiqyty.supabase.co';
const SB_KEY='sb_publishable_3ptyILIpGIcNA5sUBhFMbA_n0VxpY2u';
async function sb(path,opts={}){
  const r=await fetch(SB_URL+'/rest/v1/'+path,{headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json',...(opts.headers||{})},...opts});
  const t=await r.text();
  if(!r.ok){const e=t?JSON.parse(t):{};throw new Error(e.message||e.hint||('HTTP '+r.status));}
  return t?JSON.parse(t):null;
}

// ===== ユーティリティ =====
const esc=s=>s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):'';
const v=id=>document.getElementById(id)?.value||'';
const fmt=n=>n?Number(String(n).replace(/,/g,'')).toLocaleString('ja-JP'):'';
const f=id=>{const raw=v(id);const val=esc(raw).replace(/\n/g,'<br>');const label=id.replace(/^es_/,'es.').replace(/^f_/,'');return val?`<span class="f">${val}</span>`:`<span class="f" style="color:#aaa;font-size:0.85em;font-family:monospace;">${label}</span>`;};
const ff=id=>{const raw=v(id);const label=id.replace(/^es_/,'es.').replace(/^f_/,'');if(raw){const num=Number(String(raw).replace(/,/g,''));return`<span class="f">${isNaN(num)?esc(raw):num.toLocaleString('ja-JP')}</span>`;}return`<span class="f" style="color:#aaa;font-size:0.85em;font-family:monospace;">${label}</span>`;};

// ===== チェックボックス =====
window.cbState=window.cbState||{};
let _cbSeq=0;
function resetCbSeq(){_cbSeq=0;}
const cb=(on,id)=>{const state=id&&window.cbState[id]!==undefined?window.cbState[id]:on;return`<span class="cb-click" onclick="toggleCb('${id||''}')" data-cbid="${id||''}">${state?'■':'□'}</span>`;};
function toggleCb(id){if(!id)return;window.cbState[id]=!window.cbState[id];document.querySelectorAll(`[data-cbid="${id}"]`).forEach(el=>{el.textContent=window.cbState[id]?'■':'□';});}

// ===== 印刷・トースト =====
function doPrint(){window.print();}
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
    // 編集モードOFF時はp()を呼ばない（直接編集内容を維持）
  }
}
function enableDocEditing(on){
  const area=document.getElementById('pageArea');
  if(!area)return;
  area.querySelectorAll('.doc').forEach(doc=>{
    if(on){
      doc.setAttribute('contenteditable','true');
      doc.classList.add('doc-editable');
      doc.querySelectorAll('.cb-click').forEach(cb=>cb.setAttribute('contenteditable','false'));
      // 変数ラベル（未入力フィールド）を空にする
      doc.querySelectorAll('.f[style*="color:#aaa"]').forEach(el=>{el.textContent='';el.style='';});
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
function filterCases(){const orgV=(document.getElementById('filterOrg')||{}).value||'';const coV=(document.getElementById('filterCompany')||{}).value||'';const txtV=((document.getElementById('filterText')||{}).value||'').trim().toLowerCase();rebuildCompanyList(orgV);const words=txtV?txtV.split(/\s+/).filter(Boolean):[];let filtered=_allCases.filter(r=>{if(orgV&&(r.org||'')!==orgV)return false;if(coV&&(r.company||'')!==coV)return false;if(words.length){const hay=((r.name||'')+' '+(r.applicant||'')+' '+(r.company||'')+' '+(r.org||'')).toLowerCase();if(!words.every(w=>hay.includes(w)))return false;}return true;});const sel=document.getElementById('caseSelect');const cnt=document.getElementById('caseCount');const MAX=200;if(filtered.length>MAX&&!coV&&!words.length){sel.innerHTML='<option value="">← 登録支援機関・所属機関で絞り込むか、名前を入力してください</option>';sel.disabled=true;if(cnt)cnt.textContent='('+filtered.length+'件・絞り込んでください)';return;}sel.disabled=false;const prev=sel.value;sel.innerHTML='<option value="">── 選択 ──</option>';const frag=document.createDocumentFragment();filtered.forEach(r=>{const o=document.createElement('option');o.value=JSON.stringify({caseId:r.id,companyId:r.company_id,companyName:r.company||'',empSetIdx:r.emp_set_idx,applicantField:r.applicant_field||'',applicantFieldEn:r.applicant_field_en||''});o.textContent=(r.applicant||r.name||'(名前なし)')+'　('+(r.company||'')+')';frag.appendChild(o);});sel.appendChild(frag);if(cnt)cnt.textContent='('+filtered.length+'件)';if(prev)sel.value=prev;}

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
          // 入力フォームの値を復元
          if(data.formData){
            Object.entries(data.formData).forEach(([id,val])=>{
              const el = document.getElementById(id);
              if(el) el.value = val;
            });
          }
        }catch(err){
          area.innerHTML = text;
        }
      } else {
        // 旧形式（.html）
        area.innerHTML = text;
      }
      // 編集モードをONに
      _editMode = true;
      const btn = document.getElementById('editModeBtn');
      if(btn){ btn.textContent='✏️ 編集中（クリックで終了）'; btn.classList.add('edit-mode-on'); }
      enableDocEditing(true);
      showToast('📂 読み込みました');
    };
    reader.readAsText(file);
  };
  input.click();
}

// ===== 署名依頼 =====
async function sendSignRequest(){
  const area = document.getElementById('pageArea');
  if(!area){ showToast('⚠️ プレビューがありません'); return; }

  // 署名フィールドがあるか確認
  const signFields = area.querySelectorAll('.sign-field');
  if(!signFields.length){ showToast('⚠️ 署名フィールドがありません'); return; }

  // HTMLを取得
  const html = area.innerHTML;

  // トークン生成
  const token = crypto.randomUUID();

  // 案件ID取得
  const sel = document.getElementById('caseSelect');
  let caseId = '';
  if(sel && sel.value){
    try{ caseId = JSON.parse(sel.value).caseId || ''; }catch(e){}
  }

  // doc_type
  const docTitle = document.getElementById('docTitle')?.textContent || 'doc';

  try{
    const res = await sb('sign_requests', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        case_id: caseId,
        token: token,
        doc_type: docTitle.trim(),
        doc_content: html,
        status: 'pending',
        expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
      })
    });

    // URLをクリップボードにコピー
    const url = `https://ofusa2026.github.io/docs/sign.html?token=${token}`;
    await navigator.clipboard.writeText(url);
    showToast('✅ 署名依頼URLをコピーしました');
    console.log('署名URL:', url);
  }catch(e){
    showToast('⚠️ 署名依頼エラー: ' + e.message);
    console.error(e);
  }
}

/* ==========================================================
   汎用: 親index.htmlからのSELECT_CASE受信＆案件データ展開
   各書類の入力欄プレフィックスに幅広く対応
   (es_*, f_*, 接頭辞なし) すべて試して存在するものだけセット
   ========================================================== */
async function loadCaseToForm(info){
  if(!info||!info.caseId) return;
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

    // 入力欄にセット：複数のID候補を試して存在するものにセット
    const setValMulti = (ids, val) => {
      if(val===undefined || val===null || String(val)==='') return;
      const list = Array.isArray(ids) ? ids : [ids];
      for(const id of list){
        const el = document.getElementById(id);
        if(el){ el.value = val; break; }
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

    // 性別・年齢・経験（persons由来）
    setValMulti(['f_age','es_age'], pd.age);
    setValMulti(['f_gender','es_gender'], pd.gender);
    setValMulti(['f_exp','es_experience','es_exp'], pd.experience);

    // === emp_sets 全フィールドを自動で es_xxx / f_xxx にセット ===
    Object.keys(es).forEach(k => {
      setValMulti(['es_'+k, 'f_'+k], es[k]);
    });

    // === 作成日 ===
    const n = new Date();
    if(isEmpty(['es_createY','f_createY','f_docYear'])) setValMulti(['es_createY','f_createY','f_docYear'], String(n.getFullYear()));
    if(isEmpty(['es_createM','f_createM','f_docMonth'])) setValMulti(['es_createM','f_createM','f_docMonth'], String(n.getMonth()+1));
    if(isEmpty(['es_createD','f_createD','f_docDay'])) setValMulti(['es_createD','f_createD','f_docDay'], String(n.getDate()));
    // f_docDate(令和形式)
    if(isEmpty(['f_docDate'])){
      setValMulti(['f_docDate'], `令和${n.getFullYear()-2018}年${n.getMonth()+1}月${n.getDate()}日`);
    }

    // プレビュー再描画
    if(typeof p==='function') p();
    // 金額系フィールドにカンマ整形を適用
    applyMoneyFormatting();
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


