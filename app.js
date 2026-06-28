/* =========================================================
   PAINEL DO MOTORISTA — app.js
   Tudo roda local (localStorage). Nenhum dado sai do celular,
   exceto quando você escolhe exportar.
   ========================================================= */

const STORAGE_KEY = 'pdm_data_v1';

const DEFAULT_APPS = [
  { id: 'uber', nome: 'Uber', cor: '#5FD068', ativo: true },
  { id: 'noventaenove', nome: '99', cor: '#FFD23F', ativo: true },
  { id: 'indriver', nome: 'InDriver', cor: '#5BA7E8', ativo: true },
  { id: 'particular', nome: 'Particular', cor: '#B084E8', ativo: true },
];

const DEFAULT_CATEGORIAS = [
  'Combustível', 'Manutenção', 'Seguro', 'Aluguel do carro',
  'Lavagem', 'Alimentação', 'Pedágio/Estacionamento', 'Outros'
];

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function todayISO(){
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ console.error('Falha ao ler dados salvos', e); }
  return {
    apps: DEFAULT_APPS.map(a => ({...a})),
    categorias: [...DEFAULT_CATEGORIAS],
    ganhos: [],   // {id, data, porApp:[{appId, valor, km, corridas}], kmReal, horas}
    despesas: [], // {id, data, categoria, valor, obs, fixaId?}
    despesasFixas: [], // {id, categoria, valor, descricao, mesInicio:'YYYY-MM', ativa}
  };
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
if(!state.despesasFixas) state.despesasFixas = [];

// garante que apps/categorias novos do código apareçam em dados antigos
DEFAULT_APPS.forEach(def => {
  if(!state.apps.find(a => a.id === def.id)) state.apps.push({...def});
});
if(!state.categorias || !state.categorias.length) state.categorias = [...DEFAULT_CATEGORIAS];

/* =========================================================
   DESPESAS FIXAS (recorrentes): seguro, IPVA, manutenção, parcela...
   Cadastradas uma vez, geram automaticamente um lançamento de despesa
   em cada mês a partir do mês de início escolhido. Cada lançamento
   gerado guarda fixaId — editar/excluir aquele mês não afeta os outros.
   ========================================================= */
function mesAtualStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function mesStrDe(dataISO){
  return dataISO.slice(0,7); // 'YYYY-MM'
}
function listaMesesEntre(mesIni, mesFim){
  const [yi,mi] = mesIni.split('-').map(Number);
  const [yf,mf] = mesFim.split('-').map(Number);
  const out = [];
  let y = yi, m = mi;
  while(y < yf || (y===yf && m<=mf)){
    out.push(`${y}-${String(m).padStart(2,'0')}`);
    m++; if(m>12){ m=1; y++; }
  }
  return out;
}

function materializarDespesasFixas(){
  const hoje = mesAtualStr();
  let mudou = false;
  (state.despesasFixas||[]).filter(f => f.ativa).forEach(fixa => {
    if(!fixa.mesInicio || fixa.mesInicio > hoje) return;
    const meses = listaMesesEntre(fixa.mesInicio, hoje);
    const existentes = new Set(
      state.despesas.filter(d => d.fixaId === fixa.id).map(d => mesStrDe(d.data))
    );
    meses.forEach(mes => {
      if(existentes.has(mes)) return;
      // dia 1 do mês como data padrão do lançamento automático
      const dataLanc = `${mes}-01`;
      state.despesas.push({
        id: uid(),
        data: dataLanc,
        categoria: fixa.categoria,
        valor: fixa.valor,
        obs: fixa.descricao || '',
        fixaId: fixa.id,
      });
      mudou = true;
    });
  });
  if(mudou) saveState();
}
materializarDespesasFixas();

/* ===== Helpers de formatação ===== */
function brl(v){
  v = Number(v) || 0;
  return v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}
function num(v, dec=1){
  v = Number(v) || 0;
  return v.toLocaleString('pt-BR', { minimumFractionDigits:dec, maximumFractionDigits:dec });
}
function parseDateLocal(iso){
  const [y,m,d] = iso.split('-').map(Number);
  return new Date(y, m-1, d);
}
function isoWeek(dateObj){
  const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(),0,4));
  const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay()+6)%7)) / 7);
  return { year: d.getUTCFullYear(), week };
}

function toast(msg, success=false){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (success ? ' success' : '');
  clearTimeout(el._t);
  el._t = setTimeout(()=> el.classList.remove('show'), 2200);
}

/* ===== Confirm sheet ===== */
function confirmSheet(title, msg, onConfirm){
  const backdrop = document.getElementById('confirm-backdrop');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  backdrop.classList.add('open');
  const ok = document.getElementById('confirm-ok');
  const cancel = document.getElementById('confirm-cancel');
  const close = () => backdrop.classList.remove('open');
  ok.onclick = () => { close(); onConfirm(); };
  cancel.onclick = close;
  backdrop.onclick = (e) => { if(e.target === backdrop) close(); };
}

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}

/* =========================================================
   NAVEGAÇÃO ENTRE TELAS
   ========================================================= */
const TOPBAR_TITLES = {
  painel: { eyebrow: 'Painel', title: 'Visão geral' },
  lancar: { eyebrow: 'Novo', title: 'Lançar' },
  graficos: { eyebrow: 'Análise', title: 'Gráficos' },
  config: { eyebrow: 'Ajustes', title: 'Configurações' },
};

function goToScreen(name){
  materializarDespesasFixas();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  document.querySelectorAll('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
  const t = TOPBAR_TITLES[name];
  document.getElementById('topbar-eyebrow').textContent = t.eyebrow;
  document.getElementById('topbar-title').textContent = t.title;
  if(name === 'painel') renderPainel();
  if(name === 'lancar') renderLancar();
  if(name === 'graficos') renderGraficos();
  if(name === 'config') renderConfig();
}

document.querySelectorAll('.navbtn').forEach(btn => {
  btn.addEventListener('click', () => goToScreen(btn.dataset.screen));
});

/* =========================================================
   ESTADO DE PERÍODO (para a tela Painel)
   ========================================================= */
let periodoAtual = { tipo: 'mensal', ref: new Date() };

document.querySelectorAll('#period-tabs .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#period-tabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    periodoAtual.tipo = tab.dataset.period;
    renderPainel();
  });
});
document.getElementById('period-prev').addEventListener('click', () => shiftPeriodo(-1));
document.getElementById('period-next').addEventListener('click', () => shiftPeriodo(1));

