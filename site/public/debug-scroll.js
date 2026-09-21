// Diagnostic temporaire (issue #83) — voir le commentaire dans Base.astro.
if (new URLSearchParams(location.search).has('debugScroll')) {
  const boite = document.createElement('pre');
  boite.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;max-height:40vh;overflow:auto;' +
    'margin:0;padding:8px;background:rgba(0,0,0,.85);color:#0f0;' +
    'font-size:11px;line-height:1.4;z-index:99999;white-space:pre-wrap;' +
    'font-family:monospace;pointer-events:none;';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(boite));

  const t0 = performance.now();
  function log(msg) {
    const ligne = `${(performance.now() - t0).toFixed(0).padStart(6)}ms  ${msg}`;
    boite.textContent += ligne + '\n';
    boite.scrollTop = boite.scrollHeight;
  }

  const scrollToOriginal = window.scrollTo.bind(window);
  window.scrollTo = function (...args) {
    log(`scrollTo(${JSON.stringify(args)})`);
    return scrollToOriginal(...args);
  };

  let dernierEtat = '';
  function suivre() {
    const groupe = document.querySelector('.groupe-collant');
    const cadre = document.querySelector('.cadre');
    const etat =
      `y=${Math.round(window.scrollY)} ` +
      `actif=${groupe?.classList.contains('actif') ?? '?'} ` +
      `reduit=${cadre?.classList.contains('reduit') ?? '?'} ` +
      `vh=${window.visualViewport?.height ?? window.innerHeight}`;
    if (etat !== dernierEtat) {
      log(etat);
      dernierEtat = etat;
    }
    requestAnimationFrame(suivre);
  }
  requestAnimationFrame(suivre);

  document.addEventListener(
    'click',
    (e) => {
      const bouton = e.target.closest && e.target.closest('button.jouer');
      if (bouton) log(`clic épisode: ${bouton.textContent.trim().slice(0, 40)}`);
    },
    true,
  );
}
