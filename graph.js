/* =========================================================
   graph.js
   Chart.jsを用いて「現在の実測値」と「設定1〜6の理論値」を
   棒グラフで比較表示するモジュール。
   ========================================================= */

let _chartInstance = null;

/**
 * 棒グラフを描画/更新する
 * @param {HTMLCanvasElement} canvas
 * @param {string} itemLabel 項目名(例:「レミニセンス」)
 * @param {number[]} settingValues 設定1〜6の分母(1/xxのxx) 長さ6
 * @param {number|null} actualValue 実測の分母(1/xxのxx)。未発生ならnull
 */
function renderComparisonChart(canvas, itemLabel, settingValues, actualValue) {
  const labels = ['設定1', '設定2', '設定3', '設定4', '設定5', '設定6', '実測値'];
  const data = [...settingValues, actualValue ?? 0];

  const bgColors = [
    'rgba(200,200,200,0.35)',
    'rgba(200,200,200,0.45)',
    'rgba(200,200,200,0.55)',
    'rgba(230,57,70,0.55)',
    'rgba(230,57,70,0.7)',
    'rgba(230,57,70,0.9)',
    'rgba(255,255,255,0.9)'
  ];
  const borderColors = bgColors.map(c => c.replace(/0\.\d+\)/, '1)'));

  if (_chartInstance) {
    _chartInstance.destroy();
  }

  _chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: `${itemLabel} の分母(1/○○) ※小さいほど高設定寄り`,
        data,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: itemLabel,
          color: '#f5f0e8',
          font: { size: 14, weight: 'bold' }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `1/${ctx.parsed.y ? ctx.parsed.y.toFixed(1) : '-'}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#c9c2b8' },
          grid: { color: 'rgba(255,255,255,0.06)' }
        },
        y: {
          ticks: { color: '#c9c2b8' },
          grid: { color: 'rgba(255,255,255,0.06)' },
          title: { display: true, text: '分母(小さいほど高設定期待)', color: '#c9c2b8' }
        }
      }
    }
  });
}

/**
 * 設定1〜6の事後確率(%)を棒グラフで表示する(設定判別タブ用)
 */
let _probChartInstance = null;
function renderProbabilityChart(canvas, probs) {
  const labels = ['設定1', '設定2', '設定3', '設定4', '設定5', '設定6'];
  if (_probChartInstance) {
    _probChartInstance.destroy();
  }
  _probChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '期待度(%)',
        data: probs,
        backgroundColor: [
          'rgba(200,200,200,0.35)',
          'rgba(200,200,200,0.45)',
          'rgba(200,200,200,0.55)',
          'rgba(230,57,70,0.55)',
          'rgba(230,57,70,0.75)',
          'rgba(230,57,70,0.95)'
        ],
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y.toFixed(1)}%` } }
      },
      scales: {
        x: { ticks: { color: '#c9c2b8' }, grid: { display: false } },
        y: {
          ticks: { color: '#c9c2b8', callback: (v) => v + '%' },
          grid: { color: 'rgba(255,255,255,0.06)' },
          beginAtZero: true
        }
      }
    }
  });
}

window.GraphModule = {
  renderComparisonChart,
  renderProbabilityChart
};
