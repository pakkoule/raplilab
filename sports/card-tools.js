/* Local-only card tools. No collection writes, network requests or export dependency. */
(function(root){
  'use strict';
  const cleanName=value=>String(value||'carte').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'').slice(0,100)||'carte';
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function cardInfo(card,bridge){
    const players=bridge.players(card);
    return {title:players.map(p=>p.name).filter(Boolean).join(' / ')||card.player||'Carte',rows:[
      ['Statut',card.status==='own'?'Possédée':card.dream?'Wishlist · Dans mes rêves':'Wishlist'],
      ['Marque',card.brand],['Équipe',card.team],['Sport',card.sport],
      ['Pays',[...new Set(players.map(p=>bridge.country(p.nationality)).filter(Boolean))].join(' / ')],
      ['Référence',card.reference],['Tags',(card.tags||[]).join(' · ')],
      ['Numérotation',card.numbered?[card.serial||'',card.printRun||'?'].join(' / '):'Non numérotée'],
      ['Rookie',card.rookie?'Oui':''],
      ...players.flatMap(p=>[[`Autographe · ${p.name}`,bridge.autoLabels[p.auto]||''],[`Patch · ${p.name}`,({'game-worn':'Game Worn','not-affiliated':'Not Affiliated'})[p.patch]||'']]),
      ['Grading',card.graded?[card.gradeOrg,card.gradeScore].filter(Boolean).join(' ')||'Gradée':'']
    ].filter(row=>row[1])};
  }
  // PDF 1.4, A4 portrait, one RGB JPEG per page. Byte offsets are measured on
  // encoded bytes (not JS string length); each page gets its own image stream.
  function jpegPdf(pages){
    const encoder=new TextEncoder(),chunks=[],offsets=[0];let length=0;
    const put=value=>{const bytes=typeof value==='string'?encoder.encode(value):value;chunks.push(bytes);length+=bytes.length;};
    const object=(id,body)=>{offsets[id]=length;put(`${id} 0 obj\n`);body();put('\nendobj\n');};
    put('%PDF-1.4\n');
    object(1,()=>put('<< /Type /Catalog /Pages 2 0 R >>'));
    object(2,()=>put(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`));
    pages.forEach((page,i)=>{
      const id=3+i*3;
      object(id,()=>put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`));
      object(id+1,()=>{put(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`);put(page.bytes);put('\nendstream');});
      const content='q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';
      object(id+2,()=>put(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`));
    });
    const start=length;put(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
    offsets.slice(1).forEach(offset=>put(String(offset).padStart(10,'0')+' 00000 n \n'));
    put(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`);
    return new Blob(chunks,{type:'application/pdf'});
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={cardInfo,cleanName,jpegPdf};return;}
  const bridge=root.RapliCardToolsBridge;if(!bridge)return;
  const imageSource=value=>/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value||'');
  function bytesOf(source){const raw=atob(source.split(',')[1]);return Uint8Array.from(raw,ch=>ch.charCodeAt(0));}
  function download(blob,name){
    // Start the download in the same-origin portal, when embedded. This also
    // keeps the download link outside the iframe's modal/inert document body.
    let host=document;
    try{if(root.parent!==root&&root.parent.location.origin===root.location.origin)host=root.parent.document;}catch(_){}
    const url=URL.createObjectURL(blob),a=host.createElement('a');a.href=url;a.download=name;
    (host.querySelector('dialog[open]')||host.body).append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  function photoDownload(card){
    if(!imageSource(card.photo))throw Error('La photo n’est pas encore disponible. Attends son chargement puis réessaie.');
    const mime=card.photo.slice(5,card.photo.indexOf(';'));
    download(new Blob([bytesOf(card.photo)],{type:mime}),cleanName(cardInfo(card,bridge).title)+'-photo.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[mime]);
  }
  function imageOf(source){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('La photo ne peut pas être décodée.'));image.src=source;});}
  function wrap(ctx,text,width){
    const lines=[];let line='';
    for(const word of String(text).split(/\s+/)){
      if(ctx.measureText((line?line+' ':'')+word).width<=width){line+=(line?' ':'')+word;continue;}
      if(line)lines.push(line);line='';
      for(const char of word){if(ctx.measureText(line+char).width>width&&line){lines.push(line);line='';}line+=char;}
    }
    if(line)lines.push(line);return lines;
  }
  function canvas(w,h){const node=document.createElement('canvas');node.width=w;node.height=h;return node;}
  function textLines(ctx,lines,x,y,step){lines.forEach((line,i)=>ctx.fillText(line,x,y+i*step));return y+lines.length*step;}
  async function pngDownload(card){
    await document.fonts.ready;
    const info=cardInfo(card,bridge),c=canvas(1400,900),ctx=c.getContext('2d');
    ctx.font='700 42px Poppins, sans-serif';const title=wrap(ctx,info.title,740);
    ctx.font='26px Poppins, sans-serif';const rows=info.rows.map(([label,value])=>({label,lines:wrap(ctx,value,740)}));
    c.height=Math.max(900,150+title.length*54+rows.reduce((height,row)=>height+40+row.lines.length*36,0));
    const gradient=ctx.createLinearGradient(0,0,1400,c.height);['#d0f5e7','#e7edfa','#fbf2e9','#e2ebf8'].forEach((color,i)=>gradient.addColorStop(i/3,color));
    ctx.fillStyle=gradient;ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#84bbb8';ctx.lineWidth=8;ctx.strokeRect(14,14,c.width-28,c.height-28);
    ctx.fillStyle='#38566c';ctx.font='600 22px Poppins, sans-serif';ctx.fillText('RAPLI / SPORTS',55,65);
    if(imageSource(card.photo)){
      const image=await imageOf(card.photo),scale=Math.min(510/image.width,730/image.height);
      ctx.drawImage(image,50+(510-image.width*scale)/2,105,image.width*scale,image.height*scale);
    }else{ctx.font='24px Poppins, sans-serif';ctx.fillText('Photo indisponible',95,350);}
    ctx.fillStyle='#1b354b';ctx.font='700 42px Poppins, sans-serif';let y=textLines(ctx,title,605,115,54)+20;
    for(const row of rows){ctx.fillStyle='#537288';ctx.font='600 20px Poppins, sans-serif';ctx.fillText(row.label.toUpperCase(),605,y);y+=34;ctx.fillStyle='#1b354b';ctx.font='26px Poppins, sans-serif';y=textLines(ctx,row.lines,605,y,36)+6;}
    const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error('Export PNG impossible.');
    download(blob,cleanName(info.title)+'-fiche.png');
  }
  async function pdfDownload(group){
    await document.fonts.ready;
    const pages=[];let c,ctx,y,pageNumber=0;
    function finish(){ctx.fillStyle='#607588';ctx.font='20px Poppins, sans-serif';ctx.fillText(`RAPLI / SPORTS · ${new Date().toLocaleDateString('fr-FR')} · Page ${pageNumber}`,70,1680);pages.push({width:c.width,height:c.height,bytes:bytesOf(c.toDataURL('image/jpeg',.94))});}
    function page(){c=canvas(1240,1754);ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#1b354b';ctx.font='700 35px Poppins, sans-serif';pageNumber++;y=textLines(ctx,wrap(ctx,group.name||'Rainbow',1100),70,85,46)+10;ctx.font='22px Poppins, sans-serif';y=textLines(ctx,wrap(ctx,[group.athlete,group.brand,...(group.baseReferences||[])].filter(Boolean).join(' · '),1100),70,y,30)+14;ctx.fillText(`CHECKLIST · ${group.owned} / ${group.total} possédées · ${group.percent} %`,70,y);y+=45;ctx.font='19px Poppins, sans-serif';ctx.fillText('Coche = possédée · Wishlist = recherchée · Manquante = non associée',70,y);y+=55;}
    page();
    for(const entry of group.entries){
      ctx.font='24px Poppins, sans-serif';const lines=wrap(ctx,entry.label+(entry.isBase?' · BASE':''),720),height=Math.max(72,lines.length*34+30);
      if(y+height>1620){finish();page();}
      ctx.fillStyle=entry.status==='own'?'#e9f6ef':'#f1f4f8';ctx.fillRect(65,y-26,1110,height-8);
      ctx.strokeStyle='#537288';ctx.lineWidth=2;ctx.strokeRect(85,y-10,25,25);
      if(entry.status==='own'){ctx.beginPath();ctx.moveTo(89,y+1);ctx.lineTo(97,y+10);ctx.lineTo(108,y-7);ctx.stroke();}
      ctx.fillStyle='#1b354b';ctx.font='24px Poppins, sans-serif';textLines(ctx,lines,135,y+10,34);
      ctx.font='600 20px Poppins, sans-serif';ctx.fillText(({own:'Possédée',wishlist:'Wishlist',missing:'Manquante'})[entry.status]||'Manquante',925,y+10);
      if(entry.card?.numbered){ctx.font='18px Poppins, sans-serif';ctx.fillText(`${entry.card.serial||''} / ${entry.card.printRun||'?'}`,925,y+35);}
      y+=height;
    }
    if(!group.entries.length){ctx.font='24px Poppins, sans-serif';ctx.fillText('Aucune variation définie.',70,y);}
    finish();download(jpegPdf(pages),cleanName(group.name)+'-checklist.pdf');
  }
  let dialog;
  function summary(card){
    if(!dialog){dialog=document.createElement('dialog');dialog.className='card-summary-dialog';dialog.setAttribute('aria-labelledby','card-summary-title');document.body.append(dialog);dialog.addEventListener('click',e=>{if(e.target===dialog||e.target.closest('[data-summary-close]'))dialog.close();});}
    const info=cardInfo(card,bridge);
    dialog.innerHTML='<div class="card-summary-content" data-card-id="'+esc(card.id)+'"><header><h2 id="card-summary-title">'+esc(info.title)+'</h2><button type="button" data-summary-close aria-label="Fermer le résumé">×</button></header><div class="card-summary-body">'+(imageSource(card.photo)?'<img class="card-summary-photo" src="'+card.photo+'" alt="Photo de la carte">':'')+'<dl>'+info.rows.map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl></div><footer class="card-export-actions"><button type="button" data-card-tool="png">↓ FICHE PNG</button><button type="button" data-card-tool="photo">↓ PHOTO</button></footer></div>';
    if(!dialog.open)dialog.showModal();
  }
  document.addEventListener('contextmenu',event=>{const tile=event.target.closest('.sports-gallery-tile[data-card-id]');if(!tile)return;const card=bridge.card(tile.dataset.cardId);if(card){event.preventDefault();event.stopPropagation();summary(card);}},true);
  document.addEventListener('keydown',event=>{const link=event.target.closest('#cardGrid [data-card-group]');if(link&&['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();bridge.navigate(link.dataset.cardGroup,link.dataset.groupLabel);}},true);
  document.addEventListener('click',async event=>{
    const link=event.target.closest('#cardGrid [data-card-group]');
    if(link){event.preventDefault();event.stopImmediatePropagation();bridge.navigate(link.dataset.cardGroup,link.dataset.groupLabel);return;}
    const action=event.target.closest('[data-card-tool], [data-rainbow-pdf]');if(!action)return;
    event.preventDefault();event.stopImmediatePropagation();if(action.disabled)return;action.disabled=true;
    try{
      if(action.hasAttribute('data-rainbow-pdf')){const group=bridge.rainbow(action.dataset.rainbowPdf);if(group)await pdfDownload(group);}
      else{const card=bridge.card(action.closest('[data-card-id]')?.dataset.cardId);if(!card)return;
        if(action.dataset.cardTool==='summary')summary(card);
        if(action.dataset.cardTool==='png')await pngDownload(card);
        if(action.dataset.cardTool==='photo')photoDownload(card);
      }
    }catch(error){console.error('Card export',error);bridge.notify(error.message||'Export impossible. Réessaie.');}
    finally{action.disabled=false;}
  },true);
})(typeof window==='undefined'?globalThis:window);
