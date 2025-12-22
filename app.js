// ====== Estado do Cronômetro ======
let isRunning = false;
let startEpoch = 0;     // performance.now() quando iniciou/retomou
let elapsedMs = 0;      // milissegundos acumulados quando pausado
let rafId = null;       // ID da animação para o requestAnimationFrame

const timerDisplay = document.getElementById('timerDisplay');
const btnToggleTimer = document.getElementById('btnToggleTimer');
const btnResetTimer = document.getElementById('btnResetTimer');

// ====== Funções do Cronômetro ======
function formatTimeMMSS(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getCurrentTimeSeconds() {
  const currentMs = isRunning ? (elapsedMs + (performance.now() - startEpoch)) : elapsedMs;
  return Math.max(0, currentMs / 1000); // Garante que nunca seja negativo
}

function updateTimerDisplay() {
  timerDisplay.textContent = formatTimeMMSS(elapsedMs + (isRunning ? (performance.now() - startEpoch) : 0));
}

function tick() {
  if (!isRunning) return;
  updateTimerDisplay();
  rafId = requestAnimationFrame(tick);
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  startEpoch = performance.now();
  btnToggleTimer.textContent = 'Pausar';
  tick(); // Inicia o loop de atualização do timer
}

function pauseTimer() {
  if (!isRunning) return;
  isRunning = false;
  elapsedMs += performance.now() - startEpoch; // Acumula o tempo corrido
  btnToggleTimer.textContent = 'Retomar';
  if (rafId) cancelAnimationFrame(rafId); // Para o loop de atualização
  updateTimerDisplay(); // Atualiza display uma última vez
}

function resetTimer() {
  isRunning = false;
  elapsedMs = 0;
  btnToggleTimer.textContent = 'Iniciar';
  if (rafId) cancelAnimationFrame(rafId);
  timerDisplay.textContent = '00:00'; // Reseta display
  // TODO: Se desejar, adicione aqui o reset de todos os contadores de evento e a lista 'events'.
  // Por enquanto, o reset do timer não afeta os eventos já marcados.
}

// ====== Listeners dos Controles do Cronômetro ======
btnToggleTimer.addEventListener('click', () => {
  if (!isRunning && elapsedMs === 0) { // Primeira vez que inicia
    startTimer();
  } else if (isRunning) { // Já está rodando, então pausa
    pauseTimer();
  } else { // Não está rodando, mas tem tempo acumulado, então retoma
    startTimer();
  }
});

btnResetTimer.addEventListener('click', resetTimer);

// ====== Gestão de Eventos e Contadores ======
let eventIdCounter = 0; // Para gerar IDs únicos para o XML

const allEventCodes = [
  'FIN_LEC', 'ESC_OF_LEC', 'FALTA_OF_LEC', 'ENT_LEC_ESQ', 'ENT_LEC_CTR', 'ENT_LEC_DIR',
  'FIN_ADV', 'ESC_DEF_ADV', 'FALTA_DEF_ADV', 'ENT_ADV_ESQ', 'ENT_ADV_CTR', 'ENT_ADV_DIR'
];

const eventCounts = {}; // Armazena a contagem de cada evento {code: count}
const recordedEvents = []; // Armazena todos os eventos registrados para exportação XML

// Inicializa todos os contadores a zero na memória
allEventCodes.forEach(code => { eventCounts[code] = 0; });

// Função para registrar um clique de evento
function recordEventClick(code) {
  if (!isRunning) {
    alert('Por favor, inicie o cronômetro antes de registrar eventos.');
    return;
  }

  // Atualiza contador na memória e no display
  eventCounts[code]++;
  const badge = document.querySelector(`[data-counter="${code}"]`);
  if (badge) badge.textContent = eventCounts[code];

  // Gera o evento para o XML
  const currentTimeSec = getCurrentTimeSeconds();
  const clipStartSec = Math.max(0, currentTimeSec - 25); // clipStart = t - 25s, mínimo 0
  const clipEndSec = currentTimeSec + 10;                // clipEnd = t + 10s

  recordedEvents.push({
    id: eventIdCounter++,
    code: code,
    start: clipStartSec,
    end: clipEndSec
  });

  // Feedback tátil (se suportado)
  try { window.navigator.vibrate && window.navigator.vibrate(50); } catch (e) {}
}

// ====== Listeners dos Botões de Evento ======
document.querySelectorAll('.event-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const code = btn.dataset.code;
    recordEventClick(code);
  });
});

