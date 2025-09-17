// script.js (substitua todo o arquivo existente por este)
let bets = JSON.parse(localStorage.getItem("apostas_v2") || "[]");

// Utilitários
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

// normaliza valores carregados do localStorage
bets = bets.map(b => ({
  ...b,
  stake: parseNumber(b.stake),
  odds: parseNumber(b.odds)
}));

// elementos DOM
const form = document.getElementById("betForm");
const betTable = document.getElementById("betTable");
const filter = document.getElementById("filter");
const search = document.getElementById("search");
const sort = document.getElementById("sort");
const chartCanvas = document.getElementById("chart");
const ctx = chartCanvas ? chartCanvas.getContext("2d") : null;

// listeners
if (form) form.addEventListener("submit", addBet);
const exportBtn = document.getElementById("exportBtn");
if (exportBtn) exportBtn.addEventListener("click", exportCSV);
const importFile = document.getElementById("importFile");
if (importFile) importFile.addEventListener("change", e => importCSV(e.target.files[0]));
if (filter) filter.addEventListener("change", render);
if (search) search.addEventListener("input", render);
if (sort) sort.addEventListener("change", render);

// cálculo de lucro (lucro líquido)
function calcProfit(bet) {
  if (!bet) return 0;
  const stake = parseNumber(bet.stake);
  const odds = parseNumber(bet.odds);
  if (bet.result === "win") return stake * (odds - 1);
  if (bet.result === "loss") return -stake;
  // pendente → mostrar lucro potencial
  if (bet.result === "pending") return stake * (odds - 1);
  return 0;
}

function save() {
  localStorage.setItem("apostas_v2", JSON.stringify(bets));
}

function addBet(e) {
  e.preventDefault();
  const newBet = {
    id: Date.now(),
    date: document.getElementById("date").value,
    event: document.getElementById("event").value,
    stake: parseNumber(document.getElementById("stake").value),
    odds: parseNumber(document.getElementById("odds").value),
    result: document.getElementById("result").value
  };
  bets.unshift(newBet);
  save();
  form.reset();
  render();
}

function removeBet(id) {
  if (!confirm("Remover aposta?")) return;
  bets = bets.filter(b => b.id !== id);
  save();
  render();
}

function toggleResult(id) {
  bets = bets.map(b => {
    if (b.id === id) {
      if (b.result === "pending") b.result = "win";
      else if (b.result === "win") b.result = "loss";
      else b.result = "pending";
    }
    return b;
  });
  save();
  render();
}

function cashOut(id) {
  const bet = bets.find(b => b.id === id);
  if (!bet) return;
  const currentProfit = prompt("Valor do Cash Out (ex: 50,00)", formatBR(calcProfit(bet)));
  if (currentProfit !== null) {
    // converte o valor do cashout para número e calcula novo stake equivalente
    const profitNum = parseNumber(currentProfit);
    // evita divisão por zero
    if (bet.odds - 1 === 0) {
      alert("Odds inválida para Cash Out.");
      return;
    }
    bet.result = "win";
    bet.stake = profitNum / (bet.odds - 1);
    save();
    render();
  }
}

