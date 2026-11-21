/* Rapli Regatta — compact profile menu in the courses toolbar.
 * Authentication is provided by the existing Supabase admin client.
 * Never infer privileges from this menu: RLS remains the authority.
 */
(() => {
  'use strict';
  const root = document.getElementById('rapliProfile');
  const toggle = document.getElementById('rapliProfileToggle');
  const menu = document.getElementById('rapliProfileMenu');
  const login = document.getElementById('rapliProfileLogin');
  const logout = document.getElementById('rapliProfileLogout');
  const message = document.getElementById('rapliProfileMessage');
  if (!root || !toggle || !menu || !login || !logout || !message) return;
  const access = window.RapliAdminAccess;
  if (!access) {
    message.textContent = 'Connexion momentanément indisponible.';
    login.disabled = true;
    return;
  }
  const setMessage = (value, error = false) => {
    message.textContent = value;
    message.dataset.error = String(error);
  };
  const paint = () => {
    const editor = access.isEditor();
    login.hidden = editor;
    logout.hidden = !editor;
    toggle.classList.toggle('is-admin', editor);
    toggle.setAttribute('aria-label', editor ? 'Profil administrateur' : 'Ouvrir le menu Profil');
    if (message.dataset.pending !== 'true')
      setMessage(editor ? 'Administrateur connecté · mode édition actif' : 'Consultation libre');
  };
  const open = () => {
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    paint();
  };
  const close = (restoreFocus = false) => {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) toggle.focus();
  };
  toggle.addEventListener('click', () => {
    if (menu.hidden) open();
    else close();
  });
  document.addEventListener('pointerdown', event => {
    if (!menu.hidden && !root.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) {
      event.preventDefault();
      close(true);
    }
  });
  login.addEventListener('click', async () => {
    if (login.disabled) return;
    login.disabled = true;
    message.dataset.pending = 'true';
    setMessage('Envoi du lien sécurisé de connexion…');
    try {
      await access.sendMagicLink();
      setMessage('Lien envoyé à ton adresse administrateur. Ouvre-le sur cet appareil.');
    } catch (error) {
      const code = String(error?.code || '').toLowerCase();
      const description = String(error?.message || '').toLowerCase();
      if (error?.status === 429 || code === 'over_email_send_rate_limit' ||
          description.includes('email rate limit exceeded'))
        setMessage('Limite d’envoi atteinte. Réutilise le dernier lien valide ou réessaie plus tard.', true);
      else setMessage('Connexion indisponible : ' + (error?.message || 'erreur inconnue'), true);
    } finally {
      login.disabled = false;
    }
  });
  logout.addEventListener('click', async () => {
    if (logout.disabled) return;
    logout.disabled = true;
    message.dataset.pending = 'true';
    setMessage('Déconnexion…');
    try {
      await access.logout();
      delete message.dataset.pending;
      paint();
    } catch (error) {
      setMessage('Déconnexion indisponible : ' + (error?.message || 'erreur inconnue'), true);
    } finally {
      logout.disabled = false;
    }
  });
  window.addEventListener('rapli-admin-access-change', () => {
    delete message.dataset.pending;
    paint();
  });
  paint();
  void access.initialize().then(paint);
})();
