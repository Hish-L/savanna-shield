import * as THREE from 'three';
import { drawLogo } from '../brand';
import { box, canvasTexture, damp, polar } from './util';

// Easter egg: a Westpac Life Saver Rescue Helicopter in its classic red and yellow livery.
// Every minute or so it flies in from the horizon, circles over the reserve, then heads off.
const FIRST_VISIT = 12;
const VISIT_GAP = [45, 75];
const ORBIT_SECONDS = 20;
const ORBIT_RADIUS = 27;
const ORBIT_HEIGHT = 17;
const HORIZON = 180;

type Phase = 'away' | 'arrive' | 'orbit' | 'leave';

const BANNER_LENGTH = 11;
const BANNER_HEIGHT = 1.9;

function bannerTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = Math.round((width * BANNER_HEIGHT) / BANNER_LENGTH);
  return canvasTexture(
    width,
    (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      // Faint seams where the fabric panels are sewn together.
      ctx.fillStyle = 'rgba(31, 28, 79, 0.07)';
      for (let x = width / 8; x < width; x += width / 8) ctx.fillRect(x - 1, 0, 2, height);
      ctx.fillStyle = '#da1710';
      ctx.fillRect(0, 0, width, 12);
      ctx.fillRect(0, height - 12, width, 12);
      ctx.font = '900 104px "Avenir Next", "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1f1c4f';
      ctx.fillText('Security is job zero', width / 2, height / 2 + 4, width - 60);
    },
    height,
  );
}

/** A straight line of rope (or a pole) from `a` to `b`. */
function rope(a: THREE.Vector3, b: THREE.Vector3, material: THREE.Material, radius = 0.015): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 4), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return mesh;
}

function livery(): THREE.CanvasTexture {
  // A white pill with the logo, "WESTPAC" and a big "RESCUE", so it pops off the red cabin.
  // 1024 x 284 roughly matches the shape of the cabin patch it wraps onto.
  const width = 1024;
  const height = 284;
  return canvasTexture(
    width,
    (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1f1c4f';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.roundRect(10, 10, width - 20, height - 20, (height - 20) / 2);
      ctx.fill();
      ctx.stroke();
      drawLogo(ctx, 80, 82, 290);
      const font = '"Avenir Next", "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#da1710';
      ctx.font = `900 92px ${font}`;
      ctx.fillText('WESTPAC', 680, 92, 540);
      ctx.fillStyle = '#1f1c4f';
      ctx.font = `900 124px ${font}`;
      ctx.fillText('RESCUE', 680, 192, 540);
    },
    height,
  );
}

export class Helicopter {
  readonly group = new THREE.Group();
  private readonly rotor = new THREE.Group();
  private readonly tailRotor = new THREE.Group();
  private readonly banner = new THREE.Group();
  /** The banner's two fabric panels, with their flat rest positions to ripple from. */
  private readonly cloth: { geometry: THREE.BufferGeometry; rest: Float32Array }[] = [];
  private readonly beacon = new THREE.MeshStandardMaterial({ color: '#330000', emissive: '#ff2020', emissiveIntensity: 0 });
  private phase: Phase = 'away';
  private timer = FIRST_VISIT;
  private angle = 0;
  private exit = new THREE.Vector3();
  private time = 0;

