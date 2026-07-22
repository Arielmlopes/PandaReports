find(t=>t.id===type);
  const slide=document.getElementById('car-slide'),f=slides[cur];
  if(f?.url){
    if(f.file_type==='video')slide.innerHTML=`<video src="${f.url}" controls style="width:100%;height:100%;object-fit:contain;outline:none"></video>`;
    else slide.innerHTML=`<img src="${f.url}" style="width:100%;height:100%;object-fit:contain">`;
  }else{
    slide.innerHTML=`<div style="text-align:center;padding:20px;color:var(--text3)"><div style="font-size:46px;margin-bottom:9px">${t?.emoji||'🖼'}</div><div style="font-size:13px">${f?f.name:`Slide ${cur+1}`}</div></div>`;
  }
  document.getElementById('car-ct').textContent=`${cur+1} de ${slides.length}`;
  document.getElementById('car-dots').innerHTML=slides.map((_,i)=>`<span class="${i===cur?'on':''}"></span>`).join('');
}
function carNav(d){carData.cur=Math.max(0,Math.min(carData.slides.length-1,carData.cur+d));renderCarSlide();}
function closeCarousel(){document.getElementById('car-ov').classList.remove('open');}

// ═══════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════
function startExport(type){
  closeOv('ov-export-choice');
  const ms=MATS_CACHE[curClient.id]||[];
  const k=getKPIs();
  const isMonth=activeP==='month'||activeP==='lastmonth';
  const reportTitle=isMonth?'Relatório Mensal':'Relatório Semanal';
  document.getElementById('content').innerHTML=renderExportPreview(k,ms,reportTitle,type);
}
function renderExportPreview(k,ms,reportTitle,exportType){
  const logoHtml=systemLogoUrl?`<img src="${systemLogoUrl}" style="width:100%;height:100%;object-fit:cover">`:'🐼';
  const clientLogoHtml=curClient.logo_url?`<img src="${curClient.logo_url}" style="width:100%;height:100%;object-fit:cover">`:'🏢';
  return`<div class="exp-wrap">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px">
      <div><div style="font-size:11px;color:var(--text3);margin-bottom:2px">Preview · ${exportType==='admin'?'Admin':'Cliente'}</div><div style="font-size:16px;font-weight:600">${curClient.name}</div></div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="showScreen('client')">← Voltar</button>
        <button class="btn ${exportType==='admin'?'btn-indigo':'btn-green'}" id="btn-gen-pdf" onclick="generatePDF('${exportType}')">
          ⬇ ${exportType==='admin'?'PDF Admin':'PDF Cliente'}
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
          ${ms.slice(0,8).map(m=>{const f=(m.files||[])[0];if(f?.url&&f.file_type==='image')return`<div class="pdf-thumb"><img src="${f.url}"></div>`;return`<div class="pdf-thumb">${TE[m.type]||'📄'}</div>`;}).join('')}
          ${ms.length===0?'<div style="grid-column:1/-1;text-align:center;color:var(--text3);font-size:13px;padding:14px">Nenhum material ainda</div>':''}
        </div>
      </div>
      <div style="padding:12px 20px;text-align:center;font-size:11px;color:var(--text3)">Gerado por Panda Reports · ${new Date().toLocaleDateString('pt-BR')} · panda.ag</div>
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
          ${mats.map(m=>{const t=TYPES.find(t=>t.id===m.type);return`<span style="font-size:11px;padding:2px 8px;border-radius:5px;background:var(--bg4);color:var(--text2);border:1px solid var(--border)">${t?.emoji} ${t?.label} · ${fmtDateS(m.date)}</span>`;}).join('')}
        </div>
      </div>`;}).join('')}
  </div>`;
}

async function generatePDF(exportType){
  const btn=document.getElementById('btn-gen-pdf');
  if(btn){btn.innerHTML='<span class="spinner spinner-dark"></span> Gerando…';btn.disabled=true;}
  showToast('Gerando PDF…');
  try{
    const{jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const W=210,H=297,ms=MATS_CACHE[curClient.id]||[],k=getKPIs();
    const isMonth=activeP==='month'||activeP==='lastmonth';
    const reportTitle=isMonth?'Relatório Mensal':'Relatório Semanal';

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
    if(exportType==='admin'){doc.setFillColor(99,102,241);doc.roundedRect(W/2-20,ly+37,40,8,3,3,'F');doc.setTextColor(255,255,255);doc.setFontSize(7);doc.setFont('helvetica','bold');doc.text('ADMIN — USO INTERNO',W/2,ly+42.5,{align:'center'});}

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
          try{const d=await toBase64(m.files[0].url);doc.addImage(d,'JPEG',gx,gy,tw,th);}catch(e){}
          gx+=tw+4;gi++;
        }
      }
    }

    // FOOTER
    const pages=doc.internal.getNumberOfPages();
    for(let i=1;i<=pages;i++){
      doc.setPage(i);
      doc.setFillColor(fc[0],fc[1],fc[2]);doc.rect(0,H-2,W,2,'F');
      doc.setTextColor(55,55,55);doc.setFontSize(7);doc.setFont('helvetica','normal');
      doc.text(`Panda Reports · ${new Date().toLocaleDateString('pt-BR')} · panda.ag`,W/2,H-6,{align:'center'});
      doc.text(`${i}/${pages}`,W-12,H-6,{align:'right'});
    }
    const suffix=exportType==='admin'?'admin':'cliente';
    doc.save(`panda-report-${suffix}-${curClient.name.replace(/\s+/g,'-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.pdf`);
    showToast('PDF gerado com sucesso!');
  }catch(e){console.error(e);showToast('Erro ao gerar PDF',true);}
  finally{if(btn){btn.innerHTML=`⬇ ${exportType==='admin'?'PDF Admin':'PDF Cliente'}`;btn.disabled=false;}}
}
function hexRGB(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function colorForType(t){return{post:'#6BAF45',carousel:'#3b82f6',video:'#ef4444',story:'#a855f7',reels:'#f97316',identity:'#eab308'}[t]||'#888';}
function toBase64(url){return new Promise((res,rej)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);res(c.toDataURL('image/jpeg',0.85));};img.onerror=rej;img.src=url;});}
function dataURLtoBlob(dataURL){const arr=dataURL.split(','),mime=arr[0].match(/:(.*?);/)[1];const bstr=atob(arr[1]);let n=bstr.length;const u8=new Uint8Array(n);while(n--)u8[n]=bstr.charCodeAt(n);return new Blob([u8],{type:mime});}

