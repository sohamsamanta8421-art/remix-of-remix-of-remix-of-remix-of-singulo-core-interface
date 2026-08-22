import * as THREE from "three";
import type { AiState } from "@/types/singulo";
import {
  damp,
  followTargets,
  recenterTargets,
  viewError,
  type ViewTargets,
} from "./motion";

export interface CoreOptions {
  intensity: number;
  particleDensity: number;
  animationIntensity: number;
  reducedMotion: boolean;
  theme?: "ember" | "blue";
}

/**
 * State look-up: every AI state maps to an energy / spin / hue-shift profile.
 * Hue shift 0 = deep red, 1 = bright golden yellow.
 */
const STATE_LOOK: Record<AiState, { hue: number; spin: number; energy: number }> = {
  idle: { hue: 0.22, spin: 0.08, energy: 0.3 },
  listening: { hue: 0.55, spin: 0.24, energy: 0.6 },
  thinking: { hue: 0.42, spin: 0.95, energy: 0.8 },
  speaking: { hue: 0.78, spin: 0.28, energy: 0.9 },
  executing: { hue: 0.68, spin: 0.7, energy: 0.85 },
  error: { hue: 0.02, spin: 0.05, energy: 0.55 },
};


const BANDS = 12;

/**
 * SinguloCoreEngine — a living red/gold particle consciousness core.
 *
 * Everything is one GPU particle field (shell + ribbon + floaters) driven by a
 * single vertex shader, plus an additive atmospheric glow sprite. Voice
 * amplitude, per-band "frequency" energy, AI state and pointer/gesture input
 * all feed uniforms — no CPU per-particle work, so it stays at 60 FPS.
 */
export class SinguloCoreEngine {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  private root = new THREE.Group();
  private field!: THREE.Points;
  private lattice!: THREE.LineSegments;
  private nodes!: THREE.Points;
  private glow!: THREE.Mesh;
  private reticle!: THREE.Mesh;
  private clock = new THREE.Clock();
  private raf = 0;
  private options: CoreOptions;
  private disposed = false;

  private state: AiState = "idle";
  private hue = STATE_LOOK.idle.hue;
  private targetHue = STATE_LOOK.idle.hue;
  private energy = 0.3;
  private targetEnergy = 0.3;
  private spin = 0.08;
  private targetSpin = 0.08;

  private zoom = 1;
  private targetZoom = 1;
  private rotation = { x: -0.1, y: 0 };
  private targetRotation = { x: -0.1, y: 0 };
  private pan = { x: 0, y: 0 };
  private targetPan = { x: 0, y: 0 };
  private pulse = 0;
  private grabbed = false;
  private calm = false;
  private levels = { mic: 0, speech: 0 };
  private audio = 0;
  private bands = new Float32Array(BANDS);
  private pointer: { x: number; y: number } | null = null;
  private parallax = { x: 0, y: 0 };
  private swipeField = { x: 0, y: 0 };
  private fps = 60;
  /** Timestamp of the last user manipulation — drives auto-recentering. */
  private lastInput = 0;
  /** Profiling counters (read by the perf overlay). */
  private recentering = false;
  private settleError = 0;
  private frameMs = 16.7;
  private loopMs = 0;
  private inputLatencyMs = 0;

  /** Lightweight profiling snapshot for the perf overlay. */
  getMetrics() {
    return {
      fps: this.fps,
      frameMs: this.frameMs,
      loopMs: this.loopMs,
      inputLatencyMs: this.inputLatencyMs,
      settleError: this.settleError,
      recentering: this.recentering,
      zoom: this.zoom,
      pan: { x: this.pan.x, y: this.pan.y },
      rotation: { x: this.rotation.x, y: this.rotation.y },
    };
  }

  constructor(options: CoreOptions) {
    this.options = options;
  }

  mount(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.camera.position.set(0, 0, 9.2);
    this.scene.add(this.root);
    this.build();
    this.resize();
    this.clock.start();
    this.loop();
  }

