/**
 * ofusa_common.js - OFUSA書類作成システム 共通モジュール
 * ver.20261113.03
 * - feat: シンハラ語（si）版の書類（1_6_si.html / 1_5_si.html）に対応
 * ver.20261113.02
 * - feat(1-6号): 社会保険料「不要（書類に記載しない）」のときは税金等の自動計算で社会保険料を入れない
 * ver.20261112.03
 * - change(1-6号): 換算月給を 時給×年間所定労働時間÷12／日給×年間所定労働日数÷12 に（年間が空なら月の値）。作成済みの書類の値は変えない
 * ver.20261112.02
 * - fix(1-6号): 手当を空欄のまま保存した直接編集版でも、別紙の金額・計算方法をあとから入れれば書類に出るようにした（欄が無ければ足す）
 * ver.20261111.02
 * - feat(1-6号): 税金（所得税＋住民税）・社会保険料・雇用保険料を自動計算（案シスと同じ OFUSA_TAXCALC。手で直した欄は上書きしない）
 * ver.20261113.01
 * - fix: 直接編集版・呼び戻した書類で、業務区分２（分野２）が空なのに「建築・es.category2」と出ていた → 空なら区切りの「・」ごと出さない
 * ver.20261029.01
 * - feat(利用ログ): saysay_logs に案シスで選んだ担当者名(user_name)も記録（共有アカウント mail@ でも人を区別）
 * ver.20261028.01
 * - feat(直接編集): 直接編集の後に、書類の形が変わる変更（チェック欄・シフト行など）をサイドバーでしたら、
 *   書類の上に黄色いお知らせを出す（「♻️ 破棄して作り直す」「このまま使う」）。印刷時も確認
 * ver.20261027.03
 * - change: 「❓ 使い方」はポップアップではなく、書類の上に開閉パネルで表示
 * ver.20261027.02
 * - feat: 「✏️ 直接編集」の横に「❓ 使い方」ボタン（正しい手順①〜④・やっていいこと／いけないこと）
 * ver.20261027.01
 * - fix(直接編集): 変数欄（es.xxx・差し込み値）の中に打った文字が、DB保存・読込・サイドバー変更で消えていた。
 *   編集終了・保存の前に、書き足しは変数欄の外へ移し、値の書き換えは入力欄へ反映する（_reconcileBindEdits）
 * - fix(直接編集): 直接編集後にサイドバーを変えると書類が作り直されて編集が全部消えていた → 変数欄の差し替えだけにする
 * - feat(編集HTMLの受け皿): 直接編集・スタイル編集（余白・枠線・文字移動）・文字サイズを、
 *   新テーブル saysay_html_store に「雇用条件（company_id＋雇用条件セットの固定ID _uid）×書類ファイル」単位で
 *   （_uid は編集版を初めて保存するときに DB関数 set_emp_set_uid で emp_sets[n] に1回だけ付ける。
 *    セット削除で番号がずれても紐づけが崩れない。複製で重複・古い画面の保存で消えた場合は付け直す）
 *   DB保存のたびに履歴保存し、同じ雇用条件の案件を開くと最新版を呼び戻す。
 *   ・これまでは案件ごと(extra._edited)にしか残らず、同じ雇用条件の別の申請人では呼び戻されなかった
 *   ・1-6号はスタイル編集だけでは保存対象にならなかった → 受け皿側はスタイル編集も対象
 *   ・上部の文字サイズ(A-/A+)もHTMLと一緒に保存・復元
 *   ・案件ごとの編集版と受け皿の新しい方を採用（最新優先）。変数欄(data-bind)は呼び戻し後に最新値で再描画
 *   ・「♻️ 編集版破棄」で破棄印(discarded)を入れ、それ以降は呼び戻さない
 *   ・直接編集中の10秒ごとの自動保存は下書きとして同じ1行を上書きし、DB保存・編集終了で確定（履歴を増やさない）
 * ver.20261026.03
 * - fix(利用ログ): user_email が空になる経路があった（書類タブ切替時はトークンが渡らない／
 *   親index.htmlの IDX_TOKEN は let 宣言で window から読めない）。
 *   Saysayログイン情報（localStorage の sb-<ref>-auth-token。同一ドメインなので読める）から
 *   メールを取るのを最優先にし、次に受け取ったトークン、最後に親画面を見る。
 * ver.20261026.02
 * - feat(doPrint): PDF印刷時に「案件読込から何分かかったか」をトーストで表示
 *   （印刷ダイアログを閉じたあとに出る）。所要時間を本人がその場で確認できる。
 * ver.20261026.01
 * - feat(利用ログ): だれが（ログインメール）・どの書類で・どの案件を読み込み（load）、
 *   いつPDF印刷（print）・DB保存（save）したかを Supabase saysay_logs に記録。
 *   session_id で同一画面を追跡し、ms_since_load（案件読込からの経過ミリ秒）で
 *   書類作成の所要時間を測れる。記録に失敗しても画面の動作には影響しない。
 * ver.20261023.04
 * - fix(resolveEmpSetIdx): 雇用条件セットが未選択のとき、1番目（や自動で選んだセット）を黙って使わない。
 *   「雇用条件セットを選んでください」の画面を出し、選んだセットを cases.emp_set_idx に保存して使う。
 *   キャンセル／見えない枠（まとめ印刷・案シスからの作成）では -1（雇用条件は空）を返す。
 *   これまでの自動選択は「おすすめ」の印として見せるだけ（empSetGuessIdx）。
 * - fix(saveEmpSetWithMode): 未選択のまま保存すると1番目のセットに上書きしていたのを、新しいセットとして保存するか聞くように。
 * - renderEmpSetSelector: 未選択なら「-- 選んでください --」と赤い注意を出す（先頭の仮表示はしない）
 * ver.20261020.04
 * - fix(loadFormGenericFromDB): 書類ごとの「💾 DB保存」値が、あとから案シスで直した雇用条件を
 *   常に上書きしていた（「DBが正」）。セキテックで7/20保存の「超過勤務」が10/20修正の
 *   「固定残業代」を潰して発覚。雇用条件と書類保存は相互に書き換わるため、
 *   「新しい方が勝つ」に変更（欄ごと）:
 *   ・保存時に、その時点の雇用条件の値(_empVals)を一緒に記録しておく
 *   ・読込時、雇用条件の値が記録時から変わっていれば → 案シス側が新しいので雇用条件を採用
 *     変わっていなければ → 書類で直した値（保存値）を採用
 *   ・記録の無い旧保存は、雇用条件の更新日時(updatedAt/_savedAt)と保存日時(_savedAt)を比べ、新しい方を採用
 *   ・雇用条件に無い書類固有の欄は、従来どおり保存値を採用。直接編集版の復元も従来どおり
 * ver.20260901.01
 * - feat(resolveEmpSetIdx): cases.emp_set_idx が空のとき emp_sets[0] 固定だったのを、
 *   申請人名/案件名/入力済み項目数でセットを自動選択し cases.emp_set_idx に書き戻すよう変更。
 *   [0] がヒアリング取込の未完成セットで本命が [1] にある会社で、分野・業務区分・事務所住所(英)・
 *   交代制などが空欄になる不具合を修正（case_1787220246147 前田精工で発覚。同状態の案件 1,600件超）。
 * ver.20260831.07
 * - fix(loadCaseToForm): 業務区分(category/categoryEn)の分割ブロックを skipFieldRestore でガード。
 *   1-6系で独自 setFormValues が入れた業務区分１が共通側で '' に上書きされ空欄になる不具合を修正。
 *   2つ目のフォームIDも es_categoryEn2 → es_category2En に修正。
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
// ver.20261103.01: ログインしていない（トークンが無い・切れた）ときは公開キーで読まず、ログインできるまで待つ（裏口対策）。
//   Saysay（または案シス）でログインすると、そのまま続きを読み込む。
function _sbUserTokOk(t){ return !!t && t!==SB_KEY && /^eyJ/.test(t) && _jwtExpMs(t) > Date.now() + 5000; }
function _sbNeedLoginNotice(on){
  try{
    var id='_sbNeedLoginBar', el=document.getElementById(id);
    if(!on){ if(el) el.remove(); return; }
    if(el || !document.body) return;
    el=document.createElement('div'); el.id=id;
    el.style.cssText='position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483000;background:#1e3a5f;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,.25);';
    el.textContent='🔑 ログインが切れています。Saysay（または案シス）でログインすると、続きを読み込みます';
    document.body.appendChild(el);
  }catch(e){}
}
function _sbWaitUserToken(){
  return new Promise(function(res){
    var t=_sbToken(); if(_sbUserTokOk(t)){ res(t); return; }
    _sbNeedLoginNotice(true);
    try{ if(window.parent && window.parent!==window) window.parent.postMessage({type:'OFUSA_NEED_LOGIN'}, '*'); }catch(e){}
    var iv=setInterval(function(){ var t2=_sbTokenFromLS(); if(_sbUserTokOk(t2)){ clearInterval(iv); _sbNeedLoginNotice(false); res(t2); } }, 1500);
  });
}
// ver.20261113.01: 直接編集版HTMLの読み書き（DBの company_edited_html。会社データ extra._edited からここへ移した）
//   保存は今までどおり extra._edited に入れて PATCH すれば、DBのトリガーが別テーブルへ移す（set_edited_html RPC でも可）
async function _getEditedHtml(companyId, doc, caseId){
  const r = await sb('rpc/get_edited_html', { method:'POST', body: JSON.stringify({ p_company_id: String(companyId), p_doc: doc||null, p_case_id: caseId||null }) });
  return (r && typeof r === 'object' && !Array.isArray(r)) ? r : {};
}
async function _delEditedHtml(companyId, doc, caseId){
  return sb('rpc/del_edited_html', { method:'POST', body: JSON.stringify({ p_company_id: String(companyId), p_doc: doc, p_case_id: String(caseId) }) });
}
async function sb(path,opts={}){
  let _tok = _sbToken();
  if(!_sbUserTokOk(_tok)) _tok = await _sbWaitUserToken();
  const headers = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + _tok,
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
  const _res = t ? JSON.parse(t) : null;
  // ver.20261109.09: 「🔍 出どころ」表示のため、1件ずつ読んだ行（案件・会社・人材・登録支援機関など）を覚えておく
  try{ if(_method==='GET' && Array.isArray(_res) && _res.length && _res.length<=3){ const _tb=String(path).split('?')[0]; (window._srcRows=window._srcRows||{})[_tb]=_res[0]; } }catch(_sr){}
  return _res;
}

// ver.20260901.01: 雇用条件セット(emp_sets)のインデックス自動解決。
//   cases.emp_set_idx が空の案件が多数あり（1,600件超）、その場合 従来は emp_sets[0] を既定にしていた。
//   しかし [0] が「ヒアリング取込 (日時取得中)」等の未完成セットで、本命のセットが [1] 以降にある会社では
//   分野・業務区分・事務所住所(英)・交代制などが軒並み空欄になっていた（例: case_1787220246147 前田精工）。
//   優先順: ①cases.emp_set_idx（有効な数値）→ ②setName に申請人名を含む → ③setName に案件名を含む
//          → ④入力済み項目数が最多のセット → ⑤0。
//   ②〜④で決めた場合は cases.emp_set_idx に書き戻して、他書類（重要事項説明書・1-17等）とも揃える。

// ============================================================
// ver.20260911.07: 1-6号 AI判定（koyoujoukensho-check スキル移植）
//   雇用条件書の入力値を ⛔/⚡/✅ で提出前チェックする。
//   ・機械計算できる項目（最低賃金・控除合計・手取り・週=年÷52.14・休憩・年休）は JS で確定判定
//   ・文言や整合の総合判断は Claude API（AI翻訳と同じ localStorage の ofusa_apiKey）に委譲
//   ・過検知防止ルール（G4/G6/G8/G13/G16 相当）をプロンプトに埋め込み
// ============================================================
window.OFUSA_MIN_WAGE = { // 令和7年度(2025年10月改定)。毎年10月改定時に更新すること
  "北海道":1075,"青森":1029,"岩手":1031,"宮城":1038,"秋田":1031,"山形":1032,"福島":1033,
  "茨城":1074,"栃木":1068,"群馬":1063,"埼玉":1141,"千葉":1140,"東京":1226,"神奈川":1225,
  "新潟":1050,"富山":1062,"石川":1054,"福井":1053,"山梨":1052,"長野":1061,"岐阜":1065,
  "静岡":1097,"愛知":1140,"三重":1087,"滋賀":1080,"京都":1122,"大阪":1177,"兵庫":1116,
  "奈良":1051,"和歌山":1045,"鳥取":1030,"島根":1033,"岡山":1047,"広島":1085,"山口":1043,
  "徳島":1046,"香川":1036,"愛媛":1033,"高知":1023,"福岡":1057,"佐賀":1030,"長崎":1031,
  "熊本":1034,"大分":1035,"宮崎":1023,"鹿児島":1026,"沖縄":1023 };
window.OFUSA_MIN_WAGE_AVG = 1121; // 令和7年度 地域別最低賃金の全国加重平均（2025年10月）。毎年10月改定時に更新すること
// ver.20261112.08: 令和8年度（2026年10月〜12月に順次発効）。厚労省「令和8年度地域別最低賃金額答申状況」より。
//   判定には「今日」と「雇用契約の開始日」の遅い方の日付で、発効済みの額を使う（発効前は令和7年度の額）。
window.OFUSA_MIN_WAGE_R8 = {
  "北海道":[1131,"2026-10-01"],"青森":[1090,"2026-10-29"],"岩手":[1090,"2026-12-01"],"宮城":[1098,"2026-10-01"],"秋田":[1090,"2026-10-14"],"山形":[1092,"2026-10-30"],"福島":[1094,"2026-10-16"],
  "茨城":[1136,"2026-10-18"],"栃木":[1125,"2026-10-01"],"群馬":[1120,"2026-10-03"],"埼玉":[1196,"2026-10-01"],"千葉":[1195,"2026-10-01"],"東京":[1280,"2026-10-01"],"神奈川":[1279,"2026-10-01"],
  "新潟":[1108,"2026-10-01"],"富山":[1119,"2026-10-01"],"石川":[1113,"2026-10-03"],"福井":[1112,"2026-10-04"],"山梨":[1113,"2026-11-01"],"長野":[1117,"2026-10-02"],"岐阜":[1121,"2026-10-01"],
  "静岡":[1154,"2026-10-15"],"愛知":[1195,"2026-10-01"],"三重":[1143,"2026-10-01"],"滋賀":[1136,"2026-10-03"],"京都":[1180,"2026-11-16"],"大阪":[1231,"2026-10-01"],"兵庫":[1172,"2026-10-01"],
  "奈良":[1107,"2026-10-04"],"和歌山":[1101,"2026-10-03"],"鳥取":[1090,"2026-10-03"],"島根":[1092,"2026-10-10"],"岡山":[1104,"2026-10-02"],"広島":[1141,"2026-10-11"],"山口":[1101,"2026-10-08"],
  "徳島":[1103,"2026-11-01"],"香川":[1092,"2026-10-01"],"愛媛":[1093,"2026-11-01"],"高知":[1086,"2026-10-29"],"福岡":[1114,"2026-10-04"],"佐賀":[1095,"2026-11-15"],"長崎":[1087,"2026-11-02"],
  "熊本":[1092,"2026-12-01"],"大分":[1096,"2026-11-01"],"宮崎":[1085,"2026-10-24"],"鹿児島":[1090,"2026-10-25"],"沖縄":[1086,"2026-12-02"] };
window.OFUSA_MIN_WAGE_AVG_R8 = [1177, "2026-10-01"];   // 全国加重平均（令和8年度）。最初の発効日から使う
/* ver.20261112.17: 変形労働時間制の単位の訳（1-6号）。書類は「（　）単位の変形労働時間制」と単位の語を印字済みなので、
   訳の欄は「1 bulan」「1 tháng」のように期間だけにする。別の言語の訳（ベトナム語版に「1 bulan」など）や
   「Satuan Bulanan」「Đơn vị 1 năm」のように単位の語が入っているときは、その言語の決まった訳に直す */
var _FLEX_TR={ id:['1 bulan','1 tahun'], vi:['1 tháng','1 năm'], en:['1 month','1 year'], ne:['१ महिना','१ वर्ष'], my:['၁ လ','၁ နှစ်'],
  th:['1 เดือน','1 ปี'], zh:['1个月','1年'], ko:['1개월','1년'], km:['១ ខែ','១ ឆ្នាំ'], si:['මාස 1','වසර 1'] };
function _flexUnitEnFix(lang, ja, en){
  var t=_FLEX_TR[lang]; ja=String(ja||'').normalize('NFKC'); en=String(en||'').trim();
  var kind = /年/.test(ja) ? 1 : (/(ヶ|か|カ|ケ|箇)?月/.test(ja) ? 0 : -1);
  if(!t || kind<0) return en.replace(/^(satuan|đơn vị|per)\s+/i,'').replace(/\s*(unit|単位|单位|단위)$/i,'').trim();
  if(!en) return t[kind];
  var known=false; Object.keys(_FLEX_TR).forEach(function(k){ _FLEX_TR[k].forEach(function(x){ if(x.replace(/\s/g,'').toLowerCase()===en.replace(/\s/g,'').toLowerCase()) known=true; }); });
  if(known || /satuan|bulanan|tahunan|đơn vị|unit|単位|单位|단위|^bulan$|^tahun$|^1?\s*(nam|thang)$/i.test(en) || /[ぁ-んァ-ヶ一-龥]/.test(en) && lang!=='zh') return t[kind];
  return en;
}
window._flexUnitEnFix=_flexUnitEnFix;
/* ver.20261112.14: 雇用条件セットの会社名・所在地の訳が「英語でない」（別の言語の訳が入っている）か。
   全角の数字・記号は半角にしてから、英字・数字・記号以外の文字や、インドネシア語・ベトナム語などの住所の語があれば英語でないとみなす */
function _ofusaNotEnglish(s){
  s=String(s||'').normalize('NFKC').replace(/[・ー－―‐〜～「」『』（）、。]/g,'').replace(/[āáàâ]/gi,'a').replace(/[ēéèê]/gi,'e').replace(/[īíìî]/gi,'i').replace(/[ōóòô]/gi,'o').replace(/[ūúùû]/gi,'u').trim(); if(!s) return false;   // ローマ字の長音記号（ō など）は英語あつかい
  return /[^\x00-\x7F]/.test(s) || /\b(Kota|Prefektur|Kabupaten|Provinsi|Kecamatan|Jalan|Thanh pho|Tinh|Quan|Phuong|Distrik)\b/i.test(s);
}
// 会社の所在地（日本語）と雇用条件セットの所在地（日本語）が同じ場所か（空白・全角半角・「番地」などの違いは無視）
function _ofusaSameAddr(a,b){
  var n=function(x){ return String(x||'').normalize('NFKC').replace(/\s/g,'').replace(/[丁目番地号の－ー―‐-]/g,''); };
  return !!n(a) && n(a)===n(b);
}
// ver.20261112.08: 案シスの「min_wages」表（定期タスクが厚労省の発表から自動更新）を読み、上の表より優先して使う。読めなければ上の表を使う
window.OFUSA_MW_DB=null;
async function _mw16_loadDB(){
  try{
    var rows=await sb('min_wages?select=pref,wage,effective_date,fiscal_year&order=effective_date.asc');
    if(!Array.isArray(rows) || rows.length<40) return;
    var m={}; rows.forEach(function(r){ var k=String(r.pref||''); if(!k||!r.wage||!r.effective_date) return; (m[k]=m[k]||[]).push({v:Number(r.wage), eff:String(r.effective_date).slice(0,10), fy:Number(r.fiscal_year)}); });
    window.OFUSA_MW_DB=m;
  }catch(e){ console.warn('[min_wages]', e); }
}
setTimeout(function(){ try{ if(document.getElementById('es_salaryMonthly') || document.getElementById('es_salaryHourly')) _mw16_loadDB(); }catch(e){} }, 1500);
function _mw16_fmtD(d){ return String(d).replace(/^(\d+)-0?(\d+)-0?(\d+)$/,'$1年$2月$3日'); }
function _mw16_fyLabel(fy){ return fy ? ('令和'+(fy-2018)+'年度') : ''; }
// 案シスの表から「判定日に発効済みの最新」と「その次（まだ発効していない額）」を取る
function _mw16_fromDB(key){
  var list=(window.OFUSA_MW_DB||{})[key]; if(!list || !list.length) return null;
  var ref=_mw16_refDate(), cur=null, next=null;
  list.forEach(function(r){ if(r.eff<=ref) cur=r; else if(!next) next=r; });
  if(!cur) return null;
  return {v:cur.v, label:_mw16_fyLabel(cur.fy)+'・'+_mw16_fmtD(cur.eff)+'発効', next:next?{v:next.v, eff:_mw16_fmtD(next.eff), fy:next.fy}:null};
}
// 判定に使う日付：今日と雇用契約の開始日の遅い方（YYYY-MM-DD）
function _mw16_refDate(){
  var d=new Date(), today=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
  var y=_mw16_num('es_contractStartY'), m=_mw16_num('es_contractStartM'), dd=_mw16_num('es_contractStartD'), st='';
  if(y>=2000 && m>=1 && m<=12) st=y+'-'+('0'+m).slice(-2)+'-'+('0'+(dd||1)).slice(-2);
  return (st && st>today) ? st : today;
}
// その都道府県の最低賃金（{v:額, label:'令和8年度（2026-10-01発効）'}）
function _mw16_minWage(pref){
  var _db=_mw16_fromDB(pref); if(_db) return _db;
  var r8=(window.OFUSA_MIN_WAGE_R8||{})[pref], ref=_mw16_refDate();
  if(r8 && ref>=r8[1]) return {v:r8[0], label:'令和8年度・'+r8[1].replace(/^(\d+)-0?(\d+)-0?(\d+)$/,'$1年$2月$3日')+'発効'};
  var v=(window.OFUSA_MIN_WAGE||{})[pref];
  return {v:v, next:(r8?{v:r8[0], eff:r8[1].replace(/^(\d+)-0?(\d+)-0?(\d+)$/,'$1年$2月$3日'), fy:2026}:null), label:'令和7年度'+(r8?'（令和8年度 '+r8[0]+'円は'+r8[1].replace(/^(\d+)-0?(\d+)-0?(\d+)$/,'$1年$2月$3日')+'発効）':'')};
}
function _mw16_avg(){
  var _db=_mw16_fromDB('全国加重平均'); if(_db) return {v:_db.v, label:_db.label};
  var a=window.OFUSA_MIN_WAGE_AVG_R8; if(a && _mw16_refDate()>=a[1]) return {v:a[0], label:'令和8年度'};
  return {v:window.OFUSA_MIN_WAGE_AVG||0, label:'令和7年度'};
}
// ver.20261109.07: 建設の報酬基準用の所定内賃金（基本給＋毎月固定の手当。最低賃金法で除く通勤・精皆勤・家族手当と、時間外・深夜・休日の手当、固定残業代は除く）
function _mw16_shoteinai(){
  var base=_mw16_num('es_salaryMonthly'), sum=base, parts=[base?('基本給'+base):''];
  for(var i=1;i<=6;i++){
    var nm=_mw16_val('es_a'+i+'Name'), am=_mw16_num('es_a'+i+'Amt'); if(!am) continue;
    if(/通勤|皆勤|精勤|残業|時間外|深夜|休日|家族/.test(nm)) { parts.push(nm+am+'(除外)'); continue; }
    sum+=am; parts.push((nm||('手当'+i))+am);
  }
  return {sum:sum, detail:parts.filter(Boolean).join('＋')};
}
function _mw16_num(id){
  var e=document.getElementById(id); if(!e) return 0;
  var t=String(e.value||'').replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0xFEE0);}).replace(/[,，、\s　円]/g,'');
  var n=parseFloat(t); return isNaN(n)?0:n;
}
function _mw16_val(id){ var e=document.getElementById(id); return e?String(e.value||'').trim():''; }
function _mw16_pref(){
  var src=(_mw16_val('es_officeAddress')||_mw16_val('es_orgAddress')||'');
  for(var k in OFUSA_MIN_WAGE){ if(src.indexOf(k)>=0) return k; }
  return '';
}
function _mw16_jippi(base){
  var cb=document.getElementById(base+'Jippi'); var est=document.getElementById(base+'Est');
  return !!(cb&&cb.checked)||/実費/.test((est&&est.value)||'');
}
function _aiCheck16Local(rules){
  var checks=[];
  function add(sev,cat,title,detail,page){ checks.push({severity:sev,category:cat,title:title,detail:detail,src:'計算',page:page||''}); }
  // D/E. 最低賃金（基本給ベース）
  var pref=_mw16_pref();
  var th=_mw16_num('es_monthlyH')+_mw16_num('es_monthlyMin')/60;
  var hourly=_mw16_num('es_salaryHourly');
  var monthly=_mw16_num('es_salaryMonthly');
  // ver.20261109.09: 最低賃金は基本給だけでなく、算入される手当も足して判定（精皆勤・通勤・家族・固定残業や夜勤などの割増・臨時・賞与は除く＝最低賃金法の除外賃金）
  var _mwAllow=0, _mwAllowNames=[];
  for(var _mi=1; _mi<=6; _mi++){ var _mn=_mw16_val('es_a'+_mi+'Name'), _ma=_mw16_num('es_a'+_mi+'Amt'); if(_ma && !/固定残業|みなし|残業|時間外|深夜|夜勤|休日出勤|通勤|家族|扶養|精勤|皆勤|臨時|賞与/.test(_mn)){ _mwAllow+=_ma; _mwAllowNames.push(_mn||('手当'+_mi)); } }
  if(!hourly && monthly && th>0) hourly=Math.round((monthly+_mwAllow)/th);
  var isKensetsu=/建設/.test(_mw16_val('es_applicantField')+_mw16_val('es_applicantFieldEn'));
  if(pref && hourly){
    var _mwo=_mw16_minWage(pref), mw=_mwo.v;
    if(hourly<mw) add('out','最低賃金','最低賃金割れ（'+pref+'）','時給換算 '+hourly+'円 < 最低賃金 '+mw+'円（'+_mwo.label+'）。（月給'+(_mwAllow?'＋算入手当［'+_mwAllowNames.join('・')+'］':'')+'）÷月所定労働時間で判定。','P5');
    else add('ok','最低賃金','最低賃金クリア（'+pref+'）','時給換算 '+hourly+'円 ≥ '+mw+'円（'+_mwo.label+'）。','P5');
    if(_mwo.next && hourly>=mw && hourly<_mwo.next.v) add('warn','最低賃金','もうすぐ最低賃金を下回ります（'+pref+'）','時給換算 '+hourly+'円。'+_mwo.next.eff+'から最低賃金が '+_mwo.next.v+'円'+(_mwo.next.fy?'（'+_mw16_fyLabel(_mwo.next.fy)+'）':'')+'に上がるため、それ以降は下回ります。','P5');   // ver.20261112.08
    if(isKensetsu){
      // ver.20261109.07: 建設は「所定内賃金÷月所定労働時間」が、地域別最低賃金×1.1 と 全国加重平均×1.1 のどちらも下回らないこと（国交省 受入計画の認定基準）
      var stn=_mw16_shoteinai(), _avo=_mw16_avg(), avg=_avo.v;
      var _hr=(!monthly)?_mw16_num('es_salaryHourly'):0, hk;
      if(_hr){ var _al=stn.sum; hk=th>0 ? Math.floor(_hr+_al/th) : _hr; stn.detail='時給'+_hr+(_al?'＋手当（'+stn.detail+'）÷月'+th.toFixed(1)+'h':''); }   // ver.20261109.08: 時給は 時給＋手当÷月時間
      else hk=(th>0 ? Math.floor(stn.sum/th) : hourly);
      var needR=Math.ceil(mw*1.1), needA=Math.ceil(avg*1.1), need=Math.max(needR,needA);
      var basis=(needA>needR?'全国加重平均（'+_avo.label+'）'+avg+'円×1.1＝'+needA+'円':pref+'最賃（'+_mwo.label+'）'+mw+'円×1.1＝'+needR+'円')+'（地域別×1.1＝'+needR+'円／全国加重平均×1.1＝'+needA+'円の高い方）';
      if(hk<need) add('out','建設報酬基準','建設の報酬基準を下回っています','時給換算 '+hk+'円 < '+need+'円。'+basis+'。'+(_hr?stn.detail+' で計算。':'所定内賃金 '+stn.detail+' ÷ 月'+th.toFixed(1)+'h で計算。'),'P5');
      else add('ok','建設報酬基準','建設の報酬基準クリア','時給換算 '+hk+'円 ≥ '+need+'円。'+basis+'。','P5');
    }
  } else if(!pref){
    add('warn','最低賃金','就業場所の都道府県を判定できません','事業所所在地・所属機関住所から都道府県を読めませんでした。手動で最低賃金を確認してください。','P5');
  }
  // G. 控除合計・手取り
  var parts=[['es_deductTax','税金'],['es_deductSocialIns','社会保険料'],['es_deductEmpIns','雇用保険料']];
  var jparts=[['es_deductFood','食費'],['es_deductHousing','居住費'],['es_deductUtility','水道光熱費'],['es_deductOther1Amount','その他①'],['es_deductOther2Amount','その他②'],['es_deductOther3Amount','その他③'],['es_deductOther4Amount','その他④']];
  var sum=0, detail=[];
  parts.forEach(function(x){ var n=_mw16_num(x[0]); if(n){sum+=n; detail.push(x[1]+n);} });
  jparts.forEach(function(x){ var n=_mw16_num(x[0]); if(!n) return; if(_mw16_jippi(x[0])){ detail.push(x[1]+n+'(実費・除外)'); } else { sum+=n; detail.push(x[1]+n);} });
  var dt=_mw16_num('es_deductTotal');
  if(dt||sum){
    if(Math.abs(sum-dt)<=1) add('ok','控除整合','控除内訳の合計と控除合計が一致','内訳計 '+sum+'円 ＝ 控除合計 '+dt+'円。','P7');
    else add('out','控除整合','控除内訳の合計と控除合計が不一致','内訳計 '+sum+'円 ≠ 控除合計 '+dt+'円（差 '+(sum-dt)+'円）。['+detail.join(' / ')+']','P7');
  }
  var st=_mw16_num('es_salaryTotal')||monthly; var np=_mw16_num('es_netPay');
  // 手取り＝支払概算総額−控除合計（実費は入れない）。控除合計は実費除外の内訳計を正とし、内訳が無ければ欄の値を使う
  var deductBase=(sum>0)?sum:dt;
  if(st&&np&&deductBase){
    var expectedNet=st-deductBase;
    var baseLabel=(sum>0)?'控除(実費除外の内訳計) '+deductBase:'控除合計欄 '+deductBase;
    if(Math.abs(expectedNet-np)<=1) add('ok','手取り整合','手取り＝支払概算総額−控除合計（実費除外）が一致','支払概算 '+st+' − '+baseLabel+' ＝ '+np+'円。','P7');
    else add('out','手取り整合','手取り額が計算と不一致','支払概算 '+st+' − '+baseLabel+' ＝ '+expectedNet+'円 のはずが、手取り欄は '+np+'円（差 '+(np-expectedNet)+'円）。','P7');
  }
  // B. 週＝年÷52.14（G13）
  var yh=_mw16_num('es_yearlyH')+_mw16_num('es_yearlyMin')/60;
  var wh=_mw16_num('es_weeklyH')+_mw16_num('es_weeklyMin')/60;
  var isNogyo=/農業|漁業/.test(_mw16_val('es_applicantField'));
  if(yh&&wh){
    var calc=yh/52.14;
    if(Math.abs(calc-wh)>0.6) add('warn','労働時間','週所定労働時間が年間÷52.14と乖離','年間'+yh.toFixed(1)+'h÷52.14＝'+calc.toFixed(2)+'h に対し週欄 '+wh.toFixed(2)+'h。（週＝1日×日数では判定しません）','P2');
    else add('ok','労働時間','週所定労働時間は年間÷52.14と整合','週 '+wh.toFixed(2)+'h ≒ 年間÷52.14（'+calc.toFixed(2)+'h）。','P2');
    if(calc>40.05 && !isNogyo) add('out','労働時間','週の法定労働時間40hを超過','年間÷52.14＝'+calc.toFixed(2)+'h。変形労働時間制の要件を確認してください。','P2');
    if(calc>40.05 && isNogyo) add('ok','労働時間','週40h超だが農業・漁業のため適用除外','労基法41条により労働時間・休日規定は適用除外（年休は通常どおり）。','P2');
  }
  // C. 休憩・年休
  var dh=_mw16_num('es_dailyHours')+_mw16_num('es_dailyMins')/60; var br=_mw16_num('es_breakTime');
  if(dh>8&&br<60) add('out','休憩','休憩が不足（8h超は60分必要）','1日 '+dh.toFixed(2)+'h に対し休憩 '+br+'分。','P4');
  else if(dh>6&&br<45) add('out','休憩','休憩が不足（6h超は45分必要）','1日 '+dh.toFixed(2)+'h に対し休憩 '+br+'分。','P4');
  else if(dh&&br) add('ok','休憩','休憩時間は法定を満たす','1日 '+dh.toFixed(2)+'h／休憩 '+br+'分。','P4');
  var pl=_mw16_num('es_paidLeave');
  if(pl&&pl<10) add('out','年休','年次有給休暇が法定（10日）未満','6か月継続勤務後 '+pl+'日。10日以上必要。','P4');
  // 年間休日＋年間所定労働日数＝365（うるう年は考慮しない・365日固定）
  var ah=_mw16_num('es_annualHolidays'); var yd=_mw16_num('es_yearlyDays');
  if(ah&&yd){
    var expectDays=365-ah;
    if(yd===expectDays) add('ok','年間日数','年間休日と労働日数の整合（365日基準）','365 − 年間休日 '+ah+'日 ＝ 労働日 '+expectDays+'日。','P4');
    else add('out','年間日数','年間休日と年間所定労働日数が365日基準と不一致','365 − 年間休日 '+ah+'日 ＝ '+expectDays+'日 のはずが、年間所定労働日数欄は '+yd+'日（差 '+(yd-expectDays)+'日）。うるう年は考慮せず365日で統一してください。','P4');
  }
  // 業務区分: 分野×業務区分のマスタ照合（案シス FIELD_CATEGORY_MAP と同一。DBのfield_categoriesから）
  var fcMap=(rules&&rules.field_categories)||null;
  var fldRaw=_mw16_val('es_applicantField');
  var catRaw=_mw16_val('es_category');
  if(fcMap&&fldRaw&&catRaw){
    var norm=function(t){return String(t||'').replace(/[\s　]/g,'');};
    var head=function(t){return norm(t).split('（')[0];};
    var fld=norm(fldRaw), cat=norm(catRaw);
    var fldKey=null;
    for(var k in fcMap){ if(norm(k)===fld){ fldKey=k; break; } }
    if(!fldKey){ for(var k2 in fcMap){ if(head(k2)===head(fldRaw) && (norm(k2).indexOf('１号')>=0)===(fld.indexOf('１号')>=0) && (norm(k2).indexOf('２号')>=0)===(fld.indexOf('２号')>=0)){ fldKey=k2; break; } } }
    if(!fldKey){
      add('warn','業務区分','分野名がマスタに見つかりません','分野「'+fldRaw+'」が分野別業務区分マスタに無いため照合できませんでした。分野名の表記を確認してください。','P2');
    } else {
      var list=fcMap[fldKey]||[];
      var hit=list.some(function(c){ return norm(c)===cat; });
      // 省略形（「土木」など括弧なし）のみ先頭一致を許可。括弧つきで不一致＝号数違い等は許可しない
      if(!hit && cat.indexOf('（')<0) hit=list.some(function(c){ return head(c)===head(catRaw) && head(catRaw)!==''; });
      if(hit) add('ok','業務区分','分野×業務区分の組み合わせはマスタと一致','分野「'+fldKey+'」の区分として「'+catRaw+'」を確認。','P2');
      else add('out','業務区分','業務区分が分野のマスタにありません','分野「'+fldKey+'」に「'+catRaw+'」は登録されていません（号数違いを含む）。有効な区分: '+list.map(function(c){return c.split('（')[0];}).join('／'),'P2');
    }
  }
  // E/H. 建設の昇給要件
  if(isKensetsu){
    var rc=_mw16_val('es_raiseCondition');
    if(rc && !/1[,，]?000円/.test(rc)) add('warn','昇給','建設の昇給要件（月1,000円以上）が文言から読めません','昇給条件:「'+rc.substring(0,60)+'…」。年1回・1,000円/月以上の明記を推奨。','P5');
  }
  // ver.20261109.09: 差戻しの多い項目を計算チェックに追加（時給換算・固定残業代・契約期間・変形労働）
  //   手当のうち、割増賃金の計算に入れないもの（固定残業・通勤・家族・住宅・別居・子女教育・精皆勤・臨時）は時給換算から除く
  var _exAllow=/固定残業|みなし|残業|時間外|深夜|夜勤|休日出勤|通勤|家族|扶養|住宅|別居|子女|精勤|皆勤|臨時|賞与/;
  var allowIn=0, allowInNames=[], fixedInAllow=[];
  for(var ai=1; ai<=6; ai++){
    var an=_mw16_val('es_a'+ai+'Name'), aa=_mw16_num('es_a'+ai+'Amt');
    if(!an && !aa) continue;
    if(/固定残業|みなし/.test(an)) fixedInAllow.push(an||('手当'+ai));
    if(aa && !_exAllow.test(an)){ allowIn+=aa; allowInNames.push((an||('手当'+ai))+aa); }
  }
  var ch=_mw16_num('es_calcHourly');
  if(ch && monthly && th>0){
    var expH=(monthly+allowIn)/th;
    if(Math.abs(expH-ch)>1) add('warn','時給換算','換算時給が計算と合いません','（月給 '+monthly+(allowIn?' ＋ 手当 '+allowIn+'［'+allowInNames.join('・')+'］':'')+'）÷ 月所定 '+th.toFixed(1)+'h ＝ '+expH.toFixed(1)+'円 に対し、換算時給欄は '+ch+'円。入れる手当の範囲を確認してください（固定残業・夜勤など割増の手当、通勤・家族・住宅・精皆勤などは除いて計算）。','P5');
    else add('ok','時給換算','換算時給は（月給＋手当）÷月所定と一致','換算時給 '+ch+'円。','P5');
  }
  var foA=_mw16_num('es_fixedOTAmount'), foH=_mw16_num('es_fixedOTHours');
  if(foA && fixedInAllow.length) add('out','固定残業代','固定残業代が手当欄にも入っています','手当欄の「'+fixedInAllow.join('・')+'」と固定残業代欄（'+foA+'円）の両方にあります。固定残業代欄だけに書き、手当からは外してください。','P5');
  var baseH=ch||((monthly&&th>0)?monthly/th:0);
  if(foA && foH && baseH){
    var expFo=foH*baseH*1.25;
    if(foA+1<Math.floor(expFo)) add('warn','固定残業代','固定残業代が割増（1.25倍）の計算より少ない','固定残業 '+foH+'h × 時給 '+baseH.toFixed(1)+'円 × 1.25 ＝ '+Math.floor(expFo)+'円 に対し、固定残業代は '+foA+'円。','P5');
    else add('ok','固定残業代','固定残業代は時間×時給×1.25以上','固定残業 '+foH+'h／'+foA+'円。','P5');
  }
  // 契約期間：作成日 ≦ 開始日 ＜ 終了日（年が空なら判定しない）
  var _d=function(p){ var y=_mw16_num('es_'+p+'Y'), m=_mw16_num('es_'+p+'M'), d=_mw16_num('es_'+p+'D'); if(!y||!m||!d) return null; if(y<1900) y+=2018; return new Date(y, m-1, d); };   // 令和の年数は西暦に直す
  var _fmt=function(t){ return t.getFullYear()+'/'+(t.getMonth()+1)+'/'+t.getDate(); };
  var dCr=_d('create'), dSt=_d('contractStart'), dEn=_d('contractEnd'), dEt=_d('entry');
  if(dSt && dEn && dEn<=dSt) add('out','契約期間','契約の終わりが始まりより前です','開始 '+_fmt(dSt)+' ／ 終了 '+_fmt(dEn)+'。','P1');
  if(dCr && dSt && dCr>dSt) add('warn','契約期間','作成日が契約の開始日より後です','作成日 '+_fmt(dCr)+' ／ 開始 '+_fmt(dSt)+'。','P1');
  if(dEt && dSt && dSt<dEt) add('warn','契約期間','契約の開始日が入国予定日より前です','入国予定 '+_fmt(dEt)+' ／ 開始 '+_fmt(dSt)+'。','P1');
  if(dSt && dEn && dEn>dSt && !(dCr && dCr>dSt)) add('ok','契約期間','契約期間の前後関係は正しい',_fmt(dSt)+'〜'+_fmt(dEn)+'。','P1');
  // 変形労働：適用ありなら単位が必要
  var flx=_mw16_val('es_flexFlg');
  if(/適用あり|有/.test(flx) && !_mw16_val('es_flexUnit')) add('out','変形労働','変形労働「適用あり」なのに単位が空です','「1ヶ月」「1年」などの単位を入れてください。','P3');
  return checks;
}

// ver.20261109.09: 1-6号を保存したら自動チェックし、結果をタスクのコメント（案シスの💬）に追記する。
//   ・補助用。止めたりはしない。依頼者のコメントは消さず、末尾の「🤖自動チェック」欄だけを毎回書き換える
//   ・修正タスク（11）が依頼中／作業中／確認待ちならそちら、なければ1-6作成タスク（1）に書く
//   ・AIは使わない（APIキー不要・全員に効く）。代表者名は会社情報（companies）の最新と照合する
window.C16_MARK_START='━━ 🤖自動チェック';
window.C16_MARK_END='━━ 自動チェックここまで ━━';
async function autoCheck16ToComment(caseId, companyId){
  if(!caseId) return;
  var rules=null; try{ rules=await _check16LoadRules(); }catch(e){}
  var checks=_aiCheck16Local(rules);
  // 代表者（会社情報の最新と照合。代表者は3人まで登録できるので、どれかと一致すればOK）
  if(companyId){
    try{
      var co=await sb('companies?select=rep_name,rep_title,rep2_name,rep2_title,rep3_name,rep3_title&id=eq.'+encodeURIComponent(companyId));
      co=co&&co[0];
      var nz=function(s){ return String(s||'').replace(/[\s　]/g,''); };
      var fn=nz(_mw16_val('es_repName')), ft=nz(_mw16_val('es_repTitle'));
      if(co && fn){
        var reps=[[co.rep_name,co.rep_title],[co.rep2_name,co.rep2_title],[co.rep3_name,co.rep3_title]].filter(function(r){return nz(r[0]);});
        if(reps.length){
          var hit=reps.filter(function(r){ return nz(r[0])===fn; })[0];
          if(!hit) checks.push({severity:'warn',category:'代表者',title:'代表者名が会社情報と違います',detail:'書類：'+_mw16_val('es_repName')+' ／ 会社情報：'+reps.map(function(r){return r[0];}).join('・')+'。代表者が変わっていないか確認してください。',src:'計算',page:'P1'});
          else if(nz(hit[1]) && ft && nz(hit[1])!==ft) checks.push({severity:'warn',category:'代表者',title:'代表者の役職が会社情報と違います',detail:'書類：'+_mw16_val('es_repTitle')+' ／ 会社情報：'+hit[1]+'。',src:'計算',page:'P1'});
          else checks.push({severity:'ok',category:'代表者',title:'代表者は会社情報と一致',detail:'',src:'計算',page:'P1'});
        }
      }
    }catch(e){ console.warn('[autoCheck16] 会社情報の読込失敗', e); }
  }
  var outs=checks.filter(function(c){return c.severity==='out';});
  var warns=checks.filter(function(c){return c.severity==='warn';});
  var oks=checks.filter(function(c){return c.severity==='ok';});
  var now=new Date(); var jst=new Date(now.getTime()+(9*60+now.getTimezoneOffset())*60000);
  var stamp=(jst.getMonth()+1)+'/'+jst.getDate()+' '+('0'+jst.getHours()).slice(-2)+':'+('0'+jst.getMinutes()).slice(-2);
  var lines=[C16_MARK_START+' '+stamp+'（1-6保存時・参考） ━━'];
  lines.push('⛔ 要修正 '+outs.length+'件 ／ ⚡ 要確認 '+warns.length+'件 ／ ✅ OK '+oks.length+'件');
  outs.concat(warns).slice(0,8).forEach(function(c){
    var d=String(c.detail||'').replace(/\s+/g,' ');
    if(d.length>110) d=d.substring(0,110)+'…';
    lines.push((c.severity==='out'?'⛔ ':'⚡ ')+c.title+(d?'：'+d:''));
  });
  if(outs.length+warns.length>8) lines.push('…ほか '+(outs.length+warns.length-8)+'件（Saysayの「🧬 AI判定」で全件見られます）');
  if(!outs.length && !warns.length) lines.push('自動で見られる項目に問題は見つかりませんでした。');
  lines.push(C16_MARK_END);
  var block=lines.join('\n');
  // 書き込むタスクを決める（書く直前に読み直して、ほかの人のコメントを消さない）
  var rows=await sb('doc_tasks?select=task_index,status,assignee_comment&case_id=eq.'+encodeURIComponent(caseId)+'&task_index=in.(1,11)');
  rows=rows||[];
  var t11=rows.filter(function(r){return r.task_index===11 && [1,2,3].indexOf(Number(r.status))>=0;})[0];
  var t1=rows.filter(function(r){return r.task_index===1;})[0];
  var target=t11||t1;
  if(!target) return;   // タスクが無い案件には作らない
  var cur=String(target.assignee_comment||'');
  var si=cur.indexOf(C16_MARK_START), ei=cur.indexOf(C16_MARK_END);
  var base=(si>=0 && ei>si) ? (cur.substring(0,si)+cur.substring(ei+C16_MARK_END.length)) : cur;
  base=base.replace(/\s+$/,'');
  var next=(base?base+'\n\n':'')+block;
  if(next===cur) return;
  await sb('doc_tasks?case_id=eq.'+encodeURIComponent(caseId)+'&task_index=eq.'+target.task_index,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({assignee_comment:next})});
  return {taskIndex:target.task_index, outs:outs.length, warns:warns.length};
}
window.autoCheck16ToComment=autoCheck16ToComment;
window._check16RulesCache = null;
async function _check16LoadRules(){
  if(window._check16RulesCache) return window._check16RulesCache;
  try{
    var rows = await sb("settings?select=value&key=eq.saysay_check16_rules");
    if(rows && rows[0] && rows[0].value){ window._check16RulesCache = JSON.parse(rows[0].value); }
  }catch(e){ console.warn('[check16] ルール読込失敗', e); }
  return window._check16RulesCache;
}
window.aiCheck16 = async function(){
  var rules = await _check16LoadRules();
  var local=_aiCheck16Local(rules);
  var vals={};
  document.querySelectorAll('[id^="es_"]').forEach(function(e){
    if(!e.id||e.id.includes('${')) return;
    if(e.type==='checkbox'){ if(e.checked) vals[e.id]='checked'; return; }
    var v=String(e.value||'').trim(); if(v) vals[e.id]=v;
  });
  var key=''; try{ key=localStorage.getItem('ofusa_apiKey')||localStorage.getItem('claudeApiKey')||''; }catch(e){}
  var aiChecks=[]; var aiErr='';
  window._c16Last={checks:local.slice(), rules:rules};
  _renderCheckPanel(local, [], rules, {loading: !!key, note: key?'':'AIのAPIキーが未設定のため、自動計算のチェックのみ表示しています（AI翻訳と同じAPIキー設定で全項目判定できます）。'});
  if(key){
    try{
      var aiRuleText='';
      if(rules&&rules.pages){
        rules.pages.forEach(function(pg){
          (pg.rules||[]).forEach(function(r){ if(r.engine==='ai') aiRuleText+='['+pg.page+'] '+r.category+'：'+r.title+'（'+r.desc+'）\n'; });
        });
      }
      var guards=(rules&&rules.ai_guards)?rules.ai_guards.map(function(g,i){return (i+1)+'. '+g;}).join('\n'):'';
      var prompt='あなたは特定技能の雇用条件書（参考様式1-6号）の提出前チェック担当です。以下の入力値（Saysayの1-6号フォーム）を点検してください。\n'
        +'【判定項目（ページ順）】\n'+aiRuleText
        +'【過検知防止・厳守】\n'+guards+'\n'
        +'【自動計算済みの結果（参考・再指摘不要）】'+JSON.stringify(local.map(function(c){return c.severity+':'+c.title;}))+'\n'
        +'【入力値】'+JSON.stringify(vals)+'\n'
        +'出力はJSONのみ（前置き・コードブロック禁止）: {"checks":[{"page":"P1〜P7または全体","severity":"out|warn|ok","category":"...","title":"...","detail":"..."}]} 。out=提出不可級、warn=要確認、ok=問題なし確認済み。最大10件、okは重要なもの2件まで。';
      var r=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:2500,messages:[{role:'user',content:prompt}]})
      });
      var j=await r.json();
      var txt=(j&&j.content&&j.content[0]&&j.content[0].text)||'';
      txt=txt.replace(/```json|```/g,'').trim();
      var parsed=JSON.parse(txt);
      (parsed.checks||[]).forEach(function(c){ c.src='AI'; aiChecks.push(c); });
    }catch(e){ aiErr='AI判定でエラー: '+e.message+'（自動計算の結果のみ表示しています）'; }
    window._c16Last={checks:local.concat(aiChecks), rules:rules};
    _renderCheckPanel(local, aiChecks, rules, {loading:false, note:aiErr});
  }
};
function _c16Keyword(c){
  // 判定分類 → 書類内の目印テキスト（日本語行は全言語版に共通で存在する）
  var t=(c.category||'')+(c.title||'');
  var map=[
    ['休憩','休憩時間'],['年休','年次有給休暇'],['休日','Ⅴ．休日'],
    ['変形労働','変形労働時間制'],['シフト','交代制'],
    ['労働時間','Ⅳ．労働時間'],
    ['最低賃金','基本賃金'],['建設報酬基準','基本賃金'],
    ['手当','諸手当'],['昇給','昇給'],['賞与','賞与'],['退職金','退職金'],
    ['社保','社会保険'],['労働保険','社会保険'],['健康診断','健康診断'],
    ['控除整合','控除する金額'],['手取り整合','手取り'],['別紙','賃金の支払'],
    ['氏名','雇用契約期間'],['日付','雇用契約期間'],['契約期間','雇用契約期間'],['契約の更新','契約の更新'],
    ['就業の場所','Ⅱ．就業の場所'],['業務','Ⅲ．従事すべき業務'],['分野','Ⅲ．従事すべき業務']
  ];
  for(var i=0;i<map.length;i++){ if(t.indexOf(map[i][0])>=0) return map[i][1]; }
  return '';
}
function _c16AnchorY(c, docs, area, pageOrder){
  var areaTop=area.getBoundingClientRect().top;
  var kw=_c16Keyword(c);
  var searchDocs=docs;
  var idx=pageOrder.indexOf(c.page||'');
  if(idx>=0 && docs[idx]) searchDocs=[docs[idx]].concat(docs); // 該当ページを優先して探索
  if(kw){
    for(var d=0;d<searchDocs.length;d++){
      var els=searchDocs[d].querySelectorAll('div,td,span,p,b');
      for(var i=0;i<els.length;i++){
        var el=els[i];
        if(el.offsetHeight>0 && el.offsetHeight<140 && el.textContent && el.textContent.indexOf(kw)>=0){
          // なるべく深い要素へ
          var deeper=el;
          for(var g=0; g<4; g++){
            var child=null;
            for(var k=0;k<deeper.children.length;k++){ if(deeper.children[k].textContent.indexOf(kw)>=0){ child=deeper.children[k]; break; } }
            if(child && child.offsetHeight>0) deeper=child; else break;
          }
          return deeper.getBoundingClientRect().top - areaTop;
        }
      }
      if(d===0 && searchDocs.length>docs.length) continue; // 優先ページで見つからなければ全体へ
    }
  }
  if(idx>=0 && docs[idx]) return docs[idx].offsetTop;
  return 0;
}

// ver.20260913.06: AI判定結果 → 修正依頼の案内文生成（国交省の指摘事項スタイル）
//   カンボジアスタッフは案シスの進捗コメントへ、日本メンバーはそのまま企業への連絡に使える丁寧文。
window.openC16GuideText = function(){
  var data=window._c16Last;
  if(!data||!data.checks||!data.checks.length){ alert('先に「🧬 AI判定」を実行してください。'); return; }
  var items=data.checks.filter(function(c){return c.severity==='out'||c.severity==='warn';});
  if(!items.length){ alert('⛔・⚡の指摘はありません（案内文の対象なし）。'); return; }
  var pageOrder=['P1','P2','P3','P4','P5','P6','P7','P8'];
  var pageLabels={};
  if(data.rules&&data.rules.pages){ data.rules.pages.forEach(function(pg){ pageLabels[pg.page]=pg.label||''; }); }
  var sevOrder={out:0,warn:1};
  items.sort(function(a,b){
    var pa=pageOrder.indexOf(a.page||''), pb=pageOrder.indexOf(b.page||'');
    if(pa<0)pa=99; if(pb<0)pb=99;
    if(pa!==pb) return pa-pb;
    var sa=(a.severity in sevOrder)?sevOrder[a.severity]:9, sb=(b.severity in sevOrder)?sevOrder[b.severity]:9;
    return sa-sb;
  });
  // 既定の振り分け: 入力・計算ミス系＝当社側／事実確認が必要な系＝企業側（項目ごとに切替可）
  var IN_HOUSE=['控除整合','手取り整合','年間日数','労働時間','業務区分','氏名・日付整合','翻訳','別紙'];
  items.forEach(function(c){
    var cat=String(c.category||'')+String(c.title||'');
    c._side = IN_HOUSE.some(function(k){return cat.indexOf(k)>=0;}) ? 'in' : 'corp';
  });
  var co=(document.getElementById('es_orgName')||{}).value||'';
  var applicant=(document.getElementById('es_applicantName')||{}).value||(window._lastCaseInfo&&window._lastCaseInfo.applicant)||'';
  function sectionText(list, corp){
    var t=''; var lastPage=null;
    list.forEach(function(c){
      var pg=(c.page&&pageOrder.indexOf(c.page)>=0)?c.page:null;
      if(pg!==lastPage){
        t+='■ '+(pg?(pg.replace('P','')+'ページ目'+(pageLabels[pg]?'（'+pageLabels[pg]+'）':'')):'全体')+'\n';
        lastPage=pg;
      }
      var detail=String(c.detail||'').trim();
      if(detail && !/[。]$/.test(detail)) detail+='。';
      t+='・【'+String(c.title||'').trim()+'】\n';
      if(corp){
        var tail=(c.severity==='out')?'ご修正をお願いいたします。':'ご確認をお願いいたします。';
        t+='　'+(detail||'')+tail+'\n';
      } else {
        t+='　'+(detail||'')+(c.severity==='out'?'→ 要修正（案シス／Saysayで修正）':'→ 要確認')+'\n';
      }
    });
    return t;
  }
  function buildCorp(){
    var list=items.filter(function(c){return c._side==='corp';});
    var t='【雇用条件書（参考様式第1-6号）ご確認のお願い】\n\n';
    if(co) t+=String(co).trim()+' ご担当者様\n\n';
    t+='いつもお世話になっております。\n雇用条件書（参考様式第1-6号）'+(applicant?'（'+applicant+'様分）':'')+'について、\n下記の箇所のご確認・ご修正をお願いいたします。\n\n';
    t+= list.length ? sectionText(list, true)+'\n' : '（企業様にご確認いただく事項はありません）\n\n';
    t+='お手数をおかけしますが、ご確認のほどよろしくお願いいたします。\n';
    return t;
  }
  function buildInHouse(){
    var list=items.filter(function(c){return c._side==='in';});
    var t='【1-6号 AI判定・当社側の修正メモ】'+(applicant?'（'+applicant+'）':'')+(co?' '+co:'')+'\n\n';
    t+= list.length ? sectionText(list, false) : '（当社側で修正する事項はありません）\n';
    return t;
  }
  function refresh(){
    var a=document.getElementById('c16GuideCorp'); if(a) a.value=buildCorp();
    var b=document.getElementById('c16GuideIn'); if(b) b.value=buildInHouse();
    var cN=items.filter(function(c){return c._side==='corp';}).length;
    var iN=items.length-cN;
    var lb=document.getElementById('c16GuideCount'); if(lb) lb.textContent='企業側 '+cN+'件／当社側 '+iN+'件';
  }
  window._c16GuideToggle=function(i, side){
    items[i]._side=side;
    var row=document.getElementById('c16gi_'+i);
    if(row){
      row.querySelector('[data-s="corp"]').style.cssText=_c16PillCss(side==='corp','corp');
      row.querySelector('[data-s="in"]').style.cssText=_c16PillCss(side==='in','in');
    }
    refresh();
  };
  window._c16PillCss=function(active, kind){
    var base='border:none;border-radius:10px;padding:1px 8px;cursor:pointer;font-size:10px;margin-left:3px;';
    if(kind==='corp') return base+(active?'background:#0e7490;color:#fff;font-weight:700;':'background:#e2e8f0;color:#64748b;');
    return base+(active?'background:#7c3aed;color:#fff;font-weight:700;':'background:#e2e8f0;color:#64748b;');
  };
  var mark={out:'⛔',warn:'⚡'};
  var rows=items.map(function(c,i){
    return '<div id="c16gi_'+i+'" style="display:flex;align-items:center;gap:4px;padding:3px 0;border-bottom:1px dashed #e5e7eb;">'
      +'<div style="flex:1;font-size:11px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(mark[c.severity]||'')+' '+String(c.title||'').replace(/</g,'&lt;')+'</div>'
      +'<button data-s="corp" onclick="_c16GuideToggle('+i+',\'corp\')" style="'+_c16PillCss(c._side==='corp','corp')+'">企業側</button>'
      +'<button data-s="in" onclick="_c16GuideToggle('+i+',\'in\')" style="'+_c16PillCss(c._side==='in','in')+'">当社側</button>'
      +'</div>';
  }).join('');
  var old=document.getElementById('c16GuideModal'); if(old) old.remove();
  var html='<div id="c16GuideModal" style="position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:center;justify-content:center;" onclick="if(event.target.id===\'c16GuideModal\')this.remove()">'
    +'<div style="background:#fff;width:min(900px,94vw);max-height:90vh;display:flex;flex-direction:column;border-radius:12px;overflow:hidden;font-family:\'Noto Sans JP\',sans-serif;">'
    +'<div style="padding:10px 16px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">'
    +'<div style="font-weight:800;font-size:14px;">📝 修正依頼の案内文　<span id="c16GuideCount" style="font-size:11px;color:#64748b;font-weight:400;"></span></div>'
    +'<button onclick="document.getElementById(\'c16GuideModal\').remove()" style="border:none;background:#e2e8f0;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px;">閉じる</button></div>'
    +'<div style="padding:6px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">'
    +'<div style="font-size:10.5px;color:#64748b;margin-bottom:3px;">各指摘の担当を切り替えると、下の2つの文面に即反映されます（入力・計算ミス系は既定で当社側）。</div>'
    +rows+'</div>'
    +'<div style="display:flex;gap:12px;padding:10px 16px 14px;flex:1;min-height:0;flex-wrap:wrap;">'
    +'<div style="flex:1;min-width:300px;display:flex;flex-direction:column;">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
    +'<div style="font-weight:700;font-size:12px;color:#0e7490;">🏢 企業様への案内文（そのまま送付可）</div>'
    +'<button onclick="var t=document.getElementById(\'c16GuideCorp\');t.select();navigator.clipboard.writeText(t.value).then(function(){showToast(\'📋 企業向けをコピーしました\');});" style="border:none;background:#0e7490;color:#fff;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:11px;font-weight:700;">📋 コピー</button></div>'
    +'<textarea id="c16GuideCorp" style="flex:1;min-height:300px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;line-height:1.7;font-family:inherit;resize:vertical;"></textarea></div>'
    +'<div style="flex:1;min-width:300px;display:flex;flex-direction:column;">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
    +'<div style="font-weight:700;font-size:12px;color:#7c3aed;">🏠 当社側の修正メモ（案シスコメント用）</div>'
    +'<button onclick="var t=document.getElementById(\'c16GuideIn\');t.select();navigator.clipboard.writeText(t.value).then(function(){showToast(\'📋 当社側メモをコピーしました\');});" style="border:none;background:#7c3aed;color:#fff;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:11px;font-weight:700;">📋 コピー</button></div>'
    +'<textarea id="c16GuideIn" style="flex:1;min-height:300px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;line-height:1.7;font-family:inherit;resize:vertical;"></textarea></div>'
    +'</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  refresh();
};

function _renderCheckPanel(local, aiChecks, rules, opt){
  opt=opt||{};
  if(!document.getElementById('_check16PrintStyle')){
    var st=document.createElement('style'); st.id='_check16PrintStyle';
    st.textContent='@media print{#aiCheck16Panel{display:none!important}}';
    document.head.appendChild(st);
  }
  var area=document.getElementById('pageArea'); if(!area) return;
  var oldP=document.getElementById('aiCheck16Panel'); if(oldP) oldP.remove();
  var all=(local||[]).concat(aiChecks||[]);
  var mark={out:'⛔',warn:'⚡',ok:'✅'};
  var outN=all.filter(function(c){return c.severity==='out';}).length;
  var warnN=all.filter(function(c){return c.severity==='warn';}).length;
  var okN=all.filter(function(c){return c.severity==='ok';}).length;
  var pageOrder=['P1','P2','P3','P4','P5','P6','P7','P8'];
  var pageLabels={};
  if(rules&&rules.pages){ rules.pages.forEach(function(pg){ pageLabels[pg.page]=pg.label||''; }); }
  var today=new Date();
  var cardBase='background:#fff;border-radius:10px;box-shadow:0 1px 6px rgba(0,0,0,.22);padding:9px 11px;box-sizing:border-box;font-family:\'Noto Sans JP\',sans-serif;';
  function headerCardHtml(width){
    return '<div class="c16-card" data-kind="header" style="'+cardBase+'width:'+width+'px;">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">'
      +'<div style="font-weight:800;font-size:13px;">🧬 AI判定結果</div>'
      +'<div style="display:flex;gap:4px;">'
      +'<button onclick="openC16GuideText()" title="修正依頼の案内文を生成（案シスコメント・企業連絡用）" style="border:none;background:#0e7490;color:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px;">📝 案内文</button>'
      +'<button onclick="aiCheck16()" style="border:none;background:#b45309;color:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px;">🔁</button>'
      +'<button onclick="document.getElementById(\'aiCheck16Panel\').remove()" style="border:none;background:#e2e8f0;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px;">✕</button></div></div>'
      +'<div style="font-size:10.5px;color:#64748b;margin-top:2px;">'+today.getFullYear()+'/'+(today.getMonth()+1)+'/'+today.getDate()
      +'　⛔'+outN+'　⚡'+warnN+'　✅'+okN
      +(opt.loading?'　<span style="color:#7c3aed;font-weight:700;">AI判定中…</span>':'')+'</div>'
      +(opt.note?'<div style="font-size:10px;color:#b45309;background:#fef3c7;padding:4px 6px;border-radius:6px;margin-top:5px;line-height:1.5;">'+opt.note+'</div>':'')
      +'<div style="font-size:9.5px;color:#94a3b8;margin-top:5px;">各カードは指摘箇所の横に表示されます。📋 判定項目の一覧は ⚙️設定内の「🧬 1-6号 AI判定項目」で確認できます。</div></div>';
  }
  function checkCardHtml(c, width){
    var hl = c.severity==='out' ? 'border-left:4px solid #dc2626;background:#fff5f5;' : (c.severity==='warn'?'border-left:4px solid #d97706;background:#fffcf0;':'border-left:4px solid #16a34a;');
    var pg=(c.page&&pageOrder.indexOf(c.page)>=0)?c.page:'';
    return '<div class="c16-card" data-kind="check" style="'+cardBase+hl+'width:'+width+'px;">'
      +'<div style="display:flex;gap:6px;align-items:flex-start;">'
      +'<div style="flex:0 0 auto;font-size:13px;">'+(mark[c.severity]||'・')+'</div>'
      +'<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:12px;line-height:1.4;">'+String(c.title||'').replace(/</g,'&lt;')+'</div>'
      +'<div style="font-size:11px;color:#475569;margin-top:1px;line-height:1.5;">'+String(c.detail||'').replace(/</g,'&lt;')+'</div>'
      +'<div style="font-size:9.5px;color:#94a3b8;margin-top:2px;">'+(pg?pg+'／':'')+String(c.category||'')+'／'+(c.src||'AI')+'</div></div></div></div>';
  }
  if(getComputedStyle(area).position==='static') area.style.position='relative';
  var doc=area.querySelector('.doc');
  var sideW=0, left=0;
  if(doc){
    var docRight = doc.offsetLeft + doc.offsetWidth;
    var avail = area.clientWidth - docRight - 20;
    sideW = Math.min(330, avail); left = docRight + 12;
  }
  if(doc && sideW>=200){
    // ── サイドコメント方式: 各指摘カードを「対象箇所の横」にアンカー
    var docs=Array.prototype.slice.call(area.querySelectorAll('.doc'));
    var wrap=document.createElement('div');
    wrap.id='aiCheck16Panel';
    wrap.style.cssText='position:absolute;top:0;left:'+left+'px;width:'+sideW+'px;z-index:50;';
    wrap.innerHTML=headerCardHtml(sideW);
    // アンカー位置を先に計算し、位置順に並べる
    var items=all.map(function(c){ return {c:c, y:_c16AnchorY(c, docs, area, pageOrder)}; });
    items.sort(function(a,b){ return a.y-b.y; });
    items.forEach(function(it){ wrap.insertAdjacentHTML('beforeend', checkCardHtml(it.c, sideW)); });
    area.appendChild(wrap);
    var cards=Array.prototype.slice.call(wrap.querySelectorAll('.c16-card'));
    var cursor=0;
    cards.forEach(function(card,i){
      var want = (i===0) ? 0 : items[i-1].y - 6; // 先頭はヘッダー
      var top=Math.max(want, cursor);
      card.style.position='absolute'; card.style.top=top+'px'; card.style.left='0';
      cursor=top+card.offsetHeight+8;
    });
    wrap.style.height=cursor+'px';
    if(!opt.keepScroll){ try{ wrap.querySelector('.c16-card').scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){} }
  } else {
    // ── フォールバック: 画面が狭いときは最上部にまとめて表示（ページ順）
    var sevOrder={out:0,warn:1,ok:2};
    var groups={};
    all.forEach(function(c){ var pg=(c.page&&pageOrder.indexOf(c.page)>=0)?c.page:'全体'; (groups[pg]=groups[pg]||[]).push(c); });
    var docW=(doc||{}).offsetWidth||794;
    var inner='';
    pageOrder.concat(['全体']).forEach(function(pg){
      if(!groups[pg]||!groups[pg].length) return;
      groups[pg].sort(function(a,b){var sa=(a.severity in sevOrder)?sevOrder[a.severity]:3, sb=(b.severity in sevOrder)?sevOrder[b.severity]:3; return sa-sb;});
      inner+='<div style="margin:12px 0 2px;font-weight:800;font-size:13px;border-bottom:2px solid #0f172a;padding-bottom:2px;">📄 '+(pg==='全体'?'全体':pg+(pageLabels[pg]?'｜'+pageLabels[pg]:''))+'</div>';
      groups[pg].forEach(function(c){ inner+=checkCardHtml(c, docW-60).replace(/box-shadow:[^;]+;/,'').replace(/width:\d+px/,'width:100%').replace('class="c16-card" ',''); });
    });
    var html='<div id="aiCheck16Panel" style="width:'+docW+'px;max-width:96%;margin:0 auto 24px;'+cardBase+'padding:20px 26px;">'
      +headerCardHtml(docW-52).replace(/width:\d+px/,'width:100%').replace('class="c16-card" ','')
      +inner+'</div>';
    area.insertAdjacentHTML('afterbegin', html);
    var panel=document.getElementById('aiCheck16Panel');
    if(panel && !opt.keepScroll) panel.scrollIntoView({behavior:'smooth', block:'start'});
  }
}

// ver.20261023.04: 雇用条件セットが未選択のとき、1番目（や自動で選んだセット）を黙って使わない。
//   これまでは未選択なら自動で選んで cases.emp_set_idx に書き戻していたため、同じ会社の別の人のセットで
//   書類ができてしまうことがあった（同名会社の取り違え・RHIJHAL の件）。
//   いまは「どの雇用条件セットか選んでください」の画面を出し、選んだものを案件に保存して使う。
//   キャンセル・裏で開いている画面（まとめ印刷・案シスからの作成）では選ばずに -1 を返す（雇用条件の欄は空）。
//   ・自動で選んでいた候補は「おすすめ」の印として見せるだけ（empSetGuessIdx）
window.empSetGuessIdx = function(sets, cas, info){
  sets = Array.isArray(sets) ? sets : [];
  if(!sets.length) return -1;
  const norm = v => String(v||'').replace(/[\s　]+/g,'').toLowerCase();
  const names = [];
  if(cas && cas.applicant) names.push(norm(cas.applicant));
  if(info && info.applicantName) names.push(norm(info.applicantName));
  if(info && info.applicantNameEn) names.push(norm(info.applicantNameEn));
  if(info && info.applicant) names.push(norm(info.applicant));
  const caseName = norm(cas && cas.name);
  let best = -1, bestScore = -1, bestNameHit = false;
  sets.forEach((es, i) => {
    if(!es) return;
    const sn = norm(es.setName || es.name);
    let score = 0, hit = false;
    if(sn && names.some(n => n && n.length >= 3 && sn.indexOf(n) >= 0)){ score += 1000; hit = true; }
    if(sn && caseName && caseName.length >= 3 && (sn.indexOf(caseName) >= 0 || caseName.indexOf(sn) >= 0)){ score += 500; hit = true; }
    let filled = 0;
    Object.keys(es).forEach(k => { if(k.charAt(0)!=='_' && es[k]!=null && String(es[k])!=='' && typeof es[k]!=='object') filled++; });
    score += Math.min(filled, 400);
    if(score > bestScore){ bestScore = score; best = i; bestNameHit = hit; }
  });
  window._empGuessNameHit = bestNameHit;
  return best;
};
// この画面が「見えない枠」の中か（まとめ印刷・案シスからの書類作成は画面の外の枠で開く）。見えないときは選ぶ画面を出さない
function _empFrameHidden(){
  try{
    if(window.self === window.top) return false;
    const fe = window.frameElement;
    if(!fe) return true;
    const w = fe.ownerDocument && fe.ownerDocument.defaultView;
    const cs = w ? w.getComputedStyle(fe) : null;
    if(cs && (cs.display === 'none' || cs.visibility === 'hidden')) return true;
    const r = fe.getBoundingClientRect();
    if(r.width < 50 || r.height < 50) return true;
    if(r.right <= 0 || r.bottom <= 0) return true;
    if(w && (r.left >= w.innerWidth || r.top >= w.innerHeight)) return true;
    return false;
  }catch(e){ return true; }
}
function _empEsc(v){ return String(v==null?'':v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
// 雇用条件セットを選ぶ画面。o:{sets, guess, coName, orgName, applicant}  → 選んだ番号（キャンセルは -1）
window.chooseEmpSetDialog = function(o){
  return new Promise(resolve => {
    const sets = o.sets || [];
    const old = document.getElementById('_empChooseModal'); if(old) old.remove();
    const wrap = document.createElement('div');
    wrap.id = '_empChooseModal';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:14px;font-family:sans-serif;';
    const rows = sets.map((es, i) => {
      es = es || {};
      const nm = es.setName || es.name || ('条件セット' + (i+1));
      const fld = es.applicantField || es.field || '';
      const cat = es.category || '';
      const cre = (es.createY && es.createM) ? (es.createY + '年' + parseInt(es.createM,10) + '月' + (es.createD ? parseInt(es.createD,10) + '日' : '')) : '';
      const pay = es.salaryMonthly ? ('月給 ' + es.salaryMonthly) : (es.salaryHourly ? ('時給 ' + es.salaryHourly) : '');
      const sub = [fld && ('分野：' + fld), cat && ('業務区分：' + cat), pay, cre && ('作成 ' + cre)].filter(Boolean).map(_empEsc).join('　／　');
      const tag = (i === o.guess) ? '<span style="display:inline-block;margin-left:6px;font-size:11px;font-weight:800;padding:1px 8px;border-radius:999px;background:#dbeafe;color:#1d4ed8;">💡 おすすめ' + (window._empGuessNameHit ? '（名前が一致）' : '') + '</span>' : '';
      return '<label class="_ecRow" data-i="' + i + '" style="display:flex;gap:10px;align-items:flex-start;border:2px solid #e2e8f0;border-radius:10px;padding:9px 12px;margin-bottom:8px;cursor:pointer;background:#fff;">'
        + '<input type="radio" name="_ecPick" value="' + i + '" style="margin-top:3px;width:16px;height:16px;flex-shrink:0;">'
        + '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:800;color:#0f172a;">' + (i+1) + '. ' + _empEsc(nm) + tag + '</div>'
        + (sub ? '<div style="font-size:12px;color:#475569;margin-top:3px;line-height:1.5;">' + sub + '</div>' : '')
        + '</div></label>';
    }).join('');
    wrap.innerHTML = '<div style="background:#fff;border-radius:14px;width:min(600px,96vw);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.3);">'
      + '<div style="padding:16px 18px 12px;border-bottom:1px solid #e2e8f0;">'
      +   '<div style="font-size:16px;font-weight:800;color:#0f172a;">📑 雇用条件セットを選んでください</div>'
      +   '<div style="font-size:13px;color:#334155;margin-top:6px;line-height:1.6;">この案件は、まだ雇用条件セットが選ばれていません。<b>この人の雇用条件</b>を選んでください。選んだセットはこの案件に保存されます。</div>'
      +   '<div style="font-size:12.5px;color:#334155;margin-top:6px;line-height:1.6;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px;">'
      +     '申請人：<b>' + _empEsc(o.applicant || '—') + '</b>　／　所属機関：<b>' + _empEsc(o.coName || '—') + '</b>' + (o.orgName ? '（登録支援機関：' + _empEsc(o.orgName) + '）' : '')
      +   '</div>'
      +   '<div style="font-size:11.5px;color:#92400e;margin-top:6px;">※ 1番目のセットが、この人のものとは限りません。名前や分野・給与を見て選んでください。所属機関が違うときは、案シスで所属機関を直してください。</div>'
      + '</div>'
      + '<div style="padding:12px 18px;overflow:auto;">' + rows + '</div>'
      + '<div style="padding:12px 18px 16px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #f1f5f9;flex-wrap:wrap;">'
      +   '<button data-k="cancel" style="background:#fff;color:#334155;border:1px solid #cbd5e1;padding:9px 14px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">選ばない（雇用条件は空のまま）</button>'
      +   '<button data-k="ok" id="_ecOk" disabled style="background:#2563eb;color:#fff;border:none;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:800;cursor:not-allowed;opacity:.45;">このセットを使う</button>'
      + '</div></div>';
    let sel = -1;
    const paint = () => {
      wrap.querySelectorAll('._ecRow').forEach(r => {
        const on = parseInt(r.getAttribute('data-i'),10) === sel;
        r.style.borderColor = on ? '#2563eb' : '#e2e8f0'; r.style.background = on ? '#eff6ff' : '#fff';
        const rb = r.querySelector('input'); if(rb) rb.checked = on;
      });
      const ok = wrap.querySelector('#_ecOk');
      ok.disabled = sel < 0; ok.style.opacity = sel < 0 ? '.45' : '1'; ok.style.cursor = sel < 0 ? 'not-allowed' : 'pointer';
    };
    const close = v => { try{ wrap.remove(); }catch(e){} resolve(v); };
    wrap.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('button[data-k]');
      if(b){ const k = b.getAttribute('data-k'); if(k === 'cancel'){ close(-1); return; } if(k === 'ok' && sel >= 0){ close(sel); } return; }
      const r = e.target.closest && e.target.closest('._ecRow');
      if(r){ sel = parseInt(r.getAttribute('data-i'),10); paint(); }
    });
    (document.body || document.documentElement).appendChild(wrap);
    paint();
  });
};
var _empAskPending = window._empAskPending = window._empAskPending || {};    // caseId → 選ぶ画面の Promise（同じ読み込みの中で2回出さない）
var _empAskCanceled = window._empAskCanceled = window._empAskCanceled || {};   // caseId → 「選ばない」を押した時刻（すぐあとの読み込みで聞き直さない）
window.resolveEmpSetIdx = async function(co, cas, info){
  const sets = (co && Array.isArray(co.emp_sets)) ? co.emp_sets : [];
  const raw = (cas && cas.emp_set_idx != null && String(cas.emp_set_idx) !== '') ? String(cas.emp_set_idx)
            : (info && info.empSetIdx != null && String(info.empSetIdx) !== '') ? String(info.empSetIdx) : '';
  if(raw !== '' && !isNaN(parseInt(raw,10)) && parseInt(raw,10) >= 0 && sets[parseInt(raw,10)]) return parseInt(raw,10);
  if(!sets.length) return 0;   // セットが1つも無い会社：sets[0] は無いので雇用条件は空のまま（従来どおり）
  const caseId = (cas && cas.id) || (info && info.caseId) || '';
  if(_empFrameHidden()){
    console.warn('[emp_set] 未選択のため雇用条件は空のまま（見えない画面のため選ぶ画面は出しません）', caseId);
    return -1;
  }
  if(caseId && _empAskCanceled[caseId] && (Date.now() - _empAskCanceled[caseId]) < 15000) return -1;
  if(caseId && _empAskPending[caseId]) return await _empAskPending[caseId];
  const run = (async () => {
    const guess = window.empSetGuessIdx(sets, cas, info);
    const idx = await window.chooseEmpSetDialog({ sets: sets, guess: guess,
      coName: (co && co.name) || (info && info.companyName) || '',
      orgName: (co && co.support_org_name) || (cas && cas.org) || (info && info.orgName) || '',
      applicant: (cas && cas.applicant) || (info && (info.applicant || info.applicantName)) || '' });
    if(idx < 0){
      if(caseId) _empAskCanceled[caseId] = Date.now();
      if(typeof showToast==='function') showToast('雇用条件セットが選ばれていないため、雇用条件の欄は空のままです（上の「雇用条件セット」からも選べます）');
      return -1;
    }
    try{
      if(caseId){
        await sb('cases?id=eq.'+caseId, {method:'PATCH', headers:{'Prefer':'return=minimal'}, body: JSON.stringify({emp_set_idx: String(idx)})});
        try{ if(window.parent && window.parent !== window) window.parent.postMessage({type:'EMP_SET_CHOSEN', caseId: caseId, idx: String(idx)}, '*'); }catch(_e){}
      }
      if(typeof showToast==='function') showToast('雇用条件セットを選んで保存しました: '+((sets[idx]&&(sets[idx].setName||sets[idx].name))||('#'+(idx+1))));
    }catch(_e){
      console.warn('[emp_set] idx save failed', _e);
      alert('雇用条件セットの保存に失敗しました（この画面では選んだセットで表示します）: ' + (_e && _e.message || _e));
    }
    if(cas) cas.emp_set_idx = String(idx);
    if(info) info.empSetIdx = String(idx);
    return idx;
  })();
  if(caseId) _empAskPending[caseId] = run;
  try{ return await run; } finally { if(caseId) delete _empAskPending[caseId]; }
};

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
  var m=s.match(/^(毎月|翌々月|翌月|当月|翌々|翌)/);
  var prefix = m ? (m[1]==='翌'?'翌月':(m[1]==='翌々'?'翌々月':m[1])) : (defPrefix||'毎月');
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
      .replace(/\s*\([^()]*\)\s*$/,'')   // ver.20261105.08: 訳の末尾の「(Lĩnh vực xây dựng - …)」等（分野・号の訳）も表示しない。2つ目は案シスの値を変えないよう入力欄では括弧を残すため
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
// ver.20261111.02: 1-17号「出迎え空港等」の空港名の訳（よく使う空港）。ない空港は空欄にして「訳がない欄」で知らせる
var _AIRPORT_TR={
  narita:{en:'Narita International Airport',id:'Bandara Internasional Narita',km:'ព្រលានយន្តហោះអន្តរជាតិណារីតា',my:'နာရီတာ အပြည်ပြည်ဆိုင်ရာ လေဆိပ်',ne:'नारिता अन्तर्राष्ट्रिय विमानस्थल',th:'ท่าอากาศยานนานาชาตินาริตะ',vi:'Sân bay quốc tế Narita',zh:'成田国际机场'},
  haneda:{en:'Haneda Airport (Tokyo International Airport)',id:'Bandara Haneda (Bandara Internasional Tokyo)',km:'ព្រលានយន្តហោះហាណេដា',my:'ဟာနဲဒါ လေဆိပ်',ne:'हानेदा विमानस्थल',th:'ท่าอากาศยานฮาเนดะ',vi:'Sân bay Haneda',zh:'羽田机场（东京国际机场）'},
  kansai:{en:'Kansai International Airport',id:'Bandara Internasional Kansai',km:'ព្រលានយន្តហោះអន្តរជាតិកានសៃ',my:'ခန်ဆိုင်း အပြည်ပြည်ဆိုင်ရာ လေဆိပ်',ne:'कान्साई अन्तर्राष्ट्रिय विमानस्थल',th:'ท่าอากาศยานนานาชาติคันไซ',vi:'Sân bay quốc tế Kansai',zh:'关西国际机场'},
  chubu:{en:'Chubu Centrair International Airport',id:'Bandara Internasional Chubu Centrair',km:'ព្រលានយន្តហោះអន្តរជាតិឈូប៊ូ',my:'ချူးဘူး အပြည်ပြည်ဆိုင်ရာ လေဆိပ်',ne:'चुबु अन्तर्राष्ट्रिय विमानस्थल',th:'ท่าอากาศยานนานาชาติชูบุ',vi:'Sân bay quốc tế Chubu',zh:'中部国际机场'},
  fukuoka:{en:'Fukuoka Airport',id:'Bandara Fukuoka',km:'ព្រលានយន្តហោះហ្វូគូអូកា',my:'ဖူကူအိုကာ လေဆိပ်',ne:'फुकुओका विमानस्थल',th:'ท่าอากาศยานฟุกุโอกะ',vi:'Sân bay Fukuoka',zh:'福冈机场'},
  chitose:{en:'New Chitose Airport',id:'Bandara New Chitose',km:'ព្រលានយន្តហោះស៊ីនឈីតូសេ',my:'ချီတိုဆေး လေဆိပ်သစ်',ne:'नयाँ चितोसे विमानस्थल',th:'ท่าอากาศยานนิวชิโตเสะ',vi:'Sân bay Shin-Chitose',zh:'新千岁机场'},
  naha:{en:'Naha Airport',id:'Bandara Naha',km:'ព្រលានយន្តហោះណាហា',my:'နာဟာ လေဆိပ်',ne:'नाहा विमानस्थल',th:'ท่าอากาศยานนาฮะ',vi:'Sân bay Naha',zh:'那霸机场'}
};
window._airportTr=function(ja, lang){
  var t=String(ja||'').normalize('NFKC').replace(/\s/g,'');
  var k=/成田/.test(t)?'narita':/羽田|東京国際/.test(t)?'haneda':/関西|関空/.test(t)?'kansai':/中部|セントレア/.test(t)?'chubu':/福岡/.test(t)?'fukuoka':/千歳/.test(t)?'chitose':/那覇/.test(t)?'naha':'';
  return k ? (_AIRPORT_TR[k][lang]||'') : '';
};
// ver.20261109.12: 1-6号の「賃金支払方法」を、案シスの雇用条件（支払方法）から付ける（前は口座振込に固定だった）
function _payMethodText(){ try{ return String((window._empLoadedSet||{}).payMethod||'').normalize('NFKC'); }catch(e){ return ''; } }
function _payCash(){ return /現金|通貨|手渡|cash/i.test(_payMethodText()); }
function _payBank(){ var m=_payMethodText(); return !m || /口座|振込|振り込|銀行|bank/i.test(m) || !_payCash(); }
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
// ver.20261002.01: 就業規則の条番号（案シス workRule<区分><1-3><From/To>）を各言語の訳にも入れる
function _wrPairs(pfx){
  var s=window._empLoadedSet||{}, out=[];
  for(var i=1;i<=3;i++){
    var a=String(s['workRule'+pfx+i+'From']||'').replace(/[^0-9]/g,'');
    var b=String(s['workRule'+pfx+i+'To']||'').replace(/[^0-9]/g,'');
    if(a||b) out.push([a,b]);
  }
  return out;
}
function _wrHas(pfx){ return _wrPairs(pfx).length>0; }
var _WR_TR={
  id:{pre:'◦Detail ditetapkan dalam Peraturan Kerja ', post:'', sep:', ', one:function(n){return 'pasal '+n;}, rng:function(a,b){return 'pasal '+a+' sampai pasal '+b;}},
  en:{pre:'○ Details are stipulated in ', post:' of the Work Rules', sep:', ', one:function(n){return 'Article '+n;}, rng:function(a,b){return 'Articles '+a+' to '+b;}},
  vi:{pre:'◦Chi tiết xem trong Nội quy lao động ', post:'', sep:', ', one:function(n){return 'Điều '+n;}, rng:function(a,b){return 'Điều '+a+' đến Điều '+b;}},
  zh:{pre:'◦详细内容参见就业规则 ', post:'', sep:'、', one:function(n){return '第'+n+'条';}, rng:function(a,b){return '第'+a+'条至第'+b+'条';}},
  ko:{pre:'○ 자세한 내용은 취업 규칙 ', post:'', sep:', ', one:function(n){return '제'+n+'조';}, rng:function(a,b){return '제'+a+'조~제'+b+'조';}},
  th:{pre:'○ รายละเอียดอยู่ในข้อบังคับการปฏิบัติงาน ', post:'', sep:', ', one:function(n){return 'ข้อที่ '+n;}, rng:function(a,b){return 'ข้อที่ '+a+' ถึงข้อที่ '+b;}},
  my:{pre:'○အသေးစိတ်မှာ အလုပ်ခန့်စည်းမျဉ်း ', post:' တွင်ဖော်ပြသည်', sep:' ၊ ', one:function(n){return 'အချက် '+n;}, rng:function(a,b){return 'အချက် '+a+' မှ အချက် '+b;}},
  ne:{pre:'○विस्तृत रूपमा, कामको नियमको ', post:' मा उल्लेख छ।', sep:', ', one:function(n){return 'धारा '+n;}, rng:function(a,b){return 'धारा '+a+' देखि धारा '+b;}},
  si:{pre:'○විස්තර සඳහා සේවා නීතිරීතිවල ', post:' බලන්න.', sep:', ', one:function(n){return n+' වන වගන්තිය';}, rng:function(a,b){return a+' වන වගන්තියේ සිට '+b+' වන වගන්තිය දක්වා';}},
  km:{pre:'◦សម្រាប់ព័ត៌មានលម្អិត សូមមើលបទបញ្ជាការងារ ', post:'', sep:', ', one:function(n){return 'មាត្រា '+n;}, rng:function(a,b){return 'មាត្រា '+a+' ដល់មាត្រា '+b;}}
};
function _wrTR(pfx, lang){
  var t=_WR_TR[lang]||_WR_TR.en;
  var parts=_wrPairs(pfx).map(function(p){
    var a=p[0], b=p[1];
    if(a&&b&&a!==b) return t.rng(a,b);
    return t.one(a||b);
  });
  return '<span class="f">'+t.pre+parts.join(t.sep)+t.post+'</span>';
}
function healthFreqIsHalf(){
  try{
    var s=window._empLoadedSet||{}; var v=String(s.healthCheckFreq||'').trim();
    return /年\s*2\s*回|半年|2\s*回|半期|setengah|twice/i.test(v);
  }catch(_e){ return false; }
}
function healthFreqJP(){
  return healthFreqIsHalf() ? 'その後半年ごとに実施' : 'その後１年ごとに実施';
}
// ver.20260930.01: 定期健診の頻度フレーズ（各言語の訳）。日本語（healthFreqJP）と同じ判定で「1年ごと／半年ごと」を切り替える
var _HEALTH_FREQ_TR={
  id:['setelah itu dilakukan setiap 1 tahun','setelah itu dilakukan setiap 6 bulan'],
  en:['every 1 year afterwards','every 6 months afterwards'],
  vi:['sau đó thực hiện mỗi năm 1 lần','sau đó thực hiện 6 tháng 1 lần'],
  zh:['然后每1年实施','然后每半年实施'],
  ko:['그 후 1년마다 실시','그 후 반년마다 실시'],
  th:['ดำเนินการทุกปีหลังจากนั้น','ดำเนินการทุก 6 เดือนหลังจากนั้น'],
  my:['နောက်ပိုင်း ၁ နှစ်အလိုက်ဆေးစစ်ခြင်း','နောက်ပိုင်း ၆ လအလိုက်ဆေးစစ်ခြင်း'],
  ne:['त्यसपछि प्रत्येक १ वर्षमा','त्यसपछि प्रत्येक ६ महिनामा'],
  si:['ඉන්පසු සෑම වසරකට වරක් පවත්වනු ලැබේ','ඉන්පසු සෑම මාස හයකට වරක් පවත්වනු ලැබේ'],
  km:['បន្ទាប់មកអនុវត្តម្តងក្នុងមួយឆ្នាំ','បន្ទាប់មកអនុវត្តរៀងរាល់ ៦ ខែម្តង']
};
function healthFreqTR(lang){
  var t=_HEALTH_FREQ_TR[lang]||_HEALTH_FREQ_TR.en;
  return healthFreqIsHalf() ? t[1] : t[0];
}
// ⑤: 現在ログイン中のユーザー識別子（メール等）を認証トークンから取得（保存ログ用）
function _currentUserId(){
  try{ var t=_sbToken(); if(!t) return ''; var seg=t.split('.')[1]; if(!seg) return ''; var p=JSON.parse(decodeURIComponent(escape(atob(seg.replace(/-/g,'+').replace(/_/g,'/'))))); return p.email||p.sub||''; }catch(e){ return ''; }
}

/* ============================================================
   applyBindings: 編集呼び出し後に data-bind スパンへ現在値を差し込む
   p()（全再描画）を使わずに変数スパンだけ更新する
   ============================================================ */
/* ver.20261112.02: 1-6号 別紙の手当。空欄のまま保存した直接編集版には金額・計算方法の欄そのものが無く、
   あとでサイドバーに入れても書類に出なかった。足りない欄をその場で足してから値を流し込む（全言語版共通）。 */
function _annexAllowRepair(area){
  if(!area || !document.getElementById('es_a1Amt')) return;
  var mk=function(id,money){ var s=document.createElement('span'); s.className='f'; s.setAttribute('data-bind',id); if(money) s.setAttribute('data-bind-fmt','1'); return s; };
  var has=function(div,ids){ return ids.some(function(id){ return !!div.querySelector('[data-bind="'+id+'"]'); }); };
  var after=function(div,re,sp){
    var ns=Array.from(div.childNodes);
    for(var i=0;i<ns.length;i++){ var n=ns[i]; if(n.nodeType!==3) continue; var m=re.exec(n.nodeValue); if(!m) continue;
      var rest=n.splitText(m.index+m[0].length); div.insertBefore(sp,rest); return true; }
    return false;
  };
  var beforeLast=function(div,ch,sp){
    var ns=Array.from(div.childNodes);
    for(var i=ns.length-1;i>=0;i--){ var n=ns[i]; if(n.nodeType!==3) continue; var k=n.nodeValue.lastIndexOf(ch); if(k<0) continue;
      var rest=n.splitText(k); div.insertBefore(sp,rest); return true; }
    return false;
  };
  ['a','b','c','d','e','f'].forEach(function(ltr,i){
    var idx=i+1, P='es_a'+idx;
    Array.from(area.querySelectorAll('div')).forEach(function(div){
      var t=(div.textContent||'').replace(/^\s+/,'');
      if(t.indexOf('('+ltr+')（')!==0 || t.indexOf('計算方法')<0 || t.indexOf('手当')<0) return;
      if(div.querySelector('div')) return;
      // 日本語の行
      if(!has(div,[P+'Name'])) after(div,/^[\s　]*\([a-f]\)（/,mk(P+'Name'));
      if(!has(div,[P+'Amt'])) after(div,/手当[\s　]*月[\s　]*/,mk(P+'Amt',true));
      if(!has(div,[P+'Calc'])) after(div,/計算方法[：:][\s　]*/,mk(P+'Calc'));
      // すぐ下の訳の行
      var tr=div.nextElementSibling;
      if(!tr || tr.tagName!=='DIV' || tr.querySelector('div')) return;
      var tt=(tr.textContent||'').replace(/^\s+/,'');
      if(tt.indexOf('('+ltr+')')!==0) return;
      // 名称（訳）：英・韓・ネパール語は「名称＋手当」の順、ほかは「手当＋名称」の順
      if(!has(tr,[P+'NameEn'])){
        if(/^\s*\([a-f]\)\s?[（(]\s*(allowance|수당|भत्ता)/.test(tr.textContent||'')) after(tr,/^\s*\([a-f]\)\s?[（(]/,mk(P+'NameEn'));
        else { var _nn=Array.from(tr.childNodes); for(var _i=0;_i<_nn.length;_i++){ var _n=_nn[_i]; if(_n.nodeType!==3) continue; var _m=/[\s　]*[,，]/.exec(_n.nodeValue); if(!_m) continue; var _r=_n.splitText(_m.index); tr.insertBefore(mk(P+'NameEn'),_r); break; } }
      }
      if(!has(tr,[P+'Amt',P+'AmtEn'])) after(tr,/[,，][\s　]*/,mk(P+'Amt',true));
      if(!has(tr,[P+'CalcEn'])) beforeLast(tr,'）',mk(P+'CalcEn'));
    });
  });
}
const _OPT_SECOND_BINDS={es_category2:1,es_category2En:1,es_applicantField2:1,es_applicantField2En:1};
function applyBindings(){
  const area=document.getElementById('pageArea');if(!area)return;
  // ver.20261027.01: 変数欄の中に直接打った文字を、流し直しで消さない
  try{ if(typeof _reconcileBindEdits==='function' && !window._bindReconciling) _reconcileBindEdits(); }catch(_e){}
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
  try{ _annexAllowRepair(area); }catch(_e){}
  const spans=area.querySelectorAll('[data-bind]');
  spans.forEach(span=>{
    const id=span.getAttribute('data-bind');
    let raw=(typeof v==='function'?v(id):'')|| (window._fieldData&&window._fieldData[id])||'';
    // ver.20261112.16: 変形労働時間制の単位は書類に「（　）単位の変形労働時間制」と印字済み。案シスの「1ヶ月単位」をそのまま入れると「単位」が二重になる
    if((id==='es_flexUnit'||id==='es_flexType') && raw) raw=String(raw).replace(/単位/g,'').trim();
    const label=id.replace(/^es_/,'es.').replace(/^f_/,'');
    // ver.20261102.01: 「2つ目がある場合のみ」の欄（業務区分２・分野２）は、空なら「・es.category2」を出さない
    //   （直接編集版・呼び戻した書類に、空欄の目印と区切りの「・」が残っていた）
    if(_OPT_SECOND_BINDS[id]){
      var _prev=span.previousSibling;
      if(!raw){
        span.textContent=''; span.style.color='';span.style.fontSize='';span.style.fontFamily='';
        span.style.display='none';
        if(_prev && _prev.nodeType===3 && /・\s*$/.test(_prev.nodeValue)){
          _prev.nodeValue=_prev.nodeValue.replace(/・(\s*)$/,'$1'); span.setAttribute('data-opt-sep','・');
        }
        return;
      }
      span.style.display='';
      if(span.getAttribute('data-opt-sep')){
        if(_prev && _prev.nodeType===3) _prev.nodeValue=_prev.nodeValue.replace(/\s*$/,'')+span.getAttribute('data-opt-sep');
        else span.parentNode.insertBefore(document.createTextNode(span.getAttribute('data-opt-sep')), span);
        span.removeAttribute('data-opt-sep');
      }
    }
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
  // ver.20261102.01: 業務区分（1-6号 Ⅲ-2）は「1つ目・2つ目」を中点でつないだ形のまま直接編集版に保存されているため、
  //   2つ目が空だと「建築・es.category2」と出ていた。2つ目が空（または1つ目と同じ）なら、2つ目と「・」を隠して
  //   1つ目だけを（セルの中央に）出す。2つ目に値が入れば「・」ごと元に戻す。
  try{ _bunyaPairTidy(area); }catch(_e){}
  try{ _snapBinds(); }catch(_e){} // ver.20261027.01: 流し込んだ後の中身を基準にする
  return spans.length; // data-bind スパン数を返す（0=旧形式）
}
function _bunyaPairTidy(area){
  var _clean=function(x){ return String(x||'').replace(/[（(][^）)]*(分野|特定技能)[^）)]*[）)]/g,'').replace(/[（(][^）)]*(分野|特定技能)[^）)]*$/,'').replace(/\s*\([^()]*\)\s*$/,'').trim(); };
  [['es_category','es_category2'],['es_categoryEn','es_category2En']].forEach(function(pr){
    // ver.20261113.01: 古い雛形で作った直接編集版は「業務区分・業務区分・業務区分」のように同じ欄（es_category）が
    //   3つ並んだまま保存されており、同じ内容が3回出ていた。同じ親の中で2つ目以降の同じ欄は「・」ごと隠し、1つ目だけを出す
    //   （2つ目の区分に値があるときは、このあとの処理で「・2つ目」が足される）。
    try{
      var _seen=[];
      area.querySelectorAll('span.f[data-bind="'+pr[0]+'"]').forEach(function(sp){
        var par=sp.parentNode; if(!par) return;
        if(_seen.indexOf(par)<0){ _seen.push(par); return; }
        var prev=sp.previousSibling;
        if(prev && prev.nodeType===3) prev.nodeValue=prev.nodeValue.replace(/・\s*$/,'');
        sp.parentNode.removeChild(sp);
      });
    }catch(_e){}
    // ver.20261105.08: 業務区分が1つのときに保存した直接編集版には2つ目の欄そのものが無く、
    //   あとで案シスで2つ目を選んでも出なかった。2つ目に値があれば、1つ目のすぐ後ろに「・2つ目」の欄を足す。
    try{
      var _a=_clean((typeof v==='function'?v(pr[0]):'')||(window._fieldData&&window._fieldData[pr[0]])||'');
      var _b=_clean((typeof v==='function'?v(pr[1]):'')||(window._fieldData&&window._fieldData[pr[1]])||'');
      if(_b && _b!==_a){
        area.querySelectorAll('span.f[data-bind="'+pr[0]+'"]').forEach(function(sp1){
          var par=sp1.parentNode; if(!par || par.querySelector('span.f[data-bind="'+pr[1]+'"]')) return;
          var sp2=document.createElement('span'); sp2.className='f'; sp2.setAttribute('data-bind',pr[1]);
          sp2.innerHTML=(typeof esc==='function'?esc(_b):_b);
          par.insertBefore(sp2, sp1.nextSibling);
          par.insertBefore(document.createTextNode('・'), sp2);
        });
      }
    }catch(_e){}
    // 直接編集版の欄にも、分野・号の括弧書きを除いた値を出す（入力欄・案シスの値はそのまま）
    try{
      pr.forEach(function(id){
        var _c=_clean((typeof v==='function'?v(id):'')||(window._fieldData&&window._fieldData[id])||'');
        if(!_c) return;
        area.querySelectorAll('span.f[data-bind="'+id+'"]').forEach(function(sp){ sp.innerHTML=(typeof esc==='function'?esc(_c):_c); });
      });
    }catch(_e){}
    area.querySelectorAll('span.f[data-bind="'+pr[1]+'"]').forEach(function(sp){
      var v1=_clean((typeof v==='function'?v(pr[0]):'')||(window._fieldData&&window._fieldData[pr[0]])||'');
      var v2=_clean((typeof v==='function'?v(pr[1]):'')||(window._fieldData&&window._fieldData[pr[1]])||'');
      var empty2=!v2 || v2===v1;
      var prev=sp.previousSibling;
      var prevIsText=prev && prev.nodeType===3;
      if(empty2){
        sp.style.display='none';
        if(prevIsText && /・\s*$/.test(prev.nodeValue)){ prev.nodeValue=prev.nodeValue.replace(/・\s*$/,''); sp.setAttribute('data-bunya-sep','1'); }
      }else{
        sp.style.display='';
        if(sp.getAttribute('data-bunya-sep')==='1'){
          if(prevIsText){ if(!/・\s*$/.test(prev.nodeValue)) prev.nodeValue=prev.nodeValue+'・'; }
          else sp.parentNode.insertBefore(document.createTextNode('・'), sp);
          sp.removeAttribute('data-bunya-sep');
        }
      }
    });
  });
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
/* ver.20261027.01: 直接編集で「変数の欄（灰色の es.xxx や差し込まれた値）」の中に文字を打つと、
   保存時に変数欄はプレースホルダへ戻し、読込時・サイドバー変更時に値を流し直すため、
   打った文字が消えていた（例：終業の欄に「23:00）※前記時間帯のうち、シフト制」と入力 → 保存後に es.endTime）。
   対策：編集開始時の変数欄の中身を覚えておき、編集終了・保存の前に見比べて
     ・元の値の前後に書き足した文字 → 変数欄の外（普通の文字）へ移す
     ・値そのものを書き換えた → サイドバーの入力欄へ反映（他の言語の同じ欄・DBにも反映）
     ・中身を全部消した → この書類ではその欄を固定の空欄にする
   ことで、打った文字が消えないようにする。 */
window._bindSnap = window._bindSnap || new WeakMap();
function _snapBinds(){
  try{
    const area=document.getElementById('pageArea'); if(!area) return;
    area.querySelectorAll('[data-bind]').forEach(function(sp){ window._bindSnap.set(sp, sp.innerHTML); });
  }catch(e){}
}
function _bindHtmlToText(h){
  const d=document.createElement('div');
  d.innerHTML=String(h||'').replace(/<br\s*\/?>/gi,'\n');
  return (d.textContent||'').replace(/​/g,'').replace(/ /g,' ');
}
function _reconcileBindEdits(opts){
  opts=opts||{};
  const area=document.getElementById('pageArea'); if(!area) return 0;
  if(window._bindReconciling) return 0;
  window._bindReconciling=true;
  const synced={}; let n=0;
  try{
    area.querySelectorAll('[data-bind]').forEach(function(sp){
      if(!window._bindSnap.has(sp)) return;
      const before=window._bindSnap.get(sp);
      const now=sp.innerHTML;
      if(now===before) return;
      const tNow=_bindHtmlToText(now), tBefore=_bindHtmlToText(before);
      if(tNow===tBefore) return; // 見た目の文字が同じ（改行コード等の差だけ）
      const id=sp.getAttribute('data-bind');
      const label=id.replace(/^es_/,'es.').replace(/^f_/,'');
      // ①元の中身の前後に書き足した → 書き足し分を変数欄の外へ
      const i=now.indexOf(before);
      if(before && i>=0){
        const pre=now.slice(0,i), post=now.slice(i+before.length);
        sp.innerHTML=before;
        if(_bindHtmlToText(pre).trim()) sp.insertAdjacentHTML('beforebegin', pre);
        if(_bindHtmlToText(post).trim()) sp.insertAdjacentHTML('afterend', post);
        n++; return;
      }
      // 元が空欄（es.xxx）で、ラベルを残したまま書き足した → ラベル以外を外へ
      const iL=tNow.indexOf(label);
      if(iL>=0 && tBefore===label){
        const pre=tNow.slice(0,iL), post=tNow.slice(iL+label.length);
        sp.innerHTML=before;
        if(pre.trim()) sp.insertAdjacentText('beforebegin', pre);
        if(post.trim()) sp.insertAdjacentText('afterend', post);
        n++; return;
      }
      const val=tNow.replace(/^\s+|\s+$/g,'');
      const inp=document.getElementById(id);
      // ③全部消した／入力欄が無い／文章を打った（改行・※・。を含む、または長い）
      //   → この書類では打ったとおりの固定の文字にする（以後差し替えない・入力欄は変えない）
      const _isSentence = /\n|※|。/.test(val) || val.length>30;
      if(!val || !inp || inp.tagName==='SELECT' || _isSentence){
        sp.removeAttribute('data-bind');
        sp.style.color=''; sp.style.fontSize=''; sp.style.fontFamily='';
        n++; return;
      }
      // ②値を書き換えた → サイドバーの入力欄へ反映
      if(String(inp.value||'')!==val){
        inp.value=val;
        try{ if(window._fieldData) window._fieldData[id]=val; }catch(_e){}
        let lb=id;
        try{ const fg=inp.closest('.fg'); const l=fg&&fg.querySelector('label'); if(l){ const c=l.cloneNode(true); c.querySelectorAll('.fid').forEach(x=>x.remove()); lb=(c.textContent||'').trim()||id; } }catch(_e){}
        synced[id]=lb;
      }
      sp.style.color=''; sp.style.fontSize=''; sp.style.fontFamily='';
      n++;
    });
  }catch(e){ console.warn('[reconcileBindEdits]', e); }
  window._bindReconciling=false;
  _snapBinds();
  const ids=Object.keys(synced);
  if(ids.length){
    try{ if(typeof applyBindings==='function') applyBindings(); }catch(_e){}
    try{ if(typeof showToast==='function') showToast('📝 書類上で書き換えた「'+ids.map(k=>synced[k]).join('・')+'」を入力欄にも反映しました'); }catch(_e){}
  }
  if(n){ try{ if(typeof markEditedDirty==='function' && _editMode) markEditedDirty(); }catch(_e){} }
  return n;
}
function getBindResetHtml(){
  const area=document.getElementById('pageArea');
  if(!area) return '';
  // ver.20261027.01: 保存前に、変数欄の中に打った文字を外へ逃がす／入力欄へ反映（自動保存の途中では行わない＝入力中のカーソルを動かさない）
  try{ if(!window._autosaving) _reconcileBindEdits(); }catch(_e){}
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
    // ver.20261005.02: 推薦票の f_applicantName は推薦表の申請者（大房明良など）で本人ではないため、案件の申請人を使う
    var _k=null; try{ _k=(typeof _dgjInferDocKey==='function')?_dgjInferDocKey():null; }catch(_ke){}
    if(_k==='suisenhyo') ids=[];
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
  '1_11':'所属機関概要書',  // ver.20260911.06: 誤って健康診断個人票になっていたのを修正
  '1_16':'雇用の経緯に係る説明書',  // ver.20261005.02: 誤って事前ガイダンス確認書になっていたのを修正
  '1_17':'支援計画書',
  '1_23':'役員に関する誓約書',
  '1_25':'支援委託契約に関する説明書',
  '1_27':'公的義務履行に関する説明書',
  '1_29':'書類省略に当たっての誓約書',
  '1_30':'休業期間に関する申立書',
  '1_31':'通算在留期間を超える在留に関する申立書',
  'shozoku_daihyou':'所属機関の代表者に関する申告書',
  'iko':'移行準備説明書',
  'tk2go':'移行準備説明書（2号）',
  'myanmar':'理由書（ミャンマー）',
  'irai':'依頼書',
  'ininjou':'委任状',
  'henkou':'変更申出書',
  'juuyou':'重要事項説明書',
  'madoguchi':'窓口',
  'suisenhyo':'推薦票',
  'torisage':'申請取下書',
  'tesuryo':'手数料納付書',
  'shinsei_henkou':'申請書(変更)',
  'shinsei_koushin':'申請書(更新)',
  'shinsei_gjk':'申請書(更新・技人国)',
  'kyoryoku':'協力確認書',
  'kyoryoku_kaigo':'協力確認書(介護)',
  // ver.20261005.02: 名前が無く様式番号だけになっていた書類・分野別の書類を追加
  '1_10':'技能移転に係る申告書',
  '1_11_2':'受け入れた中長期在留者リスト',
  '1_11_3':'生活相談業務を行った中長期在留者リスト',
  '1_20':'支援責任者の履歴書',
  '1_22':'支援担当者の履歴書',
  '1_32':'業務内容に関する誓約書',
  '1_1':'介護_受入れ誓約書',
  '2_1':'ビルクリーニング_受入れ誓約書',
  '3_1':'工業製品製造業_受入れ誓約書',
  '6_1':'建設_受入れ誓約書',
  '6_2':'建設_2号機関の基準に関する誓約書',
  '6_3':'建設_2号実務経験に係る申告書',
  '7_1':'造船・舶用工業_受入れ誓約書',
  '7_2':'造船・舶用工業_登録支援機関誓約書',
  '8_1':'自動車整備_受入れ誓約書',
  '8_2':'自動車整備_登録支援機関誓約書',
  '9_1':'航空_受入れ誓約書',
  '9_2':'航空_登録支援機関誓約書',
  '10_1':'宿泊_受入れ誓約書',
  '10_2':'宿泊_登録支援機関誓約書',
  '11_1':'農業_受入れ誓約書（直接雇用）',
  '11_3':'農業_受入れ誓約書（派遣形態）',
  '11_4':'農業_登録支援機関誓約書',
  '12_1':'漁業_受入れ誓約書',
  '12_2':'漁業_登録支援機関誓約書',
  '13_1':'飲食料品製造業_受入れ誓約書',
  '13_2':'飲食料品製造業_登録支援機関誓約書',
  '14_1':'外食業_受入れ誓約書',
  '14_2':'外食業_登録支援機関誓約書',
  '15_1':'自動車運送業_受入れ誓約書',
  '15_2':'自動車運送業_登録支援機関誓約書',
  '16_1':'鉄道_受入れ誓約書',
  '16_2':'鉄道_登録支援機関誓約書',
  '17_1':'林業_受入れ誓約書',
  '18_1':'木材産業_受入れ誓約書'
};

function _printDocLabel(){
  // ver.20260820.10: docKey → 書類日本語名で返す。
  //   例: 1_6 → 「雇用条件書」、1_5 → 「雇用契約書」、juuyou → 「重要事項説明書」
  //   フォールバック: title からパターン抽出（旧動作）
  try{
    var key = (typeof _dgjInferDocKey === 'function') ? _dgjInferDocKey() : null;
    if(key==='tsuika_shiryo'){ var _tt=document.getElementById('f_title'); if(_tt && String(_tt.value||'').trim()) return String(_tt.value).trim(); }
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
  // ver.20261028.01: 書類の形が変わる変更が、直接編集した書類に出ていないまま印刷しようとしたら確認
  try{
    if(window._tplStructChanged && document.getElementById('_structNotice')){
      if(!confirm('サイドバーで変えた内容のうち、直接編集した書類に出ていないものがあります。\n（画面上部の黄色いお知らせを確認してください）\n\nこのまま印刷しますか？')) return;
    }
  }catch(_pw){}
  // ver.20261106.04: 印刷・PDFの前に、ページからはみ出していないか確かめる（はみ出していれば選んでもらう）
  try{
    if(!window._skipOverflowCheck && typeof checkPrintOverflow==='function' && !((typeof _editMode!=='undefined') && _editMode)){
      var _ov=checkPrintOverflow();
      if(_ov && _ov.length){ _showOverflowDialog(_ov); return; }
    }
  }catch(_oc){ console.warn('[overflowCheck]', _oc); }
  window._skipOverflowCheck=false;
  try{ slog('print'); }catch(_sl){} // ver.20261026.01: 利用ログ（PDF印刷）
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
  // ver.20261026.02: 案件読込からの所要時間を表示（スピード改善の目安）
  try{
    if(typeof _SLOG_LOADED_AT!=='undefined' && _SLOG_LOADED_AT && typeof showToast==='function'){
      var _elMs=Date.now()-_SLOG_LOADED_AT;
      var _elMin=Math.floor(_elMs/60000), _elSec=Math.round((_elMs%60000)/1000);
      if(_elSec===60){ _elMin+=1; _elSec=0; }
      showToast('🖨 PDF印刷：案件読込から '+(_elMin>0?(_elMin+'分'):'')+_elSec+'秒');
    }
  }catch(_tm){}
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
  'iko':'移行準備説明書', 'tk2go':'移行準備説明書(2号)', 'myanmar':'理由書(ミャンマー)', 'irai':'依頼書', 'ininjou':'委任状', 'henkou':'変更申出書',
  'juuyou':'重要事項説明書', 'madoguchi':'窓口', 'suisenhyo':'推薦票', 'torisage':'取り下げ書', 'tesuryo':'手数料納付書',
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
      // ver.20261112.07: 相方（1-5号など）の読み込みが終わるまで待つ。
      //   以前は 0.9秒だけ待って写していたため、通信が遅いと申請人の名前などが入る前に印刷されていた。
      //   読み込みは SELECT_CASE の1回だけにする（loadFromDB を別に呼ぶと読み込みが2回走り、途中で欄が消えることがある）
      try{ iwin.postMessage({type:'SELECT_CASE', info:info}, '*'); }catch(e){}
      var _t0=Date.now(), _cid=String(info.caseId);
      while(Date.now()-_t0<15000){
        await new Promise(function(r){ setTimeout(r,200); });
        var _done=false; try{ _done=(iwin._caseLoadDone===_cid); }catch(_e){}
        if(_done) break;
      }
      // 名前の欄がある書類は、名前が入るまで少しだけ待つ（最大3秒）
      try{
        var _nm=idoc.getElementById('es_applicantName');
        var _t1=Date.now(); while(_nm && !String(_nm.value||'').trim() && Date.now()-_t1<3000){ await new Promise(function(r){ setTimeout(r,200); }); }
      }catch(_e){}
    }
    await new Promise(function(r){ setTimeout(r,400); });
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
    try{ _structSetBase(); }catch(_e){} // ver.20261028.01: 書類の形の基準を覚える
    try{ _snapBinds(); }catch(_e){} // ver.20261027.01: 編集開始時の変数欄を覚える
    // ver.20260808.07: 編集中の自動保存を開始
    _startAutosave();
    // ver.20260808.07: 未保存表示（画面枠を赤くする）
    _showEditingIndicator(true);
  }else{
    _editLock=false;
    if(btn){btn.textContent='✏️ 直接編集';btn.classList.remove('edit-mode-on');btn.title='';}
    if(area)area.classList.remove('edit-mode');
    try{ _reconcileBindEdits(); }catch(_e){} // ver.20261027.01: 変数欄の中に打った文字を残す
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
  window._caseLoadDone='';   // ver.20261112.07: 読み込みが終わったら案件IDが入る（まとめ印刷が終わりを待つため）
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
  // ver.20261026.01: 利用ログ（案件読込）
  try{ if(window._slogFb===String(info.caseId)){ window._slogFb=''; } else { _SLOG_LOADED_AT=Date.now(); _slogCtxFromInfo(info); slog('load'); } }catch(_sl){}   // ver.20261111.12: 下の予備の記録が先に済んでいれば二重に記録しない
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

    // emp_sets 取得（ver.20260901.01: idx未設定なら申請人名/案件名で自動解決）
    const idx = await window.resolveEmpSetIdx(co, cas, info);
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
            // ver.20261020.04: 雇用条件(emp_sets)から入れた欄と値を記録（最新優先の判定に使う）
            if(window._empTracking) window._empFilled[id] = el.value;
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
    setValMulti(['es_orgNameEn','f_companyEn','f_orgNameEn'], (es.orgNameEn && !_ofusaNotEnglish(es.orgNameEn)) ? es.orgNameEn : (co.name_en || es.orgNameEn));   // ver.20261112.14: 雇用条件セットの訳が英語でないときだけ案シスの英語
    setValMulti(['es_orgAddress','f_address','f_orgAddress'], es.orgAddress || companyAddress);
    setValMulti(['es_orgAddressEn','f_addressEn','f_orgAddressEn'], (es.orgAddressEn && !(_ofusaNotEnglish(es.orgAddressEn) && (!es.orgAddress || _ofusaSameAddr(es.orgAddress, companyAddress)))) ? es.orgAddressEn : (co.address_en || es.orgAddressEn));   // ver.20261112.14: 別の事業所の住所は雇用条件セットのまま。英語でない訳で、会社と同じ住所のときだけ案シスの英語
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
    // ver.20261109.03: 案シスの作成者名に役職まで入っている会社（例「代表取締役　中川清彦」）で
    //   「代表取締役　代表取締役　中川清彦」と役職が二重になっていたため、名前の頭に役職があれば役職欄は付けない
    setValMulti(['f_author'], _authorJoin(_au.title, _au.name));
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
      /* ver.20261106.07: category2（業務区分の2つ目）を「工事業の種類」(workCat) に入れていたのは誤り（工事業は人材の「従事させる工事業」）。
         入れると、手で入れた工事業が雇用条件の更新時に空や業務区分で上書きされていたため外す。 */
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
    // ver.20261020.04: ここから下で雇用条件から入れた欄を _empFilled に記録する
    window._empFilled = {};
    window._empTracking = !opts.skipFieldRestore;
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
    // ver.20260831.07: skipFieldRestore（1-6系など独自 setFormValues が業務区分を制御する書類）
    //   ではこのブロックを走らせない。emp_sets ループがスキップされて _fieldData が空のまま
    //   ここに来ると、独自処理が入れた es_category / es_categoryEn を '' で上書きしてしまい、
    //   「案シスの雇用条件に業務区分があるのに Saysay で空」になっていた（株式会社MISORA案件で発覚）。
    //   あわせて2つ目のIDを es_categoryEn2（存在しない）→ es_category2En に修正。
    if(!opts.skipFieldRestore) ['category','categoryEn'].forEach(k=>{
      const k2 = (k==='category') ? 'category2' : 'category2En';
      const raw=(window._fieldData&&window._fieldData['es_'+k])||'';
      const raw2=(window._fieldData&&window._fieldData['es_'+k2])||'';
      const parts=raw.split(/[,、]\s*/).map(s=>_stripP(s)).filter(Boolean);
      setValMulti(['es_'+k,'f_'+k], parts[0]||'');
      const second = (parts.length>1) ? parts[1] : _stripP(raw2);
      setValMulti(['es_'+k2,'f_'+k2], second||'');
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
    window._empTracking = false; // ver.20261020.04: 雇用条件由来の記録はここまで

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
    // ver.20261026.04: 雇用条件に紐づく編集HTML（受け皿）を呼び戻す（案件ごとの編集版より新しければ採用）
    try{ await _htmlStoreRestore(info); }catch(_hs){ console.warn('[htmlStore restore]', _hs); }
    try{ _structNoticeHide(); window._tplSigBase=null; if(window._htmlFrozen) _structSetBase(); }catch(_sb){} // ver.20261028.01
    try{ if(window._htmlFrozen) _staleEditedCheck(); }catch(_st){ console.warn('[staleEdited]', _st); } // ver.20261106.03
    window._caseLoadDone=String(info.caseId);
    if(typeof showToast==='function') showToast('✅ 案件データを読み込みました');
  } catch(e) {
    window._caseLoadDone=String(info.caseId);
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
  // ver.20261106.06: 1-25号 委託料（１名当たりの月額）
  /^(f_)?supportFee$/i,
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
  try{ slog('save', {doc_key:String(docKey||'')}); }catch(_sl){} // ver.20261026.01: 利用ログ（DB保存）
  try{ if(!window._autosaving) _reconcileBindEdits(); }catch(_rc){} // ver.20261027.01
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
    // ver.20261020.04: 保存時点の雇用条件の値を記録。次回読込時に、雇用条件がこの後で
    //   変わった欄だけ雇用条件を採用し、変わっていない欄は書類で直した値を採用する（最新優先）
    try{
      const _rev = opts.revMap || _docRevMapFor(docKey);
      const _ev = {};
      Object.keys(values).forEach(id => {
        const v0 = _empValueFor(id, _rev);
        if(v0 !== undefined) _ev[id] = v0;
      });
      extra[docKey][String(idx)]._empVals = _ev;
      if(opts.revMap) extra[docKey][String(idx)]._rev = opts.revMap;
      const _es0 = window._empLoadedSet || {};
      extra[docKey][String(idx)]._empUpdatedAt = _es0.updatedAt || _es0._savedAt || null;
    }catch(_e){ console.warn('[save empVals]', _e); }

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
    // ver.20261026.04: 編集HTMLを雇用条件に紐づけて受け皿へ保存
    try{ await _htmlStoreSave({companyId:companyId, caseId:info.caseId, empSetIdx:idx}); }catch(_hs){ console.warn('[htmlStore save]', _hs); }

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

// ===== ver.20261020.04: 雇用条件と書類保存の「最新優先」判定ヘルパー =====
// 書類ページが独自に持つ「入力欄→雇用条件キー」の対応表（今は重要事項説明書の _J_REV のみ）
function _docRevMapFor(docKey){
  try{ if(docKey === 'juuyou' && typeof _J_REV !== 'undefined' && _J_REV) return _J_REV; }catch(_e){}
  return null;
}
// その入力欄の「雇用条件側の今の値」を返す。雇用条件と関係ない欄は undefined
function _empValueFor(id, rev){
  const filled = window._empFilled || {};
  if(Object.prototype.hasOwnProperty.call(filled, id)) return String(filled[id] == null ? '' : filled[id]);
  if(rev){
    const es = window._empLoadedSet || {};
    let key = rev[id];
    if(!key && /En$/.test(id) && rev[id.slice(0,-2)]) key = rev[id.slice(0,-2)] + 'En';
    if(key) return String(es[key] == null ? '' : es[key]);
  }
  return undefined;
}
function _empTs(es){
  const a = Date.parse((es && es.updatedAt) || '') || 0;
  const b = Date.parse((es && es._savedAt) || '') || 0;
  return Math.max(a, b);
}
const _normEV = (x) => String(x == null ? '' : x).trim();

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
    if(!co) return;
    // ver.20261113.01: 直接編集版は会社データ(extra._edited)から別テーブルへ移した（会社データが重くてDBが止まっていたため）。
    //   この書類・この案件の分だけ取ってきて、今までと同じ co.extra._edited の形に入れる
    try{
      const _edKey0 = ((location.pathname.split('/').pop()||docKey).replace(/\.html.*$/,'')) || docKey;
      if(info && info.caseId){
        const _em = await _getEditedHtml(companyId, _edKey0, info.caseId);
        if(_em && Object.keys(_em).length){ if(!co.extra || typeof co.extra!=='object') co.extra = {}; co.extra['_edited'] = _em; }
      }
    }catch(_e){ console.warn('[edited load]', _e); }
    if(!co.extra) return;
    const idx = parseInt(empSetIdx||0)||0;
    const data = co.extra && co.extra[docKey] && co.extra[docKey][String(idx)];
    // ver.20260717: ここで `if(!data) return;` していたため、通常のフォーム値(extra[docKey])が
    // 未保存の案件では、直接編集版(extra['_edited'])の復元処理まで到達せず、
    // 「保存しました」と出るのにリロードすると元に戻る、という状態になっていた。
    // フォーム値が無くても直接編集版の復元は行う。
    if(data){
      // 既存の値を上書きしない（loadCaseToFormで既にセットされている可能性）
      // ver.20261020.04: 「DBが正」で常に保存値を上書きしていたのをやめ、欄ごとに新しい方を採用する
      const _rev = data._rev || _docRevMapFor(docKey);
      const _base = (data._empVals && typeof data._empVals === 'object') ? data._empVals : null;
      const _docTs = Date.parse(data._savedAt || '') || 0;
      const _empNewer = _empTs(window._empLoadedSet) > _docTs; // 旧保存（記録なし）の判定用
      let _nKeptEmp = 0;
      Object.keys(data).forEach(id => {
        if(id.startsWith('_')) return; // _savedAt等
        const el = document.getElementById(id);
        if(!el) return;
        if(el.type === 'checkbox' || el.type === 'radio'){
          el.checked = !!data[id];
          return;
        }
        const ev = _empValueFor(id, _rev);
        if(ev !== undefined){
          let useEmp;
          if(_base && Object.prototype.hasOwnProperty.call(_base, id)){
            // 保存後に雇用条件側でこの欄が変わった → 雇用条件が新しい
            useEmp = _normEV(_base[id]) !== _normEV(ev);
          }else{
            // 旧保存：雇用条件の更新日時と保存日時を比べる
            useEmp = _empNewer;
          }
          if(useEmp){
            if(_normEV(el.value) !== _normEV(ev)) el.value = ev;
            if(_normEV(data[id]) !== _normEV(ev)) _nKeptEmp++;
            return;
          }
        }
        el.value = data[id] || '';
      });
      if(_nKeptEmp) console.log('[loadFormGenericFromDB] 雇用条件の方が新しい欄を採用:', _nKeptEmp, '件');
      if(typeof p === 'function') p();
      if(typeof applyMoneyFormatting === 'function') applyMoneyFormatting();
    }
    // 直接編集版があれば復元（案件ID・ファイル名単位）
    try{
      const _edKey = ((location.pathname.split('/').pop()||docKey).replace(/\.html.*$/,'')) || docKey;
      const _ed = co.extra && co.extra['_edited'] && co.extra['_edited'][_edKey] && info && info.caseId && co.extra['_edited'][_edKey][info.caseId];
      const _area = document.getElementById('pageArea');
      window._editedRestoredAt = 0; // ver.20261026.04: 受け皿（雇用条件単位）と新しさを比べる用
      if(_ed && _ed.html && _area){
        window._editedRestoredAt = _ed._savedAt ? (Date.parse(_ed._savedAt)||0) : 0;
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
    // ver.20261113.01: 直接編集版は別テーブル（company_edited_html）。消すのもRPCで
    await _delEditedHtml(cid, _edKey, info.caseId);
    window._htmlFrozen = false; window._editedRestored = false;
    // ver.20260716: 破棄後に_editModeを解除しないとp()が早期returnしてプレビューが空になるバグを修正
    if(typeof _editMode !== 'undefined') _editMode = false;
    try{ if(typeof enableDocEditing === 'function') enableDocEditing(false); }catch(e){}
    const _eb = document.getElementById('editModeBtn');
    if(_eb){ _eb.textContent = '✏️ 直接編集'; _eb.classList.remove('edit-mode-on'); }
    // ver.20261026.04: 雇用条件の受け皿にも破棄印を入れる（以後この雇用条件では呼び戻さない）
    try{ await _htmlStoreDiscard({companyId:cid, caseId:info.caseId}); }catch(_hs){}
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
      // ver.20261023.04: 選ばれていない（-1）ときは、どのセットも仮表示しない。欄は空のまま、ここから選んでもらう
      var none=!(typeof idx==='number' && idx>=0 && sets[idx]);
      if(none){
        var optsN='<option value="" selected>-- 選んでください --</option>'+sets.map(function(s,i){
          return '<option value="'+i+'">'+_empSetLabel(s,i).replace(/</g,'&lt;')+'</option>';
        }).join('');
        slot.innerHTML='<div style="background:#fee2e2;border:1px solid #dc2626;border-radius:6px;padding:8px;margin-bottom:6px;">'+
          '<div style="font-size:12px;font-weight:bold;color:#b91c1c;">⚠️ 雇用条件セットが選ばれていません</div>'+
          '<div style="font-size:11px;color:#7f1d1d;line-height:1.5;margin-top:3px;">雇用条件の欄は空のままです（全'+sets.length+'件）。<br>下から<b>この人の雇用条件</b>を選んでください（選ぶとこの案件に保存されます）。</div>'+
          '</div>'+
          '<label style="font-size:11px;font-weight:bold;color:#334155;display:block;">📑 雇用条件セット <span style="color:#b91c1c;">(未選択)</span></label>'+
          '<select id="empSetSelect" onchange="onEmpSetSelectChange()" style="width:100%;padding:4px;border:2px solid #dc2626;border-radius:3px;font-size:11px;">'+optsN+'</select>';
        return;
      }
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
      if(sel.value==='') return;   // ver.20261023.04: 「-- 選んでください --」は何もしない
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
  // ===== ver.20261111.04: 訳は言語ごとにも保存する（_tr_<言語>）。別の言語の訳が入っている共通の訳の欄は上書きしない =====
  //   雇用条件セットの「〇〇En」は全言語で同じ欄のため、ベトナム語版で保存すると、インドネシア語版などにもベトナム語が出ていた。
  function _trDocLang(){ var m=(location.pathname.split('/').pop()||'').match(/_(en|vi|th|ne|my|km|ko|zh|id|si)\.html$/i); return m?m[1].toLowerCase():'id'; }
  function _trSplit(values, existing){
    try{
      var L=_trDocLang(), sc=window._scriptOf||function(){ return ''; }, latin=(L==='en'||L==='id');
      var out=Object.assign({}, values), tr=Object.assign({}, (existing&&existing['_tr_'+L])||{}), n=0;
      Object.keys(values).forEach(function(k){
        if(!/En$/.test(k) || k.charAt(0)==='_') return;
        var v=values[k]; if(v==null || String(v).trim()==='') return;
        tr[k]=v; n++;
        var old=existing ? existing[k] : '';
        if(old==null || String(old).trim()==='' || String(old)===String(v)) return;   // 空なら共通の欄にも入れる
        var os=sc(old), ns=sc(v);
        var oldIsMine = latin ? (os==='') : (os===L);
        if(!oldIsMine){ out[k]=old; }   // 共通の欄に別の言語の訳が入っているときは残す（この言語の訳は _tr_ に入る）
        else if(!latin && ns!==L && ns!==''){ out[k]=old; }
      });
      if(n) out['_tr_'+L]=tr;
      return out;
    }catch(e){ console.warn('[訳の言語ごとの保存]', e); return values; }
  }
  window._trSplit=_trSplit;
  // 読み込んだあと、この言語の訳（_tr_<言語>）があれば、共通の訳の代わりに入れる（手で直した欄はそのまま）
  function _trOverlay(){
    try{
      var es=window._empLoadedSet; if(!es) return; var L=_trDocLang(), tr=es['_tr_'+L]; if(!tr || typeof tr!=='object') return;
      var n=0;
      Object.keys(tr).forEach(function(k){
        var fk=k; try{ if(typeof dbKeyToForm==='function') fk=dbKeyToForm(k)||k; }catch(_e){}
        var el=document.getElementById('es_'+fk)||document.getElementById('es_'+k)||document.getElementById('f_'+k); if(!el) return;
        var cur=String(el.value==null?'':el.value), base=String(es[k]==null?'':es[k]), v=String(tr[k]==null?'':tr[k]);
        if(!v || cur===v) return;
        if(cur!=='' && cur!==base) return;   // 手で直した欄は変えない
        el.value=v; n++;
      });
      if(n){ if(typeof p==='function'){ try{ p(); }catch(e){} } try{ if(typeof window.snapshotEmpBaseline==='function') window.snapshotEmpBaseline(); }catch(e){} }
    }catch(e){ console.warn('[言語ごとの訳]', e); }
  }
  window._trOverlay=_trOverlay;
  window.addEventListener('message', function(e){ try{ if(e.data && e.data.type==='SELECT_CASE'){ setTimeout(_trOverlay, 2200); setTimeout(_trOverlay, 4500); } }catch(_e){} });
  window.saveEmpSetWithMode=async function(companyId,caseId,values,mode,curIdx,force){
    if(!companyId) throw new Error('会社IDが未解決です');
    var cos=await sb('companies?select=id,emp_sets&id=eq.'+companyId);
    var co=cos&&cos[0]; if(!co) throw new Error('会社が見つかりません');
    var empSets=co.emp_sets?JSON.parse(JSON.stringify(co.emp_sets)):[];
    // ver.20261023.04: 雇用条件セットが選ばれていないときは、1番目のセットに上書きしない（別の人のセットを書き換えてしまうため）
    var _unsel=(curIdx===''||curIdx==null||isNaN(parseInt(curIdx,10))||parseInt(curIdx,10)<0||(mode!=='new'&&!empSets[parseInt(curIdx,10)]));
    if(_unsel && mode!=='new'){
      if(!window.confirm('この案件は、雇用条件セットが選ばれていません。\n\n［OK］新しい雇用条件セットとして保存し、この案件に紐づけます\n［キャンセル］保存しません（上の「雇用条件セット」でこの人のセットを選んでから保存してください）')) return {saved:false};
      mode='new';
    }
    var idx=parseInt(curIdx||0)||0;
    if(mode==='new'){
      var defName='条件セット'+(empSets.length+1);
      var nm=window.prompt('新しい雇用条件セットの名前を入力してください',defName);
      if(nm===null) return {saved:false};
      var newSet=Object.assign({},_trSplit(values, (curIdx!=null&&empSets[parseInt(curIdx,10)])||null),{setName:(nm||defName),_savedAt:new Date().toISOString(),_savedBy:_currentUserId()});
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
      Object.assign(empSets[idx],_trSplit(values, empSets[idx]),{setName:keepName,_savedAt:new Date().toISOString(),_savedBy:_currentUserId()});
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
        if(ctx && ctx.companyId && idx !== null && idx !== undefined && idx !== '' && parseInt(idx,10) < 0){   // ver.20261023.04: 雇用条件セットが未選択(-1)なら保存しない
          showToast('ℹ️ 雇用条件セットが選ばれていないため保存していません（上の「雇用条件セット」で選んでください）');
          return;
        }
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

/* ===== ver.20260831.03: 共通翻訳機能（全書類） =====
 * 翻訳欄（ID末尾 "En" で、対応する日本語欄が存在するもの）の横に 🌐 を出し、
 * 押した欄だけをこの書類の言語に翻訳する（一括翻訳・自動翻訳はしない）。
 * ver.20260831.03: 案シスの「AI翻訳」と同じ方式に統一。
 *   Claude API をブラウザから直接呼び、APIキーは localStorage('ofusa_apiKey')
 *   を共用する（案シスで設定済みなら Saysay でもそのまま使える）。
 *   Supabase Edge Function 経由をやめたため GEMINI_API_KEY の登録は不要。
 * 翻訳結果は入力欄に入るだけなので、各書類の 💾DB保存 で従来どおり保存される。
 */
(function(){
  function _docLang(){
    try{
      var m = (location.pathname.split('/').pop()||'').match(/_(en|vi|th|ne|my|km|ko|zh|id|si)\.html$/i);
      if(m) return m[1].toLowerCase();
    }catch(e){}
    return 'id'; // 無印ファイル（1_6.html 等）はインドネシア語版
  }
  var LANG_JA = {id:'インドネシア語',en:'英語',vi:'ベトナム語',th:'タイ語',ne:'ネパール語',my:'ミャンマー語',km:'クメール語',ko:'韓国語',zh:'中国語',si:'シンハラ語'};
  var LANG_EN = {id:'Indonesian',en:'English',vi:'Vietnamese',th:'Thai',ne:'Nepali',my:'Burmese (Myanmar)',km:'Khmer',ko:'Korean',zh:'Simplified Chinese',si:'Sinhala'};
  // ver.20261005.01: 訳語固定の用語集（AI翻訳のゆれ防止）。
  //   日本語欄が用語と完全一致 → APIを使わずこの訳語で確定。
  //   文中に含まれる場合 → プロンプトに対訳指示として渡す。
  //   ※長い語を先に並べること（外食業全般 を 外食業 より先に）
  var GLOSS = {
    th: [
      ['外食業全般','อุตสาหกรรมร้านอาหารทั่วไป'],
      ['外食業','อุตสาหกรรมการบริการอาหาร'],
      ['身体介護等','งานบริบาล'],
      ['介護分野','การบริบาล'],
      ['介護','การบริบาล'],
      ['みなし残業','ค่าล่วงเวลาแบบเหมาจ่าย'],
      ['末','วันสุดท้าย']
    ]
  };
  function _apiKey(){
    try{ return localStorage.getItem('ofusa_apiKey') || localStorage.getItem('claudeApiKey') || ''; }catch(e){ return ''; }
  }
  // ver.20260831.04: 住所欄かどうか（ID・ラベル文言から判定）
  function _isAddr(el){
    try{
      var id=(el.id||'').toLowerCase();
      if(/addr|address|jusho/.test(id)) return true;
      var fg=el.closest('.fg'), lb=fg&&fg.querySelector('label');
      if(lb && /住所|所在地/.test(lb.textContent||'')) return true;
    }catch(e){}
    return false;
  }
  function _pairs(){
    var out=[];
    document.querySelectorAll('input[id$="En"],textarea[id$="En"]').forEach(function(en){
      var ja = document.getElementById(en.id.slice(0,-2));
      if(!ja || ja.tagName==='SELECT') return;
      // ver.20261112.13: 会社名・所在地・代表者名（ローマ字）は案シスの英語のまま使うので、言語ごとの翻訳・言語ちがいの直しの対象にしない
      if(/^(es|f)_(orgName|orgAddress|orgTel|repName)En$/.test(en.id)) return;
      out.push({en:en, ja:ja});
    });
    return out;
  }
  // ver.20261106.05: 翻訳APIの呼び出し（1欄ずつの🌐と、まとめて翻訳の両方で使う）
  async function _callTranslate(pairs, lang, key, gl){
      var hasAddr=false;
    var payload = pairs.map(function(p,i){
      var isA=_isAddr(p.ja)||_isAddr(p.en); if(isA) hasAddr=true;
      return (i+1)+'. '+(isA?'[ADDRESS] ':'')+String(p.ja.value).replace(/\n/g,' ').slice(0,500);
    }).join('\n');
    var prompt = '日本の特定技能（雇用条件書などの公的様式）の記載内容を翻訳します。\n'
      + '次の各項目を '+LANG_EN[lang]+' に翻訳してください。\n'
      + '・様式に印字される文言として簡潔・丁寧に\n・数字、単位（円・時間・日・月）、固有名詞はそのまま保持\n・説明や注釈は加えない\n'
      + (hasAddr ? ('・[ADDRESS] が付いた項目は日本の住所です。欧米式の語順（小さい単位→大きい単位）に並べ替えて'+LANG_EN[lang]+'表記にしてください。\n'
        + '  例: 愛知県北名古屋市沖村山ノ神54番地 → 54 Okimura-Yamanokami, Kitanagoya-shi, Aichi\n'
        + '  例: 東京都港区南青山二丁目5-17 ポーラ青山ビル3F → 3F Pola Aoyama Bldg., 2-5-17 Minami-Aoyama, Minato-ku, Tokyo\n'
        + '  丁目・番地・号は 2-5-17 のようにハイフンでまとめ、都=Tokyo、道府県=そのままローマ字、市区町村は -shi/-ku/-cho/-mura を付ける。郵便番号は入力にあるときだけ残す。\n'
        + '  出力に [ADDRESS] の文字は含めないこと。\n') : '')
      + (gl.length ? ('・次の用語が含まれる場合は、必ずこの対訳を使うこと：\n'
        + gl.map(function(g){ return '  「'+g[0]+'」 → '+g[1]; }).join('\n') + '\n') : '')
      + '\n' + payload + '\n\n回答は文字列のJSON配列のみ（順序は入力と同じ）。例: ["...","..."]  JSON以外のテキストは含めないでください。';
    var r = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:2000,messages:[{role:'user',content:prompt}]})
    });
    var j = await r.json();
    if(j.error) throw new Error(j.error.message||'API error');
    var text=(j.content&&j.content[0]&&j.content[0].text)||'';
    var cleaned=text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
    var arr;
    try{ arr=JSON.parse(cleaned); }catch(e){ var m=cleaned.match(/\[[\s\S]*\]/); arr=m?JSON.parse(m[0]):[]; }
    if(!Array.isArray(arr)) arr=[];
    return arr;
  }
  window.translateEmptyFields = async function(onlyKey){
    var lang=_docLang(), key=_apiKey();
    if(!key){
      if(typeof showToast==='function') showToast('⚠️ APIキーが未設定です。案シスの設定画面でAPIキーを登録してください');
      else alert('APIキーが未設定です。案シスの設定画面でAPIキーを登録してください。');
      return;
    }
    var pairs=_pairs().filter(function(p){
      if(onlyKey && p.en.id!==onlyKey) return false;
      return String(p.ja.value||'').trim()!=='';
    });
    if(!pairs.length){ if(typeof showToast==='function') showToast('日本語欄が空のため翻訳できません'); return; }
    // ver.20261005.01: 用語集と完全一致する欄はAPIを使わず確定
    var gl = GLOSS[lang]||[];
    if(gl.length){
      var rest=[], hitN=0;
      pairs.forEach(function(pr2){
        var jv=String(pr2.ja.value||'').replace(/[\s　]/g,'');
        var tr='';
        for(var gi=0;gi<gl.length;gi++){ if(gl[gi][0]===jv){ tr=gl[gi][1]; break; } }
        if(tr){ pr2.en.value=tr; hitN++; pr2.en.style.background='#fef9c3'; setTimeout(function(){ pr2.en.style.background=''; },2500); }
        else rest.push(pr2);
      });
      if(hitN && typeof p==='function'){ try{ p(); }catch(e){} }
      if(!rest.length){
        if(typeof showToast==='function') showToast('🌐 '+(LANG_JA[lang]||lang)+'に翻訳しました（内容を確認してDB保存してください）');
        return;
      }
      pairs=rest;
    }
    var el0 = onlyKey ? document.getElementById(onlyKey) : null;
    var mini = el0 && el0.nextElementSibling && el0.nextElementSibling.classList.contains('tr-mini') ? el0.nextElementSibling : null;
    if(mini){ mini.disabled=true; mini.textContent='…'; }
    try{
      var arr = await _callTranslate(pairs, lang, key, gl);
      var n=0;
      pairs.forEach(function(p,i){
        var t=String(arr[i]||'').trim();
        if(t){ p.en.value=t; n++; p.en.style.background='#fef9c3'; setTimeout(function(){ p.en.style.background=''; },2500); }
      });
      if(typeof p==='function'){ try{ p(); }catch(e){} }
      if(typeof showToast==='function') showToast('🌐 '+(LANG_JA[lang]||lang)+'に翻訳しました（内容を確認してDB保存してください）');
    }catch(e){
      if(typeof showToast==='function') showToast('⚠️ 翻訳エラー: '+e.message); else alert('翻訳エラー: '+e.message);
    }finally{
      if(mini){ mini.disabled=false; mini.textContent='🌐'; }
    }
  };
  // ===== ver.20261106.05: 訳が空いている欄をまとめて翻訳（確認してから入れる） =====
  //   日本語があって訳が空の欄だけを集めて訳し、一覧で確認・手直ししてから、チェックした欄だけに入れる。
  //   すでに訳が入っている欄は対象外（上書きしない）。勝手には入れない。
  function _fieldLabel(el){
    try{ var fg=el.closest('.fg'), lb=fg&&fg.querySelector('label'); if(lb){ var c=lb.cloneNode(true); c.querySelectorAll('.fid,button').forEach(function(x){x.remove();}); var t=(c.textContent||'').replace(/\s+/g,' ').trim(); if(t) return t; } }catch(e){}
    return el.id;
  }
  function _emptyPairs(){
    return _pairs().filter(function(p){ var j=String(p.ja.value||'').trim(); return j!=='' && String(p.en.value||'').trim()==='' && !/^[\d,.\s円¥％%]+$/.test(j.normalize('NFKC')); });   // ver.20261111.06: 数字だけの欄は訳がいらない
  }
  // ver.20261111.06: 1-6号の手当の金額が「実費」などの文字のとき、訳を自動で入れる
  var _AMT_WORD={
    '実費':{id:'Biaya aktual',en:'Actual cost',vi:'Chi phí thực tế',km:'ថ្លៃចំណាយជាក់ស្តែង',my:'အမှန်တကယ် ကုန်ကျစရိတ်',ne:'वास्तविक खर्च',th:'ตามที่จ่ายจริง',zh:'实际费用',ko:'실비',si:'සත්‍ය වියදම'},
    '実費支給':{id:'Dibayar sesuai biaya aktual',en:'Paid at actual cost',vi:'Chi trả theo chi phí thực tế',km:'ផ្តល់ជូនតាមថ្លៃចំណាយជាក់ស្តែង',my:'အမှန်တကယ် ကုန်ကျစရိတ်အတိုင်း ပေးသည်',ne:'वास्तविक खर्च अनुसार भुक्तानी',th:'จ่ายตามที่จ่ายจริง',zh:'按实际费用支付',ko:'실비 지급',si:'සත්‍ය වියදම අනුව ගෙවනු ලැබේ'},
    '全額支給':{id:'Dibayar penuh',en:'Paid in full',vi:'Chi trả toàn bộ',km:'ផ្តល់ជូនទាំងស្រុង',my:'အပြည့်အဝ ပေးသည်',ne:'पूरा भुक्तानी',th:'จ่ายเต็มจำนวน',zh:'全额支付',ko:'전액 지급',si:'සම්පූර්ණයෙන්ම ගෙවනු ලැබේ'}
  };
  function _amtWordFill(){
    try{
      var L=_docLang();
      for(var i=1;i<=6;i++){
        var j=document.getElementById('es_a'+i+'Amt')||document.getElementById('f_allowance'+i+'Amount'), e=document.getElementById('es_a'+i+'AmtEn')||document.getElementById('f_allowance'+i+'AmountEn'); if(!j||!e) continue;   // 1-6号（es_a）と重説（f_allowance）
        if(String(e.value||'').trim() && e.dataset.autofill!=='1') continue;
        var w=_AMT_WORD[String(j.value||'').normalize('NFKC').replace(/\s/g,'')], t=w&&w[L];
        if(t && e.value!==t){ e.value=t; e.dataset.autofill='1'; if(typeof p==='function'){ try{ p(); }catch(_e){} } }
      }
    }catch(e){}
  }
  document.addEventListener('input', function(ev){ if(ev.target && /^(es_a\dAmt|f_allowance\dAmount)$/.test(ev.target.id||'')) _amtWordFill(); if(ev.target && /^(es_a\dAmtEn|f_allowance\dAmountEn)$/.test(ev.target.id||'')) delete ev.target.dataset.autofill; }, true);
  window.addEventListener('message', function(e){ try{ if(e.data && e.data.type==='SELECT_CASE'){ setTimeout(_amtWordFill, 3500); } }catch(_e){} });
  // ===== ver.20261111.04: 訳の欄に、この書類と別の言語の訳が入っていないか見る =====
  //   案シスの雇用条件セットの訳の欄は全言語で同じ欄のため、別の言語版で保存すると上書きされる（例：インドネシア語版にベトナム語）。
  var _WL_NAME={vi:'ベトナム語',km:'クメール語',my:'ミャンマー語',th:'タイ語',ne:'ネパール語',ko:'韓国語',ja:'日本語のまま',zh:'中国語',si:'シンハラ語'};
  function _scriptOf(t){
    t=String(t||''); if(!t.trim()) return '';
    if(/[\u1780-\u17FF]/.test(t)) return 'km';
    if(/[\u1000-\u109F]/.test(t)) return 'my';
    if(/[\u0E00-\u0E7F]/.test(t)) return 'th';
    if(/[\u0900-\u097F]/.test(t)) return 'ne';
    if(/[\u0D80-\u0DFF]/.test(t)) return 'si';   // ver.20261113.03: シンハラ語
    if(/[\uAC00-\uD7AF]/.test(t)) return 'ko';
    if(/[\u3040-\u309F\u30A1-\u30FA\u30FD-\u30FF]/.test(t)) return 'ja';   // ver.20261112.15: 「・」「ー」はどの言語の訳でも使うので日本語あつかいしない（直しても同じ欄がくり返し「別の言語」と判定されていた）
    if(/[\u4E00-\u9FFF]/.test(t)) return 'ja';   // 漢字だけの日本語（例：土曜・日曜）も日本語あつかい（中国語版では下で除く）
    var vi=(t.match(/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹĂÂĐÊÔƠƯẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸ]/g)||[]).length;
    if(vi>=2) return 'vi';
    return '';
  }
  function _wrongLangPairs(){
    var lang=_docLang(), out=[];
    if(/(^|\/)(shinsei_|tsuika_)/.test(location.pathname)) return out;   // 申請書・追加資料は対象外
    _pairs().forEach(function(p){
      var v=String(p.en.value||''); if(!v.trim()) return;
      if(/(applicant|Applicant|rep|Rep|Mgr|mgr|Author|author|interp|Interp|staff|Staff|person|Person|resp|Resp|manager|Manager|contact|Contact|family|Family|kin|Kin)[A-Za-z0-9]*Name\d*En$|(Addr|addr|Address|address|Kana|kana|Mail|mail|Tel|tel)\d*En$/.test(p.en.id)) return;   // 人の名前・住所などは本国の書き方のことがあるので見ない
      var sc=_scriptOf(v); if(!sc || sc===lang) return;
      if(sc==='ja' && lang==='zh') return;
      out.push({p:p, sc:sc});
    });
    return out;
  }
  window._wrongLangPairs=_wrongLangPairs;
  window._scriptOf=_scriptOf;
  function _wlSummary(list){ var c={}; list.forEach(function(x){ c[x.sc]=(c[x.sc]||0)+1; }); return Object.keys(c).map(function(k){ return (_WL_NAME[k]||k)+' '+c[k]+'か所'; }).join('・'); }
  window._wlSummary=function(){ var l=_wrongLangPairs(); return l.length?_wlSummary(l):''; };
  function _wlShow(){
    try{
      var old=document.getElementById('trWrong'); if(old) old.remove();
      var list=_wrongLangPairs();
      document.querySelectorAll('.wl-mark').forEach(function(e){ e.classList.remove('wl-mark'); e.style.outline=''; });
      if(!list.length) return;
      list.forEach(function(x){ x.p.en.classList.add('wl-mark'); x.p.en.style.outline='2px solid #f97316'; });
      var host=document.querySelector('.fp-inner')||document.querySelector('.fp'); if(!host) return;
      var box=document.createElement('div'); box.id='trWrong';
      box.style.cssText='margin:0 0 8px;padding:7px 9px;border:1px solid #fdba74;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:11px;line-height:1.55;';
      box.innerHTML='<b>🌐 訳が別の言語になっています（'+_wlSummary(list)+'）</b><br>この書類は'+(LANG_JA[_docLang()]||'')+'版です。オレンジの枠の欄を確認してください。'
        +'<br><button type="button" id="trWrongFix" style="margin-top:4px;padding:3px 10px;border:none;background:#ea580c;color:#fff;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">消して入れ直す</button>';
      var anchor=document.getElementById('srcAuto')||document.getElementById('_srcBtn');
      if(anchor && anchor.parentNode===host) anchor.insertAdjacentElement('afterend', box); else host.insertBefore(box, host.firstChild);
      box.querySelector('#trWrongFix').onclick=async function(){
        var l=_wrongLangPairs(); l.forEach(function(x){ x.p.en.value=''; delete x.p.en.dataset.autofill; x.p.en.style.outline=''; x.p.en.classList.remove('wl-mark'); });
        try{ if(typeof window._trdApplyOnLoad==='function') await window._trdApplyOnLoad(); }catch(e){}
        if(typeof p==='function'){ try{ p(); }catch(e){} }
        var left=l.filter(function(x){ return !String(x.p.en.value||'').trim(); }).length;
        box.innerHTML='<b>🌐 別の言語の訳を '+l.length+' か所消しました</b>'+(l.length-left?'（うち '+(l.length-left)+' か所は前に確認した訳を入れました）':'')
          +(left?'<br>残り '+left+' か所は空欄です。<button type="button" id="trWrongBulk" style="margin-left:4px;padding:2px 8px;border:none;background:#0f766e;color:#fff;border-radius:6px;font-size:11px;cursor:pointer;">まとめて翻訳</button>':'');
        var bb=box.querySelector('#trWrongBulk'); if(bb) bb.onclick=function(){ if(typeof window.translateEmptyBulk==='function') window.translateEmptyBulk(); };
      };
    }catch(e){ console.warn('[訳の言語チェック]', e); }
  }
  window._wlShow=_wlShow;
  // ver.20261111.05: 開いたときに自動で直す。別の言語の欄を消し、前に確認した訳 → 用語集 → AI翻訳 の順で入れ直す。
  //   入れ直した訳は、その雇用条件セットの「この言語用の訳」（_tr_<言語>）に自動で保存する（共通の訳の欄と、ほかの言語の訳は変えない）。
  function _wlDbKey(el){ var k=String(el.id||'').replace(/^(es_|f_)/,''); try{ if(typeof formKeyToDb==='function') k=formKeyToDb(k)||k; }catch(e){} return k; }
  async function _wlSaveTr(lang, fixes){
    try{
      if(!Object.keys(fixes).length) return false;
      var ctx=window._empCtx||{}, coId=ctx.companyId, idx=parseInt(window._empLoadedIdx,10);
      if(!coId || isNaN(idx) || idx<0) return false;
      try{ var cid=ctx.caseId||(window._lastCaseInfo&&window._lastCaseInfo.caseId); if(!cid) return false; var cr=await sb('cases?select=emp_set_idx&id=eq.'+encodeURIComponent(cid)); if(!cr||!cr[0]||String(cr[0].emp_set_idx)!==String(idx)) return false; }catch(e){ return false; }   // ver.20261111.08: 選ばれたセットのときだけ
      var r=await sb('companies?select=id,emp_sets&id=eq.'+encodeURIComponent(coId)); var co=r&&r[0]; if(!co) return false;
      var sets=Array.isArray(co.emp_sets)?co.emp_sets:[]; if(!sets[idx]) return false;
      var key='_tr_'+lang; sets[idx][key]=Object.assign({}, sets[idx][key]||{}, fixes);
      var w=await sb('companies?id=eq.'+encodeURIComponent(coId)+'&select=emp_sets',{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({emp_sets:sets})});
      if(!w||!w.length) return false;
      var ns=(w[0].emp_sets||[])[idx]||sets[idx];
      try{ window._empLoadedSet=JSON.parse(JSON.stringify(ns)); }catch(e){}   // 保存のときの「ほかの人が変えた」判定に引っかからないように
      if(window._empCtx) window._empCtx.empSets=w[0].emp_sets||sets;
      return true;
    }catch(e){ console.warn('[言語ごとの訳の自動保存]', e); return false; }
  }
  async function _wlAutoFix(){
    if(window._wlBusy) return; window._wlBusy=true;
    try{
      if((typeof _editMode!=='undefined' && _editMode) || window._htmlFrozen){ _wlShow(); return; }
      var list=_wrongLangPairs(); if(!list.length){ _wlShow(); return; }
      var lang=_docLang(), key=_apiKey(), gl=GLOSS[lang]||[], undo=[], mem=0, ai=0;
      list.forEach(function(x){ undo.push({el:x.p.en, v:x.p.en.value}); x.p.en.value=''; delete x.p.en.dataset.autofill; x.p.en.style.outline=''; x.p.en.classList.remove('wl-mark'); });
      var prs=list.map(function(x){ return x.p; }).filter(function(pr){ return String(pr.ja.value||'').trim(); });
      try{ await _trdLoad(lang); }catch(_t){}
      var need=[];
      prs.forEach(function(pr){
        var jv=String(pr.ja.value||'').replace(/[\s　]/g,''), hit='';
        for(var gi=0;gi<gl.length;gi++){ if(gl[gi][0]===jv){ hit=gl[gi][1]; break; } }
        if(!hit && _TRD[lang]) hit=_TRD[lang][_trdKey(pr.ja.value)]||'';
        if(hit){ pr.en.value=hit; mem++; } else need.push(pr);
      });
      if(need.length && key){
        for(var k=0;k<need.length;k+=15){
          var part=need.slice(k,k+15);
          try{ var arr=await _callTranslate(part, lang, key, gl); part.forEach(function(pr,i){ var t=String(arr[i]||'').trim(); if(t){ pr.en.value=t; ai++; } }); }catch(e){ console.warn('[自動翻訳]', e); }
        }
      }
      var fixes={};
      prs.forEach(function(pr){ if(String(pr.en.value||'').trim()){ pr.en.dataset.autofill='1'; pr.en.style.background='#ecfdf5'; fixes[_wlDbKey(pr.en)]=pr.en.value; } });
      if(typeof p==='function'){ try{ p(); }catch(e){} }
      try{ if(typeof window.snapshotEmpBaseline==='function') window.snapshotEmpBaseline(); }catch(e){}
      var saved=await _wlSaveTr(lang, fixes);
      try{ if(typeof slog==='function') slog('wl_autofix',{meta:{n:list.length, mem:mem, ai:ai, saved:saved, lang:lang}}); }catch(e){}
      // 結果を出す
      var old=document.getElementById('trWrong'); if(old) old.remove();
      var host=document.querySelector('.fp-inner')||document.querySelector('.fp'); if(!host) return;
      var left=prs.filter(function(pr){ return !String(pr.en.value||'').trim(); }).length;
      var box=document.createElement('div'); box.id='trWrong';
      box.style.cssText='margin:0 0 8px;padding:7px 9px;border:1px solid #86efac;border-radius:8px;background:#f0fdf4;color:#166534;font-size:11px;line-height:1.55;';
      box.innerHTML='<b>🌐 別の言語だった訳を '+list.length+' か所、自動で'+(LANG_JA[lang]||'')+'に入れ直しました</b>'
        +'<br>（前に確認した訳 '+mem+' か所'+(ai?'・AI翻訳 '+ai+' か所':'')+(left?'・<span style="color:#b91c1c;">訳せなかった '+left+' か所</span>':'')+'）緑の欄を確認してください。'
        +(saved?'<br>次からはこの訳が自動で入ります。':'')
        +(ai?'<br><span style="color:#92400e;">AIの訳は念のため内容を確認してください。</span>':'')
        +(left&&!key?'<br><span style="color:#b91c1c;">APIキーが未設定のため、AI翻訳はしていません。</span>':'')
        +'<br><button type="button" id="trWrongUndo" style="margin-top:4px;padding:2px 8px;border:1px solid #86efac;background:#fff;color:#166534;border-radius:6px;font-size:11px;cursor:pointer;">元に戻す</button>';
      var anchor=document.getElementById('srcAuto')||document.getElementById('_srcBtn');
      if(anchor && anchor.parentNode===host) anchor.insertAdjacentElement('afterend', box); else host.insertBefore(box, host.firstChild);
      box.querySelector('#trWrongUndo').onclick=function(){ undo.forEach(function(u){ u.el.value=u.v; u.el.style.background=''; delete u.el.dataset.autofill; }); if(typeof p==='function'){ try{ p(); }catch(e){} } box.remove(); _wlShow(); };
    }catch(e){ console.warn('[訳の自動修正]', e); }
    finally{ window._wlBusy=false; }
  }
  window._wlAutoFix=_wlAutoFix;
  window.addEventListener('message', function(e){ try{ if(e.data && e.data.type==='SELECT_CASE'){ var o=document.getElementById('trWrong'); if(o) o.remove(); setTimeout(_wlAutoFix, 5500); setTimeout(function(){ if(!document.getElementById('trWrong') && !window._wlBusy) _wlShow(); }, 12000); } }catch(_e){} });
  // 印刷の前にも確認（1-6号は印刷前チェックの中で出すので除く）
  setTimeout(function(){
    try{
      if(typeof window.doPrint!=='function' || window.doPrint.__wl || /(^|\/)1_6(_[a-z]+)?\.html/.test(location.pathname)) return;
      var _o=window.doPrint;
      var w=function(){
        if(!window._skipOverflowCheck){
          var l=_wrongLangPairs();
          if(l.length && !confirm('🌐 訳が別の言語になっている欄があります（'+_wlSummary(l)+'）。\nこの書類は'+(LANG_JA[_docLang()]||'')+'版です。\n\nこのまま印刷しますか？（直す場合は「キャンセル」→ 左の「消して入れ直す」）')) return;
          var ti=(typeof window._jyTotalsIssue==='function')?window._jyTotalsIssue():[];   // ver.20261111.08: 重説の合計
          if(ti.length && !confirm(ti.join('\n')+'\n\n（左の「合計」「控除合計」「手取り」を空にすると、内訳から自動で計算します）\nこのまま印刷しますか？')) return;
        }
        return _o.apply(this, arguments);
      };
      try{ Object.keys(_o).forEach(function(k){ w[k]=_o[k]; }); }catch(_k){}   // ver.20261111.10: 前の包みの印（_p17など）を引き継ぐ（無いと1-17号の確認が2回出ていた）
      w.__wl=true; w.__p16=_o.__p16; window.doPrint=w;
    }catch(e){}
  }, 800);
  // ver.20261109.07: 確認して入れた訳を、言語ごとに全員で共有して覚える（settings.tr_dict_<言語>：日本語→訳）。
  //   次からは同じ日本語の欄に、開いたときに自動で入る（訳が空の欄だけ）。まとめて翻訳でも、覚えている訳はAIを使わずに出す。
  var _TRD={};
  function _trdKey(t){ return String(t||'').normalize('NFKC').replace(/[\s　]/g,''); }
  async function _trdLoad(lang){
    if(_TRD[lang]) return _TRD[lang];
    try{ var r=await sb('settings?select=value&key=eq.tr_dict_'+lang); _TRD[lang]=(r&&r[0]&&r[0].value)?(JSON.parse(r[0].value)||{}):{}; }catch(e){ _TRD[lang]={}; }
    return _TRD[lang];
  }
  async function _trdSave(lang, add){
    if(!Object.keys(add).length) return;
    try{
      var cur={}; var r=await sb('settings?select=value&key=eq.tr_dict_'+lang);
      if(r&&r[0]&&r[0].value){ try{ cur=JSON.parse(r[0].value)||{}; }catch(e){} }
      Object.assign(cur, add);
      var ks=Object.keys(cur); if(ks.length>4000) ks.slice(0, ks.length-4000).forEach(function(k){ delete cur[k]; });   // 古いものから捨てて大きくなりすぎないように
      _TRD[lang]=cur;
      await sb('settings?on_conflict=key',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{key:'tr_dict_'+lang, value:JSON.stringify(cur), updated_at:new Date().toISOString()}])});
    }catch(e){ console.warn('[訳の共有保存]', e); }
  }
  window._trdApplyOnLoad = async function(){
    try{
      if(/(^|\/)1_17(_[a-z]+)?\.html/.test(location.pathname)) return;   // 1-17は専用の共有訳あり
      var lang=_docLang(); if(!lang || lang==='ja') return;
      var pairs=_emptyPairs(); if(!pairs.length) return;
      var d=await _trdLoad(lang), n=0;
      pairs.forEach(function(pr){
        if(String(pr.en.value||'').trim()) return;
        var t=d[_trdKey(pr.ja.value)]; if(!t) return;
        pr.en.value=t; pr.en.dataset.autofill='1'; n++;
        pr.en.style.background='#ecfdf5'; (function(e){ setTimeout(function(){ e.style.background=''; },3000); })(pr.en);
      });
      if(n){ if(typeof p==='function'){ try{ p(); }catch(e){} } if(typeof showToast==='function') showToast('🌐 前に確認した訳を '+n+' か所に入れました（緑の欄）'); }
    }catch(e){ console.warn('[訳の自動入力]', e); }
  };
  window.addEventListener('message', function(e){ try{ if(e.data && e.data.type==='SELECT_CASE'){ setTimeout(window._trdApplyOnLoad, 5000); } }catch(_e){} });
  window.translateEmptyBulk = async function(){
    var lang=_docLang(), key=_apiKey();
    var pairs=_emptyPairs();
    if(!pairs.length){ if(typeof showToast==='function') showToast('✅ 訳が空いている欄はありません'); return; }
    if(!key){ if(typeof showToast==='function') showToast('⚠️ APIキーが未設定です。案シスの設定画面でAPIキーを登録してください'); return; }
    if(!confirm('日本語が入っていて訳が空いている欄が '+pairs.length+' か所あります。\n'+(LANG_JA[lang]||lang)+'に訳して、確認画面を出します（まだ入力欄には入れません）。よろしいですか？')) return;
    var t=(typeof showToast==='function')?showToast('🌐 '+pairs.length+'か所を翻訳しています…',0):null;
    try{ await _trdLoad(lang); }catch(_t){}
    var gl=GLOSS[lang]||[], out=new Array(pairs.length).fill('');
    try{
      var need=[];
      pairs.forEach(function(pr,i){
        var jv=String(pr.ja.value||'').replace(/[\s　]/g,''); var hit='';
        for(var gi=0;gi<gl.length;gi++){ if(gl[gi][0]===jv){ hit=gl[gi][1]; break; } }
        if(!hit && _TRD[lang]) hit=_TRD[lang][_trdKey(pr.ja.value)]||'';   // 前に確認した訳
        if(hit) out[i]=hit; else need.push(i);
      });
      for(var k=0;k<need.length;k+=15){
        var idx=need.slice(k,k+15);
        var arr=await _callTranslate(idx.map(function(i){return pairs[i];}), lang, key, gl);
        idx.forEach(function(i,n){ out[i]=String(arr[n]||'').trim(); });
      }
    }catch(e){
      if(t&&t.remove) t.remove();
      if(typeof showToast==='function') showToast('⚠️ 翻訳エラー: '+e.message); return;
    }
    if(t&&t.remove) t.remove();
    _bulkReview(pairs, out, lang);
  };
  function _bulkReview(pairs, out, lang){
    var esc=function(x){ return String(x==null?'':x).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
    var old=document.getElementById('_trBulk'); if(old) old.remove();
    var w=document.createElement('div'); w.id='_trBulk';
    w.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:2147483000;display:flex;align-items:center;justify-content:center;font-family:sans-serif;';
    var rows=pairs.map(function(pr,i){
      return '<tr style="border-top:1px solid #e2e8f0;vertical-align:top;">'
        +'<td style="padding:6px;"><input type="checkbox" class="_trChk" data-i="'+i+'" '+(out[i]?'checked':'')+'></td>'
        +'<td style="padding:6px;font-size:11px;color:#475569;width:22%;">'+esc(_fieldLabel(pr.ja))+'<br><span style="color:#1f2937;font-size:12px;">'+esc(pr.ja.value)+'</span></td>'
        +'<td style="padding:6px;"><textarea class="_trOut" data-i="'+i+'" rows="2" style="width:100%;box-sizing:border-box;font-size:12px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;">'+esc(out[i])+'</textarea>'
        +(out[i]?'':'<div style="color:#b91c1c;font-size:11px;">訳を取得できませんでした（手で入力できます）</div>')+'</td></tr>';
    }).join('');
    w.innerHTML='<div style="background:#fff;color:#1f2937;border-radius:12px;width:min(820px,94vw);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 12px 48px rgba(0,0,0,.35);">'
      +'<div style="padding:14px 18px;border-bottom:1px solid #e2e8f0;"><div style="font-weight:800;font-size:15px;">🌐 訳の確認（'+esc(LANG_JA[lang]||lang)+'）</div>'
      +'<div style="font-size:12px;color:#475569;">訳を確認し、必要なら直してください。チェックした欄だけに入れます（訳が入っていた欄は対象外です）。</div></div>'
      +'<div style="overflow:auto;flex:1;padding:0 12px;"><table style="width:100%;border-collapse:collapse;">'+rows+'</table></div>'
      +'<div style="padding:10px 18px;border-top:1px solid #e2e8f0;display:flex;gap:8px;justify-content:flex-end;">'
      +'<button type="button" id="_trCancel" style="padding:8px 14px;border:none;background:#f1f5f9;border-radius:8px;cursor:pointer;">やめる</button>'
      +'<button type="button" id="_trApply" style="padding:8px 16px;border:none;background:#2563eb;color:#fff;font-weight:700;border-radius:8px;cursor:pointer;">チェックした欄に入れる</button></div></div>';
    document.body.appendChild(w);
    w.querySelector('#_trCancel').onclick=function(){ w.remove(); };
    w.querySelector('#_trApply').onclick=function(){
      var n=0, _learn={};
      w.querySelectorAll('._trChk').forEach(function(cb){
        if(!cb.checked) return; var i=+cb.getAttribute('data-i');
        var v=String(w.querySelector('._trOut[data-i="'+i+'"]').value||'').trim(); if(!v) return;
        var en=pairs[i].en; en.value=v; n++;
        var _jk=_trdKey(pairs[i].ja.value); if(_jk && _jk.length<=600 && !/^[\d.,:\/\-]+$/.test(_jk)) _learn[_jk]=v;   // 数字だけの欄は覚えない
        en.style.background='#fef9c3'; (function(e){ setTimeout(function(){ e.style.background=''; },2500); })(en);
        try{ en.dispatchEvent(new Event('input',{bubbles:true})); }catch(_e){}
      });
      w.remove();
      if(typeof p==='function'){ try{ p(); }catch(e){} }
      if(typeof showToast==='function') showToast('🌐 '+n+'か所に訳を入れました（内容を確認してDB保存してください）');
      _trdSave(lang, _learn);   // 次からは同じ日本語に自動で入る
    };
  }
  function _injectBulkBtn(){
    try{
      if(document.getElementById('_trBulkBtn')) return;
      if(!_pairs().length) return;
      var host=document.querySelector('.fp-inner')||document.querySelector('.fp'); if(!host) return;
      var b=document.createElement('button'); b.type='button'; b.id='_trBulkBtn';
      b.textContent='🌐 訳が空いている欄をまとめて翻訳';
      b.title='日本語が入っていて訳が空の欄だけを訳し、確認してから入れます（訳が入っている欄は変えません）';
      b.style.cssText='display:block;width:100%;margin:0 0 8px;padding:6px;border:1px solid #93c5fd;background:#eff6ff;color:#1d4ed8;border-radius:8px;font-size:11.5px;font-weight:700;cursor:pointer;';
      b.onclick=function(ev){ ev.preventDefault(); window.translateEmptyBulk(); };
      host.insertBefore(b, host.firstChild);
    }catch(e){}
  }
  function _inject(){
    _pairs().forEach(function(pr){
      if(pr.en.nextElementSibling && pr.en.nextElementSibling.classList && pr.en.nextElementSibling.classList.contains('tr-mini')) return;
      var s=document.createElement('button');
      s.type='button'; s.className='tr-mini'; s.textContent='🌐'; s.title='この欄を翻訳（日本語欄から自動翻訳・上書き）';
      s.style.cssText='margin-left:4px;font-size:10px;padding:1px 5px;border:1px solid #cbd5e1;border-radius:4px;background:#f8fafc;cursor:pointer;vertical-align:middle;';
      s.onclick=function(ev){ ev.preventDefault(); window.translateEmptyFields(pr.en.id); };
      pr.en.insertAdjacentElement('afterend', s);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(_inject,300); setTimeout(_injectBulkBtn,350); });
  else { setTimeout(_inject,300); setTimeout(_injectBulkBtn,350); }
})();

/* ===== ver.20261006.01: 赤字モード（書類の値クリックで文字色を赤⇔黒） =====
 * 「🔴 赤字」ボタン(#redModeBtn)があるページで動作。モードON中に
 * プレビューの値（.f[data-bind]）をクリックすると赤字⇔黒字が切り替わる。
 * 状態は hidden の #es_redState（または #f_redstate）にJSONで保持し、
 * 各書類のDB保存（emp_sets / saveFormGeneric）で一緒に保存・復元される。
 */
window._redMode = false;
function _redGet(){
  var e=document.getElementById('es_redState')||document.getElementById('f_redstate');
  if(!e||!e.value) return {};
  try{ var o=JSON.parse(e.value); return (o&&typeof o==='object'&&!Array.isArray(o))?o:{}; }catch(_e){ return {}; }
}
function _redPut(o){
  var e=document.getElementById('es_redState')||document.getElementById('f_redstate');
  if(e) e.value=(o&&Object.keys(o).length)?JSON.stringify(o):'';
}
function applyRedMarks(){
  var area=document.getElementById('pageArea'); if(!area) return;
  var set=_redGet();
  area.querySelectorAll('.f[data-bind]').forEach(function(sp){
    var key=sp.getAttribute('data-bind');
    if(set[key]){ sp.style.color='#dc2626'; sp.dataset.redmark='1'; }
    else if(sp.dataset.redmark){ sp.style.color=''; delete sp.dataset.redmark; }
  });
}
function toggleRedMode(){
  window._redMode=!window._redMode;
  var b=document.getElementById('redModeBtn');
  if(b){
    b.style.background=window._redMode?'#991b1b':'#dc2626';
    b.textContent=window._redMode?'🔴 赤字指定中':'🔴 赤字';
  }
  if(typeof showToast==='function') showToast(window._redMode
    ? '🔴 赤字モードON：書類の値をクリックすると赤⇔黒が切り替わります（終わったらもう一度ボタンを押してOFF）'
    : '赤字モードOFF（指定した赤字はDB保存で保持されます）');
}
document.addEventListener('click', function(e){
  if(!window._redMode) return;
  var area=document.getElementById('pageArea'); if(!area) return;
  var sp=(e.target&&e.target.closest)?e.target.closest('.f[data-bind]'):null;
  if(!sp || !area.contains(sp)) return;
  e.preventDefault(); e.stopPropagation();
  var key=sp.getAttribute('data-bind'); if(!key) return;
  var set=_redGet();
  if(set[key]) delete set[key]; else set[key]=1;
  _redPut(set);
  applyRedMarks();
}, true);
(function(){
  var _t=null;
  var mo=new MutationObserver(function(){ if(_t)clearTimeout(_t); _t=setTimeout(applyRedMarks,120); });
  function _arm(){ var a=document.getElementById('pageArea'); if(a) mo.observe(a,{childList:true,subtree:true}); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', _arm);
  else _arm();
})();
/* ===== /赤字モード ===== */

/* ===== ver.20261013.01: 空欄チェックモード（未入力欄を黄色でハイライト） =====
 * 「🟡 空欄チェック」ボタン(#blankModeBtn)があるページで動作。
 * ONにすると未入力の欄（.f[data-bind]のプレースホルダ表示）だけ黄色の帯になり、
 * 印刷・PDFにも黄色が出る（print-color-adjust:exact）。書類上部に
 * 「黄色の箇所が空欄です…」の注意書きも印字される。保存はしない一時表示。
 */
window._blankMode = false;
(function(){
  var st=document.createElement('style');
  st.textContent='.f-blank{background:#fde047 !important;display:inline-block;min-width:5em;min-height:1em;border-radius:2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}'
    /* ON中は画面上の「値入り欄の黄色」を消し、必須の空欄だけが黄色に見えるようにする */
    +'body.blank-mode #pageArea .f[data-bind]{background:transparent !important;}'
    +'body.blank-mode #pageArea .f.f-blank[data-bind]{background:#fde047 !important;}'
    +'@media print{span.f.f-blank,span.f.f-blank[style*="monospace"],span.f.f-blank[style*="color:#aaa"]{'
    +'visibility:visible !important;display:inline-block !important;color:transparent !important;'
    +'background:#fde047 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}}'
    +'.blank-note{position:absolute;top:2mm;left:0;right:0;text-align:center;font-size:8pt;font-weight:600;color:#92400e;background:#fef9c3;padding:1px 0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}';
  if(document.head) document.head.appendChild(st);
  else document.addEventListener('DOMContentLoaded',function(){document.head.appendChild(st);});
})();
function applyBlankMarks(){
  var area=document.getElementById('pageArea'); if(!area) return;
  var on=!!window._blankMode;
  // ver.20261013.02: ページが必須リスト(window.BLANK_REQUIRED)を定義している場合は
  //   必須入力箇所のみを対象にする（任意欄の空欄は黄色にしない）。
  //   未定義ページは従来どおり全空欄を対象にする。
  var reqSet=null;
  if(on && typeof window.BLANK_REQUIRED==='function'){
    try{ reqSet={}; (window.BLANK_REQUIRED()||[]).forEach(function(k){ reqSet[k]=1; }); }catch(_e){ reqSet=null; }
  }
  area.querySelectorAll('.f[data-bind]').forEach(function(sp){
    var isEmpty=(sp.getAttribute('style')||'').indexOf('color:#aaa')>=0;
    var target=isEmpty && (!reqSet || reqSet[sp.getAttribute('data-bind')]);
    if(sp.style && sp.style.display==='none') target=false;   // ver.20261102.01: 業務区分の2つ目など、隠している欄は空欄扱いしない
    if(on&&target){ if(!sp.classList.contains('f-blank')) sp.classList.add('f-blank'); }
    else if(sp.classList.contains('f-blank')) sp.classList.remove('f-blank');
  });
  var note=area.querySelector('.blank-note');
  if(on){
    if(!note){
      var doc=area.querySelector('.doc');
      if(doc){
        try{ if(getComputedStyle(doc).position==='static') doc.style.position='relative'; }catch(_e){}
        var n=document.createElement('div');
        n.className='blank-note';
        n.textContent='※ 黄色の箇所が空欄です。ご確認のうえ、記入内容をお知らせください。';
        doc.insertBefore(n, doc.firstChild);
      }
    }
  }else if(note){ note.remove(); }
}
function toggleBlankMode(){
  window._blankMode=!window._blankMode;
  try{ document.body.classList.toggle('blank-mode', window._blankMode); }catch(_e){}
  var b=document.getElementById('blankModeBtn');
  if(b){
    b.style.background=window._blankMode?'#a16207':'#eab308';
    b.textContent=window._blankMode?'🟡 空欄チェック中':'🟡 空欄チェック';
  }
  applyBlankMarks();
  if(typeof showToast==='function') showToast(window._blankMode
    ? '🟡 空欄チェックON：未入力の欄が黄色で表示されます（印刷・PDFにも黄色が出ます）'
    : '空欄チェックOFF');
}
(function(){
  var _t=null;
  var mo=new MutationObserver(function(){ if(!window._blankMode) return; if(_t)clearTimeout(_t); _t=setTimeout(applyBlankMarks,150); });
  function _arm(){ var a=document.getElementById('pageArea'); if(a) mo.observe(a,{childList:true,subtree:true}); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', _arm);
  else _arm();
})();
/* ===== /空欄チェックモード ===== */

/* ===== ver.20261026.01: 利用ログ（saysay_logs） =====
   だれが（ログインメール）・どの書類（doc_key/ファイル名）で・どの案件IDを
   読み込んだか（load）、いつPDF印刷したか（print）、いつDB保存したか（save）を
   Supabase の saysay_logs テーブルに記録する。
   - user_email: 親index.htmlのログイン（SELECT_CASEで渡されるトークン）から取得
   - session_id: 画面を開くたびに変わるID。load→print を紐づけて所要時間を出す
   - ms_since_load: 案件読込からの経過ミリ秒（printの行＝書類作成にかかった時間）
   記録はfire-and-forget。失敗しても書類作成・印刷には影響しない。 */
var _SLOG_SESSION=(Math.random().toString(36).slice(2,10)+Date.now().toString(36));
var _SLOG_LOADED_AT=null;
var _SLOG_CTX={caseId:'',companyId:''};
function _slogCtxFromInfo(info){ try{ _SLOG_CTX={caseId:String((info&&info.caseId)||''), companyId:String((info&&info.companyId)||'')}; }catch(_e){} }
// ver.20261111.12: 書類が自分で案件を読む場合（1-17号・推薦表など loadCaseToForm を使わない書類）でも、どの案件か・開いてからの時間を記録する
window.addEventListener('message', function(e){
  try{
    if(!e.data || e.data.type!=='SELECT_CASE') return;
    var info=e.data.info||{}; if(!info.caseId) return;
    var t0=Date.now();
    setTimeout(function(){
      try{
        if(_SLOG_CTX.caseId===String(info.caseId)) return;   // ふつうの書類は loadCaseToForm が記録済み
        _SLOG_LOADED_AT=t0; _slogCtxFromInfo(info); window._prLast=null; window._slogFb=String(info.caseId); slog('load');
      }catch(_e){}
    }, 3000);
  }catch(_e){}
});
function _slogUser(){
  // ①Saysayのログイン情報（supabase-js が localStorage に保存。同一ドメインなので書類ページからも読める）
  try{
    var raw=null;
    try{ raw=localStorage.getItem('sb-ehwlgbwpycglmopiqyty-auth-token'); }catch(_ls){}
    if(!raw){ try{ for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(/^sb-.*-auth-token$/.test(k||'')){ raw=localStorage.getItem(k); break; } } }catch(_ls2){} }
    if(raw){
      var o=JSON.parse(raw); if(Array.isArray(o)) o=o[0];
      var em=o && ((o.user && o.user.email) || (o.currentSession && o.currentSession.user && o.currentSession.user.email));
      if(em) return em;
    }
  }catch(_e0){}
  // ②受け取ったトークン（SELECT_CASE 同梱）③親画面
  try{
    var tok=window.__OFUSA_SB_TOKEN||'';
    if(!tok){ try{ if(window.parent&&window.parent!==window&&window.parent.IDX_TOKEN) tok=window.parent.IDX_TOKEN; }catch(_x){} }
    if(tok&&String(tok).split('.').length>=3){
      var b=String(tok).split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      while(b.length%4) b+='=';
      var p=JSON.parse(decodeURIComponent(escape(atob(b))));
      return p.email||p.sub||'';
    }
  }catch(_e){}
  return '';
}
// ver.20261029.01: 案シスで選んだ担当者名（共有アカウント mail@ でも、ログイン時に選んだ人を記録する）
function _slogUserName(){
  try{ if(window.parent&&window.parent!==window&&window.parent.currentUser) return String(window.parent.currentUser); }catch(_p){}
  try{ return String(localStorage.getItem('ofusa_currentUser')||''); }catch(_l){}
  return '';
}
function _slogBuild(event, extra){
    var key=''; try{ key=(typeof _dgjInferDocKey==='function')?(_dgjInferDocKey()||''):''; }catch(_k){}
    var who=''; try{ who=(typeof _printApplicantName==='function')?(_printApplicantName()||''):''; }catch(_w){}
    var body={ event:String(event||''), user_email:_slogUser(), user_name:_slogUserName(), doc_key:key,
      file:(location.pathname.split('/').pop()||''),
      case_id:_SLOG_CTX.caseId, company_id:_SLOG_CTX.companyId,
      applicant:who, session_id:_SLOG_SESSION,
      ms_since_load:(_SLOG_LOADED_AT?(Date.now()-_SLOG_LOADED_AT):null) };
    if(extra){ for(var k in extra){ if(Object.prototype.hasOwnProperty.call(extra,k)) body[k]=extra[k]; } }
    if(body.event==='print' && !(extra&&extra.meta)){ try{ var _pd=_prDiff(); if(_pd) body.meta=_pd; }catch(_p){} }   // ver.20261111.12: 印刷し直しの理由
    if(body.event==='save' && !body.meta){ try{ var _mi=_miCollect(); if(_mi) body.meta=_mi; }catch(_m){} }   // ver.20261109.03: 手入力の記録
    return body;
}
window._slogBody=function(event, extra){ try{ return _slogBuild(event, extra); }catch(e){ return null; } };   // ver.20261109.08: まとめPDFの記録用
function slog(event, extra){
  try{
    var body=_slogBuild(event, extra);
    fetch(SB_URL+'/rest/v1/saysay_logs',{method:'POST',keepalive:true,
      headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify(body)}).catch(function(){});
  }catch(_e){}
}
/* ver.20261109.03: 役職＋氏名をつなぐ（氏名の頭に役職が入っていれば二重にしない） */
var _AUTHOR_TITLE_RE=/^(代表取締役社長|代表取締役会長|代表取締役副社長|代表取締役|取締役社長|取締役|代表理事長|代表理事|理事長|専務理事|常務理事|理事|代表社員|業務執行社員|代表者|代表|社長|会長|副社長|専務|常務|組合長|事務局長|施設長|院長|園長|所長|工場長|支配人|部長|課長)/;
function _authorJoin(title, name){
  var t=String(title||'').replace(/\s+$/,'').trim(), n=String(name||'').trim();
  if(!n) return t;
  if(!t) return n;
  var nn=n.replace(/[\s　]/g,''), tt=t.replace(/[\s　]/g,'');
  if(nn.indexOf(tt)===0 || _AUTHOR_TITLE_RE.test(nn)) return n;   // 氏名の側に役職が入っている
  return t+'　'+n;
}
window._authorJoin=_authorJoin;
function _srcEmpSet(){
  if(window._empLoadedSet && Object.keys(window._empLoadedSet).length) return window._empLoadedSet;
  var R=window._srcRows||{}, co=R.companies, ca=R.cases;
  if(co && Array.isArray(co.emp_sets)){ var i=parseInt((ca&&ca.emp_set_idx)||((window._lastCaseInfo||{}).empSetIdx)||'',10); if(!isNaN(i) && co.emp_sets[i]) return co.emp_sets[i]; }
  return null;
}
/* ===== ver.20261109.07: 1-6号 雇用条件書の印刷前チェック =====
   印刷・PDFの前に、必須欄の空欄・計算の検算（支払概算総額／控除合計／手取り）・最低賃金・建設の報酬基準などを確かめ、
   問題があれば一覧で知らせる（そのまま印刷するか選べる）。計算の判定は AI判定と同じ _aiCheck16Local を使う。 */
function _p16MonthHours(){
  var h=_mw16_num('es_monthlyH'), m=_mw16_num('es_monthlyMin');
  return h ? Math.round((h+(m||0)/60)*100)/100 : 0;
}
// ver.20261109.08: 時給・日給のとき、換算月給を自動で入れる（月給のときは何もしない）
// ver.20261112.03: 式を年間で割る形に変更。時給×年間所定労働時間÷12／日給×年間所定労働日数÷12
//   （年間の欄が空のときだけ、これまでどおり月の時間・日数で出す）。
//   これから入れる書類だけ：読み込んだ時点で換算月給に値がある書類は変えず、この画面で給与・時間・日数を直したときに計算し直す。
function _p16YearHours(){
  var h=_mw16_num('es_yearlyH'), m=_mw16_num('es_yearlyMin');
  return h ? h+(m||0)/60 : 0;
}
function _p16AutoCalcMonthly(force){
  try{
    var e=document.getElementById('es_calcMonthly'); if(!e) return;
    if(_mw16_num('es_salaryMonthly')) return;
    if(e.dataset.manualCalc==='1') return;   // この画面で換算月給を手で入れたときは変えない
    if(force!==true && String(e.value||'').trim()!=='' && e.dataset.autofill!=='1') return;   // 入っている値（作成済みの書類）は変えない
    var hr=_mw16_num('es_salaryHourly'), dy=_mw16_num('es_salaryDaily'), mh=_p16MonthHours(), yh=_p16YearHours();
    var md=String(_mw16_val('es_monthlyDays')).normalize('NFKC'); md=/^\d+(\.\d+)?$/.test(md)?Number(md):0;
    var yd=String(_mw16_val('es_yearlyDays')).normalize('NFKC'); yd=/^\d+(\.\d+)?$/.test(yd)?Number(yd):0;
    var v=0;
    if(hr) v = yh ? Math.round(hr*yh/12) : (mh ? Math.round(hr*mh) : 0);
    else if(dy) v = yd ? Math.round(dy*yd/12) : (md ? Math.round(dy*md) : 0);
    if(!v) return;
    var s=v.toLocaleString('ja-JP'); if(e.value===s) return;
    e.value=s; e.dataset.autofill='1'; e.dispatchEvent(new Event('input',{bubbles:true}));
    if(typeof window._p16TaxRecalc==='function') window._p16TaxRecalc();   // 税金・社会保険料・雇用保険料も計算し直す（自動の欄だけ）
  }catch(err){}
}
// ver.20261111.10: 月給・日給の人の「換算時給」を自動で入れる
//   月給：（月給＋割増の計算に入れる手当）÷ 月の所定労働時間　／　日給：（日給×月の日数＋手当）÷ 月の所定労働時間
//   1円未満は切り捨て（最低賃金と比べるとき、上に丸めて超えたように見せないため）。
//   入れるのは ① 空欄のとき ② この画面で月給・時間・手当を直したとき。案シスに入っている値は、読み込んだだけでは変えない（印刷前チェックで食い違いを知らせる）。
//   換算時給をこの画面で手で入れたら、それ以降は変えない。
var _P16_EXALLOW=/固定残業|みなし|残業|時間外|深夜|夜勤|休日出勤|通勤|家族|扶養|住宅|別居|子女|精勤|皆勤|臨時|賞与/;
function _p16CalcHourlyValue(){
  var mh=_p16MonthHours(); if(!mh) return 0;
  var mo=_mw16_num('es_salaryMonthly'), dy=_mw16_num('es_salaryDaily');
  var md=String(_mw16_val('es_monthlyDays')).normalize('NFKC'); md=/^\d+(\.\d+)?$/.test(md)?Number(md):0;
  var base=mo || (dy&&md ? dy*md : 0); if(!base) return 0;
  var al=0;
  for(var i=1;i<=6;i++){ var an=_mw16_val('es_a'+i+'Name'), aa=_mw16_num('es_a'+i+'Amt'); if(aa && !_P16_EXALLOW.test(an||'')) al+=aa; }
  return Math.floor((base+al)/mh);
}
function _p16AutoCalcHourly(force){
  try{
    var e=document.getElementById('es_calcHourly'); if(!e) return;
    if(e.dataset.manualCalc==='1') return;
    if(!_mw16_num('es_salaryMonthly') && !_mw16_num('es_salaryDaily')) return;   // 時給の人は何もしない（欄は「月給・日給の場合」）
    if(!force && String(e.value||'').trim()!=='') return;
    var v=_p16CalcHourlyValue(); if(!v) return;
    var s=v.toLocaleString('ja-JP'); if(e.value===s) return;
    e.value=s; e.dataset.autofill='1'; e.dispatchEvent(new Event('input',{bubbles:true}));
  }catch(err){}
}
window._p16AutoCalcHourly=_p16AutoCalcHourly;
// ver.20261109.09: 読み込んだあと、人が手で直した雇用条件の欄（案シスの値と違うもの）
function _p16ChangedFields(){
  var out=[], base=window._empBaseline, touched=window._miV0||{};
  if(!base || ((typeof _editMode!=='undefined')&&_editMode)) return out;
  document.querySelectorAll('[id^="es_"]').forEach(function(el){
    if(!Object.prototype.hasOwnProperty.call(touched, el.id)) return;          // 触っていない欄（自動で入ったもの）は除く
    if(/En$/.test(el.id)) return;                                               // 訳の欄は一覧に出さない（保存はされる）
    var b=String(base[el.id]==null?'':base[el.id]), v=String(el.value==null?'':el.value);
    if(b===v) return;
    var lb=''; try{ lb=(typeof _miLabel==='function')?_miLabel(el):el.id; }catch(e){ lb=el.id; }
    out.push({id:el.id, label:lb, from:b, to:v});
  });
  if(window._p16SkipSig && window._p16SkipSig===JSON.stringify(out)) return [];   // 「保存しないで印刷」を選んだあと、さらに直していなければ聞かない
  return out;
}
function _p16SavePrompt(){
  return new Promise(function(resolve){
    var ch=_p16ChangedFields(), sig=JSON.stringify(ch);
    var esc=function(x){ x=String(x==null?'':x); if(x.length>36) x=x.slice(0,36)+'…'; return x.replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
    var w=document.createElement('div'); w.id='p16SavePrompt';
    w.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:sans-serif;';
    w.innerHTML='<div style="background:#fff;color:#1f2937;border-radius:12px;width:min(560px,94vw);max-height:86vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.3);">'
      +'<div style="padding:14px 18px;border-bottom:1px solid #e2e8f0;"><div style="font-weight:800;font-size:15px;">💾 直した雇用条件を案シスにも保存しますか？</div>'
      +'<div style="font-size:12px;color:#475569;margin-top:3px;line-height:1.55;">保存すると、同じ雇用条件を使うほかの人の1-6号や、重要事項説明書・1-5号などにも正しい値が入ります。<br>保存しないと、次に開いたときはまた元の値に戻ります。</div></div>'
      +'<div style="overflow:auto;flex:1;padding:8px 18px;font-size:12px;">'+ch.slice(0,12).map(function(c){ return '<div style="padding:4px 0;border-bottom:1px solid #f1f5f9;"><b>'+esc(c.label)+'</b>：<span style="color:#94a3b8;text-decoration:line-through;">'+(esc(c.from)||'（空欄）')+'</span> → <span style="color:#0f766e;font-weight:700;">'+(esc(c.to)||'（空欄）')+'</span></div>'; }).join('')+(ch.length>12?'<div style="color:#64748b;padding-top:4px;">ほか '+(ch.length-12)+' か所</div>':'')+'</div>'
      +'<div style="padding:10px 18px;border-top:1px solid #e2e8f0;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">'
      +'<button type="button" id="p16Cancel" style="padding:8px 12px;border:none;background:#f1f5f9;border-radius:8px;cursor:pointer;">やめる</button>'
      +'<button type="button" id="p16NoSave" style="padding:8px 12px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;cursor:pointer;">この人だけ（保存しないで印刷）</button>'
      +'<button type="button" id="p16Save" style="padding:8px 16px;border:none;background:#0f766e;color:#fff;font-weight:700;border-radius:8px;cursor:pointer;">💾 保存して印刷</button></div></div>';
    document.body.appendChild(w);
    var done=function(v){ try{ w.remove(); }catch(e){} resolve(v); };
    w.querySelector('#p16Cancel').onclick=function(){ done(false); };
    w.querySelector('#p16NoSave').onclick=function(){ window._p16SkipSig=sig; try{ if(typeof slog==='function') slog('p16_nosave',{meta:{n:ch.length}}); }catch(e){} done(true); };
    w.querySelector('#p16Save').onclick=async function(){
      try{ w.remove(); }catch(e){}
      try{ if(typeof saveForm==='function') await saveForm(); }catch(e){ console.warn('[1-6 保存]', e); }
      // 保存できたら基準値が取り直されて「直した欄」がなくなる。キャンセルされたときは印刷しない
      if(typeof isEmpDirtyByForm==='function' && isEmpDirtyByForm()){ if(typeof showToast==='function') showToast('保存しなかったので、印刷はやめました'); resolve(false); return; }
      resolve(true);
    };
  });
}
function _p16BothPay(probs){ try{ var m=_mw16_num('es_salaryMonthly'), h=_mw16_num('es_salaryHourly'), d=_mw16_num('es_salaryDaily'); if(m && (h||d)) probs.push('⚠ 月給と'+(h?'時給':'日給')+'の両方が入っています（月給 '+m.toLocaleString('ja-JP')+'円／'+(h?'時給 '+h.toLocaleString('ja-JP'):'日給 '+d.toLocaleString('ja-JP'))+'円）。書類は月給になります。違う方を消してください'); }catch(e){} }
function _p16WrongLang(probs){ try{ if(typeof window._wlSummary==='function'){ var s=window._wlSummary(); if(s) probs.push('⛔ 訳が別の言語になっています（'+s+'）。左の「消して入れ直す」で直してください'); } }catch(e){} }
function _p16PrintCheck(){
  var g=function(id){ var e=document.getElementById(id); return e?String(e.value||'').trim():''; }, has=function(id){ return !!document.getElementById(id); };
  var req=[['es_createY','作成日（年）'],['es_createM','作成日（月）'],['es_createD','作成日（日）'],['applicantName','宛先氏名'],['es_orgName','所属機関名'],['es_orgAddress','所属機関の所在地'],['es_orgTel','所属機関の電話番号'],['es_repName','代表者名'],
    ['es_contractStartY','契約開始（年）'],['es_contractEndY','契約終了（年）'],['es_officeAddress','就業場所の所在地'],['es_category','業務区分'],['es_monthlyH','月所定労働時間'],
    ['es_payCutoff','賃金締切日'],['es_payDay','賃金支払日'],['es_salaryTotal','支払概算総額'],['es_deductTotal','控除合計'],['es_netPay','手取り']];
  var miss=req.filter(function(x){ return has(x[0]) && !g(x[0]); }).map(function(x){ return x[1]; });
  if(has('es_salaryMonthly') && !g('es_salaryMonthly') && !g('es_salaryHourly')) miss.push('基本給（月額または時間給）');
  var probs=[];
  try{
    (_aiCheck16Local(window._check16RulesCache||null)||[]).forEach(function(c){ if(c.severity==='out'||c.severity==='warn') probs.push((c.severity==='out'?'⛔ ':'⚠ ')+c.title+'：'+c.detail); });
  }catch(e){ console.warn('[1-6 印刷前チェック]', e); }
  // ver.20261109.08: 時給・日給のとき、換算月給が 時給×月の所定労働時間 と合っているか／手取りがマイナスでないか
  try{
    var hr=_mw16_num('es_salaryHourly'), cm=_mw16_num('es_calcMonthly'), mh=_p16MonthHours();
    if(!_mw16_num('es_salaryMonthly') && hr && mh){
      var want=Math.round(hr*mh);
      if(!cm) probs.push('⚠ 換算月給が空欄です（時給'+hr+'円×月'+mh+'時間＝'+want.toLocaleString('ja-JP')+'円）');
      else if(Math.abs(cm-want)>Math.max(10, want*0.01)) probs.push('⚠ 換算月給が 時給×月の所定労働時間 と違います：時給'+hr+'円×月'+mh+'時間＝'+want.toLocaleString('ja-JP')+'円 ／ 換算月給 '+cm.toLocaleString('ja-JP')+'円');
    }
    var np=g('es_netPay'); if(np && /^-/.test(np.normalize('NFKC').replace(/[,\s円]/g,''))) probs.push('⛔ 手取り支給額がマイナスです（'+np+'円）。支払概算総額を確認してください');
  }catch(e){}
  // 支払概算総額 ＝ 基本給（時給・日給は換算月給）＋手当＋固定残業代
  try{
    var _bm=_mw16_num('es_salaryMonthly'), base=_bm||_mw16_num('es_calcMonthly'), st=_mw16_num('es_salaryTotal');
    if(base && st){
      var sum=base, d=[(_bm?'基本給':'換算月給')+base];
      for(var i=1;i<=6;i++){ var am=_mw16_num('es_a'+i+'Amt'); if(am){ sum+=am; d.push((g('es_a'+i+'Name')||('手当'+i))+am); } }
      var fo=_mw16_num('es_fixedOTAmount'); if(fo){ sum+=fo; d.push('固定残業代'+fo); }
      if(Math.abs(sum-st)>1) probs.push('⚠ 支払概算総額が内訳の合計と違います：'+d.join('＋')+'＝'+sum.toLocaleString('ja-JP')+'円 ／ 支払概算総額 '+st.toLocaleString('ja-JP')+'円（差 '+(st-sum).toLocaleString('ja-JP')+'円）');
    }
  }catch(e){}
  _p16WrongLang(probs);   // ver.20261111.04
  _p16BothPay(probs);     // ver.20261111.08
  return {miss:miss, probs:probs};
}
(function(){
  if(!/(^|\/)1_6(_[a-z]+)?\.html/.test(location.pathname)) return;
  function wrap(){
    var _orig=window.doPrint; if(typeof _orig!=='function' || _orig.__p16) return;
    var w=function(){
      if(!window._skipOverflowCheck && !((typeof _editMode!=='undefined')&&_editMode)){
        var r=_p16PrintCheck();
        if(r.miss.length || r.probs.length){
          var msg='';
          if(r.probs.length) msg+='次の点を確認してください：\n'+r.probs.map(function(x){ return '・'+x; }).join('\n')+'\n\n';
          if(r.miss.length) msg+='次の欄が空欄です：\n・'+r.miss.join('\n・')+'\n\n';
          if(!confirm(msg+'このまま印刷しますか？')) return;
        }
        // ver.20261109.09: 書類で直した雇用条件を、印刷の前に案シスへ保存するか聞く（保存しないで印刷すると、次の人・ほかの書類でまた同じ直しが必要になるため）
        var _self=this, _args=arguments;
        if(_p16ChangedFields().length){
          _p16SavePrompt().then(function(go){ if(go) _orig.apply(_self,_args); });
          return;
        }
      }
      return _orig.apply(this, arguments);
    };
    w.__p16=true; window.doPrint=w;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(wrap,500); }); else setTimeout(wrap,500);
  try{ if(typeof _check16LoadRules==='function') _check16LoadRules(); }catch(e){}
  document.addEventListener('input', function(ev){ var id=ev.target&&ev.target.id; if(ev.isTrusted && /^es_(salaryHourly|salaryDaily|salaryMonthly|monthlyH|monthlyMin|monthlyDays|yearlyH|yearlyMin|yearlyDays)$/.test(id||'')) _p16AutoCalcMonthly(true); if(id==='es_calcMonthly' && ev.isTrusted) ev.target.dataset.manualCalc='1'; if(ev.isTrusted && /^es_(salaryMonthly|salaryDaily|monthlyH|monthlyMin|monthlyDays|a\d(Name|Amt))$/.test(id||'')) _p16AutoCalcHourly(true); if(id==='es_calcHourly' && ev.isTrusted) ev.target.dataset.manualCalc='1'; }, true);
  window.addEventListener('message', function(e){ try{ if(e.data && e.data.type==='SELECT_CASE'){ var c=document.getElementById('es_calcMonthly'); if(c) delete c.dataset.manualCalc; var c2=document.getElementById('es_calcHourly'); if(c2) delete c2.dataset.manualCalc; } }catch(_e){} });
  // ver.20261109.12: 支払方法（口座振込／通貨払）は雇用条件セットを読んだあとに決まるので、表示が合っていなければ描き直す
  function _payRefresh(){
    try{
      var e=document.querySelector('[data-cbid="pay_cash"]'), b=document.querySelector('[data-cbid="pay_bank"]'); if(!e||!b) return;
      var cs=window.cbState||{}; if(cs.pay_cash!==undefined || cs.pay_bank!==undefined) return;   // 手で切り替えたものはそのまま
      if(e.textContent!==(_payCash()?'■':'□') || b.textContent!==(_payBank()?'■':'□')){ if(typeof p==='function') p(); }
    }catch(err){}
  }
  window.addEventListener('message', function(e){ try{ if(e.data && e.data.type==='SELECT_CASE'){ setTimeout(_p16AutoCalcMonthly, 3000); setTimeout(_p16AutoCalcMonthly, 6000); setTimeout(function(){ _p16AutoCalcHourly(false); }, 3200); setTimeout(function(){ _p16AutoCalcHourly(false); }, 6200); setTimeout(_payRefresh, 2500); setTimeout(_payRefresh, 5000); } }catch(_e){} });
})();
/* ===== /1-6号 印刷前チェック ===== */
/* ===== ver.20261109.09: 🔍 空欄の参照先（案シスのどこが空か） =====
   左の欄のうち空欄のものに、「本来どこ（案シスの雇用条件・会社・案件・人材・登録支援機関・ヒアリング）から入る欄か」と
   「案シス側が空なのか、案シスには入っているのに入らなかったのか」を札で出す。上に、案シスで入れるべき項目の一覧も出す。
   ・参照先は、書類の読み込み処理の書き方（s('f_x', co.author_name) など）を読み取って調べる＋雇用条件セットの同名項目
   ・案シス側の値は、書類が読み込んだ行（sb() で1件ずつ読んだもの）を見る
   ・項目名は案シスの差し込み項目一覧の名前を使う。各書類の読み込み処理は変えない。 */
var _SRC_LBL={"es":{"createY":"作成日（年）","createM":"作成日（月）","createD":"作成日（日）","createYEn":"作成日（年）翻訳","createMEn":"作成日（月）翻訳","createDEn":"作成日（日）翻訳","applicantName":"申請人の名前","applicantNameEn":"申請人の名前（翻訳）","orgName":"所属機関名","orgNameEn":"所属機関名（翻訳）","orgAddress":"所在地","orgAddressEn":"所在地（翻訳）","orgTel":"電話番号","orgTelEn":"電話番号（翻訳）","repName":"代表者名","repTitle":"代表者役職","repNameEn":"代表者名（翻訳）","repTitleEn":"代表者役職（翻訳）","contractStartY":"契約開始（年）","contractStartM":"契約開始（月）","contractStartD":"契約開始（日）","contractEndY":"契約終了（年）","contractEndM":"契約終了（月）","contractEndD":"契約終了（日）","contractStartYEn":"契約開始（年）翻訳","contractStartMEn":"契約開始（月）翻訳","contractStartDEn":"契約開始（日）翻訳","contractEndYEn":"契約終了（年）翻訳","contractEndMEn":"契約終了（月）翻訳","contractEndDEn":"契約終了（日）翻訳","entryY":"入国予定（年）","entryM":"入国予定（月）","entryD":"入国予定（日）","entryYEn":"入国予定（年）翻訳","entryMEn":"入国予定（月）翻訳","entryDEn":"入国予定（日）翻訳","entryYEn2":"入国予定（年）翻訳2","entryMEn2":"入国予定（月）翻訳2","entryDEn2":"入国予定（日）翻訳2","officeName":"事業所名","officeNameEn":"事業所名（翻訳）","officeAddress":"事業所住所","officeAddressEn":"事業所住所（翻訳）","officeTel":"事業所連絡先","officeTelEn":"事業所連絡先（翻訳）","subOfficeName":"事業所名②（直接雇用②）","subOfficeNameEn":"事業所名②（翻訳）","subOfficeAddress":"事業所住所②","subOfficeAddressEn":"事業所住所②（翻訳）","subOfficeTel":"事業所連絡先②","officePref":"事業所 都道府県（自動）","officeCity":"事業所 市区町村（自動）","officePrefEn":"事業所 都道府県（英語）","officeCityEn":"事業所 市区町村（英語）","cohabitants":"同居人数","housingOwnership":"自己所有/借上","actualCostDesc":"実費相当説明","housingFeeType":"居住費徴収有無（自動）","housingFee":"居住費徴収費用（=居住費控除）","foreignerJobDesc":"外国人の職務内容","foreignerJobDescEn":"外国人の職務内容（翻訳）","applicantField":"分野","applicantFieldEn":"分野（翻訳）","category":"業務区分","categoryEn":"業務区分（翻訳）","startTime":"始業時刻","startTimeEn":"始業時刻（翻訳）","endTime":"終業時刻","endTimeEn":"終業時刻（翻訳）","dailyHours":"1日所定労働時間","dailyHoursEn":"1日所定労働時間（翻訳）","dailyMins":"1日所定労働時間（分）","breakTime":"休憩時間","breakTimeEn":"休憩時間（翻訳）","flexCheck1":"変形労働チェック1","flexCheck2":"変形労働チェック2","flexUnit":"変形労働制単位","flexUnitEn":"変形労働制単位（翻訳）","overtimeCheck1":"時間外労働有無","overtimeCheck2":"時間外労働有無2","weeklyH":"週(時)","weeklyMin":"週(分)","monthlyH":"月(時)","monthlyMin":"月(分)","yearlyH":"年(時)","yearlyMin":"年(分)","weeklyHEn":"週(時)翻訳","weeklyMinEn":"週(分)翻訳","monthlyHEn":"月(時)翻訳","monthlyMinEn":"月(分)翻訳","yearlyHEn":"年(時)翻訳","yearlyMinEn":"年(分)翻訳","weeklyDays":"週日数","monthlyDays":"月日数","yearlyDays":"年日数","weeklyDaysEn":"週日数翻訳","monthlyDaysEn":"月日数翻訳","yearlyDaysEn":"年日数翻訳","fixedDay1":"定休日①","fixedDay2":"定休日②","otherHolidays":"その他休日","fixedDay1En":"定休日①翻訳","fixedDay2En":"定休日②翻訳","otherHolidaysEn":"その他休日翻訳","annualHolidays":"年間休日数","irregDays":"不定期休日日数","irregHolidays":"不定期休日詳細","irregDaysEn":"不定期休日日数翻訳","irregHolidaysEn":"不定期休日詳細翻訳","paidLeave":"有給休暇","otherPaid":"その他有給","unpaidLeave":"無給休暇","paidLeaveEn":"有給休暇（翻訳）","otherPaidEn":"その他有給（翻訳）","unpaidLeaveEn":"無給休暇（翻訳）","salaryMonthly":"月額基本給（賃金計算）","salaryHourly":"時間給（賃金計算）","monthlyWage":"月給","monthlyWageEn":"月給（翻訳）","dailyWage":"日給","dailyWageEn":"日給（翻訳）","hourlyWage":"時給","hourlyWageEn":"時給（翻訳）","monthlyCheck":"月給チェック","dailyCheck":"日給チェック","hourlyCheck":"時給チェック","monthlyCheckEn":"月給チェック翻訳","dailyCheckEn":"日給チェック翻訳","hourlyCheckEn":"時給チェック翻訳","calcHourly":"換算時給","calcHourlyEn":"換算時給（翻訳）","calcMonthly":"換算月給","calcMonthlyEn":"換算月給（翻訳）","hourlyCheck2":"時給チェック（明細）","dailyCheck2":"日給チェック（明細）","monthlyCheck2":"月給チェック（明細）","monthlyCheck2En":"月給チェック（明細翻訳）","dailyCheck2En":"日給チェック（明細翻訳）","allowance1Name":"手当①名","allowance1Amt":"手当①金額","allowance1Cond":"手当①条件","allowance1NameEn":"手当①名翻訳","allowance1AmtEn":"手当①金額翻訳","allowance1CondEn":"手当①条件翻訳","allowance2Name":"手当②名","allowance2Amt":"手当②金額","allowance2Cond":"手当②条件","allowance2NameEn":"手当②名翻訳","allowance2AmtEn":"手当②金額翻訳","allowance2CondEn":"手当②条件翻訳","allowance3Name":"手当③名","allowance3Amt":"手当③金額","allowance3Cond":"手当③条件","allowance3NameEn":"手当③名翻訳","allowance3AmtEn":"手当③金額翻訳","allowance3CondEn":"手当③条件翻訳","allowance4Name":"手当④名","allowance4Amt":"手当④金額","allowance4Cond":"手当④条件","allowance4NameEn":"手当④名翻訳","allowance4AmtEn":"手当④金額翻訳","allowance4CondEn":"手当④条件翻訳","fixedOTName":"固定残業名","fixedOTAmt":"固定残業金額","fixedOTHours":"固定残業時間","fixedOTNameEn":"固定残業名翻訳","fixedOTAmtEn":"固定残業金額翻訳","fixedOTHoursEn":"固定残業時間翻訳","fixedOTHours2":"固定残業時間2","fixedOTHours2En":"固定残業時間2翻訳","ot60under":"法定超60h以内%","ot60underEn":"法定超60h以内%翻訳","ot60over":"法定超60h超%","ot60overEn":"法定超60h超%翻訳","otPrescribed":"所定超%","otPrescribedEn":"所定超%翻訳","holidayLegal":"法定休日%","holidayLegalEn":"法定休日%翻訳","holidayNonLegal":"法定外休日%","holidayNonLegalEn":"法定外休日%翻訳","nightPremium":"深夜割増%","nightPremiumEn":"深夜割増%翻訳","cutoffCheck1":"締め日チェック1","cutoffCheck1En":"締め日チェック1翻訳","payCutoff":"締め日","payCutoffEn":"締め日（翻訳）","cutoffCheck2":"支払日チェック","payDayCheckEn":"支払日チェック翻訳","payDay":"支払日","payDayEn":"支払日（翻訳）","payMethodCheck1":"支払方法チェック1","payMethodCheck2":"支払方法チェック2","totalPay":"月額支給合計","totalPayEn":"月額支給合計翻訳","netPay":"手取り","netPayEn":"手取り翻訳","raiseCheck":"昇給チェック","raiseCondition":"昇給条件","raiseConditionEn":"昇給条件翻訳","bonusCheck":"賞与チェック","bonusCondition":"賞与条件","bonusConditionEn":"賞与条件翻訳","severanceCheck":"退職金チェック","severanceCondition":"退職金条件","severanceConditionEn":"退職金条件翻訳","leaveCheck":"休業手当チェック","leaveAllowance":"休業手当条件","leaveAllowanceEn":"休業手当条件翻訳","resignDays":"退職予告日数","resignDaysEn":"退職予告日数翻訳","taxAmount":"税金","taxAmountEn":"税金翻訳","socialIns":"社会保険料","socialInsEn":"社会保険料翻訳","empIns":"雇用保険料","empInsEn":"雇用保険料翻訳","deductFood":"食費控除","deductFoodEn":"食費控除翻訳","deductFoodType":"食費 実費フラグ(true=控除除外)","deductHousing":"居住費控除","deductHousingEn":"居住費控除翻訳","deductHousingType":"居住費 実費フラグ(true=控除除外)","deductUtility":"水道光熱費控除","deductUtilityEn":"水道光熱費控除翻訳","deductUtilityType":"水道光熱費 実費フラグ(true=控除除外)","deductOther1Name":"その他控除①名","deductOther1Amt":"その他控除①額","deductOther1NameEn":"その他控除①名翻訳","deductOther1AmtEn":"その他控除①額翻訳","deductOther1Type":"その他控除① 実費フラグ(true=控除除外)","deductOther2Name":"その他控除②名","deductOther2Amt":"その他控除②額","deductOther2NameEn":"その他控除②名翻訳","deductOther2AmtEn":"その他控除②額翻訳","deductOther2Type":"その他控除② 実費フラグ(true=控除除外)","totalDeduct":"控除合計","totalDeductEn":"控除合計翻訳","insCheck1":"保険チェック1","insCheck2":"保険チェック2","insCheck3":"保険チェック3","insCheck4":"保険チェック4","insCheck5":"保険チェック5","insCheck6":"保険チェック6","otherInsurance":"その他保険","otherInsuranceEn":"その他保険翻訳","healthCheckY":"健診年","healthCheckM":"健診月","healthCheckYEn":"健診年翻訳","healthCheckMEn":"健診月翻訳","consultantTitle":"相談窓口役職","consultantName":"相談窓口名前","consultantTel":"相談窓口連絡先","consultantTitleEn":"相談窓口役職翻訳","consultantNameEn":"相談窓口名前翻訳","consultantTelEn":"相談窓口連絡先翻訳","workRulesAccess":"就業規則確認方法","workRulesAccessEn":"就業規則確認方法翻訳","supportFee":"支援委託費"},"co":{"name":"所属機関名","nameKana":"所属機関名（かな）","name_kana":"所属機関名（かな）","nameEn":"会社名（英語）","name_en":"会社名（英語）","zip":"郵便番号","pref":"所在地（都道府県）","city":"所在地（市区町村）","address":"所在地（番地以降）","fullAddress":"所在地（都道府県+市区町村+番地 結合）","full_address":"所在地（都道府県+市区町村+番地 結合）","addressEn":"所在地（翻訳）","address_en":"所在地（翻訳）","tel":"電話番号","telEn":"電話番号（翻訳）","tel_en":"電話番号（翻訳）","repName":"代表者名","rep_name":"代表者名","repTitle":"代表者役職","rep_title":"代表者役職","repNameEn":"代表者名（翻訳）","rep_name_en":"代表者名（翻訳）","repTitleEn":"代表者役職（翻訳）","rep_title_en":"代表者役職（翻訳）","authorName":"作成責任者 氏名","author_name":"作成責任者 氏名","authorTitle":"作成責任者 役職","author_title":"作成責任者 役職","authorTitleName":"作成責任者 役職+氏名","author_title_name":"作成責任者 役職+氏名","authorNameEn":"作成責任者（英語）","author_name_en":"作成責任者（英語）","supportStaff":"支援担当者","support_staff":"支援担当者","jpCompJobDesc":"比較対象日本人 職務内容","jp_comp_job_desc":"比較対象日本人 職務内容","jpCompAge":"比較対象日本人 年齢","jp_comp_age":"比較対象日本人 年齢","jpCompGender":"比較対象日本人 性別","jp_comp_gender":"比較対象日本人 性別","jpCompExp":"比較対象日本人 経験年数","jp_comp_exp":"比較対象日本人 経験年数","jpCompSalary":"比較対象日本人 賃金","jp_comp_salary":"比較対象日本人 賃金","jpCompReason":"比較対象日本人 同等理由","jp_comp_reason":"比較対象日本人 同等理由","wageRegulation":"賃金規定有無","wage_regulation":"賃金規定有無","repTitleName":"代表者 役職+氏名","rep_title_name":"代表者 役職+氏名","jpVoluntaryQuit":"(日本人)自発的離職者","jp_voluntary_quit":"(日本人)自発的離職者","jpInvoluntaryQuit":"(日本人)非自発的離職者","jp_involuntary_quit":"(日本人)非自発的離職者","fnVoluntaryQuit":"(外国人)自発的離職者","fn_voluntary_quit":"(外国人)自発的離職者","fnInvoluntaryQuit":"(外国人)非自発的離職者","fn_involuntary_quit":"(外国人)非自発的離職者","salesY1":"前年度売上高","sales_y1":"前年度売上高","salesY2":"前々年度売上高","sales_y2":"前々年度売上高","salesY3":"前々々年度売上高","sales_y3":"前々々年度売上高","ordinaryPLY1":"前年度経常損益","ordinary_p_l_y1":"前年度経常損益","ordinaryPLY2":"前々年度経常損益","ordinary_p_l_y2":"前々年度経常損益","ordinaryPLY3":"前々々年度経常損益","ordinary_p_l_y3":"前々々年度経常損益","netPLY1":"前年度純損益","net_p_l_y1":"前年度純損益","netPLY2":"前々年度純損益","net_p_l_y2":"前々年度純損益","netPLY3":"前々々年度純損益","net_p_l_y3":"前々々年度純損益","netAssetsY1":"前年度純資産","net_assets_y1":"前年度純資産","netAssetsY2":"前々年度純資産","net_assets_y2":"前々年度純資産","netAssetsY3":"前々々年度純資産","net_assets_y3":"前々々年度純資産","officer1Kana":"①役員ふりがな","officer1_kana":"①役員ふりがな","officer1Name":"①役員氏名","officer1_name":"①役員氏名","officer1Title":"①役員役職","officer1_title":"①役員役職","officer2Kana":"②役員ふりがな","officer2_kana":"②役員ふりがな","officer2Name":"②役員氏名","officer2_name":"②役員氏名","officer2Title":"②役員役職","officer2_title":"②役員役職","officer3Kana":"③役員ふりがな","officer3_kana":"③役員ふりがな","officer3Name":"③役員氏名","officer3_name":"③役員氏名","officer3Title":"③役員役職","officer3_title":"③役員役職","officer4Kana":"④役員ふりがな","officer4_kana":"④役員ふりがな","officer4Name":"④役員氏名","officer4_name":"④役員氏名","officer4Title":"④役員役職","officer4_title":"④役員役職","officer5Kana":"⑤役員ふりがな","officer5_kana":"⑤役員ふりがな","officer5Name":"⑤役員氏名","officer5_name":"⑤役員氏名","officer5Title":"⑤役員役職","officer5_title":"⑤役員役職","officer6Kana":"⑥役員ふりがな","officer6_kana":"⑥役員ふりがな","officer6Name":"⑥役員氏名","officer6_name":"⑥役員氏名","officer6Title":"⑥役員役職","officer6_title":"⑥役員役職","officer7Kana":"⑦役員ふりがな","officer7_kana":"⑦役員ふりがな","officer7Name":"⑦役員氏名","officer7_name":"⑦役員氏名","officer7Title":"⑦役員役職","officer7_title":"⑦役員役職","officer8Kana":"⑧役員ふりがな","officer8_kana":"⑧役員ふりがな","officer8Name":"⑧役員氏名","officer8_name":"⑧役員氏名","officer8Title":"⑧役員役職","officer8_title":"⑧役員役職","officer9Kana":"⑨役員ふりがな","officer9_kana":"⑨役員ふりがな","officer9Name":"⑨役員氏名","officer9_name":"⑨役員氏名","officer9Title":"⑨役員役職","officer9_title":"⑨役員役職","officer10Kana":"⑩役員ふりがな","officer10_kana":"⑩役員ふりがな","officer10Name":"⑩役員氏名","officer10_name":"⑩役員氏名","officer10Title":"⑩役員役職","officer10_title":"⑩役員役職","prevSales1":"前年度売上高","prev_sales1":"前年度売上高","prevSales2":"前々年度売上高","prev_sales2":"前々年度売上高","prevSales3":"前々々年度売上高","prev_sales3":"前々々年度売上高","prevOrdinary1":"前年度経常損益","prev_ordinary1":"前年度経常損益","prevOrdinary2":"前々年度経常損益","prev_ordinary2":"前々年度経常損益","prevOrdinary3":"前々々年度経常損益","prev_ordinary3":"前々々年度経常損益","prevNet1":"前年度純損益","prev_net1":"前年度純損益","prevNet2":"前々年度純損益","prev_net2":"前々年度純損益","prevNet3":"前々々年度純損益","prev_net3":"前々々年度純損益","prevAsset1":"前年度純資産","prev_asset1":"前年度純資産","prevAsset2":"前々年度純資産","prev_asset2":"前々年度純資産","prevAsset3":"前々々年度純資産","prev_asset3":"前々々年度純資産","fgnVoluntaryQuit":"(外国人)自発的離職者","fgn_voluntary_quit":"(外国人)自発的離職者","fgnInvoluntaryQuit":"(外国人)非自発的離職者","fgn_involuntary_quit":"(外国人)非自発的離職者","missing1y":"行方不明者(直近1年)","missing2y":"行方不明者(直近2年)","missing3y":"行方不明者(直近3年)","supportOrgName":"登録支援機関名","support_org_name":"登録支援機関名","supportOrgNumber":"登録支援機関番号","support_org_number":"登録支援機関番号"},"p":{"contractStartY":"契約開始年","contract_start_y":"契約開始年","contractStartM":"契約開始月","contract_start_m":"契約開始月","contractStartD":"契約開始日","contract_start_d":"契約開始日","contractEndY":"契約終了年","contract_end_y":"契約終了年","contractEndM":"契約終了月","contract_end_m":"契約終了月","contractEndD":"契約終了日","contract_end_d":"契約終了日","entryY":"入国予定年","entry_y":"入国予定年","entryM":"入国予定月","entry_m":"入国予定月","entryD":"入国予定日","entry_d":"入国予定日","age":"年齢","gender":"性別","experience":"経験年数","nationality":"国籍（カナ）","birthdate":"生年月日（そのまま）","birthY":"生年月日（年）自動","birth_y":"生年月日（年）自動","birthM":"生年月日（月）自動","birth_m":"生年月日（月）自動","birthD":"生年月日（日）自動","birth_d":"生年月日（日）自動","expireY":"在留期限(年)自動","expire_y":"在留期限(年)自動","expireM":"在留期限(月)自動","expire_m":"在留期限(月)自動","expireD":"在留期限(日)自動","expire_d":"在留期限(日)自動","passExpY":"旅券有効期限(年)","pass_exp_y":"旅券有効期限(年)","passExpM":"旅券有効期限(月)","pass_exp_m":"旅券有効期限(月)","passExpD":"旅券有効期限(日)","pass_exp_d":"旅券有効期限(日)","homeAddress":"本国における居住地","home_address":"本国における居住地","desiredStatus":"希望する在留資格","desired_status":"希望する在留資格","address":"住所（人材データ）","passport":"旅券番号","residenceCard":"在留カード番号","residence_card":"在留カード番号","residenceStatus":"現在の在留資格","residence_status":"現在の在留資格","stayPeriod":"在留期間","stay_period":"在留期間","totalStayYear":"特定技能通算在留期間（年）","total_stay_year":"特定技能通算在留期間（年）","totalStayMonth":"特定技能通算在留期間（月）","total_stay_month":"特定技能通算在留期間（月）"},"so":{"name":"登録支援機関名","address":"登録支援機関住所","tel":"登録支援機関電話番号","staff":"支援責任者氏名","repName":"支援機関代表者名","rep_name":"支援機関代表者名","regNo":"登録番号","reg_no":"登録番号","pref":"支援機関都道府県","city":"支援機関市区町村","officeName":"支援事業所名","office_name":"支援事業所名","officeAddress":"支援事業所住所","office_address":"支援事業所住所","language":"対応言語","regY":"登録年月日(年)","reg_y":"登録年月日(年)","regM":"登録年月日(月)","reg_m":"登録年月日(月)","regD":"登録年月日(日)","reg_d":"登録年月日(日)"},"case":{"docCreateDate":"書類作成日","company":"所属機関名（案件）","entryDate":"入国予定日（/区切り）","contractEndDate":"契約終了日"}};
(function(){ var E=_SRC_LBL.es, C=_SRC_LBL.co||{};
  ['JobDesc','Age','Gender','Exp','Salary','Reason'].forEach(function(x){ var k='jpComp'+x; if(!E[k]) E[k]=C[k]||C['jp_comp_'+x.toLowerCase()]||('比較対象日本人 '+x); });
  for(var n=1;n<=6;n++){ if(!E['allowance'+n+'Amount']) E['allowance'+n+'Amount']=E['allowance'+n+'Amt']||('手当'+'①②③④⑤⑥'[n-1]+'金額'); }
  var add={salaryRaiseCond:'昇給条件',salaryRaiseTime:'昇給時期',salaryRaiseAmount:'昇給額',wageRegulation:'賃金規程の有無',salaryRuleApply:'賃金規程に基づく報酬',foreignerJobDesc:'外国人の職務内容',category:'業務区分',category2:'業務区分（2つ目）',cohabitants:'同居人数',actualCostDesc:'実費の説明',housingOwnership:'住居（自己所有・借上）'};
  Object.keys(add).forEach(function(k){ if(!E[k]) E[k]=add[k]; });
})();
_SRC_LBL.cases={applicant:'申請人氏名',doc_create_date:'書類作成日',contract_start:'契約開始日',contract_end:'契約終了日',app_type:'申請種別',residence_status:'在留資格',nationality:'国籍',org:'登録支援機関（案件）',company:'所属機関名（案件）',emp_set_idx:'使用する雇用条件セット',applicant_field:'分野',senddashi_org:'送出し機関',senddashi_payment:'送出し機関への支払い',receipt_no:'申請受付番号',job_category:'業務区分（案件）'};
var _SRC_GRP={emp:{icon:'📋',name:'雇用条件セット',tb:null,lbl:'es'},co:{icon:'🏢',name:'会社情報',tb:'companies',lbl:'co'},cas:{icon:'🗂',name:'案件情報',tb:'cases',lbl:'cases'},
  per:{icon:'👤',name:'人材情報',tb:'persons',lbl:'p'},so:{icon:'🤝',name:'登録支援機関',tb:'support_orgs',lbl:'so'},ir:{icon:'📝',name:'ヒアリング',tb:'intake_requests',lbl:null}};
var _SRC_VAR={co:'co',company:'co',_co:'co',cas:'cas',cs:'cas',cas0:'cas',ca:'cas',pd:'per',per:'per',person:'per',psn:'per',es:'emp',_es:'emp',esJ:'emp',es0:'emp',_es0:'emp',emp:'emp',ir:'ir',so:'so',_so:'so',soRow:'so'};
// 使う会社だけが入れる項目（空でもふつう）。赤い一覧には出さない
var _SRC_OPT=/^(shift\d|shiftDetail|deductOther\d|allowance\d|a\d(Name|Amt|Calc)|category2|nonReg|other|unpaid|salaryDaily|salaryHourly|calcMonthly|calcHourly|fixedOT|retire|bonus|entry[YMD]|dispatch|jpCompAllow|flex|holidayOther)/i;
var _srcMapCache=null;
function _srcBuildMap(){
  if(_srcMapCache) return _srcMapCache;
  var map={}, add=function(id,g,k){ (map[id]=map[id]||[]); if(!map[id].some(function(x){ return x.g===g&&x.k===k; })) map[id].push({g:g,k:k}); };
  var txt=''; document.querySelectorAll('script:not([src])').forEach(function(sc){ txt+=sc.textContent+'\n'; });
  var re=/\b(?:s|S|_s|set|put|sv|setVal|setAutoDefault|setValMulti)\(\s*(\[[^\]]*\]|'[^']+'|"[^"]+")\s*,\s*([^;\n]{0,240})/g, m;
  while((m=re.exec(txt))){
    var ids=(m[1].match(/(?:es|f)_[A-Za-z0-9_]+/g)||[]); if(!ids.length) continue;
    var rr=/\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/g, r2;
    while((r2=rr.exec(m[2]))){ var g=_SRC_VAR[r2[1]]; if(!g) continue; if(/^(length|trim|replace|split|join|indexOf|map|filter|toString|slice)$/.test(r2[2])) continue; ids.forEach(function(id){ add(id,g,r2[2]); }); }
  }
  _srcMapCache=map; return map;
}
function _srcIsEmpty(v){ return v==null || String(v).trim()===''; }
function _srcLabel(g,k){ var L=_SRC_GRP[g]&&_SRC_GRP[g].lbl&&_SRC_LBL[_SRC_GRP[g].lbl]; return (L&&L[k])||k; }
function _srcEmptyInfo(el){
  var map=_srcBuildMap(), list=(map[el.id]||[]).slice();
  var es=_srcEmpSet(), R=window._srcRows||{}, base=el.id.replace(/^(es_|f_)/,'');
  if(!list.some(function(x){ return x.g==='emp'; })){   // 雇用条件セットの同名項目（共通の読み込み）
    var cand=[base, base.replace(/Amount$/,'Amt'), base.replace(/Amt$/,'Amount')];
    for(var ci=0;ci<cand.length;ci++){ if(_SRC_LBL.es[cand[ci]] || (es && es[cand[ci]]!==undefined)){ list.push({g:'emp',k:cand[ci]}); break; } }
  }
  if(!list.length) return null;
  var out=list.map(function(x){
    var row = x.g==='emp' ? es : (R[_SRC_GRP[x.g].tb]||null);
    var v = row ? row[x.k] : undefined;
    return {g:x.g, k:x.k, label:_srcLabel(x.g,x.k), state: !row ? 'unknown' : (_srcIsEmpty(v) ? 'empty' : 'filled'), val:v};
  });
  return out;
}
function srcToggle(){
  var on=!document.querySelector('.src-badge');
  document.querySelectorAll('.src-badge,#srcLegend').forEach(function(e){ e.remove(); });
  var btn=document.getElementById('_srcBtn'); if(btn) btn.textContent=on?'🔍 空欄チェックを消す':'🔍 空欄チェック（案シスのどこが空か）';
  if(!on) return;
  _srcMapCache=null;
  var todo={}, nEmpty=0, nOther=0, nUnk=0, nOpt=0;
  document.querySelectorAll('.fp input[id], .fp select[id], .fp textarea[id]').forEach(function(el){
    if(el.type==='hidden' || el.type==='checkbox' || el.type==='radio' || el.id==='caseSelect' || /Select$/.test(el.id) || /^sp_/.test(el.id) || el.offsetParent===null) return;
    if(!_srcIsEmpty(el.value)) return;
    var info=_srcEmptyInfo(el), b=document.createElement('span'); b.className='src-badge';
    var txt, color, bg, tip;
    var isTr=/(En|Vi|Id|My|Ne|Km|Zh|Th|Ko|Tr)$/.test(el.id) && document.getElementById(el.id.replace(/(En|Vi|Id|My|Ne|Km|Zh|Th|Ko|Tr)$/,''));
    if(isTr){ var ja=document.getElementById(el.id.replace(/(En|Vi|Id|My|Ne|Km|Zh|Th|Ko|Tr)$/,''));
      if(ja && _srcIsEmpty(ja.value)) return;   // 日本語も空なら、日本語の欄の札だけ出す
      txt='🌐 訳が空（上の「🌐 訳が空いている欄をまとめて翻訳」で入ります）'; color='#1d4ed8'; bg='#eff6ff'; tip='日本語は入っていて訳だけが空です。翻訳ボタンで入れられます（案シスの雇用条件に訳を入れておけば次から自動で入ります）'; nOther++; }
    else if(!info){ txt='✍ この書類で入力（案シスの対応項目なし）'; color='#64748b'; bg='#f8fafc'; tip='案シスから読み込む欄ではありません。必要ならこの書類で入力してください'; nOther++; }
    else{
      var emp=info.filter(function(x){ return x.state==='empty'; }), fil=info.filter(function(x){ return x.state==='filled'; });
      var _opt=emp.length && emp.every(function(e){ return _SRC_OPT.test(e.k); });
      if(emp.length && _opt){ var o=emp[0], go=_SRC_GRP[o.g]; txt='▫ 案シス'+go.name+'「'+o.label+'」が空（使う場合だけ）'; color='#64748b'; bg='#f8fafc';
        tip='使う会社だけが入れる項目です（交代制の2つ目以降・その他控除・手当など）。必要なら案シスの'+go.name+'で入れてください'; nOpt++; }
      else if(emp.length){ var x=emp.filter(function(e){ return !_SRC_OPT.test(e.k); })[0]||emp[0], gg=_SRC_GRP[x.g];
        var labs=emp.filter(function(e){ return e.g===x.g; }).slice(0,3).map(function(e){ return e.label; });
        txt='⬜ 案シス '+gg.icon+gg.name+'「'+labs.join('・')+'」が空'; color='#b91c1c'; bg='#fef2f2';
        tip='案シスの'+gg.name+'の「'+labs.join('」「')+'」が空のため、この欄も空です。案シスで入れると次から自動で入ります'; nEmpty++;
        var key=gg.icon+' '+gg.name; (todo[key]=todo[key]||{}); labs.forEach(function(l){ todo[key][l]=1; }); }
      else if(fil.length){ var y=fil[0], g2=_SRC_GRP[y.g]; txt='⚠ 案シス'+g2.name+'「'+y.label+'」には入っています'; color='#b45309'; bg='#fffbeb';
        tip='案シスには「'+String(y.val).slice(0,40)+'」と入っていますが、この欄には入っていません（書類の作り方で使わない値か、読み込みの不具合）。必要ならこの値を入れてください'; nOther++; }
      else { var z=info[0], g3=_SRC_GRP[z.g]; txt='… 参照先：'+g3.icon+g3.name+'「'+z.label+'」'; color='#475569'; bg='#f1f5f9'; tip='この欄は案シスの'+g3.name+'「'+z.label+'」から入ります（今は読み込めていないため空か判定できません）'; nUnk++; }
    }
    b.textContent=txt; b.title=tip;
    b.style.cssText='display:inline-block;margin:2px 0 0;padding:0 6px;border-radius:9px;font-size:10px;line-height:16px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;color:'+color+';background:'+bg+';border:1px solid '+color+'33;';
    el.insertAdjacentElement('afterend', b);
  });
  var host=document.querySelector('.fp-inner')||document.querySelector('.fp'); if(!host) return;
  var lg=document.createElement('div'); lg.id='srcLegend';
  lg.style.cssText='margin:0 0 8px;padding:7px 9px;border:1px solid #fecaca;border-radius:8px;background:#fff;font-size:11px;line-height:1.6;color:#334155';
  var keys=Object.keys(todo);
  lg.innerHTML = keys.length
    ? '<b style="color:#b91c1c">案シスで入れると自動で入る項目（'+nEmpty+'欄）</b>'+keys.map(function(k){ return '<div style="margin-top:3px"><b>'+k+'</b>：'+Object.keys(todo[k]).map(function(t){ return t.replace(/[<>&]/g,''); }).join('、')+'</div>'; }).join('')
      +(nOpt?'<div style="margin-top:3px;color:#64748b">▫ 使う場合だけ入れる項目の空欄：'+nOpt+'欄（交代制の2つ目以降・その他控除・手当など）</div>':'')
      +'<div style="margin-top:4px;color:#64748b;font-size:10.5px">空欄の下の札にマウスを乗せると説明が出ます。'+(nOther?'「✍ この書類で入力」「⚠」の欄は案シスでは埋まりません。':'')+'</div>'
    : '<b style="color:#15803d">✅ 案シス側が空のために空欄になっている欄はありません</b>'+(nOther||nUnk?'<div style="color:#64748b;font-size:10.5px">残りの空欄は、この書類で入力する欄です。</div>':'');
  var bt=document.getElementById('_srcBtn'); if(bt && bt.parentNode===host) bt.insertAdjacentElement('afterend', lg); else host.insertBefore(lg, host.firstChild);
}
window.srcToggle=srcToggle;
// ver.20261109.07: 案件を読み込んだあと、案シス側が空のために空欄になっている欄があれば、左上に要約だけ自動で出す（押すと詳しく）
// 案シス側が空のために空欄になっている欄（任意・訳の欄を除く）の一覧
function _srcHourlyOrDaily(){ var v=function(id){ var e=document.getElementById(id); return e?String(e.value||'').trim():''; }; return !!(v('es_salaryHourly')||v('es_salaryDaily')||v('f_salaryHourly')||v('f_salaryDaily')); }
function _srcRedItems(){
  var todo={}, n=0;
  try{
    _srcMapCache=null;
    document.querySelectorAll('.fp input[id], .fp select[id], .fp textarea[id]').forEach(function(el){
      if(el.type==='hidden'||el.type==='checkbox'||el.type==='radio'||el.id==='caseSelect'||/Select$/.test(el.id)||/^sp_/.test(el.id)||el.offsetParent===null) return;
      if(!_srcIsEmpty(el.value) || /(En|Vi|Id|My|Ne|Km|Zh|Th|Ko|Tr)$/.test(el.id)) return;
      var info=_srcEmptyInfo(el); if(!info) return;
      var _hd=_srcHourlyOrDaily();
      var emp=info.filter(function(x){ return x.state==='empty' && !_SRC_OPT.test(x.k) && !(_hd && /^(salaryMonthly|calcHourly)$/.test(x.k)); }); if(!emp.length) return;   // 時給・日給の人は月給が空でふつう
      var gg=_SRC_GRP[emp[0].g], key=gg.icon+gg.name; (todo[key]=todo[key]||{}); emp.filter(function(e){ return e.g===emp[0].g; }).slice(0,3).forEach(function(e){ todo[key][e.label]=1; }); n++;
    });
  }catch(e){ console.warn('[空欄の一覧]', e); }
  var items=[]; Object.keys(todo).forEach(function(k){ Object.keys(todo[k]).forEach(function(l){ items.push(k+' '+l); }); });
  return {n:n, items:items};
}
window._srcRedItems=_srcRedItems;
// ver.20261109.08: まとめてPDFのとき、見えない画面で開いた書類ごとに、印刷前チェックと同じ内容を集める
window._batchCheck=function(){
  var out=[];
  try{
    if(typeof _p16AutoCalcMonthly==='function' && /(^|\/)1_6(_[a-z]+)?\.html/.test(location.pathname)) _p16AutoCalcMonthly();
    if(typeof _p16PrintCheck==='function' && /(^|\/)1_6(_[a-z]+)?\.html/.test(location.pathname)){
      var r=_p16PrintCheck(); r.probs.forEach(function(x){ out.push(x); }); if(r.miss.length) out.push('空欄：'+r.miss.join('、'));
    }
    if(!/(^|\/)1_6(_[a-z]+)?\.html/.test(location.pathname) && typeof window._wlSummary==='function'){ var _wls=window._wlSummary(); if(_wls) out.push('⛔ 訳が別の言語になっています（'+_wls+'）'); }
    if(typeof window._jyTotalsIssue==='function'){ window._jyTotalsIssue().forEach(function(x){ out.push(x); }); }
    if(typeof jyPrintCheck==='function'){
      var j=jyPrintCheck(); (j.diff||[]).forEach(function(x){ out.push('⚠ 雇用条件と違う：'+x); });
      if((j.miss||[]).length) out.push('空欄：'+j.miss.join('、'));
      if((j.tr||[]).length) out.push('🌐 訳がない欄 '+j.tr.length+'か所');
    }
    if(!/(^|\/)1_17(_[a-z]+)?\.html/.test(location.pathname)){
      var R=_srcRedItems(); if(R.n) out.push('⬜ 案シスで埋めてください（'+R.n+'欄）：'+R.items.slice(0,4).join('、')+(R.items.length>4?' ほか':''));
    }
  }catch(e){ console.warn('[まとめPDFのチェック]', e); }
  return out;
};
function _srcAutoSummary(){
  try{
    if(/(^|\/)1_17(_[a-z]+)?\.html/.test(location.pathname)) return;
    var host=document.querySelector('.fp-inner')||document.querySelector('.fp'); if(!host || !document.getElementById('pageArea')) return;
    var old=document.getElementById('srcAuto'); if(old) old.remove();
    if(document.querySelector('.src-badge')) return;   // 詳しい表示中は出さない
    var R=_srcRedItems(); var items=R.items, n=R.n; if(!n) return;
    var box=document.createElement('div'); box.id='srcAuto';
    box.style.cssText='margin:0 0 8px;padding:6px 9px;border:1px solid #fecaca;border-radius:8px;background:#fff7f7;color:#991b1b;font-size:11px;line-height:1.55;cursor:pointer';
    box.title='押すと、空欄ごとに案シスのどこが空かを表示します';
    box.innerHTML='<b>⬜ 案シスで埋めてください（'+n+'欄）</b><br>'+items.slice(0,4).map(function(t){ return t.replace(/[<>&]/g,''); }).join('、')+(items.length>4?' ほか'+(items.length-4)+'件':'')+' <u>詳しく</u>';
    box.onclick=function(){ box.remove(); srcToggle(); };
    var bt=document.getElementById('_srcBtn'); if(bt && bt.parentNode===host) bt.insertAdjacentElement('afterend', box); else host.insertBefore(box, host.firstChild);
  }catch(e){ console.warn('[空欄の要約]', e); }
}
window.addEventListener('message', function(e){ try{ if(e.data && e.data.type==='SELECT_CASE'){ var o=document.getElementById('srcAuto'); if(o) o.remove(); setTimeout(_srcAutoSummary, 4500); setTimeout(_srcAutoSummary, 9000); } }catch(_e){} });
(function(){
  function inj(){
    try{
      if(document.getElementById('_srcBtn')) return;
      if(/(^|\/)1_17(_[a-z]+)?\.html/.test(location.pathname)) return;   // 1-17号は独自の「確認が必要な項目」があるので出さない
      var host=document.querySelector('.fp-inner')||document.querySelector('.fp'); if(!host || !document.getElementById('pageArea')) return;
      var b=document.createElement('button'); b.type='button'; b.id='_srcBtn'; b.textContent='🔍 空欄チェック（案シスのどこが空か）';
      b.title='空欄の欄ごとに、案シスのどこ（雇用条件・会社・案件・人材など）が空なのかを表示します';
      b.style.cssText='display:block;width:100%;margin:0 0 8px;padding:6px;border:1px solid #fca5a5;background:#fff7f7;color:#b91c1c;border-radius:8px;font-size:11.5px;font-weight:700;cursor:pointer;';
      b.onclick=function(ev){ ev.preventDefault(); srcToggle(); };
      host.insertBefore(b, host.firstChild);
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(inj,400); }); else setTimeout(inj,400);
  window.addEventListener('message', function(e){ try{ if(e.data && e.data.type==='SELECT_CASE'){ window._srcRows={}; if(document.querySelector('.src-badge')) srcToggle(); } }catch(_e){} });
})();
/* ===== /空欄の参照先 ===== */
/* ===== ver.20261109.03: 手入力の記録 =====
   「手入力0」に向けて、どの欄を手で入れた・直したかを保存のときに利用ログ（saysay_logs.meta）へ残す。
   ・左の入力欄：最初に触った時点の値（＝自動で入った値）と保存時の値を比べ、変わった欄を記録
   ・書類の直接編集：最初に本文を触った時点の文と保存時の文を比べ、増えた行（最大8行）を記録
   ・案件を選び直したら記録を空にする。保存後は保存した値を基準にする（同じ直しを二重に数えない）
   画面の動きは変えない。 */
window._miV0 = window._miV0 || {};
window._miTxt0 = null;
function _miVal(el){ if(!el) return ''; if(el.type==='checkbox'||el.type==='radio') return el.checked?'☑':'☐'; return String(el.value==null?'':el.value); }
function _miLabel(el){
  try{
    var dl=el.getAttribute('data-label'); if(dl) return dl.slice(0,60);
    var fg=el.closest('.fg'); var lb=fg&&fg.querySelector('label');
    if(lb){ var t=''; lb.childNodes.forEach(function(n){ if(n.nodeType===3) t+=n.textContent; }); t=t.trim(); if(t) return t.slice(0,60); }
    if(el.placeholder) return String(el.placeholder).slice(0,60);
  }catch(_e){}
  return '';
}
function _miPageLines(){
  var a=document.getElementById('pageArea'); if(!a) return [];
  return String(a.innerText||'').split('\n').map(function(s){ return s.replace(/\s+/g,' ').trim(); }).filter(function(s){ return s.length>1; });
}
document.addEventListener('focusin', function(e){
  try{
    var t=e.target; if(!t) return;
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.id && t.id!=='caseSelect' && !/^sp_/.test(t.id)){
      if(!(t.id in window._miV0)) window._miV0[t.id]=_miVal(t);
    } else if(window._miTxt0===null && t.closest && t.closest('#pageArea') && (t.isContentEditable || (typeof _editMode!=='undefined' && _editMode))){
      window._miTxt0=_miPageLines();
    }
  }catch(_e){}
}, true);
window.addEventListener('message', function(e){ try{ if(e.data && e.data.type==='SELECT_CASE'){ window._miV0={}; window._miTxt0=null; } }catch(_e){} });
/* ver.20261111.12: 印刷し直しの記録
   印刷のたびに左の入力欄・チェック・書類の本文を覚えておき、同じ案件でもう一度印刷したら、前の印刷から変わったところを
   利用ログ（print の meta）へ残す。印刷してすぐ直して刷り直す原因を調べ、印刷前チェックや自動入力に足すため。画面の動きは変えない。 */
window._prLast=null;
function _prSnap(){
  var v={};
  document.querySelectorAll('input[id],textarea[id],select[id]').forEach(function(el){
    if(el.closest && el.closest('#pageArea')) return;
    if(/^(caseSelect|caseIdPaste)$/.test(el.id) || /^sp_|^mp/.test(el.id) || el.type==='file' || el.type==='password') return;
    v[el.id]=_miVal(el);
  });
  var cb={}; try{ var cs=window.cbState||{}; Object.keys(cs).forEach(function(k){ cb[k]=String(cs[k]); }); }catch(_c){}
  return { at:Date.now(), caseId:_SLOG_CTX.caseId, v:v, cb:cb, lines:_miPageLines() };
}
function _prDiff(){
  var now=_prSnap(), L=window._prLast; window._prLast=now;
  if(!L || L.caseId!==now.caseId) return null;
  var cut=function(x){ x=String(x==null?'':x); return x.length>40?x.slice(0,40)+'…':x; };
  var ch=[];
  Object.keys(now.v).forEach(function(id){ if(id in L.v && L.v[id]!==now.v[id]){ var el=document.getElementById(id); ch.push({id:id, label:el?_miLabel(el):'', from:cut(L.v[id]), to:cut(now.v[id])}); } });
  var cbc=[]; Object.keys(Object.assign({},L.cb,now.cb)).forEach(function(k){ if(L.cb[k]!==now.cb[k]) cbc.push(k); });
  var before={}, lines=[]; L.lines.forEach(function(x){ before[x]=(before[x]||0)+1; });
  now.lines.forEach(function(x){ if(before[x]) before[x]--; else if(lines.length<8) lines.push(cut(x.length>80?x.slice(0,80):x)); });
  return { reprint:true, since_prev_ms:now.at-L.at, changed:ch.slice(0,40), n_changed:ch.length, cb_changed:cbc.slice(0,20), page_lines_new:lines, same:(!ch.length && !cbc.length && !lines.length) };
}
window.addEventListener('message', function(e){ try{ if(e.data && e.data.type==='SELECT_CASE') window._prLast=null; }catch(_e){} });
function _miCollect(){
  var out=[], cut=function(s){ s=String(s||''); return s.length>40 ? s.slice(0,40)+'…' : s; };
  Object.keys(window._miV0||{}).forEach(function(id){
    var el=document.getElementById(id); if(!el) return;
    var v=_miVal(el), v0=window._miV0[id];
    if(v!==v0){ out.push({id:id, label:_miLabel(el), from:cut(v0), to:cut(v)}); window._miV0[id]=v; }
  });
  var lines=[];
  if(window._miTxt0){
    var before={}; window._miTxt0.forEach(function(s){ before[s]=(before[s]||0)+1; });
    var now=_miPageLines();
    now.forEach(function(s){ if(before[s]) before[s]--; else if(lines.length<8) lines.push(cut(s.length>80?s.slice(0,80):s)); });
    window._miTxt0=now;
  }
  if(!out.length && !lines.length) return null;
  return { manual: out.slice(0,40), n_manual: out.length, edited_lines: lines };
}
/* ver.20261109.03: 手で打った日付「2026年  9月    1日」「令和 8年10月 1日」の余分な空白を、欄から出たときに詰める
   （年・月・日が全部数字で入っているときだけ。「令和　年　月　日」のような空欄の枠は触らない） */
document.addEventListener('focusout', function(e){
  try{
    var t=e.target; if(!t || !/^(INPUT|TEXTAREA)$/.test(t.tagName) || t.type==='checkbox') return;
    var v=String(t.value||''); if(!/年/.test(v) || !/日/.test(v)) return;
    var m=v.normalize('NFKC').match(/^\s*(令和|平成|昭和)?\s*(\d{1,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*$/);
    if(!m) return;
    var n=(m[1]||'')+parseInt(m[2],10)+'年'+parseInt(m[3],10)+'月'+parseInt(m[4],10)+'日';
    if(n!==v){ t.value=n; if(typeof p==='function'){ try{ p(); }catch(_p){} } }
  }catch(_e){}
}, true);
/* ===== /手入力の記録 ===== */
/* ===== /利用ログ ===== */

/* ===== ver.20261026.04: 編集HTMLの受け皿（saysay_html_store） =====
   直接編集・スタイル編集（余白・枠線・文字移動）・文字サイズを、
   「雇用条件（company_id＋雇用条件セット番号）× 書類ファイル（例 1_6_vi）」単位で保存し、
   同じ雇用条件の案件を開いたときに最新版を呼び戻す。
   - 保存：DB保存のたびに、編集あり（直接編集中／編集版フリーズ中／スタイル編集あり）なら1行追加（履歴）。
           前回保存と同じ内容ならスキップ。
   - 呼戻：案件ごとの編集版（extra._edited）より新しければこちらを採用。変数欄は applyBindings で最新値に。
   - 破棄：「♻️ 編集版破棄」で discarded=true の行を追加 → 以後は呼び戻さない（新しく編集保存すれば復活）。 */
window._htmlStoreLast = window._htmlStoreLast || {};
function _htmlStoreDocFile(){ return ((location.pathname.split('/').pop()||'').replace(/\.html.*$/,'')) || ''; }
function _htmlStoreIdx(explicit){
  var cand = [explicit, window._lastCaseInfo && window._lastCaseInfo.empSetIdx, window._empLoadedIdx];
  for(var i=0;i<cand.length;i++){
    var v=cand[i]; if(v===undefined||v===null||v==='') continue;
    var n=parseInt(v,10); if(!isNaN(n) && n>=0) return n;
  }
  return null;
}
async function _htmlStoreCompanyId(o){
  var cid = (o&&o.companyId) || (window._lastCaseInfo && window._lastCaseInfo.companyId) || '';
  if(!cid && o && o.caseId){ try{ var q=await sb('cases?select=company_id&id=eq.'+encodeURIComponent(o.caseId)); if(q&&q[0]) cid=q[0].company_id||''; }catch(_e){} }
  return cid;
}
function _htmlStoreHasEdits(){
  return !!(window._htmlFrozen || (typeof _editMode!=='undefined' && _editMode) || window._styleDirty);
}
// --- 雇用条件セットの固定ID（companies.emp_sets[n]._uid）で紐づける ---
//   ・IDが無いセットには、編集版を初めて保存するときに1回だけ付ける（DB関数 set_emp_set_uid で原子的に）
//   ・案シスでセットを複製してIDが重複した場合（前のセットと同じID）は、新しいIDを付け直す
//   ・案シスの古い画面からの保存でIDが消えた場合は、セット番号＋セット名で探し直してIDを付け直す
function _htmlStoreNewUid(){ return 'es_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function _htmlStoreStampLocal(idx, uid){
  try{ if(window._empLoadedSet && (window._empLoadedIdx==null || parseInt(window._empLoadedIdx,10)===idx)) window._empLoadedSet._uid=uid; }catch(_e){}
  try{ if(window._empCtx && window._empCtx.empSets && window._empCtx.empSets[idx]) window._empCtx.empSets[idx]._uid=uid; }catch(_e){}
}
async function _htmlStoreSets(cid){
  var r=await sb('companies?select=emp_sets&id=eq.'+encodeURIComponent(cid));
  return (r && r[0] && Array.isArray(r[0].emp_sets)) ? r[0].emp_sets : [];
}
async function _htmlStoreAssignUid(cid, idx, uid, force){
  var got=await sb('rpc/set_emp_set_uid',{method:'POST',body:JSON.stringify({p_company_id:cid,p_idx:idx,p_uid:uid,p_force:!!force})});
  var u=(typeof got==='string' && got) ? got : uid;
  _htmlStoreStampLocal(idx, u);
  return u;
}
// その雇用条件セットの固定IDを返す（assign=true なら無い／重複のとき付ける）
async function _htmlStoreSetUid(cid, idx, assign){
  var sets=await _htmlStoreSets(cid);
  var set=sets[idx]; if(!set || typeof set!=='object') return {uid:null, setName:'', ok:false};
  var uid=set._uid||'';
  var dup=!!uid && sets.some(function(s,i){ return i<idx && s && s._uid===uid; });
  if((!uid || dup) && assign){ uid=await _htmlStoreAssignUid(cid, idx, _htmlStoreNewUid(), dup); dup=false; }
  return {uid:(uid&&!dup)?uid:null, setName:String(set.setName||''), ok:true, sets:sets};
}
async function _htmlStoreSave(o){
  o=o||{};
  if(!_htmlStoreHasEdits()) return false;
  var area=document.getElementById('pageArea'); if(!area) return false;
  var caseId=o.caseId || (window._lastCaseInfo && window._lastCaseInfo.caseId) || '';
  var cid=await _htmlStoreCompanyId({companyId:o.companyId, caseId:caseId});
  var idx=_htmlStoreIdx(o.empSetIdx);
  var doc=_htmlStoreDocFile();
  if(!cid || idx===null || !doc) return false;
  var html=(typeof getBindResetHtml==='function') ? getBindResetHtml() : area.innerHTML;
  if(!html) return false;
  var fs=(typeof _fontSize!=='undefined') ? _fontSize : null;
  var sig=html.length+':'+fs+':'+html.slice(0,200)+html.slice(-200);
  try{ var h=0; for(var i=0;i<html.length;i++){ h=((h<<5)-h+html.charCodeAt(i))|0; } sig+=':'+h; }catch(_h){}
  var lk=cid+'|'+idx+'|'+doc;
  // 直接編集中の自動保存（10秒ごと）は「下書き」として同じ1行を上書きし、履歴を増やさない。
  // 「💾 DB保存」を押したとき／編集モードを終えたとき（自動保存以外）にその行を確定させる。
  var isAuto=!!window._autosaving;
  var draft=(window._htmlStoreDraft && window._htmlStoreDraft.key===lk) ? window._htmlStoreDraft : null;
  if(window._htmlStoreLast[lk]===sig){ if(!isAuto) window._htmlStoreDraft=null; return true; } // 前回と同じ内容 → 追加しない
  var st=await _htmlStoreSetUid(cid, idx, true);
  if(!st.ok || !st.uid) return false;
  var by=''; try{ by=(typeof _slogUser==='function')?_slogUser():''; }catch(_u){}
  var rowBody={company_id:cid, emp_set_uid:st.uid, emp_set_idx:idx, set_name:st.setName, doc_file:doc, case_id:caseId, html:html, font_size:fs, saved_by:by};
  var done=false;
  if(draft){
    try{
      var up=await sb('saysay_html_store?id=eq.'+draft.id+'&select=id',{method:'PATCH',headers:{'Prefer':'return=representation'},
        body:JSON.stringify({html:html, font_size:fs, case_id:caseId, saved_by:by, saved_at:new Date().toISOString()})});
      done=!!(up && up.length);
    }catch(_p){ done=false; }
  }
  if(!done){
    var ins=await sb('saysay_html_store?select=id',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(rowBody)});
    window._htmlStoreDraft=(isAuto && ins && ins[0]) ? {id:ins[0].id, key:lk} : null;
  }else if(!isAuto){
    window._htmlStoreDraft=null; // 確定
  }
  window._htmlStoreLast[lk]=sig;
  window._styleDirty=false;
  return true;
}
async function _htmlStoreDiscard(o){
  o=o||{};
  var caseId=o.caseId || (window._lastCaseInfo && window._lastCaseInfo.caseId) || '';
  var cid=await _htmlStoreCompanyId({companyId:o.companyId, caseId:caseId});
  var idx=_htmlStoreIdx(o.empSetIdx);
  var doc=_htmlStoreDocFile();
  if(!cid || idx===null || !doc) return false;
  var st=await _htmlStoreSetUid(cid, idx, true);
  if(!st.ok || !st.uid) return false;
  var by=''; try{ by=(typeof _slogUser==='function')?_slogUser():''; }catch(_u){}
  await sb('saysay_html_store',{method:'POST',headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({company_id:cid, emp_set_uid:st.uid, emp_set_idx:idx, set_name:st.setName, doc_file:doc, case_id:caseId, html:'', discarded:true, saved_by:by})});
  delete window._htmlStoreLast[cid+'|'+idx+'|'+doc];
  window._htmlStoreDraft=null;
  return true;
}
async function _htmlStoreRestore(info){
  info=info||window._lastCaseInfo||{};
  window._htmlStoreDraft=null; // 案件を開き直したら、前の編集の下書きは確定扱い
  var area=document.getElementById('pageArea'); if(!area) return false;
  var cid=await _htmlStoreCompanyId({companyId:info.companyId, caseId:info.caseId});
  var idx=_htmlStoreIdx(window._empLoadedIdx);
  var doc=_htmlStoreDocFile();
  if(!cid || idx===null || !doc) return false;
  var st=await _htmlStoreSetUid(cid, idx, false);
  if(!st.ok) return false;
  var base='saysay_html_store?select=html,font_size,discarded,saved_at,case_id,emp_set_uid&company_id=eq.'+encodeURIComponent(cid)+'&doc_file=eq.'+encodeURIComponent(doc);
  var rows;
  if(st.uid){
    rows=await sb(base+'&emp_set_uid=eq.'+encodeURIComponent(st.uid)+'&order=saved_at.desc&limit=1');
  }else{
    // IDが無い（案シスの古い画面からの保存で消えた／複製で重複）→ セット番号＋セット名で探し直す
    rows=await sb(base+'&emp_set_idx=eq.'+idx+'&set_name=eq.'+encodeURIComponent(st.setName)+'&order=saved_at.desc&limit=1');
    var r0=rows&&rows[0];
    if(r0 && r0.emp_set_uid){
      var usedElse=(st.sets||[]).some(function(s,i){ return i!==idx && s && s._uid===r0.emp_set_uid; });
      if(!usedElse){ try{ await _htmlStoreAssignUid(cid, idx, r0.emp_set_uid, true); }catch(_a){} }
      else rows=[];
    }
  }
  var r=rows&&rows[0];
  if(!r || r.discarded || !r.html) return false;
  var at=Date.parse(r.saved_at)||0;
  if(window._editedRestoredAt && window._editedRestoredAt>=at) return false; // 案件ごとの編集版の方が新しい
  window._editedRestoring=true;
  area.innerHTML=r.html;
  window._htmlFrozen=true; window._editedRestored=true;
  if(r.font_size!==null && r.font_size!==undefined && typeof _applyFontSize==='function'){
    try{ _fontSize=parseFloat(r.font_size)||_fontSize; _applyFontSize(); var lbl=document.getElementById('fontSizeLabel'); if(lbl) lbl.textContent=_fontSize+'pt'; }catch(_f){}
  }
  if(typeof applyBindings==='function') applyBindings();
  try{ if(typeof applyMoneyFormatting==='function') applyMoneyFormatting(); }catch(_m){}
  window._editedRestoring=false;
  // 呼び戻した内容を「前回保存」として覚え、そのままDB保存しても行を増やさない
  try{
    var html=(typeof getBindResetHtml==='function')?getBindResetHtml():area.innerHTML;
    var fs=(typeof _fontSize!=='undefined')?_fontSize:null;
    var sig=html.length+':'+fs+':'+html.slice(0,200)+html.slice(-200);
    var h=0; for(var i=0;i<html.length;i++){ h=((h<<5)-h+html.charCodeAt(i))|0; } sig+=':'+h;
    window._htmlStoreLast[cid+'|'+idx+'|'+doc]=sig;
  }catch(_s){}
  if(typeof showToast==='function'){
    var w=new Date(at).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
    var other=(r.case_id && info.caseId && r.case_id!==info.caseId) ? '（同じ雇用条件の別の案件で編集）' : '';
    showToast('📝 雇用条件「'+(st.setName||'')+'」の編集版を呼び戻しました ('+w+')'+other);
  }
  return true;
}
// 書類独自の保存（1-6号の saveForm 等）・破棄にも受け皿の保存／破棄を付ける
window.addEventListener('load', function(){
  // ver.20261027.01: 直接編集を終えた書類（フリーズ中）でサイドバーを変えると、p() が書類を作り直して
  //   直接編集した文字・余白がすべて消えていた。フリーズ中は変数欄の差し替え(applyBindings)だけにする。
  //   （作り直したいときは「♻️ 編集版破棄」。data-bind の無い古い形式は従来どおり作り直す）
  try{
    if(typeof window.p==='function' && !window.p.__frozenGuard){
      var _origP=window.p;
      var gp=function(){
        try{
          var _em=(typeof _editMode!=='undefined') && _editMode;
          if(window._htmlFrozen && !_em && !window._editedRestoring && !window._tplSigRendering && typeof applyBindings==='function'){
            var nb=applyBindings();
            if(nb){ try{ _structCheckSoon(); }catch(_sc){} return; }
          }
        }catch(_e){}
        var r=_origP.apply(this, arguments);
        try{ if(!window._htmlFrozen && !window._tplSigRendering) _structNoticeHide(); }catch(_sh){}
        return r;
      };
      gp.__frozenGuard=true; window.p=gp; window._origPRender=_origP;
    }
  }catch(_pg){ console.warn('[p frozen guard]', _pg); }
  try{
    if(typeof window.saveForm==='function' && !window.saveForm.__htmlStoreWrapped){
      var _origSave=window.saveForm;
      var w=async function(){
        // ver.20261027.01: 変数欄の中に打った文字を、入力欄の値を集める前に整える／利用ログ（1-6号のDB保存）
        try{ if(!window._autosaving) _reconcileBindEdits(); }catch(_rc){}
        try{ if(!window._autosaving) slog('save', {doc_key:String(window._empDocKey||'1_6')}); }catch(_sl){}
        var r=await _origSave.apply(this, arguments);
        try{ await _htmlStoreSave({}); }catch(_e){ console.warn('[htmlStore save]', _e); } return r; };
      w.__htmlStoreWrapped=true; window.saveForm=w;
    }
    if(typeof window.discardEditedFromDB==='function' && !window.discardEditedFromDB.__htmlStoreWrapped){
      var _origDis=window.discardEditedFromDB;
      var d=async function(){ var before=window._htmlFrozen; var r=await _origDis.apply(this, arguments);
        try{ if(before && !window._htmlFrozen) await _htmlStoreDiscard({}); }catch(_e){} return r; };
      d.__htmlStoreWrapped=true; window.discardEditedFromDB=d;
    }
  }catch(_e){ console.warn('[htmlStore wrap]', _e); }
});
/* ===== /編集HTMLの受け皿 ===== */

/* ===== 直接編集の使い方ボタン（ver.20261027.02） =====
   「✏️ 直接編集」ボタンの横に「❓ 使い方」を出し、正しい手順・やっていいこと／いけないことを表示する。 */
(function(){
  var HTML =
   '<div style="font-size:16px;font-weight:bold;color:#1e293b;margin-bottom:4px;">✏️ 直接編集の使い方</div>'+
   '<div style="font-size:12px;color:#64748b;margin-bottom:14px;">この順番なら、直接編集した文字・余白は消えません。</div>'+
   '<div style="font-size:13px;font-weight:bold;color:#7c3aed;margin-bottom:6px;">正しい手順</div>'+
   '<ol class="_hw-steps">'+
     '<li><b>① サイドバーで値を入れる</b><br>時刻・金額・名前など。終わったら「💾 DB保存」。</li>'+
     '<li><b>② 「✏️ 直接編集」で書類の上を直す</b><br>注記や言い回しは、<u>灰色の欄（es.xxx）や値の外</u>に書く。</li>'+
     '<li><b>③ 「✅ 完了して保存」で終える</b><br>直接編集と雇用条件がまとめて保存される。</li>'+
     '<li><b>④ 次に開くと自動で呼び戻される</b><br>同じ案件・同じ雇用条件の別の申請人でも「📝 …呼び戻しました」と出る。</li>'+
   '</ol>'+
   '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">'+
     '<div class="_hw-box" style="border-color:#16a34a;background:#f0fdf4;">'+
       '<div style="font-weight:bold;color:#15803d;margin-bottom:6px;">⭕ やっていいこと</div>'+
       '<ul>'+
         '<li>完了後に、時刻・金額・名前などの<b>値</b>をサイドバーで直す（値だけ入れ替わり、編集は残る）</li>'+
         '<li>灰色の欄の中にうっかり書いた → 保存時に自動で整える（書き足しは欄の外へ／値の書き換えはサイドバーへ反映）</li>'+
         '<li>余白・枠線・文字サイズの調整（一緒に保存される）</li>'+
       '</ul>'+
     '</div>'+
     '<div class="_hw-box" style="border-color:#dc2626;background:#fef2f2;">'+
       '<div style="font-weight:bold;color:#b91c1c;margin-bottom:6px;">❌ やってはいけないこと</div>'+
       '<ul>'+
         '<li>保存せずに<b>別の案件へ切り替える・画面を閉じる</b>（消える）</li>'+
         '<li>完了後に<b>チェック欄・シフト行など書類の形が変わる変更</b>（編集した書類には出ない。書類の上に<b>黄色いお知らせ</b>が出る）<br>→ お知らせの「♻️ 編集版を破棄して作り直す」→ もう一度直接編集</li>'+
         '<li>「♻️ 編集版破棄」をむやみに押す（直接編集がすべて元に戻る）</li>'+
         '<li>言語版は別々：ネパール語版で直しても、日本語版・他の言語版には反映されない</li>'+
       '</ul>'+
     '</div>'+
   '</div>'+
   '<div style="margin-top:14px;padding:10px 12px;background:#f1f5f9;border-radius:8px;font-size:12.5px;color:#334155;">迷ったら <b>サイドバー → 💾 DB保存 → ✏️ 直接編集 → ✅ 完了して保存</b></div>'+
   '<div style="text-align:right;margin-top:14px;"><button id="_hwClose" style="padding:7px 18px;font-size:13px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;cursor:pointer;">閉じる</button></div>';
  // ver.20261027.03: ポップアップではなく、ツールバーのすぐ下（書類の上）に開閉パネルとして出す
  window.showEditHowto=function(){
    try{
      var pnl=document.getElementById('_hwOver');
      var btn=document.getElementById('editHowtoBtn');
      if(pnl){ pnl.parentNode.removeChild(pnl); if(btn){ btn.style.background='#fff'; btn.style.color='#7c3aed'; } return; }
      if(!document.getElementById('_hwStyle')){
        var st=document.createElement('style'); st.id='_hwStyle';
        st.textContent='#_hwOver ._hw-steps{margin:0;padding:0;list-style:none;display:flex;gap:8px;flex-wrap:wrap;font-size:12.5px;line-height:1.55;color:#1e293b;}'+
          '#_hwOver ._hw-steps li{flex:1 1 170px;background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:6px;padding:7px 10px;}'+
          '#_hwOver ._hw-box{flex:1 1 250px;border:1px solid;border-radius:8px;padding:9px 12px;font-size:12px;line-height:1.55;color:#1e293b;}'+
          '#_hwOver ._hw-box ul{margin:0;padding-left:18px;} #_hwOver ._hw-box li{margin-bottom:3px;}'+
          '@media print{#_hwOver{display:none!important;}}';
        document.head.appendChild(st);
      }
      var w=document.createElement('div'); w.id='_hwOver';
      w.style.cssText='background:#fff;border:2px solid #7c3aed;border-radius:10px;margin:8px 12px;padding:14px 18px;font-family:sans-serif;box-sizing:border-box;';
      w.innerHTML=HTML.replace('>閉じる</button>','>▲ 閉じる</button>');
      var area=document.getElementById('pageArea');
      if(area && area.parentNode) area.parentNode.insertBefore(w, area);
      else document.body.insertBefore(w, document.body.firstChild);
      if(btn){ btn.style.background='#7c3aed'; btn.style.color='#fff'; }
      w.querySelector('#_hwClose').onclick=function(){ window.showEditHowto(); };
      try{ w.scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){}
    }catch(e){ console.warn('[showEditHowto]', e); }
  };
  function addBtn(){
    try{
      var eb=document.getElementById('editModeBtn');
      if(!eb || document.getElementById('editHowtoBtn')) return;
      var b=document.createElement('button');
      b.id='editHowtoBtn'; b.type='button';
      b.className=eb.className||'';
      b.textContent='❓ 使い方';
      b.title='直接編集の正しい手順';
      b.style.cssText='margin-left:4px;background:#fff;color:#7c3aed;border:1px solid #7c3aed;';
      b.onclick=function(e){ e.preventDefault(); window.showEditHowto(); };
      eb.insertAdjacentElement('afterend', b);
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', addBtn); else addBtn();
  window.addEventListener('load', addBtn);
})();

/* ===== ver.20261106.07: 重要事項事前説明書（建設）「７．業務内容」の自動作成 =====
   雇用条件の業務区分（category / category2）から、
   ・従事させる業務区分 … 「土木・建築」（分野・号の括弧書きを外し、2つあれば「・」でつなぐ）
   ・具体的職種及び作業内容 … 国交省の業務区分の定型文（1号）を「、」でつなぐ
   を作り、各言語の訳も決まった文で入れる。2号は定型文が違うため作業内容は雇用条件のまま。 */
var JUUYOU_WORK_STD={
  '土木':{
    ja:'指導者の指示・監督を受けながら、土木施設の新設、改築、維持、修繕に係る作業等に従事',
    name:{en:'Civil Engineering',vi:'Xây dựng dân dụng',id:'Teknik Sipil',my:'အရပ်ဘက်အင်ဂျင်နီယာ',km:'វិស្វកម្មស៊ីវិល',ne:'सिभिल इन्जिनियरिङ',ko:'토목'},
    tr:{
      en:'Engaged in work related to the new construction, reconstruction, maintenance and repair of civil engineering facilities under the instruction and supervision of a supervisor',   // ver.20261113.01: 重要事項事前説明書の英語版
      vi:'Tham gia thực hiện các công việc liên quan đến xây dựng mới, cải tạo, duy trì và sửa chữa các công trình kỹ thuật dân dụng dưới sự chỉ đạo và giám sát của người hướng dẫn',
      id:'Melaksanakan pekerjaan yang berkaitan dengan pembangunan baru, rekonstruksi, pemeliharaan, dan perbaikan fasilitas teknik sipil di bawah arahan dan pengawasan pembimbing',
      my:'ကြီးကြပ်ရေးမှူးတစ်ဦး၏ လမ်းညွှန်မှုနှင့် ကြီးကြပ်မှုအောက်တွင် အရပ်ဘက်အင်ဂျင်နီယာ အဆောက်အအုံများ အသစ်တည်ဆောက်ခြင်း၊ ပြန်လည်ပြုပြင်ခြင်း၊ ထိန်းသိမ်းခြင်းနှင့် ပြုပြင်ခြင်းနှင့် ဆက်စပ်သော အလုပ်များတွင် ပါဝင်လုပ်ဆောင်သည်',
      km:'ចូលរួមក្នុងការងារពាក់ព័ន្ធនឹងការសាងសង់ថ្មី ការកែលម្អ ការថែទាំ និងការជួសជុលសំណង់វិស្វកម្មស៊ីវិល ក្រោមការណែនាំ និងការត្រួតពិនិត្យរបស់អ្នកណែនាំ',
      ne:'पर्यवेक्षकको निर्देशन र पर्यवेक्षणमा, सिभिल इन्जिनियरिङ संरचनाहरूको नयाँ निर्माण, पुनर्निर्माण, संरक्षण र मर्मतसँग सम्बन्धित काममा संलग्न हुने',
      ko:'지도자의 지시·감독을 받으면서, 토목 시설의 신설, 개축, 유지, 수선에 관련된 작업 등에 종사'}
  },
  '建築':{
    ja:'指導者の指示・監督を受けながら、建築物の新築、増築、改築若しくは移転又は修繕若しくは模様替に係る作業等に従事',
    name:{en:'Building Construction',vi:'Kiến trúc',id:'Arsitektur',my:'အဆောက်အအုံဆောက်လုပ်ရေး',km:'សំណង់អគារ',ne:'भवन निर्माण',ko:'건축'},
    tr:{
      en:'Engaged in work related to the new construction, extension, reconstruction, relocation, repair or remodeling of buildings under the instruction and supervision of a supervisor',   // ver.20261113.01: 重要事項事前説明書の英語版
      vi:'Tham gia thực hiện các công việc liên quan đến xây dựng mới, mở rộng, cải tạo, di dời, sửa chữa hoặc thay đổi diện mạo các công trình kiến trúc dưới sự chỉ đạo và giám sát của người hướng dẫn',
      id:'Melaksanakan pekerjaan yang berkaitan dengan pembangunan baru, perluasan, renovasi, pemindahan, perbaikan, atau perubahan tampilan bangunan di bawah arahan dan pengawasan pembimbing',
      my:'ကြီးကြပ်ရေးမှူးတစ်ဦး၏ လမ်းညွှန်မှုနှင့် ကြီးကြပ်မှုအောက်တွင် အဆောက်အအုံများ အသစ်ဆောက်လုပ်ခြင်း၊ တိုးချဲ့ခြင်း၊ ပြန်လည်ပြုပြင်ခြင်း၊ ရွှေ့ပြောင်းခြင်း၊ ပြုပြင်ခြင်း သို့မဟုတ် ပုံစံပြောင်းလဲခြင်းနှင့် ဆက်စပ်သော အလုပ်များတွင် ပါဝင်လုပ်ဆောင်သည်',
      km:'ចូលរួមក្នុងការងារពាក់ព័ន្ធនឹងការសាងសង់ថ្មី ការពង្រីក ការកែលម្អ ការផ្លាស់ទីតាំង ការជួសជុល ឬការកែប្រែរូបរាងអគារ ក្រោមការណែនាំ និងការត្រួតពិនិត្យរបស់អ្នកណែនាំ',
      ne:'पर्यवेक्षकको निर्देशन र पर्यवेक्षणमा, भवनहरूको नयाँ निर्माण, विस्तार, पुनर्निर्माण, स्थानान्तरण, मर्मत वा स्वरूप परिवर्तनसँग सम्बन्धित काममा संलग्न हुने',
      ko:'지도자의 지시·감독을 받으면서, 건축물의 신축, 증축, 개축 혹은 이전 또는 수선 혹은 모양 변경에 관련된 작업 등에 종사'}
  },
  'ライフライン・設備':{
    ja:'指導者の指示・監督を受けながら、電気通信、ガス、水道、電気その他のライフライン・設備の整備・設置、変更又は修理に係る作業等に従事',
    name:{en:'Lifelines and Facilities',vi:'Cơ sở hạ tầng và thiết bị',id:'Infrastruktur dan Fasilitas',my:'အခြေခံအဆောက်အအုံနှင့် စက်ပစ္စည်း',km:'ហេដ្ឋារចនាសម្ព័ន្ធ និងបរិក្ខារ',ne:'पूर्वाधार तथा उपकरण',ko:'라이프라인·설비'},
    tr:{
      en:'Engaged in work related to the maintenance, installation, modification or repair of telecommunications, gas, water supply, electricity and other lifelines and facilities under the instruction and supervision of a supervisor',   // ver.20261113.01: 重要事項事前説明書の英語版
      vi:'Tham gia thực hiện các công việc liên quan đến bảo trì, lắp đặt, thay đổi hoặc sửa chữa viễn thông, khí đốt, cấp nước, điện và các cơ sở hạ tầng, thiết bị khác dưới sự chỉ đạo và giám sát của người hướng dẫn',
      id:'Melaksanakan pekerjaan yang berkaitan dengan pemeliharaan, pemasangan, perubahan, atau perbaikan telekomunikasi, gas, air, listrik, serta infrastruktur dan fasilitas lainnya di bawah arahan dan pengawasan pembimbing',
      my:'ကြီးကြပ်ရေးမှူးတစ်ဦး၏ လမ်းညွှန်မှုနှင့် ကြီးကြပ်မှုအောက်တွင် ဆက်သွယ်ရေး၊ ဓာတ်ငွေ့၊ ရေပေးဝေရေး၊ လျှပ်စစ်နှင့် အခြားအခြေခံအဆောက်အအုံနှင့် စက်ပစ္စည်းများကို ပြုပြင်ထိန်းသိမ်းခြင်း၊ တပ်ဆင်ခြင်း၊ ပြောင်းလဲခြင်း သို့မဟုတ် ပြင်ဆင်ခြင်းနှင့် ဆက်စပ်သော အလုပ်များတွင် ပါဝင်လုပ်ဆောင်သည်',
      km:'ចូលរួមក្នុងការងារពាក់ព័ន្ធនឹងការថែទាំ ការដំឡើង ការផ្លាស់ប្តូរ ឬការជួសជុលទូរគមនាគមន៍ ឧស្ម័ន ទឹក អគ្គិសនី និងហេដ្ឋារចនាសម្ព័ន្ធ និងបរិក្ខារផ្សេងទៀត ក្រោមការណែនាំ និងការត្រួតពិនិត្យរបស់អ្នកណែនាំ',
      ne:'पर्यवेक्षकको निर्देशन र पर्यवेक्षणमा, दूरसञ्चार, ग्यास, खानेपानी, बिजुली तथा अन्य पूर्वाधार र उपकरणहरूको मर्मत, जडान, परिवर्तन वा सुधारसँग सम्बन्धित काममा संलग्न हुने',
      ko:'지도자의 지시·감독을 받으면서, 통신, 가스, 수도, 전기 그 외의 라이프 라인·설비의 정비·설치, 변경 또는 수리에 관련된 작업 등에 종사'}
  }
};
function _juuyouCatKey(x){
  var t=String(x||'').normalize('NFKC').replace(/[（(][^）)]*[）)]/g,'').replace(/[\s　]/g,'');
  if(!t) return '';
  if(/ライフライン|設備/.test(t)) return 'ライフライン・設備';
  if(/^土木/.test(t)) return '土木';
  if(/^建築/.test(t)) return '建築';
  return '';
}
// 戻り値 {type,typeEn,detail,detailEn,keys} … 判定できない項目は空文字
function juuyouWorkAuto(es, lang, is2go){
  es=es||{};
  var keys=[]; [es.category, es.category2].forEach(function(c){ var k=_juuyouCatKey(c); if(k && keys.indexOf(k)<0) keys.push(k); });
  var out={type:'',typeEn:'',detail:'',detailEn:'',keys:keys};
  if(!keys.length) return out;
  out.type=keys.join('・');
  var nm=keys.map(function(k){ return (JUUYOU_WORK_STD[k].name||{})[lang]||''; });
  if(nm.every(Boolean)) out.typeEn=nm.join(lang==='ko'||lang==='km'?'・':' / ');
  if(!is2go){
    out.detail=keys.map(function(k){ return JUUYOU_WORK_STD[k].ja; }).join('、');
    var tr=keys.map(function(k){ return (JUUYOU_WORK_STD[k].tr||{})[lang]||''; });
    if(tr.every(Boolean)) out.detailEn=tr.join(lang==='ko'?', ':'; ');
  }
  return out;
}
window.juuyouWorkAuto=juuyouWorkAuto;

// ver.20261106.09: 国土交通省「建設業者検索」で会社の建設業許可（業種・許可番号・有効期間）を調べる。
//   Supabase の mlit-kensetsu-lookup（読み取りのみ・DBには書き込まない）を呼ぶ。見つかった結果は7日、見つからない結果は1日この端末に覚えておく。
//   戻り値: 見つかったとき {status:'found', lic, permit_types:[...], kinds:[{name,kubun}], expiry, expired, ...}、それ以外は null
async function mlitPermitLookup(co){
  try{
    if(!co || !co.name) return null;
    var ck='ofusa_mlit:'+co.name+'|'+(co.pref||'')+(co.city||'');
    try{ var c=JSON.parse(localStorage.getItem(ck)||'null'); if(c && c.until>Date.now()) return c.r && c.r.status==='found' ? c.r : null; }catch(_c){}
    var tok=_sbToken(); if(!_sbUserTokOk(tok)) return null;
    var ac=(typeof AbortController!=='undefined')?new AbortController():null; var tm=ac?setTimeout(function(){ac.abort();},30000):null;
    var res=await fetch(SB_URL+'/functions/v1/mlit-kensetsu-lookup',{method:'POST',signal:ac?ac.signal:undefined,
      headers:{'apikey':SB_KEY,'Authorization':'Bearer '+tok,'Content-Type':'application/json'},
      body:JSON.stringify({name:co.name,pref:co.pref||'',city:co.city||'',address:co.address||''})});
    if(tm) clearTimeout(tm);
    if(!res.ok) return null;
    var j=await res.json();
    if(j && /^(found|notfound|multiple|mismatch)$/.test(j.status||'')){
      try{ localStorage.setItem(ck, JSON.stringify({until:Date.now()+(j.status==='found'?7:1)*86400000, r:j.status==='found'?j:{status:j.status}})); }catch(_s){}
    }
    return j && j.status==='found' ? j : null;
  }catch(e){ console.warn('[mlitPermitLookup]',e); return null; }
}
window.mlitPermitLookup=mlitPermitLookup;
// ver.20261106.10: 土木一式・建築一式（土木工事業・建築工事業）は特定技能の外国人を従事させる工事業にならないため、
//   重要事項事前説明書の「工事業の種類」には出さず、国交省から案シスに入れるときも入れない。
var KOUJI_EXCLUDE=['土木工事業','建築工事業','土木一式工事業','建築一式工事業','土木一式工事','建築一式工事','土木','建築'];
function koujiFilter(list){
  var ex={}; KOUJI_EXCLUDE.forEach(function(x){ ex[x]=1; });
  return (list||[]).map(function(x){ return String(x||'').trim(); }).filter(function(x){ return x && !ex[x.normalize('NFKC').replace(/[\s　]/g,'')]; });
}
window.koujiFilter=koujiFilter;
// ver.20261106.13: 特定技能 業務区分－建設業許可 対応表（国交省 2025/1/31 版 https://www.mlit.go.jp/tochi_fudousan_kensetsugyo/content/001499406.pdf）
//   業務区分ごとに従事できる工事業。重要事項事前説明書の「工事業の種類」は、この表で業務区分に合うものだけを出す。
var KOUJI_TAIOU={
  '土木':['さく井','舗装','しゅんせつ','造園','大工','とび・土工','鋼構造物','鉄筋','塗装','防水','石','機械器具設置','板金','熱絶縁','管'],
  '建築':['大工','とび・土工','鋼構造物','鉄筋','塗装','防水','石','機械器具設置','内装仕上','建具','左官','タイル・れんが・ブロック','清掃施設','屋根','ガラス','解体','板金','熱絶縁','管'],
  'ライフライン・設備':['板金','熱絶縁','管','電気','電気通信','水道施設','消防施設']
};
function _koujiKey(x){
  var t=String(x||'').normalize('NFKC').replace(/[\s　]/g,'').replace(/工事業$|工事$/,'').replace(/･/g,'・');
  if(t==='とび土工') t='とび・土工'; if(/^タイル|^れんが|^ブロック/.test(t)) t='タイル・れんが・ブロック';
  if(t==='機械器具') t='機械器具設置'; if(t==='内装') t='内装仕上';
  return t;
}
// cats: 業務区分の値の配列（例 ['土木（建設分野・特定技能１号）','建築…']）。区分が判定できないときは絞らない。
function koujiAllowedFor(cats){
  var keys=(cats||[]).map(function(c){ return typeof _juuyouCatKey==='function'?_juuyouCatKey(c):''; }).filter(Boolean);
  if(!keys.length) return null;
  var ok={}; keys.forEach(function(k){ (KOUJI_TAIOU[k]||[]).forEach(function(x){ ok[x]=1; }); });
  return ok;
}
function koujiFilterByCategory(list, cats){
  var ok=koujiAllowedFor(cats); if(!ok) return (list||[]).slice();
  return (list||[]).filter(function(x){ return ok[_koujiKey(x)]; });
}
function koujiOutOfCategory(list, cats){
  var ok=koujiAllowedFor(cats); if(!ok) return [];
  return (list||[]).filter(function(x){ var k=_koujiKey(x); return k && !ok[k]; });
}
window.koujiFilterByCategory=koujiFilterByCategory; window.koujiOutOfCategory=koujiOutOfCategory;
// 国交省で見つかった許可情報を、案シスの会社情報に入れる（許可業種が空の会社の、空欄の項目だけ。入っている値は変えない）
async function mlitSaveToCompany(co, r){
  try{
    if(!co || !co.id || !r || r.status!=='found' || !(r.permit_types||[]).length) return false;
    if(String(co.permit_types||'').trim()) return false;
    var m=String(r.lic||'').match(/^(.+?)(?:知事)?許可\s*第0*(\d+)号/);
    var kb=(r.kinds||[]).map(function(k){return k.kubun;}); var allT=kb.length&&kb.every(function(x){return x==='特定';}), allG=kb.length&&kb.every(function(x){return x==='一般';});
    var _pt=koujiFilter(r.permit_types); if(!_pt.length) return false;
    var p={ permit_types:_pt.join(',') };
    if(m && !String(co.permit_pref_code||'').trim()) p.permit_pref_code=m[1];
    if(m && !String(co.permit_number||'').trim()) p.permit_number=m[2];
    if((allT||allG) && !String(co.permit_general_type||'').trim()) p.permit_general_type=allT?'特':'般';
    if(r.expiry && !co.construction_license_expiry) p.construction_license_expiry=r.expiry;
    await sb('companies?id=eq.'+encodeURIComponent(co.id)+'&or=(permit_types.is.null,permit_types.eq.)',{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify(p)});
    co.permit_types=p.permit_types;
    return true;
  }catch(e){ console.warn('[mlitSaveToCompany]',e); return false; }
}
window.mlitSaveToCompany=mlitSaveToCompany;
/* ===== ver.20261106.04: 印刷・PDFの前のページはみ出しチェック =====
   印刷用の見た目（@media print の指定）を画面外の枠で再現し、各ページ（.doc。中の強制改ページで区切った区間）の
   高さが用紙の印刷範囲を超えていないかを調べる。超えていれば何ページ目が何mmはみ出すかを返す。 */
function _pxFromCss(x){
  x=String(x||'').trim(); if(!x) return 0; var n=parseFloat(x); if(isNaN(n)) return 0;
  if(/mm$/.test(x)) return n*96/25.4; if(/cm$/.test(x)) return n*96/2.54; if(/in$/.test(x)) return n*96; if(/pt$/.test(x)) return n*96/72; return n;
}
function _printCssText(){
  var out='', pages={};
  var walk=function(rules, inPrint){
    for(var i=0;i<rules.length;i++){
      var r=rules[i];
      try{
        if(r.type===1){ out+=r.cssText+'\n'; }
        else if(r.type===4){
          var c=String(r.conditionText||(r.media&&r.media.mediaText)||'');
          if(/print/i.test(c) && !/not\s+print/i.test(c)) walk(r.cssRules, true);
          else if(/screen/i.test(c) && !/print/i.test(c)) { /* 画面だけの指定は使わない */ }
          else walk(r.cssRules, inPrint);
        }
        else if(r.type===6){
          var st=r.style, name=String(r.selectorText||'').replace(/^@page\s*/,'').trim()||'_';
          var t=_pxFromCss(st.getPropertyValue('margin-top')), b=_pxFromCss(st.getPropertyValue('margin-bottom'));
          var sz=st.getPropertyValue('size')||'';
          pages[name]={t:t,b:b,land:/landscape/i.test(sz)};
        }
        else if(r.type===5){ out+=r.cssText+'\n'; }
        else if(r.cssRules){ walk(r.cssRules, inPrint); }
      }catch(e){}
    }
  };
  for(var k=0;k<document.styleSheets.length;k++){
    var ss=document.styleSheets[k], rules=null; try{ rules=ss.cssRules; }catch(e){ continue; }
    if(rules) walk(rules, false);
  }
  return {css:out, pages:pages};
}
function checkPrintOverflow(){
  var area=document.getElementById('pageArea'); if(!area) return [];
  var pc=_printCssText();
  var ifr=document.createElement('iframe');
  var _defLand=!!(pc.pages['_'] && pc.pages['_'].land);
  // 用紙の幅（A4 縦 210mm＝794px／横 297mm＝1123px）で並べないと、文字の折り返しが印刷と変わる
  ifr.style.cssText='position:fixed;left:-20000px;top:0;width:'+(_defLand?1123:794)+'px;height:1200px;border:0;visibility:hidden;';
  document.body.appendChild(ifr);
  var res=[], pageNo=0;
  try{
    var d=ifr.contentDocument;
    d.open(); d.write('<!doctype html><html><head><meta charset="utf-8"><style>'+pc.css.replace(/<\/style/gi,'<\\/style')+'</style><style>html,body{margin:0;padding:0;}</style></head><body><div id="pageArea">'+area.innerHTML+'</div></body></html>'); d.close();
    var docs=[].slice.call(d.querySelectorAll('#pageArea .doc'));
    var def=pc.pages['_']||{t:0,b:0,land:false};
    docs.forEach(function(doc){
      if(doc.querySelector('.doc')) return;            // 中に別のページを持つ外枠（1-17号など）は数えない
      try{ doc.style.zoom=''; }catch(_z){}
      var cs=ifr.contentWindow.getComputedStyle(doc);
      if(cs.display==='none') return;
      var pn=(cs.page && cs.page!=='auto') ? cs.page : '_';
      var P=pc.pages[pn]||def;
      var H=(P.land?793.7:1122.5)-P.t-P.b;
      var top=doc.getBoundingClientRect().top, bottom=doc.getBoundingClientRect().bottom;
      // 中の強制改ページで区切る
      var cuts=[top];
      [].slice.call(doc.querySelectorAll('*')).forEach(function(el){
        var c2=ifr.contentWindow.getComputedStyle(el);
        var bb=c2.breakBefore||c2.pageBreakBefore, ba=c2.breakAfter||c2.pageBreakAfter;
        var r=el.getBoundingClientRect();
        if(/page|always|left|right/.test(bb||'')) cuts.push(r.top);
        if(/page|always|left|right/.test(ba||'')) cuts.push(r.bottom);
      });
      cuts.push(bottom);
      cuts=cuts.filter(function(x){ return x>=top-1 && x<=bottom+1; }).sort(function(a,b){return a-b;});
      for(var i=0;i<cuts.length-1;i++){
        var h=cuts[i+1]-cuts[i]; if(h<2) continue;
        pageNo++;
        // 数行だけはみ出す場合だけ知らせる（ページの4分の1を超える長さは、もともと複数ページになる書類とみなす）
        if(h>H+0.5 && (h-H)<=H*0.25) res.push({page:pageNo, overMm:Math.round((h-H)*25.4/96), overPx:Math.round(h-H)});
      }
    });
  }catch(e){ console.warn('[printOverflow]', e); }
  finally{ try{ document.body.removeChild(ifr); }catch(_r){} }
  window._printSegCount=pageNo;
  return res;
}
window.checkPrintOverflow=checkPrintOverflow;
function _showOverflowDialog(ov, note){
  var old=document.getElementById('_ovDlg'); if(old && old.parentNode) old.parentNode.removeChild(old);
  var lines=ov.map(function(o){ return '・'+o.page+'ページ目が 約'+Math.max(1,o.overMm)+'mm（'+Math.max(1,Math.round(o.overPx/16))+'行ほど）はみ出しています'; }).join('<br>');
  var canShrink=(typeof changeFontSize==='function') && (typeof _fontSize!=='undefined') && _fontSize>5;
  var w=document.createElement('div'); w.id='_ovDlg';
  w.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:2147483000;display:flex;align-items:center;justify-content:center;font-family:sans-serif;';
  w.innerHTML='<div style="background:#fff;border-radius:12px;max-width:440px;width:92%;padding:18px 20px;box-shadow:0 10px 40px rgba(0,0,0,.3);font-size:13px;line-height:1.7;color:#1f2937;">'
    +'<div style="font-weight:bold;font-size:15px;margin-bottom:6px;">📄 印刷するとページからはみ出します</div>'
    +'<div style="margin-bottom:8px;">'+lines+'</div>'
    +'<div style="color:#64748b;font-size:12px;margin-bottom:12px;">このまま印刷すると、はみ出した分が次のページに送られ、ページ数が増えます。'+(note?('<br><b style="color:#b91c1c;">'+note+'</b>'):'')+'</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:8px;">'
    +(canShrink?'<button type="button" id="_ovShrink" style="padding:8px 12px;font-weight:bold;border:0;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer;">🔍 文字を小さくして収める</button>':'')
    +'<button type="button" id="_ovGo" style="padding:8px 12px;border:1px solid #94a3b8;border-radius:8px;background:#fff;color:#334155;cursor:pointer;">このまま印刷</button>'
    +'<button type="button" id="_ovBack" style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;color:#475569;cursor:pointer;">戻って直す</button>'
    +'</div></div>';
  document.body.appendChild(w);
  var close=function(){ if(w.parentNode) w.parentNode.removeChild(w); };
  w.querySelector('#_ovBack').onclick=close;
  w.querySelector('#_ovGo').onclick=function(){ close(); window._skipOverflowCheck=true; doPrint(); };
  var sb=w.querySelector('#_ovShrink');
  if(sb) sb.onclick=function(){
    var start=_fontSize, steps=0, left=ov;
    while(left.length && steps<6 && _fontSize>5){ changeFontSize(-0.5); steps++; left=checkPrintOverflow(); }
    close();
    if(!left.length){
      if(typeof showToast==='function') showToast('🔍 文字を '+start+'pt → '+_fontSize+'pt にして1ページに収めました');
      window._skipOverflowCheck=true; doPrint();
    }else{
      var tried=_fontSize;
      try{ if(_fontSize!==start) changeFontSize(start-_fontSize); }catch(_r){}   // 収まらなければ文字の大きさは元に戻す
      _showOverflowDialog(left, '文字を '+tried+'pt まで小さくしても収まらなかったため、文字の大きさは元（'+start+'pt）に戻しました。文章を短くするか、「このまま印刷」してください。');
    }
  };
}
/* ===== ver.20261106.04: 日付の読み方を共通化 =====
   令和／平成／昭和（R・H・S、元年）・西暦（2026年10月6日、2026/10/6、2026.10.6）・8桁（20261006）・全角数字を
   すべて「2026-10-06」に直す。読めないものはそのまま返す（「不明」など）。
   すでに「YYYY-MM-DD」で始まるものは一切変えない（時刻つきもそのまま）。 */
function ofusaToISO(x){
  if(x===null || x===undefined) return x;
  var raw=String(x); if(!raw.trim()) return raw;
  if(/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
  var t=raw.normalize('NFKC').replace(/\s+/g,'');
  var y=null,m=null,d=null,r;
  var ERA={'令和':2018,'R':2018,'r':2018,'平成':1988,'H':1988,'h':1988,'昭和':1925,'S':1925,'s':1925};
  if((r=t.match(/^(令和|平成|昭和|R|H|S)(元|\d{1,2})[年.\/-](\d{1,2})[月.\/-](\d{1,2})日?$/i))){
    y=ERA[r[1]]+(r[2]==='元'?1:+r[2]); m=+r[3]; d=+r[4];
  }else if((r=t.match(/^(\d{4})[年.\/-](\d{1,2})[月.\/-](\d{1,2})日?$/))){
    y=+r[1]; m=+r[2]; d=+r[3];
  }else if((r=t.match(/^(\d{4})(\d{2})(\d{2})$/))){
    y=+r[1]; m=+r[2]; d=+r[3];
  }
  if(y===null || m<1 || m>12 || d<1 || d>31) return raw;
  return y+'-'+('0'+m).slice(-2)+'-'+('0'+d).slice(-2);
}
window.ofusaToISO=ofusaToISO;
/* ===== ver.20261106.03: 古い編集版のお知らせ =====
   直接編集版（案件ごと／雇用条件ごと）を呼び戻したとき、「今の様式で作り直すと値が入る欄」のうち
   編集版に欄そのものが無いもの（例：業務区分が1つのときに保存した版の「業務区分２」）を探し、
   あれば書類の上に知らせる。値が入っていない欄・隠している欄は数えない。 */
function _staleFieldLabel(id){
  try{
    var el=document.getElementById(id);
    var fg=el && (el.closest('.fg')||el.parentNode);
    var lb=fg && fg.querySelector('label');
    var t=lb ? lb.cloneNode(true) : null;
    if(t){ t.querySelectorAll('.fid,button').forEach(function(x){x.remove();}); t=(t.textContent||'').replace(/\s+/g,' ').trim(); }
    return t || id.replace(/^(es|f)_/,'');
  }catch(_e){ return id; }
}
function _staleEditedCheck(){
  var area=document.getElementById('pageArea');
  if(!area || !window._htmlFrozen || typeof window._origPRender!=='function') return;
  var _pv=function(x){ return String(x==null?'':x).replace(/[\s　]/g,''); };
  var have={};
  area.querySelectorAll('[data-bind]').forEach(function(sp){ have[sp.getAttribute('data-bind')]=1; });
  if(!Object.keys(have).length) return; // data-bind の無い古い形式は対象外（別の仕組みで作り直す）
  var saved=area.innerHTML, sx=window.scrollX, sy=window.scrollY, at=area.scrollTop;
  var em=(typeof _editMode!=='undefined')?_editMode:false, fr=window._htmlFrozen;
  var missing=[], seen={};
  window._tplSigRendering=true;
  try{
    try{ _editMode=false; }catch(_e){}
    window._htmlFrozen=false;
    window._origPRender();
    area.querySelectorAll('[data-bind]').forEach(function(sp){
      var id=sp.getAttribute('data-bind'); if(!id || have[id] || seen[id]) return;
      if(sp.style && sp.style.display==='none') return;
      var val=(typeof v==='function') ? v(id) : '';
      var txt=_pv(sp.textContent);
      if(!_pv(val) || !txt || txt===_pv(id.replace(/_/,'.'))) return;
      seen[id]=1; missing.push(id);
    });
  }catch(e){ console.warn('[staleEdited render]', e); }
  finally{
    area.innerHTML=saved;
    try{ _editMode=em; }catch(_e){}
    window._htmlFrozen=fr;
    window._tplSigRendering=false;
    try{ window.scrollTo(sx,sy); area.scrollTop=at; }catch(_e){}
    try{ if(typeof applyBindings==='function') applyBindings(); }catch(_e){}
  }
  window._staleEditedMissing=missing;
  var old=document.getElementById('_staleNotice'); if(old && old.parentNode) old.parentNode.removeChild(old);
  if(!missing.length) return;
  // 「このまま」を選んだ同じ書類・同じ案件・同じ欄の組み合わせは、次から出さない（この端末だけ）
  var _ci=(window._lastCaseInfo&&window._lastCaseInfo.caseId)||'';
  var _kk='ofusa_staleKeep:'+((location.pathname.split('/').pop()||'').replace(/\.html.*$/,''))+':'+_ci+':'+missing.slice().sort().join(',');
  try{ if(localStorage.getItem(_kk)) return; }catch(_ls){}
  var labels=[]; missing.forEach(function(id){ var l=_staleFieldLabel(id); if(labels.indexOf(l)<0) labels.push(l); });
  var w=document.createElement('div'); w.id='_staleNotice';
  w.style.cssText='background:#fff7ed;border:2px solid #f97316;border-radius:10px;margin:8px 12px;padding:12px 16px;font-family:sans-serif;font-size:13px;line-height:1.6;color:#431407;box-sizing:border-box;';
  var esc2=function(x){ return String(x).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
  w.innerHTML=
    '<div style="font-weight:bold;font-size:14px;margin-bottom:4px;">⚠️ この直接編集版は古い形のため、書類に出ていない内容があります</div>'+
    '<div style="margin-bottom:6px;">今の様式で作り直すと入る次の欄が、保存した編集版にはありません：</div>'+
    '<div style="margin:0 0 10px 8px;font-weight:bold;">'+labels.slice(0,8).map(function(l){return '・'+esc2(l);}).join('<br>')+(labels.length>8?('<br>ほか '+(labels.length-8)+' 件'):'')+'</div>'+
    '<div style="margin-bottom:10px;">反映するには、編集版を破棄して作り直し、必要な直接編集をもう一度してください。</div>'+
    '<button type="button" id="_stRebuild" style="padding:7px 14px;font-size:13px;font-weight:bold;border:1px solid #b91c1c;background:#dc2626;color:#fff;border-radius:6px;cursor:pointer;margin-right:8px;">♻️ 編集版を破棄して作り直す</button>'+
    '<button type="button" id="_stKeep" style="padding:7px 14px;font-size:13px;border:1px solid #9a3412;background:#fff;color:#7c2d12;border-radius:6px;cursor:pointer;">このまま（編集版を使う）</button>';
  area.parentNode.insertBefore(w, area);
  w.querySelector('#_stRebuild').onclick=async function(){
    try{
      if(typeof window.discardEditedFromDB==='function') await window.discardEditedFromDB();
      else if(typeof discardEditedGeneric==='function') await discardEditedGeneric();
      else { window._htmlFrozen=false; if(typeof p==='function') p(); }
    }catch(e){ console.warn('[staleRebuild]', e); }
    if(!window._htmlFrozen && w.parentNode) w.parentNode.removeChild(w);
  };
  w.querySelector('#_stKeep').onclick=function(){ try{ localStorage.setItem(_kk, String(Date.now())); }catch(_ls){} if(w.parentNode) w.parentNode.removeChild(w); };
}
/* ===== 直接編集後の「書類の形が変わる変更」のお知らせ（ver.20261028.01） =====
   直接編集した書類（フリーズ中）は、サイドバーの値（灰色の欄）だけを差し替える。
   チェック欄・シフト行など、書類の形そのものが変わる変更は出ないので、
   サイドバー変更のたびに「元の様式で作り直したらどうなるか」を裏で作って比べ、違えば知らせる。 */
function _tplSig(){
  var area=document.getElementById('pageArea'); if(!area || typeof window._origPRender!=='function') return null;
  var saved=area.innerHTML, sx=window.scrollX, sy=window.scrollY, at=area.scrollTop;
  var em=(typeof _editMode!=='undefined')?_editMode:false, fr=window._htmlFrozen, sig=null;
  window._tplSigRendering=true;
  try{
    try{ _editMode=false; }catch(_e){}
    window._htmlFrozen=false;
    window._origPRender();
    var c=area.cloneNode(true);
    c.querySelectorAll('[data-bind]').forEach(function(sp){ sp.textContent=''; });
    c.querySelectorAll('.user-note').forEach(function(n){ n.remove(); });
    sig=(c.textContent||'').replace(/[\s\u200B\u00A0]+/g,'');
  }catch(e){ console.warn('[tplSig]', e); sig=null; }
  finally{
    area.innerHTML=saved;
    try{ _editMode=em; }catch(_e){}
    window._htmlFrozen=fr;
    window._tplSigRendering=false;
    try{ window.scrollTo(sx,sy); area.scrollTop=at; }catch(_e){}
    try{ if(typeof applyBindings==='function') applyBindings(); }catch(_e){}
  }
  return sig;
}
function _structSetBase(){ window._tplSigBase=_tplSig(); window._tplStructChanged=false; }
var _structTimer=null;
function _structCheckSoon(){
  if(_structTimer) clearTimeout(_structTimer);
  _structTimer=setTimeout(function(){
    _structTimer=null;
    try{
      if(!window._htmlFrozen || ((typeof _editMode!=='undefined') && _editMode)) return;
      var sig=_tplSig(); if(sig==null) return;
      if(window._tplSigBase==null){ window._tplSigBase=sig; return; }
      if(sig!==window._tplSigBase) _structNoticeShow(); else _structNoticeHide();
    }catch(e){ console.warn('[structCheck]', e); }
  }, 600);
}
function _structNoticeHide(){
  window._tplStructChanged=false;
  var n=document.getElementById('_structNotice'); if(n && n.parentNode) n.parentNode.removeChild(n);
}
function _structNoticeShow(){
  window._tplStructChanged=true;
  if(document.getElementById('_structNotice')) return;
  var area=document.getElementById('pageArea'); if(!area || !area.parentNode) return;
  var w=document.createElement('div'); w.id='_structNotice';
  w.style.cssText='background:#fefce8;border:2px solid #eab308;border-radius:10px;margin:8px 12px;padding:12px 16px;font-family:sans-serif;font-size:13px;line-height:1.6;color:#422006;box-sizing:border-box;';
  w.innerHTML=
    '<div style="font-weight:bold;font-size:14px;margin-bottom:4px;">⚠️ サイドバーで変えた内容のうち、直接編集した書類に出ていないものがあります</div>'+
    '<div style="margin-bottom:10px;">チェック欄・シフト行など、<b>書類の形が変わる変更</b>は、直接編集した書類には反映されません（時刻・金額・名前などの値は反映済みです）。<br>'+
    '反映するには、編集版を破棄して作り直し、必要な直接編集をもう一度してください。</div>'+
    '<button type="button" id="_snRebuild" style="padding:7px 14px;font-size:13px;font-weight:bold;border:1px solid #b91c1c;background:#dc2626;color:#fff;border-radius:6px;cursor:pointer;margin-right:8px;">♻️ 編集版を破棄して作り直す</button>'+
    '<button type="button" id="_snKeep" style="padding:7px 14px;font-size:13px;border:1px solid #a16207;background:#fff;color:#713f12;border-radius:6px;cursor:pointer;">このまま（直接編集した書類を使う）</button>';
  area.parentNode.insertBefore(w, area);
  w.querySelector('#_snRebuild').onclick=async function(){
    try{
      if(typeof window.discardEditedFromDB==='function') await window.discardEditedFromDB();
      else if(typeof discardEditedGeneric==='function') await discardEditedGeneric();
      else { window._htmlFrozen=false; if(typeof p==='function') p(); }
    }catch(e){ console.warn('[structRebuild]', e); }
    if(!window._htmlFrozen){ _structNoticeHide(); window._tplSigBase=null; }
  };
  w.querySelector('#_snKeep').onclick=function(){ _structSetBase(); _structNoticeHide(); };
  try{ w.scrollIntoView({behavior:'smooth',block:'nearest'}); }catch(_e){}
}

// ===== 税・社保の自動計算エンジン（OFUSA_TAXCALC） ver.20261111.01 =====
//   ⚠️ 同じコードが 案シス(anken/index.html) と Saysay(docs/ofusa_common.js) の2か所にある。直すときは必ず両方。
//   料率は年度ごとに RATES だけ直す（毎年3〜4月）。
(function(root){
  if(root.OFUSA_TAXCALC) return;
  var RATES = {
    label: '令和8年度',
    // 協会けんぽ 健康保険料率（%・労使合計）令和8年3月分から
    kenpo: {'北海道':10.28,'青森県':9.85,'岩手県':9.51,'宮城県':10.10,'秋田県':10.01,'山形県':9.75,'福島県':9.50,'茨城県':9.52,'栃木県':9.82,'群馬県':9.68,'埼玉県':9.67,'千葉県':9.73,'東京都':9.85,'神奈川県':9.92,'新潟県':9.21,'富山県':9.59,'石川県':9.70,'福井県':9.71,'山梨県':9.55,'長野県':9.63,'岐阜県':9.80,'静岡県':9.61,'愛知県':9.93,'三重県':9.77,'滋賀県':9.88,'京都府':9.89,'大阪府':10.13,'兵庫県':10.12,'奈良県':9.91,'和歌山県':10.06,'鳥取県':9.86,'島根県':9.94,'岡山県':10.05,'広島県':9.78,'山口県':10.15,'徳島県':10.24,'香川県':10.02,'愛媛県':9.98,'高知県':10.05,'福岡県':10.11,'佐賀県':10.55,'長崎県':10.06,'熊本県':10.08,'大分県':10.08,'宮崎県':9.77,'鹿児島県':10.13,'沖縄県':9.44},
    kaigo: 1.62,   // 介護保険（%・労使合計／40〜64歳）
    kodomo: 0.23,  // 子ども・子育て支援金（%・労使合計）令和8年4月分から
    nenkin: 18.3,  // 厚生年金（%・労使合計）
    koyo: {ippan:5, norin:6, kensetsu:6}, // 雇用保険 本人負担（/1000）令和8年4月〜
    // 住民税：都道府県民税の均等割（超過課税込み）。市町村民税3,000円＋森林環境税1,000円は別に足す
    juminPrefKintou: {'北海道':1000,'青森県':1000,'岩手県':2000,'宮城県':2200,'秋田県':1800,'山形県':2000,'福島県':2000,'茨城県':2000,'栃木県':1700,'群馬県':1700,'埼玉県':1000,'千葉県':1000,'東京都':1000,'神奈川県':1300,'新潟県':1000,'富山県':1500,'石川県':1500,'福井県':1000,'山梨県':1500,'長野県':1500,'岐阜県':2000,'静岡県':1400,'愛知県':1500,'三重県':2000,'滋賀県':1800,'京都府':1600,'大阪府':1300,'兵庫県':1800,'奈良県':1500,'和歌山県':1500,'鳥取県':1500,'島根県':1500,'岡山県':1500,'広島県':1500,'山口県':1500,'徳島県':1000,'香川県':1000,'愛媛県':1700,'高知県':1500,'福岡県':1500,'佐賀県':1500,'長崎県':1500,'熊本県':1500,'大分県':1500,'宮崎県':1500,'鹿児島県':1500,'沖縄県':1000},
    juminPrefRateAdj: {'神奈川県':0.00025},   // 県民税の所得割 上乗せ
    juminCity: [  // 市町村の独自税率（ここにない市町村は 市民税均等割3,000円・所得割は標準）
      {name:'横浜市', pref:'神奈川県', kintou:3900},
      {name:'名古屋市', pref:'愛知県', kintou:2800, rateAdj:-0.003},
      {name:'神戸市', pref:'兵庫県', kintou:3400},
      {name:'豊岡市', pref:'兵庫県', rateAdj:0.001}
    ],
    juminCityKintou: 3000, shinrin: 1000, juminRate: 0.10,
    juminKiso: 430000, choseiKojo: 2500, kyuyoMin: 740000,
    hikazeiShotoku: 380000, hikazeiShotokuWari: 450000
  };
  // 健康保険 標準報酬月額（50等級）：[報酬月額がこの額未満, 標準報酬月額]
  var HYOJUN = [[63000,58000],[73000,68000],[83000,78000],[93000,88000],[101000,98000],[107000,104000],[114000,110000],[122000,118000],[130000,126000],[138000,134000],[146000,142000],[155000,150000],[165000,160000],[175000,170000],[185000,180000],[195000,190000],[210000,200000],[230000,220000],[250000,240000],[270000,260000],[290000,280000],[310000,300000],[330000,320000],[350000,340000],[370000,360000],[395000,380000],[425000,410000],[455000,440000],[485000,470000],[515000,500000],[545000,530000],[575000,560000],[605000,590000],[635000,620000],[665000,650000],[695000,680000],[730000,710000],[770000,750000],[810000,790000],[855000,830000],[905000,880000],[955000,930000],[1005000,980000],[1055000,1030000],[1115000,1090000],[1175000,1150000],[1235000,1210000],[1295000,1270000],[1355000,1330000],[Infinity,1390000]];
  var PREFS = Object.keys(RATES.kenpo);

  function num(v){
    if(v==null) return 0;
    v=String(v).replace(/[０-９．－]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0xFEE0);}).replace(/[^0-9.\-]/g,'');
    var n=parseFloat(v); return isFinite(n)?n:0;
  }
  function hyojun(pay){ for(var i=0;i<HYOJUN.length;i++){ if(pay<HYOJUN[i][0]) return HYOJUN[i][1]; } return 1390000; }
  function hyojunNenkin(pay){ return Math.min(Math.max(hyojun(pay),88000),650000); }
  function half(x){ var f=Math.floor(x); return (x-f>0.5)?f+1:f; } // 本人負担：50銭以下切捨て・50銭超切上げ

  // 住所 → {pref, city}（都道府県が無い住所は pref='' ）
  function parseAddr(s){
    s=String(s||'').replace(/^[\s　]*〒?[\s　]*\d{3}[-－ー]?\d{4}[\s　]*/,'').replace(/^[\s　]+/,'');
    var pref='';
    for(var i=0;i<PREFS.length;i++){ if(s.indexOf(PREFS[i])===0){ pref=PREFS[i]; break; } }
    if(!pref){ for(var j=0;j<PREFS.length;j++){ var b=PREFS[j].replace(/[都道府県]$/,''); if(b.length>=2 && s.indexOf(b)===0){ pref=PREFS[j]; break; } } }
    var city=null;
    for(var k=0;k<RATES.juminCity.length;k++){
      var c=RATES.juminCity[k];
      if(s.indexOf(c.name)>=0 && (!pref || pref===c.pref)){ city=c; if(!pref) pref=c.pref; break; }
    }
    return {pref:pref, city:city};
  }
  // 就業先住所 → だめなら本社住所
  function pickAddr(officeAddr, hqAddr){
    var a=parseAddr(officeAddr);
    if(a.pref) return {pref:a.pref, city:a.city, from:'就業先'};
    var b=parseAddr(hqAddr);
    if(b.pref) return {pref:b.pref, city:b.city, from:'本社'};
    return {pref:'', city:null, from:''};
  }
  function koyoKind(field){
    field=String(field||'');
    if(field.indexOf('建設')>=0) return 'kensetsu';
    if(/農業|漁業|林業/.test(field)) return 'norin';
    return 'ippan';
  }
  // 源泉所得税（令和8年分 月額表甲欄・電子計算機特例・扶養0人）
  function incomeTax(A){
    if(!(A>0)) return 0;
    var k;
    if(A<=158333) k=54167;
    else if(A<=299999) k=Math.ceil(A*0.30+6667);
    else if(A<=549999) k=Math.ceil(A*0.20+36667);
    else if(A<=708330) k=Math.ceil(A*0.10+91667);
    else k=162500;
    var kiso = A<=2120833?48334 : A<=2162499?40000 : A<=2204166?26667 : A<=2245833?13334 : 0;
    var B=Math.floor(A-k-kiso); if(B<=0) return 0;
    var t;
    if(B<=162500) t=B*0.05105;
    else if(B<=275000) t=B*0.10210-8296;
    else if(B<=579166) t=B*0.20420-36374;
    else if(B<=750000) t=B*0.23483-54113;
    else if(B<=1500000) t=B*0.33693-130688;
    else if(B<=3333333) t=B*0.40840-237893;
    else t=B*0.45945-408061;
    return Math.max(0, Math.round(t/10)*10);
  }
  // 住民税（年額）：年収・年間の社保・都道府県・市町村
  function juminAnnual(annualPay, annualSocial, pref, city){
    var J=RATES;
    var kojo;
    if(annualPay<=3600000) kojo=annualPay*0.30+80000;
    else if(annualPay<=6600000) kojo=annualPay*0.20+440000;
    else if(annualPay<=8500000) kojo=annualPay*0.10+1100000;
    else kojo=1950000;
    kojo=Math.max(kojo, J.kyuyoMin);
    var shotoku=Math.max(0, Math.floor(annualPay-kojo));
    if(shotoku<=J.hikazeiShotoku) return 0;
    var kintou=(J.juminPrefKintou[pref]||1000) + ((city&&city.kintou)||J.juminCityKintou) + J.shinrin;
    if(shotoku<=J.hikazeiShotokuWari) return kintou;
    var rate=J.juminRate + (J.juminPrefRateAdj[pref]||0) + ((city&&city.rateAdj)||0);
    var kazei=Math.floor(Math.max(0, shotoku-annualSocial-J.juminKiso)/1000)*1000;
    var wari=Math.max(0, kazei*rate - Math.min(J.choseiKojo, kazei*0.05));
    wari=Math.floor(wari/100)*100;
    return wari + kintou;
  }
  // 雇用条件セット(es) から月の総支給・通勤手当を出す
  function grossOf(es){
    es=es||{};
    var base=num(es.salaryMonthly)||num(es.calcMonthly);
    var g=base, commute=0;
    for(var i=1;i<=6;i++){
      var nm=String(es['allowance'+i+'Name']||'');
      var amt=num(es['allowance'+i+'Amount']!=null&&es['allowance'+i+'Amount']!==''?es['allowance'+i+'Amount']:es['allowance'+i+'Amt']);
      if(!amt) continue;
      g+=amt; if(nm.indexOf('通勤')>=0) commute+=amt;
    }
    g+=num(es.fixedOTAmount||es.fixedOTAmt);
    return {gross:g, commute:commute, base:base};
  }
  // 健康保険・厚生年金・雇用保険の加入状況
  function insFlags(es){
    es=es||{};
    var k=String(es.insKenpo||''), ko=String(es.insKenpoOther||'');
    return {
      noKenpo: k==='未加入',
      kumiai: /組合/.test(k) || (k==='その他' && /組合/.test(ko)),
      noNenkin: String(es.insPension||'')==='未加入',
      noKoyo: String(es.insEmp||'')==='未加入'
    };
  }
  // 本体
  //  opt = {gross, commute, officeAddr, hqAddr, field, kaigo, noKenpo, kumiai, noNenkin, noKoyo}
  function calc(opt){
    var R=RATES;
    var gross=Math.max(0, num(opt.gross));
    var commute=Math.min(Math.max(0,num(opt.commute)), 150000, gross);
    var ad=pickAddr(opt.officeAddr, opt.hqAddr);
    var r={ok:false, pref:ad.pref, city:ad.city?ad.city.name:'', addrFrom:ad.from, gross:gross, commute:commute,
           hyojun:0, kenpo:0, nenkin:0, koyo:0, social:null, incomeTax:0, jumin:0, tax:null, employment:null, notes:[]};
    if(!gross) return r;
    var hyo=hyojun(gross); r.hyojun=hyo;
    var kenpoKnown=true;
    if(opt.noKenpo){ r.kenpo=0; }
    else if(!ad.pref){ kenpoKnown=false; r.notes.push('就業先・本社の住所から都道府県が分からないため、社会保険料・住民税を計算できません'); }
    else {
      r.kenpo=half(hyo*(R.kenpo[ad.pref]+(opt.kaigo?R.kaigo:0))/100/2) + half(hyo*R.kodomo/100/2);
      if(opt.kumiai){ r.notes.push('健保組合のため、社会保険料は手入力してください（税金は協会けんぽの料率で概算）'); }
    }
    r.nenkin = opt.noNenkin ? 0 : half(hyojunNenkin(gross)*R.nenkin/100/2);
    r.koyo = opt.noKoyo ? 0 : half(gross*R.koyo[koyoKind(opt.field)]/1000);
    r.employment = r.koyo;
    if(kenpoKnown && !opt.kumiai) r.social = r.kenpo + r.nenkin;
    var A=gross-commute-r.kenpo-r.nenkin-r.koyo;
    r.incomeTax=incomeTax(A);
    if(ad.pref){
      r.jumin=Math.floor(juminAnnual((gross-commute)*12, (r.kenpo+r.nenkin+r.koyo)*12, ad.pref, ad.city)/12);
      r.tax=r.incomeTax+r.jumin;
    }
    r.ok=true;
    return r;
  }
  // 年齢（今日時点）
  function age(birth){
    var m=String(birth||'').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); if(!m) return null;
    var y=+m[1], mo=+m[2], d=+m[3]; var t=new Date();
    var a=t.getFullYear()-y; if((t.getMonth()+1)<mo || ((t.getMonth()+1)===mo && t.getDate()<d)) a--;
    return (a>=0&&a<120)?a:null;
  }
  function isKaigoAge(a){ return a!=null && a>=40 && a<65; }
  root.OFUSA_TAXCALC={RATES:RATES, calc:calc, grossOf:grossOf, insFlags:insFlags, parseAddr:parseAddr, pickAddr:pickAddr,
    incomeTax:incomeTax, juminAnnual:juminAnnual, hyojun:hyojun, koyoKind:koyoKind, age:age, isKaigoAge:isKaigoAge, num:num,
    KEYS:['deductTax','deductSocial','deductEmployment']};
})(typeof window!=='undefined'?window:globalThis);

/* ver.20261111.02: 1-6号（全言語）の 税金・社会保険料・雇用保険料 を自動計算（案シスと同じ OFUSA_TAXCALC）
   ・自動の欄 ＝ 空欄／前回自動で入れた値（es.deductAutoVals）のまま／今の計算結果と同じ。手で書き換えた欄は上書きしない（空にすると自動に戻る）
   ・給与・手当・固定残業代・就業先住所・本社住所・分野を手で変えると、その場で計算し直す
   ・読み込み直後に空欄の欄を埋める（このときは「編集した」扱いにしない）
   ・保存時に es.deductAutoVals を記録（案シスが同じ判定に使う）
   ・1_6_test.html（デザイン検証用）は対象外 */
(function(){
  if(typeof window==='undefined' || !window.OFUSA_TAXCALC) return;
  var path=String(location.pathname||'');
  if(!/(^|\/)1_6(_[a-z]{2})?\.html$/.test(path)) return;
  var T=window.OFUSA_TAXCALC;
  var MAP={deductTax:'es_deductTax', deductSocial:'es_deductSocialIns', deductEmployment:'es_deductEmpIns'};
  var KEYS=Object.keys(MAP);
  var SRC=/^es_(salaryMonthly|calcMonthly|a[1-6](Name|Amt)|fixedOTAmount|officeAddress|orgAddress|applicantField)$/;
  function el(id){ return document.getElementById(id); }
  function v(id){ var e=el(id); return e?String(e.value||''):''; }
  function loaded(){ var s=window._empLoadedSet; return (s && typeof s==='object') ? s : {}; }
  function formEs(){
    var L=loaded(), o={};
    o.salaryMonthly=v('es_salaryMonthly'); o.calcMonthly=v('es_calcMonthly'); o.fixedOTAmount=v('es_fixedOTAmount');
    for(var i=1;i<=6;i++){ o['allowance'+i+'Name']=v('es_a'+i+'Name'); o['allowance'+i+'Amount']=v('es_a'+i+'Amt'); }
    ['insKenpo','insKenpoOther','insPension','insEmp'].forEach(function(k){ var e=el('es_'+k); o[k]= e ? e.value : (L[k]||''); });
    return o;
  }
  var _kaigo=false;
  function compute(kaigo){
    var es=formEs(), g=T.grossOf(es), ins=T.insFlags(es);
    var r=T.calc({gross:g.gross, commute:g.commute, officeAddr:v('es_officeAddress'), hqAddr:v('es_orgAddress'),
      field:v('es_applicantField'), kaigo:(kaigo==null?_kaigo:kaigo), noKenpo:ins.noKenpo, kumiai:ins.kumiai, noNenkin:ins.noNenkin, noKoyo:ins.noKoyo});
    r.values={deductTax:r.tax, deductSocial:r.social, deductEmployment:r.employment};
    return r;
  }
  function setVal(e, s){
    if(e.value===s || same(e.value, s)) return false;
    e.value=s; e.dispatchEvent(new Event('input',{bubbles:true}));   // 合計・手取りの計算（ページ側）を動かす
    return true;
  }
  function recalc(){
    var r=compute(); if(!r.ok || !r.gross) return [];
    var changed=[];
    KEYS.forEach(function(k){
      var e=el(MAP[k]); if(!e) return;
      if(_none(k)){ e.dataset.taxAuto=''; return; }   // ver.20261113.02: 「不要（書類に記載しない）」は計算しない
      if(e.dataset.taxAuto!=='1') return;
      if(r.values[k]==null) return;
      if(setVal(e, String(r.values[k]))) changed.push(MAP[k]);
    });
    return changed;
  }
  window._p16TaxRecalc=function(){ try{ return recalc(); }catch(e){ return []; } };   // ver.20261111.07: 時給から換算月給を入れ直したときにも呼ぶ
  function _none(k){ var est=el(MAP[k]+'Est'); return !!(est && /不要/.test(est.value||'')); }
  function same(a,b){   // 金額として同じか（「14,126」と「14126」は同じ）
    a=(a==null?'':String(a)).trim(); b=(b==null?'':String(b)).trim();
    if(a===''||b==='') return false;
    return a===b || (/\d/.test(a) && /\d/.test(b) && T.num(a)===T.num(b));
  }
  // 読み込み直後
  function onLoaded(){
    var L=loaded(), av=(L.deductAutoVals && typeof L.deductAutoVals==='object') ? L.deductAutoVals : {};
    // 介護保険：案シスが入れた社会保険料が「介護あり」の計算と同じなら介護あり
    var withK=compute(true), soc=v('es_deductSocialIns');
    _kaigo = !!(withK.values.deductSocial!=null && same(soc, withK.values.deductSocial) && !same(soc, compute(false).values.deductSocial));
    var r=compute();
    KEYS.forEach(function(k){
      var e=el(MAP[k]); if(!e) return;
      var cur=String(e.value||'').trim();
      e.dataset.taxAuto = (cur==='' || same(cur, av[k]) || same(cur, r.values[k])) ? '1' : '';
      if(_none(k)) e.dataset.taxAuto='';
      if(!e._taxBound){
        e._taxBound=true;
        e.title='自動計算されます（手入力で上書き可・空にすると自動計算に戻ります）';
        e.addEventListener('input', function(ev){
          if(!ev.isTrusted) return;
          if(String(this.value).trim()===''){ this.dataset.taxAuto='1'; recalc(); } else { this.dataset.taxAuto=''; }
        });
      }
    });
    var changed=recalc();
    // 読み込み直後に埋めた分は「編集した」扱いにしない
    try{
      var snap=window._empBaseline;
      if(snap && changed.length){
        changed.concat(['es_deductTotal','es_netPay','es_salaryTotal']).forEach(function(id){ var e=el(id); if(e) snap[id]=e.value||''; });
      }
    }catch(e){}
  }
  function init(){
    if(!el('es_deductTax') || !el('es_deductSocialIns') || !el('es_deductEmpIns')) return;
    document.addEventListener('input', function(ev){
      if(!ev.isTrusted) return;
      var id=ev.target && ev.target.id;
      if(id && SRC.test(id)){ try{ recalc(); }catch(e){ console.warn('[taxcalc]', e); } }
    }, true);
    // 読み込み（_empLoadedSet が入れ替わる）を見張る
    var last=null;
    setInterval(function(){
      var s=window._empLoadedSet;
      if(s && s!==last){ last=s; setTimeout(function(){ try{ onLoaded(); }catch(e){ console.warn('[taxcalc] load', e); } }, 400); }
    }, 400);
  }
  // 保存：自動/手入力の状態を es.deductAutoVals に記録
  function wrapSave(){
    var orig=window.saveEmpSetWithMode;
    if(typeof orig!=='function' || orig._taxWrapped) return;
    var w=function(companyId, caseId, values, mode, curIdx, force){
      try{
        if(values && typeof values==='object'){
          var L=loaded(), av=Object.assign({}, (L.deductAutoVals && typeof L.deductAutoVals==='object') ? L.deductAutoVals : {});
          KEYS.forEach(function(k){
            var e=el(MAP[k]); if(!e) return;
            if(e.dataset.taxAuto==='1') av[k]=String(e.value||''); else delete av[k];
          });
          var n=el('es_netPay');
          if(n){ if(n.dataset.manual!=='1') av.netPay=String(n.value||''); else delete av.netPay; }
          values.deductAutoVals=av;
        }
      }catch(e){ console.warn('[taxcalc] save', e); }
      return orig.apply(this, arguments);
    };
    w._taxWrapped=true;
    window.saveEmpSetWithMode=w;
  }
  wrapSave();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ wrapSave(); init(); });
  else init();
})();

/* ===== ver.20261111.08: 金額の「合計・控除合計・手取り」を内訳から計算し、書類どうし・案シスと合わせる =====
   ・重要事項説明書（全言語）：支払概算額・控除合計・手取りを、書類の内訳から計算し直す（手で入れた欄はそのまま）。
   ・1-6号：開いて計算し終わった金額（換算月給・支払概算総額・税金・社会保険料・雇用保険料・控除合計・手取り）が
     案シスの雇用条件セットと違えば、案シスに自動で保存する（この金額だけ。ほかの欄は変えない）。 */
(function(){
  if(typeof window==='undefined') return;
  var path=String(location.pathname||'');
  function el(id){ return document.getElementById(id); }
  function num(x){ var t=String(x==null?'':x).normalize('NFKC').replace(/[,，\s円¥]/g,''); return /^-?\d+(\.\d+)?$/.test(t)?Number(t):null; }
  function fmt(n){ return n==null?'':Math.round(n).toLocaleString('ja-JP'); }

  // --- 重要事項説明書 ---
  if(/(^|\/)juuyou(_[a-z]+)?\.html$/.test(path)){
    var BASE=['f_salaryMonthly'], ALLOW=['f_allowance1Amount','f_allowance2Amount','f_allowance3Amount','f_allowance4Amount'];
    var DED=['f_deductTax','f_deductSocialIns','f_deductEmpIns','f_deductFood','f_deductHousing','f_deductUtility','f_deductOther1Amount'];
    var OUT={f_salaryTotal:'totalMonthly', f_deductTotal:'deductTotal', f_netPay:'netPay'};
    function otOn(){ try{ return (typeof _fixedOTState!=='undefined' && _fixedOTState)==='有'; }catch(e){ return !!num((el('f_fixedOTAmount')||{}).value); } }
    function calc(){
      var b=num((el('f_salaryMonthly')||{}).value); if(!b) return null;
      var tot=b; ALLOW.forEach(function(id){ var n=num((el(id)||{}).value); if(n) tot+=n; });
      if(otOn()){ var o=num((el('f_fixedOTAmount')||{}).value); if(o) tot+=o; }
      var ded=0, ok=true;
      DED.forEach(function(id){ var e=el(id); if(!e) return; var t=String(e.value||'').trim(); if(!t) return; var n=num(t); if(n==null){ ok=false; } else ded+=n; });   // 「実費」など文字があるときは控除合計は計算しない
      return {total:tot, ded:ok?ded:null, net:ok?tot-ded:null};
    }
    window._jyTotals=calc;
    // 固定残業代の金額が入っているのに「無」になっていたら「有」にする（雇用条件セットに有・無の欄がなく、金額だけ入っている場合があるため）
    var _otUser=false;
    document.addEventListener('change', function(ev){ if(ev.target && ev.target.id==='f_fixedOT' && ev.isTrusted) _otUser=true; }, true);
    document.addEventListener('click', function(ev){ var t=ev.target; if(ev.isTrusted && t && t.closest && t.closest('[onclick*="toggleFixedOT"]')) _otUser=true; }, true);
    function fixOT(){
      try{
        if(_otUser) return;
        var a=num((el('f_fixedOTAmount')||{}).value), es=window.__jyEs||{};
        if(!a || String(es.fixedOT||'').trim()==='無') return;
        if((typeof _fixedOTState!=='undefined') && _fixedOTState!=='有' && typeof toggleFixedOT==='function') toggleFixedOT('有');
      }catch(e){}
    }
    function apply(){
      try{
        fixOT();
        var r=calc(); if(!r) return;
        var ch=0, put=function(id,val){ var e=el(id); if(!e || val==null || e.dataset.manualTot==='1') return; var s=fmt(val); if(num(e.value)!==Math.round(val)){ e.value=s; ch++; } };
        put('f_salaryTotal', r.total); put('f_deductTotal', r.ded); put('f_netPay', r.net);
        // 印刷前の「雇用条件と比べる」は、計算し直した合計で比べる（案シスの合計がずれていても誤って出さない）
        if(window.__jyEs){ window.__jyEs=Object.assign({}, window.__jyEs, {totalMonthly:r.total}, r.ded!=null?{deductTotal:r.ded, netPay:r.net}:{}); }
        if(ch && typeof p==='function'){ try{ p(); }catch(e){} }
      }catch(e){ console.warn('[重説の合計]', e); }
    }
    document.addEventListener('input', function(ev){
      var id=ev.target&&ev.target.id||'';
      if(OUT[id] && ev.isTrusted){ if(String(ev.target.value||'').trim()==='') delete ev.target.dataset.manualTot; else ev.target.dataset.manualTot='1'; return; }
      if(BASE.concat(ALLOW,DED,['f_fixedOTAmount']).indexOf(id)>=0) apply();
    }, true);
    window.addEventListener('message', function(e){ try{ if(e.data && e.data.type==='SELECT_CASE'){ _otUser=false; Object.keys(OUT).forEach(function(id){ var x=el(id); if(x) delete x.dataset.manualTot; }); setTimeout(apply, 2500); setTimeout(apply, 5000); } }catch(_e){} });
    // 手で入れた合計が内訳と合わないときの印刷前のお知らせ
    window._jyTotalsIssue=function(){
      var r=calc(), out=[]; if(!r) return out;
      [['f_salaryTotal',r.total,'４．１か月当たりの支払概算額'],['f_deductTotal',r.ded,'５．控除する金額（合計）'],['f_netPay',r.net,'６．手取り支給額']].forEach(function(x){
        var e=el(x[0]); if(!e || x[1]==null) return; var v=num(e.value); if(v!=null && Math.abs(v-x[1])>1) out.push('⚠ '+x[2]+'が内訳の計算と合いません（書類 '+fmt(v)+'円／計算 '+fmt(x[1])+'円）');
      });
      return out;
    };
  }

  // --- 1-6号 → 案シス ---
  if(/(^|\/)1_6(_[a-z]{2})?\.html$/.test(path)){
    var KEYS=['calcMonthly','calcHourly','totalMonthly','deductTax','deductSocial','deductEmployment','deductTotal','netPay'];
    var LABEL={calcMonthly:'換算月給',calcHourly:'換算時給',totalMonthly:'支払概算総額',deductTax:'税金',deductSocial:'社会保険料',deductEmployment:'雇用保険料',deductTotal:'控除合計',netPay:'手取り'};
    var busy=false;
    async function sync(){
      if(busy) return; busy=true;
      try{
        if((typeof _editMode!=='undefined' && _editMode) || window._htmlFrozen) return;
        if(typeof collectFormValues!=='function') return;
        var L=window._empLoadedSet, ctx=window._empCtx||{}, idx=parseInt(window._empLoadedIdx,10);
        if(!L || !ctx.companyId || isNaN(idx) || idx<0) return;
        // 案件に雇用条件セットがはっきり選ばれているときだけ（推測で選んだセットに書き込むと、別の人のセットを変えてしまうため）
        try{ var cid=ctx.caseId||(window._lastCaseInfo&&window._lastCaseInfo.caseId); if(!cid) return; var cr=await sb('cases?select=emp_set_idx&id=eq.'+encodeURIComponent(cid)); if(!cr||!cr[0]||String(cr[0].emp_set_idx)!==String(idx)) return; }catch(e){ return; }
        var cur=collectFormValues()||{}, diff={}, msg=[];
        KEYS.forEach(function(k){
          var nv=num(cur[k]), ov=num(L[k]);
          if(nv==null) return;                      // 書類の側が空・文字なら書かない
          if(ov!=null && Math.abs(nv-ov)<=1) return;
          diff[k]=String(Math.round(nv)); msg.push(LABEL[k]+' '+(ov==null?'空欄':fmt(ov))+'→'+fmt(nv));
        });
        if(!Object.keys(diff).length) return;
        var r=await sb('companies?select=id,emp_sets&id=eq.'+encodeURIComponent(ctx.companyId)); var co=r&&r[0]; if(!co) return;
        var sets=Array.isArray(co.emp_sets)?co.emp_sets:[]; if(!sets[idx]) return;
        Object.assign(sets[idx], diff);
        // 税金・保険料を自動で入れた値として記録（次に開いたときも自動の欄として扱う）
        try{ var av=Object.assign({}, sets[idx].deductAutoVals||{}); ['deductTax','deductSocial','deductEmployment'].forEach(function(k){ if(diff[k]!=null){ var map={deductTax:'es_deductTax',deductSocial:'es_deductSocialIns',deductEmployment:'es_deductEmpIns'}; var e=el(map[k]); if(e && e.dataset.taxAuto==='1') av[k]=diff[k]; } }); if(diff.netPay!=null) av.netPay=diff.netPay; sets[idx].deductAutoVals=av; }catch(e){}
        var w=await sb('companies?id=eq.'+encodeURIComponent(ctx.companyId)+'&select=emp_sets',{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify({emp_sets:sets})});
        if(!w||!w.length) return;
        var ns=(w[0].emp_sets||[])[idx]||sets[idx];
        try{ window._empLoadedSet=JSON.parse(JSON.stringify(ns)); }catch(e){}
        if(window._empCtx) window._empCtx.empSets=w[0].emp_sets||sets;
        try{ if(typeof window.snapshotEmpBaseline==='function') window.snapshotEmpBaseline(); }catch(e){}
        try{ if(typeof slog==='function') slog('p16_sync',{meta:{keys:Object.keys(diff)}}); }catch(e){}
        if(typeof showToast==='function') showToast('🔗 案シスの雇用条件の金額を、この1-6号の計算に合わせました（'+msg.slice(0,3).join('、')+(msg.length>3?' ほか':'')+'）');
      }catch(e){ console.warn('[1-6→案シス 金額]', e); }
      finally{ busy=false; }
    }
    window._p16SyncToAnshis=sync;
    window.addEventListener('message', function(e){ try{ if(e.data && e.data.type==='SELECT_CASE'){ setTimeout(sync, 8500); } }catch(_e){} });
  }
})();


/* ===== ver.20261112.05: 印刷・PDFに出さないもの、書類の表示 =====
   ① 社内向けのお知らせ・メモ・確認の窓は、印刷・PDFに出さない（書類のページの中のものは対象外）
   ② 書類が画面より広いとき、左が切れずに横に動かせる */
(function(){
  try{
    var st=document.createElement('style'); st.id='_ofusaPrintHide';
    st.textContent='@media screen{ #pageArea{align-items:safe center!important;overflow-x:auto!important;} }'
      +'@media print{ :is([id$="Modal"],[id$="modal"],[id$="Overlay"],[id$="Notice"],[id$="Toast"],[id$="Dlg"],[id$="Dialog"],#_hwOver,#stylePanel,#_trBulk,#p16SavePrompt,#trWrong,#ofusaRepSelectBar,#aiCheck16Panel,.__toast,.ofusa-noprint)'
      +':not(:is(.doc,.docabs,[id^="docP"],#__combinedPrintArea,.pmpage) *){display:none!important;} }';
    (document.head||document.documentElement).appendChild(st);
  }catch(_c){}
})();

/* ===== ver.20261112.15: 同じ案件の読み込みを重ねない =====
   Saysay本体（index.html）は、案件の情報を確実に届けるため同じ書類へ SELECT_CASE を最大5回送る。
   書類はそのたびに案シスから読み直していたため、読み込みの約7割が3秒以内の重複だった（通信が遅いと表示が一瞬崩れる原因）。
   ・書類が実際に読み込みを始めた（loadFromDB／loadCaseToForm が呼ばれた）ときに、その案件の情報を覚える
   ・その後4秒以内に「同じ案件・同じ内容」の SELECT_CASE が来たら、書類には渡さない
   ・まだ読み込みが始まっていない（書類の準備前に届いた）ときは止めないので、届かなくなることはない
   ・別の案件・内容が違うとき（雇用条件セットの番号が変わった等）・info.force があるときは止めない */
(function(){
  var KEEP=4000;
  function keyOf(info){
    try{ if(!info||!info.caseId) return ''; var o={}; Object.keys(info).sort().forEach(function(k){ if(k!=='token' && k!=='force') o[k]=info[k]; }); o.__tok=!!info.token; /* ログイン情報が付いて届き直したときは止めない */ return JSON.stringify(o); }catch(e){ return ''; }
  }
  function mark(info){ var k=keyOf(info); if(k) window._lcfLast={key:k, t:Date.now()}; }
  window.addEventListener('message', function(e){
    try{
      var d=e.data; if(!d || d.type!=='SELECT_CASE' || !d.info || d.info.force) return;
      var L=window._lcfLast, k=keyOf(d.info);
      if(L && k && L.key===k && Date.now()-L.t < KEEP){ e.stopImmediatePropagation(); }
    }catch(_e){}
  }, true);
  function wrap(name){
    try{
      var f=window[name]; if(typeof f!=='function' || f.__lcf) return;
      var w=function(info){ mark(info); return f.apply(this, arguments); };
      w.__lcf=true; try{ Object.keys(f).forEach(function(k){ w[k]=f[k]; }); }catch(_k){}
      window[name]=w;
    }catch(e){}
  }
  wrap('loadCaseToForm');
  function wrapAll(){ wrap('loadFromDB'); wrap('loadCaseToForm'); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', wrapAll); else wrapAll();
  setTimeout(wrapAll, 0); setTimeout(wrapAll, 1500);
})();
