// script.js (substitua todo o arquivo por este)

// ---------- UTILITÁRIOS ----------
function parseNumber(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return isFinite(value) ? value : 0;
  const s = String(value).trim().replace(/\s+/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function formatBR(num) {
  const n = parseNumber(num);
  const neg = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const parts = abs.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return neg + parts[0] + "," + parts[1];
}

function formatOdds(num) {
  return parseNumber(num).toFixed(2).replace(".", ",");
}

// ---------- DADOS (localStorage) ----------
let bets = JSON.parse(localStorage.getItem("apostas_v2") || "[]");
bets = bets.map(b => ({ ...b, stake: parseNumber(b.stake), odds: parseNumber(b.odds) }));

let saques = JSON.parse(localStorage.getItem("saques") || "[]");
// normalize saque valor
saques = saques.map(s => ({ ...s, valor: parseNumber(s.valor) }));

function saveBets() {
  localStorage.setItem("apostas_v2", JSON.stringify(bets));
}
function saveSaques() {
  localStorage.setItem("saques", JSON.stringify(saques));
}

// ---------- ELEMENTOS DOM ----------
const form = document.getElementById("betForm");
const betTable = document.getElementById("betTable");
const filter = document.getElementById("filter");
const search = document.getElementById("search");
const sort = document.getElementById("sort");
const chartCanvas = document.getElementById("chart");
const ctx = chartCanvas ? chartCanvas.getContext("2d") : null;
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");
const saqueForm = document.getElementById("saqueForm");
const listaSaques = document.getElementById("listaSaques");
const totalApostasEl = document.getElementById("totalApostas");

// ---------- LISTENERS ----------
if (form) form.addEventListener("submit", addBet);
if (filter) filter.addEventListener("change", renderBets);
if (search) search.addEventListener("input", renderBets);
if (sort) sort.addEventListener("change", renderBets);
if (exportBtn) exportBtn.addEventListener("click", exportCSV);
if (importFile) importFile.addEventListener("change", e => importCSV(e.target.files[0]));
if (saqueForm) saqueForm.addEventListener("submit", addSaque);

// ---------- LÓGICA DE APOSTAS ----------
function calcProfit(bet) {
  if (!bet) return 0;
  const stake = parseNumber(bet.stake);
  const odds = parseNumber(bet.odds);
  if (bet.result === "Ganha") return stake * (odds - 1);
  if (bet.result === "Perdida") return -stake;
  if (bet.result === "pending") return stake * (odds - 1);
  return 0;
}

function addBet(e) {
  e.preventDefault();
  const date = document.getElementById("date") ? document.getElementById("date").value : "";
  const eventVal = document.getElementById("event") ? document.getElementById("event").value : "";
  const stake = parseNumber(document.getElementById("stake").value);
  const odds = parseNumber(document.getElementById("odds").value);
  const result = document.getElementById("result") ? document.getElementById("result").value : "pending";

  const newBet = {
    id: Date.now(),
    date,
    event: eventVal,
    stake,
    odds,
    result
  };

  bets.unshift(newBet);
  saveBets();
  form.reset();
  renderBets();
}

function removeBet(id) {
  if (!confirm("Remover aposta?")) return;
  bets = bets.filter(b => b.id !== id);
  saveBets();
  renderBets();
}

function toggleResult(id) {
  bets = bets.map(b => {
    if (b.id === id) {
      if (b.result === "pending") b.result = "Ganha";
      else if (b.result === "Ganha") b.result = "Perdida";
      else b.result = "pending";
    }
    return b;
  });
  saveBets();
  renderBets();
}

function cashOut(id) {
  const bet = bets.find(b => b.id === id);
  if (!bet) return;
  const currentProfit = prompt("Valor do Cash Out (ex: 50,00)", formatBR(calcProfit(bet)));
  if (currentProfit !== null) {
    const profitNum = parseNumber(currentProfit);
    if (bet.odds - 1 === 0) {
      alert("Odds inválida para Cash Out.");
      return;
    }
    bet.result = "Ganha";
    bet.stake = profitNum / (bet.odds - 1);
    saveBets();
    renderBets();
  }
}

function renderBets() {
  if (!betTable) return;
  // filtro
  let filtered = bets.slice();
  if (filter && filter.value !== "all") filtered = filtered.filter(b => b.result === filter.value);
  if (search && search.value) filtered = filtered.filter(b => b.event && b.event.toLowerCase().includes(search.value.toLowerCase()));
  // ordenação
  if (sort) {
    if (sort.value === "date_desc") filtered.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (sort.value === "date_asc") filtered.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    if (sort.value === "profit_desc") filtered.sort((a, b) => calcProfit(b) - calcProfit(a));
    if (sort.value === "profit_asc") filtered.sort((a, b) => calcProfit(a) - calcProfit(b));
  }

  betTable.innerHTML = "";
  filtered.forEach(b => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${b.date || ""}</td>
      <td>${b.event || ""}</td>
      <td>R$ ${formatBR(b.stake)}</td>
      <td>${formatOdds(b.odds)}</td>
      <td>${b.result || ""}</td>
      <td>R$ ${formatBR(calcProfit(b))}</td>
      <td class="actions-cell">
        <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center;">
          <button class="btn-toggle">Toggle</button>
          <button class="btn-cashout">Cash Out</button>
          <button class="btn-remove" style="color:red">Remover</button>
        </div>
      </td>
    `;
    // listeners
    const btnToggle = tr.querySelector(".btn-toggle");
    const btnCash = tr.querySelector(".btn-cashout");
    const btnRemove = tr.querySelector(".btn-remove");
    if (btnToggle) btnToggle.addEventListener("click", () => toggleResult(b.id));
    if (btnCash) btnCash.addEventListener("click", () => cashOut(b.id));
    if (btnRemove) btnRemove.addEventListener("click", () => removeBet(b.id));

    betTable.appendChild(tr);
  });

  // total de apostas
  if (totalApostasEl) totalApostasEl.textContent = String(bets.length);

  updateResumo();
  if (ctx) renderChart();
}

// ---------- RESUMO ----------
function updateResumo() {
  let lucro = 0, perda = 0;
  bets.forEach(bet => {
    const profit = calcProfit(bet);
    if (profit > 0) lucro += profit;
    if (profit < 0) perda += Math.abs(profit);
  });
  const total = lucro - perda;
  const elLucro = document.getElementById("lucro");
  const elPerda = document.getElementById("perda");
  const elTotal = document.getElementById("total");
  if (elLucro) elLucro.textContent = `Lucro: R$ ${formatBR(lucro)}`;
  if (elPerda) elPerda.textContent = `Perda: R$ ${formatBR(perda)}`;
  if (elTotal) elTotal.textContent = `Total: R$ ${formatBR(total)}`;
}

// ---------- GRÁFICO SIMPLES (canvas) ----------
let animationProgress = 0, animating = false;
function renderChart() {
  if (!ctx || !chartCanvas) return;
  const lucro = bets.reduce((acc, b) => { const p = calcProfit(b); return p > 0 ? acc + p : acc; }, 0);
  const perda = bets.reduce((acc, b) => { const p = calcProfit(b); return p < 0 ? acc + Math.abs(p) : acc; }, 0);
  const maxValue = Math.max(lucro, perda, 1);
  const padding = 30;
  const barWidth = 80;
  const barSpacing = 50;
  const chartHeight = chartCanvas.height - padding * 2;

  animationProgress = 0;
  animating = true;
  function animate() {
    ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
    animationProgress += 0.05;
    if (animationProgress > 1) animationProgress = 1;
    const lucroHeight = ((lucro / maxValue) * chartHeight) * animationProgress;
    const perdaHeight = ((perda / maxValue) * chartHeight) * animationProgress;
    // Lucro
    ctx.fillStyle = "#27ae60";
    ctx.fillRect(padding, chartCanvas.height - padding - lucroHeight, barWidth, lucroHeight);
    ctx.fillStyle = "#000";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`R$ ${(lucro * animationProgress).toFixed(2)}`, padding + barWidth / 2, chartCanvas.height - padding - lucroHeight - 5);
    ctx.fillText("Lucro", padding + barWidth / 2, chartCanvas.height - padding + 15);
    // Perda
    const perdaX = padding + barWidth + barSpacing;
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(perdaX, chartCanvas.height - padding - perdaHeight, barWidth, perdaHeight);
    ctx.fillStyle = "#000";
    ctx.fillText(`R$ ${(perda * animationProgress).toFixed(2)}`, perdaX + barWidth / 2, chartCanvas.height - padding - perdaHeight - 5);
    ctx.fillText("Perda", perdaX + barWidth / 2, chartCanvas.height - padding + 15);
    // grades
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const y = chartCanvas.height - padding - (i / 5) * chartHeight;
      ctx.moveTo(padding - 10, y);
      ctx.lineTo(perdaX + barWidth + 10, y);
    }
    ctx.stroke();

    if (animationProgress < 1) requestAnimationFrame(animate);
    else animating = false;
  }
  animate();
}

// ---------- CSV (export/import) ----------
function exportCSV() {
  const header = ["id", "date", "event", "stake", "odds", "result"];
  const rows = bets.map(b => [b.id, b.date, b.event, b.stake, b.odds, b.result]);
  const csv = [header, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "apostas.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function importCSV(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const lines = reader.result.split(/\r?\n/).filter(Boolean);
    // Se o arquivo tem header, pular primeira linha (verifica se primeira linha tem "date" ou "id")
    if (lines.length && /date|id/i.test(lines[0])) lines.shift();
    lines.forEach(line => {
      const [id, date, event, stake, odds, result] = line.split(",");
      if (!date) return;
      bets.push({ id: id || Date.now(), date, event, stake: parseNumber(stake), odds: parseNumber(odds), result: result || "pending" });
    });
    saveBets();
    renderBets();
  };
  reader.readAsText(file);
}

// ---------- SAQUES (persistência) ----------
// ---------- SAQUES (persistência) ----------
function renderSaques() {
  if (!listaSaques) return;
  listaSaques.innerHTML = "";

  saques.forEach(s => {
    const tr = document.createElement("tr");
    // guarda o id da linha para a delegação de eventos
    tr.dataset.id = s.id;
    tr.innerHTML = `
      <td>${s.data}</td>
      <td>R$ ${formatBR(s.valor)}</td>
      <td>${s.obs || "-"}</td>
      <td>
        <button type="button" class="btn-remove-saque" aria-label="Remover saque" style="color:red; font-weight:bold;">Remover</button>
      </td>
    `;
    listaSaques.appendChild(tr);
  });
}

// função única e global para remover saque
function removeSaque(id) {
  if (!confirm("Tem certeza que deseja remover este saque?")) return;
  saques = saques.filter(s => s.id !== id);
  saveSaques();
  renderSaques();
}

// delegação de evento: adiciona apenas UMA vez (fora do render)
if (listaSaques) {
  // remova quaisquer listeners duplicados anteriores se houver (opcional)
  // listaSaques.replaceWith(listaSaques.cloneNode(true)); // só se necessário

  listaSaques.addEventListener("click", function (e) {
    const btn = e.target.closest(".btn-remove-saque");
    if (!btn) return;
    const tr = btn.closest("tr");
    if (!tr) return;
    const id = Number(tr.dataset.id);
    if (!isFinite(id)) return;
    removeSaque(id);
  });
}

function addSaque(e) {
  e.preventDefault();
  const data = document.getElementById('saqueData') ? document.getElementById('saqueData').value : "";
  const valorRaw = document.getElementById('saqueValor') ? document.getElementById('saqueValor').value : "";
  const valor = parseNumber(valorRaw);
  const obs = document.getElementById('saqueObs') ? document.getElementById('saqueObs').value.trim() : "-";

  if (!data || valor <= 0) {
    alert("Preencha data e valor do saque corretamente.");
    return;
  }

  saques.push({ id: Date.now(), data, valor, obs: obs || "-" });
  saveSaques();
  renderSaques();
  saqueForm.reset();
}

// inicializa a renderização (se já não estiver no final do arquivo)
renderSaques();

// --------- RESUMO POR DIA ---------
const filtroData = document.getElementById("filtroData");
const resumoDiaBody = document.getElementById("resumoDiaBody");

if (filtroData) {
  filtroData.addEventListener("change", () => renderResumoDia(filtroData.value));
}

function renderResumoDia(dateFilter) {
  if (!resumoDiaBody) return;
  resumoDiaBody.innerHTML = "";

  // Agrupar apostas por data
  const grouped = {};
  bets.forEach(b => {
    if (!b.date) return;
    const profit = calcProfit(b);
    if (!grouped[b.date]) grouped[b.date] = { lucro: 0, perda: 0 };
    if (profit > 0) grouped[b.date].lucro += profit;
    if (profit < 0) grouped[b.date].perda += Math.abs(profit);
  });

  // Se foi aplicado filtro, mostra só aquele dia
  const dates = dateFilter ? [dateFilter] : Object.keys(grouped).sort().reverse();

  dates.forEach(d => {
    const lucro = grouped[d]?.lucro || 0;
    const perda = grouped[d]?.perda || 0;
    const total = lucro - perda;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d}</td>
      <td style="color:green">R$ ${formatBR(lucro)}</td>
      <td style="color:red">R$ ${formatBR(perda)}</td>
      <td style="color:${total >= 0 ? "green" : "red"}">R$ ${formatBR(total)}</td>
    `;
    resumoDiaBody.appendChild(tr);
  });

  
}

// inicializar resumo do dia
renderResumoDia();


// ---------- INICIALIZAÇÃO ----------
renderBets();
renderSaques();

// Se quiser, atualiza também contador de apostas sempre que mudar bets
// (já feito em renderBets)
