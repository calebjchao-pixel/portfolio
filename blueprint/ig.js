// Infinite depth gallery (port of the 3d-gallery-photography component, without React).
// Photos drift toward the viewer on their own: they sharpen and fade in from the distance,
// then blur and fade out before reaching the camera, and loop forever. There is no wheel,
// key or hover control. Without WebGL, without three.js, or with reduced motion, the plain
// photo grid inside .ig stays visible instead.
(() => {
  const stage = document.querySelector('.ig');
  if (!stage || !window.THREE) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return;

  const sources = [...stage.querySelectorAll('.ig-fallback img')].map(i => i.getAttribute('src'));
  if (!sources.length) return;

  const VISIBLE = 12;            // planes in flight
  const DEPTH = 50;              // length of the tunnel the planes travel
  const SPEED = 1.5;             // units per second toward the camera
  const FORCE = 0.1;             // steady cloth curve (the component's auto-play velocity)
  const FADE_IN = [0.05, 0.25], FADE_OUT = [0.40, 0.43];
  const BLUR_IN = [0.0, 0.10], BLUR_OUT = [0.40, 0.43], MAX_BLUR = 8;
  const MAX_X = 8, MAX_Y = 8;

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

  // Narrow (portrait) screens see less sideways, so pull the scatter in toward the centre.
  let xSpread = 1;
  const resize = () => {
    const w = holder.clientWidth || 1, h = holder.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    xSpread = Math.max(0.4, Math.min(1, camera.aspect / 1.6));
  };
  new ResizeObserver(resize).observe(holder);
  resize();

  const advance = VISIBLE % sources.length || sources.length;
  let last = 0, raf = 0, onScreen = false;
  const frame = now => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    const time = now / 1000;
    for (const p of planes) {
      p.z += SPEED * dt;
      if (p.z >= DEPTH) {                       // wrapped past the camera: back to the far end, next photo
        p.z -= DEPTH;
        p.img = (p.img + advance) % sources.length;
        applyImage(p);
      }
      const n = p.z / DEPTH, o = opacityAt(n);
      p.material.uniforms.opacity.value = o;
      p.material.uniforms.blurAmount.value = blurAt(n);
      p.material.uniforms.time.value = time;
      p.mesh.position.set(p.x * xSpread, p.y, p.z - DEPTH / 2);
      p.mesh.visible = o > 0.002 && !!p.material.uniforms.map.value;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf && loaded === sources.length) { last = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

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
