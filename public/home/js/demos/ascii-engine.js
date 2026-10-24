// Computer Science Interactive Procedural ASCII Engine Demo

export function initAsciiEngine(stageId = 'asciiStage', outputId = 'asciiArtOutput') {
  const asciiPre = document.getElementById(outputId);
  const asciiStage = document.getElementById(stageId);
  if (!asciiPre || !asciiStage) return;

  let mode = 'torus';
  let a = 1.1, b = 0.8;
  let isVisible = true;
  const COLS = 64, ROWS = 24;
  const SHADE_CHARS = '.,-~:;=!*#$@';

  window.setAsciiMode = function (newMode, btn) {
    mode = newMode;
    if (btn && btn.parentElement) {
      Array.from(btn.parentElement.children).forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
    }
  };

  asciiStage.addEventListener('mousemove', (e) => {
    const r = asciiStage.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
    a += ny * 0.08;
    b += nx * 0.08;
  });

  function renderLoop() {
    if (isVisible) {
      const output = new Array(COLS * ROWS).fill(' ');
      const zbuffer = new Array(COLS * ROWS).fill(0);

      a += 0.024;
      b += 0.015;

      if (mode === 'torus') {
        const cosA = Math.cos(a), sinA = Math.sin(a);
        const cosB = Math.cos(b), sinB = Math.sin(b);

        for (let theta = 0; theta < 6.28; theta += 0.09) {
          const costheta = Math.cos(theta), sintheta = Math.sin(theta);
          for (let phi = 0; phi < 6.28; phi += 0.045) {
            const cosphi = Math.cos(phi), sinphi = Math.sin(phi);
            const circleX = 2.1 + costheta;
            const circleY = sintheta;

            const x = circleX * (cosB * cosphi + sinA * sinB * sinphi) - circleY * cosA * sinB;
            const y = circleX * (sinB * cosphi - sinA * cosB * sinphi) + circleY * cosA * cosB;
            const z = 5.2 + cosA * circleX * sinphi + circleY * sinA;
            const ooz = 1 / z;

            const xp = Math.floor(COLS / 2 + 26 * ooz * x);
            const yp = Math.floor(ROWS / 2 - 12 * ooz * y);

            const L = cosphi * costheta * sinB - cosA * costheta * sinphi -
                      sinA * sintheta + cosB * (cosA * sintheta - costheta * sinA * sinphi);

            if (L > 0 && xp >= 0 && xp < COLS && yp >= 0 && yp < ROWS) {
              const idx = xp + COLS * yp;
              if (ooz > zbuffer[idx]) {
                zbuffer[idx] = ooz;
                const lumIndex = Math.min(SHADE_CHARS.length - 1, Math.floor(L * 8));
                output[idx] = SHADE_CHARS[Math.max(0, lumIndex)];
              }
            }
          }
        }
      } else if (mode === 'wave') {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const dx = (c - COLS / 2) * 0.22;
            const dy = (r - ROWS / 2) * 0.42;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const val = Math.sin(dist * 1.8 - a * 2.2) + Math.cos(dx * 0.9 + b);
            const norm = Math.floor(((val + 2) / 4) * SHADE_CHARS.length);
            if (norm > 2) {
              output[c + r * COLS] = SHADE_CHARS[Math.min(SHADE_CHARS.length - 1, norm)];
            }
          }
        }
      } else {
        // Recursive Binary Tree / AST
        const drawBranch = (x, y, len, angle, depth) => {
          if (depth <= 0 || len < 1.4) return;
          const x2 = x + Math.cos(angle) * len * 1.7;
          const y2 = y - Math.sin(angle) * len;
          const steps = Math.ceil(len * 2);
          for (let i = 0; i <= steps; i++) {
            const px = Math.round(x + ((x2 - x) * i) / steps);
            const py = Math.round(y + ((y2 - y) * i) / steps);
            if (px >= 0 && px < COLS && py >= 0 && py < ROWS) {
              output[px + py * COLS] = depth === 1 ? '@' : depth === 2 ? '#' : ':';
            }
          }
          const sway = Math.sin(a * 1.4 + depth) * 0.16;
          drawBranch(x2, y2, len * 0.68, angle - 0.52 + sway, depth - 1);
          drawBranch(x2, y2, len * 0.68, angle + 0.52 + sway, depth - 1);
        };
        drawBranch(COLS / 2, ROWS - 2, 7.0, Math.PI / 2, 5);
      }

      let str = '';
      for (let r = 0; r < ROWS; r++) {
        str += output.slice(r * COLS, (r + 1) * COLS).join('') + '\n';
      }
      asciiPre.textContent = str;
    }

    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    }, { threshold: 0.05 });
    observer.observe(asciiStage);
  }
}
