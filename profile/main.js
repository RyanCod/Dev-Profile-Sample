/* ============================================================
   Alex Rivera — portfolio runtime
   GSAP + ScrollTrigger + Lenis + WebGL
   ============================================================ */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  gsap.registerPlugin(ScrollTrigger);

  /* ---------------------------------------------------------
     Lenis smooth scroll
     --------------------------------------------------------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({
      duration: 1.15,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const scrollTo = target => {
    if (lenis) lenis.scrollTo(target, { offset: -10 });
    else {
      const el = typeof target === 'string' ? $(target) : target;
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const el = $(id);
      if (!el) return;
      e.preventDefault();
      scrollTo(el);
    });
  });

  /* ---------------------------------------------------------
     WebGL liquid field
     --------------------------------------------------------- */
  (function liquid() {
    const canvas = $('#gl');
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) { canvas.style.display = 'none'; return; }

    const vert = `
      attribute vec2 aPos;
      void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

    const frag = `
      precision highp float;
      uniform vec2  uRes;
      uniform float uTime;
      uniform vec2  uMouse;
      uniform float uSwirl;
      uniform float uPush;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0.0, a = 0.5;
        mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
        for (int i = 0; i < 5; i++){ v += a * noise(p); p = m * p; a *= 0.5; }
        return v;
      }

      void main(){
        vec2 uv = gl_FragCoord.xy / uRes.xy;
        vec2 p = (gl_FragCoord.xy - 0.5 * uRes.xy) / uRes.y;
        float aspect = uRes.x / uRes.y;

        // pointer vortex: warp the field around the cursor
        vec2 mp = vec2(uMouse.x * aspect * 0.5, uMouse.y * 0.5);
        vec2 d0 = p - mp;
        float r0 = length(d0);
        float fall = exp(-r0 * r0 * 9.0);
        float ang = uSwirl * fall;
        float ca = cos(ang), sa = sin(ang);
        p = mp + mat2(ca, -sa, sa, ca) * d0;
        p -= normalize(d0 + 1e-5) * uPush * fall * 0.22;

        float t = uTime * (0.055 + 0.12 * fall);

        float n1 = fbm(p * 1.35 + vec2(t, -t * 0.7));
        float n2 = fbm(p * 2.10 + vec2(-t * 0.8, t * 1.1) + n1 * 1.5);
        float n3 = fbm(p * 3.30 + n2 * 1.9 + t * 0.5);

        vec3 c1 = vec3(0.34, 0.26, 0.86);
        vec3 c2 = vec3(0.14, 0.80, 0.72);
        vec3 c3 = vec3(0.96, 0.56, 0.34);
        vec3 c4 = vec3(0.96, 0.34, 0.66);

        vec3 col = vec3(0.015, 0.017, 0.032);
        col = mix(col, c1, smoothstep(0.30, 0.92, n1) * 1.00);
        col = mix(col, c2, smoothstep(0.40, 0.98, n2) * 0.78);
        col = mix(col, c3, smoothstep(0.55, 1.00, n3) * 0.46);
        col = mix(col, c4, smoothstep(0.60, 1.00, n1 * n2 * 2.6) * 0.40);

        // bright ribbon where the vortex is strongest
        col += fall * abs(uSwirl) * 0.045 * vec3(0.7, 0.85, 1.0);

        float sheen = pow(smoothstep(0.50, 1.0, n2), 3.0);
        col += sheen * 0.30 * vec3(0.82, 0.90, 1.0);

        float core = smoothstep(0.95, 0.05, length(p - vec2(0.34, -0.04)));
        col += core * 0.10 * vec3(0.55, 0.62, 1.0);

        float v = smoothstep(1.35, 0.15, length(p * vec2(0.80, 1.0)));
        col *= mix(0.40, 1.0, v);

        col += (hash(gl_FragCoord.xy + uTime) * 2.0 - 1.0) * 0.017;

        gl_FragColor = vec4(col, 1.0);
      }`;

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn('shader:', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, vert);
    const fs = compile(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) { canvas.style.display = 'none'; return; }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.style.display = 'none'; return; }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uMouse = gl.getUniformLocation(prog, 'uMouse');
    const uSwirl = gl.getUniformLocation(prog, 'uSwirl');
    const uPush = gl.getUniformLocation(prog, 'uPush');

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let swirl = 0, push = 0, prevAng = null, lastX = 0, lastY = 0;
    let dpr = 1, w = 0, h = 0, visible = true;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    window.addEventListener('pointermove', e => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * -2;

      // angular velocity around the hero centre → vortex strength
      const ang = Math.atan2(mouse.ty, mouse.tx);
      if (prevAng !== null) {
        let da = ang - prevAng;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const rr = Math.hypot(mouse.tx, mouse.ty);
        const weight = Math.exp(-Math.pow((rr - 0.55) / 0.75, 2));
        swirl = Math.max(-5.5, Math.min(5.5, swirl + da * 2.6 * weight));
      }
      prevAng = ang;

      push = Math.min(1, push + Math.hypot(mouse.tx - lastX, mouse.ty - lastY) * 2.0);
      lastX = mouse.tx;
      lastY = mouse.ty;
    }, { passive: true });

    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
    }, { threshold: 0 }).observe(canvas);

    let t0 = performance.now();
    const frame = now => {
      requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      if (reduce && now - t0 > 60) return;

      mouse.x += (mouse.tx - mouse.x) * 0.045;
      mouse.y += (mouse.ty - mouse.y) * 0.045;
      swirl *= 0.94;
      push *= 0.90;

      gl.uniform1f(uTime, (now - t0) * 0.001);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uSwirl, swirl);
      gl.uniform1f(uPush, push);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    requestAnimationFrame(frame);
  })();

  /* ---------------------------------------------------------
     Emblem — particle monogram, assembles when you swirl it
     --------------------------------------------------------- */
  (function emblem() {
    const canvas = $('#emblem');
    if (!canvas || window.innerWidth < 900) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const hint = $('#emblemHint');
    if (hint && !fine) hint.innerHTML = '<span class="eh-dot"></span> tap to summon';

    const N = 620;
    let W = 0, H = 0, DPR = 1, cx = 0, cy = 0, R = 0;
    let particles = [];
    let energy = 0;
    let ignited = false;
    let lastAng = null;
    let visible = true;
    let time = 0;
    let px = -9999, py = -9999;

    const sampleGlyph = () => {
      const S = 300;
      const c = document.createElement('canvas');
      c.width = S; c.height = S;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = 'italic 400 200px "Instrument Serif", Georgia, serif';
      const wd = g.measureText('AR').width || 1;
      const k = Math.min(1, (S * 0.74) / wd);
      g.save();
      g.translate(S / 2, S / 2 + 4);
      g.scale(k, k);
      g.fillText('AR', 0, 0);
      g.restore();

      const data = g.getImageData(0, 0, S, S).data;
      const pts = [];
      for (let y = 0; y < S; y += 3) {
        for (let x = 0; x < S; x += 3) {
          if (data[(y * S + x) * 4 + 3] > 140) pts.push([x - S / 2, y - S / 2]);
        }
      }
      return { pts, S };
    };

    const build = () => {
      const { pts, S } = sampleGlyph();
      if (pts.length < 30) return;
      const k = (R * 1.35) / S;
      for (let i = pts.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [pts[i], pts[j]] = [pts[j], pts[i]];
      }
      particles = new Array(N);
      for (let i = 0; i < N; i++) {
        const p = pts[i % pts.length];
        particles[i] = {
          tx: p[0] * k + (Math.random() - 0.5) * 2,
          ty: p[1] * k + (Math.random() - 0.5) * 2,
          a: Math.random() * Math.PI * 2,
          r: R * (0.85 + Math.random() * 0.95),
          sp: (0.10 + Math.random() * 0.28) * (Math.random() < 0.5 ? -1 : 1),
          size: 0.9 + Math.random() * 1.2,
          bucket: i % 3
        };
      }
    };

    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cx = W * 0.55;
      cy = H / 2;
      R = Math.min(W, H) * 0.30;
      build();
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);

    new IntersectionObserver(en => { visible = en[0].isIntersecting; }, { threshold: 0 }).observe(canvas);

    // swirl detection
    window.addEventListener('pointermove', e => {
      if (!fine) return;
      const rect = canvas.getBoundingClientRect();
      if (e.clientY < rect.top || e.clientY > rect.bottom) { lastAng = null; return; }
      const ecx = rect.left + rect.width * 0.55;
      const ecy = rect.top + rect.height / 2;
      const dx = e.clientX - ecx;
      const dy = e.clientY - ecy;
      const dist = Math.hypot(dx, dy);
      px = e.clientX - rect.left;
      py = e.clientY - rect.top;

      if (dist < R * 0.5 || dist > R * 3.6) { lastAng = null; return; }
      const ang = Math.atan2(dy, dx);
      if (lastAng !== null) {
        let d = ang - lastAng;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const wgt = Math.exp(-Math.pow((dist - R * 1.3) / (R * 1.5), 2));
        energy = Math.min(1.2, energy + Math.abs(d) * 0.38 * wgt);
      }
      lastAng = ang;
    }, { passive: true });

    // touch: tap to summon
    if (!fine) {
      $('.hero').addEventListener('pointerdown', e => {
        if (e.target.closest('a,button')) return;
        energy = 1.2;
        if (hint) hint.classList.add('gone');
      });
    }

    const COLORS = ['#8b7bff', '#5eead4', '#ff8cbe'];

    const draw = now => {
      requestAnimationFrame(draw);
      if (!visible || document.hidden) return;
      time = now * 0.001;
      if (!reduce) {
        energy *= 0.992;
        if (energy < 0.002) energy = 0;
      }

      if (!ignited && energy > 0.5 && hint) { ignited = true; hint.classList.add('gone'); }

      ctx.clearRect(0, 0, W, H);
      if (!particles.length) return;

      const e = Math.min(1, energy);
      const ease = e * e * (3 - 2 * e);
      const asm = Math.min(1, ease * 1.12);

      ctx.globalCompositeOperation = 'lighter';

      // halo
      if (asm > 0.01) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
        g.addColorStop(0, `rgba(139,123,255,${0.16 * asm})`);
        g.addColorStop(0.5, `rgba(94,234,212,${0.05 * asm})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - R * 1.5, cy - R * 1.5, R * 3, R * 3);
      }

      const mx = px - cx, my = py - cy;

      // compute
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const oa = p.a + time * p.sp;
        const ox = Math.cos(oa) * p.r;
        const oy = Math.sin(oa) * p.r * 0.86;

        let x = cx + ox + (p.tx - ox) * asm;
        let y = cy + oy + (p.ty - oy) * asm;

        // pointer pushes the dust aside
        const dx = x - cx - mx;
        const dy = y - cy - my;
        const dd = Math.hypot(dx, dy);
        if (dd < 110 && dd > 0.001) {
          const f = (1 - dd / 110) * 16;
          x += (dx / dd) * f;
          y += (dy / dd) * f;
        }

        p.sx = x; p.sy = y;
        p.sa = 0.06 + asm * 0.94;
        p.ss = p.size * (0.75 + asm * 0.95);
      }

      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = COLORS[c];
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (p.bucket !== c) continue;
          ctx.globalAlpha = p.sa;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, p.ss, 0, 6.2832);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    requestAnimationFrame(draw);

    if (reduce) energy = 1;
  })();

  /* ---------------------------------------------------------
     Cursor glow + spotlight + aurora parallax
     --------------------------------------------------------- */
  if (fine && !reduce) {
    const glow = $('#cursorGlow');
    const spot = $('#spotlight');
    const aurora = $('.aurora');

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let gx = mx, gy = my, ax = 0, ay = 0, tick = 0;

    document.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });

    gsap.ticker.add(() => {
      const dx = mx - gx, dy = my - gy;
      gx += dx * 0.2;
      gy += dy * 0.2;

      const sp = Math.min(1, Math.hypot(dx, dy) / 45);
      glow.style.transform = `translate3d(${gx}px,${gy}px,0) scale(${(1 + sp * 0.4).toFixed(3)})`;

      if (tick++ % 6 === 0) {
        glow.style.setProperty('--hue', `${((gx * 0.1 + performance.now() * 0.01) % 360).toFixed(1)}deg`);
      }

      spot.style.setProperty('--mx', gx + 'px');
      spot.style.setProperty('--my', gy + 'px');

      const tx = (gx / window.innerWidth - 0.5) * -48;
      const ty = (gy / window.innerHeight - 0.5) * -36;
      ax += (tx - ax) * 0.045;
      ay += (ty - ay) * 0.045;
      aurora.style.setProperty('--ax', ax.toFixed(2) + 'px');
      aurora.style.setProperty('--ay', ay.toFixed(2) + 'px');
    });

    glow.classList.add('on');

    $$('[data-cursor]').forEach(el => {
      el.addEventListener('pointerenter', () => glow.classList.add('hot'));
      el.addEventListener('pointerleave', () => glow.classList.remove('hot'));
    });
  }

  /* ---------------------------------------------------------
     Magnetic buttons
     --------------------------------------------------------- */
  if (fine && !reduce) {
    $$('[data-magnetic]').forEach(el => {
      const strength = 0.32;
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });

      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        xTo(x * strength);
        yTo(y * strength);
        el.style.setProperty('--bx', `${e.clientX - r.left}px`);
        el.style.setProperty('--by', `${e.clientY - r.top}px`);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ---------------------------------------------------------
     Tilt cards
     --------------------------------------------------------- */
  if (fine && !reduce) {
    $$('[data-tilt]').forEach(el => {
      const rx = gsap.quickTo(el, 'rotateX', { duration: 0.7, ease: 'power3.out' });
      const ry = gsap.quickTo(el, 'rotateY', { duration: 0.7, ease: 'power3.out' });
      gsap.set(el, { transformPerspective: 1000, transformStyle: 'preserve-3d' });

      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        rx((0.5 - py) * 9);
        ry((px - 0.5) * 11);
        el.style.setProperty('--gx', `${px * 100}%`);
        el.style.setProperty('--gy', `${py * 100}%`);
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  /* ---------------------------------------------------------
     Scroll progress + nav
     --------------------------------------------------------- */
  const bar = $('#scrollBar');
  const nav = $('#nav');
  let lastY = 0;

  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    if (bar) bar.style.width = (p * 100).toFixed(2) + '%';

    const y = window.scrollY;
    if (y > 120) nav.classList.add('solid'); else nav.classList.remove('solid');
    if (y > lastY + 6 && y > 300) nav.classList.add('hidden');
    else if (y < lastY - 6 || y < 120) nav.classList.remove('hidden');
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------------
     Counters
     --------------------------------------------------------- */
  const fmt = (v, dec) => dec ? v.toFixed(dec) : Math.round(v).toString();

  const runCounters = () => {
    $$('[data-count]').forEach(el => {
      const target = parseFloat(el.getAttribute('data-count'));
      const dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
      const suffix = el.getAttribute('data-suffix') || '';
      const obj = { v: 0 };

      if (reduce) { el.textContent = fmt(target, dec) + suffix; return; }

      gsap.to(obj, {
        v: target,
        duration: 1.8,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        onUpdate: () => { el.textContent = fmt(obj.v, dec) + suffix; }
      });
    });
  };

  /* ---------------------------------------------------------
     Reveals
     --------------------------------------------------------- */
  const buildReveals = () => {
    if (reduce) return;
    const inHero = el => el.closest('.hero');
    $$('.reveal-up').filter(el => !inHero(el)).forEach(el => {
      gsap.from(el, {
        y: 34, opacity: 0, duration: 1.1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });
    $$('.reveal-fade').filter(el => !inHero(el)).forEach((el, i) => {
      gsap.from(el, {
        y: 20, opacity: 0, duration: 1, delay: 0.05 * i, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 94%', once: true }
      });
    });
  };

  /* ---------------------------------------------------------
     Work stack
     --------------------------------------------------------- */
  const buildStack = () => {
    if (reduce || window.innerWidth <= 1024) return;
    const cards = $$('.work-card');
    cards.forEach((card, i) => {
      if (i === cards.length - 1) return;
      gsap.to(card, {
        scale: 0.93,
        yPercent: -3,
        opacity: 0.45,
        filter: 'blur(2px)',
        ease: 'none',
        scrollTrigger: {
          trigger: cards[i + 1],
          start: 'top 88%',
          end: 'top 22%',
          scrub: true
        }
      });
    });
  };

  /* ---------------------------------------------------------
     Hero parallax on scroll
     --------------------------------------------------------- */
  const buildHeroParallax = () => {
    if (reduce) return;
    gsap.to('.hero-copy', {
      yPercent: -14,
      opacity: 0.15,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
    gsap.to('#heroCard', {
      yPercent: -6,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
  };

  /* ---------------------------------------------------------
     Capabilities accordion
     --------------------------------------------------------- */
  $$('[data-cap]').forEach(cap => {
    const row = $('.cap-row', cap);
    const body = $('.cap-body', cap);
    if (!row || !body) return;

    const setOpen = open => {
      cap.classList.toggle('open', open);
      if (open) {
        gsap.to(body, { height: 'auto', opacity: 1, duration: 0.55, ease: 'power3.out' });
      } else {
        gsap.to(body, { height: 0, opacity: 0, duration: 0.45, ease: 'power3.inOut' });
      }
    };

    row.addEventListener('click', () => setOpen(!cap.classList.contains('open')));
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-expanded', 'false');
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
    });
    row.addEventListener('click', () => {
      row.setAttribute('aria-expanded', cap.classList.contains('open') ? 'true' : 'false');
    });
  });

  /* ---------------------------------------------------------
     Copy email
     --------------------------------------------------------- */
  const copyBtn = $('[data-copy]');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const text = copyBtn.getAttribute('data-copy');
      const label = $('span', copyBtn);
      try {
        await navigator.clipboard.writeText(text);
        const old = label.textContent;
        label.textContent = 'Copied ✓';
        setTimeout(() => { label.textContent = old; }, 1800);
      } catch {
        label.textContent = 'Press ⌘C';
      }
    });
  }

  /* ---------------------------------------------------------
     Loader → hero entrance
     --------------------------------------------------------- */
  const heroLines = $$('.hero-title .line > span');
  const heroBits = $$('.eyebrow, .hero-sub, .hero-cta, .hero-card, .hero-chip, .hero-foot');

  const heroEntrance = () => {
    if (reduce) {
      gsap.set([heroLines, heroBits], { clearProps: 'all' });
      return;
    }
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from(heroLines, { yPercent: 115, duration: 1.15, stagger: 0.1 }, 0)
      .from('.eyebrow', { y: 16, opacity: 0, duration: 0.8 }, 0.15)
      .from('.hero-sub', { y: 18, opacity: 0, duration: 0.9 }, 0.45)
      .from('.hero-cta > *', { y: 18, opacity: 0, duration: 0.8, stagger: 0.08 }, 0.55)
      .from('.hero-card', { y: 40, opacity: 0, duration: 1.2 }, 0.35)
      .from('.hero-chip', { y: 14, opacity: 0, duration: 0.8, stagger: 0.1 }, 0.85)
      .from('.hero-foot', { opacity: 0, duration: 0.8 }, 0.9);
  };

  const boot = () => {
    runCounters();
    buildReveals();
    buildStack();
    buildHeroParallax();
    heroEntrance();
    ScrollTrigger.refresh();
  };

  const loader = $('#loader');
  const barEl = $('#loaderBar');
  const numEl = $('#loaderNum');

  if (!loader || reduce) {
    if (loader) loader.classList.add('done');
    boot();
  } else {
    document.body.style.overflow = 'hidden';
    const counter = { v: 0 };
    gsap.to(counter, {
      v: 100,
      duration: 1.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        const v = Math.round(counter.v);
        numEl.textContent = v;
        barEl.style.width = v + '%';
      },
      onComplete: () => {
        loader.classList.add('done');
        document.body.style.overflow = '';
        setTimeout(boot, 120);
        if (lenis) lenis.start();
      }
    });
    if (lenis) lenis.stop();
  }

  /* ---------------------------------------------------------
     Active nav link
     --------------------------------------------------------- */
  ['work', 'about', 'experience'].forEach(id => {
    const sec = document.getElementById(id);
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 45%',
      end: 'bottom 45%',
      onToggle: self => {
        const link = $(`.nav-links a[href="#${id}"]`);
        if (link) link.classList.toggle('active', self.isActive);
      }
    });
  });

  /* ---------------------------------------------------------
     Refresh on load / fonts
     --------------------------------------------------------- */
  window.addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
})();
