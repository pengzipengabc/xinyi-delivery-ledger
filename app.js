const STORAGE_KEY = "xinyi-delivery-ledger-v1";
const seedReceipts = [
  {id:"r4233",date:"2026-07-28",no:"0004233",written:14592.80,calculated:14592.80,note:"",imageCount:1,items:[]},
  {id:"r4234",date:"2026-08-01",no:"0004234",written:4018.00,calculated:4018.00,note:"前两行金额在原单上合并填写",imageCount:1,items:[]},
  {id:"r0817",date:"2026-08-17",no:"未识别-20260817",written:2158.50,calculated:2158.50,note:"单号被遮挡，疑似0004238",imageCount:1,items:[]},
  {id:"r4239",date:"2026-08-19",no:"0004239",written:1950.00,calculated:1950.00,note:"",imageCount:1,items:[]},
  {id:"r4242",date:"2026-08-27",no:"0004242",written:6449.80,calculated:6449.80,note:"",imageCount:1,items:[]},
  {id:"r4243",date:"2026-08-31",no:"0004243",written:3117.30,calculated:3117.30,note:"",imageCount:1,items:[]},
  {id:"r4244",date:"2026-09-01",no:"0004244",written:4004.00,calculated:4004.00,note:"",imageCount:1,items:[]},
  {id:"r4245",date:"2026-09-02",no:"0004245",written:3377.50,calculated:3377.50,note:"",imageCount:1,items:[]},
  {id:"r4248",date:"2026-09-08",no:"0004248",written:14518.40,calculated:12308.50,note:"同一单据有3张照片，仅计入一次",imageCount:3,items:[
    {name:"四轮",qty:263,price:18.1},{name:"四轮",qty:206,price:13.1},{name:"两轮",qty:120,price:12.6},{name:"100坦克轮",qty:938,price:2},{name:"68坦克轮",qty:938,price:1.2},{name:"80坦克轮",qty:240,price:1.4}
  ]},
  {id:"r4249",date:"2026-09-16",no:"0004249",written:5153.50,calculated:5153.50,note:"",imageCount:1,items:[]},
  {id:"r4250",date:"2026-09-19",no:"0004250",written:7779.40,calculated:7779.40,note:"一项品名手写不清，按数量271、单价1.5复算",imageCount:1,items:[]},
  {id:"r4251",date:"2026-09-23",no:"0004251",written:4533.30,calculated:4533.30,note:"",imageCount:1,items:[]}
];

let receipts = loadReceipts();
let scanImageUrl = null;
let scanParsed = null;
let scanWorker = null;
let scanCancelled = false;
const $ = (id) => document.getElementById(id);
const money = (value) => new Intl.NumberFormat("zh-CN", {style:"currency",currency:"CNY",minimumFractionDigits:2}).format(Number(value)||0);
const num = (value) => Math.round((Number(value)||0)*100)/100;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const formatDate = (date) => new Intl.DateTimeFormat("zh-CN", {year:"numeric",month:"long",day:"numeric",timeZone:"Asia/Shanghai"}).format(new Date(`${date}T12:00:00+08:00`));

function loadReceipts(){
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); return Array.isArray(saved) ? saved : JSON.parse(JSON.stringify(seedReceipts)); }
  catch { return JSON.parse(JSON.stringify(seedReceipts)); }
}
function saveReceipts(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts)); }
function difference(r){ return num(r.written-r.calculated); }
function sortedReceipts(list=receipts){ return [...list].sort((a,b)=>a.date.localeCompare(b.date)||a.no.localeCompare(b.no)); }

