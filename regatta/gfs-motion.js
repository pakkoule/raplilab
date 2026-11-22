/* Prototype 8 — météo GFS + polaires ITYC PARTIELLES, non Full Pack.
   Déplacement à cap fixe pendant 3 heures, sans optimisation de route. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RapliGfsMotion=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const TWS=[4,6,8,10,12,14,16,18,20,25,30,35,40], ANGLES=[90,100,110,120];
const POLAR={
  90:[7.29,10.93,14.35,17.76,22.04,27.17,30.97,32.97,34.96,38.19,40.09,31.07,22.04],
  100:[7.41,11.11,14.54,18.15,22.42,27.84,32.40,34.39,36.48,39.66,41.42,31.92,22.42],
  110:[7.41,11.11,14.54,18.15,22.23,27.93,32.68,34.77,36.86,39.90,41.33,31.78,22.23],
  120:[7.22,10.83,13.96,17.58,21.95,27.36,32.40,34.39,36.57,39.38,40.47,31.21,21.95]
};
const START=Object.freeze({latitude:48.125,longitude:-8.625}), HEADING=180;
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
   ![6,12].includes(frame.forecastHour)||!Number.isInteger(g.ni)||!Number.isInteger(g.nj)||
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
 if(a.cycle!==b.cycle||a.hour!==6||b.hour!==12||hour<6||hour>12)
   throw Error('Deux échéances consécutives NOAA du même cycle requises.');
 const p=sampleGrid(a,lat,lon),q=sampleGrid(b,lat,lon),t=(hour-6)/6;
 const u=p.u+(q.u-p.u)*t,v=p.v+(q.v-p.v)*t;
 return {u,v,knots:Math.hypot(u,v)*1.9438444924406,
   from:norm(Math.atan2(-u,-v)*180/Math.PI)};
}
function between(axis,value){
 if(!finite(value)||value<axis[0]||value>axis[axis.length-1])
   throw Error('Vent ou angle hors des polaires provisoires (90–120°, 4–40 nds).');
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
function simulateMotion(first,second){
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
   const twa=Math.abs(norm(wind.from-HEADING+180)-180);
   const speed=polarSpeed(wind.knots,twa);
   steps.push({hour,latitude:round(pos.latitude,5),longitude:round(pos.longitude,5),
     windKnots:round(wind.knots,1),windDirection:round(wind.from,0),
     twa:round(twa,1),boatKnots:round(speed,1),distanceNm:round(distance,1)});
   if(i<6){pos=move(pos,HEADING,speed,.5);distance+=speed*.5;}
 }
 return {cycleUTC:first.cycleUTC,heading:HEADING,steps,distanceNm:round(distance,1),
   provisionalPolar:true,optimized:false,
   note:'Cap fixe 180°, pas de courant ni de terre, polaires PARTIELLES non Full Pack.'};
}
return {TWS,ANGLES,POLAR,START,HEADING,decodeBase64Float32,loadFrame,gridIndex,
  sampleGrid,windAt,polarSpeed,move,simulateMotion};
});
