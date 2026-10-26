import * as THREE from 'three';
import { WATER_LEVEL, WATER_RADIUS } from './terrain';
import { LOGO_VIEWBOX, drawLogo } from '../brand';
import { hippo } from './actors/models';
import { canvasTexture, damp, polar, seededRandom } from './util';

const CLEAN = new THREE.Color('#0a5ee8');
const POLLUTED = new THREE.Color('#4a1d12');

const LOGO_WIDTH = WATER_RADIUS * 1.2;

function westpacLogo(): THREE.Mesh {
  const size = 1024;
  // Leave a margin for the outline, then centre the logo vertically on the square canvas.
  const width = size * 0.94;
  const texture = canvasTexture(size, (ctx) => drawLogo(ctx, size * 0.03, (size - (width * LOGO_VIEWBOX.height) / LOGO_VIEWBOX.width) / 2, width));
  texture.anisotropy = 8;
  return new THREE.Mesh(
    // Square canvas, so the plane is square too; the logo is centred with transparent margins.
    new THREE.PlaneGeometry(LOGO_WIDTH, LOGO_WIDTH).rotateX(-Math.PI / 2),
    // Drawn after the water (see renderOrder below) so Westpac red stays red instead of mixing with
    // the blue into magenta. Its opacity carries the "seen through water" look and fades with pollution.
    new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: 0.3, alphaTest: 0.5, transparent: true, roughness: 0.6 }),
  );
}

/** Only a light touch of green on the water: a few small clusters of lily pads near the edge. */
const LILY_CLUSTERS = 3;
const HIPPO_ANGLE = 2.3;

/** Notched lily pads floating in a few clusters near the bank, clear of the logo and the hippo. */
function lilyPads(random: () => number): THREE.Group {
  const lilies = new THREE.Group();
  const pad = [new THREE.Color('#4a7a35'), new THREE.Color('#5a8a3e')].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, side: THREE.DoubleSide }),
  );
  const petal = new THREE.MeshStandardMaterial({ color: '#fbe3ec', flatShading: true });
  const heart = new THREE.MeshStandardMaterial({ color: '#f2c230', flatShading: true });
  for (let c = 0; c < LILY_CLUSTERS; c++) {
    // Spread the clusters round the pond, skipping the stretch where the hippo wallows.
    const angle = HIPPO_ANGLE + ((c + 1) / (LILY_CLUSTERS + 1)) * Math.PI * 2 + (random() - 0.5) * 0.4;
    const centre = polar(angle, WATER_RADIUS - 1.6 - random() * 0.8);
    const count = 3 + Math.floor(random() * 2);
    for (let i = 0; i < count; i++) {
      const size = 0.3 + random() * 0.25;
      // A circle with a wedge cut out, the classic lily-pad notch.
      const leaf = new THREE.Mesh(new THREE.CircleGeometry(size, 10, 0.35, Math.PI * 2 - 0.7).rotateX(-Math.PI / 2), pad[i % 2]);
      leaf.position.set(centre.x + (random() - 0.5) * 1.3, WATER_LEVEL + 0.02 + i * 0.003, centre.z + (random() - 0.5) * 1.3);
      leaf.rotation.y = random() * Math.PI * 2;
      leaf.receiveShadow = true;
      lilies.add(leaf);
    }
    // One flower in most clusters.
    if (c < 2) {
      const flower = new THREE.Group();
      for (let p = 0; p < 6; p++) {
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 4), petal);
        tip.position.set(Math.cos((p / 6) * Math.PI * 2) * 0.07, 0.07, Math.sin((p / 6) * Math.PI * 2) * 0.07);
        tip.rotation.set(Math.sin((p / 6) * Math.PI * 2) * 0.6, 0, -Math.cos((p / 6) * Math.PI * 2) * 0.6);
        flower.add(tip);
      }
      const middle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), heart);
      middle.position.y = 0.08;
      flower.add(middle);
      flower.position.set(centre.x, WATER_LEVEL + 0.03, centre.z);
      lilies.add(flower);
    }
  }
  return lilies;
}

/**
 * The watering hole stands for customer data, with the Westpac logo on its pale floor.
 * Each stolen batch muddies the water for the rest of the game until the logo disappears.
 */
export class Waterhole {
  readonly group = new THREE.Group();
  private readonly material = new THREE.MeshStandardMaterial({ color: CLEAN, roughness: 0.1, metalness: 0.1, transparent: true, depthWrite: false });
  private readonly logo = westpacLogo();
  private readonly hippo = hippo();
  private pollution = 0;
  private target = 0;

  constructor() {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(WATER_RADIUS, 48).rotateX(-Math.PI / 2),
      // Pale pool floor so the water reads as clean blue rather than muddy green.
      new THREE.MeshStandardMaterial({ color: '#d8eef5', roughness: 1 }),
    );
    floor.position.y = WATER_LEVEL - 0.45;
    floor.receiveShadow = true;
    this.logo.position.y = WATER_LEVEL - 0.4;

    const water = new THREE.Mesh(new THREE.CircleGeometry(WATER_RADIUS, 48), this.material);
    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER_LEVEL;
    this.logo.renderOrder = 1;
    this.group.add(floor, this.logo, water);

    // A hippo wallows near the edge with just its head above the surface.
    this.hippo.position.copy(polar(2.3, WATER_RADIUS - 2.6, WATER_LEVEL));
    this.group.add(this.hippo);

    const random = seededRandom(3);
    const reed = new THREE.MeshStandardMaterial({ color: '#6f8a3a', flatShading: true });
    for (let i = 0; i < 40; i++) {
      const angle = random() * Math.PI * 2;
      const r = WATER_RADIUS - 0.3 + random() * 0.8;
      const h = 0.8 + random() * 0.9;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, h, 3), reed);
      stalk.position.set(Math.cos(angle) * r, WATER_LEVEL + h / 2, Math.sin(angle) * r);
      stalk.rotation.z = (random() - 0.5) * 0.3;
      this.group.add(stalk);
    }

    this.group.add(lilyPads(random));
  }

  pollute(amount: number): void {
    this.target = Math.min(1, this.target + amount);
  }

  reset(): void {
    this.target = 0;
  }

  /** `viewer` is the camera position; the logo turns slowly so it always reads upright. */
  update(dt: number, time: number, viewer: THREE.Vector3): void {
    this.pollution = damp(this.pollution, this.target, 2, dt);
    this.material.color.copy(CLEAN).lerp(POLLUTED, this.pollution);
    this.material.opacity = THREE.MathUtils.lerp(0.62, 0.97, this.pollution);
    (this.logo.material as THREE.MeshStandardMaterial).opacity = THREE.MathUtils.lerp(0.8, 0.05, this.pollution);
    this.material.emissive.copy(this.material.color).multiplyScalar(0.08 + Math.sin(time * 1.5) * 0.03);
    const facing = Math.atan2(viewer.x, viewer.z);
    const diff = Math.atan2(Math.sin(facing - this.logo.rotation.y), Math.cos(facing - this.logo.rotation.y));
    this.logo.rotation.y += diff * (1 - Math.exp(-1.5 * dt));

    // The hippo bobs, sways a little and keeps its grin turned toward the camera.
    const h = this.hippo.position;
    h.y = WATER_LEVEL + 0.02 + Math.sin(time * 1.3) * 0.05;
    this.hippo.rotation.y = Math.atan2(viewer.x - h.x, viewer.z - h.z) + Math.sin(time * 0.4) * 0.2;
    this.hippo.rotation.z = Math.sin(time * 0.9) * 0.04;
  }
}
