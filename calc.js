/* =========================================================
   calc.js
   設定差要素の確率計算・設定判別(ベイズ推定風スコアリング)を
   まとめたモジュール。UI(script.js)からはここの関数だけを呼ぶ。
   ========================================================= */

/* settingData.json をfetchして保持するキャッシュ */
let _settingData = null;

/**
 * settingData.json を読み込む(初回のみfetch、以降はキャッシュを返す)
 */
async function loadSettingData() {
  if (_settingData) return _settingData;
  try {
    const res = await fetch('./settingData.json');
    _settingData = await res.json();
  } catch (e) {
    console.error('settingData.json の読み込みに失敗しました', e);
    _settingData = {};
  }
  return _settingData;
}

/**
 * 分母(1/○○の○○部分)を計算する
 * @param {number} count 発生回数
 * @param {number} trials 試行数(母数ゲーム数)
 * @returns {number|null} 1/xxのxx。発生0回ならnull
 */
function calcDenominator(count, trials) {
  if (!count || count <= 0) return null;
  return trials / count;
}

/**
 * 入力データから各項目の trialBase(母数) に対応する実測ゲーム数を取り出す
 * @param {object} baseInfo { totalGames, normalGames, atGames }
 * @param {string} trialBase settingData.json内の trialBase文字列
 */
function resolveTrials(baseInfo, trialBase) {
  switch (trialBase) {
    case 'normalGames':
      return baseInfo.normalGames || 0;
    case 'atGames':
      return baseInfo.atGames || 0;
    case 'totalGames':
    default:
      return baseInfo.totalGames || 0;
  }
}

/**
 * 全項目の「1/○○」表示用データを計算する
 * @param {object} counts 各項目の入力回数 { reminiscence: 3, ohagui: 1, ... }
 * @param {object} baseInfo { totalGames, normalGames, atGames }
 * @param {object} settingData settingData.json の内容
 * @returns {object} { key: { label, count, trials, denominator } }
 */
function calcAllRates(counts, baseInfo, settingData) {
  const result = {};
  for (const key in settingData) {
    if (key.startsWith('_')) continue;
    const def = settingData[key];
    const trials = resolveTrials(baseInfo, def.trialBase);
    const count = counts[key] || 0;
    result[key] = {
      label: def.label,
      count,
      trials,
      denominator: calcDenominator(count, trials)
    };
  }
  return result;
}

/**
 * ポアソン分布による尤度(確率質量関数)を計算する
 * P(X=k) = (λ^k * e^-λ) / k!
 * 設定判別では「この設定だったとして、この回数が観測される尤もらしさ」を見る
 */
function poissonPmf(k, lambda) {
  if (lambda <= 0) {
    return k === 0 ? 1 : 0;
  }
  // logで計算してから戻すことで、桁あふれ・桁落ちを防ぐ
  let logP = -lambda + k * Math.log(lambda) - logFactorial(k);
  return Math.exp(logP);
}

/* log(k!) をスターリング近似併用で計算(kが大きくても安定) */
function logFactorial(k) {
  if (k < 0) return 0;
  let result = 0;
  for (let i = 2; i <= k; i++) {
    result += Math.log(i);
  }
  return result;
}

/**
 * 設定1〜6ごとの尤度を掛け合わせ(対数の和)、事後確率(%)を算出する
 * 事前分布は「全設定均等」として計算(必要ならバイアスを掛けられるよう拡張可)
 *
 * @param {object} counts 各項目の入力回数
 * @param {object} baseInfo { totalGames, normalGames, atGames }
 * @param {object} settingData settingData.json の内容
 * @returns {number[]} 設定1〜6の事後確率(%) 長さ6の配列
 */
function calcSettingProbabilities(counts, baseInfo, settingData) {
  const NUM_SETTINGS = 6;
  const logLikelihoods = new Array(NUM_SETTINGS).fill(0);

  for (const key in settingData) {
    if (key.startsWith('_')) continue;
    const def = settingData[key];
    const trials = resolveTrials(baseInfo, def.trialBase);
    const count = counts[key] || 0;
    if (!trials || trials <= 0) continue;

    for (let s = 0; s < NUM_SETTINGS; s++) {
      const denom = def.values[s];
      if (!denom || denom <= 0) continue;
      const p = 1 / denom;
      const lambda = trials * p;
      const pmf = poissonPmf(count, lambda);
      // 尤度0(あり得ない組み合わせ)による-Infinity対策
      const safePmf = pmf > 0 ? pmf : 1e-12;
      logLikelihoods[s] += Math.log(safePmf);
    }
  }

  // 対数尤度から確率へ正規化(オーバーフロー対策のため最大値を引く)
  const maxLog = Math.max(...logLikelihoods);
  const rawLikelihoods = logLikelihoods.map(l => Math.exp(l - maxLog));
  const sum = rawLikelihoods.reduce((a, b) => a + b, 0);
  return rawLikelihoods.map(v => (sum > 0 ? (v / sum) * 100 : 100 / NUM_SETTINGS));
}

/**
 * 設定4以上・5以上・6の期待度(%)を、設定確率配列からまとめて算出する
 */
function summarizeSettingProbabilities(probs) {
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  return {
    bySetting: probs, // [設定1, 設定2, 設定3, 設定4, 設定5, 設定6]
    over4: sum(probs.slice(3)),
    over5: sum(probs.slice(4)),
    just6: probs[5]
  };
}

/* ブラウザのグローバルスコープへ公開(script.js / graph.js から利用) */
window.CalcModule = {
  loadSettingData,
  calcAllRates,
  calcSettingProbabilities,
  summarizeSettingProbabilities,
  calcDenominator,
  resolveTrials
};
