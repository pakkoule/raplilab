/* LAB GFS TEST 11: recherche exhaustive sur un petit ensemble de caps.
 * Cinq caps x six intervalles de 30 minutes: 15 625 séquences maximum.
 * Ni routage océanique, ni polaires Full Pack, ni géographie des terres.
 */
(function(root,factory){
  'use strict';
  const motion=typeof module==='object'&&module.exports
    ?require('./gfs-motion.js'):root?.RapliGfsMotion;
  const api=factory(motion);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RapliGfsRouteSearch=api;
})(typeof window!=='undefined'?window:null,function(motion){
  'use strict';
  const CAP_COUNT=5;
  const STEP_COUNT=6;
  const STEP_HOURS=.5;
  const EPS=1e-8;
  const MAX_EXPANDED=20000;
  const round=(n,p=1)=>Math.round(n*10**p)/10**p;
  const angle=(a,b)=>Math.abs(((a-b+540)%360)-180);
  const finite=n=>typeof n==='number'&&Number.isFinite(n);

  function chooseBetter(a,b){
    if(!a)return b;
    if(!b)return a;
    if(b.southRaw>a.southRaw+EPS)return b;
    if(a.southRaw>b.southRaw+EPS)return a;
    if(b.changes<a.changes)return b;
    if(a.changes<b.changes)return a;
    // Stable tie-break: favor headings near south, then ascending angles.
    const deviation=route=>route.headings.reduce((total,h)=>total+Math.abs(h-180),0);
    if(deviation(b)<deviation(a))return b;
    if(deviation(a)<deviation(b))return a;
    return b.headings.join(',')<a.headings.join(',')?b:a;
  }

  function searchHeadingSequences(first,second){
    if(!motion?.loadFrame||!motion?.windAt||!motion?.move||!motion?.polarSpeed)
      throw Error('Moteur de navigation GFS manquant.');
    const a=motion.loadFrame(first),b=motion.loadFrame(second);
    const gridFields=['ni','nj','latitudeOfFirstGridPoint','longitudeOfFirstGridPoint',
      'iDirectionIncrement','jDirectionIncrement','iScansNegatively',
      'jScansPositively','jPointsAreConsecutive','alternativeRowScanning'];
    if(a.cycle!==b.cycle||a.hour!==6||b.hour!==12||
      gridFields.some(k=>a.g[k]!==b.g[k]))
      throw Error('Deux grilles GFS +6/+12 h compatibles du même cycle sont nécessaires.');
    if(motion.CANDIDATE_HEADINGS.length!==CAP_COUNT)
      throw Error('Cinq caps autorisés attendus.');
    let expanded=0,rejected=0,completed=0;
    let best=null;
    let nodes=[{
      position:{...motion.START},
      distanceNm:0,headings:[],steps:[],changes:0,previous:null
    }];
    for(let depth=0;depth<STEP_COUNT;depth++){
      const hour=6+depth*STEP_HOURS;
      const nextNodes=[];
      for(const node of nodes){
        let wind;
        try{
          wind=motion.windAt(a,b,hour,node.position.latitude,node.position.longitude);
        }catch(_){rejected+=CAP_COUNT;continue;}
        if(!finite(wind.knots)||!finite(wind.from)){
          rejected+=CAP_COUNT;continue;
        }
        for(const heading of motion.CANDIDATE_HEADINGS){
          expanded++;
          if(expanded>MAX_EXPANDED)
            throw Error('Limite de calcul du test 11 dépassée.');
          try{
            const twa=angle(wind.from,heading);
            const boatKnots=motion.polarSpeed(wind.knots,twa);
            if(!finite(boatKnots)||boatKnots<=0||boatKnots>100)
              throw Error('Vitesse bateau invalide.');
            const position=motion.move(node.position,heading,boatKnots,STEP_HOURS);
            // Check the entire step stays in the downloaded domain, including final endpoint.
            motion.windAt(a,b,hour+STEP_HOURS,position.latitude,position.longitude);
            const changes=node.changes+(node.previous!==null&&heading!==node.previous?1:0);
            const candidate={
              position,
              distanceNm:node.distanceNm+boatKnots*STEP_HOURS,
              headings:[...node.headings,heading],
              previous:heading,changes,
              steps:[...node.steps,{
                hour,heading,
                latitude:round(node.position.latitude,5),
                longitude:round(node.position.longitude,5),
                windKnots:round(wind.knots),
                windDirection:Math.round(wind.from),
                twa:round(twa),
                boatKnots:round(boatKnots)
              }]
            };
            if(depth===STEP_COUNT-1){
              completed++;
              const endpoint={
                ...candidate,
                southRaw:(motion.START.latitude-position.latitude)*60
              };
              best=chooseBetter(best,endpoint);
            }else{
              nextNodes.push(candidate);
            }
          }catch(_){rejected++;}
        }
      }
      if(depth<STEP_COUNT-1){
        if(!nextNodes.length)throw Error('Aucune route entièrement calculable avec ces polaires.');
        nodes=nextNodes;
      }
    }
    if(!best||completed===0)
      throw Error('Aucune séquence de six caps entièrement valide.');
    const greedy=motion.simulateAdaptiveHeading(first,second);
    const fixed=motion.compareFixedHeadings(first,second);
    const bestSouth=round(best.southRaw);
    return {
      cycleUTC:first.cycleUTC,
      headings:best.headings,
      steps:best.steps,
      finalLatitude:round(best.position.latitude,5),
      finalLongitude:round(best.position.longitude,5),
      distanceNm:round(best.distanceNm),
      southProgressNm:bestSouth,
      changes:best.changes,
      greedySouthNm:greedy.southProgressNm,
      fixedSouthNm:fixed.best.southProgressNm,
      gainVsGreedyNm:round(best.southRaw-greedy.southProgressNm),
      gainVsFixedNm:round(best.southRaw-fixed.best.southProgressNm),
      expanded,completed,rejected,
      method:'Recherche exhaustive sur 5 caps et 6 pas météo (maximum 15 625 séquences finales)',
      exhaustiveWithinDiscreteSet:true,
      isOceanRouting:false,fullPack:false,
      experimental:true
    };
  }
  return {CAP_COUNT,STEP_COUNT,MAX_EXPANDED,searchHeadingSequences};
});
