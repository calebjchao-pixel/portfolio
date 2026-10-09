// Infinite depth gallery (port of the 3d-gallery-photography component, without React).
// Photos drift toward the viewer on their own: they sharpen and fade in from the distance,
// then blur and fade out before reaching the camera. There is no wheel, key or hover control.
// After RUN seconds of play the animation fades out and the photo carousel underneath fades
// in (.ig-done). Without WebGL, without three.js, with reduced motion, or if a photo fails
// to load, the carousel simply shows from the start.
(() => {
  const stage = document.querySelector('.ig');
  if (!stage || !window.THREE) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return;

  const sources = [...stage.querySelectorAll('.car-slide img')].map(i => i.getAttribute('src'));
  if (!sources.length) return;

  const VISIBLE = 12;            // planes in flight
  const DEPTH = 50;              // length of the tunnel the planes travel
  // Speed rises on an ease-in curve over the run: gentle drift at first, rushing past by the hand-over.
  const SPEED_START = 1.5, SPEED_END = 14;   // units per second toward the camera
  const speedAt = t => { const k = Math.min(1, t / RUN); return SPEED_START + (SPEED_END - SPEED_START) * k * k * k; };
  const FORCE = 0.1;             // cloth curve at the starting speed; grows with speed
  // Photos now come close enough to sweep past the screen edges before they fade.
  const FADE_IN = [0.05, 0.25], FADE_OUT = [0.43, 0.47];
  const BLUR_IN = [0.0, 0.10], BLUR_OUT = [0.43, 0.47], MAX_BLUR = 8;
  const MAX_X = 8, MAX_Y = 8;
  const RUN = 12;               // seconds of animation before handing over to the carousel
  const FADE_MS = 1400;         // matches the CSS fade-out of the canvas

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (e) { return; }
  stage.classList.add('ig-js');
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const holder = stage.querySelector('.ig-canvas');
  holder.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 0);

  const vertexShader = `
    uniform float scrollForce;
    uniform float time;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 pos = position;
      float curveIntensity = scrollForce * 0.3;
      float d = length(pos.xy);
      float curve = d * d * curveIntensity;
      float ripple1 = sin(pos.x * 2.0 + time * 0.9) * 0.02;
      float ripple2 = sin(pos.y * 2.5 + time * 0.6) * 0.015;
      float cloth = (ripple1 + ripple2) * abs(curveIntensity) * 2.0;
      pos.z -= (curve + cloth);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }`;
  const fragmentShader = `
    uniform sampler2D map;
    uniform float opacity;
    uniform float blurAmount;
    uniform float scrollForce;
    uniform vec2 texel;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(map, vUv);
      if (blurAmount > 0.0) {
        vec4 sum = vec4(0.0);
        float total = 0.0;
        for (float x = -2.0; x <= 2.0; x += 1.0) {
          for (float y = -2.0; y <= 2.0; y += 1.0) {
            float w = 1.0 / (1.0 + length(vec2(x, y)));
            sum += texture2D(map, vUv + vec2(x, y) * texel * blurAmount) * w;
            total += w;
          }
        }
        color = sum / total;
      }
      color.rgb += vec3(abs(scrollForce) * 0.005);
      gl_FragColor = vec4(color.rgb, color.a * opacity);
    }`;

  const geometry = new THREE.PlaneGeometry(1, 1, 32, 32);
  const loader = new THREE.TextureLoader();
  const textures = new Array(sources.length);
  let loaded = 0, failed = false;

  // Same scattered layout as the component: golden-angle spread on x, offset pattern on y.
  const spots = Array.from({ length: VISIBLE }, (_, i) => {
    const ha = (i * 2.618) % (Math.PI * 2), va = (i * 1.618 + Math.PI / 3) % (Math.PI * 2);
    return { x: Math.sin(ha) * (i % 3) * 1.2 * MAX_X / 3, y: Math.cos(va) * ((i + 1) % 4) * 0.8 * MAX_Y / 4 };
  });

  const planes = spots.map((spot, i) => {
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, vertexShader, fragmentShader,
      uniforms: { map: { value: null }, opacity: { value: 0 }, blurAmount: { value: 0 },
                  scrollForce: { value: FORCE }, time: { value: 0 }, texel: { value: new THREE.Vector2(1e-3, 1e-3) } },
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, material, ...spot, z: (DEPTH / VISIBLE) * i, img: i % sources.length };
  });

  const applyImage = p => {
    const t = textures[p.img];
    if (!t) return;
    p.material.uniforms.map.value = t;
    const w = t.image.width, h = t.image.height, a = w / h;
    p.material.uniforms.texel.value.set(1 / w, 1 / h);
    p.mesh.scale.set(a > 1 ? 2 * a : 2, a > 1 ? 2 : 2 / a, 1);
  };

  const ramp = (n, [a, b]) => (n - a) / (b - a);
  const opacityAt = n => {
    if (n < FADE_IN[0] || n > FADE_OUT[1]) return 0;
    if (n <= FADE_IN[1]) return ramp(n, FADE_IN);
    if (n >= FADE_OUT[0]) return 1 - ramp(n, FADE_OUT);
    return 1;
  };
  const blurAt = n => {
    if (n < BLUR_IN[0] || n > BLUR_OUT[1]) return MAX_BLUR;
    if (n <= BLUR_IN[1]) return MAX_BLUR * (1 - ramp(n, BLUR_IN));
    if (n >= BLUR_OUT[0]) return MAX_BLUR * ramp(n, BLUR_OUT);
    return 0;
  };

  // The canvas covers the whole first screen (from the page top to at least the bottom of the window,
  // or the gallery's bottom if that is lower), so photos fly out to the screen borders. The camera's
  // view is shifted so the vanishing point stays at the centre of the gallery area, and the field of
  // view is widened so the gallery area looks exactly as it would on its own.
  const area = stage.querySelector('.ig-stage');
  const BASE_FOV = 55, tanHalf = Math.tan(BASE_FOV * Math.PI / 360);
  let xSpread = 1;
  const resize = () => {
    const r = area.getBoundingClientRect();
    const top = r.top + scrollY, stageH = r.height || 1;
    const W = document.documentElement.clientWidth || 1;
    const H = Math.max(innerHeight, top + stageH);
    holder.style.top = -top + 'px';
    holder.style.height = H + 'px';
    renderer.setSize(W, H, false);
    const cy = top + stageH / 2;                 // vanishing point, in canvas pixels
    const Hv = 2 * Math.max(cy, H - cy);         // virtual frame centred on it
    camera.fov = 2 * Math.atan(tanHalf * Hv / stageH) * 180 / Math.PI;
    camera.aspect = W / Hv;
    camera.setViewOffset(W, Hv, 0, Hv / 2 - cy, W, H);
    camera.updateProjectionMatrix();
    // Narrow (portrait) screens see less sideways, so pull the scatter in toward the centre.
    xSpread = Math.max(0.4, Math.min(1, (W / stageH) / 1.6));
  };
  new ResizeObserver(resize).observe(stage);
  addEventListener('resize', resize);
  if (document.fonts) document.fonts.ready.then(resize);
  resize();

  const advance = VISIBLE % sources.length || sources.length;
  let last = 0, raf = 0, onScreen = false, played = 0, finishing = false, finished = false;
  const frame = now => {
    const raw = last ? (now - last) / 1000 : 0;
    last = now;
    // The run is timed in real seconds, so slow devices hand over on schedule too; only gaps longer
    // than a quarter second (a backgrounded tab) are skipped. Movement steps are capped a little
    // tighter so a stalled frame never makes the photos jump.
    const dt = Math.min(0.1, raw);
    const time = now / 1000;
    played += Math.min(0.25, raw);
    if (!finishing && played >= RUN) finish();
    const speed = speedAt(played);
    const force = FORCE * Math.min(4, speed / SPEED_START);
    for (const p of planes) {
      p.z += speed * dt;
      if (p.z >= DEPTH) {                       // wrapped past the camera: back to the far end, next photo
        p.z -= DEPTH;
        p.img = (p.img + advance) % sources.length;
        applyImage(p);
      }
      const n = p.z / DEPTH, o = opacityAt(n);
      p.material.uniforms.opacity.value = o;
      p.material.uniforms.blurAmount.value = blurAt(n);
      p.material.uniforms.time.value = time;
      p.material.uniforms.scrollForce.value = force;
      p.mesh.position.set(p.x * xSpread, p.y, p.z - DEPTH / 2);
      p.mesh.visible = o > 0.002 && !!p.material.uniforms.map.value;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf && !finished && loaded === sources.length) { last = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  // Cross-fade to the carousel; keep drawing while the canvas fades, then free the GPU.
  function finish() {
    finishing = true;
    stage.classList.add('ig-done');
    setTimeout(() => {
      finished = true; stop();
      renderer.dispose(); geometry.dispose();
      planes.forEach(p => p.material.dispose());
      textures.forEach(t => t && t.dispose());
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }, FADE_MS);
  }

  // Only animate while the gallery is on screen and the tab is visible.
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; onScreen ? start() : stop(); }).observe(stage);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : onScreen && start()));

  sources.forEach((src, i) => loader.load(src, t => {
    textures[i] = t;
    if (++loaded === sources.length && !failed) {
      planes.forEach(applyImage);
      stage.classList.add('ig-on');
      if (onScreen) start();
    }
  }, undefined, () => {                          // a photo failed: give the page back its plain grid
    failed = true; stop();
    stage.classList.remove('ig-js', 'ig-on');
    renderer.domElement.remove();
  }));
})();
