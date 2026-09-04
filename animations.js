/* Leal.ai — motor de animações leve (sem dependências)
   - reveal on scroll com stagger
   - count-up de números
   - efeito typing em títulos marcados
*/
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const REVEAL_SELECTOR = [
    '.benefits .benefit',
    '.benefits > .container > *',
    '.hierarchy-highlight > .container > *',
    '.steps .step',
    '.section > .container > *',
    'section:not(.hero) h2',
    'section:not(.hero) p.eyebrow',
    '.cta-inner > *',
    'footer > *',
    '.card',
    '.stat-card',
    '.wizard-card',
    '.preview-card',
    '.page-intro > *',
    '.quick-stats > *',
    'table',
  ].join(',');

  function markTargets() {
    const seen = new Set();
    document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => {
      if (seen.has(el) || el.hasAttribute('data-anim') || el.closest('.hero')) return;
      seen.add(el);
      el.setAttribute('data-anim', 'up');
    });
  }

  function observe() {
    const items = document.querySelectorAll('[data-anim]');
    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const siblings = el.parentElement ? [...el.parentElement.children].filter((c) => c.hasAttribute('data-anim')) : [];
          const index = Math.max(0, siblings.indexOf(el));
          el.style.transitionDelay = Math.min(index * 70, 350) + 'ms';
          el.classList.add('is-visible');
          io.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    items.forEach((el) => io.observe(el));
  }

  function countUp() {
    if (reduce || !('IntersectionObserver' in window)) return;
    const nodes = [...document.querySelectorAll('[data-count-up]')];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        io.unobserve(el);
        const raw = el.getAttribute('data-count-up') || el.textContent;
        const target = parseFloat(String(raw).replace(/[^\d.,-]/g, '').replace(',', '.'));
        if (!isFinite(target)) return;
        const prefix = el.getAttribute('data-prefix') || '';
        const suffix = el.getAttribute('data-suffix') || '';
        const decimals = (String(target).split('.')[1] || '').length;
        const start = performance.now();
        const dur = 1100;
        const tick = (now) => {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });
    nodes.forEach((el) => io.observe(el));
  }

  function typing() {
    if (reduce) return;
    document.querySelectorAll('[data-typing]').forEach((el) => {
      const text = el.textContent.trim();
      el.textContent = '';
      el.classList.add('leal-typing');
      let i = 0;
      const step = () => {
        el.textContent = text.slice(0, ++i);
        if (i < text.length) setTimeout(step, 22);
        else setTimeout(() => el.classList.remove('leal-typing'), 900);
      };
      setTimeout(step, 350);
    });
  }

  function tabTransitions() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn, .step-nav-item, [data-tab]');
      if (!btn) return;
      requestAnimationFrame(() => {
        document.querySelectorAll('.tab-content.active, .step-panel.active').forEach((panel) => {
          panel.style.animation = 'none';
          void panel.offsetWidth;
          panel.style.animation = '';
        });
      });
    });
  }

  function boot() {
    markTargets();
    observe();
    countUp();
    typing();
    tabTransitions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
