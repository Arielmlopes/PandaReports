â•â•â•â•â•â•â•â•â•â•
function openUploadModal(){
  selType='post';upFiles=[];
  document.getElementById('up-desc').value='';
  document.getElementById('dz-files').innerHTML='';
  document.getElementById('preview-strip').innerHTML='';
  document.getElementById('dz-hint').textContent='PNG, JPG, MP4 Â· mÃºltiplos arquivos';
  const sel=document.getElementById('up-collab');
  sel.innerHTML='<option value="">â€” Selecionar â€”</option>'+COLLABS.map(c=>`<option value="${c.id}">${c.name}${c.role?' ('+c.role+')':''}</option>`).join('');
  document.getElementById('type-grid').innerHTML=TYPES.map(t=>`
    <div class="type-btn ${t.id==='post'?'sel':''}" onclick="pickType('${t.id}',this)">
      <span class="te">${t.emoji}</span><span class="tl">${t.label}</span>
    </div>`).join('');
  openOv('ov-upload');
}
function pickType(id,el){
  selType=id;document.querySelectorAll('.type-btn').forEach(b=>b.classList.remove('sel'));el.classList.add('sel');
  const hint=document.getElementById('dz-hint');
  if(id==='carousel')hint.textContent='MÃºltiplas imagens = 1 carrossel agrupado';
  else if(id==='video'||id==='reels')hint.textContent='MP4, MOV, AVI';
  else hint.textContent='PNG, JPG, GIF, WEBP';
}
function onDragOver(e){e.preventDefault();document.getElementById('dropzone').classList.add('drag')}
function onDragLeave(){document.getElementById('dropzone').classList.remove('drag')}
function onDrop(e){e.preventDefault();document.getElementById('dropzone').classList.remove('drag');handleFiles(e.dataTransfer.files)}
function onFileSelect(inp){handleFiles(inp.files);inp.value='';}
function handleFiles(files){
  Array.from(files).slice(0,30).forEach(f=>{upFiles.push({file:f,url:URL.createObjectURL(f),name:f.name,ft:getFileType(f)});});
  renderUpFiles();
}
function removeFile(i){URL.revokeObjectURL(upFiles[i].url);upFiles.splice(i,1);renderUpFiles();}
function renderUpFiles(){
  document.getElementById('dz-files').innerHTML=upFiles.map((f,i)=>`
    <div class="dz-file">
      <span>${f.ft==='video'?'ðŸŽ¬':'ðŸ–¼'}</span>
      <span class="fn">${f.name}</span>
      <span class="sz">${(f.file.size/1024).toFixed(0)} KB</span>
      <span class="rm" onclick="removeFile(${i})">Ã—</span>
    </div>`).join('');
  document.getElementById('preview-strip').innerHTML=upFiles.map(f=>
    f.ft==='image'?`<img class="p-thumb" src="${f.url}" alt="">`:`<div class="p-thumb-v">${FILE_TYPE_ICONS[f.ft]||'ðŸ“Ž'}</div>`).join('');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// LIGHTBOX & CAROUSEL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function findMat(id){for(const ms of Object.values(MATS_CACHE)){const m=ms.find(m=>m.id===id);if(m)return m;}return null;}
function openLightbox(matId){
  const m=findMat(matId);if(!m)return;
  const t=TYPES.find(t=>t.id===m.type);
  const ct=document.getElementById('lb-content'),info=document.getElementById('lb-info');
  const first=(m.files||[])[0];
  if(first?.url){
    if(first.file_type==='video')ct.innerHTML=`<video class="lb-vid" src="${first.url}" controls autoplay></video>`;
    else ct.innerHTML=`<img class="lb-img" src="${first.url}" alt="">`;
    info.textContent=`${t?.label} Â· ${fmtDate(m.date)} Â· ${m.description}`;
  }else{
    ct.innerHTML=`<div style="text-align:center;padding:20px"><div style="font-size:70px;margin-bottom:12px">${t?.emoji||'ðŸ“„'}</div><div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:6px">${t?.label}</div><div style="font-size:13px;color:var(--text2)">${m.description}</div><div style="font-size:12px;color:var(--text3);background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:9px 14px;margin-top:10px">Nenhum arquivo enviado ainda.</div></div>`;
    info.textContent=fmtDate(m.date);
  }
  document.getElementById('lb-ov').classList.add('open');
}
function closeLightbox(){document.getElementById('lb-ov').classList.remove('open');const v=document.querySelector('#lb-content video');if(v)v.pause();}
function openCarousel(matId){
  const m=findMat(matId);if(!m)return;
  carData={slides:m.files||[],cur:0,type:m.type};renderCarSlide();
  document.getElementById('car-ov').classList.add('open');
}
function renderCarSlide(){
  const{slides,cur,type}=carData,t=TYPES.find(t=>t.id===type);
  const slide=document.getElementById('car-slide'),f=slides[cur];
  if(f?.url){
    if(f.file_type==='video')slide.innerHTML=`<video src="${f.url}" controls style="width:100%;height:100%;object-fit:contain;outline:none"></video>`;
    else slide.innerHTML=`<img src="${f.url}" style="width:100%;height:100%;object-fit:contain">`;
  }else{
    slide.innerHTML=`<div style="text-align:center;padding:20px;color:var(--text3)"><div style="font-size:46px;margin-bottom:9px">${t?.emoji||'ðŸ–¼'}</div><div style="font-size:13px">${f?f.name:`Slide ${cur+1}`}</div></div>`;
  }
  document.getElementById('car-ct').textContent=`${cur+1} de ${slides.length}`;
  document.getElementById('car-dots').innerHTML=slides.map((_,i)=>`<span class="${i===cur?'on':''}"></span>`).join('');
}
function carNav(d){carData.cur=Math.max(0,Math.min(carData.slides.length-1,carData.cur+d));renderCarSlide();}
function closeCarousel(){document.getElementById('car-ov').classList.remove('open');}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EXPORT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function startExport(type){
  closeOv('ov-export-choice');
  const ms=MATS_CACHE[curClient.id]||[];
  const k=getKPIs();
  const isMonth=activeP==='month'||activeP==='lastmonth';
  const reportTitle=isMonth?'RelatÃ³rio Mensal':'RelatÃ³rio Semanal';
  document.getElementById('content').innerHTML=renderExportPreview(k,ms,reportTitle,type);
}
function renderExportPreview(k,ms,reportTitle,exportType){
  const logoHtml=systemLogoUrl?`<img src="${systemLogoUrl}" style="width:100%;height:100%;object-fit:cover">`:'ðŸ¼';
  const clientLogoHtml=curClient.logo_url?`<img src="${curClient.logo_url}" style="width:100%;height:100%;object-fit:cover">`:'ðŸ¢';
  return`<div class="exp-wrap">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px">
      <div><div style="font-size:11px;color:var(--text3);margin-bottom:2px">Preview Â· ${exportType==='admin'?'Admin':'Cliente'}</div><div style="font-size:16px;font-weight:600">${curClient.name}</div></div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="showScreen('client')">â† Voltar</button>
        <button class="btn ${exportType==='admin'?'btn-indigo':'btn-green'}" id="btn-gen-pdf" onclick="generatePDF('${exportType}')">
          â¬‡ ${exportType==='admin'?'PDF Admin':'PDF Cliente'}
        </button>
      </div>
    </div>
    <div class="exp-preview">
      <div class="pdf-cov">
        <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:14px">
          <div class="big-ico">${logoHtml}</div>
          ${curClient.logo_url?`<div class="big-ico">${clientLogoHtml}</div>`:''}
        </div>
        <h2>${reportTitle}</h2>
        <h3>${curClient.name}</h3>
        <p>${new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</p>
      </div>
      <div class="pdf-sec"><h4>Resumo das entregas</h4>
        <div class="pdf-stats">
          <div class="pdf-stat"><div class="n">${k.total}</div><div class="l">Total</div></div>
          ${TYPES.map(t=>`<div class="pdf-stat"><div class="n">${k[t.id]||0}</div><div class="l">${t.label}</div></div>`).join('')}
        </div>
      </div>
      ${exportType==='admin'?renderAdminBreakdownPreview(ms):''}
      <div class="pdf-sec"><h4>Materiais (${ms.length})</h4>
        <div class="pdf-gal">
          ${ms.slice(0,8).map(m=>{const f=(m.files||[])[0];if(f?.url&&f.file_type==='image')return`<div class="pdf-thumb"><img src="${f.url}"></div>`;return`<div class="pdf-thumb">${TE[m.type]||'ðŸ“„'}</div>`;}).join('')}
          ${ms.length===0?'<div style="grid-column:1/-1;text-align:center;color:var(--text3);font-size:13px;padding:14px">Nenhum material ainda</div>':''}
        </div>
      </div>
      <div style="padding:12px 20px;text-align:center;font-size:11px;color:var(--text3)">Gerado por Panda Reports Â· ${new Date().toLocaleDateString('pt-BR')} Â· panda.ag</div>
    </div>
  </div>`;
}
function renderAdminBreakdownPreview(ms){
  const byCollab={};
  ms.forEach(m=>{const cid=m.collaborator_id||'__none__';if(!byCollab[cid])byCollab[cid]=[];byCollab[cid].push(m);});
  return`<div class="pdf-sec"><h4>Por colaborador</h4>
    ${Object.entries(byCollab).map(([cid,mats])=>{
      const collab=COLLABS.find(c=>c.id===cid);const name=collab?.name||'Sem colaborador';
      return`<div style="margin-bottom:10px">
        <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:5px;display:flex;align-items:center;gap:7px">
          <div style="width:18px;height:18px;border-radius:50%;background:#818cf8;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff">${name.charAt(0)}</div>
          ${name} <span style="font-size:11px;color:var(--text3);font-weight:400">${mats.length} demanda${mats.length!==1?'s':''}</span>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          ${mats.map(m=>{const t=TYPES.find(t=>t.id===m.type);return`<span style="font-size:11px;padding:2px 8px;border-radius:5px;background:var(--bg4);color:var(--text2);border:1px solid var(--border)">${t?.emoji} ${t?.label} Â· ${fmtDateS(m.date)}</span>`;}).join('')}
        </div>
      </div>`;}).join('')}
  </div>`;
}

async function generatePDF(exportType){
  const btn=document.getElementById('btn-gen-pdf');
  if(btn){btn.innerHTML='<span class="spinner spinner-dark"></span> Gerandoâ€¦';btn.disabled=true;}
  showToast('Gerando PDFâ€¦');
  try{
    const{jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const W=210,H=297,ms=MATS_CACHE[curClient.id]||[],k=getKPIs();
    const isMonth=activeP==='month'||activeP==='lastmonth';
    const reportTitle=isMonth?'RelatÃ³rio Mensal':'RelatÃ³rio Semanal';

    // CAPA
    doc.setFillColor(13,13,13);doc.rect(0,0,W,H,'F');
    doc.setFillColor(exportType==='admin'?99:107,exportType==='admin'?102:175,exportType==='admin'?241:69);doc.rect(0,0,W,2,'F');
    let ly=30;
    if(systemLogoUrl){try{const ld=await toBase64(systemLogoUrl);doc.addImage(ld,'JPEG',W/2-14,ly,28,28);ly+=34;}catch(e){doc.setFillColor(107,175,69);doc.roundedRect(W/2-14,ly,28,28,5,5,'F');ly+=34;}}
    else{doc.setFillColor(107,175,69);doc.roundedRect(W/2-14,ly,28,28,5,5,'F');ly+=34;}
    if(curClient.logo_url){try{const cd=await toBase64(curClient.logo_url);doc.addImage(cd,'JPEG',W/2-10,ly,20,20);ly+=26;}catch(e){}}
    doc.setTextColor(107,175,69);doc.setFontSize(22);doc.setFont('helvetica','bold');
    doc.text(reportTitle,W/2,ly+10,{align:'center'});
    doc.setTextColor(232,232,232);doc.setFontSize(14);doc.setFont('helvetica','normal');
    doc.text(curClient.name,W/2,ly+20,{align:'center'});
    doc.setTextColor(85,85,85);doc.setFontSize(9);
    doc.text(new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),W/2,ly+29,{align:'center'});
    if(exportType==='admin'){doc.setFillColor(99,102,241);doc.roundedRect(W/2-20,ly+37,40,8,3,3,'F');doc.setTextColor(255,255,255);doc.setFontSize(7);doc.setFont('helvetica','bold');doc.text('ADMIN â€” USO INTERNO',W/2,ly+42.5,{align:'center'});}

    // RESUMO
    doc.addPage();doc.setFillColor(13,13,13);doc.rect(0,0,W,H,'F');
    const fc=exportType==='admin'?[99,102,241]:[107,175,69];
    doc.setFillColor(fc[0],fc[1],fc[2]);doc.rect(0,0,W,2,'F');
    doc.setTextColor(85,85,85);doc.setFontSize(8);doc.setFont('helvetica','bold');doc.text('RESUMO DAS ENTREGAS',18,20);
    doc.setFillColor(20,20,20);doc.setDrawColor(35,35,35);doc.roundedRect(14,24,W-28,34,4,4,'FD');
    doc.setTextColor(107,175,69);doc.setFontSize(26);doc.setFont('helvetica','bold');doc.text(String(k.total),26,43);
    doc.setTextColor(85,85,85);doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text('materiais produzidos',26,51);
    const bw=24,bg=3,bx0=W-14-(TYPES.length*(bw+bg))+bg;
    TYPES.forEach((t,i)=>{const x=bx0+i*(bw+bg);doc.setFillColor(26,26,26);doc.roundedRect(x,26,bw,30,3,3,'F');doc.setTextColor(107,175,69);doc.setFontSize(13);doc.setFont('helvetica','bold');doc.text(String(k[t.id]||0),x+bw/2,37,{align:'center'});doc.setTextColor(85,85,85);doc.setFontSize(7);doc.setFont('helvetica','normal');doc.text(t.label,x+bw/2,47,{align:'center'});});

    // LISTA
    doc.setTextColor(85,85,85);doc.setFontSize(8);doc.setFont('helvetica','bold');doc.text(`MATERIAIS ENTREGUES (${ms.length})`,18,70);
    let y=76;
    for(const m of ms){
      if(y>272){doc.addPage();doc.setFillColor(13,13,13);doc.rect(0,0,W,H,'F');doc.setFillColor(fc[0],fc[1],fc[2]);doc.rect(0,0,W,2,'F');y=14;}
      const t=TYPES.find(t=>t.id===m.type);
      doc.setFillColor(20,20,20);doc.setDrawColor(35,35,35);doc.roundedRect(14,y,W-28,12,2,2,'FD');
      const rgb=hexRGB(colorForType(m.type));doc.setFillColor(rgb[0],rgb[1],rgb[2]);doc.circle(21,y+6,2.2,'F');
      doc.setTextColor(200,200,200);doc.setFontSize(8);doc.setFont('helvetica','normal');doc.text((m.description||'').substring(0,60),27,y+6.5);
      doc.setTextColor(85,85,85);doc.setFontSize(7);doc.text(fmtDateS(m.date),W-16,y+6.5,{align:'right'});
      const f=(m.files||[])[0];if(f?.url&&f.file_type==='image'){try{const d=await toBase64(f.url);doc.addImage(d,'JPEG',W-27,y+0.5,11,11);}catch(e){}}
      y+=14;
    }

    // ADMIN BREAKDOWN
    if(exportType==='admin'){
      const byCollab={};ms.forEach(m=>{const cid=m.collaborator_id||'__none__';if(!byCollab[cid])byCollab[cid]=[];byCollab[cid].push(m);});
      doc.addPage();doc.setFillColor(13,13,13);doc.rect(0,0,W,H,'F');doc.setFillColor(99,102,241);doc.rect(0,0,W,2,'F');
      doc.setTextColor(85,85,85);doc.setFontSize(8);doc.setFont('helvetica','bold');doc.text('DEMANDAS POR COLABORADOR',18,14);
      let ay=20;
      for(const[cid,mats] of Object.entries(byCollab)){
        if(ay>270){doc.addPage();doc.setFillColor(13,13,13);doc.rect(0,0,W,H,'F');doc.setFillColor(99,102,241);doc.rect(0,0,W,2,'F');ay=14;}
        const collab=COLLABS.find(c=>c.id===cid);const cname=collab?.name||'Sem colaborador';
        doc.setFillColor(25,25,40);doc.setDrawColor(99,102,241);doc.roundedRect(14,ay,W-28,10,2,2,'FD');
        doc.setFillColor(99,102,241);doc.circle(21,ay+5,3,'F');
        doc.setTextColor(200,200,220);doc.setFontSize(9);doc.setFont('helvetica','bold');doc.text(cname,27,ay+5.8);
        doc.setTextColor(99,102,200);doc.setFontSize(7);doc.setFont('helvetica','normal');doc.text(`${mats.length} demanda${mats.length!==1?'s':''}`,W-18,ay+5.8,{align:'right'});
        ay+=12;
        for(const m of mats){
          if(ay>275){doc.addPage();doc.setFillColor(13,13,13);doc.rect(0,0,W,H,'F');doc.setFillColor(99,102,241);doc.rect(0,0,W,2,'F');ay=14;}
          const t=TYPES.find(t=>t.id===m.type);
          doc.setFillColor(18,18,18);doc.setDrawColor(35,35,35);doc.roundedRect(18,ay,W-36,10,2,2,'FD');
          doc.setTextColor(160,160,160);doc.setFontSize(7.5);doc.setFont('helvetica','normal');doc.text(`${(m.description||'').substring(0,55)}`,24,ay+6);
          doc.setTextColor(80,80,80);doc.setFontSize(7);doc.text(fmtDateS(m.date),W-20,ay+6,{align:'right'});ay+=12;
        }ay+=4;
      }
    }

    // GALERIA (apenas cliente)
    if(exportType==='client'){
      const imgMs=ms.filter(m=>{const f=(m.files||[])[0];return f?.url&&f.file_type==='image';});
      if(imgMs.length>0){
        doc.addPage();doc.setFillColor(13,13,13);doc.rect(0,0,W,H,'F');doc.setFillColor(107,175,69);doc.rect(0,0,W,2,'F');
        doc.setTextColor(85,85,85);doc.setFontSize(8);doc.setFont('helvetica','bold');doc.text('GALERIA DE MATERIAIS',18,13);
        const cols=3,tw=(W-28-4)/cols,th=tw;let gx=14,gy=18,gi=0;
        for(const m of imgMs){
          if(gi&&gi%cols===0){gy+=th+4;gx=14;}
          if(gy+th>285){doc.addPage();doc.setFillColor(13,13,13);doc.rect(0,0,W,H,'F');doc.setFillColor(107,175,69);doc.rect(0,0,W,2,'F');gy=14;gx=14;}
          doc.setFillColor(22,22,22);doc.roundedRect(gx,gy,tw,th,3,3,'F');
          try{const d=await toBase64(m.files[0].url);doc.addImage(d,'JPEG
