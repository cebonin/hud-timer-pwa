// ======================================================
// FutTag Pro - app.js v2.1
// Developed by Carlos Bonin
// ======================================================

// ==================== APLICATIVO DE ESTADO ====================
const appState = {
  score: {
    lec: 0,
    adv: 0
  },
  currentHalf: 1, // 1 ou 2
  timer: {
    isRunning: false,
    startEpoch: 0,
    elapsedMs: 0,
    rafId: null
  },
  events: [],      // Armazena todos os eventos registrados
  eventCounts: {   // Contagem atual de cada tipo de evento
    total: {},     // Contadores totais
    half1: {},     // Contadores do 1° tempo
    half2: {}      // Contadores do 2° tempo
  },
  lastAction: null
};

// ==================== SELETORES DE DOM ====================
const timerDisplay = document.getElementById('timerDisplay');
const scoreLecDisplay = document.getElementById('scoreLec');
const scoreAdvDisplay = document.getElementById('scoreAdv');
const currentHalfDisplay = document.getElementById('currentHalfDisplay');

const btnToggleTimer = document.getElementById('btnToggleTimer');
const btnResetAll = document.getElementById('btnResetAll');
const btnUndo = document.getElementById('btnUndo');
const btnShowStats = document.getElementById('btnShowStats');

const statsModal = document.getElementById('statsModal');
const closeButton = document.querySelector('.modal .close-button');
const btnGeneratePDF = document.getElementById('btnGeneratePDF');
const btnExportXML = document.getElementById('btnExportXML');

// Summary elements
const finSummary = document.getElementById('finSummary');
const entSummary = document.getElementById('entSummary');
const escSummary = document.getElementById('escSummary');
const faltaSummary = document.getElementById('faltaSummary');

// ==================== DEFINIÇÕES DE EVENTOS ====================
const ALL_EVENT_CODES = [
  'FIN_LEC_ESQ', 'FIN_LEC_CTR', 'FIN_LEC_DIR',
  'ENT_LEC_ESQ', 'ENT_LEC_CTR', 'ENT_LEC_DIR',
  'GOL_LEC', 'ESC_OF_LEC', 'FALTA_OF_LEC',

  'FIN_ADV_ESQ', 'FIN_ADV_CTR', 'FIN_ADV_DIR',
  'ENT_ADV_ESQ', 'ENT_ADV_CTR', 'ENT_ADV_DIR',
  'GOL_ADV', 'ESC_DEF_ADV', 'FALTA_DEF_ADV'
];

