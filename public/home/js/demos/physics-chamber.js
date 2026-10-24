// Physics Lorentz Particle Chamber Demo

export function initPhysicsChamber(canvasId = 'physChamberCanvas') {
  const physCanvas = document.getElementById(canvasId);
  if (!physCanvas) return;
  const physCtx = physCanvas.getContext('2d');
  let physW = 560, physH = 340;
  let physAttractor = { x: 280, y: 170, polarity: 1 };
  let isVisible = true;

  function resize() {
    const r = physCanvas.parentElement.getBoundingClientRect();
    physW = r.width;
    physH = 340;
    physCanvas.width = physW * window.devicePixelRatio;
    physCanvas.height = physH * window.devicePixelRatio;
    physCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    physAttractor.x = physW * 0.5;
    physAttractor.y = physH * 0.5;
  }
  window.addEventListener('resize', resize);
  resize();

  const particles = Array.from({ length: 320 }, (_, i) => {
    const angle = (i / 320) * Math.PI * 2;
    const dist = 40 + Math.random() * 150;
    return {
      x: physW / 2 + Math.cos(angle) * dist,
      y: physH / 2 + Math.sin(angle) * dist,
      vx: -Math.sin(angle) * (1.6 + Math.random() * 1.2),
      vy: Math.cos(angle) * (1.6 + Math.random() * 1.2),
      charge: i % 5 === 0 ? -1 : 1
    };
  });

  physCanvas.addEventListener('mousemove', (e) => {
    const r = physCanvas.getBoundingClientRect();
    physAttractor.x = e.clientX - r.left;
    physAttractor.y = e.clientY - r.top;
  });

  physCanvas.addEventListener('click', () => {
    physAttractor.polarity *= -1;
    const readout = document.getElementById('physHudReadout');
    if (readout) {
      readout.textContent =
        physAttractor.polarity > 0
          ? '320 charged ions in attractive central potential & B-field flux'
          : '320 charged ions in repulsive Rutherford scattering deflection';
    }
  });

  function renderChamber() {
    if (isVisible) {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      physCtx.fillStyle = isDark ? 'rgba(16, 18, 17, 0.20)' : 'rgba(255, 255, 255, 0.24)';
      physCtx.fillRect(0, 0, physW, physH);

      // Equipotential rings
      [40, 85, 140].forEach(rad => {
        physCtx.beginPath();
        physCtx.arc(physAttractor.x, physAttractor.y, rad, 0, Math.PI * 2);
        physCtx.strokeStyle = isDark ? 'rgba(255, 120, 68, 0.12)' : 'rgba(231, 98, 43, 0.14)';
        physCtx.lineWidth = 1;
        physCtx.stroke();
      });

      particles.forEach(p => {
        const dx = physAttractor.x - p.x;
        const dy = physAttractor.y - p.y;
        const distSq = Math.max(260, dx * dx + dy * dy);
        const dist = Math.sqrt(distSq);

        const force = (110 / distSq) * physAttractor.polarity;
        const fx = (dx / dist) * force - p.vy * 0.012 * p.charge;
        const fy = (dy / dist) * force + p.vx * 0.012 * p.charge;

        const prevX = p.x;
        const prevY = p.y;

        p.vx = (p.vx + fx) * 0.996;
        p.vy = (p.vy + fy) * 0.996;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > physW || p.y < 0 || p.y > physH) {
          const ang = Math.random() * Math.PI * 2;
          p.x = physAttractor.x + Math.cos(ang) * 130;
          p.y = physAttractor.y + Math.sin(ang) * 130;
          p.vx = -Math.sin(ang) * 2.0;
          p.vy = Math.cos(ang) * 2.0;
        } else {
          physCtx.beginPath();
          physCtx.moveTo(prevX, prevY);
          physCtx.lineTo(p.x, p.y);
          physCtx.strokeStyle = p.charge > 0 ? '#FF7844' : '#3B82F6';
          physCtx.lineWidth = 1.4;
          physCtx.stroke();
        }
      });
    }

    requestAnimationFrame(renderChamber);
  }
  requestAnimationFrame(renderChamber);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    }, { threshold: 0.05 });
    observer.observe(physCanvas);
  }
}
