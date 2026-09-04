const nav = document.querySelector('.nav');
const toggle = document.querySelector('.nav-toggle');
const menu = document.getElementById('primary-navigation');

if (toggle && nav && menu) {
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(!!open));
    const label = open ? 'Fechar menu' : 'Abrir menu';
    const sr = toggle.querySelector('.sr-only');
    if (sr) sr.textContent = label;
  };

  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));

  // Close menu when clicking a nav link
  menu.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => setOpen(false));
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) setOpen(false);
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && nav.classList.contains('is-open')) setOpen(false);
  });
}