function shiftPeriodo(dir){
  const d = new Date(periodoAtual.ref);
  if(periodoAtual.tipo === 'diaria') d.setDate(d.getDate() + dir);
  else if(periodoAtual.tipo === 'semanal') d.setDate(d.getDate() + dir*7);
  else if(periodoAtual.tipo === 'mensal') d.setMonth(d.getMonth() + dir);
  else if(periodoAtual.tipo === 'anual') d.setFullYear(d.getFullYear() + dir);
  periodoAtual.ref = d;
  renderPainel();
}

function getPeriodRange(tipo, ref){
  const d = new Date(ref);
  if(tipo === 'diaria'){
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59);
    return { start, end };
  }
  if(tipo === 'semanal'){
    const dow = (d.getDay() + 6) % 7; // segunda=0
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate()+6, 23,59,59);
    return { start, end };
  }
  if(tipo === 'mensal'){
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59);
    return { start, end };
  }
  const start = new Date(d.getFullYear(), 0, 1);
  const end = new Date(d.getFullYear(), 11, 31, 23,59,59);
  return { start, end };
}

function periodLabel(tipo, ref){
  const { start, end } = getPeriodRange(tipo, ref);
  if(tipo === 'diaria') return start.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
  if(tipo === 'semanal') return `${start.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} – ${end.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})}`;
  if(tipo === 'mensal') return start.toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
  return String(start.getFullYear());
}

/* =========================================================
   AGREGAÇÃO DE DADOS
   ========================================================= */
function ganhosNoPeriodo(start, end){
  return state.ganhos.filter(g => {
    const d = parseDateLocal(g.data);
    return d >= start && d <= end;
  });
}
function despesasNoPeriodo(start, end){
  return state.despesas.filter(d => {
    const dt = parseDateLocal(d.data);
    return dt >= start && dt <= end;
  });
}

function aggregateGanhos(lista){
  let faturamento = 0, km = 0, corridas = 0, horas = 0;
  const porApp = {}; // appId -> {valor, km, corridas}
  lista.forEach(g => {
    (g.porApp || []).forEach(pa => {
      if(!porApp[pa.appId]) porApp[pa.appId] = { valor:0, km:0, corridas:0 };
      porApp[pa.appId].valor += Number(pa.valor)||0;
      porApp[pa.appId].km += Number(pa.km)||0;
      porApp[pa.appId].corridas += Number(pa.corridas)||0;
      faturamento += Number(pa.valor)||0;
      km += Number(pa.km)||0;
      corridas += Number(pa.corridas)||0;
    });
    horas += Number(g.horas)||0;
  });
  const kmReal = lista.reduce((s,g)=> s + (Number(g.kmReal)||0), 0);
  return { faturamento, km, corridas, horas, kmReal, porApp };
}

function aggregateDespesas(lista){
  let total = 0;
  const porCategoria = {};
  lista.forEach(d => {
    total += Number(d.valor)||0;
    porCategoria[d.categoria] = (porCategoria[d.categoria]||0) + (Number(d.valor)||0);
  });
  return { total, porCategoria };
}

/* =========================================================
   RENDER: PAINEL (dashboard)
   ========================================================= */
function renderPainel(){
  document.getElementById('period-label').textContent = periodLabel(periodoAtual.tipo, periodoAtual.ref);
  const { start, end } = getPeriodRange(periodoAtual.tipo, periodoAtual.ref);

  const gl = ganhosNoPeriodo(start, end);
  const dl = despesasNoPeriodo(start, end);
  const G = aggregateGanhos(gl);
  const D = aggregateDespesas(dl);

  const lucro = G.faturamento - D.total;
  const hasData = gl.length > 0 || dl.length > 0;

  const heroEl = document.getElementById('hero-lucro');
  heroEl.textContent = brl(lucro);
  heroEl.style.color = lucro >= 0 ? 'var(--green)' : 'var(--red)';
  const margem = G.faturamento > 0 ? (lucro/G.faturamento*100) : 0;
  const sub = document.getElementById('hero-sub');
  sub.textContent = hasData ? `Margem de ${num(margem,0)}% sobre o faturamento` : 'Sem lançamentos neste período';
  sub.className = 'sub ' + (lucro >= 0 ? 'pos' : 'neg');

  document.getElementById('m-faturamento').textContent = brl(G.faturamento);
  document.getElementById('m-despesas').textContent = brl(D.total);
  document.getElementById('m-km').textContent = num(G.km,1) + ' km';
  document.getElementById('m-ganhokm').textContent = G.km > 0 ? brl(G.faturamento/G.km) : '—';
  document.getElementById('m-corridas').textContent = G.corridas;
  document.getElementById('m-ganhohora').textContent = G.horas > 0 ? brl(G.faturamento/G.horas) : '—';
  document.getElementById('m-kmreal').textContent = G.kmReal > 0 ? (num(G.kmReal,1) + ' km') : '— km';
  document.getElementById('m-ganhokmreal').textContent = G.kmReal > 0 ? brl(G.faturamento/G.kmReal) : '—';

  drawDonut('chart-donut', [
    { label:'Lucro líquido', value: Math.max(lucro,0), color:'#5FD068' },
    { label:'Despesas', value: D.total, color:'#FF6B5E' },
  ], 'legend-donut', brl);

  const appList = document.getElementById('app-breakdown');
  appList.innerHTML = '';
  const appsAtivos = state.apps.filter(a => a.ativo || G.porApp[a.id]);
  appsAtivos.forEach(app => {
    const d = G.porApp[app.id];
    const valor = d ? d.valor : 0;
    const km = d ? d.km : 0;
    const gkm = km > 0 ? brl(valor/km) : '—';
    const row = document.createElement('div');
    row.className = 'app-row';
    row.innerHTML = `
      <div class="left">
        <div class="dot" style="background:${app.cor}"></div>
        <div>
          <div class="name">${app.nome}</div>
          <div class="stat">${num(km,0)} km · ${gkm}/km</div>
        </div>
      </div>
      <div class="stat"><b>${brl(valor)}</b></div>
    `;
    appList.appendChild(row);
  });

  document.getElementById('empty-painel').style.display = hasData ? 'none' : 'block';
  document.getElementById('card-donut').style.display = hasData ? '' : 'none';
  document.getElementById('card-apps').style.display = hasData ? '' : 'none';
}