  private build() {
    const density = THREE.MathUtils.clamp(this.options.particleDensity || 1, 0.2, 2);
    const count = Math.round(THREE.MathUtils.clamp(38000 * density, 8000, 90000));

    const position = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const layer = new Float32Array(count);
    const band = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      // 0 = outer shell, 1 = inner flowing ribbon, 2 = perimeter floaters
      const l = roll < 0.62 ? 0 : roll < 0.9 ? 1 : 2;
      let x: number;
      let y: number;
      let z: number;

      if (l === 1) {
        // Ribbon: thin torus-ish belt with random tilt, gives the flowing wave layer.
        const a = Math.random() * Math.PI * 2;
        const tilt = (Math.random() - 0.5) * 0.9;
        const r = 1.45 + Math.random() * 0.5;
        x = Math.cos(a) * r;
        y = Math.sin(a) * r * Math.cos(tilt);
        z = Math.sin(a) * r * Math.sin(tilt) + (Math.random() - 0.5) * 0.25;
      } else {
        // Shell: fibonacci-ish spherical distribution, thin skin for a clean centre.
        const u = Math.random() * 2 - 1;
        const phi = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        const r = l === 2 ? 2.35 + Math.random() * 0.85 : 1.9 + Math.random() * 0.16;
        x = Math.cos(phi) * s * r;
        y = u * r;
        z = Math.sin(phi) * s * r;
      }

      position[i * 3] = x;
      position[i * 3 + 1] = y;
      position[i * 3 + 2] = z;
      seed[i] = Math.random();
      layer[i] = l;
      band[i] = Math.floor(((Math.atan2(y, x) + Math.PI) / (Math.PI * 2)) * BANDS) % BANDS;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geometry.setAttribute("aLayer", new THREE.BufferAttribute(layer, 1));
    geometry.setAttribute("aBand", new THREE.BufferAttribute(band, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 0.3 },
        uAudio: { value: 0 },
        uHue: { value: 0.22 },
        uPulse: { value: 0 },
        uSize: { value: 0.55 },
        uTheme: { value: this.options.theme === "blue" ? 1 : 0 },
        uPointer: { value: new THREE.Vector3(0, 0, 0) },
        uPointerOn: { value: 0 },
        uBands: { value: Array.from({ length: BANDS }, () => 0) },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        attribute float aLayer;
        attribute float aBand;
        uniform float uTime;
        uniform float uEnergy;
        uniform float uAudio;
        uniform float uPulse;
        uniform float uSize;
        uniform vec3 uPointer;
        uniform float uPointerOn;
        uniform float uBands[${BANDS}];
        varying float vHeat;
        varying float vFade;

        // cheap value noise
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
        float noise(vec3 p){
          vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
          float n = mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                            mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                        mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                            mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
          return n * 2.0 - 1.0;
        }

        void main() {
          vec3 p = position;
          float r = length(p);
          vec3 dir = p / max(r, 0.0001);

          float bandE = uBands[int(mod(aBand, ${BANDS}.0))];
          float t = uTime;

          // organic surface deformation — travelling waves around the sphere
          float wave = noise(dir * 2.1 + vec3(0.0, 0.0, t * 0.35));
          float ripple = sin(atan(p.y, p.x) * 5.0 - t * 2.2 + aSeed * 2.0);
          float breathe = sin(t * 0.9 + aSeed * 0.6) * 0.02;

          float push = wave * (0.12 + uEnergy * 0.22)
                     + ripple * bandE * 0.34
                     + uAudio * 0.28
                     + uPulse * 0.22
                     + breathe;

          if (aLayer > 1.5) {
            // floaters drift freely around the perimeter
            p += vec3(
              noise(dir * 1.3 + vec3(t * 0.12, 0.0, 0.0)),
              noise(dir * 1.3 + vec3(0.0, t * 0.14, 0.0)),
              noise(dir * 1.3 + vec3(0.0, 0.0, t * 0.11))
            ) * (0.35 + uEnergy * 0.35);
            push *= 0.6;
          } else if (aLayer > 0.5) {
            // ribbon streams around the belt
            float a = atan(p.z, p.x) + t * (0.25 + uEnergy * 0.7);
            float rr = length(p.xz);
            p.x = cos(a) * rr;
            p.z = sin(a) * rr;
            p.y += sin(a * 3.0 + t * 1.6) * (0.09 + uAudio * 0.4);
          }

          p += dir * push;

          // pointer / hand attraction — nearby particles lean toward the hand
          if (uPointerOn > 0.5) {
            vec3 d = uPointer - p;
            float dist = length(d);
            p += normalize(d + 0.0001) * exp(-dist * 1.6) * 0.45 * uPointerOn;
          }

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;

          vHeat = clamp(0.18 + uEnergy * 0.5 + uAudio * 0.8 + bandE * 0.8
                        + max(push, 0.0) * 1.4 + aSeed * 0.14, 0.0, 1.0);
          vFade = (aLayer > 1.5 ? 0.35 : 0.62) * (0.35 + aSeed * 0.65);
          gl_PointSize = uSize * (0.65 + uEnergy * 0.4 + uAudio * 0.6) * (14.0 / -mv.z)
                         * (aLayer > 1.5 ? 0.8 : 1.0);

        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uHue;
        uniform float uTheme;
        varying float vHeat;
        varying float vFade;

        vec3 ember(float h) {
          // deep red -> crimson -> orange -> golden -> bright yellow-white
          vec3 c1 = vec3(0.35, 0.02, 0.02);
          vec3 c2 = vec3(0.78, 0.08, 0.06);
          vec3 c3 = vec3(1.00, 0.35, 0.05);
          vec3 c4 = vec3(1.00, 0.72, 0.13);
          vec3 c5 = vec3(1.00, 0.96, 0.72);
          if (h < 0.25) return mix(c1, c2, h / 0.25);
          if (h < 0.5)  return mix(c2, c3, (h - 0.25) / 0.25);
          if (h < 0.78) return mix(c3, c4, (h - 0.5) / 0.28);
          return mix(c4, c5, (h - 0.78) / 0.22);
        }

        vec3 spectra(float h) {
          // indigo -> azure -> cyan -> teal-white, with a warm accent at the top
          vec3 c1 = vec3(0.06, 0.10, 0.40);
          vec3 c2 = vec3(0.10, 0.35, 0.85);
          vec3 c3 = vec3(0.20, 0.72, 1.00);
          vec3 c4 = vec3(0.55, 0.95, 1.00);
          vec3 c5 = vec3(1.00, 0.85, 0.55);
          if (h < 0.25) return mix(c1, c2, h / 0.25);
          if (h < 0.5)  return mix(c2, c3, (h - 0.25) / 0.25);
          if (h < 0.82) return mix(c3, c4, (h - 0.5) / 0.32);
          return mix(c4, c5, (h - 0.82) / 0.18);
        }

        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float rr = dot(d, d);
          if (rr > 0.25) discard;
          float falloff = smoothstep(0.25, 0.0, rr);
          float heat = clamp(0.28 + vHeat * 0.85 + uHue * 0.45, 0.0, 1.0);
          vec3 tint = mix(ember(heat), spectra(heat), uTheme);
          gl_FragColor = vec4(tint * 1.15, falloff * vFade);
        }
      `,
    });

    this.field = new THREE.Points(geometry, material);
    this.root.add(this.field);

    // Triangulated node lattice — the wireframe globe: edges plus a bright dot
    // on every vertex, breathing with the core energy.
    const sphere = new THREE.IcosahedronGeometry(2.02, 5);
    const lattice = new THREE.LineSegments(
      new THREE.WireframeGeometry(sphere),
      new THREE.LineBasicMaterial({
        color: this.latticeColor(),
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.lattice = lattice;
    this.root.add(lattice);

    const nodes = new THREE.Points(
      sphere,
      new THREE.PointsMaterial({
        color: this.nodeColor(),
        size: 0.05,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.nodes = nodes;
    this.root.add(nodes);


    // Atmospheric glow behind the sphere.
    this.glow = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 13),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uEnergy: { value: 0.3 },
          uHue: { value: 0.22 },
          uTime: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform float uEnergy; uniform float uHue; uniform float uTime;
          varying vec2 vUv;
          void main(){
            float d = length(vUv - 0.5) * 2.0;
            float ring = smoothstep(0.62, 0.30, d) * 0.5 + smoothstep(1.0, 0.34, d) * 0.35;
            vec3 warm = mix(vec3(0.55,0.05,0.03), vec3(1.0,0.55,0.10), clamp(uHue + uEnergy * 0.4, 0.0, 1.0));
            float breathe = 0.85 + 0.15 * sin(uTime * 1.1);
            gl_FragColor = vec4(warm, ring * (0.1 + uEnergy * 0.18) * breathe);
          }
        `,
      }),
    );
    this.glow.position.z = -1.6;
    this.scene.add(this.glow);

    // Gesture / cursor reticle.
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.11, 40),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#ffb347"),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    this.scene.add(this.reticle);
  }

  private latticeColor() {
    return new THREE.Color(this.options.theme === "blue" ? "#5aa9ff" : "#ff8a3d");
  }

  private nodeColor() {
    return new THREE.Color(this.options.theme === "blue" ? "#bfe4ff" : "#ffd27a");
  }

  setOptions(options: CoreOptions) {
    const themeChanged = options.theme !== this.options.theme;
    this.options = options;
    if (!themeChanged || !this.lattice) return;
    (this.lattice.material as THREE.LineBasicMaterial).color.copy(this.latticeColor());
    (this.nodes.material as THREE.PointsMaterial).color.copy(this.nodeColor());
    const uniforms = (this.field.material as THREE.ShaderMaterial).uniforms;
    uniforms["uTheme"]!.value = options.theme === "blue" ? 1 : 0;
  }

  setState(state: AiState) {
    if (state === this.state) return;
    this.state = state;
    const look = STATE_LOOK[state];
    this.targetHue = look.hue;
    this.targetSpin = look.spin;
    this.targetEnergy = look.energy;
    this.pulse = Math.min(1.4, this.pulse + 0.7);
  }

  setLevels(mic: number, speech: number) {
    this.levels = { mic, speech };
  }

  // ---- command API (pointer, wheel, gesture router) ----
  private touch() {
    this.lastInput = performance.now();
  }
  zoomBy(delta: number) {
    this.touch();
    this.targetZoom = THREE.MathUtils.clamp(this.targetZoom * Math.exp(delta * 1.5), 0.45, 3.2);
  }
  setZoom(normalised: number) {
    this.touch();
    this.targetZoom = THREE.MathUtils.clamp(0.55 + normalised * 2.2, 0.45, 3.2);
  }
  rotateBy(dx: number, dy: number) {
    this.touch();
    this.targetRotation.y += dx * Math.PI * 1.6;
    this.targetRotation.x = THREE.MathUtils.clamp(
      this.targetRotation.x + dy * Math.PI * 1.6,
      -1.1,
      1.1,
    );
  }
  panBy(dx: number, dy: number) {
    this.touch();
    this.targetPan.x = THREE.MathUtils.clamp(this.targetPan.x + dx * 4, -2.5, 2.5);
    this.targetPan.y = THREE.MathUtils.clamp(this.targetPan.y - dy * 4, -2, 2);
  }
  reset() {
    this.touch();
    this.targetZoom = 1;
    this.targetRotation = { x: -0.1, y: 0 };
    this.targetPan = { x: 0, y: 0 };
    this.swipeField = { x: 0, y: 0 };
  }
  emitPulse(strength = 1) {
    this.pulse = Math.min(2, this.pulse + strength);
  }
  setCalm(on: boolean) {
    this.calm = on;
  }
  setGrabbed(on: boolean) {
    this.grabbed = on;
  }
  setPointer(position: { x: number; y: number } | null) {
    this.pointer = position;
  }
  pushField(direction: "LEFT" | "RIGHT" | "UP" | "DOWN") {
    const map = {
      LEFT: { x: -1, y: 0 },
      RIGHT: { x: 1, y: 0 },
      UP: { x: 0, y: 1 },
      DOWN: { x: 0, y: -1 },
    } as const;
    this.swipeField = map[direction];
    this.emitPulse(0.6);
  }

  resize() {
    const renderer = this.renderer;
    if (!renderer) return;
    const canvas = renderer.domElement;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth || canvas.clientWidth || 1;
    const height = parent?.clientHeight || canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.fps < 45 ? 1 : 2));
    renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed || !this.renderer) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.elapsedTime;
    this.fps = damp(this.fps, 1 / Math.max(dt, 0.0001), 1.5, dt);
    const motion = this.options.reducedMotion ? 0.25 : this.options.animationIntensity;

    const raw = Math.max(this.levels.mic, this.levels.speech);
    this.audio = damp(this.audio, raw, raw > this.audio ? 14 : 5, dt);

    // pseudo frequency bands: smoothed, phase-offset envelopes around the rim
    for (let i = 0; i < BANDS; i++) {
      const target =
        this.audio *
        (0.35 + 0.65 * Math.abs(Math.sin(time * (0.9 + i * 0.21) + i * 1.7)));
      this.bands[i] = damp(this.bands[i]!, target, 9, dt);
    }

    this.hue = damp(this.hue, this.targetHue, 4, dt);
    const energyTarget =
      (this.calm ? this.targetEnergy * 0.45 : this.targetEnergy) +
      this.audio * 0.6 +
      this.pulse * 0.4;
    this.energy = damp(this.energy, energyTarget, 5, dt);
    this.spin = damp(this.spin, this.calm ? this.targetSpin * 0.3 : this.targetSpin, 3, dt);
    this.pulse = damp(this.pulse, 0, 3.2, dt);
    // Auto-recenter: drift view targets back to rest ~1.2s after the last input.
    const targets: ViewTargets = {
      zoom: this.targetZoom,
      rotation: this.targetRotation,
      pan: this.targetPan,
    };
    this.recentering = recenterTargets(targets, dt, performance.now() - this.lastInput);
    this.targetZoom = targets.zoom;
    const view: ViewTargets = { zoom: this.zoom, rotation: this.rotation, pan: this.pan };
    followTargets(view, targets, dt);
    this.zoom = view.zoom;
    this.settleError = viewError(view, targets);
    this.swipeField.x = damp(this.swipeField.x, 0, 2.5, dt);
    this.swipeField.y = damp(this.swipeField.y, 0, 2.5, dt);

    const px = this.pointer ? this.pointer.x * 2 - 1 : 0;
    const py = this.pointer ? -(this.pointer.y * 2 - 1) : 0;
    this.parallax.x = damp(this.parallax.x, px, 4, dt);
    this.parallax.y = damp(this.parallax.y, py, 4, dt);

    const breathe = 1 + Math.sin(time * 1.05) * 0.022 * motion;
    const scale =
      this.zoom * breathe * (1 + this.pulse * 0.07 + this.audio * 0.1) * (this.grabbed ? 0.94 : 1);
    this.root.scale.setScalar(scale);
    this.root.position.set(
      this.pan.x + this.swipeField.x * 0.5,
      this.pan.y + this.swipeField.y * 0.5,
      0,
    );
    this.root.rotation.x =
      this.rotation.x + this.parallax.y * 0.12 + Math.sin(time * 0.28) * 0.03 * motion;
    this.root.rotation.y =
      this.rotation.y + this.parallax.x * 0.16 + time * this.spin * motion * 0.45;
    this.root.rotation.z = Math.sin(time * 0.17) * 0.05 * motion;

    const uniforms = (this.field.material as THREE.ShaderMaterial).uniforms;
    uniforms['uTime']!.value = time * (0.7 + motion * 0.6);
    uniforms['uEnergy']!.value = this.energy * this.options.intensity;
    uniforms['uAudio']!.value = this.audio;
    uniforms['uHue']!.value = this.hue;
    uniforms['uPulse']!.value = this.pulse;
    (uniforms['uBands']!.value as number[]).forEach((_, i) => {
      (uniforms['uBands']!.value as number[])[i] = this.bands[i]!;
    });

    const glowUniforms = (this.glow.material as THREE.ShaderMaterial).uniforms;
    glowUniforms['uEnergy']!.value = this.energy;
    glowUniforms['uHue']!.value = this.hue;
    glowUniforms['uTime']!.value = time;
    this.glow.scale.setScalar(0.9 + this.zoom * 0.25 + this.audio * 0.12);

    const reticleMaterial = this.reticle.material as THREE.MeshBasicMaterial;
    if (this.pointer) {
      const vector = new THREE.Vector3(px, py, 0.5);
      vector.unproject(this.camera);
      const dir = vector.sub(this.camera.position).normalize();
      const distance = -this.camera.position.z / dir.z;
      this.reticle.position.copy(this.camera.position).add(dir.multiplyScalar(distance));
      reticleMaterial.opacity = damp(reticleMaterial.opacity, 0.85, 8, dt);
      this.reticle.rotation.z = time * 1.4;
      uniforms['uPointerOn']!.value = damp(uniforms['uPointerOn']!.value as number, 1, 6, dt);
      (uniforms['uPointer']!.value as THREE.Vector3).set(
        this.reticle.position.x / scale,
        this.reticle.position.y / scale,
        0.6,
      );
    } else {
      reticleMaterial.opacity = damp(reticleMaterial.opacity, 0, 8, dt);
      uniforms['uPointerOn']!.value = damp(uniforms['uPointerOn']!.value as number, 0, 6, dt);
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    this.renderer?.dispose();
    this.renderer = null;
  }
}
