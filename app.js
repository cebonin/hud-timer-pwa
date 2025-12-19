// ====== CONFIGURAÇÕES ======
const CLIP_BEFORE = 25; // segundos antes
const CLIP_AFTER = 10;  // segundos depois

// IDs e rótulos para CSV e contadores
const GRID_IDS = ["1","2","3","4","5","6"];
const ACTION_IDS = [
  { id:"GOL", label:"Gol" },
  { id:"ESC", label:"Escanteio" },
  { id:"FAL", label:"Falta" }
];

const TEAMS = ["LEC","ADV"];

// ====== ESTADO ======
let isRunning = false;
let startEpoch = 0;     // ms (Date.now()) quando iniciou/retomou
let elapsedMs = 0;      // ms acumulados quando pausado
let rafHandle = null;

const counts = {
  LEC: { finalizacoes: initGridCounts(), ultimo_terco: initGridCounts(), acao: initActionCounts() },
  ADV: { finalizacoes: initGridCounts(), ultimo_terco: initGridCounts(), acao: initActionCounts() }
};

// Eventos brutos para exportar XML
const events = []; // {team,category,id,label,timeSec,clipStart,clipEnd,createdAtISO}

function initGridCounts(){
  // retorna {F1:0..F6:0} ou {E1:0..E6:0} conforme uso
  return {};
}
function initActionCounts(){
  // {GOL:0, ESC:0, FAL:0}
  const obj = {};
  ACTION_IDS.forEach(a => obj[a.id] = 0);
  return obj;
}

// ====== INICIALIZAÇÃO ======
document.addEventListener("DOMContentLoaded", () => {
  // Criar mapas F1..F6 e E1..E6 dinamicamente
  GRID_IDS.forEach((n) => {
    counts.LEC.finalizacoes["F"+n] = 0;
    counts.LEC.ultimo_terco["E"+n] = 0;
    counts.ADV.finalizacoes["F"+n] = 0;
    counts.ADV.ultimo_terco["E"+n] = 0;
  });

  wireTimer();
  wireButtons();
  registerServiceWorker();
});

function wireTimer(){
  const display = document.getElementById("timerDisplay");
  const btnStartPause = document.getElementById("btnStartPause");
  const btnReset = document.getElementById("btnReset");

  updateTimerDisplay(display, 0);

  btnStartPause.addEventListener("click", () => {
    if(!isRunning){
      // iniciar/retomar
      isRunning = true;
      startEpoch = Date.now() - elapsedMs;
      btnStartPause.textContent = elapsedMs > 0 ? "PAUSAR" : "PAUSAR";
      loop(display);
    }else{
      // pausar
      isRunning = false;
      elapsedMs = Date.now() - startEpoch;
      btnStartPause.textContent = "RETOMAR";
      if(rafHandle) cancelAnimationFrame(rafHandle);
    }
  });

  btnReset.addEventListener("click", () => {
    isRunning = false;
    elapsedMs = 0;
    startEpoch = 0;
    if(rafHandle) cancelAnimationFrame(rafHandle);
    updateTimerDisplay(display, 0);
    btnStartPause.textContent = "INICIAR";

    // opcional: resetar contadores e eventos? Não. Zera só o relógio.
    // Se quiser zerar também contadores/eventos, descomente:
    // resetAllCountsAndEvents();
  });
}

function loop(display){
  if(!isRunning) return;
  const now = Date.now();
  const ms = now - startEpoch;
  updateTimerDisplay(display, ms);
  rafHandle = requestAnimationFrame(() => loop(display));
}

function updateTimerDisplay(el, ms){
  const totalSec = Math.floor(ms/1000);
  const m = Math.floor(totalSec/60);
  const s = totalSec % 60;
  el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ====== CLICK HANDLERS ======
function wireButtons(){
  // Todos os botões do tabuleiro (finalizações e último terço)
  document.querySelectorAll(".cell-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const team = btn.dataset.team;
      const category = btn.dataset.category; // "finalizacoes" | "ultimo_terco"
      const id = btn.dataset.id;             // "F1"..F6 | "E1"..E6
      const label = labelFor(category, id);

      incrementCounter(team, category, id);
      stampEvent(team, category, id, label);
      flash(btn);
    });
  });

  // Botões de ação (3 por equipe)
  document.querySelectorAll(".action-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const team = btn.dataset.team;
      const category = btn.dataset.category; // "acao"
      const id = btn.dataset.id;             // "GOL" | "ESC" | "FAL"
      const label = labelFor(category, id);

      incrementCounter(team, category, id);
      stampEvent(team, category, id, label);
      flash(btn);
    });
  });

  // Exportações
  document.getElementById("btnExportCSV").addEventListener("click", exportCSV);
  document.getElementById("btnExportXML").addEventListener("click", exportXML);
}

