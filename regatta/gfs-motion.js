/* Prototype 8 — météo GFS + polaires ITYC PARTIELLES, non Full Pack.
   Déplacement à cap fixe pendant 3 heures, sans optimisation de route. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RapliGfsMotion=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
// ITYC screenshots supplied by the user, 30°–120°, TWS 4–40 knots.
 // IMPORTANT: provisional non-Full-Pack values, not VR equipment-adjusted polars.
const TWS=[4,6,8,10,12,14,16,18,20,25,30,35,40];
const ANGLES=[30,35,40,45,50,55,60,65,70,75,80,85,90,95,100,105,110,115,120];
const POLAR={
  30:[1.27,1.90,3.80,4.27,5.70,5.70,7.13,7.60,7.60,9.50,9.50,8.07,6.65],
  35:[1.90,2.85,4.99,5.63,7.41,8.07,9.51,10.45,9.97,11.88,11.88,10.07,8.27],
  40:[2.53,3.80,6.18,6.98,9.12,10.45,11.88,13.30,12.35,14.25,14.25,12.07,9.88],
  45:[3.49,5.23,7.60,8.84,11.88,13.30,15.20,17.10,16.15,17.10,17.10,14.63,12.16],
  50:[4.37,6.56,9.50,11.50,14.35,16.53,18.72,19.95,20.24,20.62,20.62,17.48,14.35],
  55:[5.11,7.67,10.89,13.14,16.08,18.46,20.71,22.27,22.71,23.20,23.37,19.73,16.08],
  60:[5.93,8.90,12.23,14.44,17.51,19.92,22.33,24.16,25.05,25.84,26.19,21.85,17.51],
  65:[6.46,9.69,13.01,15.30,18.62,21.19,23.65,25.75,27.26,28.28,28.98,23.80,18.62],
  70:[6.77,10.16,13.49,15.96,19.57,22.42,25.08,27.36,29.26,31.02,31.73,25.65,19.57],
  75:[6.93,10.40,13.73,16.48,20.23,23.80,26.60,28.79,30.88,33.13,34.30,27.77,20.23],
  80:[7.09,10.64,13.96,17.01,20.90,25.17,28.12,30.21,32.49,35.24,36.86,28.88,20.90],
  85:[7.19,10.79,14.16,17.39,21.47,26.17,29.55,31.59,33.73,36.71,38.48,29.97,21.47],
  90:[7.29,10.93,14.35,17.76,22.04,27.17,30.97,32.97,34.96,38.19,40.09,31.07,22.04],
  95:[7.31,10.97,14.43,17.95,22.23,27.51,31.68,33.68,35.72,38.93,40.76,31.49,22.23],
  100:[7.41,11.11,14.54,18.15,22.42,27.84,32.40,34.39,36.48,39.66,41.42,31.92,22.42],
  105:[7.41,11.11,14.54,18.11,22.30,27.88,32.54,34.58,36.67,39.78,41.38,31.85,22.33],
  110:[7.41,11.11,14.54,18.15,22.23,27.93,32.68,34.77,36.86,39.90,41.33,31.78,22.23],
  115:[7.31,10.97,14.25,17.86,22.09,27.63,32.46,34.58,36.72,39.64,40.90,31.50,22.09],
  120:[7.22,10.83,13.96,17.58,21.95,27.36,32.40,34.39,36.57,39.38,40.47,31.21,21.95]
};
const START=Object.freeze({latitude:48.125,longitude:-8.625}), HEADING=180;
// Fixed comparison: no adaptive autopilot, only five predefined headings.
const CANDIDATE_HEADINGS=Object.freeze([170,175,180,185,190]);
const finite=Number.isFinite, norm=n=>((n%360)+360)%360;
const round=(n,p=2)=>Math.round(n*10**p)/10**p;
function decodeBase64Float32(base64,count){
 if(typeof base64!=='string')throw Error('Vecteurs météo manquants.');
 const bin=typeof atob==='function'?atob(base64):
   (typeof Buffer!=='undefined'?Buffer.from(base64,'base64').toString('binary'):'');
 if(bin.length!==count*4)throw Error('Grille GFS incohérente.');
 const buffer=new ArrayBuffer(bin.length),u8=new Uint8Array(buffer);
 for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
 const view=new DataView(buffer),result=new Float32Array(count);
 for(let i=0;i<count;i++)result[i]=view.getFloat32(i*4,true);
 return result;
}
function loadFrame(frame){
 const g=frame?.motionGrid;
 if(frame?.ok!==true||!g||g.verifiedGrid!==true||g.format!=='float32le-base64'||
   ![6,12,18,24,30].includes(frame.forecastHour)||!Number.isInteger(g.ni)||!Number.isInteger(g.nj)||
   g.ni<2||g.nj<2||g.numberOfDataPoints!==g.ni*g.nj||
   g.numberOfDataPoints>25000||
   ![g.latitudeOfFirstGridPoint,g.longitudeOfFirstGridPoint,g.iDirectionIncrement,g.jDirectionIncrement].every(finite)||
   Math.abs(g.iDirectionIncrement-.25)>1e-6||
   Math.abs(g.jDirectionIncrement-.25)>1e-6)
   throw Error('Grille NOAA validée indisponible.');
 const cycle=Date.parse(frame.cycleUTC);
 if(!finite(cycle)||new Date(cycle).toISOString()!==frame.cycleUTC||
   Date.parse(frame.validUTC)!==cycle+frame.forecastHour*3600000)
   throw Error('Échéances GFS incohérentes.');
 return {g,cycle,hour:frame.forecastHour,
   u:decodeBase64Float32(g.uBase64,g.numberOfDataPoints),
   v:decodeBase64Float32(g.vBase64,g.numberOfDataPoints)};
}
function gridIndex(g,c,r){
 return g.jPointsAreConsecutive?
   c*g.nj+(g.alternativeRowScanning&&c%2?g.nj-1-r:r):
   r*g.ni+(g.alternativeRowScanning&&r%2?g.ni-1-c:c);
}
function sampleGrid(frame,lat,lon){
 const g=frame.g;
 if(!finite(lat)||!finite(lon)||Math.abs(lat)>90||lon< -180||lon>180)
   throw Error('Position bateau invalide.');
 const x=norm((lon-g.longitudeOfFirstGridPoint)*(g.iScansNegatively?-1:1))/g.iDirectionIncrement;
 const y=(lat-g.latitudeOfFirstGridPoint)/((g.jScansPositively?1:-1)*g.jDirectionIncrement);
 if(x< -1e-8||y< -1e-8||x>g.ni-1+1e-8||y>g.nj-1+1e-8)
   throw Error('Le bateau sort de la zone météo disponible.');
 const xx=Math.max(0,Math.min(g.ni-1,x)),yy=Math.max(0,Math.min(g.nj-1,y));
 const c0=Math.floor(xx),r0=Math.floor(yy),c1=Math.min(g.ni-1,c0+1),r1=Math.min(g.nj-1,r0+1);
 const fx=xx-c0,fy=yy-r0;
 let u=0,v=0;
 for(const [c,r,w] of [[c0,r0,(1-fx)*(1-fy)],[c1,r0,fx*(1-fy)],[c0,r1,(1-fx)*fy],[c1,r1,fx*fy]]){
   if(w===0)continue;
   const i=gridIndex(g,c,r),a=frame.u[i],b=frame.v[i];
   if(!finite(a)||!finite(b)||Math.abs(a)>100||Math.abs(b)>100)
     throw Error('Composante de vent manquante sur la grille.');
   u+=w*a;v+=w*b;
 }
 return {u,v};
}
function windAt(a,b,hour,lat,lon){
 if(a.cycle!==b.cycle||!([6,12,18,24].includes(a.hour)&&b.hour===a.hour+6)||
   hour<a.hour||hour>b.hour)
   throw Error('Deux échéances consécutives NOAA du même cycle requises.');
 const p=sampleGrid(a,lat,lon),q=sampleGrid(b,lat,lon),t=(hour-a.hour)/6;
 const u=p.u+(q.u-p.u)*t,v=p.v+(q.v-p.v)*t;
 return {u,v,knots:Math.hypot(u,v)*1.9438444924406,
   from:norm(Math.atan2(-u,-v)*180/Math.PI)};
}
function between(axis,value){
 if(!finite(value)||value<axis[0]||value>axis[axis.length-1])
   throw Error('Vent ou angle hors des polaires provisoires (30–120°, 4–40 nds).');
 const hi=axis.findIndex(v=>v>=value);
 if(hi===0)return [0,0,0];
 if(axis[hi]===value)return [hi,hi,0];
 const lo=hi-1;return [lo,hi,(value-axis[lo])/(axis[hi]-axis[lo])];
}
function polarSpeed(tws,twa){
 const [a,b,t]=between(TWS,tws),[c,d,v]=between(ANGLES,twa);
 const row=k=>POLAR[ANGLES[k]][a]+(POLAR[ANGLES[k]][b]-POLAR[ANGLES[k]][a])*t;
 return row(c)+(row(d)-row(c))*v;
}
function move(pos,heading,speed,hours){
 const radians=heading*Math.PI/180,deltaLat=speed*hours*Math.cos(radians)/60;
 const meanLat=(pos.latitude+deltaLat/2)*Math.PI/180;
 if(Math.abs(Math.cos(meanLat))<.01)throw Error('Latitude non prise en charge.');
 return {
   latitude:pos.latitude+deltaLat,
   longitude:pos.longitude+speed*hours*Math.sin(radians)/(60*Math.cos(meanLat))
 };
}
function simulateMotion(first,second,heading=HEADING){
 if(!CANDIDATE_HEADINGS.includes(heading))throw Error('Cap du test hors de la sélection autorisée.');
 const a=loadFrame(first),b=loadFrame(second);
 const keys=['ni','nj','latitudeOfFirstGridPoint','longitudeOfFirstGridPoint',
   'iDirectionIncrement','jDirectionIncrement','iScansNegatively','jScansPositively',
   'jPointsAreConsecutive','alternativeRowScanning'];
 if(keys.some(k=>a.g[k]!==b.g[k])||a.cycle!==b.cycle)
   throw Error('Grilles NOAA ou cycles non compatibles.');
 let pos={...START},distance=0;
 const steps=[];
 for(let i=0;i<=6;i++){
   const hour=6+i*.5;
   const wind=windAt(a,b,hour,pos.latitude,pos.longitude);
   const twa=Math.abs(norm(wind.from-heading+180)-180);
   const speed=polarSpeed(wind.knots,twa);
   steps.push({hour,latitude:round(pos.latitude,5),longitude:round(pos.longitude,5),
     windKnots:round(wind.knots,1),windDirection:round(wind.from,0),
     twa:round(twa,1),boatKnots:round(speed,1),distanceNm:round(distance,1)});
   if(i<6){pos=move(pos,heading,speed,.5);distance+=speed*.5;}
 }
 return {cycleUTC:first.cycleUTC,heading,steps,distanceNm:round(distance,1),
   provisionalPolar:true,optimized:false,
   note:'Cap fixe '+heading+'°, pas de courant ni de terre, polaires PARTIELLES non Full Pack.'};
}
function compareFixedHeadings(first,second){
 const evaluated=CANDIDATE_HEADINGS.map(heading=>{
   try{
     const run=simulateMotion(first,second,heading);
     const finish=run.steps[run.steps.length-1];
     if(!finish||!finite(finish.latitude)||!finite(finish.longitude))
       throw Error('Position finale invalide.');
     return {
       heading,valid:true,
       distanceNm:run.distanceNm,
       southProgressNm:round((START.latitude-finish.latitude)*60,1),
       finalLatitude:finish.latitude,
       finalLongitude:finish.longitude
     };
   }catch(error){
     return {heading,valid:false,reason:String(error?.message||error).slice(0,140)};
   }
 });
 const valid=evaluated.filter(item=>item.valid===true)
   .sort((a,b)=>b.southProgressNm-a.southProgressNm||a.heading-b.heading);
 if(!valid.length)throw Error('Aucun cap comparable avec les polaires provisoires.');
 return {
   evaluated, best:valid[0], validCount:valid.length,
   comparisonOnly:true, optimized:false, provisionalPolar:true,
   objective:'Progression vers le sud en 3 h parmi cinq caps fixes',
   note:'Comparaison limitée, aucune route optimisée, polaires non Full Pack.'
 };
}

/**
 * Test 10 — pilote GREEDY VMG sud : recalcule le cap chaque demi-heure.
 * Il ne s'agit NI d'une optimisation globale ni d'un routage record.
 * Un cap hors polaires n'est jamais extrapolé ; aucune trajectoire n'est
 * publiée si le segment manque de météo valide.
 */