// ====== Funções de Exportação ======
const btnExportXML = document.getElementById('btnExportXML');

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgbToLiveTagProColor(rgb) {
  return Math.round(rgb / 255 * 65535);
}

// Definições de cores e sort_order para a seção <ROWS> do XML
const rowDefinitions = [
  { code: 'FIN_LEC',        sort_order: 1,  color: '#4caf50' }, // Verde finalização
  { code: 'ESC_OF_LEC',     sort_order: 2,  color: '#2196f3' }, // Azul esc of
  { code: 'FALTA_OF_LEC',   sort_order: 3,  color: '#f44336' }, // Vermelho falta of
  { code: 'ENT_LEC_ESQ',    sort_order: 4,  color: '#9c27b0' }, // Roxo esq
  { code: 'ENT_LEC_CTR',    sort_order: 5,  color: '#ffeb3b' }, // Amarelo ctr
  { code: 'ENT_LEC_DIR',    sort_order: 6,  color: '#795548' }, // Marrom dir

  { code: 'FIN_ADV',        sort_order: 7,  color: '#4caf50' },
  { code: 'ESC_DEF_ADV',    sort_order: 8,  color: '#2196f3' },
  { code: 'FALTA_DEF_ADV',  sort_order: 9,  color: '#f44336' },
  { code: 'ENT_ADV_ESQ',    sort_order: 10, color: '#9c27b0' },
  { code: 'ENT_ADV_CTR',    sort_order: 11, color: '#ffeb3b' },
  { code: 'ENT_ADV_DIR',    sort_order: 12, color: '#795548' },
];


function buildLiveTagProXml() {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<file>\n`;
  xml += `    <!--Generated by Juega10 Tagger Pro-->\n`;
  xml += `    <SORT_INFO>\n`;
  xml += `        <sort_type>sort order</sort_type>\n`;
  xml += `    </SORT_INFO>\n`;
  xml += `    <ALL_INSTANCES>\n`;

  recordedEvents.forEach(event => {
    xml += `        <instance>\n`;
    xml += `            <ID>${event.id}</ID>\n`;
    xml += `            <code>${escapeXml(event.code)}</code>\n`;
    xml += `            <start>${event.start.toFixed(6)}</start>\n`;
    xml += `            <end>${event.end.toFixed(6)}</end>\n`;
    // Mantendo apenas a label do tipo Event, como simplificado
    xml += `            <label>\n`;
    xml += `                <group>Event</group>\n`;
    xml += `                <text>${escapeXml(event.code)}</text>\n`;
    xml += `            </label>\n`;
    xml += `        </instance>\n`;
  });

  xml += `    </ALL_INSTANCES>\n`;
  xml += `    <ROWS>\n`;

  rowDefinitions.forEach(row => {
    const rgb = hexToRgb(row.color);
    const R = rgbToLiveTagProColor(rgb.r);
    const G = rgbToLiveTagProColor(rgb.g);
    const B = rgbToLiveTagProColor(rgb.b);
    xml += `        <row>\n`;
    xml += `            <sort_order>${row.sort_order}</sort_order>\n`;
    xml += `            <code>${escapeXml(row.code)}</code>\n`;
    xml += `            <R>${R}</R>\n`;
    xml += `            <G>${G}</G>\n`;
    xml += `            <B>${B}</B>\n`;
    xml += `        </row>\n`;
  });

  xml += `    </ROWS>\n`;
  xml += `</file>\n`;
  return xml;
}

btnExportXML.addEventListener('click', () => {
  const xmlContent = buildLiveTagProXml();
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
  const downloadLink = document.createElement('a');
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = `juega10_events_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xml`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(downloadLink.href);
});


// ====== Inicialização da UI ======
window.addEventListener('load', () => {
  updateTimerDisplay(); // Garante que o timer mostra 00:00 ao carregar
  // Preenche os badges com os valores iniciais (0)
  document.querySelectorAll('.count-badge').forEach(badge => {
    badge.textContent = '0';
  });
});
