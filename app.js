// ============ CONFIG PERSONALIZÁVEL ============
const TEAM_CONFIG = {
  LEC: {
    actions: [
      { key: 'gol',       label: 'GOL',        color: '#16a34a' }, // verde
      { key: 'escanteio', label: 'ESCANTEIO',  color: '#0ea5e9' }, // azul
      { key: 'falta',     label: 'FALTA',      color: '#f59e0b' }  // amarelo
    ],
    color: '#16a34a'
  },
  ADV: {
    actions: [
      { key: 'gol',       label: 'GOL',        color: '#ef4444' }, // vermelho
      { key: 'escanteio', label: 'ESCANTEIO',  color: '#8b5cf6' }, // roxo
      { key: 'falta',     label: 'FALTA',      color: '#f97316' }  // laranja
    ],
    color: '#ef4444'
  }
};

const CLIP_BACK_SECONDS = 25; // -25s
const CLIP_FWD_SECONDS  = 10; // +10s
// ==============================================

const state = {
  currentPeriod: '1°T',
  isRunning: true,
  timerSeconds: 0,
  intervalId: null,
  // contagens por equipe, tipo e zona/botão
  counts: {
    LEC: { finalizacao: initZones(), entrada: initZones(), actions: {} },
    ADV: { finalizacao: initZones(), entrada: initZones(), actions: {} }
  },
  // eventos completos para exportação XML
  events: []
};

function initZones(){
  const z = {};
  for (let i=1;i<=6;i++) z[i]=0;
  return z;
}

function pad(n){ return String(n).padStart(2,'0'); }
function mmssFrom(sec){
  const m = Math.floor(sec/60), s = sec%60;
  return `${pad(m)}:${pad(s)}`;
}
function nowISO(){ return new Date().toISOString(); }

function saveLocal(){
  localStorage.setItem('hud_state', JSON.stringify({
    currentPeriod: state.currentPeriod,
    isRunning: state.isRunning,
    timerSeconds: state.timerSeconds,
    counts: state.counts,
    events: state.events
  }));
}
function loadLocal(){
  const raw = localStorage.getItem('hud_state');
  if(!raw) return;
  try{
    const data = JSON.parse(raw);
    Object.assign(state, {
      currentPeriod: data.currentPeriod ?? '1°T',
      isRunning: data.isRunning ?? false,
      timerSeconds: data.timerSeconds ?? 0,
      counts: data.counts ?? state.counts,
      events: data.events ?? []
    });
  }catch(e){ console.warn('Falha ao carregar localStorage', e); }
}

