/* =========================================================
   script.js
   UIの初期化・状態管理・各モジュール(calc/storage/copy/graph)の
   呼び出しをまとめたエントリーポイント。
   ========================================================= */

(function () {
  'use strict';

  /* ---------- アプリの状態(単一の状態オブジェクトで管理) ---------- */
  let state = {
    basic: {
      shop: '', date: '', machineNo: '',
      normalGames: 0, atGames: 0, totalGames: 0, currentGames: 0,
      invest: 0, payout: 0
    },
    counts: {
      reminiscence: 0, ohagui: 0, episode: 0, atChokugeki: 0,
      kakuganNormal: 0, kakuganAT: 0,
      seishin10: 0, seishin20: 0, seishin30: 0, seishin40: 0, seishin50: 0
    },
    suggestions: { card: [], ending: [], trophy: [] },
    editingHistoryId: null // 履歴編集中の場合はそのID
  };

  let settingData = {};
  let autoSaveTimer = null;

  /* ---------- 初期化 ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    settingData = await window.CalcModule.loadSettingData();

    buildCounterList();
    bindBasicInputs();
    bindChipGroups();
    bindNav();
    bindHeaderButtons();
    bindJudgeTab();
    bindHistoryTab();

    restoreAutoSave();
    renderAll();
  });

  /* ---------- タブナビゲーション ---------- */
  function bindNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(tabName) {
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.hidden = panel.dataset.tab !== tabName;
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.tab === tabName);
    });
    if (tabName === 'judge') renderJudgeTab();
    if (tabName === 'history') renderHistoryList();
  }

  /* ---------- 基本情報タブ ---------- */
  function bindBasicInputs() {
    const map = {
      'in-shop': 'shop', 'in-date': 'date', 'in-machineNo': 'machineNo',
      'in-normalGames': 'normalGames', 'in-atGames': 'atGames', 'in-totalGames': 'totalGames',
      'in-currentGames': 'currentGames', 'in-invest': 'invest', 'in-payout': 'payout'
    };
    Object.entries(map).forEach(([id, key]) => {
      const el = document.getElementById(id);
      el.addEventListener('input', () => {
        const isNumeric = el.type === 'number';
        state.basic[key] = isNumeric ? Number(el.value || 0) : el.value;
        onStateChange();
        updateDiffMai();
      });
    });
  }

  function updateDiffMai() {
    const diff = Number(state.basic.payout || 0) - Number(state.basic.invest || 0);
    document.getElementById('out-diffMai').textContent = diff.toLocaleString();
  }

  /* ---------- 設定差入力タブ(カウンター) ---------- */
  function buildCounterList() {
    const container = document.getElementById('counter-list');
    container.innerHTML = '';
    Object.keys(settingData).forEach(key => {
      if (key.startsWith('_')) return;
      const def = settingData[key];
      const card = document.createElement('div');
      card.className = 'counter-card';
      card.innerHTML = `
        <div class="counter-card__head">
          <span class="counter-card__name">${def.label}</span>
          <span class="counter-card__rate" id="rate-${key}">1/-</span>
        </div>
        <div class="counter-card__controls">
          <button type="button" class="counter-btn minus" data-key="${key}" data-delta="-1" aria-label="${def.label}を1減らす">−</button>
          <input type="number" inputmode="numeric" class="counter-input" id="count-${key}" value="0">
          <button type="button" class="counter-btn plus" data-key="${key}" data-delta="1" aria-label="${def.label}を1増やす">＋</button>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.counter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const delta = Number(btn.dataset.delta);
        state.counts[key] = Math.max(0, (state.counts[key] || 0) + delta);
        document.getElementById(`count-${key}`).value = state.counts[key];
        onStateChange();
        updateRatesDisplay();
      });
    });

    container.querySelectorAll('.counter-input').forEach(input => {
      input.addEventListener('input', () => {
        const key = input.id.replace('count-', '');
        state.counts[key] = Math.max(0, Number(input.value || 0));
        onStateChange();
        updateRatesDisplay();
      });
    });
  }

  function updateRatesDisplay() {
    const baseInfo = {
      totalGames: Number(state.basic.totalGames || 0),
      normalGames: Number(state.basic.normalGames || 0),
      atGames: Number(state.basic.atGames || 0)
    };
    const rates = window.CalcModule.calcAllRates(state.counts, baseInfo, settingData);
    Object.keys(rates).forEach(key => {
      const el = document.getElementById(`rate-${key}`);
      if (!el) return;
      const r = rates[key];
      el.textContent = r.denominator ? `1/${r.denominator.toFixed(1)}` : '1/-';
    });
    return rates;
  }

  /* ---------- 示唆入力タブ(チップ) ---------- */
  function bindChipGroups() {
    document.querySelectorAll('.chip-group').forEach(group => {
      const groupKey = group.dataset.suggestGroup;
      group.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const value = chip.dataset.value;
          const list = state.suggestions[groupKey];
          const idx = list.indexOf(value);
          if (idx === -1) {
            list.push(value);
            chip.classList.add('is-active');
          } else {
            list.splice(idx, 1);
            chip.classList.remove('is-active');
          }
          onStateChange();
        });
      });
    });
  }

  function syncChipUI() {
    document.querySelectorAll('.chip-group').forEach(group => {
      const groupKey = group.dataset.suggestGroup;
      const list = state.suggestions[groupKey] || [];
      group.querySelectorAll('.chip').forEach(chip => {
        chip.classList.toggle('is-active', list.includes(chip.dataset.value));
      });
    });
  }

  /* ---------- 設定判別タブ ---------- */
  function bindJudgeTab() {
    const select = document.getElementById('select-chart-item');
    Object.keys(settingData).forEach(key => {
      if (key.startsWith('_')) return;
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = settingData[key].label;
      select.appendChild(opt);
    });
    select.addEventListener('change', renderItemChart);

    document.getElementById('btn-copy-chatgpt').addEventListener('click', async () => {
      const rates = updateRatesDisplay();
      const text = window.CopyModule.buildChatGptText(state, rates);
      const ok = await window.CopyModule.copyToClipboard(text);
      showToast(ok ? 'コピーしました' : 'コピーに失敗しました');
    });

    document.getElementById('btn-save-history').addEventListener('click', () => {
      saveCurrentAsHistory();
    });
  }

  function renderJudgeTab() {
    const baseInfo = {
      totalGames: Number(state.basic.totalGames || 0),
      normalGames: Number(state.basic.normalGames || 0),
      atGames: Number(state.basic.atGames || 0)
    };
    const probs = window.CalcModule.calcSettingProbabilities(state.counts, baseInfo, settingData);
    const summary = window.CalcModule.summarizeSettingProbabilities(probs);

    const canvas = document.getElementById('chart-probability');
    window.GraphModule.renderProbabilityChart(canvas, probs);

    const summaryEl = document.getElementById('prob-summary');
    summaryEl.innerHTML = `
      <div class="prob-summary__item"><span class="label">設定4以上</span><span class="value">${summary.over4.toFixed(1)}%</span></div>
      <div class="prob-summary__item"><span class="label">設定5以上</span><span class="value">${summary.over5.toFixed(1)}%</span></div>
      <div class="prob-summary__item"><span class="label">設定6</span><span class="value">${summary.just6.toFixed(1)}%</span></div>
    `;

    renderItemChart();
  }

  function renderItemChart() {
    const key = document.getElementById('select-chart-item').value;
    if (!key || !settingData[key]) return;
    const def = settingData[key];
    const baseInfo = {
      totalGames: Number(state.basic.totalGames || 0),
      normalGames: Number(state.basic.normalGames || 0),
      atGames: Number(state.basic.atGames || 0)
    };
    const trials = window.CalcModule.resolveTrials(baseInfo, def.trialBase);
    const denom = window.CalcModule.calcDenominator(state.counts[key], trials);
    const canvas = document.getElementById('chart-item');
    window.GraphModule.renderComparisonChart(canvas, def.label, def.values, denom);
  }

  /* ---------- 履歴タブ ---------- */
  function bindHistoryTab() {
    document.getElementById('btn-export-csv').addEventListener('click', () => {
      window.StorageModule.exportHistoryAsCsv();
      showToast('CSVを書き出しました');
    });

    document.getElementById('in-import-csv').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const count = window.StorageModule.importHistoryFromCsv(text, false);
      showToast(`${count}件インポートしました`);
      renderHistoryList();
      e.target.value = '';
    });
  }

  function saveCurrentAsHistory() {
    const record = {
      shop: state.basic.shop,
      date: state.basic.date,
      machineNo: state.basic.machineNo,
      data: {
        basic: state.basic,
        counts: state.counts,
        suggestions: state.suggestions
      }
    };
    if (state.editingHistoryId) {
      window.StorageModule.updateHistory(state.editingHistoryId, record);
      showToast('履歴を更新しました');
    } else {
      window.StorageModule.saveHistory(record);
      showToast('履歴に保存しました');
    }
    renderHistoryList();
  }

  function renderHistoryList() {
    const list = window.StorageModule.getHistoryList();
    const ul = document.getElementById('history-list');
    const emptyHint = document.getElementById('history-empty');
    ul.innerHTML = '';

    emptyHint.hidden = list.length > 0;

    list.forEach(record => {
      const li = document.createElement('li');
      li.className = 'history-item';
      const dateLabel = record.date || '(日付未入力)';
      const savedLabel = record.savedAt ? new Date(record.savedAt).toLocaleString('ja-JP') : '';
      li.innerHTML = `
        <div class="history-item__info">
          <div class="history-item__title">${escapeHtml(record.shop || '(店舗未入力)')} / 台${escapeHtml(record.machineNo || '-')}</div>
          <div class="history-item__meta">${escapeHtml(dateLabel)} ・ 保存:${savedLabel}</div>
        </div>
        <div class="history-item__actions">
          <button class="icon-btn" data-action="edit" data-id="${record.id}" aria-label="編集">✎</button>
          <button class="icon-btn danger" data-action="delete" data-id="${record.id}" aria-label="削除">🗑</button>
        </div>
      `;
      ul.appendChild(li);
    });

    ul.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => loadHistoryIntoForm(btn.dataset.id));
    });
    ul.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('この履歴を削除しますか？')) {
          window.StorageModule.deleteHistory(btn.dataset.id);
          renderHistoryList();
          showToast('削除しました');
        }
      });
    });
  }

  function loadHistoryIntoForm(id) {
    const record = window.StorageModule.getHistoryById(id);
    if (!record || !record.data) return;
    state.basic = { ...state.basic, ...record.data.basic };
    state.counts = { ...state.counts, ...record.data.counts };
    state.suggestions = { ...state.suggestions, ...record.data.suggestions };
    state.editingHistoryId = id;
    renderAll();
    switchTab('basic');
    showToast('履歴を読み込みました(保存すると上書きされます)');
  }

  /* ---------- ヘッダーボタン(リセット) ---------- */
  function bindHeaderButtons() {
    document.getElementById('btn-reset').addEventListener('click', () => {
      if (!confirm('入力中のデータをすべてリセットしますか？(履歴は消えません)')) return;
      state = {
        basic: { shop: '', date: '', machineNo: '', normalGames: 0, atGames: 0, totalGames: 0, currentGames: 0, invest: 0, payout: 0 },
        counts: { reminiscence: 0, ohagui: 0, episode: 0, atChokugeki: 0, kakuganNormal: 0, kakuganAT: 0, seishin10: 0, seishin20: 0, seishin30: 0, seishin40: 0, seishin50: 0 },
        suggestions: { card: [], ending: [], trophy: [] },
        editingHistoryId: null
      };
      window.StorageModule.clearAutoSave();
      renderAll();
      showToast('リセットしました');
    });
  }

  /* ---------- 自動保存 ---------- */
  function onStateChange() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      window.StorageModule.autoSave(state);
    }, 300);
  }

  function restoreAutoSave() {
    const saved = window.StorageModule.loadAutoSave();
    if (saved) {
      state = {
        ...state,
        ...saved,
        basic: { ...state.basic, ...(saved.basic || {}) },
        counts: { ...state.counts, ...(saved.counts || {}) },
        suggestions: { ...state.suggestions, ...(saved.suggestions || {}) }
      };
    }
  }

  /* ---------- 全体再描画(入力欄への値の反映) ---------- */
  function renderAll() {
    document.getElementById('in-shop').value = state.basic.shop || '';
    document.getElementById('in-date').value = state.basic.date || '';
    document.getElementById('in-machineNo').value = state.basic.machineNo || '';
    document.getElementById('in-normalGames').value = state.basic.normalGames || '';
    document.getElementById('in-atGames').value = state.basic.atGames || '';
    document.getElementById('in-totalGames').value = state.basic.totalGames || '';
    document.getElementById('in-currentGames').value = state.basic.currentGames || '';
    document.getElementById('in-invest').value = state.basic.invest || '';
    document.getElementById('in-payout').value = state.basic.payout || '';
    updateDiffMai();

    Object.keys(state.counts).forEach(key => {
      const input = document.getElementById(`count-${key}`);
      if (input) input.value = state.counts[key];
    });
    updateRatesDisplay();

    syncChipUI();
  }

  /* ---------- トースト表示 ---------- */
  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  /* ---------- ユーティリティ ---------- */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
})();