// ═══════════════════════════════════════════════════
// PUBLIC BRIEFING FORM (sem login)
// ═══════════════════════════════════════════════════
async function initPublicForm(clientId){
  document.getElementById('scr-login').style.display='none';
  document.getElementById('sidebar').style.display='none';
  document.getElementById('main').style.display='none';
  document.getElementById('scr-public-form').style.display='block';
  const logoSaved=localStorage.getItem('panda_logo');
  if(logoSaved)systemLogoUrl=logoSaved;

  const{data:client,error}=await db.from('clients').select('*').eq('id',clientId).single();
  if(error||!client){
    document.getElementById('pf-wrap-content').innerHTML=`<div class="pf-header" style="margin-top:60px"><div class="pf-logo">🐼</div><h1>Link inválido</h1><p>Este formulário de pedido não foi encontrado. Confira o link com a agência.</p></div>`;
    return;
  }
  PF_CLIENT=client;
  const{data:orgs}=await db.from('org_logos').select('*').eq('client_id',clientId).order('name',{ascending:true});
  PF_ORGS=orgs||[];
  PF_STEP=1;
  renderPublicForm();
}

function pfHeaderHtml(){
  const logoHtml=systemLogoUrl?`<img src="${systemLogoUrl}">`:'🐼';
  return`<div class="pf-header">
    <div class="pf-logo">${logoHtml}</div>
    <h1>Solicitação de Material</h1>
    <p>${PF_CLIENT.name}</p>
  </div>
  <div class="pf-progress-wrap">
    <div class="pf-progress-label">Etapa ${PF_STEP} de ${PF_TOTAL_STEPS}</div>
    <div class="pf-progress-bar"><div class="pf-progress-fill" style="width:${(PF_STEP/PF_TOTAL_STEPS)*100}%"></div></div>
  </div>`;
}

function renderPublicForm(){
  const wrap=document.getElementById('pf-wrap-content');
  let stepHtml='';
  if(PF_STEP===1)stepHtml=pfStep1();
  else if(PF_STEP===2)stepHtml=pfStep2();
  else if(PF_STEP===3)stepHtml=pfStep3();
  else if(PF_STEP===4)stepHtml=pfStep4();
  else if(PF_STEP===5)stepHtml=pfStep5();
  else if(PF_STEP===6)stepHtml=pfStep6();
  wrap.innerHTML=pfHeaderHtml()+`<div class="pf-card">${stepHtml}</div>`;
  pfBindEvents();
}

function pfStep1(){
  return`
    <div class="pf-step-title">Quem está solicitando?</div>
    <div class="pf-step-sub">Precisamos saber quem fazer contato em caso de dúvidas.</div>
    <div class="pf-field" id="f-requester_name">
      <label>Seu nome <span class="req">*</span></label>
      <input type="text" id="pf-requester_name" value="${PF_DATA.requester_name}" placeholder="Ex: Maria Souza">
      <div class="pf-err-msg">Preencha seu nome.</div>
    </div>
    <div class="pf-field" id="f-requester_role">
      <label>Seu cargo / função <span class="req">*</span></label>
      <input type="text" id="pf-requester_role" value="${PF_DATA.requester_role}" placeholder="Ex: Recepcionista, Gerente, Sócio...">
      <div class="pf-err-msg">Preencha seu cargo ou função.</div>
    </div>
    <div class="pf-field" id="f-requester_contact">
      <label>Telefone ou e-mail para contato <span class="req">*</span></label>
      <input type="text" id="pf-requester_contact" value="${PF_DATA.requester_contact}" placeholder="Ex: (77) 99999-9999">
      <div class="pf-err-msg">Preencha um telefone ou e-mail.</div>
    </div>
    <div class="pf