function selectSouthHeading(wind){
  if(!wind||!finite(wind.knots)||!finite(wind.from))
    throw Error('Vecteur météo indisponible.');
  const candidates=CANDIDATE_HEADINGS.map(heading=>{
    const twa=Math.abs(norm(wind.from-heading+180)-180);
    try{
      const speed=polarSpeed(wind.knots,twa);
      const southVmg=speed*Math.cos((heading-180)*Math.PI/180);
      if(!finite(speed)||!finite(southVmg)||speed<=0)
        throw Error('Vitesse bateau incohérente.');
      return {heading,valid:true,twa,boatKnots:speed,southVmg};
    }catch(error){
      return {heading,valid:false,reason:String(error?.message||error).slice(0,120)};
    }
  });
  const valid=candidates.filter(x=>x.valid).sort((a,b)=>
    b.southVmg-a.southVmg||
    Math.abs(a.heading-180)-Math.abs(b.heading-180)||
    a.heading-b.heading
  );
  if(!valid.length)throw Error('Aucun cap autorisé par les polaires provisoires.');
  return {selected:valid[0],validCount:valid.length,candidates};
}

function simulateAdaptiveHeading(first,second){
  const a=loadFrame(first),b=loadFrame(second);
  const keys=['ni','nj','latitudeOfFirstGridPoint','longitudeOfFirstGridPoint',
    'iDirectionIncrement','jDirectionIncrement','iScansNegatively',
    'jScansPositively','jPointsAreConsecutive','alternativeRowScanning'];
  if(keys.some(key=>a.g[key]!==b.g[key])||a.cycle!==b.cycle)
    throw Error('Grilles NOAA ou cycles non compatibles.');
  let pos={...START},distanceNm=0,previousHeading=null,changes=0;
  const steps=[];
  for(let i=0;i<6;i++){
    const hour=6+i*.5;
    const wind=windAt(a,b,hour,pos.latitude,pos.longitude);
    const choice=selectSouthHeading(wind);
    const selected=choice.selected;
    if(previousHeading!==null&&previousHeading!==selected.heading)changes++;
    previousHeading=selected.heading;
    const next=move(pos,selected.heading,selected.boatKnots,.5);
    // Refuser le segment final s'il sort du domaine, même si le point de départ était valide.
    windAt(a,b,hour+.5,next.latitude,next.longitude);
    steps.push({
      hour,heading:selected.heading,
      latitude:round(pos.latitude,5),longitude:round(pos.longitude,5),
      windKnots:round(wind.knots,1),windDirection:round(wind.from,0),
      twa:round(selected.twa,1),
      boatKnots:round(selected.boatKnots,1),
      southVmg:round(selected.southVmg,1),
      validCount:choice.validCount
    });
    distanceNm+=selected.boatKnots*.5;
    pos=next;
  }
  const southProgressNm=(START.latitude-pos.latitude)*60;
  const comparison=compareFixedHeadings(first,second);
  return {
    cycleUTC:first.cycleUTC,
    startHour:6,endHour:9,stepHours:.5,
    steps,headingChanges:changes,
    distanceNm:round(distanceNm,1),
    southProgressNm:round(southProgressNm,1),
    finalLatitude:round(pos.latitude,5),
    finalLongitude:round(pos.longitude,5),
    bestFixedHeading:comparison.best.heading,
    bestFixedSouthNm:comparison.best.southProgressNm,
    deltaSouthNm:round(southProgressNm-comparison.best.southProgressNm,1),
    provisionalPolar:true,greedy:true,optimized:false,
    method:'VMG sud instantanée maximale parmi 5 caps à chaque pas de 30 min',
    note:'Pas de routage global, pas de prise en compte des terres, des courants ni du Full Pack.'
  };
}
return {TWS,ANGLES,POLAR,START,HEADING,CANDIDATE_HEADINGS,decodeBase64Float32,loadFrame,gridIndex,
  sampleGrid,windAt,polarSpeed,move,simulateMotion,compareFixedHeadings,
  selectSouthHeading,simulateAdaptiveHeading};
});