// ==================== FUNÇÕES UTILITÁRIAS ====================
function formatTimeMMSS(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getCurrentTimeSeconds() {
  const currentMs = appState.timer.isRunning ?
    (appState.timer.elapsedMs + (performance.now() - appState.timer.startEpoch)) :
    appState.timer.elapsedMs;
  return Math.max(0, currentMs / 1000);
}

function updateUI() {
  // Atualiza placar
  scoreLecDisplay.textContent = appState.score.lec;
  scoreAdvDisplay.textContent = appState.score.adv;

  // Atualiza contadores dos badges
  document.querySelectorAll('.count-badge').forEach(badge => {
    const code = badge.dataset.counter;
    badge.textContent = appState.eventCounts.total[code] || 0;
  });

  // Atualiza display de tempo de jogo
  currentHalfDisplay.textContent = `${appState.currentHalf}°T`;

  // Atualiza botões de half
  document.querySelectorAll('.half-btn').forEach(btn => {
    const half = parseInt(btn.dataset.half);
    btn.classList.remove('active');
    if (half === appState.currentHalf) {
      btn.classList.add('active');
    }
  });

  // Atualiza o texto do botão Iniciar/Pausar
  if (appState.timer.isRunning) {
    btnToggleTimer.textContent = 'Pausar';
  } else {
    btnToggleTimer.textContent = appState.timer.elapsedMs === 0 ? 'Iniciar' : 'Retomar';
  }

  // Desabilita Undo se não há eventos
  btnUndo.disabled = appState.events.length === 0;
  
  // Atualiza summary no modal se estiver visível
  updateStatsSummary();
}

function updateStatsSummary() {
  if (!finSummary) return;
  
  const counts = appState.eventCounts.total;
  
  // Finalizações
  const lecFins = (counts['FIN_LEC_ESQ'] || 0) + (counts['FIN_LEC_CTR'] || 0) + (counts['FIN_LEC_DIR'] || 0);
  const advFins = (counts['FIN_ADV_ESQ'] || 0) + (counts['FIN_ADV_CTR'] || 0) + (counts['FIN_ADV_DIR'] || 0);
  finSummary.textContent = `LEC: ${lecFins} | ADV: ${advFins}`;
  
  // Entradas
  const lecEnts = (counts['ENT_LEC_ESQ'] || 0) + (counts['ENT_LEC_CTR'] || 0) + (counts['ENT_LEC_DIR'] || 0);
  const advEnts = (counts['ENT_ADV_ESQ'] || 0) + (counts['ENT_ADV_CTR'] || 0) + (counts['ENT_ADV_DIR'] || 0);
  entSummary.textContent = `LEC: ${lecEnts} | ADV: ${advEnts}`;
  
  // Escanteios
  const lecEscs = counts['ESC_OF_LEC'] || 0;
  const advEscs = counts['ESC_DEF_ADV'] || 0;
  escSummary.textContent = `LEC: ${lecEscs} | ADV: ${advEscs}`;
  
  // Faltas
  const lecFaltas = counts['FALTA_OF_LEC'] || 0;
  const advFaltas = counts['FALTA_DEF_ADV'] || 0;
  faltaSummary.textContent = `LEC: ${lecFaltas} | ADV: ${advFaltas}`;
}

function triggerHapticFeedback() {
  try { window.navigator.vibrate && window.navigator.vibrate(50); } catch (e) {}
}

// ==================== FUNÇÕES DO CRONÔMETRO ====================
function updateTimerDisplay() {
  timerDisplay.textContent = formatTimeMMSS(appState.timer.elapsedMs + (appState.timer.isRunning ? (performance.now() - appState.timer.startEpoch) : 0));
}

function tick() {
  if (!appState.timer.isRunning) return;
  updateTimerDisplay();
  appState.timer.rafId = requestAnimationFrame(tick);
}

function startTimer() {
  if (appState.timer.isRunning) return;
  appState.timer.isRunning = true;
  appState.timer.startEpoch = performance.now();
  updateUI();
  tick();
}

function pauseTimer() {
  if (!appState.timer.isRunning) return;
  appState.timer.isRunning = false;
  appState.timer.elapsedMs += performance.now() - appState.timer.startEpoch;
  if (appState.timer.rafId) cancelAnimationFrame(appState.timer.rafId);
  updateTimerDisplay();
  updateUI();
}

function resetTimer() {
  pauseTimer();
  appState.timer.elapsedMs = 0;
  appState.timer.startEpoch = 0;
  updateTimerDisplay();
  updateUI();
}

// ==================== GERENCIAMENTO DE TEMPOS ====================
function handleHalfControl(half, action) {
  triggerHapticFeedback();
  if (action === 'start') {
    if (appState.currentHalf !== half) {
      pauseTimer();
      resetTimer();
      appState.currentHalf = half;
      appState.events.push({
        type: 'HALF_START',
        half: half,
        timestamp: new Date().toISOString(),
        timeInGameSeconds: getCurrentTimeSeconds(),
        previousState: { timer: { ...appState.timer } }
      });
      startTimer();
    } else if (!appState.timer.isRunning) {
      startTimer();
    }
  } else if (action === 'end') {
    if (appState.currentHalf === half && appState.timer.isRunning) {
      pauseTimer();
      appState.events.push({
        type: 'HALF_END',
        half: half,
        timestamp: new Date().toISOString(),
        timeInGameSeconds: getCurrentTimeSeconds(),
        previousState: { timer: { ...appState.timer } }
      });
    }
  }
  updateUI();
}

// ==================== GERENCIAMENTO DE EVENTOS ====================
function initializeEventCounts() {
  ['total', 'half1', 'half2'].forEach(period => {
    appState.eventCounts[period] = {};
    ALL_EVENT_CODES.forEach(code => {
      appState.eventCounts[period][code] = 0;
    });
  });
}

function recordEventClick(code) {
  if (!appState.timer.isRunning) {
    alert('Por favor, inicie o cronômetro antes de registrar eventos.');
    return;
  }
  triggerHapticFeedback();

  const currentTimeSec = getCurrentTimeSeconds();
  const currentHalf = appState.currentHalf;

  // Salva estado anterior
  const previousCounts = JSON.parse(JSON.stringify(appState.eventCounts));
  const previousScore = { ...appState.score };

  // Atualiza contadores
  appState.eventCounts.total[code] = (appState.eventCounts.total[code] || 0) + 1;
  appState.eventCounts[`half${currentHalf}`][code] = (appState.eventCounts[`half${currentHalf}`][code] || 0) + 1;

  // Lógica para gols
  if (code === 'GOL_LEC') {
    appState.score.lec++;
  } else if (code === 'GOL_ADV') {
    appState.score.adv++;
  }

  // Registra o evento
  const clipStartSec = Math.max(0, currentTimeSec - 25);
  const clipEndSec = currentTimeSec + 10;

  appState.events.push({
    id: appState.events.length,
    type: 'EVENT',
    code: code,
    half: currentHalf,
    timestamp: new Date().toISOString(),
    timeInGameSeconds: currentTimeSec,
    start: clipStartSec,
    end: clipEndSec,
    previousCounts: previousCounts,
    previousScore: previousScore
  });

  updateUI();
}

function undoLastAction() {
  triggerHapticFeedback();

  if (appState.events.length === 0) {
    console.warn('Nenhum evento para desfazer.');
    return;
  }

  const lastEvent = appState.events.pop();

  if (lastEvent.type === 'EVENT') {
    appState.eventCounts = lastEvent.previousCounts;
    appState.score = lastEvent.previousScore;
  } else if (lastEvent.type === 'HALF_START' || lastEvent.type === 'HALF_END') {
    appState.timer = lastEvent.previousState.timer;
    appState.currentHalf = lastEvent.half;
    if(appState.timer.isRunning) {
      startTimer();
    } else {
      if (appState.timer.rafId) cancelAnimationFrame(appState.timer.rafId);
    }
  }

  updateUI();
  updateTimerDisplay();
}

function resetAll() {
  if (!confirm('Tem certeza que deseja zerar TUDO (placar, cronômetro e eventos)?')) {
    return;
  }
  triggerHapticFeedback();

  appState.score = { lec: 0, adv: 0 };
  appState.currentHalf = 1;
  appState.timer = {
    isRunning: false,
    startEpoch: 0,
    elapsedMs: 0,
    rafId: null
  };
  appState.events = [];
  
  initializeEventCounts();
  resetTimer();
  updateUI();
}

// ==================== GERAÇÃO DE GRÁFICOS PARA PDF ====================
let chartsInstances = {};

function createChartForPDF(canvasId, title, data, chartType = 'bar') {
  const ctx = document.getElementById(canvasId).getContext('2d');
  
  // Destroi gráfico anterior se existir
  if (chartsInstances[canvasId]) {
    chartsInstances[canvasId].destroy();
  }

  const config = {
    type: chartType,
    data: data,
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: false // Remove título do plugin para evitar duplicação
        },
        legend: {
          display: true,
          position: 'top',
          labels: { 
            color: '#e0e0f0',
            font: { size: 14, weight: 'bold' },
            padding: 20
          }
        }
      },
      scales: chartType === 'bar' ? {
        y: {
          beginAtZero: true,
          stacked: chartType === 'bar' && data.datasets.length > 1,
          ticks: { 
            color: '#e0e0f0', 
            stepSize: 1,
            font: { size: 12, weight: 'bold' }
          },
          grid: { color: 'rgba(224, 224, 240, 0.1)' }
        },
        x: {
          stacked: chartType === 'bar' && data.datasets.length > 1,
          ticks: { 
            color: '#e0e0f0',
            font: { size: 12, weight: 'bold' }
          },
          grid: { color: 'rgba(224, 224, 240, 0.1)' }
        }
      } : {},
      elements: {
        bar: {
          borderWidth: 2
        }
      }
    },
    plugins: [{
      id: 'customDataLabels',
      afterDatasetsDraw: function(chart) {
        const ctx = chart.ctx;
        ctx.fillStyle = '#000000'; // Cor preta
        ctx.font = 'bold 14px Arial'; // Negrito e tamanho maior
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        chart.data.datasets.forEach((dataset, i) => {
          const meta = chart.getDatasetMeta(i);
          if (meta.hidden) return;
          
          meta.data.forEach((element, index) => {
            const data = dataset.data[index];
            if (data > 0) {
              // Para gráficos empilhados, ajusta a posição vertical
              let yPos = element.y;
              if (chart.options.scales.y.stacked && i > 0) {
                // Se é uma barra empilhada e não é o primeiro dataset
                yPos = element.y - (element.height / 2);
              }
              ctx.fillText(data, element.x, yPos);
            }
          });
        });
      }
    }]
  };

  chartsInstances[canvasId] = new Chart(ctx, config);
  return chartsInstances[canvasId];
}