/* =========================================================
   MOTOR DE GRÁFICOS — canvas puro, sem libs externas
   (mantém o app 100% funcional offline depois de instalado)
   ========================================================= */
function setupCanvas(id, forceWidth){
  const canvas = document.getElementById(id);
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cssW = forceWidth || rect.width || canvas.parentElement.clientWidth || 300;
  // guarda a altura "de design" uma única vez, pois o atributo height
  // é sobrescrito abaixo (canvas buffer) e não pode ser reusado como fonte da verdade
  if(!canvas.dataset.baseHeight){
    canvas.dataset.baseHeight = canvas.getAttribute('height') || '220';
  }
  const cssH = parseInt(canvas.dataset.baseHeight, 10) || 220;
  canvas.width = Math.max(1, cssW * dpr);
  canvas.height = Math.max(1, cssH * dpr);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0,0,cssW,cssH);
  return { ctx, w: cssW, h: cssH };
}

function drawDonut(canvasId, data, legendId, fmt=brl){
  const { ctx, w, h } = setupCanvas(canvasId);
  const total = data.reduce((s,d)=>s+d.value,0);
  const cx = w/2, cy = h/2, r = Math.max(1, Math.min(w,h)/2 - 14), rInner = r*0.62;

  if(total <= 0){
    ctx.fillStyle = '#5B6270';
    ctx.font = '13px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Sem dados', cx, cy);
    if(legendId) document.getElementById(legendId).innerHTML = '';
    return;
  }

  let start = -Math.PI/2;
  data.forEach(d => {
    if(d.value <= 0) return;
    const angle = (d.value/total) * Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,start,start+angle);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    start += angle;
  });
  ctx.beginPath();
  ctx.arc(cx,cy,rInner,0,Math.PI*2);
  ctx.fillStyle = '#1C2128';
  ctx.fill();

  ctx.fillStyle = '#EDEFF2';
  ctx.font = '600 17px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fmt(total), cx, cy);
  ctx.textBaseline = 'alphabetic';

  if(legendId){
    const legend = document.getElementById(legendId);
    legend.innerHTML = data.filter(d=>d.value>0).map(d =>
      `<div class="li"><span class="dot" style="background:${d.color}"></span>${d.label}: ${fmt(d.value)}</div>`
    ).join('');
  }
}

function roundRectTop(ctx, x, y, w, h, r){
  if(h <= 0) h = 0.0001;
  r = Math.max(0, Math.min(r, w/2, h));
  ctx.beginPath();
  ctx.moveTo(x, y+h);
  ctx.lineTo(x, y+r);
  ctx.arcTo(x,y,x+r,y,r);
  ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h);
  ctx.closePath();
}

function drawBars(canvasId, labels, series, opts={}){
  const minBarW = opts.minBarW || 0;
  const canvas = document.getElementById(canvasId);
  const containerW = canvas.parentElement.clientWidth || 300;
  const n = labels.length;
  const padL = 18, padR = 18;
  let totalW = containerW;
  if(minBarW && n > 0){
    const neededGroupW = series.length * (minBarW + 4) + 4;
    const neededTotalW = neededGroupW * n + padL + padR;
    totalW = Math.max(containerW, neededTotalW);
  }
  // permite scroll horizontal quando o conteúdo exige mais largura que o container
  canvas.style.minWidth = totalW + 'px';
  const wrap = canvas.parentElement;
  wrap.style.overflowX = totalW > containerW ? 'auto' : 'hidden';
  wrap.style.webkitOverflowScrolling = 'touch';

  const { ctx, w, h } = setupCanvas(canvasId, totalW);
  const padT = 16, padB = 28;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  if(n === 0){
    ctx.fillStyle = '#5B6270'; ctx.font='13px Inter'; ctx.textAlign='center';
    ctx.fillText('Sem dados suficientes', w/2, h/2);
    return;
  }
  const maxVal = Math.max(1, ...series.flatMap(s=>s.values.map(v=>v||0))) * 1.15;
  const groupW = plotW / n;
  const barGap = 4;
  const barW = (groupW - barGap*(series.length+1)) / series.length;

  ctx.strokeStyle = '#2E3540';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT+plotH);
  ctx.lineTo(padL+plotW, padT+plotH);
  ctx.stroke();

  labels.forEach((lab, i) => {
    const gx = padL + i*groupW;
    series.forEach((s, si) => {
      const v = s.values[i] || 0;
      const bh = (v/maxVal) * plotH;
      const bx = gx + barGap + si*(barW+barGap);
      const by = padT + plotH - bh;
      ctx.fillStyle = s.color;
      roundRectTop(ctx, bx, by, barW, bh, 4);
      ctx.fill();
    });
    ctx.fillStyle = '#8B93A1';
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(lab, gx + groupW/2, h - 10);
  });
}

function drawLine(canvasId, labels, series){
  const { ctx, w, h } = setupCanvas(canvasId);
  const padL = 18, padR = 18, padT = 16, padB = 28;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const n = labels.length;
  if(n === 0){
    ctx.fillStyle = '#5B6270'; ctx.font='13px Inter'; ctx.textAlign='center';
    ctx.fillText('Sem dados suficientes', w/2, h/2);
    return;
  }
  const allVals = series.flatMap(s=>s.values.filter(v=>v!==null && v!==undefined));
  const maxVal = allVals.length ? Math.max(1, ...allVals) * 1.15 : 1;
  const minVal = allVals.length ? Math.min(0, ...allVals) : 0;
  const range = maxVal - minVal || 1;

  ctx.strokeStyle = '#2E3540';
  ctx.lineWidth = 1;
  for(let gi=0; gi<=2; gi++){
    const gy = padT + plotH*gi/2;
    ctx.beginPath(); ctx.moveTo(padL,gy); ctx.lineTo(padL+plotW,gy); ctx.stroke();
  }

  const stepX = n > 1 ? plotW/(n-1) : 0;
  const xOf = i => n > 1 ? padL + stepX*i : padL + plotW/2;
  const yOf = v => padT + plotH - ((v-minVal)/range)*plotH;

  series.forEach(s => {
    // desenha em segmentos contínuos, pulando onde o valor é null (sem dado naquele período)
    let drawing = false;
    ctx.beginPath();
    s.values.forEach((v,i) => {
      if(v === null || v === undefined){ drawing = false; return; }
      const x = xOf(i), y = yOf(v);
      if(!drawing){ ctx.moveTo(x,y); drawing = true; }
      else ctx.lineTo(x,y);
    });
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    s.values.forEach((v,i) => {
      if(v === null || v === undefined) return;
      const x = xOf(i), y = yOf(v);
      ctx.beginPath();
      ctx.arc(x,y,3.5,0,Math.PI*2);
      ctx.fillStyle = s.color;
      ctx.fill();
    });
  });

  ctx.fillStyle = '#8B93A1';
  ctx.font = '10.5px Inter';
  ctx.textAlign = 'center';
  labels.forEach((lab,i) => {
    if(n > 8 && i % Math.ceil(n/8) !== 0 && i !== n-1) return;
    ctx.fillText(lab, xOf(i), h-10);
  });
}

