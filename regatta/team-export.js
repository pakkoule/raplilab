/* Rapli Regatta · premium LPDB ranking PNGs.
   One vertically adaptive canvas per export (no hidden pages, no cropped skipper names).
   All rendering remains client-side; illustrations come from linked personal race records. */
(function(root){
'use strict';
const WIDTH=1500;
const LEFT=72,RIGHT=WIDTH-72;
const COLORS={ink:'#2c3136',muted:'#71777d',silver:'#cbd0d3',paper:'#f8f9f9',
  gold:'#b18a36',bronze:'#a97957',line:'#d8dcde'};
const num=value=>Number(value||0).toLocaleString('fr-FR',{maximumFractionDigits:1});
const label=value=>String(value??'');
const finite=value=>Number.isSafeInteger(value)&&value>=0;
const duration=value=>{
 if(!finite(value))return '—';
 const d=Math.floor(value/86400),h=Math.floor(value%86400/3600),
  m=Math.floor(value%3600/60),s=value%60;
 const pad=n=>String(n).padStart(2,'0');
 return (d?pad(d)+'j ':'')+pad(d?h:Math.floor(value/3600))+':'+pad(m)+':'+pad(s);
};
const imageSource=value=>typeof value==='string'&&/^data:image\/(?:png|jpeg|webp|gif);base64,/iu.test(value)?value:null;
const canvasFont=(size=24,weight=700)=>weight+' '+size+'px Poppins, Arial, sans-serif';
function rounded(ctx,x,y,w,h,r){
 const radius=Math.min(r,w/2,h/2);
 ctx.beginPath();
 if(typeof ctx.roundRect==='function')ctx.roundRect(x,y,w,h,radius);
 else{ctx.moveTo(x+radius,y);ctx.arcTo(x+w,y,x+w,y+h,radius);ctx.arcTo(x+w,y+h,x,y+h,radius);
  ctx.arcTo(x,y+h,x,y,radius);ctx.arcTo(x,y,x+w,y,radius);ctx.closePath();}
}
function fillRound(ctx,x,y,w,h,r,color){
 ctx.fillStyle=color;rounded(ctx,x,y,w,h,r);ctx.fill();
}
function strokeRound(ctx,x,y,w,h,r,color,width=1){
 ctx.lineWidth=width;ctx.strokeStyle=color;rounded(ctx,x,y,w,h,r);ctx.stroke();
}
function fitImage(ctx,img,x,y,w,h){
 if(!img?.width||!img?.height)return false;
 ctx.save();rounded(ctx,x,y,w,h,17);ctx.clip();
 const factor=Math.max(w/img.width,h/img.height);
 const iw=img.width*factor,ih=img.height*factor;
 ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
 ctx.restore();return true;
}
async function loadImage(src){
 if(!src)return null;
 return new Promise(resolve=>{
  const image=new Image();
  image.onload=()=>resolve(image);
  image.onerror=()=>resolve(null);
  image.src=src;
 });
}
/* Every character is retained: long tokens are split into measured lines rather than sliced. */
function wrapText(ctx,text,maxWidth){
 const value=label(text).normalize('NFC');
 if(!value)return [''];
 if(maxWidth<=0)return Array.from(value);
 const lines=[];
 let line='';
 for(const word of value.split(/(\s+)/u)){
  if(!word)continue;
  const attempt=line+word;
  if(ctx.measureText(attempt).width<=maxWidth){line=attempt;continue;}
  if(line.trim()){lines.push(line.trimEnd());line='';}
  if(ctx.measureText(word).width<=maxWidth){line=word.trimStart();continue;}
  let piece='';
  for(const char of Array.from(word)){
   if(piece&&ctx.measureText(piece+char).width>maxWidth){lines.push(piece);piece='';}
   piece+=char;
  }
  line=piece;
 }
 if(line.trim()||!lines.length)lines.push(line.trimEnd());
 return lines;
}
function rankRows(rows,context){
 const race=Boolean(context.race);
 return rows.map((row,index)=>{
  const name=label(row.name)||'Skipper sans pseudo';
  const size=name.length>42?22:26;
  context.ctx.font=canvasFont(size,750);
  const lines=wrapText(context.ctx,name,race?394:575);
  const rowHeight=Math.max(76,18+lines.length*32);
  return {...row,name,nameLines:lines,nameSize:size,rowHeight,
   rank:row.dnf?'DNF':Number.isInteger(row.rank)?row.rank:index+1};
 });
}
function plan(rows,{race=false,style='table',limit=0,ctx}={}){
 const source=limit>0?rows.slice(0,limit):rows;
 const items=rankRows(source,{ctx,race});
 const podium=style==='social'&&limit===3;
 const top10=style==='social'&&!podium;
 const heroHeight=race?605:330;
 const top10Bonus=top10?122:0;
 const tableHead=64;
 const bodyHeight=podium?Math.max(390,items.reduce((sum,i)=>sum+Math.max(105,i.rowHeight),0)):
  items.reduce((sum,i)=>sum+i.rowHeight,0);
 const height=heroHeight+top10Bonus+tableHead+bodyHeight+130;
 return {items,podium,top10,heroHeight,top10Bonus,tableHead,height,width:WIDTH,bodyHeight};
}
function drawBackground(ctx,height){
 const backdrop=ctx.createLinearGradient(0,0,WIDTH,height);
 backdrop.addColorStop(0,'#fff');backdrop.addColorStop(.22,'#e7e9ea');
 backdrop.addColorStop(.45,'#f9fafa');backdrop.addColorStop(.76,'#e3e5e6');
 backdrop.addColorStop(1,'#fcfcfc');
 ctx.fillStyle=backdrop;ctx.fillRect(0,0,WIDTH,height);
 ctx.fillStyle='#ffffff71';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(WIDTH*.74,0);
 ctx.lineTo(WIDTH*.23,height);ctx.lineTo(0,height);ctx.fill();
 strokeRound(ctx,19,19,WIDTH-38,height-38,0,'#aeb4b8',4);
 strokeRound(ctx,28,28,WIDTH-56,height-56,0,'#ffffff',2);
 fillRound(ctx,34,38,7,height-76,1,'#afb5b7');
}
function drawChips(ctx,values,x,y){
 let current=x;
 for(const value of values.filter(Boolean)){
  const text=label(value).toLocaleUpperCase('fr');
  ctx.font=canvasFont(20,750);
  const w=ctx.measureText(text).width+30;
  const gradient=ctx.createLinearGradient(current,y,current+w,y+46);
  gradient.addColorStop(0,'#fff');gradient.addColorStop(.5,'#e5e8e9');gradient.addColorStop(1,'#f7f8f8');
  fillRound(ctx,current,y,w,44,10,gradient);
  strokeRound(ctx,current,y,w,44,10,'#c8cdd0');
  ctx.textAlign='left';ctx.fillStyle=COLORS.ink;ctx.fillText(text,current+15,y+30);
  current+=w+12;
 }
}
function drawHeader(ctx,plan,opts,logo,illustration){
 const race=opts.race||null;
 const compact=Boolean(race);
 const title=label(race?.name||opts.title||'CHAMPIONNAT LPDB');
 ctx.save();ctx.fillStyle='#4d555b';ctx.textAlign='left';ctx.font=canvasFont(19,750);
 ctx.fillText('LPDB  /  CHAMPIONNAT DE L’ÉQUIPE',230,82);
 if(logo){
  fillRound(ctx,66,68,145,123,12,'#fff');
  const aspect=Math.min(135/logo.width,113/logo.height);
  const logoW=logo.width*aspect,logoH=logo.height*aspect;
  ctx.drawImage(logo,72+(135-logoW)/2,73+(113-logoH)/2,logoW,logoH);
 }
 ctx.fillStyle=COLORS.ink;ctx.font=canvasFont(59,900);
 ctx.fillText('RAPLI REGATTA',230,145);
 const titleFont=compact?43:37;
 ctx.font=canvasFont(titleFont,850);
 const lines=wrapText(ctx,title.toLocaleUpperCase('fr'),compact?755:1150);
 let shown=lines;
 if(compact&&shown.length>3){
  ctx.font=canvasFont(33,850);
  shown=wrapText(ctx,title.toLocaleUpperCase('fr'),810);
 }
 shown=shown.slice(0,compact?3:2);
 ctx.fillStyle='#343a3f';
 shown.forEach((line,i)=>ctx.fillText(line,230,207+i*50));
 if(compact){
  const metaY=218+shown.length*50;
  drawChips(ctx,[race.boatClass||'BATEAU NON RENSEIGNÉ',
    race.vsr==='hc'?'HC':race.vsr?.toUpperCase()],230,metaY);
  if(race.stageGroup){
   ctx.textAlign='left';ctx.fillStyle=COLORS.muted;ctx.font=canvasFont(17,650);
   ctx.fillText(label(race.stageGroup).slice(0,90),230,metaY+67);
  }
  if(illustration){
   fitImage(ctx,illustration,1064,76,344,242);
   strokeRound(ctx,1064,76,344,242,17,'#aeb5b7',3);
  }else{
   const foil=ctx.createLinearGradient(1064,78,1410,318);
   foil.addColorStop(0,'#fafbfb');foil.addColorStop(.5,'#d2d6d8');foil.addColorStop(1,'#fff');
   fillRound(ctx,1064,76,344,242,17,foil);
   strokeRound(ctx,1064,76,344,242,17,'#bdc2c5',2);
   if(logo)ctx.drawImage(logo,1148,119,173,156);
  }
  if(race.dateEnd){
   ctx.fillStyle=COLORS.muted;ctx.font=canvasFont(18,650);
   ctx.fillText('CLASSEMENT CLÔTURÉ LE '+race.dateEnd.split('-').reverse().join('/'),230,metaY+(race.stageGroup?97:75));
  }
  const y=505;
  const stats=[
   ['CLASSÉS',num(race.finishers??0)],
   ['DNF',num(race.dnf??0)],
   ['NOTE MOYENNE',race.average!=null?num(race.average)+'/100':'—']
  ];
  let x=75;
  for(const [k,value] of stats){
   const w=435;
   const silver=ctx.createLinearGradient(x,y,x+w,y+69);
   silver.addColorStop(0,'#fdfefe');silver.addColorStop(.52,'#e9ebec');silver.addColorStop(1,'#f9fafa');
   fillRound(ctx,x,y,w,70,12,silver);strokeRound(ctx,x,y,w,70,12,'#ccd1d3');
   ctx.fillStyle=COLORS.muted;ctx.font=canvasFont(17,800);ctx.fillText(k,x+18,y+25);
   ctx.fillStyle=COLORS.ink;ctx.font=canvasFont(28,850);ctx.fillText(value,x+18,y+58);
   x+=445;
  }
 }else{
  ctx.fillStyle=COLORS.muted;ctx.font=canvasFont(23,700);
  ctx.fillText(opts.title||'Classement LPDB',230,255);
 }
 ctx.restore();
}
function drawTableHeader(ctx,race,y){
 const g=ctx.createLinearGradient(67,y,WIDTH-67,y+56);
 g.addColorStop(0,'#d9dddf');g.addColorStop(.4,'#fff');g.addColorStop(1,'#dfe2e4');
 fillRound(ctx,65,y,WIDTH-130,55,10,g);
 ctx.font=canvasFont(18,850);ctx.fillStyle='#596168';
 ctx.textBaseline='middle';
 const labels=race?
  [['RANG',91,'left'],['SKIPPER',202,'left'],['GÉN. VR',740,'right'],
   ['CHRONO',935,'right'],['ÉCART',1105,'right'],['NOTE',1295,'right'],['POINTS',1410,'right']]:
  [['RANG',91,'left'],['SKIPPER',202,'left'],['COURSES',820,'right'],
   ['CHRONO MOY.',1052,'right'],['ÉCART MOY.',1250,'right'],['POINTS',1410,'right']];
 for(const [text,x,align] of labels){ctx.textAlign=align;ctx.fillText(text,x,y+29);}
 ctx.textBaseline='alphabetic';
}
function noteText(row){return row.note?.available?num(row.note.value)+'/100'+(row.note.provisional?'*':''):'—';}
function drawTableRow(ctx,row,index,y,race){
 const bg=ctx.createLinearGradient(65,y,WIDTH-65,y+row.rowHeight);
 const winner=row.rank===1&&!row.dnf,runner=row.rank===2&&!row.dnf,third=row.rank===3&&!row.dnf;
 bg.addColorStop(0,winner?'#f9f4e9':runner?'#f1f3f4':third?'#f7eee8':index%2?'#f7f8f8':'#e9ebed');
 bg.addColorStop(.6,'#fff');
 bg.addColorStop(1,winner?'#f6efdc':'#f1f2f2');
 fillRound(ctx,67,y+2,WIDTH-134,row.rowHeight-5,12,bg);
 strokeRound(ctx,67,y+2,WIDTH-134,row.rowHeight-5,12,winner?'#dbcda6':'#e0e3e4',1);
 if(winner||runner||third){
  fillRound(ctx,68,y+7,6,row.rowHeight-15,3,winner?COLORS.gold:runner?'#9ca8b2':COLORS.bronze);
 }
 const mid=y+row.rowHeight/2;
 ctx.textBaseline='middle';ctx.textAlign='left';
 ctx.fillStyle=winner?COLORS.gold:runner?'#8c9ba7':third?COLORS.bronze:COLORS.ink;
 ctx.font=canvasFont(29,900);
 ctx.fillText(label(row.rank),91,mid);
 ctx.fillStyle=COLORS.ink;ctx.font=canvasFont(row.nameSize,770);
 const y0=mid-(row.nameLines.length-1)*16;
 row.nameLines.forEach((line,i)=>ctx.fillText(line,202,y0+i*32));
 ctx.textAlign='right';ctx.fillStyle='#4d545b';ctx.font=canvasFont(21,650);
 if(race){
  ctx.fillText(row.generalRank!=null?'#'+num(row.generalRank):'—',740,mid);
  ctx.fillText(duration(row.elapsedSeconds),935,mid);
  ctx.fillText(row.gapSeconds!=null?'+ '+duration(row.gapSeconds):'—',1105,mid);
  ctx.fillStyle=row.note?.available?COLORS.ink:'#858b90';
  ctx.font=canvasFont(22,850);ctx.fillText(noteText(row),1295,mid);
 }else{
  ctx.fillText(num(row.participations),820,mid);
  ctx.fillText(duration(row.avgTimeSeconds),1052,mid);
  ctx.fillText(duration(row.avgGapSeconds),1250,mid);
 }
 ctx.fillStyle=COLORS.ink;ctx.font=canvasFont(28,900);
 ctx.fillText(num(row.points),1410,mid);
 ctx.textBaseline='alphabetic';
}
function drawPodium(ctx,items,y,race){
 const order=[items[1],items[0],items[2]];
 const colors=['#9ca7b2',COLORS.gold,COLORS.bronze];
 const xs=[70,540,1010],width=417,height=275;
 for(let i=0;i<order.length;i++){
  const row=order[i];if(!row)continue;
  const g=ctx.createLinearGradient(xs[i],y,xs[i]+width,y+height);
  g.addColorStop(0,'#fff');g.addColorStop(.45,'#e6e8e9');g.addColorStop(1,'#fafafa');
  fillRound(ctx,xs[i],y+(i===1?0:35),width,height-(i===1?0:35),17,g);
  strokeRound(ctx,xs[i],y+(i===1?0:35),width,height-(i===1?0:35),17,colors[i],3);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=colors[i];ctx.font=canvasFont(50,900);
  ctx.fillText(row.dnf?'DNF':label(row.rank),xs[i]+width/2,y+(i===1?55:85));
  ctx.fillStyle=COLORS.ink;ctx.font=canvasFont(22,800);
  const nameLines=wrapText(ctx,row.name,width-42);
  const start=y+(i===1?104:120);
  const display= nameLines.length>3?(()=>{
   ctx.font=canvasFont(17,800);
   return wrapText(ctx,row.name,width-36);
  })():nameLines;
  display.forEach((line,k)=>ctx.fillText(line,xs[i]+width/2,start+k*23));
  ctx.font=canvasFont(25,900);ctx.fillText(num(row.points)+' PTS',xs[i]+width/2,y+205);
  if(race){
   ctx.font=canvasFont(17,680);
   ctx.fillText('NOTE '+noteText(row)+'   ·   '+duration(row.elapsedSeconds),xs[i]+width/2,y+242);
  }
 }
 ctx.textBaseline='alphabetic';
}
function drawFooter(ctx,height,opts){
 const y=height-76;
 ctx.strokeStyle='#cdd2d4';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(76,y-26);ctx.lineTo(WIDTH-76,y-26);ctx.stroke();
 ctx.textAlign='center';ctx.fillStyle='#6b7378';ctx.font=canvasFont(18,700);
 ctx.fillText('LPDB  ·  CHAMPIONNAT DE L’ÉQUIPE  ·  RAPLI REGATTA',WIDTH/2,y+13);
 if(opts.race){ctx.textAlign='right';ctx.font=canvasFont(15,500);ctx.fillText('Notes disponibles · équipement exclu',WIDTH-82,y+45);}
}
async function downloadCanvas(canvas,filename){
 const blob=await new Promise((resolve,reject)=>{
  canvas.toBlob(value=>value?resolve(value):reject(Error('Le navigateur ne peut pas créer ce PNG.')),'image/png');
 });
 const url=URL.createObjectURL(blob);
 try{
  const link=document.createElement('a');
  link.href=url;link.download=filename;
  document.body.appendChild(link);link.click();link.remove();
 }finally{setTimeout(()=>URL.revokeObjectURL(url),4000);}
}
async function exportPng(opts){
 const rows=Array.isArray(opts?.rows)?opts.rows:[];
 if(!rows.length)throw Error('Le classement est vide.');
 if(root.document?.fonts?.ready)try{await document.fonts.ready;}catch(_){}
 const measure=document.createElement('canvas').getContext('2d');
 if(!measure)throw Error('Impossible de préparer le rendu PNG.');
 const layout=plan(rows,{ctx:measure,race:!!opts.race,style:opts.style,limit:opts.limit});
 const canvas=document.createElement('canvas');
 canvas.width=WIDTH;canvas.height=layout.height;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas PNG indisponible.');
 const [logo,illustration]=await Promise.all([
  loadImage('assets/lpdb.webp'),loadImage(imageSource(opts.race?.illustration))
 ]);
 drawBackground(ctx,layout.height);drawHeader(ctx,layout,opts,logo,illustration);
 const y=layout.heroHeight;
 if(layout.podium){
  drawPodium(ctx,layout.items,y+16,!!opts.race);
 }else{
  if(layout.top10&&layout.items.length){
   const champ=layout.items[0],g=ctx.createLinearGradient(76,y,1400,y+106);
   g.addColorStop(0,'#f8f2e4');g.addColorStop(.5,'#fff');g.addColorStop(1,'#eee8da');
   fillRound(ctx,76,y+6,WIDTH-152,108,16,g);strokeRound(ctx,76,y+6,WIDTH-152,108,16,'#decda1',2);
   ctx.textAlign='left';ctx.fillStyle='#897036';ctx.font=canvasFont(19,800);ctx.fillText('PREMIER DU CLASSEMENT',97,y+42);
   ctx.font=canvasFont(29,850);ctx.fillStyle=COLORS.ink;
   const names=wrapText(ctx,champ.name,960);
   names.slice(0,2).forEach((line,i)=>ctx.fillText(line,98,y+80+i*26));
   ctx.textAlign='right';ctx.font=canvasFont(36,900);
   ctx.fillText(num(champ.points)+' PTS',1390,y+76);
  }
  const headY=y+layout.top10Bonus;
  drawTableHeader(ctx,!!opts.race,headY);
  let position=headY+layout.tableHead;
  for(let i=0;i<layout.items.length;i++){
   drawTableRow(ctx,layout.items[i],i,position,!!opts.race);
   position+=layout.items[i].rowHeight;
  }
 }
 drawFooter(ctx,layout.height,opts);
 await downloadCanvas(canvas,(opts.filename||'lpdb-classement')+'.png');
 return {count:layout.items.length,width:WIDTH,height:layout.height,fileCount:1};
}
const api={exportPng,plan,wrapText,duration,imageSource};
root.RapliTeamExport=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