function generateAllCharts() {
  const lecColor = '#00bcd4';
  const advColor = '#ff9800';

  // Helper function para obter dados por período
  function getDataByPeriod(codes, period) {
    const counts = appState.eventCounts[period];
    return codes.map(code => counts[code] || 0);
  }

  // 1. FINALIZAÇÕES (3 gráficos)
  const finCodes = ['FIN_LEC_ESQ', 'FIN_LEC_CTR', 'FIN_LEC_DIR', 'FIN_ADV_ESQ', 'FIN_ADV_CTR', 'FIN_ADV_DIR'];
  const finLabels = ['LEC E', 'LEC C', 'LEC D', 'ADV E', 'ADV C', 'ADV D'];
  const finColors = [lecColor, lecColor, lecColor, advColor, advColor, advColor];

  const finalizacoesData = {
    labels: finLabels,
    datasets: [{
      label: 'Finalizações',
      data: [],
      backgroundColor: finColors,
      borderColor: finColors,
      borderWidth: 2
    }]
  };

  // Finalizações 1° Tempo
  finalizacoesData.datasets[0].data = getDataByPeriod(finCodes, 'half1');
  createChartForPDF('fin1TChart', 'Finalizações - 1° Tempo', JSON.parse(JSON.stringify(finalizacoesData)));

  // Finalizações 2° Tempo
  finalizacoesData.datasets[0].data = getDataByPeriod(finCodes, 'half2');
  createChartForPDF('fin2TChart', 'Finalizações - 2° Tempo', JSON.parse(JSON.stringify(finalizacoesData)));

  // Finalizações Total
  finalizacoesData.datasets[0].data = getDataByPeriod(finCodes, 'total');
  createChartForPDF('finTotalChart', 'Finalizações - Total da Partida', JSON.parse(JSON.stringify(finalizacoesData)));

  // 2. ENTRADAS NO ÚLTIMO TERÇO (3 gráficos)
  const entCodes = ['ENT_LEC_ESQ', 'ENT_LEC_CTR', 'ENT_LEC_DIR', 'ENT_ADV_ESQ', 'ENT_ADV_CTR', 'ENT_ADV_DIR'];
  const entLabels = ['LEC E', 'LEC C', 'LEC D', 'ADV E', 'ADV C', 'ADV D'];

  const entradasData = {
    labels: entLabels,
    datasets: [{
      label: 'Entradas no Último Terço',
      data: [],
      backgroundColor: finColors,
      borderColor: finColors,
      borderWidth: 2
    }]
  };

  // Entradas 1° Tempo
  entradasData.datasets[0].data = getDataByPeriod(entCodes, 'half1');
  createChartForPDF('ent1TChart', 'Entradas no Último Terço - 1° Tempo', JSON.parse(JSON.stringify(entradasData)));

  // Entradas 2° Tempo
  entradasData.datasets[0].data = getDataByPeriod(entCodes, 'half2');
  createChartForPDF('ent2TChart', 'Entradas no Último Terço - 2° Tempo', JSON.parse(JSON.stringify(entradasData)));

  // Entradas Total
  entradasData.datasets[0].data = getDataByPeriod(entCodes, 'total');
  createChartForPDF('entTotalChart', 'Entradas no Último Terço - Total da Partida', JSON.parse(JSON.stringify(entradasData)));

  // 3. ESCANTEIOS E FALTAS LATERAIS (3 gráficos empilhados)
  const escFaltaLabels = ['LEC', 'ADV'];
  const escCodes = ['ESC_OF_LEC', 'ESC_DEF_ADV'];
  const faltaCodes = ['FALTA_OF_LEC', 'FALTA_DEF_ADV'];

  function createEscFaltaData(period) {
    return {
      labels: escFaltaLabels,
      datasets: [
        {
          label: 'Escanteios',
          data: getDataByPeriod(escCodes, period),
          backgroundColor: '#2196f3',
          borderColor: '#1976d2',
          borderWidth: 2
        },
        {
          label: 'Faltas Laterais',
          data: getDataByPeriod(faltaCodes, period),
          backgroundColor: '#f44336',
          borderColor: '#d32f2f',
          borderWidth: 2
        }
      ]
    };
  }

  // Escanteios e Faltas 1° Tempo
  createChartForPDF('escFalta1TChart', 'Escanteios e Faltas Laterais - 1° Tempo', createEscFaltaData('half1'));

  // Escanteios e Faltas 2° Tempo
  createChartForPDF('escFalta2TChart', 'Escanteios e Faltas Laterais - 2° Tempo', createEscFaltaData('half2'));

  // Escanteios e Faltas Total
  createChartForPDF('escFaltaTotalChart', 'Escanteios e Faltas Laterais - Total da Partida', createEscFaltaData('total'));
}

