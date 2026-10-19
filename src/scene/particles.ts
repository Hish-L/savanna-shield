import * as THREE from 'three';

interface Spawn {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.ColorRepresentation;
  life: number;
  size: number;
  grow?: number;
  alpha?: number;
  /** Upward acceleration; negative falls. */
  lift?: number;
}

const vertexShader = /* glsl */ `
  attribute vec3 pColor;
  attribute float pAlpha;
  attribute float pSize;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = pColor;
    vAlpha = pAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = pSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.1, d) * vAlpha);
  }`;

/** A fixed-size pool of soft round particles (dust, smoke, fire, sparks). */
export class ParticlePool {
  readonly points: THREE.Points;
  private readonly position: THREE.BufferAttribute;
  private readonly color: THREE.BufferAttribute;
  private readonly alpha: THREE.BufferAttribute;
  private readonly size: THREE.BufferAttribute;
  private readonly state: { vel: THREE.Vector3; life: number; maxLife: number; size: number; grow: number; alpha: number; lift: number }[];
  private cursor = 0;

  constructor(max: number, additive: boolean) {
    const geometry = new THREE.BufferGeometry();
    this.position = new THREE.BufferAttribute(new Float32Array(max * 3).fill(-999), 3);
    this.color = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    this.alpha = new THREE.BufferAttribute(new Float32Array(max), 1);
    this.size = new THREE.BufferAttribute(new Float32Array(max), 1);
    for (const attr of [this.position, this.color, this.alpha, this.size]) attr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.position);
    geometry.setAttribute('pColor', this.color);
    geometry.setAttribute('pAlpha', this.alpha);
    geometry.setAttribute('pSize', this.size);
    this.points = new THREE.Points(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uScale: { value: 300 * Math.min(window.devicePixelRatio, 2) } },
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
    );
    this.points.frustumCulled = false;
    this.state = Array.from({ length: max }, () => ({ vel: new THREE.Vector3(), life: 0, maxLife: 1, size: 1, grow: 0, alpha: 1, lift: 0 }));
  }

  spawn(p: Spawn): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.state.length;
    const s = this.state[i];
    s.vel.copy(p.velocity);
    s.life = s.maxLife = p.life;
    s.size = p.size;
    s.grow = p.grow ?? 0;
    s.alpha = p.alpha ?? 1;
    s.lift = p.lift ?? 0;
    this.position.setXYZ(i, p.position.x, p.position.y, p.position.z);
    const c = new THREE.Color(p.color);
    this.color.setXYZ(i, c.r, c.g, c.b);
  }

  update(dt: number): void {
    for (let i = 0; i < this.state.length; i++) {
      const s = this.state[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        this.alpha.setX(i, 0);
        continue;
      }
      s.vel.y += s.lift * dt;
      s.vel.multiplyScalar(1 - dt * 0.8);
      this.position.setXYZ(i, this.position.getX(i) + s.vel.x * dt, this.position.getY(i) + s.vel.y * dt, this.position.getZ(i) + s.vel.z * dt);
      const t = s.life / s.maxLife;
      this.alpha.setX(i, s.alpha * Math.min(1, t * 2.5));
      this.size.setX(i, s.size * (1 + s.grow * (1 - t)));
    }
    this.position.needsUpdate = this.alpha.needsUpdate = this.size.needsUpdate = this.color.needsUpdate = true;
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Effects {
  readonly group = new THREE.Group();
  private readonly soft = new ParticlePool(1500, false);
  private readonly glow = new ParticlePool(1200, true);
  private readonly fires: { at: THREE.Vector3; until: number; light: THREE.PointLight }[] = [];
  private time = 0;

  constructor() {
    this.group.add(this.soft.points, this.glow.points);
  }

  dust(at: THREE.Vector3, count = 40): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = rand(2, 6);
      this.soft.spawn({
        position: at.clone().add(new THREE.Vector3(rand(-1, 1), 0.3, rand(-1, 1))),
        velocity: new THREE.Vector3(Math.cos(a) * speed, rand(1, 3), Math.sin(a) * speed),
        color: Math.random() > 0.5 ? '#c9a46a' : '#a88a5a',
        life: rand(1, 1.8),
        size: rand(1.2, 2),
        grow: 2,
        alpha: 0.7,
        lift: -1.5,
      });
    }
  }

  sparks(at: THREE.Vector3, color: THREE.ColorRepresentation, count = 60): void {
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).normalize().multiplyScalar(rand(4, 9));
      this.glow.spawn({ position: at.clone().setY(at.y + 1.2), velocity: dir, color, life: rand(0.5, 1), size: rand(0.5, 0.9), lift: -6 });
    }
  }

  splash(at: THREE.Vector3): void {
    for (let i = 0; i < 50; i++) {
      const a = Math.random() * Math.PI * 2;
      this.soft.spawn({
        position: at.clone(),
        velocity: new THREE.Vector3(Math.cos(a) * rand(1, 3), rand(3, 6), Math.sin(a) * rand(1, 3)),
        color: '#cfe8f2',
        life: rand(0.6, 1),
        size: rand(0.5, 0.9),
        alpha: 0.85,
        lift: -12,
      });
    }
  }

  burn(at: THREE.Vector3, seconds = 7): void {
    const light = new THREE.PointLight('#ff7a2a', 0, 30, 1.5);
    light.position.copy(at).setY(at.y + 2);
    this.group.add(light);
    this.fires.push({ at: at.clone(), until: this.time + seconds, light });
  }

  clear(): void {
    for (const f of this.fires) this.group.remove(f.light);
    this.fires.length = 0;
  }

  update(dt: number): void {
    this.time += dt;
    for (const f of [...this.fires]) {
      if (this.time > f.until) {
        this.group.remove(f.light);
        this.fires.splice(this.fires.indexOf(f), 1);
        continue;
      }
      f.light.intensity = 60 + Math.sin(this.time * 23) * 15 + Math.random() * 20;
      for (let i = 0; i < 3; i++) {
        this.glow.spawn({
          position: f.at.clone().add(new THREE.Vector3(rand(-1.2, 1.2), rand(0.5, 2.5), rand(-1.2, 1.2))),
          velocity: new THREE.Vector3(rand(-0.4, 0.4), rand(2, 4), rand(-0.4, 0.4)),
          color: Math.random() > 0.4 ? '#ff6a1a' : '#ffc23a',
          life: rand(0.5, 0.9),
          size: rand(1.4, 2.2),
          grow: -0.6,
        });
      }
      this.soft.spawn({
        position: f.at.clone().add(new THREE.Vector3(rand(-1, 1), 3, rand(-1, 1))),
        velocity: new THREE.Vector3(rand(-0.3, 0.3), rand(1.5, 2.5), rand(-0.3, 0.3)),
        color: '#3a3330',
        life: rand(2.5, 3.5),
        size: 2.5,
        grow: 3,
        alpha: 0.45,
        lift: 0.3,
      });
    }
    this.soft.update(dt);
    this.glow.update(dt);
  }
}
