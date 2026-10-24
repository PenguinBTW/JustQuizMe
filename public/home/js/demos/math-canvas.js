// Mathematics Calculus Graph Scrubber Demo

export function initMathCanvas(canvasId = 'mathScrollCanvas', sectionId = 'mathSection') {
  const mathCanvas = document.getElementById(canvasId);
  const mathSection = document.getElementById(sectionId);
  if (!mathCanvas) return;
  const mathCtx = mathCanvas.getContext('2d');

  let mode = 'pure';
  let scrubOverride = null;
  let isVisible = true;

  window.setMathCurve = function (newMode, btn) {
    mode = newMode;
    if (btn && btn.parentElement) {
      Array.from(btn.parentElement.children).forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
    }
    const titleEl = document.getElementById('mathEquationTitle');
    if (titleEl) {
      if (mode === 'pure') titleEl.textContent = 'Pure Calculus: f(x) = sin(x) + 0.45 cos(2x)';
      else if (mode === 'mech') titleEl.textContent = 'Mechanics Damped SHM: x(t) = 1.35 e^(-0.28t) cos(1.6t)';
      else titleEl.textContent = 'Statistics Gaussian Normal: φ(z) = 1.35 e^(-0.45(z - 3.9)²) - 0.35';
    }
  };

  function evalF(x) {
    if (mode === 'pure') return Math.sin(x) + 0.45 * Math.cos(2 * x);
    if (mode === 'mech') return 1.35 * Math.exp(-0.28 * x) * Math.cos(1.6 * x);
    return 1.35 * Math.exp(-0.45 * Math.pow(x - 3.9, 2)) - 0.35;
  }

  function evalDF(x) {
    const h = 0.001;
    return (evalF(x + h) - evalF(x - h)) / (2 * h);
  }

  function evalD2F(x) {
    const h = 0.002;
    return (evalF(x + h) - 2 * evalF(x) + evalF(x - h)) / (h * h);
  }

  function resize() {
    const r = mathCanvas.parentElement.getBoundingClientRect();
    mathCanvas.width = r.width * window.devicePixelRatio;
    mathCanvas.height = 340 * window.devicePixelRatio;
    mathCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }
  window.addEventListener('resize', resize);
  resize();

  mathCanvas.addEventListener('mousemove', (e) => {
    const r = mathCanvas.getBoundingClientRect();
    scrubOverride = Math.max(0.06, Math.min(0.94, (e.clientX - r.left) / r.width));
  });

  mathCanvas.addEventListener('mouseleave', () => {
    scrubOverride = null;
  });

  function renderRider() {
    if (isVisible) {
      const w = mathCanvas.width / window.devicePixelRatio;
      const h = 340;
      mathCtx.clearRect(0, 0, w, h);

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

      let scrollProgress = 0.45;
      if (mathSection) {
        const rect = mathSection.getBoundingClientRect();
        const viewH = window.innerHeight;
        const rawProgress = (viewH - rect.top) / (viewH + rect.height);
        scrollProgress = Math.max(0.08, Math.min(0.92, rawProgress));
      }

      const tProgress = scrubOverride !== null ? scrubOverride : scrollProgress;
      const domainMax = Math.PI * 2.5;
      const riderX = tProgress * domainMax;
      const riderY = evalF(riderX);
      const slope = evalDF(riderX);
      const secondDeriv = evalD2F(riderX);

      const mapX = (x) => 44 + (x / domainMax) * (w - 88);
      const mapY = (y) => h * 0.54 - y * (h * 0.28);
      const zeroY = mapY(0);

      // Riemann strips
      const stripCount = 36;
      const dx = riderX / stripCount;
      let areaAccum = 0;
      mathCtx.fillStyle = isDark ? 'rgba(59, 130, 246, 0.16)' : 'rgba(21, 109, 255, 0.14)';
      mathCtx.strokeStyle = isDark ? 'rgba(59, 130, 246, 0.32)' : 'rgba(21, 109, 255, 0.28)';
      mathCtx.lineWidth = 1;

      for (let i = 0; i < stripCount; i++) {
        const xLeft = i * dx;
        const xRight = (i + 1) * dx;
        const yMid = evalF((xLeft + xRight) / 2);
        areaAccum += yMid * dx;
        const px1 = mapX(xLeft);
        const px2 = mapX(xRight);
        const py = mapY(yMid);

        mathCtx.beginPath();
        mathCtx.rect(px1, Math.min(zeroY, py), px2 - px1, Math.abs(zeroY - py));
        mathCtx.fill();
        mathCtx.stroke();
      }

      // Zero Axis
      mathCtx.beginPath();
      mathCtx.moveTo(28, zeroY);
      mathCtx.lineTo(w - 28, zeroY);
      mathCtx.strokeStyle = isDark ? 'rgba(243, 240, 232, 0.20)' : 'rgba(20, 20, 19, 0.20)';
      mathCtx.lineWidth = 1.2;
      mathCtx.stroke();

      // Continuous Curve
      mathCtx.beginPath();
      for (let x = 0; x <= domainMax; x += 0.03) {
        const px = mapX(x);
        const py = mapY(evalF(x));
        if (x === 0) mathCtx.moveTo(px, py);
        else mathCtx.lineTo(px, py);
      }
      mathCtx.strokeStyle = isDark ? '#3B82F6' : '#156DFF';
      mathCtx.lineWidth = 2.6;
      mathCtx.stroke();

      // Tangent Line
      const px = mapX(riderX);
      const py = mapY(riderY);
      const spanX = 1.15;
      const tx1 = mapX(riderX - spanX);
      const ty1 = mapY(riderY - slope * spanX);
      const tx2 = mapX(riderX + spanX);
      const ty2 = mapY(riderY + slope * spanX);

      mathCtx.beginPath();
      mathCtx.moveTo(tx1, ty1);
      mathCtx.lineTo(tx2, ty2);
      mathCtx.strokeStyle = '#E7622B';
      mathCtx.lineWidth = 1.8;
      mathCtx.stroke();

      // Curvature Circle
      const curvatureRadius = Math.min(84, Math.max(22, Math.abs(1 / (secondDeriv || 0.5)) * 32));
      mathCtx.beginPath();
      mathCtx.arc(px, py + (secondDeriv < 0 ? curvatureRadius : -curvatureRadius), curvatureRadius, 0, Math.PI * 2);
      mathCtx.strokeStyle = isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(15, 184, 110, 0.35)';
      mathCtx.setLineDash([4, 4]);
      mathCtx.lineWidth = 1.2;
      mathCtx.stroke();
      mathCtx.setLineDash([]);

      // Tangent Node
      mathCtx.beginPath();
      mathCtx.arc(px, py, 6, 0, Math.PI * 2);
      mathCtx.fillStyle = '#FFFFFF';
      mathCtx.fill();
      mathCtx.lineWidth = 2.4;
      mathCtx.strokeStyle = '#E7622B';
      mathCtx.stroke();

      // Telemetry labels
      const elX = document.getElementById('mathTelX');
      const elGrad = document.getElementById('mathTelGrad');
      const elCurv = document.getElementById('mathTelCurv');
      const elArea = document.getElementById('mathTelArea');

      if (elX) elX.textContent = `x=${riderX.toFixed(2)}, y=${riderY.toFixed(2)}`;
      if (elGrad) elGrad.textContent = `dy/dx = ${slope >= 0 ? '+' : ''}${slope.toFixed(2)}`;
      if (elCurv) elCurv.textContent = `d²y/dx² = ${secondDeriv >= 0 ? '+' : ''}${secondDeriv.toFixed(2)}`;
      if (elArea) elArea.textContent = `∫ f(t) dt = ${areaAccum >= 0 ? '+' : ''}${areaAccum.toFixed(3)}`;
    }

    requestAnimationFrame(renderRider);
  }
  requestAnimationFrame(renderRider);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    }, { threshold: 0.05 });
    observer.observe(mathCanvas);
  }
}