// ==================== GERAÇÃO DE PDF ====================
async function generatePDFReport() {
  try {
    triggerHapticFeedback();
    
    // Gera todos os gráficos
    generateAllCharts();
    
    // Aguarda um pouco para os gráficos renderizarem
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait, milimetros, A4
    
    const chartWidth = 180;
    const chartHeight = 120;
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    
    // PÁGINA 1: FINALIZAÇÕES
    pdf.setFontSize(20);
    pdf.setTextColor(0, 188, 212);
    pdf.text('ESTATÍSTICAS DO JOGO', pageWidth/2, 25, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Placar: LEC ${appState.score.lec} x ${appState.score.adv} ADV`, pageWidth/2, 35, { align: 'center' });
    pdf.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth/2, 42, { align: 'center' });
    
    // Título da seção
    pdf.setFontSize(16);
    pdf.setTextColor(76, 175, 80);
    pdf.text('FINALIZAÇÕES', pageWidth/2, 55, { align: 'center' });
    
    // Gráficos de Finalizações
    const finCharts = ['fin1TChart', 'fin2TChart', 'finTotalChart'];
    const finTitles = ['1° Tempo', '2° Tempo', 'Total da Partida'];
    
    for (let i = 0; i < finCharts.length; i++) {
      const canvas = document.getElementById(finCharts[i]);
      if (canvas) {
        const canvasImg = canvas.toDataURL('image/png', 1.0);
        
        let yPos = 70 + (i * 75); // Espaçamento vertical
        
        // Título do gráfico
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        pdf.text(finTitles[i], pageWidth/2, yPos - 5, { align: 'center' });
        
        // Imagem do gráfico
        pdf.addImage(canvasImg, 'PNG', margin, yPos, chartWidth, 60);
      }
    }
    
    // PÁGINA 2: ENTRADAS NO ÚLTIMO TERÇO
    pdf.addPage();
    
    pdf.setFontSize(16);
    pdf.setTextColor(156, 39, 176);
    pdf.text('ENTRADAS NO ÚLTIMO TERÇO', pageWidth/2, 25, { align: 'center' });
    
    const entCharts = ['ent1TChart', 'ent2TChart', 'entTotalChart'];
    const entTitles = ['1° Tempo', '2° Tempo', 'Total da Partida'];
    
    for (let i = 0; i < entCharts.length; i++) {
      const canvas = document.getElementById(entCharts[i]);
      if (canvas) {
        const canvasImg = canvas.toDataURL('image/png', 1.0);
        
        let yPos = 40 + (i * 75);
        
        // Título do gráfico
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        pdf.text(entTitles[i], pageWidth/2, yPos - 5, { align: 'center' });
        
        // Imagem do gráfico
        pdf.addImage(canvasImg, 'PNG', margin, yPos, chartWidth, 60);
      }
    }
    
        // PÁGINA 3: ESCANTEIOS E FALTAS LATERAIS
    pdf.addPage();
    
    pdf.setFontSize(16);
    pdf.setTextColor(33, 150, 243);
    pdf.text('ESCANTEIOS E FALTAS LATERAIS', pageWidth/2, 25, { align: 'center' });
    
    const escFaltaCharts = ['escFalta1TChart', 'escFalta2TChart', 'escFaltaTotalChart'];
    const escFaltaTitles = ['1° Tempo', '2° Tempo', 'Total da Partida'];
    
    for (let i = 0; i < escFaltaCharts.length; i++) {
      const canvas = document.getElementById(escFaltaCharts[i]);
      if (canvas) {
        const canvasImg = canvas.toDataURL('image/png', 1.0);
        
        let yPos = 40 + (i * 75);
        
        // Título do gráfico
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        pdf.text(escFaltaTitles[i], pageWidth/2, yPos - 5, { align: 'center' });
        
        // Imagem do gráfico
        pdf.addImage(canvasImg, 'PNG', margin, yPos, chartWidth, 60);
      }
    }
    
    // Salva o PDF
    const filename = `futtag_estatisticas_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`;
    pdf.save(filename);
    
    // Limpa os gráficos
    Object.values(chartsInstances).forEach(chart => {
      if (chart) chart.destroy();
    });
    chartsInstances = {};
    
    alert('📄 Relatório PDF gerado com sucesso! 3 páginas organizadas por categoria.');
    
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    alert('❌ Erro ao gerar o relatório PDF. Tente novamente.');
  }
}

// ==================== FUNÇÕES DE EXPORTAÇÃO XML ====================
function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgbToLiveTagProColor(rgbVal) {
  return Math.round(rgbVal / 255 * 65535);
}

const rowDefinitions = [
  // LEC
  { code: 'FIN_LEC_ESQ', sort_order: 1, color: '#4caf50', label: 'FIN_LEC_ESQ' },
  { code: 'FIN_LEC_CTR', sort_order: 2, color: '#66bb6a', label: 'FIN_LEC_CTR' },
  { code: 'FIN_LEC_DIR', sort_order: 3, color: '#81c784', label: 'FIN_LEC_DIR' },
  { code: 'ENT_LEC_ESQ', sort_order: 4, color: '#9c27b0', label: 'ENT_LEC_ESQ' },
  { code: 'ENT_LEC_CTR', sort_order: 5, color: '#ab47bc', label: 'ENT_LEC_CTR' },
  { code: 'ENT_LEC_DIR', sort_order: 6, color: '#ba68c8', label: 'ENT_LEC_DIR' },
  { code: 'GOL_LEC', sort_order: 7, color: '#e91e63', label: 'GOL_LEC' },
  { code: 'ESC_OF_LEC', sort_order: 8, color: '#2196f3', label: 'ESC_OF_LEC' },
  { code: 'FALTA_OF_LEC', sort_order: 9, color: '#f44336', label: 'FALTA_OF_LEC' },

  // ADV
  { code: 'FIN_ADV_ESQ', sort_order: 10, color: '#ff9800', label: 'FIN_ADV_ESQ' },
  { code: 'FIN_ADV_CTR', sort_order: 11, color: '#ffa726', label: 'FIN_ADV_CTR' },
  { code: 'FIN_ADV_DIR', sort_order: 12, color: '#ffb74d', label: 'FIN_ADV_DIR' },
  { code: 'ENT_ADV_ESQ', sort_order: 13, color: '#795548', label: 'ENT_ADV_ESQ' },
  { code: 'ENT_ADV_CTR', sort_order: 14, color: '#8d6e63', label: 'ENT_ADV_CTR' },
  { code: 'ENT_ADV_DIR', sort_order: 15, color: '#a1887f', label: 'ENT_ADV_DIR' },
  { code: 'GOL_ADV', sort_order: 16, color: '#e91e63', label: 'GOL_ADV' },
  { code: 'ESC_DEF_ADV', sort_order: 17, color: '#2196f3', label: 'ESC_DEF_ADV' },
  { code: 'FALTA_DEF_ADV', sort_order: 18, color: '#f44336', label: 'FALTA_DEF_ADV' },
];

function buildLiveTagProXml() {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<file>\n`;
  xml += `    <!--Generated by FutTag Pro-->\n`;
  xml += `    <SORT_INFO>\n`;
  xml += `        <sort_type>sort order</sort_type>\n`;
  xml += `    </SORT_INFO>\n`;
  xml += `    <ALL_INSTANCES>\n`;

  const eventInstances = appState.events.filter(event => event.type === 'EVENT');

  eventInstances.forEach(event => {
    xml += `        <instance>\n`;
    xml += `            <ID>${event.id}</ID>\n`;
    xml += `            <code>${escapeXml(event.code)}</code>\n`;
    xml += `            <start>${event.start.toFixed(6)}</start>\n`;
    xml += `            <end>${event.end.toFixed(6)}</end>\n`;
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

function exportXML() {
  triggerHapticFeedback();
  const xmlContent = buildLiveTagProXml();
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
  const downloadLink = document.createElement('a');
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = `futtag_events_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xml`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(downloadLink.href);
}

// ==================== FUNÇÕES DE MODAL ====================
function showStatsModal() {
  triggerHapticFeedback();
  updateStatsSummary();
  statsModal.style.display = 'block';
}

function hideStatsModal() {
  statsModal.style.display = 'none';
  
  // Limpa os gráficos para liberar memória
  Object.values(chartsInstances).forEach(chart => {
    if (chart) chart.destroy();
  });
  chartsInstances = {};
}

// ==================== EVENT LISTENERS ====================

// Cronômetro
btnToggleTimer.addEventListener('click', () => {
  if (!appState.timer.isRunning && appState.timer.elapsedMs === 0) {
    startTimer();
  } else if (appState.timer.isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
});

// Controles principais
btnResetAll.addEventListener('click', resetAll);
btnUndo.addEventListener('click', undoLastAction);
btnShowStats.addEventListener('click', showStatsModal);

// Controles de metade
document.querySelectorAll('.half-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const half = parseInt(btn.dataset.half);
    const action = btn.dataset.action;
    handleHalfControl(half, action);
  });
});

// Botões de eventos
document.querySelectorAll('.event-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const code = btn.dataset.code;
    if (code) {
      recordEventClick(code);
    }
  });
});

