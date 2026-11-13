/* Visionneuse photo partagée. Aucun accès au stockage ni modification des images. */
(() => {
  'use strict';
  const selector = '.tile-picture img, .reference-image img, .quick-photo img, .card-photo img, .image-preview img';
  const MIN = 1, MAX = 6;
  let root, stage, picture, percent, closeButton, minusButton, plusButton;
  let scale = 1, x = 0, y = 0, oldOverflow = '', previousFocus = null;
  const pointers = new Map();
  let gesture = null;

  function clamp(n) { return Math.max(MIN, Math.min(MAX, n)); }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function middle(a, b) { return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }
  function sync() {
    picture.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + scale + ')';
    percent.textContent = Math.round(scale * 100) + ' %';
    minusButton.disabled = scale <= MIN;
    plusButton.disabled = scale >= MAX;
  }
  function setZoom(next) {
    scale = clamp(next);
    if (scale === MIN) { x = 0; y = 0; }
    sync();
  }
  function createViewer() {
    root = document.createElement('div');
    root.className = 'rapli-zoom-overlay';
    root.hidden = true;
    root.setAttribute('role','dialog');
    root.setAttribute('aria-modal','true');
    root.setAttribute('aria-label','Photo agrandie');
    root.innerHTML =
      '<div class="rapli-zoom-toolbar" aria-label="Commandes du zoom">' +
      '<button type="button" data-zoom="out" aria-label="Réduire le zoom">−</button>' +
      '<button type="button" class="rapli-zoom-reset" data-zoom="reset" aria-label="Réinitialiser le zoom">100 %</button>' +
      '<button type="button" data-zoom="in" aria-label="Agrandir le zoom">+</button>' +
      '<button type="button" class="rapli-zoom-close" data-zoom="close" aria-label="Fermer la photo">×</button>' +
      '</div><div class="rapli-zoom-stage"><img class="rapli-zoom-image" alt="" draggable="false"></div>' +
      '<p class="rapli-zoom-help">Molette ou boutons pour zoomer · Pincer sur mobile · Glisser pour déplacer · Échap pour fermer</p>';
    document.body.appendChild(root);
    stage = root.querySelector('.rapli-zoom-stage');
    picture = root.querySelector('.rapli-zoom-image');
    percent = root.querySelector('.rapli-zoom-reset');
    closeButton = root.querySelector('.rapli-zoom-close');
    minusButton = root.querySelector('[data-zoom="out"]');
    plusButton = root.querySelector('[data-zoom="in"]');
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-zoom]');
      if (button) {
        const action = button.dataset.zoom;
        if (action === 'close') close();
        else if (action === 'in') setZoom(scale * 1.4);
        else if (action === 'out') setZoom(scale / 1.4);
        else if (action === 'reset') { x=0; y=0; setZoom(1); }
      } else if (event.target === root) close();
    });
    stage.addEventListener('wheel', event => {
      if (root.hidden) return;
      event.preventDefault();
      setZoom(scale * Math.exp(-event.deltaY * 0.002));
    }, { passive:false });
    stage.addEventListener('pointerdown', event => {
      if (root.hidden) return;
      event.preventDefault();
      stage.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId, {x:event.clientX,y:event.clientY});
      beginGesture();
      stage.classList.add('is-dragging');
    });
    stage.addEventListener('pointermove', event => {
      if (!pointers.has(event.pointerId) || root.hidden) return;
      pointers.set(event.pointerId, {x:event.clientX,y:event.clientY});
      const pts = [...pointers.values()];
      if (pts.length >= 2 && gesture && gesture.kind === 'pinch') {
        const mid = middle(pts[0],pts[1]);
        scale = clamp(gesture.scale * distance(pts[0],pts[1]) / Math.max(1,gesture.distance));
        x = gesture.x + mid.x - gesture.middle.x;
        y = gesture.y + mid.y - gesture.middle.y;
        if (scale === MIN) { x=0; y=0; }
        sync();
      } else if (pts.length === 1 && gesture && gesture.kind === 'pan' && scale > MIN) {
        x = gesture.x + pts[0].x - gesture.point.x;
        y = gesture.y + pts[0].y - gesture.point.y;
        sync();
      }
    });
    const pointerEnd = event => {
      if (!pointers.delete(event.pointerId)) return;
      stage.classList.toggle('is-dragging', pointers.size > 0);
      beginGesture();
    };
    stage.addEventListener('pointerup',pointerEnd);
    stage.addEventListener('pointercancel',pointerEnd);
    stage.addEventListener('lostpointercapture',pointerEnd);
  }
  function beginGesture() {
    const pts = [...pointers.values()];
    if (pts.length >= 2) {
      gesture = {kind:'pinch', scale, x, y, distance:distance(pts[0],pts[1]), middle:middle(pts[0],pts[1])};
    } else if (pts.length === 1) {
      gesture = {kind:'pan', x, y, point:{...pts[0]}};
    } else gesture = null;
  }
  function open(img) {
    const src = img.currentSrc || img.src;
    if (!src) return;
    if (!root) createViewer();
    previousFocus = document.activeElement;
    oldOverflow = document.body.style.overflow;
    picture.src = src;
    picture.alt = img.alt || 'Photo agrandie';
    scale = 1; x = 0; y = 0; pointers.clear(); gesture = null;
    sync();
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    closeButton.focus({preventScroll:true});
  }
  function close() {
    if (!root || root.hidden) return;
    root.hidden = true;
    pointers.clear(); gesture = null;
    stage.classList.remove('is-dragging');
    picture.removeAttribute('src');
    document.body.style.overflow = oldOverflow;
    if (previousFocus && previousFocus.isConnected) previousFocus.focus({preventScroll:true});
    previousFocus = null;
  }
  function prepare(node) {
    if (!(node instanceof Element)) return;
    const images = node.matches(selector) ? [node] : [...node.querySelectorAll(selector)];
    for (const img of images) {
      if (!img.hasAttribute('title')) img.title = 'Agrandir la photo';
      if (!img.closest('button, a, label')) {
        img.classList.add('rapli-zoom-target');
        img.tabIndex = 0;
        img.setAttribute('role','button');
        img.setAttribute('aria-label','Agrandir la photo : ' + (img.alt || 'visuel'));
      }
    }
  }
  document.addEventListener('click', event => {
    if (root && !root.hidden && root.contains(event.target)) return;
    const img = event.target.closest?.(selector);
    if (!img || !img.src) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open(img);
  }, true);
  document.addEventListener('keydown', event => {
    if (root && !root.hidden) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
      else if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(scale*1.4); }
      else if (event.key === '-') { event.preventDefault(); setZoom(scale/1.4); }
      else if (event.key === '0') { event.preventDefault(); x=0; y=0; setZoom(1); }
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches?.(selector) && !event.target.closest('button,a,label')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      open(event.target);
    }
  }, true);
  function start() {
    prepare(document.body);
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) prepare(node);
    }).observe(document.body,{childList:true,subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();