import * as THREE from 'three';
import { WATER_RADIUS } from './terrain';

/** A round footprint on the ground; only x and z matter. */
export interface Body {
  readonly position: THREE.Vector3;
  readonly radius: number;
  /** Heavy movers (the van, the elephant) shove smaller ones aside rather than being pushed themselves. */
  readonly heavy?: boolean;
}

/** Nothing walks into the pond (the hippo lives in it and isn't a mover). */
const POND: Body = { position: new THREE.Vector3(), radius: WATER_RADIUS + 0.3 };

/**
 * Ground navigation shared by everything that moves on the map. Fixed obstacles (the pond,
 * buildings, tree trunks, boulders) and moving bodies (animals, the van) are round footprints.
 * Movers head straight for their target unless something is in the way, in which case they follow
 * the tangent around it; afterwards they are pushed back out of anything they overlap.
 */
class Navigation {
  private readonly fixed: Body[] = [POND];
  private readonly movers = new Set<Body>();

  addObstacle(position: THREE.Vector3, radius: number): void {
    this.fixed.push({ position: position.clone().setY(0), radius });
  }

  addMover(body: Body): void {
    this.movers.add(body);
  }

  removeMover(body: Body): void {
    this.movers.delete(body);
  }

  /** Moves `spot` (in place) out of any fixed obstacle so a mover of `radius` can stand there. */
  clearSpot(spot: THREE.Vector3, radius: number): THREE.Vector3 {
    for (let pass = 0; pass < 3; pass++) {
      for (const o of this.fixed) {
        const reach = o.radius + radius + 0.1;
        const dx = spot.x - o.position.x;
        const dz = spot.z - o.position.z;
        const d = Math.hypot(dx, dz);
        if (d >= reach) continue;
        const [ux, uz] = d > 1e-4 ? [dx / d, dz / d] : [1, 0];
        spot.x = o.position.x + ux * reach;
        spot.z = o.position.z + uz * reach;
      }
    }
    return spot;
  }

  /**
   * Unit direction (written to `out`, y = 0) for `self` to head in toward `to`: straight there, or
   * along the tangent around the nearest obstacle or mover that blocks the straight line.
   */
  heading(self: Body, to: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    const from = self.position;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    if (length < 1e-4) return out.set(0, 0, 0);
    const dirX = dx / length;
    const dirZ = dz / length;

    let blocker: Body | null = null;
    let nearest = Infinity;
    const consider = (o: Body) => {
      if (o === self) return;
      const reach = o.radius + self.radius;
      const ox = o.position.x - from.x;
      const oz = o.position.z - from.z;
      const along = ox * dirX + oz * dirZ;
      if (along <= 0) return; // behind us
      const across2 = ox * ox + oz * oz - along * along;
      if (across2 >= reach * reach) return; // passes clear
      if (along - Math.sqrt(reach * reach - across2) > length) return; // we arrive before reaching it
      if (along < nearest) {
        nearest = along;
        blocker = o;
      }
    };
    this.fixed.forEach(consider);
    this.movers.forEach(consider);
    if (!blocker) return out.set(dirX, 0, dirZ);

    // Go round on whichever side we're already leaning toward.
    const b: Body = blocker;
    const ox = b.position.x - from.x;
    const oz = b.position.z - from.z;
    const d = Math.hypot(ox, oz);
    const reach = b.radius + self.radius;
    const toBlocker = Math.atan2(oz, ox);
    const lean = Math.atan2(Math.sin(Math.atan2(dirZ, dirX) - toBlocker), Math.cos(Math.atan2(dirZ, dirX) - toBlocker));
    const side = lean >= 0 ? 1 : -1;
    // Outside its reach: aim along the tangent. Already touching: slide round it, easing outward.
    const offset = d > reach ? Math.asin(reach / d) : Math.PI / 2 + 0.3;
    const angle = toBlocker + side * offset;
    return out.set(Math.cos(angle), 0, Math.sin(angle));
  }

  /** Pushes `self` back out of whatever it overlaps. Movers split the overlap; heavy ones don't give way. */
  separate(self: Body): void {
    const pos = self.position;
    const push = (o: Body, share: number) => {
      if (o === self) return;
      const reach = o.radius + self.radius;
      const dx = pos.x - o.position.x;
      const dz = pos.z - o.position.z;
      const d = Math.hypot(dx, dz);
      if (d >= reach) return;
      const [ux, uz] = d > 1e-4 ? [dx / d, dz / d] : [Math.random() - 0.5, Math.random() - 0.5];
      const n = Math.hypot(ux, uz);
      pos.x += (ux / n) * (reach - d) * share;
      pos.z += (uz / n) * (reach - d) * share;
    };
    this.fixed.forEach((o) => push(o, 1));
    if (self.heavy) return;
    this.movers.forEach((o) => push(o, o.heavy ? 1 : 0.5));
  }
}

export const nav = new Navigation();