// Modal de estatísticas
closeButton.addEventListener('click', hideStatsModal);
window.addEventListener('click', (event) => {
  if (event.target === statsModal) {
    hideStatsModal();
  }
});

// Exportações
btnGeneratePDF.addEventListener('click', generatePDFReport);
btnExportXML.addEventListener('click', exportXML);

// ==================== INICIALIZAÇÃO ====================
function initializeApp() {
  // Inicializa contadores
  initializeEventCounts();

  // Atualiza UI inicial
  updateUI();
  updateTimerDisplay();

  console.log('🚀 FutTag Pro v2.1 inicializado com sucesso!');
  console.log('📊 Relatório PDF: 3 páginas organizadas por categoria');
  console.log('📱 Layout otimizado para mobile');
  console.log('🎯 Gráficos com legendas corrigidas e rótulos em preto');
}

// Inicializa quando a página carrega
window.addEventListener('load', initializeApp);

// Previne zoom acidental em iOS
document.addEventListener('gesturestart', function (e) {
  e.preventDefault();
});

// Previne seleção de texto em botões
document.addEventListener('selectstart', function (e) {
  if (e.target.closest('.btn')) {
    e.preventDefault();
  }
});

// Previne scroll bounce no iOS
document.addEventListener('touchmove', function(e) {
  if (e.target.closest('.modal-content')) {
    // Permite scroll no modal
    return;
  }
  e.preventDefault();
}, { passive: false });