function render(){
  const totalWritten = num(receipts.reduce((s,r)=>s+Number(r.written||0),0));
  const totalCalculated = num(receipts.reduce((s,r)=>s+Number(r.calculated||0),0));
  $("calcTotal").textContent = money(totalCalculated);
  $("writtenTotal").textContent = money(totalWritten);
  $("differenceTotal").textContent = money(num(totalWritten-totalCalculated));
  $("receiptCount").textContent = `${receipts.length} 张独立单据`;
  renderMonthOptions();

  const query = $("searchInput").value.trim().toLowerCase();
  const month = $("monthFilter").value;
  const status = $("statusFilter").value;
  const filtered = sortedReceipts().filter(r => {
    const matchesQuery = !query || `${r.no} ${r.note||""}`.toLowerCase().includes(query);
    const matchesMonth = month === "all" || r.date.startsWith(month);
    const isError = Math.abs(difference(r)) >= .01;
    const matchesStatus = status === "all" || (status === "error" ? isError : !isError);
    return matchesQuery && matchesMonth && matchesStatus;
  });
  $("visibleCount").textContent = `${filtered.length} 张`;
  $("emptyState").hidden = filtered.length > 0;
  $("receiptList").innerHTML = filtered.map(r => {
    const diff = difference(r); const error = Math.abs(diff) >= .01;
    return `<article class="receipt-card ${error?"is-error":""}">
      <div class="receipt-top"><div><div class="receipt-date">${formatDate(r.date)}</div><div class="receipt-no">${escapeHtml(r.no)}</div></div><span class="status ${error?"error":""}">${error?"金额异常":"金额一致"}</span></div>
      <div class="receipt-totals"><div class="money-block"><span>复算合计</span><strong>${money(r.calculated)}</strong></div><div class="money-block"><span>${error?"手写多计":"手写合计"}</span><strong class="${error?"difference":""}">${error?money(diff):money(r.written)}</strong></div></div>
      ${r.imageCount>1?`<p class="receipt-note">照片 ${r.imageCount} 张，统计时只计一次</p>`:""}
      ${r.note?`<p class="receipt-note">${escapeHtml(r.note)}</p>`:""}
      <div class="receipt-actions"><button type="button" data-edit="${escapeHtml(r.id)}">查看 / 编辑</button></div>
    </article>`;
  }).join("");
  document.querySelectorAll("[data-edit]").forEach(btn=>btn.addEventListener("click",()=>openForm(btn.dataset.edit)));
}

function renderMonthOptions(){
  const select=$("monthFilter"); const current=select.value;
  const months=[...new Set(receipts.map(r=>r.date.slice(0,7)))].sort();
  select.innerHTML='<option value="all">全部月份</option>'+months.map(m=>`<option value="${m}">${m.replace("-","年")}月</option>`).join("");
  select.value=months.includes(current)?current:"all";
}

function showSheet(sheet,backdrop){ backdrop.hidden=false; sheet.classList.add("open"); sheet.setAttribute("aria-hidden","false"); document.body.style.overflow="hidden"; }
function hideSheet(sheet,backdrop){ sheet.classList.remove("open"); sheet.setAttribute("aria-hidden","true"); setTimeout(()=>{backdrop.hidden=true},220); document.body.style.overflow=""; }
function openForm(id=null){
  $("receiptForm").reset(); $("lineItems").innerHTML=""; $("editingId").value=id||""; $("deleteBtn").hidden=!id;
  $("formTitle").textContent=id?"编辑送货单":"新增送货单";
  const r=receipts.find(x=>x.id===id);
  if(r){ $("receiptDate").value=r.date; $("receiptNo").value=r.no; $("receiptWritten").value=r.written; $("receiptCalculated").value=r.calculated; $("receiptNote").value=r.note||""; (r.items||[]).forEach(addLineItem); }
  else { $("receiptDate").value=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Shanghai"}); $("receiptCalculated").value=""; }
  updateFormTotals(); checkDuplicate(); showSheet($("receiptFormSheet"),$("formBackdrop"));
}
function closeForm(){ hideSheet($("receiptFormSheet"),$("formBackdrop")); }

function addLineItem(item={name:"",qty:"",price:""}){
  const row=document.createElement("div"); row.className="line-item";
  row.innerHTML=`<div class="line-item-top"><input class="line-name" aria-label="品名" placeholder="品名 / 规格" value="${escapeHtml(item.name)}"><button type="button" class="remove-line" aria-label="删除这一项">×</button></div><div class="line-item-numbers"><input class="line-qty" type="number" min="0" step="1" inputmode="decimal" aria-label="数量" placeholder="数量" value="${item.qty??""}"><input class="line-price" type="number" min="0" step="0.01" inputmode="decimal" aria-label="单价" placeholder="单价" value="${item.price??""}"><span class="line-amount">${money(num((item.qty||0)*(item.price||0)))}</span></div>`;
  row.querySelector(".remove-line").addEventListener("click",()=>{row.remove(); updateLinesTotal()});
  row.querySelectorAll("input").forEach(input=>input.addEventListener("input",updateLinesTotal));
  $("lineItems").appendChild(row); updateLinesTotal(false);
}
function getLineItems(){ return [...document.querySelectorAll(".line-item")].map(row=>({name:row.querySelector(".line-name").value.trim(),qty:num(row.querySelector(".line-qty").value),price:num(row.querySelector(".line-price").value)})).filter(i=>i.name||i.qty||i.price); }
function updateLinesTotal(write=true){
  let total=0; document.querySelectorAll(".line-item").forEach(row=>{const amount=num(row.querySelector(".line-qty").value*row.querySelector(".line-price").value);row.querySelector(".line-amount").textContent=money(amount);total+=amount});
  if(write&&document.querySelectorAll(".line-item").length){$("receiptCalculated").value=num(total).toFixed(2)} updateFormTotals();
}
function updateFormTotals(){ $("formDifference").textContent=money(num($("receiptWritten").value-$("receiptCalculated").value)); }
function checkDuplicate(){ const id=$("editingId").value; const no=$("receiptNo").value.trim(); $("duplicateWarning").hidden=!no||!receipts.some(r=>r.no===no&&r.id!==id); }

function normalizeOcrText(text){
  return String(text||"")
    .replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248))
    .replace(/[ＯO〇○]/g,"0")
    .replace(/[，,。·]/g,".")
    .replace(/(\d)\s*[.．]\s*(\d)/g,"$1.$2")
    .replace(/[ \t]+/g," ")
    .replace(/\n{3,}/g,"\n\n")
    .trim();
}