function startTimer(){
  if(state.intervalId) return;
  state.isRunning = true;
  state.intervalId = setInterval(()=>{
    state.timerSeconds++;
    renderTimer();
  }, 1000);
  renderTimer();
  saveLocal();
}
function stopTimer(){
  if(state.intervalId){
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  state.isRunning = false;
  renderTimer();
  saveLocal();
}
function resetTimer(){
  stopTimer();
  state.timerSeconds = 0;
  renderTimer();
  saveLocal();
}

function setPeriod(p){ state.currentPeriod = p; renderTimer(); saveLocal(); }

function renderTimer(){
  document.getElementById('current-period').textContent = state.currentPeriod;
  document.getElementById('timer').textContent = mmssFrom(state.timerSeconds);
  document.getElementById('btn-toggle').textContent = state.isRunning ? 'Pausar' : 'Continuar';
}

function clampZero(n){ return n < 0 ? 0 : n; }

function registerEvent({team, type, zone=null, actionKey=null}){
  // contagem
  if(type === 'finalizacao' || type === 'entrada'){
    state.counts[team][type][zone] += 1;
  } else if(type === 'action' && actionKey){
    state.counts[team].actions[actionKey] = (state.counts[team].actions[actionKey]||0)+1;
  }

  // evento para XML
  const t = state.timerSeconds;
  const clipStart = clampZero(t - CLIP_BACK_SECONDS);
  const clipEnd   = t + CLIP_FWD_SECONDS;

  state.events.push({
    timestampISO: nowISO(),
    period: state.currentPeriod,
    timer: mmssFrom(t),
    timerSeconds: t,
    team,
    type,
    zone,
    actionKey,
    clipStartSec: clipStart,
    clipEndSec: clipEnd,
    clipStart: mmssFrom(clipStart),
    clipEnd: mmssFrom(clipEnd)
  });

  saveLocal();
}

function setupActions(){
  // Renderiza 3 botões por equipe a partir do TEAM_CONFIG
  ['LEC','ADV'].forEach(team=>{
    const container = document.getElementById(team === 'LEC' ? 'actions-lec' : 'actions-adv');
    container.innerHTML = '';
    TEAM_CONFIG[team].actions.forEach(cfg=>{
      // inicializa contador
      if(state.counts[team].actions[cfg.key] == null) state.counts[team].actions[cfg.key] = 0;

      const btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.style.background = cfg.color;

      btn.innerHTML = `
        <span class="label">${cfg.label}</span>
        <span class="counter" data-team="${team}" data-key="${cfg.key}">${state.counts[team].actions[cfg.key]}</span>
      `;

      btn.addEventListener('click', ()=>{
        if(!state.isRunning) return;
        registerEvent({team, type:'action', actionKey: cfg.key});
        // atualiza contador visual
        const counter = btn.querySelector('.counter');
        counter.textContent = state.counts[team].actions[cfg.key];
      });

      container.appendChild(btn);
    });
  });
}

function setupZones(){
  // Anexa listeners aos 24 botões de zona (12 por equipe)
  document.querySelectorAll('.zone-grid').forEach(grid=>{
    const team = grid.dataset.team; // 'LEC' ou 'ADV'
    const type = grid.dataset.type; // 'finalizacao' ou 'entrada'
    grid.querySelectorAll('.zone').forEach(btn=>{
      const zone = Number(btn.dataset.zone);
      // desenha contagem inicial
      const countSpan = btn.querySelector('.count');
      countSpan.textContent = state.counts[team][type][zone];

      btn.addEventListener('click', ()=>{
        if(!state.isRunning) return;
        registerEvent({team, type, zone});
        countSpan.textContent = state.counts[team][type][zone];
      });
    });
  });
}

function exportCSV(){
  // CSV com contadores agregados por equipe/evento/zone-OU-ação
  const rows = [];
  rows.push(['team','event','category','id','count']);
  ['LEC','ADV'].forEach(team=>{
    // Finalizações por zona 1..6
    for(let z=1; z<=6; z++){
      rows.push([team, 'finalizacao', 'zona', String(z), String(state.counts[team].finalizacao[z])]);
    }
    // Entradas por zona 1..6
    for(let z=1; z<=6; z++){
      rows.push([team, 'entrada', 'zona', String(z), String(state.counts[team].entrada[z])]);
    }
    // Ações
    const actions = TEAM_CONFIG[team].actions;
    actions.forEach(a=>{
      rows.push([team, 'action', 'botao', a.key, String(state.counts[team].actions[a.key]||0)]);
    });
  });

  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `juega10_counts_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportXML(){
  // XML com todos os eventos e faixas de clip
  const esc = (s)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<match>\n`;
  xml += `  <meta>\n`;
  xml += `    <generatedAt>${esc(nowISO())}</generatedAt>\n`;
  xml += `    <period>${esc(state.currentPeriod)}</period>\n`;
  xml += `  </meta>\n`;
  xml += `  <events>\n`;

  state.events.forEach((ev, idx)=>{
    xml += `    <event id="${idx+1}" team="${esc(ev.team)}" type="${esc(ev.type)}"${ev.zone?` zone="${ev.zone}"`:''}${ev.actionKey?` actionKey="${esc(ev.actionKey)}"`:''} period="${esc(ev.period)}">\n`;
    xml += `      <timestampISO>${esc(ev.timestampISO)}</timestampISO>\n`;
    xml += `      <timer>${esc(ev.timer)}</timer>\n`;
    xml += `      <clip startSec="${ev.clipStartSec}" endSec="${ev.clipEndSec}" start="${esc(ev.clipStart)}" end="${esc(ev.clipEnd)}" />\n`;
    xml += `    </event>\n`;
  });

  xml += `  </events>\n</match>`;

  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `juega10_events_${new Date().toISOString().slice(0,10)}.xml`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function clearData(){
  if(!confirm('Limpar dados locais (contagens e eventos)?')) return;
  state.currentPeriod = '1°T';
  state.isRunning = false;
  state.timerSeconds = 0;
  state.counts = {
    LEC: { finalizacao: initZones(), entrada: initZones(), actions: {} },
    ADV: { finalizacao: initZones(), entrada: initZones(), actions: {} }
  };
  state.events = [];
  stopTimer();
  renderTimer();
  // zera contadores na UI
  document.querySelectorAll('.zone .count').forEach(el=>el.textContent='0');
  document.querySelectorAll('.action-btn .counter').forEach(el=>el.textContent='0');
  saveLocal();
}

function bindTopBar(){
  document.getElementById('btn-inicio-1t').addEventListener('click', ()=>{ setPeriod('1°T'); state.timerSeconds=0; startTimer(); });
  document.getElementById('btn-final-1t').addEventListener('click', ()=>{ setPeriod('1°T'); stopTimer(); });
  document.getElementById('btn-inicio-2t').addEventListener('click', ()=>{ setPeriod('2°T'); state.timerSeconds=0; startTimer(); });
  document.getElementById('btn-final-2t').addEventListener('click', ()=>{ setPeriod('2°T'); stopTimer(); });
  document.getElementById('btn-toggle').addEventListener('click', ()=>{ state.isRunning ? stopTimer() : startTimer(); });
  document.getElementById('btn-reset').addEventListener('click', resetTimer);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-export-xml').addEventListener('click', exportXML);
  document.getElementById('btn-clear').addEventListener('click', clearData);
}

// Inicialização
loadLocal();
window.addEventListener('DOMContentLoaded', ()=>{
  renderTimer();
  setupActions();
  setupZones();
  bindTopBar();
  if(state.isRunning){ startTimer(); }
  else { // inicia automaticamente na primeira execução
    if(state.timerSeconds === 0 && state.events.length===0){
      startTimer();
    }
  }
});
