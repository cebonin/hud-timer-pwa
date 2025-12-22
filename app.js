// ======= Estado do cronômetro =======
let isRunning = false;
let startEpoch = 0;     // ms timestamp quando iniciou/retomou
let elapsedMs = 0;      // acumulado quando pausado
let rafId = null;

const timerDisplay = document.getElementById('timerDisplay');
const btnToggleTimer = document.getElementById('btnToggleTimer');
const btnResetTimer = document.getElementById('btnResetTimer');

function formatMMSS(ms){
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}
function currentSeconds(){
  const ms = isRunning ? (elapsedMs + (Date.now() - startEpoch)) : elapsedMs;
  return Math.max(0, ms / 1000);
}
function tick(){
  if (!isRunning) return;
  timerDisplay.textContent = formatMMSS(elapsedMs + (Date.now() - startEpoch));
  rafId = requestAnimationFrame(tick);
}
function startTimer(){
  if (isRunning) return;
  startEpoch = Date.now();
  isRunning = true;
  btnToggleTimer.textContent = 'Pausar';
  tick();
}
function pauseTimer(){
  if (!isRunning) return;
  elapsedMs += Date.now() - startEpoch;
  isRunning = false;
  btnToggleTimer.textContent = 'Retomar';
  if (rafId) cancelAnimationFrame(rafId);
  timerDisplay.textContent = formatMMSS(elapsedMs);
}
function resetTimer(){
  isRunning = false;
  elapsedMs = 0;
  btnToggleTimer.textContent = 'Iniciar';
  if (rafId) cancelAnimationFrame(rafId);
  timerDisplay.textContent = '00:00';
}

// Botão único: Iniciar → Pausar → Retomar
btnToggleTimer.addEventListener('click', () => {
  if (!isRunning && elapsedMs === 0) { startTimer(); return; }
  if (isRunning) { pauseTimer(); return; }
  if (!isRunning && elapsedMs > 0) { startTimer(); return; }
});
btnResetTimer.addEventListener('click', resetTimer);

// ======= Eventos e contadores =======
const counts = Object.create(null);
const events = [];

// Mapa de códigos (ajustável conforme seu software)
// LEC
const CODES = [
  'FIN LEC', 'ESC OF', 'FALTA OF', 'ENT LEC ESQ', 'ENT LEC CEN', 'ENT LEC DIR',
  // ADV
  'FIN ADV', 'ESC DEF', 'FALTA DEF', 'ENT ADV ESQ', 'ENT ADV CEN', 'ENT ADV DIR'
];

// Inicializar contadores na interface
CODES.forEach(code => {
  counts[code] = 0;
  const badge = document.getElementById(`count-${code}`);
  if (badge) badge.textContent = '0';
});

// Handler genérico
function onEventClick(code){
  // Atualiza contador
  counts[code] = (counts[code] || 0) + 1;
  const badge = document.getElementById(`count-${code}`);
  if (badge) badge.textContent = String(counts[code]);

  // Marca tempo atual e janela [-25, +10]
  const t = currentSeconds();
  const t1 = Math.max(0, round2(t - 25));
  const t2 = round2(t + 10);

  events.push({
    code,
    tClick: round2(t),
    t1,
    t2
  });

  // Feedback tátil (se suportado)
  try { window.navigator.vibrate && window.navigator.vibrate(10); } catch(e){}
}
function round2(x){ return Math.round(x * 100) / 100; }

// Conectar todos os botões .btn.event
document.querySelectorAll('.btn.event').forEach(btn => {
  const code = btn.getAttribute('data-code');
  btn.addEventListener('click', () => onEventClick(code));
});

// ======= Exportações =======

// CSV: uma linha por código com o total
document.getElementById('btnExportCSV').addEventListener('click', () => {
  const header = ['code','count'];
  const lines = [header.join(',')];
  CODES.forEach(code => {
    lines.push(`${escapeCsv(code)},${counts[code] || 0}`);
  });
  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  downloadBlob(blob, `tags_${dateStamp()}_counts.csv`);
});

function escapeCsv(s){
  if (s.includes(',') || s.includes('"') || s.includes('\n')){
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// XML: eventos com t1 = t-25, t2 = t+10 e tabela ROWS (sort_order + cores)
document.getElementById('btnExportXML').addEventListener('click', () => {
  const xmlString = buildXML(events);
  const blob = new Blob([xmlString], {type:'application/xml;charset=utf-8;'});
  downloadBlob(blob, `tags_${dateStamp()}.xml`);
});

// Ajuste aqui os códigos e cores para <ROWS>.
// As cores são em 0..65535 (conversão feita a partir de hex 0..255)
const ROW_DEFS = [
  // sort_order, code, hex color
  [1, 'FIN LEC',  '#0d6efd'],
  [2, 'ESC OF',   '#6c757d'],
  [3, 'FALTA OF', '#ef4444'],
  [4, 'ENT LEC ESQ', '#22c55e'],
  [5, 'ENT LEC CEN', '#a855f7'],
  [6, 'ENT LEC DIR', '#f59e0b'],

  [7,  'FIN ADV',  '#0d6efd'],
  [8,  'ESC DEF',  '#6c757d'],
  [9,  'FALTA DEF','#ef4444'],
  [10, 'ENT ADV ESQ', '#22c55e'],
  [11, 'ENT ADV CEN', '#a855f7'],
  [12, 'ENT ADV DIR', '#f59e0b'],
];

// Constrói XML no formato compatível (ajustável se precisar de campos extras)
function buildXML(evts){
  const rowsXml = ROW_DEFS.map(([order, code, hex]) => {
    const {R,G,B} = hexTo65535(hex);
    return [
      '    <row>',
      `      <sort_order>${order}</sort_order>`,
      `      <code>${escapeXml(code)}</code>`,
      `      <R>${R}</R>`,
      `      <G>${G}</G>`,
      `      <B>${B}</B>`,
      '    </row>'
    ].join('\n');
  }).join('\n');

  const eventsXml = evts.map(e => {
    return [
      '    <event>',
      `      <code>${escapeXml(e.code)}</code>`,
      `      <t1>${e.t1.toFixed(2)}</t1>`,
      `      <t2>${e.t2.toFixed(2)}</t2>`,
      '    </event>'
    ].join('\n');
  }).join('\n');

  // Se o seu software exigir <SORT_INFO> com outros campos, me envie o XML completo.
  return [
    '<file>',
    '  <!--Generated by Juega10 Tagger-->',
    '  <SORT_INFO>',
    '    <note>Custom layout Bonin</note>',
    '  </SORT_INFO>',
    '  <EVENTS>',
         eventsXml || '    <!-- no events -->',
    '  </EVENTS>',
    '  <ROWS>',
         rowsXml,
    '  </ROWS>',
    '</file>'
  ].join('\n');
}

function hexTo65535(hex){
  const c = hex.replace('#','');
  const r = parseInt(c.slice(0,2),16);
  const g = parseInt(c.slice(2,4),16);
  const b = parseInt(c.slice(4,6),16);
  const R = Math.round(r / 255 * 65535);
  const G = Math.round(g / 255 * 65535);
  const B = Math.round(b / 255 * 65535);
  return {R,G,B};
}

function dateStamp(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const hh = String(d.getHours()).padStart(2,'0');
  const mi = String(d.getMinutes()).padStart(2,'0');
  const ss = String(d.getSeconds()).padStart(2,'0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}