/* =========================================================
   TELA: LANÇAR
   ========================================================= */
document.querySelectorAll('#screen-lancar .tabs .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#screen-lancar .tabs .tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    const isGanho = tab.dataset.form === 'ganho';
    document.getElementById('form-ganho').style.display = isGanho ? 'block' : 'none';
    document.getElementById('form-despesa').style.display = isGanho ? 'none' : 'block';
  });
});

function renderLancar(){
  if(!document.getElementById('g-data').value) document.getElementById('g-data').value = todayISO();
  if(!document.getElementById('d-data').value) document.getElementById('d-data').value = todayISO();
  renderGanhoAppsInputs();
  renderCategoriaSelect();
  renderRecentList();
}

function renderGanhoAppsInputs(){
  const wrap = document.getElementById('ganho-apps-list');
  wrap.innerHTML = '';
  state.apps.filter(a => a.ativo).forEach(app => {
    const block = document.createElement('div');
    block.style.marginBottom = '16px';
    block.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;">
        <span style="width:9px;height:9px;border-radius:50%;background:${app.cor};display:inline-block;"></span>
        <strong style="font-size:13px;">${app.nome}</strong>
      </div>
      <div class="field-row">
        <div class="field" style="margin-bottom:0;">
          <label>Ganho (R$)</label>
          <input type="number" inputmode="decimal" step="0.01" data-app="${app.id}" data-kind="valor" class="app-input" placeholder="0,00">
        </div>
        <div class="field" style="margin-bottom:0;">
          <label>Km do app</label>
          <input type="number" inputmode="decimal" step="0.1" data-app="${app.id}" data-kind="km" class="app-input" placeholder="0">
        </div>
        <div class="field" style="margin-bottom:0;max-width:90px;">
          <label>Corridas</label>
          <input type="number" inputmode="numeric" step="1" data-app="${app.id}" data-kind="corridas" class="app-input" placeholder="0">
        </div>
      </div>
    `;
    wrap.appendChild(block);
  });
}

document.getElementById('form-ganho').addEventListener('submit', e => {
  e.preventDefault();
  const data = document.getElementById('g-data').value;
  if(!data){ toast('Escolha uma data'); return; }
  const inputs = document.querySelectorAll('#ganho-apps-list .app-input');
  const porAppMap = {};
  inputs.forEach(inp => {
    const appId = inp.dataset.app, kind = inp.dataset.kind;
    const v = parseFloat(String(inp.value).replace(',','.'));
    if(!isNaN(v) && v !== 0){
      if(!porAppMap[appId]) porAppMap[appId] = { appId, valor:0, km:0, corridas:0 };
      porAppMap[appId][kind] = v;
    }
  });
  const porApp = Object.values(porAppMap);
  const kmReal = parseFloat(document.getElementById('g-km-real').value) || 0;
  const horas = parseFloat(document.getElementById('g-horas').value) || 0;

  if(porApp.length === 0 && kmReal===0 && horas===0){
    toast('Preencha ao menos um valor');
    return;
  }

  const existingIdx = state.ganhos.findIndex(g => g.data === data);
  const entry = { id: existingIdx>=0 ? state.ganhos[existingIdx].id : uid(), data, porApp, kmReal, horas };
  if(existingIdx >= 0) state.ganhos[existingIdx] = entry;
  else state.ganhos.push(entry);

  saveState();
  toast(existingIdx>=0 ? 'Lançamento do dia atualizado' : 'Ganhos salvos', true);
  document.getElementById('form-ganho').reset();
  document.getElementById('g-data').value = data;
  renderRecentList();
});

function renderCategoriaSelect(){
  const sel = document.getElementById('d-categoria');
  const current = sel.value;
  sel.innerHTML = state.categorias.map(c => `<option value="${c}">${c}</option>`).join('')
    + `<option value="__nova__">+ Criar nova categoria</option>`;
  if(current) sel.value = current;
}
document.getElementById('d-categoria').addEventListener('change', e => {
  document.getElementById('d-nova-categoria-wrap').style.display = e.target.value === '__nova__' ? 'block' : 'none';
});

document.getElementById('form-despesa').addEventListener('submit', e => {
  e.preventDefault();
  const data = document.getElementById('d-data').value;
  let categoria = document.getElementById('d-categoria').value;
  const valor = parseFloat(String(document.getElementById('d-valor').value).replace(',','.'));
  const obs = document.getElementById('d-obs').value.trim();

  if(categoria === '__nova__'){
    const nova = document.getElementById('d-nova-categoria').value.trim();
    if(!nova){ toast('Digite o nome da nova categoria'); return; }
    if(!state.categorias.includes(nova)) state.categorias.push(nova);
    categoria = nova;
  }
  if(!data || isNaN(valor) || valor <= 0){ toast('Confira data e valor'); return; }

  state.despesas.push({ id: uid(), data, categoria, valor, obs });
  saveState();
  toast('Despesa salva', true);
  document.getElementById('form-despesa').reset();
  document.getElementById('d-data').value = data;
  document.getElementById('d-nova-categoria-wrap').style.display = 'none';
  renderCategoriaSelect();
  renderRecentList();
});

function renderRecentList(){
  const list = document.getElementById('recent-list');
  const combined = [
    ...state.ganhos.map(g => ({ type:'ganho', ...g, total: (g.porApp||[]).reduce((s,p)=>s+(Number(p.valor)||0),0) })),
    ...state.despesas.map(d => ({ type:'despesa', ...d })),
  ].sort((a,b) => b.data.localeCompare(a.data)).slice(0, 12);

  if(combined.length === 0){
    list.innerHTML = `<div class="empty-state"><div class="ico">🧾</div><div class="msg">Nenhum lançamento ainda.</div></div>`;
    return;
  }

  list.innerHTML = `<div class="card" style="padding:6px 18px;">` + combined.map(item => {
    const dateLabel = parseDateLocal(item.data).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'});
    if(item.type === 'ganho'){
      return `
        <div class="entry-row">
          <div class="icn" style="background:rgba(95,208,104,0.15);">💰</div>
          <div class="info">
            <div class="name">Ganhos do dia</div>
            <div class="meta">${dateLabel} · ${(item.porApp||[]).length} app(s)</div>
          </div>
          <div class="amt green">+${brl(item.total)}</div>
          <button class="del" data-del-ganho="${item.id}">✕</button>
        </div>`;
    }
    const isFixa = !!item.fixaId;
    return `
        <div class="entry-row">
          <div class="icn" style="background:rgba(255,107,94,0.15);">${isFixa ? '🔁' : '🧾'}</div>
          <div class="info" ${isFixa ? `data-edit-valor-fixa="${item.id}" style="cursor:pointer;"` : ''}>
            <div class="name">${item.categoria}</div>
            <div class="meta">${dateLabel}${item.obs ? ' · '+item.obs : ''}${isFixa ? ' · fixa (toque para ajustar este mês)' : ''}</div>
          </div>
          <div class="amt red">-${brl(item.valor)}</div>
          <button class="del" data-del-despesa="${item.id}" data-is-fixa="${isFixa}">✕</button>
        </div>`;
  }).join('') + `</div>`;

  list.querySelectorAll('[data-edit-valor-fixa]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.editValorFixa;
      const d = state.despesas.find(x => x.id === id);
      const novoValor = prompt(`Novo valor para "${d.categoria}" neste mês (${parseDateLocal(d.data).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}):`, d.valor);
      if(novoValor === null) return;
      const v = parseFloat(String(novoValor).replace(',','.'));
      if(isNaN(v) || v <= 0){ toast('Valor inválido'); return; }
      d.valor = v;
      saveState();
      renderRecentList();
      toast('Valor deste mês atualizado', true);
    });
  });

  list.querySelectorAll('[data-del-ganho]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.delGanho;
      confirmSheet('Excluir lançamento', 'Remover os ganhos lançados nesse dia?', () => {
        state.ganhos = state.ganhos.filter(g => g.id !== id);
        saveState(); renderRecentList(); toast('Removido');
      });
    });
  });
  list.querySelectorAll('[data-del-despesa]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.delDespesa;
      const isFixa = btn.dataset.isFixa === 'true';
      confirmSheet('Excluir despesa', isFixa
        ? 'Remove só o lançamento deste mês. A despesa fixa continua ativa e vai gerar normalmente nos próximos meses — para parar definitivamente, pause ou exclua a fixa em Ajustes.'
        : 'Remover essa despesa?', () => {
        state.despesas = state.despesas.filter(d => d.id !== id);
        saveState(); renderRecentList(); toast('Removido');
      });
    });
  });
}

/* =========================================================
   TELA: GRÁFICOS
   ========================================================= */
let graficosView = 'mensal';
document.querySelectorAll('#screen-graficos .tabs .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#screen-graficos .tabs .tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    graficosView = tab.dataset.gview;
    renderGraficos();
  });
});

const MESES_ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

function buildBuckets(view){
  const allDates = [
    ...state.ganhos.map(g=>g.data),
    ...state.despesas.map(d=>d.data),
  ];
  if(allDates.length === 0) return [];

  if(view === 'anual'){
    const years = [...new Set(allDates.map(d => d.slice(0,4)))].sort();
    return years.map(y => {
      const start = new Date(Number(y),0,1), end = new Date(Number(y),11,31,23,59,59);
      return { key: y, label: y, start, end };
    });
  }

  const sorted = allDates.slice().sort();
  const firstD = parseDateLocal(sorted[0]);
  const now = new Date();
  const buckets = [];
  let cursor = new Date(firstD.getFullYear(), firstD.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 1);
  while(cursor <= last){
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth()+1, 0, 23,59,59);
    buckets.push({
      key: `${start.getFullYear()}-${start.getMonth()}`,
      label: MESES_ABREV[start.getMonth()] + '/' + String(start.getFullYear()).slice(2),
      start, end
    });
    cursor.setMonth(cursor.getMonth()+1);
  }
  return buckets.slice(-12);
}

function renderGraficos(){
  const buckets = buildBuckets(graficosView);
  const faltam = Math.max(0, 2 - buckets.length);
  const emptyEl = document.getElementById('empty-graficos');
  if(faltam > 0){
    emptyEl.style.display = 'block';
    const unidade = graficosView === 'anual' ? (faltam===1?'ano':'anos') : (faltam===1?'mês':'meses');
    document.getElementById('empty-graficos-msg').textContent = buckets.length === 0
      ? `Lance seu primeiro ${graficosView==='anual'?'ano':'mês'} para começar a ver os gráficos aqui.`
      : `Você tem ${buckets.length} ${graficosView==='anual'?(buckets.length===1?'ano':'anos'):(buckets.length===1?'mês':'meses')} lançado. Faltam mais ${faltam} ${unidade} para aparecer a comparação completa.`;
  } else {
    emptyEl.style.display = 'none';
  }

  const labels = buckets.map(b => b.label);
  const lucros = [], faturamentos = [], despesasArr = [];
  const kmPorApp = {};
  const fatPorApp = {};
  const despPorCategoria = {};
  const mediaGeral = [];
  const appInformadoArr = [], realArr = [];

  state.apps.forEach(a => { kmPorApp[a.id] = []; fatPorApp[a.id] = []; });
  // categorias presentes nos dados (não só as cadastradas), pra não perder categorias antigas removidas da lista
  const categoriasPresentes = [...new Set(state.despesas.map(d => d.categoria))];
  categoriasPresentes.forEach(c => despPorCategoria[c] = []);

  buckets.forEach(b => {
    const gl = ganhosNoPeriodo(b.start, b.end);
    const dl = despesasNoPeriodo(b.start, b.end);
    const G = aggregateGanhos(gl);
    const D = aggregateDespesas(dl);
    lucros.push(G.faturamento - D.total);
    faturamentos.push(G.faturamento);
    despesasArr.push(D.total);

    state.apps.forEach(a => {
      const d = G.porApp[a.id];
      const v = d && d.km > 0 ? d.valor/d.km : null;
      kmPorApp[a.id].push(v);
      fatPorApp[a.id].push(d ? d.valor : 0);
    });

    categoriasPresentes.forEach(c => {
      despPorCategoria[c].push(D.porCategoria[c] || 0);
    });

    mediaGeral.push(G.km > 0 ? G.faturamento/G.km : null);
    appInformadoArr.push(G.km > 0 ? G.faturamento/G.km : null);
    realArr.push(G.kmReal > 0 ? G.faturamento/G.kmReal : null);
  });

  drawLine('chart-evolucao', labels, [
    { name:'Lucro líquido', color:'#5FD068', values: lucros },
  ]);

  drawBars('chart-fat-desp', labels, [
    { name:'Faturamento', color:'#5FD068', values: faturamentos },
    { name:'Despesas', color:'#FF6B5E', values: despesasArr },
  ]);

  const appsAtivos = state.apps.filter(a => a.ativo);
  drawBars('chart-fat-por-app', labels, appsAtivos.map(a => ({
    name: a.nome, color: a.cor, values: fatPorApp[a.id]
  })), { minBarW: 16 });
  document.getElementById('legend-fat-por-app').innerHTML = appsAtivos.map(a =>
    `<div class="li"><span class="dot" style="background:${a.cor}"></span>${a.nome}</div>`
  ).join('');

  const corPorCategoria = (nome) => categoriaColor(nome);
  drawBars('chart-desp-categoria', labels, categoriasPresentes.map(c => ({
    name: c, color: corPorCategoria(c), values: despPorCategoria[c]
  })), { minBarW: 14 });
  document.getElementById('legend-desp-categoria').innerHTML = categoriasPresentes.map(c =>
    `<div class="li"><span class="dot" style="background:${corPorCategoria(c)}"></span>${c}</div>`
  ).join('') || `<div class="li" style="color:var(--text-faint);">Nenhuma despesa lançada ainda</div>`;

  const appsAtivos2 = appsAtivos; // mantém nome usado abaixo
  drawLine('chart-kmapp', labels, appsAtivos2.map(a => ({
    name: a.nome, color: a.cor, values: kmPorApp[a.id]
  })));
  document.getElementById('legend-kmapp').innerHTML = appsAtivos2.map(a =>
    `<div class="li"><span class="dot" style="background:${a.cor}"></span>${a.nome}</div>`
  ).join('');

  drawBars('chart-kmmedia', labels, [
    { name:'Ganho/km médio', color:'#E8B339', values: mediaGeral.map(v=>v===null?0:v) }
  ]);

  drawLine('chart-kmreal', labels, [
    { name:'Segundo os apps', color:'#5BA7E8', values: appInformadoArr },
    { name:'Km real (com deslocamento)', color:'#E8B339', values: realArr },
  ]);
  document.getElementById('legend-kmreal').innerHTML = `
    <div class="li"><span class="dot" style="background:#5BA7E8"></span>Segundo os apps</div>
    <div class="li"><span class="dot" style="background:#E8B339"></span>Km real</div>
  `;
}

/* Cor determinística para categorias dinâmicas de despesa, usando a mesma
   paleta de referência do app. Atribui por ordem de cadastro (state.categorias)
   para evitar colisões de cor entre categorias diferentes. */
const CATEGORIA_PALETTE = ['#FF6B5E','#E8B339','#5BA7E8','#B084E8','#5FD068','#FF8FB1','#7DD3C8','#F4A261','#9D8DF1','#E07A5F'];
function categoriaColor(nome){
  let idx = state.categorias.indexOf(nome);
  if(idx === -1){
    // categoria não está mais na lista (foi removida) — usa hash como fallback estável
    let hash = 0;
    for(let i=0;i<nome.length;i++) hash = (hash*31 + nome.charCodeAt(i)) >>> 0;
    idx = hash;
  }
  return CATEGORIA_PALETTE[idx % CATEGORIA_PALETTE.length];
}

/* =========================================================
   TELA: CONFIGURAÇÕES
   ========================================================= */
/* =========================================================
   DESPESAS FIXAS — UI (cadastro, lista, ativar/desativar, excluir)
   ========================================================= */
function mesLabel(mesStr){
  // 'YYYY-MM' -> 'jun de 2026'
  const [y,m] = mesStr.split('-').map(Number);
  const d = new Date(y, m-1, 1);
  return d.toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
}

function renderFixasConfig(){
  const wrap = document.getElementById('fixas-list');
  if(!state.despesasFixas || state.despesasFixas.length === 0){
    wrap.innerHTML = `<p style="font-size:13px;color:var(--text-faint);margin:4px 0;">Nenhuma despesa fixa cadastrada ainda.</p>`;
    return;
  }
  wrap.innerHTML = state.despesasFixas.map(f => `
    <div class="app-row" style="margin-bottom:10px;${f.ativa ? '' : 'opacity:0.55;'}">
      <div class="left" style="flex:1;min-width:0;cursor:pointer;" data-edit-fixa="${f.id}">
        <div>
          <div class="name">${f.categoria}${f.descricao ? ' · '+f.descricao : ''}</div>
          <div class="stat">${brl(f.valor)}/mês · desde ${mesLabel(f.mesInicio)}${f.ativa ? '' : ' · pausada'}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
        <div class="switch ${f.ativa?'on':''}" data-toggle-fixa="${f.id}" title="${f.ativa ? 'Pausar' : 'Reativar'}"></div>
        <button class="del" data-del-fixa="${f.id}">✕</button>
      </div>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-edit-fixa]').forEach(el => {
    el.addEventListener('click', () => openFixaSheet(el.dataset.editFixa));
  });
  wrap.querySelectorAll('[data-toggle-fixa]').forEach(sw => {
    sw.addEventListener('click', () => {
      const f = state.despesasFixas.find(x => x.id === sw.dataset.toggleFixa);
      f.ativa = !f.ativa;
      saveState();
      if(f.ativa) materializarDespesasFixas();
      renderFixasConfig();
      toast(f.ativa ? 'Despesa fixa reativada' : 'Despesa fixa pausada');
    });
  });
  wrap.querySelectorAll('[data-del-fixa]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.delFixa;
      const f = state.despesasFixas.find(x => x.id === id);
      confirmSheet('Excluir despesa fixa', `Isso remove "${f.categoria}" da lista de fixas. Os lançamentos já gerados em meses anteriores continuam no histórico — você pode excluí-los manualmente se quiser.`, () => {
        state.despesasFixas = state.despesasFixas.filter(x => x.id !== id);
        saveState();
        renderFixasConfig();
        toast('Despesa fixa removida');
      });
    });
  });
}