function labelFor(category,id){
  if(category === "finalizacoes") return `Finalizações ${id}`;
  if(category === "ultimo_terco") return `Entradas Últ. Terço ${id}`;
  if(category === "acao"){
    const found = ACTION_IDS.find(a => a.id === id);
    return found ? found.label : id;
  }
  return id;
}

function getCurrentTimeSeconds(){
  if(isRunning){
    return (Date.now() - startEpoch) / 1000;
  }else{
    return elapsedMs / 1000;
  }
}

function incrementCounter(team, category, id){
  if(category === "finalizacoes" || category === "ultimo_terco"){
    counts[team][category][id] = (counts[team][category][id] || 0) + 1;
    const badgeId = `${team}_${category}_${id}`;
    const badgeEl = document.getElementById(badgeId);
    if(badgeEl) badgeEl.textContent = counts[team][category][id];
  }else if(category === "acao"){
    counts[team][category][id] = (counts[team][category][id] || 0) + 1;
    const badgeId = `${team}_${category}_${id}`;
    const badgeEl = document.getElementById(badgeId);
    if(badgeEl) badgeEl.textContent = counts[team][category][id];
  }
}

function stampEvent(team, category, id, label){
  const t = getCurrentTimeSeconds();
  const clipStart = Math.max(0, t - CLIP_BEFORE);
  const clipEnd = t + CLIP_AFTER;
  const createdAtISO = new Date().toISOString();

  events.push({ team, category, id, label, timeSec: round1(t), clipStart: round1(clipStart), clipEnd: round1(clipEnd), createdAt: createdAtISO });
}

function round1(x){ return Math.round(x*10)/10; }

function flash(el){
  el.classList.add("flash");
  setTimeout(()=> el.classList.remove("flash"), 150);
}

// ====== EXPORTS ======
function exportCSV(){
  // CSV como contador por evento (alto e direto)
  // Colunas: team,category,id,label,count
  const lines = [];
  lines.push(["team","category","id","label","count"].join(","));

  TEAMS.forEach(team => {
    // finalizacoes F1..F6
    GRID_IDS.forEach(n => {
      const id = "F"+n;
      const count = counts[team].finalizacoes[id] || 0;
      lines.push([team,"finalizacoes",id,labelFor("finalizacoes",id),count].join(","));
    });
    // ultimo_terco E1..E6
    GRID_IDS.forEach(n => {
      const id = "E"+n;
      const count = counts[team].ultimo_terco[id] || 0;
      lines.push([team,"ultimo_terco",id,labelFor("ultimo_terco",id),count].join(","));
    });
    // acoes
    ACTION_IDS.forEach(a => {
      const id = a.id;
      const count = counts[team].acao[id] || 0;
      lines.push([team,"acao",id,labelFor("acao",id),count].join(","));
    });
  });

  const csv = lines.join("\n");
  downloadFile(csv, `contadores_lec_adv_${dateStamp()}.csv`, "text/csv");
}

function exportXML(){
  // XML de eventos brutos com clipStart/clipEnd
  const parts = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(`<events matchClockFormat="seconds" clipBefore="${CLIP_BEFORE}" clipAfter="${CLIP_AFTER}">`);

  events.forEach((e, idx) => {
    parts.push(`  <event index="${idx+1}" team="${e.team}" category="${e.category}" id="${e.id}">`);
    parts.push(`    <label>${escapeXml(e.label)}</label>`);
    parts.push(`    <time>${e.timeSec}</time>`);
    parts.push(`    <clipStart>${e.clipStart}</clipStart>`);
    parts.push(`    <clipEnd>${e.clipEnd}</clipEnd>`);
    parts.push(`    <createdAt>${e.createdAt}</createdAt>`);
    parts.push(`  </event>`);
  });

  parts.push(`</events>`);
  const xml = parts.join("\n");
  downloadFile(xml, `eventos_lec_adv_${dateStamp()}.xml`, "application/xml");
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

function downloadFile(content, filename, mime){
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

function escapeXml(unsafe){
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ====== SW REGISTRATION ======
function registerServiceWorker(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js')
      .catch(err => console.log('SW registration failed', err));
  }
}

// ====== OPCIONAL: reset total ======
function resetAllCountsAndEvents(){
  ["LEC","ADV"].forEach(team => {
    GRID_IDS.forEach(n => {
      counts[team].finalizacoes["F"+n]=0;
      counts[team].ultimo_terco["E"+n]=0;
      updateBadge(`${team}_finalizacoes_F${n}`,0);
      updateBadge(`${team}_ultimo_terco_E${n}`,0);
    });
    ACTION_IDS.forEach(a => {
      counts[team].acao[a.id]=0;
      updateBadge(`${team}_acao_${a.id}`,0);
    });
  });
  events.length = 0;
}
function updateBadge(id,val){
  const el = document.getElementById(id);
  if(el) el.textContent = val;
}
