/* Rapli Tiers List — pixel-perfect, canvas-based PNG export */
(() => {
'use strict';
const textContrast=h=>{const c=String(h).replace('#',''),v=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4));return v[0]*.2126+v[1]*.7152+v[2]*.0722>.179?'#202020':'#ffffff';};
function textLines(ctx,source,width,size,weight=700){ctx.font=weight+' '+size+'px Poppins, sans-serif';const lines=[];const max=Math.max(4,width);
 for(const paragraph of String(source||'').split('\n')){let line='';for(const word of paragraph.split(/\s+/)){const test=line?line+' '+word:word;if(ctx.measureText(test).width<=max){line=test;continue;}if(line){lines.push(line);line='';}for(const letter of word){if(ctx.measureText(line+letter).width>max&&line){lines.push(line);line='';}line+=letter;}}lines.push(line);}
 return lines.length?lines:[''];
}
function fitText(ctx,source,width,height,fontSize,min=8,weight=700,maxLines=Infinity){
 for(let n=fontSize;n>=min;n--){const lines=textLines(ctx,source,width,n,weight),lh=n*1.18;if(lines.length<=maxLines&&lines.length*lh<=height)return {lines,n,lh};}
 const n=min,lh=n*1.18;return {lines:textLines(ctx,source,width,n,weight),n,lh};
}
function drawText(ctx,text,x,y,width,height,fontSize,foreground,weight=700,maxLines=Infinity){
 let fit=fitText(ctx,text,width-4,height-4,fontSize,8,weight,maxLines);
 ctx.save();ctx.font=weight+' '+fit.n+'px Poppins, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=foreground;
 fit.lines.forEach((line,i)=>ctx.fillText(line,x+width/2,y+height/2+(i-(fit.lines.length-1)/2)*fit.lh));
 ctx.restore();return fit;
}
function dimensions(e,s,ctx){
 const w=s.tileSize;let h=w;
 if(s.ratio==='portrait')h=Math.round(w*4/3);else if(s.ratio==='landscape')h=Math.round(w*3/4);
 else if(s.ratio==='original'&&e.type==='image'&&e.w&&e.h)h=Math.round(w*e.h/e.w);
 if(e.type==='text'){const f=fitText(ctx,e.text,w-4,10000,16,9);h=Math.max(h,Math.ceil(f.lines.length*f.lh)+6);}
 return {w,h:Math.min(1600,Math.max(35,h))};
}
function rowsFor(rank,s,ctx,itemsMap){
 const left=Math.round(1000*s.rankWidth/100),maxWidth=1000-left-3;
 const rows=[{tiles:[],height:0,width:0}];
 for(const id of rank.items){
  const e=itemsMap.get(id);if(!e)continue;
  const d=dimensions(e,s,ctx);let row=rows[rows.length-1];
  if(row.tiles.length&&row.width+4+d.w>maxWidth){row={tiles:[],height:0,width:0};rows.push(row);}
  const x=row.width+(row.tiles.length?4:0);row.tiles.push({e,d,x});row.width=x+d.w;row.height=Math.max(row.height,d.h);
 }
 const total=rows.reduce((acc,r)=>acc+r.height,0)+Math.max(0,rows.length-1)*4+2;
 const label=fitText(ctx,rank.name,left-12,10000,rank.font||22,9);
 const h=Math.max(rank.minHeight||52,total,Math.ceil(label.lines.length*label.lh)+10);
 return {rank,rows,h,label};
}
function canvasClip(ctx,x,y,w,h,s){
 ctx.beginPath();if(s.shape==='circle'){const r=Math.min(w,h)/2;ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);}
 else if(s.shape==='round'&&ctx.roundRect)ctx.roundRect(x,y,w,h,8);
 else ctx.rect(x,y,w,h);ctx.clip();
}
function imageReady(url){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Image indisponible dans le PNG'));im.src=url;});}
async function create(list){
 await document.fonts?.load('600 24px Poppins');await document.fonts?.load('700 16px Poppins');const s=list.settings,measure=document.createElement('canvas').getContext('2d');
 const items=new Map(list.elements.map(e=>[e.id,e]));
 let titleFit=fitText(measure,list.title||'Nouvelle Tier List',992,1000,24,8,600,2);
 if(titleFit.lines.length>2){titleFit=fitText(measure,list.title||'Nouvelle Tier List',992,1000,8,8,600,2);}
 if(titleFit.lines.length>2){let shortened=titleFit.lines.slice(0,2);let end=shortened[1];while(measure.measureText(end+'…').width>992&&end)end=end.slice(0,-1);shortened[1]=end+'…';titleFit.lines=shortened;}
 const header=Math.ceil(titleFit.lines.length*titleFit.lh)+6;
 const rows=list.ranks.filter(r=>s.showEmpty||r.items.length).map(r=>rowsFor(r,s,measure,items));
 const height=Math.max(1,header+rows.reduce((v,r)=>v+r.h,0)+Math.max(0,rows.length-1));
 const scale=Number(s.scale)||3;
 if(1000*scale*height*scale>110000000||height*scale>16000)throw Error('Classement trop grand pour cet appareil. Choisis une résolution inférieure.');
 const canvas=document.createElement('canvas');canvas.width=1000*scale;canvas.height=height*scale;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Impossible de créer le PNG');
 ctx.scale(scale,scale);ctx.fillStyle=s.canvasBackground;ctx.fillRect(0,0,1000,height);
 ctx.fillStyle=textContrast(s.canvasBackground);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 '+titleFit.n+'px Poppins, sans-serif';
 titleFit.lines.forEach((line,i)=>ctx.fillText(line,500,(i+.5)*titleFit.lh));
 const imageCache=new Map();
 for(const row of rows){for(const tileRow of row.rows){for(const t of tileRow.tiles){if(t.e.type==='image'&&!imageCache.has(t.e.id))imageCache.set(t.e.id,await imageReady(t.e.src));}}}
 const left=Math.round(1000*s.rankWidth/100);
 let y=header;
 for(let index=0;index<rows.length;index++){
  const {rank,rows:tileRows,h}=rows[index];
  ctx.fillStyle=rank.bg;ctx.fillRect(0,y,left,h);ctx.fillStyle='#303030';ctx.fillRect(left+1,y,1000-left-1,h);
  ctx.fillStyle='#000000';ctx.fillRect(left,y,1,h);
  if(index)ctx.fillRect(0,y-1,1000,1);
  drawText(ctx,rank.name,0,y,left,h,rank.font||22,rank.fg||'#202020',700);
  let yy=y+1;
  for(const tr of tileRows){
   for(const tile of tr.tiles){
    const {e,d}=tile,x=left+2+tile.x;
    ctx.save();canvasClip(ctx,x,yy,d.w,d.h,s);
    ctx.fillStyle=e.type==='text'?s.textBackground:s.tileBackground;ctx.fillRect(x,yy,d.w,d.h);
    if(e.type==='image'){
     const im=imageCache.get(e.id);
     if(im){const ratio=(s.fit==='contain'?Math.min:Math.max)(d.w/im.naturalWidth,d.h/im.naturalHeight);
      const dw=im.naturalWidth*ratio,dh=im.naturalHeight*ratio;
      ctx.drawImage(im,x+(d.w-dw)/2,yy+(d.h-dh)/2,dw,dh);
     }
     if(s.showCaptions&&e.text){
      const size=10,lh=11.8;let lines=textLines(ctx,e.text,d.w-4,size,700);
      if(lines.length>2){lines=lines.slice(0,2);ctx.font='700 10px Poppins, sans-serif';let str=lines[1];while(ctx.measureText(str+'…').width>d.w-4&&str)str=str.slice(0,-1);lines[1]=str+'…';}
      const capH=lines.length*lh+2;
      ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(x,yy+d.h-capH,d.w,capH);
      ctx.fillStyle='#fff';ctx.font='700 10px Poppins, sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
      lines.forEach((line,i)=>ctx.fillText(line,x+d.w/2,yy+d.h-capH+1+i*lh));
     }
    }else drawText(ctx,e.text,x,yy,d.w,d.h,16,textContrast(s.textBackground),700);
    ctx.restore();
   }
   yy+=tr.height+4;
  }
  y+=h+1;
 }
 return canvas;
}
function filename(v){return (String(v||'Tier_List').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w-]+/g,'_').replace(/^_+|_+$/g,'')||'Tier_List')+'.png';}
window.RapliTiersExporter={
 async download(list){const canvas=await create(list);const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Encodage PNG impossible')),'image/png'));
 const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=filename(list.title);document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);return {width:canvas.width,height:canvas.height};}
};
})();