function parseOcrText(rawText){
  const text=normalizeOcrText(rawText);
  const lines=text.split(/\n+/).map(line=>line.trim()).filter(Boolean);
  let date="";
  const dateMatch=text.match(/(20\d{2})\s*[年/\-.]\s*(\d{1,2})\s*[月/\-.]\s*(\d{1,2})\s*日?/);
  if(dateMatch){
    const year=dateMatch[1],month=String(Math.min(12,Number(dateMatch[2]))).padStart(2,"0"),day=String(Math.min(31,Number(dateMatch[3]))).padStart(2,"0");
    date=`${year}-${month}-${day}`;
  }

  let no="";
  const labeledLine=lines.find(line=>/(送货单|N[O0])/i.test(line));
  const labeledNo=labeledLine?.replace(/\s/g,"").match(/0{2,}\d{3,6}/);
  const genericNo=text.replace(/\s/g,"").match(/(?:^|\D)(0{2,}\d{3,6})(?:\D|$)/m);
  const noCandidate=(labeledNo?.[0]||genericNo?.[1]||"").replace(/\D/g,"");
  if(noCandidate.length>=6&&noCandidate.length<=8)no=noCandidate;

  const skipLine=/(送货单|地址|电话|传真|手机|收货单位|名称及规格|单位|数量|单价|金额|合计|备注|经手人|质量问题)/;
  const items=[];
  for(const line of lines){
    if(skipLine.test(line))continue;
    const tokens=[...line.matchAll(/\d+(?:\.\d+)?/g)];
    if(tokens.length<2)continue;
    const picked=tokens.length>=3?tokens.slice(-3):tokens.slice(-2);
    const qty=Number(picked[0][0]),price=Number(picked[1][0]);
    const stated=picked[2]?Number(picked[2][0]):null;
    if(!Number.isFinite(qty)||!Number.isFinite(price)||qty<=0||price<=0||qty>100000||price>1000)continue;
    if(stated!==null){const expected=qty*price;if(Math.abs(expected-stated)>Math.max(3,expected*.08))continue;}
    let name=line.slice(0,picked[0].index).replace(/[|丨支个\s:：]+$/g,"").trim();
    name=name.replace(/^[^0-9A-Za-z\u4e00-\u9fff]+/,"").trim()||"未识别品名";
    if(name.length>24)name=name.slice(-24);
    items.push({name,qty:num(qty),price:num(price)});
  }

  let written=0;
  const totalLines=lines.filter(line=>/(合计|总计|￥|¥)/.test(line));
  for(const line of totalLines.reverse()){
    const values=[...line.matchAll(/\d+(?:\.\d+)?/g)].map(m=>Number(m[0])).filter(v=>v>=10&&v<1000000);
    if(values.length){written=values.at(-1);break;}
  }
  const calculated=num(items.reduce((sum,item)=>sum+item.qty*item.price,0));
  if(!written&&calculated)written=calculated;
  return {text,date,no,written:num(written),calculated,items};
}

function setScanProgress(percent,status,hint){
  const bounded=Math.max(0,Math.min(100,Math.round(percent)));
  $("scanProgressBar").style.width=`${bounded}%`;
  $("scanPercent").textContent=`${bounded}%`;
  if(status)$("scanStatus").textContent=status;
  if(hint)$("scanHint").textContent=hint;
}

function statusText(status){
  return ({"loading tesseract core":"载入识别引擎","initializing tesseract":"初始化识别引擎","loading language traineddata":"载入中文模型","initializing api":"准备中文识别","recognizing text":"正在读取照片"})[status]||"正在本地识别";
}

