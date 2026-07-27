/* =========================================================
   copy.js
   「ChatGPTへ解析依頼」ボタンの文章生成とクリップボードコピー
   ========================================================= */

/**
 * 入力データからChatGPT解析依頼用のテキストを組み立てる
 * @param {object} state script.jsの入力全体
 * @param {object} rates calc.calcAllRates() の結果
 * @returns {string}
 */
function buildChatGptText(state, rates) {
  const b = state.basic || {};
  const s = state.suggestions || {};

  const line = (label, count, rate) => {
    const denom = rate && rate.denominator ? `1/${rate.denominator.toFixed(1)}` : '未発生';
    return `${label}\n${count || 0}回\n${denom}`;
  };

  const seishin = ['seishin10', 'seishin20', 'seishin30', 'seishin40', 'seishin50']
    .map((k, i) => `${(i + 1) * 10}G ${state.counts?.[k] || 0}回`)
    .join('\n');

  const text = `東京喰種設定判別

店舗：${b.shop || ''}
日付：${b.date || ''}
台番号：${b.machineNo || ''}

通常G：${b.normalGames || 0}
ATG：${b.atGames || 0}
総G：${b.totalGames || 0}

${line('レミニセンス', state.counts?.reminiscence, rates.reminiscence)}

精神世界
${seishin}

${line('大喰いのリゼ', state.counts?.ohagui, rates.ohagui)}

${line('エピソード', state.counts?.episode, rates.episode)}

AT直撃
${state.counts?.atChokugeki || 0}回

通常赫眼
${state.counts?.kakuganNormal || 0}回

AT中赫眼
${state.counts?.kakuganAT || 0}回

カード示唆：${(s.card || []).join('、') || 'なし'}
終了画面：${(s.ending || []).join('、') || 'なし'}
トロフィー：${(s.trophy || []).join('、') || 'なし'}

投資：${b.invest || 0}
回収：${b.payout || 0}
差枚：${(Number(b.payout || 0) - Number(b.invest || 0))}

このデータを解析してください。
以下を出力してください。

①設定1〜6期待度
②設定4以上期待度
③設定5以上期待度
④設定6期待度
⑤続行・ヤメ判断
⑥プラス要素
⑦マイナス要素
⑧不足しているデータ
⑨総合評価`;

  return text;
}

/**
 * テキストをクリップボードへコピーする(失敗時はフォールバック手段も試す)
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    throw new Error('clipboard API unavailable');
  } catch (e) {
    // フォールバック: 一時的なtextareaを使ったコピー
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch (e2) {
      console.error('クリップボードコピーに失敗しました', e2);
      return false;
    }
  }
}

/* ブラウザのグローバルスコープへ公開 */
window.CopyModule = {
  buildChatGptText,
  copyToClipboard
};
