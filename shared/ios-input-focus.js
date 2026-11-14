/* Safari iOS focus zoom prevention in the parent and all RapliLab iframes.
 * Don't change the viewport meta tag or interfere with intentional pinch zoom.
 */
(() => {
  'use strict';
  const isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent||'')||
    (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(!isIOS)return;
  const excluded=new Set(['checkbox','radio','range','color','file','hidden','button','submit','reset','image']);
  const previous=new WeakMap();
  function editable(target){
    if(!(target instanceof Element))return null;
    let element=target.closest('input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"]');
    if(!element)element=target.closest('label')?.control||null;
    if(!element||element.tagName==='INPUT'&&excluded.has((element.type||'text').toLowerCase()))return null;
    return element;
  }
  function pageZoomOut(){
    try{
      // Page zoom changes the layout width. Pinch zoom only changes the
      // visual viewport scale and should not trigger compensating changes.
      const top=window.top||window,device=top.screen?.width||window.screen?.width||0;
      const width=top.innerWidth||window.innerWidth||0;
      return width>0&&device>0?Math.max(1,Math.min(1.85,width/device)):1;
    }catch{return 1;}
  }
  function guard(target){
    const element=editable(target);
    if(!element)return;
    const targetPx=Math.max(20,Math.ceil(16*pageZoomOut()+1));
    if(parseFloat(getComputedStyle(element).fontSize)>=targetPx-0.1)return;
    if(!previous.has(element))previous.set(element,{
      value:element.style.getPropertyValue('font-size'),
      priority:element.style.getPropertyPriority('font-size')
    });
    element.style.setProperty('font-size',targetPx+'px','important');
  }
  function restore(target){
    const element=editable(target);
    if(!element||!previous.has(element))return;
    const old=previous.get(element);
    previous.delete(element);
    if(old.value)element.style.setProperty('font-size',old.value,old.priority);
    else element.style.removeProperty('font-size');
  }
  document.addEventListener('pointerdown',event=>guard(event.target),true);
  document.addEventListener('touchstart',event=>guard(event.target),{capture:true,passive:true});
  document.addEventListener('focusin',event=>guard(event.target),true);
  document.addEventListener('focusout',event=>restore(event.target),true);
  window.addEventListener('resize',()=>guard(document.activeElement),{passive:true});
})();
