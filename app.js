// ======= Configuração =======
const TAGS = [
  { key: 'recuperacao', label: 'Recuperação', colorClass: 'tag-1' },
  { key: 'finalizacao', label: 'Finalização', colorClass: 'tag-2' },
  { key: 'bola_parada', label: 'Bola parada', colorClass: 'tag-3' },
  { key: 'gol', label: 'Gol ⭐', colorClass: 'tag-4' }
];

// ======= Estado =======
let startTime = null;
let elapsedMs = 0;
let intervalId = null;
let running = true; // relógio contínuo
let counters = {};  // {key: number}
let matchId = null;

// ======= Elementos =======
const timerDisplay = document.getElementById('timerDisplay');
const toggleBtn = document.getElementById('toggleBtn');
const resetBtn = document.getElementById('resetBtn');
const tagsGrid = document.getElementById('tagsGrid');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportXmlBtn = document.getElementById('exportXmlBtn');
const statusMsg = document.getElementById('statusMsg');

// ======= Util =======
function two(n) { return n.toString().padStart(2, '0'); }
function formatMMSS(ms) {
  const totalSec = Math.floor(ms / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${two(mm)}:${two(ss)}`;
}
function nowIso() { return new Date().toISOString(); }

// ======= Persistência local =======
const STORE_KEY = 'hud-timer-state-v2';
function saveState() {
  const data = {
    elapsedMs,
    running,
    counters,
    matchId,
    savedAt: nowIso()
  };
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}
function loadState() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    elapsedMs = data.elapsedMs || 0;
    running = data.running ?? true;
    counters = data.counters || {};
    matchId = data.matchId || null;
  } catch {}
}

// ======= Timer =======
function tick() {
  const now = Date.now();
  elapsedMs += now - startTime;
  startTime = now;
  timerDisplay.textContent = formatMMSS(elapsedMs);
}
function startTimer() {
  if (intervalId) return;
  startTime = Date.now();
  intervalId = setInterval(tick, 250);
  toggleBtn.textContent = 'Pausar';
  running = true;
  saveState();
}
function stopTimer() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
  toggleBtn.textContent = 'Continuar';
  running = false;
  saveState();
}
function resetTimerAndCounts(confirmar = true) {
  const ok = confirmar ? confirm('Zerar cronômetro e contadores?') : true;
  if (!ok) return;
  stopTimer();
  elapsedMs = 0;
  Object.keys(counters).forEach(k => counters[k] = 0);
  updateAllCounts();
  timerDisplay.textContent = formatMMSS(0);
  running = true;
  startTimer();
  status('Zerado.');
  saveState();
}

// ======= Tags / UI =======
function ensureCounters() {
  TAGS.forEach(t => { if (typeof counters[t.key] !== 'number') counters[t.key] = 0; });
}
function createTagButton(tag, idx) {
  const btn = document.createElement('button');
  btn.className = `tag-btn tag-${idx+1}`;
  btn.dataset.key = tag.key;
  btn.setAttribute('aria-label', `${tag.label}`);
  btn.innerHTML = `
    <span class="label">${tag.label}</span>
    <span class="count" id="count-${tag.key}">0</span>
  `;
  btn.addEventListener('click', () => {
    counters[tag.key] = (counters[tag.key] || 0) + 1;
    updateCount(tag.key);
    haptic();
    saveState();
  });
  return btn;
}
function updateCount(key) {
  const el = document.getElementById(`count-${key}`);
  if (el) el.textContent = counters[key] || 0;
}
function updateAllCounts() {
  TAGS.forEach(t => updateCount(t.key));
}
function buildButtons() {
  tagsGrid.innerHTML = '';
  TAGS.forEach((t, i) => {
    const btn = createTagButton(t, i);
    tagsGrid.appendChild(btn);
  });
}

// Haptic feedback (limitado no iOS, mas tentamos)
function haptic() {
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }
}

// ======= Exportação =======
function exportCSV() {
  // CSV simples: tag,count
  const header = 'tag,count';
  const lines = TAGS.map(t => `${sanitizeCsv(t.label)},${counters[t.key] || 0}`);
  const csv = [header, ...lines].join('\n');

  downloadText(csv, `stats-${stamp()}.csv`, 'text/csv');
  status('CSV exportado.');
}
function sanitizeCsv(s) {
  // Envolver em aspas se necessário
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function exportXML() {
  // XML agregado: <tag name="..." count="..."/>
  const startedAt = matchId || nowIso();
  const durationSec = Math.floor(elapsedMs / 1000);

  let xml = '';
  xml += '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<stats generatedAt="${nowIso()}">\n`;
  xml += `  <match startedAt="${startedAt}" durationSeconds="${durationSec}">\n`;
  TAGS.forEach(t => {
    const c = counters[t.key] || 0;
    xml += `    <tag name="${escapeXml(t.label)}" key="${t.key}" count="${c}" />\n`;
  });
  xml += '  </match>\n';
  xml += '</stats>\n';

  downloadText(xml, `stats-${stamp()}.xml`, 'application/xml');
  status('XML exportado.');
}
function escapeXml(s) {
  return s.replace(/&/g,'&amp;')
          .replace(/</g,'&lt;')
          .replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;')
          .replace(/'/g,'&apos;');
}

function stamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}${m}${day}-${hh}${mm}${ss}`;
}

function downloadText(content, filename, mime) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ======= Status UI =======
let statusTimeout = null;
function status(msg) {
  if (!statusMsg) return;
  statusMsg.textContent = msg;
  clearTimeout(statusTimeout);
  statusTimeout = setTimeout(() => statusMsg.textContent = '', 3000);
}

// ======= Controles =======
toggleBtn.addEventListener('click', () => {
  if (running) stopTimer(); else startTimer();
});
resetBtn.addEventListener('click', () => resetTimerAndCounts(true));
exportCsvBtn.addEventListener('click', exportCSV);
exportXmlBtn.addEventListener('click', exportXML);

// ======= Boot =======
(function init() {
  loadState();
  ensureCounters();
  buildButtons();
  updateAllCounts();
  timerDisplay.textContent = formatMMSS(elapsedMs);
  if (running) startTimer();
  if (!matchId) matchId = nowIso();
  saveState();
})();