  constructor() {
    const red = new THREE.MeshStandardMaterial({ color: '#da1710', flatShading: true });
    const yellow = new THREE.MeshStandardMaterial({ color: '#ffd200', flatShading: true });
    const glass = new THREE.MeshStandardMaterial({ color: '#3a5a78', metalness: 0.3, roughness: 0.1, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: '#2a2a2e', flatShading: true });

    // Model faces +z. Red cabin over a yellow belly.
    const cabin = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), red);
    cabin.scale.set(1.05, 0.95, 1.9);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), yellow);
    belly.scale.set(1.0, 0.75, 1.8);
    belly.position.y = -0.3;
    // Wraparound windscreen: a slice of the cabin's own 12 x 8 sphere grid (front 120°, from below the
    // red roof down to the beltline), scaled out a touch so it sits flush on the red nose.
    const windshield = new THREE.Mesh(new THREE.SphereGeometry(1, 4, 2, Math.PI / 6, (Math.PI * 2) / 3, Math.PI / 4, Math.PI / 4), glass);
    windshield.scale.set(1.05 * 1.02, 0.95 * 1.02, 1.9 * 1.02);
    // Centre pillar splitting the screen into two panes.
    const pillar = new THREE.Mesh(new THREE.SphereGeometry(1, 1, 2, Math.PI / 2 - 0.04, 0.08, Math.PI / 4, Math.PI / 4), red);
    pillar.scale.set(1.05 * 1.03, 0.95 * 1.03, 1.9 * 1.03);
    const engine = box(0.9, 0.45, 1.5, red);
    engine.position.set(0, 0.95, -0.3);

    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.38, 3.4, 8).rotateX(Math.PI / 2), red);
    boom.position.set(0, 0.35, -3.2);
    const fin = box(0.12, 1.3, 0.8, yellow);
    fin.position.set(0, 0.95, -4.75);
    fin.rotation.x = -0.35;
    const stabiliser = box(1.6, 0.08, 0.45, yellow);
    stabiliser.position.set(0, 0.35, -4.3);

    for (const blade of [0, 1]) {
      const b = box(0.06, 0.12, 1.3, dark);
      b.rotation.x = (blade * Math.PI) / 2;
      this.tailRotor.add(b);
    }
    this.tailRotor.position.set(0.18, 1.05, -4.85);

    // Main rotor: four long blades on a mast; the group spins.
    const mast = box(0.14, 0.45, 0.14, dark);
    mast.position.y = 1.35;
    for (let i = 0; i < 4; i++) {
      const blade = box(0.32, 0.05, 5.4, dark);
      blade.position.z = 2.7;
      const arm = new THREE.Group();
      arm.rotation.y = (i * Math.PI) / 2;
      arm.add(blade);
      this.rotor.add(arm);
    }
    this.rotor.position.y = 1.6;

    for (const x of [-0.85, 0.85]) {
      const skid = box(0.12, 0.12, 3.2, dark);
      skid.position.set(x, -1.3, 0.1);
      const strutA = box(0.08, 0.6, 0.08, dark);
      strutA.position.set(x * 0.85, -1.0, 0.8);
      const strutB = strutA.clone();
      strutB.position.z = -0.6;
      this.group.add(skid, strutA, strutB);
    }

    // Westpac Rescue livery on both cabin sides: like the windscreen, a patch of the cabin's own
    // 12 x 8 sphere grid (3 columns by the upper 2 rows above the yellow belly) scaled out a touch,
    // so it hugs the body. It runs nose to tail on each side, and is a little self-lit so it reads
    // white even on the shaded side.
    const logo = livery();
    const decal = new THREE.MeshStandardMaterial({
      map: logo,
      emissiveMap: logo,
      emissive: '#ffffff',
      emissiveIntensity: 0.3,
      transparent: true,
      alphaTest: 0.4,
      flatShading: true,
    });
    for (const phiStart of [(5 * Math.PI) / 6, -Math.PI / 3]) {
      const patch = new THREE.Mesh(new THREE.SphereGeometry(1, 3, 2, phiStart, Math.PI / 2, Math.PI / 4, Math.PI / 4), decal);
      patch.scale.set(1.05 * 1.02, 0.95 * 1.02, 1.9 * 1.02);
      this.group.add(patch);
    }

    const light = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), this.beacon);
    light.position.set(0, 1.25, -0.9);

    this.group.add(cabin, belly, windshield, pillar, engine, boom, fin, stabiliser, this.tailRotor, mast, this.rotor, light);
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });

    // Towed banner, rigged like a real aerial banner: a weighted lead pole keeps the leading edge
    // upright, a two-line bridle joins it to a long, slightly sagging tow rope, and the fabric
    // ripples (see flutter). Two back-to-back panels deform together, so the slogan reads left to
    // right from either side. A little self-lighting keeps the fabric reading white in shade.
    const print = bannerTexture();
    const fabric = new THREE.MeshStandardMaterial({ map: print, emissiveMap: print, emissive: '#ffffff', emissiveIntensity: 0.3 });
    for (const side of [-1, 1]) {
      const geometry = new THREE.PlaneGeometry(BANNER_LENGTH, BANNER_HEIGHT, 60, 6)
        .rotateY((side * Math.PI) / 2)
        .translate(side * 0.01, 0, -BANNER_LENGTH / 2);
      this.cloth.push({ geometry, rest: Float32Array.from(geometry.attributes.position.array) });
      const panel = new THREE.Mesh(geometry, fabric);
      panel.frustumCulled = false; // the ripple moves vertices outside the rest-pose bounds
      this.banner.add(panel);
    }
    const poleTop = new THREE.Vector3(0, BANNER_HEIGHT / 2 + 0.15, 0);
    const poleBottom = new THREE.Vector3(0, -BANNER_HEIGHT / 2 - 0.15, 0);
    const ring = new THREE.Vector3(0, 0, 0.9);
    const weight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), dark);
    weight.position.copy(poleBottom);
    this.banner.add(rope(poleBottom, poleTop, dark, 0.045), weight, rope(ring, poleTop, dark), rope(ring, poleBottom, dark));
    // Keep the banner at its original size (1.1) so the message stays readable on the smaller helicopter.
    const bannerScale = 1.1 / 0.825;
    this.banner.scale.setScalar(bannerScale);
    const lead = new THREE.Vector3(0, -4.6, -8.4);
    this.banner.position.copy(lead);
    const hook = new THREE.Vector3(0, -1.3, -0.4);
    const end = ring.clone().multiplyScalar(bannerScale).add(lead);
    const sag = hook.clone().lerp(end, 0.5).add(new THREE.Vector3(0, -0.6, 0));
    const towRope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(hook, sag, end), 16, 0.025, 4), dark);
    this.group.add(this.banner, towRope);

    this.group.rotation.order = 'YXZ';
    this.group.scale.setScalar(0.825);
    this.group.visible = false;
  }

  update(dt: number): void {
    this.time += dt;
    this.timer -= dt;
    this.rotor.rotation.y += dt * 22;
    this.tailRotor.rotation.x += dt * 35;
    this.banner.rotation.y = Math.sin(this.time * 2.1) * 0.05;
    this.banner.rotation.z = Math.sin(this.time * 3.3) * 0.03;
    this.beacon.emissiveIntensity = Math.sin(this.time * 6) > 0.6 ? 3 : 0;
    if (this.group.visible) this.flutter();

    switch (this.phase) {
      case 'away':
        if (this.timer > 0) return;
        this.angle = Math.random() * Math.PI * 2;
        this.group.position.copy(polar(this.angle - 0.8, HORIZON, 35));
        this.group.visible = true;
        this.phase = 'arrive';
        return;
      case 'arrive': {
        const target = polar(this.angle, ORBIT_RADIUS, ORBIT_HEIGHT);
        this.fly(target, 16, dt);
        if (this.group.position.distanceTo(target) < 2) {
          this.phase = 'orbit';
          this.timer = ORBIT_SECONDS;
        }
        return;
      }
      case 'orbit':
        this.angle += dt * 0.22;
        this.fly(polar(this.angle, ORBIT_RADIUS, ORBIT_HEIGHT + Math.sin(this.time * 0.8) * 0.8), 8, dt);
        if (this.timer <= 0) {
          this.exit = polar(this.angle + 0.9, HORIZON + 20, 40);
          this.phase = 'leave';
        }
        return;
      case 'leave':
        this.fly(this.exit, 18, dt);
        if (this.group.position.distanceTo(this.exit) < 3) {
          this.group.visible = false;
          this.phase = 'away';
          this.timer = THREE.MathUtils.lerp(VISIT_GAP[0], VISIT_GAP[1], Math.random());
        }
    }
  }

  /**
   * Ripples the banner like fabric in the slipstream: waves run back from the lead pole and grow
   * toward the free tail, which also droops a little and flutters faster.
   */
  private flutter(): void {
    const t = this.time;
    for (const { geometry, rest } of this.cloth) {
      const pos = geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = rest[i * 3 + 1];
        const s = -rest[i * 3 + 2] / BANNER_LENGTH; // 0 at the lead pole, 1 at the tail
        const v = y / (BANNER_HEIGHT / 2); // -1 bottom edge, 1 top edge
        const swell = 0.55 * s ** 1.3 * Math.sin(14 * s - 6.5 * t);
        const flap = 0.14 * s * s * Math.sin(32 * s - 11 * t + v * 1.2);
        pos.setX(i, rest[i * 3] + swell + flap);
        pos.setY(i, y - 0.3 * s * s + 0.05 * s * Math.sin(9 * s - 8 * t));
      }
      pos.needsUpdate = true;
      geometry.computeVertexNormals();
    }
  }

  /** Steer toward `target`: turn to face the travel direction, nose down and bank into the turn. */
  private fly(target: THREE.Vector3, speed: number, dt: number): void {
    const pos = this.group.position;
    const to = target.clone().sub(pos);
    const distance = to.length();
    if (distance < 0.01) return;
    pos.addScaledVector(to.normalize(), Math.min(distance, speed * dt));
    const heading = Math.atan2(to.x, to.z);
    const turn = Math.atan2(Math.sin(heading - this.group.rotation.y), Math.cos(heading - this.group.rotation.y));
    this.group.rotation.y += turn * (1 - Math.exp(-1.5 * dt));
    this.group.rotation.x = damp(this.group.rotation.x, Math.min(speed, distance) * 0.012, 2, dt);
    this.group.rotation.z = damp(this.group.rotation.z, -turn * 0.6, 2, dt);
  }
}
