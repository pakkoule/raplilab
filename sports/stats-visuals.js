/* Rapli Sports — varied OWN-only analytics visuals and native high-resolution PNG export. */
(function(root){
  'use strict';
  const palette=[
    ['#087fb8','#35b8d9','#9bdef0','#2d61c5','#7b9be8','#c5e6f8'],
    ['#c24d66','#f08f64','#f5bd77','#a95cad','#e7a3c7','#f8d7ca'],
    ['#167d69','#51b79c','#8cceaa','#e2b46f','#4b9da6','#cae9d7'],
    ['#6f58b8','#9c75d8','#c9ade9','#6474b9','#d89dbb','#e7dff8'],
    ['#a86e13','#e0a847','#efca79','#d0a073','#8d7e42','#f7e8bd'],
    ['#364e9d','#5774c5','#8795d6','#c17eab','#e9b8d2','#c3d2f4'],
    ['#c74c73','#e6819e','#f0b5ca','#ac6bca','#df9ab9','#f6d5de'],
    ['#087c89','#4cafb3','#7bc8c2','#accd90','#d5bb79','#b8e6e6']
  ];
  const formats=['donut','bars','lollipop','bars','chips','stacked','donut','stacked'];
  const safeNum=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
  const countTotal=entries=>entries.reduce((sum,item)=>sum+safeNum(item.count),0);
  const format=x=>safeNum(x).toLocaleString('fr-FR');
  const compact=entries=>{
    const top=entries.slice(0,5).map(item=>({label:String(item.label),count:safeNum(item.count)}));
    if(entries.length>5)top.push({label:'Autres',count:countTotal(entries.slice(5))});
    return top.filter(item=>item.count>0);
  };
  const colors=i=>palette[i%palette.length];
  const ratio=(count,max)=>max>0?Math.max(0,Math.min(100,100*count/max)):0;
  function donutHTML(entries,p,escape){
    const parts=compact(entries),total=countTotal(parts);
    let end=0;
    const layers=parts.map((item,i)=>{
      const start=end;
      end+=ratio(item.count,total);
      return p[i%p.length]+' '+start.toFixed(3)+'% '+end.toFixed(3)+'%';
    });
    const arcs='conic-gradient('+layers.join(',')+')';
    const legend=parts.map((item,i)=>'<div class="stats-legend-line"><span class="stats-legend-dot" style="background:'+p[i%p.length]+'"></span>'+
      '<span>'+escape(item.label)+'</span><strong>'+format(item.count)+'</strong></div>').join('');
    return '<div class="stats-donut-layout"><div class="stats-donut" style="background:'+arcs+'" role="img" aria-label="Répartition de '+format(total)+' occurrences">'+
      '<div class="stats-donut-core"><strong>'+format(total)+'</strong><small>occurrences</small></div></div>'+
      '<div class="stats-legend">'+legend+'</div></div>';
  }
  function barsHTML(entries,p,kind,escape,owned){
    const peak=Math.max(1,...entries.slice(0,8).map(item=>safeNum(item.count)));
    return '<div class="stats-rank-list">'+entries.slice(0,8).map((item,i)=>{
      const value=safeNum(item.count),pct=ratio(value,peak),rate=owned?Math.round(value/owned*100):0;
      const color=p[i%p.length],lollipop=kind==='lollipop';
      return '<div class="stats-rank-row"><div class="stats-rank-top"><span title="'+escape(item.label)+'">'+escape(item.label)+'</span>'+
        '<strong>'+format(value)+' <small>· '+rate+' %</small></strong></div>'+
        '<div class="stats-track '+(lollipop?'stats-track-lollipop':'')+'" aria-hidden="true"><span style="width:'+pct.toFixed(2)+'%;background:'+color+'">'+
        (lollipop?'<i style="background:'+color+'"></i>':'')+'</span></div></div>';
    }).join('')+'</div>';
  }
  function stackedHTML(entries,p,escape){
    const parts=compact(entries),total=countTotal(parts);
    let end=0;
    const blocks=parts.map((item,i)=>{
      const percent=ratio(item.count,total),start=end;end+=percent;
      return '<span class="stats-stack-segment" style="width:'+percent.toFixed(3)+'%;background:'+p[i%p.length]+'" title="'+escape(item.label)+' · '+format(item.count)+'"></span>';
    }).join('');
    return '<div class="stats-stacked"><div class="stats-stacked-total"><strong>'+format(total)+'</strong><span>occurrences catégorisées</span></div>'+
      '<div class="stats-stack-track" role="img" aria-label="Répartition par catégories">'+blocks+'</div>'+
      '<div class="stats-stack-legend">'+parts.map((item,i)=>'<div><span class="stats-legend-dot" style="background:'+p[i%p.length]+'"></span>'+
      '<span>'+escape(item.label)+'</span><strong>'+format(item.count)+'</strong></div>').join('')+'</div></div>';
  }
  function chipsHTML(entries,p,escape){
    return '<div class="stats-chip-cloud">'+entries.slice(0,8).map((item,i)=>
      '<div class="stats-frequency-chip" style="--chip-color:'+p[i%p.length]+'"><span>'+escape(item.label)+'</span><strong>'+format(item.count)+'</strong></div>'
    ).join('')+'</div>';
  }
  function renderPanels(breakdowns,escape,owned){
    if(!Array.isArray(breakdowns))return '';
    return breakdowns.map((entry,i)=>{
      const p=colors(i),type=entry.chartType==='season-bars'?'bars':formats[i%formats.length],list=Array.isArray(entry.data)?entry.data:[];
      let content;
      if(!list.length)content='<p class="stats-visual-empty">Aucune donnée renseignée pour cette catégorie.</p>';
      else if(type==='donut')content=donutHTML(list,p,escape);
      else if(type==='stacked')content=stackedHTML(list,p,escape);
      else if(type==='chips')content=chipsHTML(list,p,escape);
      else content=barsHTML(list,p,type,escape,owned);
      return '<section class="stats-breakdown" data-chart="'+type+'" style="--chart-color:'+p[0]+';--chart-soft:'+p[2]+'">'+
        '<div class="stats-breakdown-heading"><span class="stats-chart-index">'+String(i+1).padStart(2,'0')+'</span>'+
        '<div><h4>'+escape(entry.title)+'</h4><small>'+list.length+' catégorie'+(list.length!==1?'s':'')+'</small></div></div>'+
        content+(list.length>8&&type!=='donut'&&type!=='stacked'?'<p class="stats-kpi-sub">+'+format(list.length-8)+' autres entrées</p>':'')+
        '</section>';
    }).join('');
  }
  function round(ctx,x,y,w,h,r,color){
    const rad=Math.min(r,w/2,h/2);
    ctx.beginPath();ctx.moveTo(x+rad,y);
    ctx.arcTo(x+w,y,x+w,y+h,rad);ctx.arcTo(x+w,y+h,x,y+h,rad);
    ctx.arcTo(x,y+h,x,y,rad);ctx.arcTo(x,y,x+w,y,rad);
    ctx.closePath();ctx.fillStyle=color;ctx.fill();
  }
  function txt(ctx,value,x,y,font,color,maxWidth){
    ctx.font=font;ctx.fillStyle=color;
    let text=String(value??'');
    if(maxWidth>0&&ctx.measureText(text).width>maxWidth){
      while(text.length&&ctx.measureText(text+'…').width>maxWidth)text=text.slice(0,-1);
      text+='…';
    }
    ctx.fillText(text,x,y);
  }
  function circle(ctx,x,y,r,color){
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  }
  function drawStatsPanel(ctx,entry,i,x,y,w,h,owned){
    const p=colors(i),type=entry.chartType==='season-bars'?'bars':formats[i%formats.length],items=Array.isArray(entry.data)?entry.data:[],
      inner=x+32;
    round(ctx,x,y,w,h,21,'#ffffff');
    round(ctx,x,y,9,h,5,p[0]);
    round(ctx,inner,y+27,43,36,10,p[2]);
    txt(ctx,String(i+1).padStart(2,'0'),inner+10,y+51,'900 16px Poppins, sans-serif','#183454');
    txt(ctx,entry.title,inner+58,y+51,'800 24px Poppins, sans-serif','#213757',w-123);
    txt(ctx,format(items.length)+' CATÉGORIES',inner,y+79,'700 14px Poppins, sans-serif','#8090a5');
    if(!items.length){
      txt(ctx,'Aucune donnée renseignée',inner,y+155,'600 19px Poppins, sans-serif','#8798ad');
      return;
    }
    if(type==='donut'){
      const parts=compact(items),total=countTotal(parts),cx=x+154,cy=y+236,r=93;
      let start=-Math.PI/2;
      for(let j=0;j<parts.length;j++){
        const size=parts[j].count/total*Math.PI*2;
        ctx.beginPath();ctx.arc(cx,cy,r,start,start+size);
        ctx.arc(cx,cy,58,start+size,start,true);
        ctx.closePath();ctx.fillStyle=p[j%p.length];ctx.fill();
        start+=size;
      }
      circle(ctx,cx,cy,53,'#ffffff');
      ctx.textAlign='center';txt(ctx,format(total),cx,cy+6,'900 29px Poppins, sans-serif','#213757');
      txt(ctx,'OCCURRENCES',cx,cy+28,'700 11px Poppins, sans-serif','#7d8fa6');ctx.textAlign='left';
      parts.forEach((item,j)=>{
        const lx=x+291,ly=y+129+j*40;
        round(ctx,lx,ly-12,17,17,5,p[j%p.length]);
        txt(ctx,item.label,lx+30,ly+2,'700 17px Poppins, sans-serif','#40556e',w-406);
        ctx.textAlign='right';txt(ctx,format(item.count),x+w-35,ly+2,'900 18px Poppins, sans-serif','#213757',75);ctx.textAlign='left';
      });
      return;
    }
    if(type==='stacked'){
      const parts=compact(items),total=countTotal(parts),barX=inner,barY=y+123,barW=w-64;
      txt(ctx,format(total)+' OCCURRENCES',inner,barY-18,'900 17px Poppins, sans-serif',p[0]);
      round(ctx,barX,barY,barW,24,12,'#eaf0f5');
      let cursor=barX;
      for(let j=0;j<parts.length;j++){
        const seg=barW*parts[j].count/total;
        ctx.fillStyle=p[j%p.length];ctx.fillRect(cursor,barY,seg,24);cursor+=seg;
      }
      parts.forEach((item,j)=>{
        const ly=y+190+j*32;
        round(ctx,inner,ly-12,15,15,4,p[j%p.length]);
        txt(ctx,item.label,inner+27,ly,'700 17px Poppins, sans-serif','#456078',w-164);
        ctx.textAlign='right';txt(ctx,format(item.count),x+w-34,ly,'900 18px Poppins, sans-serif','#1e3757',90);ctx.textAlign='left';
      });
      return;
    }
    const peak=Math.max(1,...items.slice(0,8).map(item=>safeNum(item.count)));
    items.slice(0,8).forEach((item,j)=>{
      const cy=y+115+j*32,value=safeNum(item.count),pct=ratio(value,peak),barW=w-200;
      if(type==='chips'){
        const chipWidth=Math.min(w-92,Math.max(190,ctx.measureText(String(item.label)).width+110));
        round(ctx,inner,cy-17,chipWidth,27,11,'#f1f5f9');
        round(ctx,inner+5,cy-12,4,17,2,p[j%p.length]);
        txt(ctx,item.label,inner+14,cy+2,'700 16px Poppins, sans-serif','#405873',chipWidth-85);
        ctx.textAlign='right';txt(ctx,format(value),inner+chipWidth-12,cy+2,'900 17px Poppins, sans-serif',p[0],55);ctx.textAlign='left';
      }else{
        txt(ctx,item.label,inner,cy,'700 17px Poppins, sans-serif','#3f5772',w-191);
        ctx.textAlign='right';txt(ctx,format(value),x+w-35,cy,'900 18px Poppins, sans-serif',p[0],90);ctx.textAlign='left';
        const by=cy+6;
        round(ctx,inner,by,barW,7,4,'#e9eef4');
        const fillWidth=Math.max(4,barW*pct/100);
        round(ctx,inner,by,fillWidth,type==='lollipop'?4:7,type==='lollipop'?2:4,p[j%p.length]);
        if(type==='lollipop')circle(ctx,inner+fillWidth,by+2,7,p[j%p.length]);
      }
    });
  }
  async function exportPng(data){
    if(!data||!safeNum(data.total))throw Error('Aucune carte OWN à exporter.');
    if(!root.document?.createElement)throw Error('Le navigateur ne permet pas cet export.');
    if(root.document.fonts?.ready)await root.document.fonts.ready;
    const canvas=root.document.createElement('canvas');
    const entries=Array.isArray(data.breakdowns)?data.breakdowns:[];
    const rows=Math.ceil(entries.length/2);
    const W=1600,H=Math.max(2460,653+rows*398+Math.max(0,rows-1)*24+123),margin=74,gap=26;
    canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw Error('Canvas 2D indisponible.');
    ctx.fillStyle='#eff4fa';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#112c50';ctx.fillRect(0,0,W,166);
    ctx.fillStyle='#2782d6';ctx.fillRect(0,0,W*.57,9);
    ctx.fillStyle='#eb6581';ctx.fillRect(W*.57,0,W*.23,9);
    ctx.fillStyle='#45bfba';ctx.fillRect(W*.8,0,W*.2,9);
    txt(ctx,'RAPLI',margin,82,'900 46px Poppins, sans-serif','#ffffff');
    txt(ctx,'SPORTS',268,82,'900 46px Poppins, sans-serif','#7ad4ff');
    txt(ctx,'STATISTIQUES DE COLLECTION · OWN UNIQUEMENT',margin,119,'700 17px Poppins, sans-serif','#c7dcec');
    ctx.textAlign='right';
    const date=new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});
    txt(ctx,date,W-margin,90,'700 19px Poppins, sans-serif','#d6e8f9');
    ctx.textAlign='left';
    const metrics=Array.isArray(data.kpis)?data.kpis:[];
    const cols=4,kpiGap=16,kpiW=(W-margin*2-kpiGap*(cols-1))/cols,kpiH=106;
    for(let i=0;i<12;i++){
      const entry=metrics[i]||{label:'—',value:0};
      const x=margin+(i%cols)*(kpiW+kpiGap),y=196+Math.floor(i/cols)*(kpiH+15),p=colors(i%palette.length);
      round(ctx,x,y,kpiW,kpiH,15,'#ffffff');
      round(ctx,x,y,7,kpiH,3,p[0]);
      txt(ctx,String(entry.label).toUpperCase(),x+22,y+31,'800 14px Poppins, sans-serif','#667a93',kpiW-38);
      txt(ctx,format(entry.value),x+22,y+80,'900 36px Poppins, sans-serif',p[0],kpiW-40);
    }
    txt(ctx,'RÉPARTITIONS',margin,632,'900 24px Poppins, sans-serif','#193c66');
    txt(ctx,'Répartitions de ta collection',margin+223,632,'600 17px Poppins, sans-serif','#8292a7');
    const panelW=(W-margin*2-gap)/2,panelH=398,top=653,rowGap=24;
    for(let i=0;i<entries.length;i++)
      drawStatsPanel(ctx,entries[i],i,margin+(i%2)*(panelW+gap),top+Math.floor(i/2)*(panelH+rowGap),panelW,panelH,data.total);
    const footY=top+rows*panelH+Math.max(0,rows-1)*rowGap+30;
    round(ctx,margin,footY,W-2*margin,63,13,'#dce9f7');
    txt(ctx,'DONNÉES : CARTES OWN RÉELLES · WISHLIST ET DÉMONSTRATIONS EXCLUES',margin+25,footY+39,
      '800 17px Poppins, sans-serif','#254768',W-2*margin-45);
    const blob=await new Promise((resolve,reject)=>{
      canvas.toBlob(value=>value?resolve(value):reject(Error('Encodage PNG impossible.')),'image/png');
    });
    const url=URL.createObjectURL(blob);
    const anchor=root.document.createElement('a');
    anchor.href=url;anchor.download='Rapli_Sports_Statistiques_OWN_'+new Date().toISOString().slice(0,10)+'.png';
    root.document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),12000);
    return anchor.download;
  }
  root.RapliSportsStatsVisuals={renderPanels,exportPng};
})(typeof window!=='undefined'?window:globalThis);
