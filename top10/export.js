/* Rapli Top 10 — faithful canvas PNG exporter. Single vertical file. */
(() => {
'use strict';
const THEMES={
  magazine:{bg:'#f5f0e4',fg:'#242321',accent:'#9d7545',card:'#e9e0cf',detail:'#73685a',font:'"Libre Baskerville",Georgia,serif'},
  sport:{bg:'#f6f9ff',fg:'#142847',accent:'#2458a3',card:'#e7eefb',detail:'#547ba9',font:'Poppins,Arial,sans-serif'},
  minimal:{bg:'#27292c',fg:'#f7f8fa',accent:'#d0d4d9',card:'#393d43',detail:'#b6c1c9',font:'Poppins,Arial,sans-serif'},
  vintage:{bg:'#ead2aa',fg:'#543f31',accent:'#aa542e',card:'#f7e7ca',detail:'#926544',font:'"DM Serif Display",Georgia,serif'}
};
const safeColor=s=>/^#[a-f\d]{6}$/i.test(s||'')?s:null;
function luminosity(color){let c=color.slice(1),v=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];}
function colors(s){const t=THEMES[s.theme]||THEMES.sport,bg=safeColor(s.background)||t.bg;return {...t,bg,accent:safeColor(s.primary)||t.accent,fg:safeColor(s.background)?luminosity(bg)>.2?'#1d2939':'#f7f8fa':t.fg};}
function fontFor(s,c){return s.font==='poppins'?'Poppins,Arial,sans-serif':s.font==='serif'?'"Libre Baskerville",Georgia,serif':s.font==='display'?'"DM Serif Display",Georgia,serif':c.font;}
function countCols(s,n){if(s.columns!=='auto')return Math.max(1,Math.min(6,Number(s.columns)||1));return s.view==='classic'?(n>24?2:1):n>35?4:n>16?3:2;}
function measureFont(ctx,text,limit,size,min,font,weight=700){while(size>min){ctx.font=weight+' '+size+'px '+font;if(ctx.measureText(text).width<=limit)break;size--;}return size;}
function textLines(ctx,text,maxW,font,size,weight=500){ctx.font=weight+' '+size+'px '+font;const paragraphs=String(text||'').split('\n');const out=[];
for(const paragraph of paragraphs){if(!paragraph){out.push('');continue;}let line='';for(const word of paragraph.split(/\s+/)){const attempt=line?line+' '+word:word;if(ctx.measureText(attempt).width<=maxW){line=attempt;continue;}if(line)out.push(line);line='';if(ctx.measureText(word).width<=maxW){line=word;continue;}let fragment='';for(const char of word){if(ctx.measureText(fragment+char).width>maxW && fragment){out.push(fragment);fragment='';}fragment+=char;}line=fragment;}if(line)out.push(line);}return out.length?out:[''];}
function roundedRect(ctx,x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,Math.min(r,w/2,h/2));if(fill){ctx.fillStyle=fill;ctx.fill();}}
function layoutCard(ctx,item,position,colWidth,config,view,font){const c=config,visual=view==='visual',podium=view==='podium';const pad=visual?16:20;const imageW=visual?colWidth-32:podium?Math.min(colWidth-32,170):item.image?Math.min(148,Math.max(60,colWidth*.19)):0;
const textX=visual?pad:podium?pad:(pad+48+(item.image?imageW+16:0));
const textWidth=Math.max(68,colWidth-textX-pad-(item.logo&&!visual?35:0));
const name=String(item.name||'').trim();const nameSize=measureFont(ctx,name,textWidth,visual?Math.min(27,Math.max(15,colWidth*.1)):Math.min(29,Math.max(15,colWidth*.09)),12,font,800);
const subSize=Math.max(11,Math.min(17,colWidth*.055)),descriptionSize=Math.max(10,Math.min(16,colWidth*.049));
const nameLines=textLines(ctx,name,textWidth,font,nameSize,800),subtitleLines=item.subtitle?textLines(ctx,item.subtitle,textWidth,'Poppins,Arial,sans-serif',subSize,500):[],descriptionLines=item.description?textLines(ctx,item.description,textWidth,font,descriptionSize,400):[];
const textH=nameLines.length*nameSize*1.34+(subtitleLines.length?8+subtitleLines.length*subSize*1.4:0)+(descriptionLines.length?8+descriptionLines.length*descriptionSize*1.43:0)+(item.score?35:0);
let height=visual?(item.image?Math.round(imageW*.74)+16:0)+textH+35:podium?(item.image?Math.round(Math.min(imageW,colWidth-32)*.75)+16:0)+textH+65:Math.max(textH+40,item.image?Math.round(imageW*.8)+28:0,92);
return {item,position,w:colWidth,h:Math.max(height,visual?110:podium?156:90),imageW,textX,textWidth,pad,nameSize,subSize,descriptionSize,nameLines,subtitleLines,descriptionLines,visual,podium,font};
}
function imageFrom(data){return new Promise((resolve,reject)=>{if(!data){resolve(null);return;}const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Une image du classement est illisible.'));i.src=data;});}
function drawImageCover(ctx,img,x,y,w,h){if(!img)return;const ratio=Math.max(w/img.naturalWidth,h/img.naturalHeight),sw=w/ratio,sh=h/ratio,sx=(img.naturalWidth-sw)/2,sy=(img.naturalHeight-sh)/2;ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,7);ctx.clip();ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);ctx.restore();}
function drawText(ctx,lines,x,y,size,leading,color,font,weight=500){ctx.fillStyle=color;ctx.font=weight+' '+size+'px '+font;ctx.textBaseline='top';for(const line of lines){ctx.fillText(line,x,y);y+=size*leading;}return y;}
function drawCard(ctx,box,x,y,pal,images){const {item,w,h,pad,nameSize,subSize,descriptionSize,nameLines,subtitleLines,descriptionLines,textX,textWidth,font,position,visual,podium,imageW}=box;
roundedRect(ctx,x,y,w,h,12,pal.card);
ctx.strokeStyle=pal.accent+'44';ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(x+.75,y+.75,w-1.5,h-1.5,12);ctx.stroke();
if(visual||podium){
let cy=y+pad;
if(item.image){const img=images.get(item.image),ih=Math.round(imageW*.74);drawImageCover(ctx,img,x+pad,cy,w-pad*2,ih);cy+=ih+13;}
const nr=position+1;
roundedRect(ctx,x+12,y+12,Math.max(44,Math.ceil(Math.log10(nr+1))*17+28),43,7,pal.accent);
ctx.fillStyle=pal.bg;ctx.textAlign='center';ctx.font='800 25px Poppins,Arial,sans-serif';ctx.textBaseline='middle';ctx.fillText(String(nr).padStart(2,'0'),x+12+Math.max(44,Math.ceil(Math.log10(nr+1))*17+28)/2,y+33);ctx.textAlign='left';
cy=drawText(ctx,nameLines,x+pad,cy,nameSize,1.34,pal.fg,font,800);
if(subtitleLines.length)cy=drawText(ctx,subtitleLines,x+pad,cy+8,subSize,1.4,pal.detail,'Poppins,Arial,sans-serif');
if(descriptionLines.length)cy=drawText(ctx,descriptionLines,x+pad,cy+8,descriptionSize,1.43,pal.fg,font,400);
if(item.score){roundedRect(ctx,x+pad,cy+7,Math.min(w-pad*2,Math.max(48,String(item.score).length*9+20)),26,6,pal.accent);drawText(ctx,[String(item.score)],x+pad+9,cy+11,12,1.2,pal.bg,'Poppins,Arial,sans-serif',800);}
if(item.logo){const im=images.get(item.logo);if(im)ctx.drawImage(im,x+w-48,y+10,34,34);}
return;
}
ctx.font='800 31px Poppins,Arial,sans-serif';ctx.fillStyle=pal.accent;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(position+1).padStart(2,'0'),x+pad+16,y+h/2);ctx.textAlign='left';
if(item.image){const img=images.get(item.image),ih=Math.min(h-24,imageW*.8);drawImageCover(ctx,img,x+pad+48,y+(h-ih)/2,imageW,ih);}
let cy=y+(h-(nameLines.length*nameSize*1.34+(subtitleLines.length?8+subtitleLines.length*subSize*1.4:0)+(descriptionLines.length?8+descriptionLines.length*descriptionSize*1.43:0)+(item.score?35:0)))/2;
cy=drawText(ctx,nameLines,x+textX,cy,nameSize,1.34,pal.fg,font,800);
if(subtitleLines.length)cy=drawText(ctx,subtitleLines,x+textX,cy+8,subSize,1.4,pal.detail,'Poppins,Arial,sans-serif');
if(descriptionLines.length)cy=drawText(ctx,descriptionLines,x+textX,cy+8,descriptionSize,1.43,pal.fg,font,400);
if(item.score){let bw=Math.min(textWidth,Math.max(50,String(item.score).length*9+20));roundedRect(ctx,x+textX,cy+6,bw,25,5,pal.accent);drawText(ctx,[String(item.score)],x+textX+8,cy+10,12,1.2,pal.bg,'Poppins,Arial,sans-serif',800);}
if(item.logo){const img=images.get(item.logo);if(img)ctx.drawImage(img,x+w-40,y+12,27,27);}
}
function generateLayout(ctx,list){const s=list.settings,pal=colors(s),font=fontFor(s,pal),W=1080,edge=38,gap=14,cols=countCols(s,list.positions.length);
const title=String(list.title||'Mon Top 10'),titleSize=measureFont(ctx,title,W-edge*2,40,24,font,800),titleLines=textLines(ctx,title,W-edge*2,font,titleSize,800);let y=edge+titleLines.length*titleSize*1.32+36;const entries=[];
function addGrid(positions,start,gridCols,isPodium){if(!positions.length)return;const colW=(W-edge*2-gap*(gridCols-1))/gridCols;
let row=[];for(let n=0;n<positions.length;n++){const pos=start+n,item=positions[n],box=layoutCard(ctx,item,pos,colW,pal,isPodium?'podium':s.view,font);const col=n%gridCols;row.push({box,col});if(col===gridCols-1||n===positions.length-1){const maxH=Math.max(...row.map(q=>q.box.h));for(const q of row){const xx=edge+q.col*(colW+gap);entries.push({box:{...q.box,h:maxH},x:xx,y});}y+=maxH+gap;row=[];}}}
if(s.view==='podium'){const podium=list.positions.slice(0,3);if(podium.length){const ordered=[podium[1],podium[0],podium[2]].filter(Boolean),width=(W-edge*2-2*gap)/3;const boxes=ordered.map(item=>layoutCard(ctx,item,list.positions.indexOf(item),width,pal,'podium',font));const maxH=Math.max(220,...boxes.map(b=>b.h));boxes.forEach((box,i)=>{entries.push({box:{...box,h:maxH+(box.position===0?40:0)},x:edge+i*(width+gap),y:y+(box.position===0?0:40)});});y+=maxH+40+gap;}addGrid(list.positions.slice(3),3,cols,false);}
else addGrid(list.positions,0,cols,false);
return {W,height:Math.ceil(y-gap+edge),title,titleSize,titleLines,titleFont:font,titleStart:edge,pal,entries};}
async function download(list){if(!list||!Array.isArray(list.positions))throw Error('Classement invalide.');const missing=list.positions.findIndex(p=>!String(p.name||'').trim());if(missing>=0)throw Error('Nom manquant à la position '+(missing+1));
await document.fonts?.ready;const metricCanvas=document.createElement('canvas'),metric=metricCanvas.getContext('2d');if(!metric)throw Error('Canvas indisponible');
const layout=generateLayout(metric,list),scale=Math.max(1,Math.min(4,Number(list.settings?.scale)||3)),width=layout.W*scale,height=layout.height*scale;
// Conservative 16 MP cap to support iOS Safari (other browsers may allow larger surfaces).
if(width>8192||height>16384||width*height>16_000_000)throw Error('Image trop grande ('+width+' × '+height+' px). Choisis ×1 ou moins de colonnes dans EXPORT / COLONNES.');
const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Canvas indisponible');ctx.setTransform(scale,0,0,scale,0,0);
ctx.fillStyle=layout.pal.bg;ctx.fillRect(0,0,layout.W,layout.height);
const urls=new Set();for(const p of list.positions){if(p.image)urls.add(p.image);if(p.logo)urls.add(p.logo);}
const pairs=await Promise.all(Array.from(urls).map(async u=>[u,await imageFrom(u)]));const images=new Map(pairs);
let ty=layout.titleStart;ty=drawText(ctx,layout.titleLines,38,ty,layout.titleSize,1.32,layout.pal.fg,layout.titleFont,800);
ctx.fillStyle=layout.pal.accent;ctx.fillRect(38,ty+14,1004,4);
for(const entry of layout.entries)drawCard(ctx,entry.box,entry.x,entry.y,layout.pal,images);
const blob=await new Promise((resolve,reject)=>{try{canvas.toBlob(b=>b?resolve(b):reject(Error('Le navigateur n’a pas pu encoder cette image.')),'image/png');}catch(e){reject(e);}});
const filename=(list.title||'Rapli Top 10').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90)||'rapli-top-10';
const url=URL.createObjectURL(blob);try{const a=document.createElement('a');a.href=url;a.download=filename+'.png';document.body.appendChild(a);a.click();a.remove();}finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}
return {width,height,bytes:blob.size};
}
window.RapliTop10Exporter={download,generateLayout,countCols};
})();
