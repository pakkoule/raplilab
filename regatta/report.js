/* Rapli Regatta — global collection PDF. Pin jsPDF at a reviewed fixed version. */
const PDF_LIB_URL='https://cdn.jsdelivr.net/npm/jspdf@4.2.1/+esm';
const text=value=>String(value??'').replace(/[\u{1f000}-\u{1ffff}\u2600-\u27ff]/gu,'').replace(/[\u202f\u00a0]/g,' ').replace(/[\u2010-\u2015]/g,'-').trim();
const number=v=>Number(v||0).toLocaleString('fr-FR');
const color=s=>/^#[\da-f]{6}$/i.test(s||'')?s:'#e8f2fa';
const dateFR=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'—';
const fmtRank=(rank,total)=>rank?number(rank)+(total?' / '+number(total):''):'—';
const vsrNames={hc:'HORS CATEGORIE',vsr1:'VSR 1',vsr2:'VSR 2',vsr3:'VSR 3'};
const vsrOrder=['hc','vsr1','vsr2','vsr3'];
const typePairs=[['GENERAL','rank','rankTotal'],['NATIONAL','rankNational','rankNationalTotal'],['DEPARTEMENT','rankDepartment','rankDepartmentTotal'],['VILLE','rankCity','rankCityTotal'],['TEAM','rankTeam','rankTeamTotal']];
const asNumber=v=>/^\d{1,12}$/.test(String(v??'').trim())?Number(v):0;
function safeLine(doc,source,width){
 let v=text(source);if(!v)return '—';
 if(doc.getTextWidth(v)<=width)return v;
 while(v.length>2&&doc.getTextWidth(v+'...')>width)v=v.slice(0,-1);
 return v+'...';
}
const sameYear=r=>/^\d{4}/.test(r.start||'')?r.start.slice(0,4):'';
export function selectReportRaces(races,filters={}){
 const filtered=races.filter(r=>
  (!filters.year||sameYear(r)===filters.year)&&
  (!filters.vsr||r.vsr===filters.vsr)&&
  (!filters.boatClass||r.boatClass===filters.boatClass)&&
  (!filters.boat||r.boat===filters.boat)&&
  (!filters.status||r.reportStatus===filters.status)
 );
 const order=['hc','vsr1','vsr2','vsr3'];
 const priority=r=>{const i=order.indexOf(r.vsr);return i<0?4:i};
 return filtered.sort((a,b)=>filters.order==='date'?
  (b.start||'').localeCompare(a.start||'')||(b.createdAt||'').localeCompare(a.createdAt||''):
  priority(a)-priority(b)||(b.start||'').localeCompare(a.start||''));
}
export function reportTotals(items){
 const done=items.filter(r=>r.reportStatus==='finished'),ranked=(r,k,t)=>{
  const n=asNumber(r[k]),total=asNumber(r[t]);return n>0&&(!total||n<=total)?n:null;
 };
 let seconds=0,withDuration=0,points=0,credits=0;
 const medalCounts=typePairs.map(([name,key,totalKey])=>{
  const ranks=done.map(r=>ranked(r,key,totalKey)).filter(x=>x!==null);
  return {name,first:ranks.filter(x=>x===1).length,second:ranks.filter(x=>x===2).length,third:ranks.filter(x=>x===3).length,podiums:ranks.filter(x=>x<=3).length,ranked:ranks.length};
 });
 for(const r of done){
  const sec=Number(r.durationSecondsTotal);
  if(Number.isFinite(sec)&&sec>0){seconds+=sec;withDuration++;}
  points+=asNumber(r.gainPoints);credits+=asNumber(r.gainCredits);
 }
 const cats=vsrOrder.map(key=>({key,name:vsrNames[key],count:items.filter(r=>r.vsr===key).length}));
 const unknown=items.filter(r=>!vsrNames[r.vsr]).length;
 if(unknown)cats.push({key:'',name:'NON RENSEIGNEE',count:unknown});
 return {count:items.length,finished:done.length,live:items.filter(r=>r.reportStatus==='live').length,
  upcoming:items.filter(r=>r.reportStatus==='planned').length,medalCounts,seconds,withDuration,points,credits,cats};
}
function timeText(seconds){
 if(!Number.isFinite(seconds)||seconds<=0)return '—';
 const d=Math.floor(seconds/86400),h=Math.floor(seconds%86400/3600),m=Math.floor(seconds%3600/60),s=seconds%60;
 return (d?d+'j ':'')+String(h).padStart(2,'0')+'h '+String(m).padStart(2,'0')+'m '+String(s).padStart(2,'0')+'s';
}
function note(doc,value,x,y,size=10,c='#234657',weight='normal',maxWidth=0){
 doc.setFont('helvetica',weight);doc.setFontSize(size);doc.setTextColor(c);
 doc.text(maxWidth?safeLine(doc,value,maxWidth):text(value),x,y);
}
export async function generateGeneralPDF({races,filters={},settings={},outputName}){
 const {jsPDF}=await import(PDF_LIB_URL);
 if(!jsPDF)throw Error('Bibliotheque PDF indisponible.');
 const selection=selectReportRaces(races,filters);
 if(!selection.length)throw Error('Aucune course ne correspond aux filtres selectionnes.');
 const summary=reportTotals(selection);
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 const pageW=297,pageH=210,margin=11,navy='#15384a',teal='#008ca1';
 const line=(x,y,w,c='#dce7ec')=>{doc.setDrawColor(c);doc.setLineWidth(.26);doc.line(x,y,x+w,y);};
 const rect=(x,y,w,h,fill='#f1f7f8')=>{doc.setFillColor(fill);doc.roundedRect(x,y,w,h,2,2,'F');};
 const header=(subtitle)=>{
  doc.setFillColor(navy);doc.rect(0,0,pageW,20,'F');
  doc.setFillColor('#08bac1');doc.rect(0,0,218,1.4,'F');
  doc.setFillColor('#e50083');doc.rect(218,0,79,1.4,'F');
  note(doc,'RAPLI REGATTA',margin,12.2,19,'#ffffff','bold');
  note(doc,subtitle,159,12,9,'#c9e3e8','normal',125);
 };
 const footer=(n,total)=>{
  line(margin,195,pageW-margin*2);
  note(doc,'Rapli Regatta · Collection personnelle · '+new Date().toLocaleDateString('fr-FR'),margin,202,8,'#69848d');
  note(doc,'Page '+n+' / '+total,260,202,8,'#69848d','bold');
 };
 const filterTokens=[
  filters.year?'ANNEE '+filters.year:'TOUTES ANNEES',
  filters.vsr?(vsrNames[filters.vsr]||'VSR'):'TOUTES VSR',
  filters.boatClass?'CLASSE '+filters.boatClass:'TOUTES CLASSES',
  filters.boat?'BATEAU '+filters.boat:'TOUS BATEAUX',
  filters.status?filters.status.toUpperCase():'TOUS STATUTS'
 ];
 header('BILAN GENERAL · '+selection.length+' COURSES');
 note(doc,'RAPPORT DE COLLECTION',margin,31,19,navy,'bold');
 note(doc,'SELECTION : '+filterTokens.map(text).join('  /  '),margin,38,8,'#6e8392','normal',269);
 const metrics=[
  ['COURSES',number(summary.count)],['TERMINEES',number(summary.finished)],
  ['EN COURS',number(summary.live)],['A VENIR',number(summary.upcoming)],
  ['PODIUMS GENERAL',number(summary.medalCounts[0].podiums)],['TEMPS TOTAL',timeText(summary.seconds)],
  ['POINTS VSR',number(summary.points)],['CREDITS VR',number(summary.credits)]
 ];
 for(let i=0;i<metrics.length;i++){
  const [label,value]=metrics[i],x=margin+(i%4)*69,y=44+Math.floor(i/4)*29;
  rect(x,y,65,25,i===6||i===7?'#f5f7e8':'#eaf5f7');
  note(doc,label,x+4,y+7,8,'#617a8a','bold',56);
  note(doc,value,x+4,y+19.8,16,i>=6?'#8e6818':teal,'bold',58);
 }
 note(doc,'PODIUMS PAR CLASSEMENT',margin,112,11,navy,'bold');
 const widths=[51,56,56,51,51],xs=[11,64,122,180,234],mc=summary.medalCounts;
 for(let i=0;i<mc.length;i++){
  const x=xs[i],w=widths[i],t=mc[i];
  rect(x,117,w,31,i===0?'#deedf1':'#f0f6f7');
  note(doc,t.name,x+3,125,7.6,'#34586c','bold',w-6);
  note(doc,String(t.podiums)+' podiums',x+3,134,11,teal,'bold',w-6);
  note(doc,'1er '+t.first+'  /  2e '+t.second+'  /  3e '+t.third,x+3,143,8,'#597887','normal',w-6);
 }
 note(doc,'CATEGORIES VSR · PRIORITE : HC > VSR 1 > VSR 2 > VSR 3',margin,158,10,navy,'bold');
 const barMax=Math.max(1,...summary.cats.map(x=>x.count));
 summary.cats.forEach((cat,i)=>{
  const col=i%2,row=Math.floor(i/2),x=margin+col*142,y=165+row*12;
  const c=cat.key?settings.vsrColors?.[cat.key]||'#11a7b1':'#dce7ea';
  note(doc,cat.name,x,y,8,'#395d6b','bold',38);
  rect(x+42,y-5,74,5,'#edf3f5');
  const size=barMax?cat.count/barMax*74:0;
  if(size){doc.setFillColor(color(c));doc.rect(x+42,y-5,size,5,'F');}
  note(doc,number(cat.count),x+119,y,8,navy,'bold');
 });
 const colWidths=[21,56,24,23,19,19,19,15,15,28,17,17];
 const headers=['DATE','COURSE / BATEAU','VSR','CLASSE','GENERAL','NATIONAL','DEPT.','VILLE','TEAM','DUREE','PTS VSR','CR VR'];
 const startX=margin,tableMax=276,tableY=34,rowH=11,rowsPerPage=14;
 const startPages=Math.ceil(selection.length/rowsPerPage);
 for(let page=0;page<startPages;page++){
  doc.addPage();header('DETAIL DES COURSES · '+(page+1)+' / '+startPages);
  note(doc,'CATALOGUE DETAILLE',margin,29,13,navy,'bold');
  const y=tableY;
  doc.setFillColor('#d9edf0');doc.rect(startX,y,tableMax,10,'F');
  let x=startX;
  headers.forEach((title,i)=>{note(doc,title,x+1.5,y+6.5,6.9,navy,'bold',colWidths[i]-3);x+=colWidths[i]});
  const slice=selection.slice(page*rowsPerPage,(page+1)*rowsPerPage);
  slice.forEach((r,i)=>{
   const top=y+10+i*rowH,xs=[],isAlt=i%2!==0;
   if(isAlt){doc.setFillColor('#f2f7f9');doc.rect(startX,top,tableMax,rowH,'F');}
   let xx=startX;for(const w of colWidths){xs.push(xx);xx+=w;}
   if(r.vsr){
    doc.setFillColor(color(settings.vsrColors?.[r.vsr]||'#deedf2'));
    doc.rect(xs[2]+1,top+1.5,colWidths[2]-2,rowH-3,'F');
   }
   const vals=[
    dateFR(r.start),
    (r.name||'—')+(r.boat?' / '+r.boat:''),
    vsrNames[r.vsr]||'—',
    r.boatClass||'—',fmtRank(r.rank,r.rankTotal),
    fmtRank(r.rankNational,r.rankNationalTotal),fmtRank(r.rankDepartment,r.rankDepartmentTotal),
    fmtRank(r.rankCity,r.rankCityTotal),fmtRank(r.rankTeam,r.rankTeamTotal),
    r.duration||'—',r.reportStatus==='finished'&&r.gainPoints?number(r.gainPoints):'—',
    r.reportStatus==='finished'&&r.gainCredits?number(r.gainCredits):'—'
   ];
   vals.forEach((value,j)=>{
    doc.setFont('helvetica',j===1?'bold':'normal');doc.setFontSize(j===1?7.3:7.1);
    doc.setTextColor(j===2?'#1a4256':'#365566');
    const width=colWidths[j]-3.1,fit=safeLine(doc,value,width);
    doc.text(fit,xs[j]+1.5,top+7);
   });
  });
  line(startX,y+10+slice.length*rowH,tableMax);
  note(doc,'Les gains et statistiques de podium concernent uniquement les courses terminees.',margin,192,7.6,'#67818d');
 }
 const pageCount=doc.getNumberOfPages();
 for(let n=1;n<=pageCount;n++){doc.setPage(n);footer(n,pageCount);}
 const filename=(outputName||'Rapli_Regatta_Rapport')+'_'+new Date().toISOString().slice(0,10)+'.pdf';
 doc.save(filename);
 return {count:selection.length,pages:pageCount,totals:summary};
}