function openFixaSheet(id){
  const sel = document.getElementById('fx-categoria');
  sel.innerHTML = state.categorias.map(c => `<option value="${c}">${c}</option>`).join('');
  const backdrop = document.getElementById('fixa-backdrop');
  const title = document.getElementById('fixa-sheet-title');

  if(id){
    const f = state.despesasFixas.find(x => x.id === id);
    title.textContent = 'Editar despesa fixa';
    document.getElementById('fx-id').value = f.id;
    sel.value = f.categoria;
    document.getElementById('fx-descricao').value = f.descricao || '';
    document.getElementById('fx-valor').value = f.valor;
    document.getElementById('fx-mes-inicio').value = f.mesInicio;
  } else {
    title.textContent = 'Nova despesa fixa';
    document.getElementById('form-fixa').reset();
    document.getElementById('fx-id').value = '';
    document.getElementById('fx-mes-inicio').value = mesAtualStr();
  }
  backdrop.classList.add('open');
}

document.getElementById('btn-nova-fixa').addEventListener('click', () => openFixaSheet(null));
document.getElementById('fixa-backdrop').addEventListener('click', (e) => {
  if(e.target.id === 'fixa-backdrop') e.target.classList.remove('open');
});

document.getElementById('form-fixa').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('fx-id').value;
  const categoria = document.getElementById('fx-categoria').value;
  const descricao = document.getElementById('fx-descricao').value.trim();
  const valor = parseFloat(String(document.getElementById('fx-valor').value).replace(',','.'));
  const mesInicio = document.getElementById('fx-mes-inicio').value;

  if(!categoria || isNaN(valor) || valor <= 0 || !mesInicio){
    toast('Confira categoria, valor e mês de início');
    return;
  }

  if(id){
    const f = state.despesasFixas.find(x => x.id === id);
    f.categoria = categoria; f.descricao = descricao; f.valor = valor; f.mesInicio = mesInicio;
  } else {
    state.despesasFixas.push({ id: uid(), categoria, descricao, valor, mesInicio, ativa: true });
  }
  saveState();
  materializarDespesasFixas();
  document.getElementById('fixa-backdrop').classList.remove('open');
  renderFixasConfig();
  toast('Despesa fixa salva', true);
});

