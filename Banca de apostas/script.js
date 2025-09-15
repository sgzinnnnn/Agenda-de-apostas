let bets = JSON.parse(localStorage.getItem("apostas_v2") || "[]");
const form=document.getElementById("betForm");
const betTable=document.getElementById("betTable");
const filter=document.getElementById("filter");
const search=document.getElementById("search");
const sort=document.getElementById("sort");
const chartCanvas=document.getElementById("chart");
const ctx=chartCanvas.getContext("2d");

form.addEventListener("submit",addBet);
document.getElementById("exportBtn").addEventListener("click",exportCSV);
document.getElementById("importFile").addEventListener("change",e=>importCSV(e.target.files[0]));
filter.addEventListener("change",render);
search.addEventListener("input",render);
sort.addEventListener("change",render);

function parseNumber(v){ const n=parseFloat(v); return isNaN(n)?0:n; }
function calcProfit(bet){
  if(bet.result==="win") return bet.stake*(bet.odds-1);
  if(bet.result==="loss") return -bet.stake;
  return 0; // Pendente
}
function save(){ localStorage.setItem("apostas_v2",JSON.stringify(bets)); }

function addBet(e){
  e.preventDefault();
  const newBet={id:Date.now(),date:document.getElementById("date").value,event:document.getElementById("event").value,stake:parseNumber(document.getElementById("stake").value),odds:parseNumber(document.getElementById("odds").value),result:document.getElementById("result").value};
  bets.unshift(newBet);
  save();
  form.reset();
  render();
}

function removeBet(id){ if(confirm("Remover aposta?")){ bets=bets.filter(b=>b.id!==id); save(); render(); } }
function toggleResult(id){ bets=bets.map(b=>{ if(b.id===id){ if(b.result==="pending")b.result="win"; else if(b.result==="win")b.result="loss"; else b.result="pending"; } return b; }); save(); render(); }
function cashOut(id){ const bet=bets.find(b=>b.id===id); if(!bet)return; const currentProfit = prompt("Valor do Cash Out", calcProfit(bet)); if(currentProfit!==null){ bet.result="win"; bet.stake=parseNumber(currentProfit)/(bet.odds-1); save(); render(); } }

function render(){
  let filtered=bets.filter(b=>filter.value==="all"||b.result===filter.value);
  if(search.value) filtered=filtered.filter(b=>b.event.toLowerCase().includes(search.value.toLowerCase()));
  if(sort.value==="date_desc") filtered.sort((a,b)=>b.date.localeCompare(a.date));
  if(sort.value==="date_asc") filtered.sort((a,b)=>a.date.localeCompare(b.date));
  if(sort.value==="profit_desc") filtered.sort((a,b)=>calcProfit(b)-calcProfit(a));
  if(sort.value==="profit_asc") filtered.sort((a,b)=>calcProfit(a)-calcProfit(b));

  betTable.innerHTML="";
  filtered.forEach(b=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${b.date}</td><td>${b.event}</td><td>R$ ${b.stake.toFixed(2)}</td><td>${b.odds.toFixed(2)}</td><td>${b.result}</td><td>R$ ${calcProfit(b).toFixed(2)}</td><td class="actions"><button onclick="toggleResult(${b.id})">Toggle</button><button onclick="cashOut(${b.id})">Cash Out</button><button onclick="removeBet(${b.id})" style="color:red">Remover</button></td>`;
    betTable.appendChild(tr);
  });

  updateResumo();
  renderChart();
}

function updateResumo(){
  let lucro=0, perda=0;
  bets.forEach(bet=>{ const profit=calcProfit(bet); if(profit>0) lucro+=profit; if(profit<0) perda+=Math.abs(profit); });
  const total=lucro-perda;
  document.getElementById("lucro").textContent=`Lucro: R$ ${lucro.toFixed(2)}`;
  document.getElementById("perda").textContent=`Perda: R$ ${perda.toFixed(2)}`;
  document.getElementById("total").textContent=`Total: R$ ${total.toFixed(2)}`;
}

let animationProgress=0, animating=false;
function renderChart(){
  const lucro=bets.reduce((acc,b)=>{ const p=calcProfit(b); return p>0?acc+p:acc; },0);
  const perda=bets.reduce((acc,b)=>{ const p=calcProfit(b); return p<0?acc+Math.abs(p):acc; },0);
  const maxValue=Math.max(lucro,perda,1),padding=30,barWidth=80,barSpacing=50,chartHeight=chartCanvas.height-padding*2;
  if(!animating){ animationProgress=0; animating=true; animateChart(lucro,perda,maxValue,padding,barWidth,barSpacing,chartHeight); }
}
function animateChart(lucro,perda,maxValue,padding,barWidth,barSpacing,chartHeight){
  ctx.clearRect(0,0,chartCanvas.width,chartCanvas.height);
  animationProgress+=0.05;
  if(animationProgress>1) animationProgress=1;
  const lucroHeight=((lucro/maxValue)*chartHeight)*animationProgress;
  const perdaHeight=((perda/maxValue)*chartHeight)*animationProgress;
  ctx.fillStyle="#27ae60"; ctx.fillRect(padding,chartCanvas.height-padding-lucroHeight,barWidth,lucroHeight);
  ctx.fillStyle="#000"; ctx.font="14px Arial"; ctx.textAlign="center";
  ctx.fillText(`R$ ${(lucro*animationProgress).toFixed(2)}`,padding+barWidth/2,chartCanvas.height-padding-lucroHeight-5);
  ctx.fillText("Lucro",padding+barWidth/2,chartCanvas.height-padding+15);
  const perdaX=padding+barWidth+barSpacing;
  ctx.fillStyle="#c0392b"; ctx.fillRect(perdaX,chartCanvas.height-padding-perdaHeight,barWidth,perdaHeight);
  ctx.fillStyle="#000"; ctx.fillText(`R$ ${(perda*animationProgress).toFixed(2)}`,perdaX+barWidth/2,chartCanvas.height-padding-perdaHeight-5);
  ctx.fillText("Perda",perdaX+barWidth/2,chartCanvas.height-padding+15);
  ctx.strokeStyle="#ddd"; ctx.lineWidth=1; ctx.beginPath();
  for(let i=0;i<=5;i++){ const y=chartCanvas.height-padding-(i/5)*chartHeight; ctx.moveTo(padding-10,y); ctx.lineTo(perdaX+barWidth+10,y); } ctx.stroke();
  if(animationProgress<1){ requestAnimationFrame(()=>animateChart(lucro,perda,maxValue,padding,barWidth,barSpacing,chartHeight)); } else { animating=false; }
}

function exportCSV(){
  const header=["id","date","event","stake","odds","result"];
  const rows=bets.map(b=>[b.id,b.date,b.event,b.stake,b.odds,b.result]);
  const csv=[header,...rows].map(r=>r.join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download="apostas.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function importCSV(file){
  const reader=new FileReader();
  reader.onload=()=>{
    const lines=reader.result.split(/\r?\n/).filter(Boolean);
    lines.shift(); // remove header
    lines.forEach(line=>{
      const [id,date,event,stake,odds,result]=line.split(",");
      bets.push({id,date,event,stake:parseNumber(stake),odds:parseNumber(odds),result});
    });
    save(); render();
  };
  reader.readAsText(file);
}

render();