function render() {
  if (!betTable) return;
  let filtered = bets.filter(b => (filter ? filter.value === "all" || b.result === filter.value : true));
  if (search && search.value) filtered = filtered.filter(b => b.event && b.event.toLowerCase().includes(search.value.toLowerCase()));
  if (sort) {
    if (sort.value === "date_desc") filtered.sort((a, b) => b.date.localeCompare(a.date));
    if (sort.value === "date_asc") filtered.sort((a, b) => a.date.localeCompare(b.date));
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
      <td class="actions">
        <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center;">
          <button class="btn-toggle">Toggle</button>
          <button class="btn-cashout">Cash Out</button>
          <button class="btn-remove" style="color:red">Remover</button>
        </div>
      </td>
    `;
    // adiciona listeners nos botões (evita problemas com onclick em string)
    const btnToggle = tr.querySelector(".btn-toggle");
    const btnCash = tr.querySelector(".btn-cashout");
    const btnRemove = tr.querySelector(".btn-remove");
    if (btnToggle) btnToggle.addEventListener("click", () => toggleResult(b.id));
    if (btnCash) btnCash.addEventListener("click", () => cashOut(b.id));
    if (btnRemove) btnRemove.addEventListener("click", () => removeBet(b.id));

    betTable.appendChild(tr);
  });

  updateResumo();
  if (ctx) renderChart();
}

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

// gráfico animado (se houver canvas)
let animationProgress = 0, animating = false;
function renderChart() {
  const lucro = bets.reduce((acc, b) => { const p = calcProfit(b); return p > 0 ? acc + p : acc; }, 0);
  const perda = bets.reduce((acc, b) => { const p = calcProfit(b); return p < 0 ? acc + Math.abs(p) : acc; }, 0);
  const total = bets.reduce((acc, b) => { const p = calcProfit(b); return p < 0 ? acc + Math.abs(p) : acc; }, 0);
  const maxValue = Math.max(lucro, perda, 1);
  const padding = 30;
  const barWidth = 80;
  const barSpacing = 50;
  const chartHeight = chartCanvas.height - padding * 2;
  if (!animating) {
    animationProgress = 0;
    animating = true;
    animateChart(lucro, perda, maxValue, padding, barWidth, barSpacing, chartHeight);
  }
  function render(){
    if (!betTable) return;
  
    // filtra e ordena
    let filtered = bets.filter(b => filter ? (filter.value === "all" || b.result === filter.value) : true);
    if (search && search.value) filtered = filtered.filter(b => b.event && b.event.toLowerCase().includes(search.value.toLowerCase()));
    if (sort) {
      if (sort.value === "date_desc") filtered.sort((a,b)=>b.date.localeCompare(a.date));
      if (sort.value === "date_asc") filtered.sort((a,b)=>a.date.localeCompare(b.date));
      if (sort.value === "profit_desc") filtered.sort((a,b)=>calcProfit(b)-calcProfit(a));
      if (sort.value === "profit_asc") filtered.sort((a,b)=>calcProfit(a)-calcProfit(b));
    }
  
    betTable.innerHTML = "";
  
    // percorre apostas filtradas e cria linhas
    filtered.forEach(b => {
      const stake = parseNumber(b.stake);
      const odds = parseNumber(b.odds);
  
      // Total ganho é apenas stake * odds
      const totalGanho = stake * odds;  // sem subtrair o valor apostado
  
      // Lucro é calculado normalmente (stake * (odds - 1))
      const lucro = calcProfit(b); 
  
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${b.date || ""}</td>
        <td>${b.event || ""}</td>
        <td>R$ ${formatBR(stake)}</td>
        <td>${formatOdds(odds)}</td>
        <td>${b.result || ""}</td>
        <td>R$ ${formatBR(totalGanho)}</td>  <!-- Total ganho -->
        <td>R$ ${formatBR(lucro)}</td>      <!-- Lucro -->
        <td class="actions">
          <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center;">
            <button class="btn-toggle">Toggle</button>
            <button class="btn-cashout">Cash Out</button>
            <button class="btn-remove" style="color:red">Remover</button>
          </div>
        </td>
      `;
  
      // listeners para os botões (mais seguro que usar onclick na string)
      const btnToggle = tr.querySelector(".btn-toggle");
      const btnCash = tr.querySelector(".btn-cashout");
      const btnRemove = tr.querySelector(".btn-remove");
      if (btnToggle) btnToggle.addEventListener("click", () => toggleResult(b.id));
      if (btnCash) btnCash.addEventListener("click", () => cashOut(b.id));
      if (btnRemove) btnRemove.addEventListener("click", () => removeBet(b.id));
  
      betTable.appendChild(tr);
    });
  
    // linha total (opcional) — soma stake e soma lucros do conjunto filtrado
    if (filtered.length > 0) {
      let somaStake = 0, somaLucro = 0, somaTotalGanho = 0;
      filtered.forEach(b => {
        somaStake += parseNumber(b.stake);
        somaLucro += calcProfit(b);
        somaTotalGanho += parseNumber(b.stake) * parseNumber(b.odds); // Soma total ganho
      });
      const trTotal = document.createElement("tr");
      trTotal.style.fontWeight = "700";
      trTotal.style.backgroundColor = "#f2f6fb";
      trTotal.innerHTML = `
        <td colspan="2">TOTAL</td>
        <td>R$ ${formatBR(somaStake)}</td>
        <td>-</td>
        <td>-</td>
        <td>R$ ${formatBR(somaTotalGanho)}</td>  <!-- Total ganho -->
        <td>R$ ${formatBR(somaLucro)}</td>      <!-- Lucro -->
        <td></td>
      `;
      betTable.appendChild(trTotal);
    }
  
    updateResumo();
    if (ctx) renderChart();
  }
  
}
function animateChart(lucro, perda, maxValue, padding, barWidth, barSpacing, chartHeight) {
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
  if (animationProgress < 1) requestAnimationFrame(() => animateChart(lucro, perda, maxValue, padding, barWidth, barSpacing, chartHeight));
  else animating = false;
}

// CSV
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
    lines.shift(); // header
    lines.forEach(line => {
      const [id, date, event, stake, odds, result] = line.split(",");
      bets.push({ id, date, event, stake: parseNumber(stake), odds: parseNumber(odds), result });
    });
    save();
    render();
  };
  reader.readAsText(file);
}

// inicializa
render();

