/* =========================================================
   storage.js
   LocalStorageへの保存/読込を一元管理するモジュール。
   ・自動保存(入力途中の状態復元)
   ・履歴保存/一覧/削除/編集
   ・CSVエクスポート/インポート
   ========================================================= */

const STORAGE_KEYS = {
  AUTOSAVE: 'tg_autosave_v1',
  HISTORY: 'tg_history_v1'
};

/* ---------- 自動保存(入力途中データ) ---------- */

/**
 * 現在の入力状態をLocalStorageへ自動保存する
 * @param {object} state script.js が保持している入力全体
 */
function autoSave(state) {
  try {
    localStorage.setItem(STORAGE_KEYS.AUTOSAVE, JSON.stringify(state));
  } catch (e) {
    console.error('自動保存に失敗しました', e);
  }
}

/**
 * 自動保存されていた入力状態を復元する
 * @returns {object|null}
 */
function loadAutoSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTOSAVE);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('自動保存データの読み込みに失敗しました', e);
    return null;
  }
}

/**
 * 自動保存データをクリアする(履歴保存後や新規入力開始時に使用)
 */
function clearAutoSave() {
  localStorage.removeItem(STORAGE_KEYS.AUTOSAVE);
}

/* ---------- 履歴保存 ---------- */

/**
 * 履歴一覧を取得する(新しい順)
 * @returns {object[]}
 */
function getHistoryList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    const list = raw ? JSON.parse(raw) : [];
    return list.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  } catch (e) {
    console.error('履歴の読み込みに失敗しました', e);
    return [];
  }
}

/**
 * 履歴を1件追加保存する
 * @param {object} state 保存したい入力全体(店舗・日付・台番号・全データ)
 * @returns {string} 発行したID
 */
function saveHistory(state) {
  const list = getHistoryList();
  const id = 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const record = {
    id,
    savedAt: new Date().toISOString(),
    ...state
  };
  list.unshift(record);
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(list));
  return id;
}

/**
 * 既存の履歴を上書き更新する(編集画面用)
 */
function updateHistory(id, state) {
  const list = getHistoryList();
  const idx = list.findIndex(r => r.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], ...state, id, savedAt: list[idx].savedAt, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(list));
  return true;
}

/**
 * 履歴を1件削除する
 */
function deleteHistory(id) {
  const list = getHistoryList().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(list));
}

/**
 * IDから履歴1件を取得する
 */
function getHistoryById(id) {
  return getHistoryList().find(r => r.id === id) || null;
}

/* ---------- CSVエクスポート/インポート ---------- */

/**
 * 履歴一覧をCSV文字列に変換する
 */
function historyToCsv(list) {
  if (!list.length) return '';
  // フラット化のためJSONの入れ子はJSON文字列として1セルに格納する
  const headers = ['id', 'savedAt', 'shop', 'date', 'machineNo', 'dataJson'];
  const rows = list.map(r => {
    const dataJson = JSON.stringify(r.data || {});
    return [r.id, r.savedAt, r.shop || '', r.date || '', r.machineNo || '', dataJson]
      .map(csvEscape).join(',');
  });
  return [headers.join(','), ...rows].join('\r\n');
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * CSV文字列をパースして履歴配列へ戻す(簡易CSVパーサ、ダブルクォート対応)
 */
function csvToHistory(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return [];
  const headers = rows[0];
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < headers.length) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    let data = {};
    try { data = JSON.parse(obj.dataJson || '{}'); } catch (e) { /* skip */ }
    records.push({
      id: obj.id || ('h_' + Date.now() + '_' + i),
      savedAt: obj.savedAt || new Date().toISOString(),
      shop: obj.shop || '',
      date: obj.date || '',
      machineNo: obj.machineNo || '',
      data
    });
  }
  return records;
}

/* シンプルなCSVパーサ(カンマ区切り・ダブルクォート囲み・改行対応) */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length && r.some(c => c !== ''));
}

/**
 * 履歴一覧をCSVファイルとしてダウンロードする
 */
function exportHistoryAsCsv() {
  const list = getHistoryList();
  const csv = historyToCsv(list);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `tokyoghoul_history_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * CSVファイルの内容を履歴へインポート(マージ)する
 * @param {string} csvText
 * @param {boolean} replace true:置き換え / false:追記マージ
 */
function importHistoryFromCsv(csvText, replace = false) {
  const imported = csvToHistory(csvText);
  if (replace) {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(imported));
  } else {
    const current = getHistoryList();
    const existingIds = new Set(current.map(r => r.id));
    const merged = current.concat(imported.filter(r => !existingIds.has(r.id)));
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(merged));
  }
  return imported.length;
}

/* ブラウザのグローバルスコープへ公開 */
window.StorageModule = {
  autoSave,
  loadAutoSave,
  clearAutoSave,
  getHistoryList,
  saveHistory,
  updateHistory,
  deleteHistory,
  getHistoryById,
  exportHistoryAsCsv,
  importHistoryFromCsv
};
