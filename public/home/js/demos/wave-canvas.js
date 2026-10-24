// Hero Wave Interference Canvas Demo

export function initHeroWave(canvasId = 'heroWaveCanvas') {
  const heroCanvas = document.getElementById(canvasId);
  if (!heroCanvas) return;
  const heroCtx = heroCanvas.getContext('2d');
  let heroPhase = 0;
  let isVisible = true;

  function resize() {
    const r = heroCanvas.getBoundingClientRect();
    heroCanvas.width = r.width * window.devicePixelRatio;
    heroCanvas.height = r.height * window.devicePixelRatio;
    heroCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }
  window.addEventListener('resize', resize);
  resize();

  function animateHeroWaves() {
    if (isVisible) {
      const w = heroCanvas.width / window.devicePixelRatio;
      const h = heroCanvas.height / window.devicePixelRatio;
      heroCtx.clearRect(0, 0, w, h);

      heroPhase += 0.018;
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

      const waves = [
        {
          color: isDark ? 'rgba(255, 120, 68, 0.40)' : 'rgba(231, 98, 43, 0.45)', // Physics
          amp: 36,
          freq: 0.007,
          speed: 1.1,
          yOffset: h * 0.46
        },
        {
          color: isDark ? 'rgba(16, 185, 129, 0.45)' : 'rgba(15, 184, 110, 0.50)', // CS
          amp: 42,
          freq: 0.009,
          speed: 1.4,
          yOffset: h * 0.52
        },
        {
          color: isDark ? 'rgba(59, 130, 246, 0.45)' : 'rgba(21, 109, 255, 0.50)', // Maths
          amp: 48,
          freq: 0.006,
          speed: 0.9,
          yOffset: h * 0.58
        }
      ];

      waves.forEach(wv => {
        heroCtx.beginPath();
        for (let x = w * 0.15; x <= w; x += 6) {
          const env = Math.pow((x - w * 0.15) / (w * 0.85), 1.3);
          const y = wv.yOffset +
            Math.sin(x * wv.freq + heroPhase * wv.speed) * wv.amp * env +
            Math.cos(x * wv.freq * 2.1 - heroPhase) * (wv.amp * 0.35) * env;
          if (x === w * 0.15) heroCtx.moveTo(x, y);
          else heroCtx.lineTo(x, y);
        }
        heroCtx.strokeStyle = wv.color;
        heroCtx.lineWidth = 2.0;
        heroCtx.stroke();
      });
    }

    requestAnimationFrame(animateHeroWaves);
  }
  requestAnimationFrame(animateHeroWaves);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    }, { threshold: 0.05 });
    observer.observe(heroCanvas);
  }
}
