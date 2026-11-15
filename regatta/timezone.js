/* Rapli Regatta — instants stables entre iPhone, PC et export Apple Calendar.
 * Une date/heure de course est saisie dans le fuseau sélectionné.
 * Les anciennes fiches, sans champ timezone, sont interprétées en Europe/Paris.
 */
(function(root){
 'use strict';
 const DEFAULT='Europe/Paris';
 const ZONES=Object.freeze({
  'Europe/Paris':'Heure française · Paris',
  'UTC':'UTC · heure universelle',
  'America/Guadeloupe':'Guadeloupe · UTC−4',
  'America/New_York':'New York · heure locale',
  'America/Los_Angeles':'Los Angeles · heure locale',
  'Atlantic/Azores':'Açores · heure locale',
  'Africa/Cape_Town':'Le Cap · UTC+2',
  'Pacific/Auckland':'Auckland · heure locale'
 });
 const formatters=new Map();
 const pad=n=>String(n).padStart(2,'0');
 const normalize=zone=>Object.prototype.hasOwnProperty.call(ZONES,zone)?zone:DEFAULT;
 function readWall(date,time){
  const d=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date||''));
  const t=/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(String(time||''));
  if(!d||!t)return null;
  const year=Number(d[1]),month=Number(d[2]),day=Number(d[3]);
  const hour=Number(t[1]),minute=Number(t[2]),second=Number(t[3]||0);
  const ms=Date.UTC(year,month-1,day,hour,minute,second);
  const valid=new Date(ms);
  if(valid.getUTCFullYear()!==year||valid.getUTCMonth()!==month-1||valid.getUTCDate()!==day)return null;
  return {year,month,day,hour,minute,second,ms};
 }
 function partsAt(instant,zone){
  const tz=normalize(zone);
  if(!formatters.has(tz))formatters.set(tz,new Intl.DateTimeFormat('en-GB',{
   timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',
   hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  }));
  const object={};
  for(const part of formatters.get(tz).formatToParts(new Date(instant)))
   if(['year','month','day','hour','minute','second'].includes(part.type))object[part.type]=Number(part.value);
  return object;
 }
 function offsetAt(instant,zone){
  const p=partsAt(instant,zone);
  return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-instant;
 }
 function fromWall(date,time,zone=DEFAULT){
  const wall=readWall(date,time);
  if(!wall)return null;
  const tz=normalize(zone);
  if(tz==='UTC')return wall.ms;
  // Chercher les offsets de part et d'autre du changement d'heure.
  const offsets=new Set([-36,-12,0,12,36].map(hours=>offsetAt(wall.ms+hours*3600000,tz)));
  const possible=[];
  for(const offset of offsets){
   const instant=wall.ms-offset;
   const p=partsAt(instant,tz);
   if(p.year===wall.year&&p.month===wall.month&&p.day===wall.day&&
      p.hour===wall.hour&&p.minute===wall.minute&&p.second===wall.second)
    possible.push(instant);
  }
  // Heure répétée à l'automne : choisir la première occurrence, de façon déterministe.
  // Heure inexistante au printemps : aucun instant, demander une correction.
  return possible.length?Math.min(...possible):null;
 }
 function wallAt(instant,zone=DEFAULT){
  if(!Number.isFinite(instant))return null;
  const p=partsAt(instant,zone);
  return {date:p.year+'-'+pad(p.month)+'-'+pad(p.day),
   time:pad(p.hour)+':'+pad(p.minute)+':'+pad(p.second)};
 }
 function arrival(date,time,seconds,zone=DEFAULT){
  const start=fromWall(date,time,zone);
  if(start===null||!Number.isSafeInteger(seconds)||seconds<0)return null;
  const end=start+seconds*1000;
  if(!Number.isFinite(end)||new Date(end).getUTCFullYear()>9999)return null;
  return {...wallAt(end,zone),timestamp:end};
 }
 function utcIcs(instant){
  if(!Number.isFinite(instant))return '';
  return new Date(instant).toISOString().slice(0,19).replace(/[-:]/g,'')+'Z';
 }
 root.RapliRegattaTime=Object.freeze({DEFAULT,ZONES,normalize,fromWall,wallAt,arrival,utcIcs});
})(window);
