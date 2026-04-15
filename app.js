/* ============================================
   Verita School Eco Team — Recycling Dashboard
   Application Logic (Paper Only)
   ============================================ */

(() => {
  'use strict';

  // ——— CONFIG ———
  const STORAGE_KEYS = {
    sheetId: 'verita_sheet_id',
    sheetName: 'verita_sheet_name',
    goal: 'verita_goal',
  };

  const CO2_FACTOR = 0.9; // rough estimate: 0.9 kg CO₂ saved per kg recycled

  // ——— STATE ———
  let rawData = [];
  let trendChart = null;
  let currentPeriod = 'weekly';

  // ——— DOM REFS ———
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    loading: $('#loadingOverlay'),
    connectionBanner: $('#connectionBanner'),
    statusDot: $('#statusDot'),
    statusText: $('#statusText'),
    // Stats
    valueTotal: $('#valueTotal'),
    valueMonth: $('#valueMonth'),
    valueCO2: $('#valueCO2'),
    valueClasses: $('#valueClasses'),
    trendTotal: $('#trendTotal'),
    trendMonth: $('#trendMonth'),
    // Charts
    trendCanvas: $('#trendChart'),
    // Leaderboard
    leaderboardList: $('#leaderboardList'),
    // Goal
    goalRingProgress: $('#goalRingProgress'),
    goalPercent: $('#goalPercent'),
    goalCurrent: $('#goalCurrent'),
    goalTarget: $('#goalTarget'),
    goalRemaining: $('#goalRemaining'),
    // Modal
    modal: $('#settingsModal'),
    sheetIdInput: $('#sheetIdInput'),
    sheetNameInput: $('#sheetNameInput'),
    goalInput: $('#goalInput'),
    modalStatus: $('#modalStatus'),
  };

  // ——————————————————————————
  //  DEMO DATA
  // ——————————————————————————
  function generateDemoData() {
    const classes = ['Grade 1A', 'Grade 1B', 'Grade 2A', 'Grade 2B', 'Grade 3A', 'Grade 3B', 'Grade 4A', 'Grade 4B', 'Grade 5A', 'Grade 5B'];
    const data = [];
    const today = new Date();

    for (let w = 11; w >= 0; w--) {
      for (const cls of classes) {
        const date = new Date(today);
        date.setDate(date.getDate() - w * 7 - Math.floor(Math.random() * 5));
        data.push({
          Date: date.toISOString().split('T')[0],
          Class: cls,
          Paper: +(Math.random() * 5 + 0.5).toFixed(1),
        });
      }
    }
    return data;
  }

  // ——————————————————————————
  //  GOOGLE SHEETS FETCHING
  // ——————————————————————————
  async function fetchSheetData(sheetId, sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csvText = await response.text();

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          // Normalise column names (trim whitespace, case-insensitive match)
          const rows = results.data.map((row) => {
            const normalised = {};
            for (const [key, value] of Object.entries(row)) {
              const k = key.trim().toLowerCase();
              normalised[k] = value;
            }
            // Support multiple possible column names for the Paper metric
            const paperValue = normalised.paper || normalised.kg || normalised.amount || normalised['paper (kg)'] || normalised['kg of paper'] || 0;
            return {
              Date: String(normalised.date || ''),
              Class: String(normalised.class || normalised.grade || ''),
              Paper: parseFloat(paperValue) || 0,
            };
          });
          resolve(rows);
        },
        error: (err) => reject(err),
      });
    });
  }

  // ——————————————————————————
  //  DATA PROCESSING
  // ——————————————————————————
  function computeStats(data) {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    let totalAll = 0;
    let totalThisMonth = 0;
    let totalLastMonth = 0;
    const classTotals = {};
    const classesSet = new Set();

    for (const row of data) {
      const t = row.Paper || 0;
      totalAll += t;

      const d = new Date(row.Date);
      if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) totalThisMonth += t;
      if (d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear) totalLastMonth += t;

      if (row.Class) {
        classesSet.add(row.Class);
        classTotals[row.Class] = (classTotals[row.Class] || 0) + t;
      }
    }

    // Month-over-month trend
    const trendPct = totalLastMonth > 0 ? ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100 : 0;

    // Leaderboard sorted
    const leaderboard = Object.entries(classTotals)
      .map(([name, total]) => ({ name, total: +total.toFixed(1) }))
      .sort((a, b) => b.total - a.total);

    return {
      totalAll: +totalAll.toFixed(1),
      totalThisMonth: +totalThisMonth.toFixed(1),
      totalLastMonth: +totalLastMonth.toFixed(1),
      trendPct: +trendPct.toFixed(1),
      co2Saved: +(totalAll * CO2_FACTOR).toFixed(1),
      classCount: classesSet.size,
      leaderboard,
    };
  }

  // Group data by week or month for trend chart
  function groupByPeriod(data, period) {
    const groups = {};

    for (const row of data) {
      const d = new Date(row.Date);
      let key;
      if (period === 'weekly') {
        // ISO week start (Monday)
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        key = monday.toISOString().split('T')[0];
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!groups[key]) groups[key] = { Paper: 0 };
      groups[key].Paper += row.Paper || 0;
    }

    // Sort by key and return
    const sorted = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    return {
      labels: sorted.map(([k]) => {
        if (period === 'weekly') {
          const d = new Date(k);
          return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        }
        const [y, m] = k.split('-');
        return new Date(y, m - 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      }),
      datasets: [sorted.map(([, v]) => +v.Paper.toFixed(1))],
    };
  }

  // ——————————————————————————
  //  RENDERING
  // ——————————————————————————

  // Animated counter
  function animateValue(el, target, duration = 1200) {
    const start = parseFloat(el.textContent) || 0;
    const diff = target - start;
    if (Math.abs(diff) < 0.1) { el.textContent = target; return; }
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = (start + diff * eased).toFixed(target >= 100 ? 0 : 1);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderStats(stats) {
    animateValue(dom.valueTotal, stats.totalAll);
    animateValue(dom.valueMonth, stats.totalThisMonth);
    animateValue(dom.valueCO2, stats.co2Saved);
    dom.valueClasses.textContent = stats.classCount;

    // Trends
    if (stats.trendPct > 0) {
      dom.trendTotal.textContent = `↑ ${stats.trendPct}%`;
      dom.trendTotal.className = 'stat-card__trend stat-card__trend--up';
    } else if (stats.trendPct < 0) {
      dom.trendTotal.textContent = `↓ ${Math.abs(stats.trendPct)}%`;
      dom.trendTotal.className = 'stat-card__trend stat-card__trend--down';
    } else {
      dom.trendTotal.textContent = '—';
    }

    // Copy trend to month card too
    dom.trendMonth.textContent = dom.trendTotal.textContent;
    dom.trendMonth.className = dom.trendTotal.className;
  }

  const PAPER_COLOR = { bg: 'rgba(96, 165, 250, 0.7)', border: '#60a5fa' };

  function renderTrendChart(data) {
    const grouped = groupByPeriod(data, currentPeriod);

    const datasets = [{
      label: 'Paper',
      data: grouped.datasets[0],
      backgroundColor: PAPER_COLOR.bg,
      borderColor: PAPER_COLOR.border,
      borderWidth: 2,
      borderRadius: 4,
      borderSkipped: false,
    }];

    const config = {
      type: 'bar',
      data: { labels: grouped.labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(10, 15, 13, 0.95)',
            titleColor: '#f0fdf4',
            bodyColor: '#a7c4b8',
            borderColor: 'rgba(52, 211, 153, 0.2)',
            borderWidth: 1,
            cornerRadius: 8,
            titleFont: { family: 'Inter', weight: '700' },
            bodyFont: { family: 'Inter' },
            padding: 12,
            callbacks: {
              label: (ctx) => `${ctx.parsed.y} kg`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#5a7d6d', font: { family: 'Inter', size: 11 } },
          },
          y: {
            grid: { color: 'rgba(52, 211, 153, 0.06)' },
            ticks: {
              color: '#5a7d6d',
              font: { family: 'Inter', size: 11 },
              callback: (v) => v + ' kg',
            },
            beginAtZero: true
          },
        },
      },
    };

    if (trendChart) {
      trendChart.data = config.data;
      trendChart.update('none');
    } else {
      trendChart = new Chart(dom.trendCanvas, config);
    }
  }

  function renderLeaderboard(leaderboard) {
    dom.leaderboardList.innerHTML = leaderboard.slice(0, 8).map((entry, i) => {
      const rank = i + 1;
      let rankClass = 'leaderboard__rank--default';
      let medal = rank;
      if (rank === 1) { rankClass = 'leaderboard__rank--1'; medal = '🥇'; }
      else if (rank === 2) { rankClass = 'leaderboard__rank--2'; medal = '🥈'; }
      else if (rank === 3) { rankClass = 'leaderboard__rank--3'; medal = '🥉'; }

      return `
        <li class="leaderboard__item" style="animation-delay: ${i * 60}ms">
          <span class="leaderboard__rank ${rankClass}">${medal}</span>
          <span class="leaderboard__name">${entry.name}</span>
          <span class="leaderboard__value">${entry.total}<span class="leaderboard__unit">kg</span></span>
        </li>`;
    }).join('');
  }

  function renderGoal(totalAll) {
    const goal = getGoal();
    const pct = Math.min((totalAll / goal) * 100, 100);
    const circumference = 2 * Math.PI * 60; // r = 60
    const offset = circumference - (pct / 100) * circumference;

    dom.goalRingProgress.style.strokeDashoffset = offset;
    dom.goalPercent.textContent = `${pct.toFixed(0)}%`;
    dom.goalCurrent.textContent = `${totalAll} kg`;
    dom.goalTarget.textContent = `${goal} kg`;
    dom.goalRemaining.textContent = `${Math.max(0, +(goal - totalAll).toFixed(1))} kg`;
  }

  // ——————————————————————————
  //  SETTINGS / LOCALSTORAGE
  // ——————————————————————————
  function getSheetId() { return localStorage.getItem(STORAGE_KEYS.sheetId) || ''; }
  function getSheetName() { return localStorage.getItem(STORAGE_KEYS.sheetName) || 'Sheet1'; }
  function getGoal() { return parseFloat(localStorage.getItem(STORAGE_KEYS.goal)) || 500; }

  function saveSettings(id, name, goal) {
    localStorage.setItem(STORAGE_KEYS.sheetId, id);
    localStorage.setItem(STORAGE_KEYS.sheetName, name);
    localStorage.setItem(STORAGE_KEYS.goal, goal);
  }

  function setConnectionStatus(connected) {
    dom.statusDot.classList.toggle('disconnected', !connected);
    dom.statusText.textContent = connected ? 'Sheet connected' : 'Demo data';
    dom.connectionBanner.classList.toggle('visible', !connected);
  }

  function showModalStatus(msg, isError) {
    dom.modalStatus.textContent = msg;
    dom.modalStatus.className = `modal__status modal__status--${isError ? 'error' : 'success'}`;
  }

  function clearModalStatus() {
    dom.modalStatus.className = 'modal__status';
    dom.modalStatus.textContent = '';
  }

  // ——————————————————————————
  //  MAIN LOAD
  // ——————————————————————————
  async function loadData() {
    dom.loading.classList.remove('hidden');

    const sheetId = getSheetId();
    let connected = false;

    if (sheetId) {
      try {
        rawData = await fetchSheetData(sheetId, getSheetName());
        connected = true;
      } catch (err) {
        console.warn('Failed to fetch sheet, falling back to demo data:', err);
        rawData = generateDemoData();
      }
    } else {
      rawData = generateDemoData();
    }

    setConnectionStatus(connected);

    const stats = computeStats(rawData);
    renderStats(stats);
    renderTrendChart(rawData);
    renderLeaderboard(stats.leaderboard);
    renderGoal(stats.totalAll);

    // Hide loading
    setTimeout(() => dom.loading.classList.add('hidden'), 400);
  }

  // ——————————————————————————
  //  EVENT LISTENERS
  // ——————————————————————————
  function setupEvents() {
    // Settings modal open
    $('#settingsBtn').addEventListener('click', openModal);
    $('#bannerSettingsBtn').addEventListener('click', openModal);

    // Settings modal close
    $('#modalCancelBtn').addEventListener('click', closeModal);
    dom.modal.addEventListener('click', (e) => {
      if (e.target === dom.modal) closeModal();
    });

    // Test connection
    $('#modalTestBtn').addEventListener('click', async () => {
      const id = dom.sheetIdInput.value.trim();
      const name = dom.sheetNameInput.value.trim() || 'Sheet1';
      if (!id) { showModalStatus('Please enter a Sheet ID.', true); return; }

      showModalStatus('Testing connection…', false);
      dom.modalStatus.className = 'modal__status modal__status--success';
      try {
        const testData = await fetchSheetData(id, name);
        showModalStatus(`✅ Connected! Found ${testData.length} rows.`, false);
      } catch (err) {
        showModalStatus(`❌ Failed: ${err.message}. Check that the sheet is shared publicly.`, true);
      }
    });

    // Save & Load
    $('#modalSaveBtn').addEventListener('click', () => {
      const id = dom.sheetIdInput.value.trim();
      const name = dom.sheetNameInput.value.trim() || 'Sheet1';
      const goal = parseFloat(dom.goalInput.value) || 500;
      saveSettings(id, name, goal);
      closeModal();
      loadData();
    });

    // Refresh
    $('#refreshBtn').addEventListener('click', () => loadData());

    // Chart period filter
    $$('.chart-card__filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.chart-card__filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentPeriod = btn.dataset.period;
        renderTrendChart(rawData);
      });
    });

    // Keyboard: Escape to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  function openModal() {
    dom.sheetIdInput.value = getSheetId();
    dom.sheetNameInput.value = getSheetName();
    dom.goalInput.value = getGoal();
    clearModalStatus();
    dom.modal.classList.add('active');
  }

  function closeModal() {
    dom.modal.classList.remove('active');
  }

  // ——————————————————————————
  //  INIT
  // ——————————————————————————
  function init() {
    setupEvents();
    loadData();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