function showScanResult(parsed){
  scanParsed=parsed;
  $("scanRawText").value=parsed.text;
  const chips=[
    {ok:!!parsed.date,text:parsed.date?`日期 ${parsed.date}`:"日期未识别"},
    {ok:!!parsed.no,text:parsed.no?`单号 ${parsed.no}`:"单号未识别"},
    {ok:parsed.items.length>0,text:parsed.items.length?`明细 ${parsed.items.length} 项`:"明细未识别"},
    {ok:parsed.written>0,text:parsed.written?`手写合计 ${money(parsed.written)}`:"合计未识别"}
  ];
  $("scanSummary").innerHTML=chips.map(chip=>`<span class="${chip.ok?"":"missing"}">${escapeHtml(chip.text)}</span>`).join("");
  $("scanResult").hidden=false;
  $("useScanBtn").disabled=false;
}

async function preprocessImage(file){
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||new Error("无法读取照片"));reader.readAsDataURL(file)});
  scanImageUrl=dataUrl;
  $("scanPreview").src=dataUrl;
  const image=new Image();
  image.src=dataUrl;
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error("无法解码这张照片，请尝试截图后重新选择"))});
  const maxSide=1900;
  const scale=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  const data=pixels.data;
  for(let i=0;i<data.length;i+=4){
    const gray=.299*data[i]+.587*data[i+1]+.114*data[i+2];
    const value=Math.max(0,Math.min(255,(gray-128)*1.35+128));
    data[i]=data[i+1]=data[i+2]=value;
  }
  ctx.putImageData(pixels,0,0);
  return canvas;
}

async function recognizeReceipt(file){
  scanCancelled=false; scanParsed=null;
  $("scanResult").hidden=true; $("useScanBtn").disabled=true;
  setScanProgress(2,"正在准备照片…","照片只在本机处理，不会上传服务器。");
  showSheet($("scanSheet"),$("scanBackdrop"));
  try{
    if(!window.Tesseract)throw new Error("离线识别组件未加载，请刷新网页后重试。");
    const canvas=await preprocessImage(file);
    setScanProgress(6,"正在载入离线模型…","第一次需要下载约 25MB，之后浏览器会自动缓存。");
    const base=new URL("./",location.href);
    scanWorker=await Tesseract.createWorker("chi_sim",1,{
      workerPath:new URL("vendor/tesseract/worker.min.js",base).href,
      corePath:new URL("vendor/tesseract-core/",base).href,
      langPath:new URL("vendor/lang-data/",base).href,
      workerBlobURL:false,
      logger(message){
        const phase=message.status||"";
        const phaseBase=phase.includes("recognizing")?55:phase.includes("language")?28:phase.includes("initializing api")?45:12;
        const phaseRange=phase.includes("recognizing")?43:phase.includes("language")?18:12;
        setScanProgress(phaseBase+(message.progress||0)*phaseRange,statusText(phase));
      }
    });
    await scanWorker.setParameters({tessedit_pageseg_mode:"6",preserve_interword_spaces:"1",user_defined_dpi:"200"});
    const result=await scanWorker.recognize(canvas);
    await scanWorker.terminate(); scanWorker=null;
    if(scanCancelled)return;
    const parsed=parseOcrText(result.data.text);
    setScanProgress(100,"识别完成","请核对识别结果，确认无误后再保存。");
    showScanResult(parsed);
  }catch(error){
    console.error("本地OCR识别失败",error);
    if(scanWorker){try{await scanWorker.terminate()}catch{}scanWorker=null;}
    if(scanCancelled)return;
    const message=error?.message||String(error||"")||"请重新选择一张清晰、正面拍摄的照片。";
    setScanProgress(0,"识别失败",message);
    $("scanResult").hidden=true; $("useScanBtn").disabled=true;
  }
}

async function closeScan(){
  scanCancelled=true;
  if(scanWorker){try{await scanWorker.terminate()}catch{}scanWorker=null;}
  hideSheet($("scanSheet"),$("scanBackdrop"));
  $("scanPreview").removeAttribute("src"); scanImageUrl=null;
}

function useScanResult(){
  const parsed=parseOcrText($("scanRawText").value);
  closeScan();
  openForm();
  if(parsed.date)$("receiptDate").value=parsed.date;
  $("receiptNo").value=parsed.no||"";
  $("receiptWritten").value=parsed.written?parsed.written.toFixed(2):"";
  $("receiptCalculated").value=parsed.calculated?parsed.calculated.toFixed(2):"";
  $("receiptNote").value="照片本地识别录入，请保存前核对原单";
  $("lineItems").innerHTML="";
  parsed.items.forEach(addLineItem);
  updateLinesTotal(parsed.items.length>0);
  updateFormTotals(); checkDuplicate();
}