function renderConfig(){
  renderFixasConfig();
  renderCategoriasConfig();
  renderAppsConfig();
}

function renderCategoriasConfig(){
  const wrap = document.getElementById('categorias-list');
  wrap.innerHTML = state.categorias.map(c => `
    <div class="toggle-row">
      <span style="font-size:14px;">${c}</span>
      <button class="del" data-del-cat="${c}">✕</button>
    </div>
  `).join('');
  wrap.querySelectorAll('[data-del-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.delCat;
      const emUso = state.despesas.some(d => d.categoria === cat);
      confirmSheet('Remover categoria', emUso
        ? `"${cat}" tem despesas lançadas. Elas continuarão salvas, mas a categoria sairá da lista de opções.`
        : `Remover a categoria "${cat}"?`, () => {
        state.categorias = state.categorias.filter(c => c !== cat);
        saveState();
        renderCategoriasConfig();
        toast('Categoria removida');
      });
    });
  });
}

document.getElementById('btn-add-cat').addEventListener('click', () => {
  const input = document.getElementById('nova-cat-input');
  const v = input.value.trim();
  if(!v) return;
  if(state.categorias.includes(v)){ toast('Essa categoria já existe'); return; }
  state.categorias.push(v);
  saveState();
  input.value = '';
  renderCategoriasConfig();
  toast('Categoria adicionada', true);
});

