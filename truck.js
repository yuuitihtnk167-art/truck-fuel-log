  const DB_NAME = 'TruckFuelDB';
  const DB_VERSION = 2;
  const STORE_NAME = 'logs';
  let db;
  let allLogs = [];
  let editingId = null;

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('summaryMonth').value =
      new Date().toISOString().slice(0, 7);
    initDB();

    ['odometer', 'fuelA', 'fuelB'].forEach(id => {
      document.getElementById(id).addEventListener('input', updatePreview);
    });

    document.getElementById('fuelForm')
      .addEventListener('submit', handleSubmit);

    // ★ Service Worker も相対パスでOK（レポジトリ名変更の影響なし）
    if ('serviceWorker' in navigator &&
        (location.protocol === 'http:' || location.protocol === 'https:')) {
      navigator.serviceWorker.register('./sw.js').catch(console.error);
    }
  });

  function initDB() {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME,
                          { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date');
      }
    };
    req.onsuccess = e => { db = e.target.result; loadLogs(); };
    req.onerror = e => {
      console.error(e);
      showNotification('データベースが開けません。');
    };
  }

  function handleSubmit(e) {
    e.preventDefault();
    const data = {
      date: document.getElementById('date').value,
      odometer: parseFloat(document.getElementById('odometer').value),
      fuelA: parseFloat(document.getElementById('fuelA').value) || 0,
      fuelB: parseFloat(document.getElementById('fuelB').value) || 0,
      memo: document.getElementById('memo').value,
      timestamp: Date.now()
    };
    if (!data.date || isNaN(data.odometer)) {
      showNotification('日付と積算距離は必須です。');
      return;
    }
    if (editingId !== null) {
      updateLog(editingId, data);
    } else {
      addLog(data);
    }
  }

  function addLog(data) {
    if (!db) return;
    const tx = db.transaction([STORE_NAME], 'readwrite');
    tx.objectStore(STORE_NAME).add(data);
    tx.oncomplete = () => {
      resetForm();
      loadLogs();
      showNotification('記録を追加しました。');
    };
    tx.onerror = () => showNotification('記録に失敗しました。');
  }

  function updateLog(id, data) {
    if (!db) return;
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const old = req.result;
      if (!old) { addLog(data); return; }
      const updated = { ...old, ...data, id };
      store.put(updated);
    };
    tx.oncomplete = () => {
      resetForm();
      loadLogs();
      showNotification('記録を更新しました。');
    };
    tx.onerror = () => showNotification('更新に失敗しました。');
  }

  function resetForm() {
    editingId = null;
    document.getElementById('fuelForm').reset();
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('submitButton').textContent = '💾 記録を追加する';
    document.getElementById('fuel-preview-card').classList.remove('visible');
  }

  function loadLogs() {
    if (!db) return;
    const tx = db.transaction([STORE_NAME], 'readonly');
    tx.objectStore(STORE_NAME).getAll().onsuccess = e => {
      const raw = e.target.result || [];
      raw.sort((a, b) => {
        if (a.date === b.date) return (a.odometer || 0) - (b.odometer || 0);
        return a.date < b.date ? -1 : 1;
      });
      let prev = null;
      allLogs = raw.map((log, idx) => {
        let distance = 0;
        let isFirst = false;
        if (idx === 0) {
          isFirst = true;
        } else if (prev && typeof prev.odometer === 'number') {
          const d = (log.odometer || 0) - (prev.odometer || 0);
          if (d > 0) distance = d;
          else isFirst = true;
        }
        const totalFuel =
          (parseFloat(log.fuelA) || 0) + (parseFloat(log.fuelB) || 0);
        const efficiency =
          distance > 0 && totalFuel > 0 ? distance / totalFuel : 0;
        const enriched = {
          ...log,
          distance,
          totalFuel,
          efficiency,
          isFirst
        };
        prev = enriched;
        return enriched;
      });

      if (allLogs.length > 0) {
        const last = allLogs[allLogs.length - 1];
        document.getElementById('last-odometer-hint').textContent =
          `最新の記録: ${last.date} / ${formatNumber(last.odometer)} km`;
      } else {
        document.getElementById('last-odometer-hint').textContent =
          'まだ記録がありません。';
      }

      renderList();
      renderSummary();
      updatePreview();
    };
  }

  function updatePreview() {
    const card = document.getElementById('fuel-preview-card');
    if (allLogs.length === 0) { card.classList.remove('visible'); return; }
    const odo = parseFloat(document.getElementById('odometer').value);
    const fuelA = parseFloat(document.getElementById('fuelA').value) || 0;
    const fuelB = parseFloat(document.getElementById('fuelB').value) || 0;
    const totalFuel = fuelA + fuelB;
    if (!odo || totalFuel <= 0) {
      card.classList.remove('visible');
      return;
    }
    const sortBase = [...allLogs, {
      id: -1,
      date: document.getElementById('date').value || '',
      odometer: odo,
      fuelA, fuelB
    }];
    sortBase.sort((a, b) => {
      if (a.date === b.date) return (a.odometer || 0) - (b.odometer || 0);
      return a.date < b.date ? -1 : 1;
    });
    const idx = sortBase.findIndex(l => l.id === -1);
    if (idx <= 0) {
      card.classList.remove('visible');
      return;
    }
    const prev = sortBase[idx - 1];
    const dist = odo - (prev.odometer || 0);
    if (dist <= 0) {
      card.classList.remove('visible');
      return;
    }
    document.getElementById('preview-distance').textContent =
      formatNumber(dist);
    document.getElementById('preview-fuel').textContent =
      totalFuel.toFixed(2);
    document.getElementById('preview-efficiency').textContent =
      (dist / totalFuel).toFixed(2) + ' km/L';
    card.classList.add('visible');
  }

  function renderList() {
    const container = document.getElementById('logs-container');
    container.innerHTML = '';
    if (allLogs.length === 0) {
      container.innerHTML =
        '<p style="text-align:center; padding:2rem 0; color:#888;">まだデータがありません。</p>';
      return;
    }
    [...allLogs].slice().reverse().forEach(log => {
      const dateStr = log.date || '';
      const fuelText = log.totalFuel > 0 ? log.totalFuel.toFixed(2) : '-';
      const effText = log.isFirst || log.efficiency <= 0
        ? '-'
        : log.efficiency.toFixed(2);
      const distText = log.isFirst || log.distance <= 0
        ? '(初回)'
        : '+' + formatNumber(log.distance) + ' km';
      const memoText = [log.isAggregated ? '⚠️ 合算あり' : '', log.memo || '']
        .join(' ').trim();
      container.insertAdjacentHTML('beforeend', `
        <div class="log-card">
          <div class="log-header">
            <span class="log-date">${escapeHtml(dateStr)}</span>
            <div class="log-actions">
              <button class="btn btn-small" onclick="editLog(${log.id})">
                編集
              </button>
              <button class="btn btn-danger" onclick="deleteLog(${log.id})">
                削除
              </button>
            </div>
          </div>
          <div class="log-main-row">
            <div>
              <span style="font-size:0.8rem; color:#6b7280;">今回燃費</span><br>
              <span class="log-km">${effText}</span>
              <span style="font-size:0.85rem;">km/L</span>
            </div>
            <div style="text-align:right;">
              <span style="font-size:0.8rem; color:#6b7280;">走行距離</span><br>
              <span style="font-weight:600;">${distText}</span>
            </div>
          </div>
          <div class="log-details">
            <div class="log-stat-item">
              <span>積算距離</span>
              ${formatNumber(log.odometer)} km
            </div>
            <div class="log-stat-item">
              <span>給油合計</span>
              <span class="fuel-badge">${fuelText} L</span>
            </div>
          </div>
          ${memoText ? `<div class="log-footer">${escapeHtml(memoText)}</div>` : ''}
        </div>
      `);
    });
  }

  function editLog(id) {
    const log = allLogs.find(l => l.id === id);
    if (!log) return;
    editingId = id;
    document.getElementById('date').value = log.date;
    document.getElementById('odometer').value = log.odometer;
    document.getElementById('fuelA').value = log.fuelA || '';
    document.getElementById('fuelB').value = log.fuelB || '';
    document.getElementById('memo').value = log.memo || '';
    document.getElementById('submitButton').textContent = '✏️ 記録を更新する';
    switchTab('input');
    updatePreview();
  }

  function deleteLog(id) {
    if (!db) return;
    if (!confirm('この記録を削除しますか？')) return;
    const tx = db.transaction([STORE_NAME], 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => {
      showNotification('削除しました。');
      loadLogs();
    };
  }

  function deleteAllLogs() {
    if (!db) return;
    if (!confirm('本当に全データを削除しますか？')) return;
    const tx = db.transaction([STORE_NAME], 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => {
      allLogs = [];
      renderList();
      renderSummary();
      showNotification('全データを削除しました。');
    };
  }

  function renderSummary() {
    const month = document.getElementById('summaryMonth').value;
    const container = document.getElementById('summary-content');
    if (!month) return;
    const monthly = allLogs.filter(l => (l.date || '').startsWith(month));
    if (monthly.length === 0) {
      container.innerHTML =
        '<p style="text-align:center; padding:2rem 0; color:#888;">データなし</p>';
      return;
    }
    let dist = 0;
    let fuel = 0;
    monthly.forEach(l => {
      if (!l.isFirst && l.distance > 0 && l.totalFuel > 0) {
        dist += l.distance;
        fuel += l.totalFuel;
      }
    });
    const avg = dist > 0 && fuel > 0 ? (dist / fuel).toFixed(2) : '-';
    container.innerHTML = `
      <div class="summary-card">
        <div>月平均燃費</div>
        <div class="summary-main">
          ${avg} <span style="font-size:0.9rem;">km/L</span>
        </div>
        <div class="summary-sub">${month}</div>
        <div class="summary-grid">
          <div class="summary-box">
            <div>総走行距離</div>
            <div style="font-weight:600; font-size:1.1rem;">
              ${formatNumber(dist)} km
            </div>
          </div>
          <div class="summary-box">
            <div>総給油量</div>
            <div style="font-weight:600; font-size:1.1rem;">
              ${fuel.toFixed(2)} L
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document
      .querySelector(`.tab-btn[onclick*="${tab}"]`)
      .classList.add('active');
    document.querySelectorAll('.tab-content').forEach(v => {
      v.classList.add('hidden');
    });
    document.getElementById(`view-${tab}`).classList.remove('hidden');
    if (tab === 'list') renderList();
    if (tab === 'summary') renderSummary();
  }

  function toggleImportPanel() {
    const panel = document.getElementById('import-panel');
    panel.classList.toggle('hidden');
  }

  function importCSV() {
    const file = document.getElementById('csvFile').files[0];
    if (!file) {
      showNotification('CSVファイルを選んでください。');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => parseAndImport(e.target.result);
    reader.readAsText(file, 'UTF-8');
  }

  function parseAndImport(csv) {
    if (!db) return;
    const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    if (lines.length <= 1) {
      showNotification('有効なデータが見つかりません。');
      return;
    }

    const header = lines[0].split(',').map(cleanCell);
    let dateIdx = 0, odoIdx = 1, fuelIdx = 2, memoIdx = -1;

    header.forEach((name, i) => {
      if (/(日付|date)/i.test(name)) dateIdx = i;
      if (/(オド|距離|メータ|積算)/.test(name)) odoIdx = i;
      if (/(給油|燃料|合計燃料|L)/i.test(name)) fuelIdx = i;
      if (/(メモ|備考|note)/i.test(name)) memoIdx = i;
    });

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(cleanCell);
      if (!cols[dateIdx] && !cols[odoIdx]) continue;
      const date = cols[dateIdx].replace(/\./g, '-').replace(/\//g, '-');
      const odoStr = toHalfWidth(cols[odoIdx]).replace(/,/g, '');
      const fuelStr = toHalfWidth(cols[fuelIdx] || '').replace(/,/g, '');
      const odo = parseFloat(odoStr);
      const fuel = parseFloat(fuelStr);
      if (!date || isNaN(odo) || isNaN(fuel)) continue;
      records.push({
        date,
        odometer: odo,
        fuelA: fuel,
        fuelB: 0,
        memo: memoIdx >= 0 ? cols[memoIdx] : `CSV行${i + 1}`,
        timestamp: Date.now()
      });
    }
    if (records.length === 0) {
      showNotification('取り込める行がありませんでした。');
      return;
    }

    const existingKey = new Set(
      allLogs.map(l => `${l.date}|${l.odometer}`)
    );
    const toImport = records.filter(r =>
      !existingKey.has(`${r.date}|${r.odometer}`)
    );

    if (toImport.length === 0) {
      showNotification('新規データはありませんでした。');
      return;
    }

    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    toImport.forEach(r => store.add(r));
    tx.oncomplete = () => {
      showNotification(`${toImport.length}件インポートしました。`);
      document.getElementById('csvFile').value = '';
      loadLogs();
    };
  }

  function exportCSV() {
    if (allLogs.length === 0) {
      showNotification('データがありません。');
      return;
    }
    let csv =
      '日付,積算距離,走行距離,給油A,給油B,合計燃料,燃費,メモ\n';
    allLogs.forEach(l => {
      csv += [
        l.date,
        l.odometer,
        l.isFirst ? 0 : l.distance,
        (l.fuelA || 0).toFixed(2),
        (l.fuelB || 0).toFixed(2),
        (l.totalFuel || 0).toFixed(2),
        l.isFirst ? 0 : l.efficiency.toFixed(2),
        `"${(l.memo || '').replace(/"/g, '""')}"`
      ].join(',') + '\n';
    });
    const blob = new Blob(
      [new Uint8Array([0xEF, 0xBB, 0xBF]), csv],
      { type: 'text/csv' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'truck_log.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function showNotification(msg) {
    const el = document.getElementById('notification');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  function toHalfWidth(str) {
    return (str || '').replace(/[０-９．，]/g, ch => {
      const code = ch.charCodeAt(0);
      if (ch === '．') return '.';
      if (ch === '，') return ',';
      return String.fromCharCode(code - 0xFEE0);
    });
  }
  function cleanCell(c) {
    return c.replace(/^"|"$/g, '').trim();
  }
  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#039;'
    })[c]);
  }
  function formatNumber(n) {
    if (!n && n !== 0) return '';
    return Number(n).toLocaleString('ja-JP', { maximumFractionDigits: 1 });
  }