$("receiptForm").addEventListener("submit",e=>{
  e.preventDefault(); const id=$("editingId").value; const no=$("receiptNo").value.trim();
  if(receipts.some(r=>r.no===no&&r.id!==id)){showToast("单号重复，请先核对原记录");return;}
  const record={id:id||uid(),date:$("receiptDate").value,no,written:num($("receiptWritten").value),calculated:num($("receiptCalculated").value),note:$("receiptNote").value.trim(),imageCount:1,items:getLineItems()};
  if(id){receipts=receipts.map(r=>r.id===id?{...r,...record}:r)}else{receipts.push(record)} saveReceipts();render();closeForm();showToast(id?"已更新送货单":"已新增送货单");
});
$("deleteBtn").addEventListener("click",()=>{const id=$("editingId").value;if(!id)return;if(confirm("确定删除这张送货单吗？")){receipts=receipts.filter(r=>r.id!==id);saveReceipts();render();closeForm();showToast("记录已删除")}});

function download(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
function exportJson(){download(`信亿厂送货单备份_${new Date().toLocaleDateString("en-CA")}.json`,JSON.stringify({version:1,exportedAt:new Date().toISOString(),receipts},null,2),"application/json")}
function exportCsv(){const rows=[["日期","送货单号","手写合计","复算合计","差额","状态","备注"],...sortedReceipts().map(r=>[r.date,r.no,r.written,r.calculated,difference(r),Math.abs(difference(r))<.01?"一致":"金额异常",r.note||""])];download(`信亿厂送货单_${new Date().toLocaleDateString("en-CA")}.csv`,"\ufeff"+rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n"),"text/csv;charset=utf-8")}
function importJson(file){const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!Array.isArray(data.receipts))throw new Error();if(confirm(`将用备份中的 ${data.receipts.length} 张单据替换当前数据，是否继续？`)){receipts=data.receipts;saveReceipts();render();closeMenu();showToast("备份已恢复")}}catch{alert("无法读取这个备份文件，请选择本网页导出的 JSON 文件。")}};reader.readAsText(file)}

let toastTimer; function showToast(text){clearTimeout(toastTimer);$("toast").textContent=text;$("toast").classList.add("show");toastTimer=setTimeout(()=>$("toast").classList.remove("show"),2200)}
function openMenu(){showSheet($("menuSheet"),$("menuBackdrop"))} function closeMenu(){hideSheet($("menuSheet"),$("menuBackdrop"))}
$("addBtn").addEventListener("click",()=>openForm()); $("closeFormBtn").addEventListener("click",closeForm); $("formBackdrop").addEventListener("click",closeForm);
$("moreBtn").addEventListener("click",openMenu); $("closeMenuBtn").addEventListener("click",closeMenu); $("menuBackdrop").addEventListener("click",closeMenu);
$("addLineBtn").addEventListener("click",()=>addLineItem()); $("receiptWritten").addEventListener("input",updateFormTotals); $("receiptCalculated").addEventListener("input",updateFormTotals); $("receiptNo").addEventListener("input",checkDuplicate);
[$("searchInput"),$("monthFilter"),$("statusFilter")].forEach(el=>el.addEventListener(el.tagName==="INPUT"?"input":"change",render));
$("dismissNotice").addEventListener("click",()=>{$("storageNotice").remove();localStorage.setItem("xinyi-notice-dismissed","1")});
$("exportJsonBtn").addEventListener("click",exportJson); $("exportCsvBtn").addEventListener("click",exportCsv); $("importBtn").addEventListener("click",()=>$("importFile").click()); $("importFile").addEventListener("change",e=>e.target.files[0]&&importJson(e.target.files[0]));
$("installGuideBtn").addEventListener("click",()=>alert("在 iPhone Safari 中：点底部的“分享”按钮 → 向下滑动 → 选择“添加到主屏幕” → 点“添加”。"));
$("scanBtn").addEventListener("click",()=>$("scanFile").click());
$("rescanBtn").addEventListener("click",()=>$("scanFile").click());
$("closeScanBtn").addEventListener("click",closeScan);
$("scanBackdrop").addEventListener("click",closeScan);
$("useScanBtn").addEventListener("click",useScanResult);
$("scanFile").addEventListener("change",event=>{const file=event.target.files?.[0];if(file)recognizeReceipt(file).finally(()=>{event.target.value=""})});
if(localStorage.getItem("xinyi-notice-dismissed"))$("storageNotice").hidden=true;
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
render();