function renderAppsConfig(){
  const wrap = document.getElementById('apps-config-list');
  wrap.innerHTML = state.apps.map(a => `
    <div class="toggle-row">
      <div style="display:flex;align-items:center;gap:9px;">
        <span style="width:10px;height:10px;border-radius:50%;background:${a.cor};display:inline-block;"></span>
        <span style="font-size:14px;font-weight:600;">${a.nome}</span>
      </div>
      <div class="switch ${a.ativo?'on':''}" data-toggle-app="${a.id}"></div>
    </div>
  `).join('');
  wrap.querySelectorAll('[data-toggle-app]').forEach(sw => {
    sw.addEventListener('click', () => {
      const app = state.apps.find(a => a.id === sw.dataset.toggleApp);
      app.ativo = !app.ativo;
      saveState();
      renderAppsConfig();
    });
  });
}

/* ===== Backup (.json) ===== */
document.getElementById('btn-backup').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
  downloadBlob(blob, `painel-motorista-backup-${todayISO()}.json`);
  toast('Backup baixado', true);
});

document.getElementById('btn-restore').addEventListener('click', () => {
  document.getElementById('file-restore').click();
});
document.getElementById('file-restore').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      if(!parsed.ganhos || !parsed.despesas){ throw new Error('formato inválido'); }
      confirmSheet('Restaurar backup', 'Isso substitui todos os dados atuais pelos dados do arquivo. Continuar?', () => {
        state = parsed;
        saveState();
        toast('Backup restaurado', true);
        goToScreen('painel');
      });
    }catch(err){
      toast('Arquivo inválido');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('btn-clear-all').addEventListener('click', () => {
  confirmSheet('Apagar tudo', 'Isso vai remover permanentemente todos os ganhos e despesas lançados. Essa ação não pode ser desfeita.', () => {
    state.ganhos = [];
    state.despesas = [];
    saveState();
    toast('Dados apagados');
    goToScreen('painel');
  });
});

/* =========================================================
   EXPORTAÇÃO CSV (4 blocos = diária, semanal, mensal, anual,
   tudo num único arquivo, prontos para colar em abas separadas
   no Google Planilhas)
   ========================================================= */
function csvEscape(v){
  v = String(v ?? '');
  if(/[",;\n]/.test(v)) return '"' + v.replace(/"/g,'""') + '"';
  return v;
}
function csvRow(arr){ return arr.map(csvEscape).join(';'); }

document.getElementById('btn-export-csv').addEventListener('click', () => {
  if(state.ganhos.length===0 && state.despesas.length===0){
    toast('Não há dados para exportar');
    return;
  }
  const lines = [];
  const appNames = Object.fromEntries(state.apps.map(a=>[a.id,a.nome]));

  function blocoDetalhado(titulo, gl, dl){
    lines.push(`### ${titulo} — Ganhos`);
    lines.push(csvRow(['Data','App','Valor (R$)','Km do app','Corridas','Km real do dia','Horas do dia']));
    gl.slice().sort((a,b)=>a.data.localeCompare(b.data)).forEach(g => {
      if((g.porApp||[]).length === 0){
        lines.push(csvRow([g.data,'','','','',g.kmReal||'',g.horas||'']));
      } else {
        g.porApp.forEach((pa,idx) => {
          lines.push(csvRow([
            g.data, appNames[pa.appId]||pa.appId, pa.valor||0, pa.km||0, pa.corridas||0,
            idx===0 ? (g.kmReal||'') : '', idx===0 ? (g.horas||'') : ''
          ]));
        });
      }
    });
    lines.push('');
    lines.push(`### ${titulo} — Despesas`);
    lines.push(csvRow(['Data','Categoria','Valor (R$)','Observação']));
    dl.slice().sort((a,b)=>a.data.localeCompare(b.data)).forEach(d => lines.push(csvRow([d.data, d.categoria, d.valor, d.obs||''])));
    lines.push('');
  }

  blocoDetalhado('DIÁRIA (todos os lançamentos)', state.ganhos, state.despesas);

  lines.push('### SEMANAL — Resumo');
  lines.push(csvRow(['Ano','Semana','Faturamento (R$)','Despesas (R$)','Lucro (R$)','Km (app)','Km real','Corridas','Ganho/Km (app)','Ganho/Km real']));
  {
    const map = {};
    state.ganhos.forEach(g => {
      const w = isoWeek(parseDateLocal(g.data));
      const key = `${w.year}-W${String(w.week).padStart(2,'0')}`;
      if(!map[key]) map[key] = { ganhos:[], despesas:[] };
      map[key].ganhos.push(g);
    });
    state.despesas.forEach(d => {
      const w = isoWeek(parseDateLocal(d.data));
      const key = `${w.year}-W${String(w.week).padStart(2,'0')}`;
      if(!map[key]) map[key] = { ganhos:[], despesas:[] };
      map[key].despesas.push(d);
    });
    Object.keys(map).sort().forEach(key => {
      const [year, wpart] = key.split('-W');
      const G = aggregateGanhos(map[key].ganhos);
      const D = aggregateDespesas(map[key].despesas);
      lines.push(csvRow([year, wpart, G.faturamento.toFixed(2), D.total.toFixed(2), (G.faturamento-D.total).toFixed(2),
        G.km.toFixed(1), G.kmReal.toFixed(1), G.corridas,
        G.km>0?(G.faturamento/G.km).toFixed(2):'', G.kmReal>0?(G.faturamento/G.kmReal).toFixed(2):''
      ]));
    });
  }
  lines.push('');

  lines.push('### MENSAL — Resumo');
  lines.push(csvRow(['Mês','Faturamento (R$)','Despesas (R$)','Lucro (R$)','Km (app)','Km real','Corridas','Ganho/Km (app)','Ganho/Km real','Ganho/Hora']));
  {
    const buckets = buildBuckets('mensal');
    buckets.forEach(b => {
      const gl = ganhosNoPeriodo(b.start,b.end), dl = despesasNoPeriodo(b.start,b.end);
      const G = aggregateGanhos(gl), D = aggregateDespesas(dl);
      lines.push(csvRow([b.label, G.faturamento.toFixed(2), D.total.toFixed(2), (G.faturamento-D.total).toFixed(2),
        G.km.toFixed(1), G.kmReal.toFixed(1), G.corridas,
        G.km>0?(G.faturamento/G.km).toFixed(2):'', G.kmReal>0?(G.faturamento/G.kmReal).toFixed(2):'',
        G.horas>0?(G.faturamento/G.horas).toFixed(2):''
      ]));
    });
  }
  lines.push('');

  lines.push('### ANUAL — Resumo');
  lines.push(csvRow(['Ano','Faturamento (R$)','Despesas (R$)','Lucro (R$)','Km (app)','Km real','Corridas','Ganho/Km (app)','Ganho/Km real','Ganho/Hora']));
  {
    const buckets = buildBuckets('anual');
    buckets.forEach(b => {
      const gl = ganhosNoPeriodo(b.start,b.end), dl = despesasNoPeriodo(b.start,b.end);
      const G = aggregateGanhos(gl), D = aggregateDespesas(dl);
      lines.push(csvRow([b.label, G.faturamento.toFixed(2), D.total.toFixed(2), (G.faturamento-D.total).toFixed(2),
        G.km.toFixed(1), G.kmReal.toFixed(1), G.corridas,
        G.km>0?(G.faturamento/G.km).toFixed(2):'', G.kmReal>0?(G.faturamento/G.kmReal).toFixed(2):'',
        G.horas>0?(G.faturamento/G.horas).toFixed(2):''
      ]));
    });
  }

  const csvContent = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csvContent], { type:'text/csv;charset=utf-8' });
  downloadBlob(blob, `painel-motorista-${todayISO()}.csv`);
  toast('Planilha baixada', true);
});

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */
document.getElementById('g-data').value = todayISO();
document.getElementById('d-data').value = todayISO();
goToScreen('painel');

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
