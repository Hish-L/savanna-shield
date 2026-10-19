import * as THREE from 'three';
import { box, canvasTexture } from '../util';

// All models face +z with feet at y = 0. Legs pivot at the hip so they can swing.

export interface Model {
  root: THREE.Group;
  /** The first half swing together and the second half in opposite phase (diagonal pairs for four legs). */
  legs: THREE.Object3D[];
  head?: THREE.Object3D;
}

function leg(w: number, h: number, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w).translate(0, -h / 2, 0), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

const stripes = canvasTexture(64, (ctx) => {
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#1c1c1c';
  for (let x = -64; x < 64; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 6, 0);
    ctx.lineTo(x + 30, 64);
    ctx.lineTo(x + 24, 64);
    ctx.fill();
  }
});

const spots = canvasTexture(64, (ctx) => {
  ctx.fillStyle = '#b08d5c';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#4a3523';
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.arc((i * 37) % 64, (i * 23) % 64, 3 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
});

export function zebra(): Model {
  const root = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({ map: stripes, flatShading: true });
  const black = new THREE.MeshStandardMaterial({ color: '#1c1c1c', flatShading: true });
  const body = box(0.7, 0.75, 1.6, coat);
  body.position.y = 1.3;
  const neck = box(0.3, 0.9, 0.38, coat);
  neck.position.set(0, 1.85, 0.72);
  neck.rotation.x = 0.45;
  const head = new THREE.Group();
  const skull = box(0.3, 0.32, 0.72, coat);
  skull.position.z = 0.25;
  const muzzle = box(0.26, 0.26, 0.2, black);
  muzzle.position.z = 0.65;
  const mane = box(0.08, 0.2, 0.5, black);
  mane.position.set(0, 0.25, -0.2);
  head.add(skull, muzzle, mane);
  head.position.set(0, 2.2, 0.95);
  head.rotation.x = 0.35;
  const tail = box(0.08, 0.7, 0.08, black);
  tail.position.set(0, 1.25, -0.85);
  tail.rotation.x = 0.3;
  const legs = [
    leg(0.16, 0.95, coat, -0.22, 0.95, 0.6),
    leg(0.16, 0.95, coat, 0.22, 0.95, -0.6),
    leg(0.16, 0.95, coat, 0.22, 0.95, 0.6),
    leg(0.16, 0.95, coat, -0.22, 0.95, -0.6),
  ];
  root.add(body, neck, head, tail, ...legs);
  return { root, legs, head };
}

export function hyena(): Model {
  const root = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({ map: spots, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#2e2219', flatShading: true });
  const eyes = new THREE.MeshStandardMaterial({ color: '#ffcc33', emissive: '#ff9900', emissiveIntensity: 1.5 });
  const body = box(0.55, 0.6, 1.25, coat);
  body.position.y = 0.95;
  body.rotation.x = -0.15;
  const head = new THREE.Group();
  const skull = box(0.42, 0.4, 0.5, coat);
  const muzzle = box(0.26, 0.24, 0.3, dark);
  muzzle.position.set(0, -0.06, 0.36);
  head.add(skull, muzzle);
  for (const x of [-0.15, 0.15]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), dark);
    ear.position.set(x, 0.28, -0.08);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), eyes);
    eye.position.set(x * 0.8, 0.07, 0.25);
    head.add(ear, eye);
  }
  head.position.set(0, 1.25, 0.8);
  const mane = box(0.1, 0.2, 0.9, dark);
  mane.position.set(0, 1.33, 0.1);
  mane.rotation.x = -0.15;
  const legs = [
    leg(0.14, 0.95, coat, -0.18, 0.95, 0.45),
    leg(0.14, 0.75, coat, 0.18, 0.75, -0.45),
    leg(0.14, 0.95, coat, 0.18, 0.95, 0.45),
    leg(0.14, 0.75, coat, -0.18, 0.75, -0.45),
  ];
  root.add(body, head, mane, ...legs);
  root.scale.setScalar(1.1);
  return { root, legs, head };
}

export function crocodile(): Model {
  const root = new THREE.Group();
  const hide = new THREE.MeshStandardMaterial({ color: '#4d6a33', flatShading: true });
  const belly = new THREE.MeshStandardMaterial({ color: '#a9a56a', flatShading: true });
  const eyes = new THREE.MeshStandardMaterial({ color: '#e8f060', emissive: '#c8d020', emissiveIntensity: 1.5 });
  const body = box(0.9, 0.38, 2.2, hide);
  body.position.y = 0.4;
  const under = box(0.8, 0.1, 2.0, belly);
  under.position.y = 0.2;
  // Head = snout and eyes, so the portrait camera can frame it like the other models.
  const head = new THREE.Group();
  head.position.set(0, 0.36, 1.05);
  const snout = box(0.55, 0.26, 1.2, hide);
  snout.position.z = 0.6;
  const jaw = box(0.5, 0.1, 1.1, belly);
  jaw.position.set(0, -0.17, 0.6);
  head.add(snout, jaw);
  const tooth = new THREE.MeshStandardMaterial({ color: '#f4f0dc', flatShading: true });
  for (const side of [-1, 1]) {
    for (let z = 0.2; z < 1.15; z += 0.18) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 4).rotateX(Math.PI), tooth);
      fang.position.set(side * 0.26, -0.15, z);
      head.add(fang);
    }
    const nostril = box(0.08, 0.06, 0.08, hide);
    nostril.position.set(side * 0.1, 0.15, 1.08);
    head.add(nostril);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.38, 2.2, 4).rotateX(-Math.PI / 2), hide);
  tail.position.set(0, 0.38, -2.1);
  tail.castShadow = true;
  root.add(body, under, head, tail);
  for (let i = 0; i < 6; i++) {
    const ridge = box(0.12, 0.14, 0.18, hide);
    ridge.position.set(i % 2 ? 0.2 : -0.2, 0.64, 0.8 - i * 0.35);
    root.add(ridge);
  }
  for (const x of [-0.18, 0.18]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), eyes);
    eye.position.set(x, 0.26, 0);
    head.add(eye);
  }
  const legs = [
    leg(0.18, 0.32, hide, -0.55, 0.32, 0.7),
    leg(0.18, 0.32, hide, 0.55, 0.32, -0.7),
    leg(0.18, 0.32, hide, 0.55, 0.32, 0.7),
    leg(0.18, 0.32, hide, -0.55, 0.32, -0.7),
  ];
  root.add(...legs);
  root.scale.setScalar(1.4);
  return { root, legs, head };
}

export function elephant(): Model {
  const root = new THREE.Group();
  const hide = new THREE.MeshStandardMaterial({ color: '#8a8580', flatShading: true });
  const ivory = new THREE.MeshStandardMaterial({ color: '#f1e9d2', flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2622', flatShading: true });
  const body = box(1.7, 1.6, 2.8, hide);
  body.position.y = 2.5;

  // Head pivots at its centre so it can lift the trunk when it speaks.
  const head = new THREE.Group();
  const skull = box(1.2, 1.2, 1.0, hide);
  head.add(skull);
  for (const [w, h, y, z, tilt] of [
    [0.42, 0.9, -0.75, 0.45, 0],
    [0.34, 0.8, -1.5, 0.55, 0],
    [0.26, 0.5, -2.05, 0.7, -0.4],
  ]) {
    const trunk = box(w, h, w, hide);
    trunk.position.set(0, y, z);
    trunk.rotation.x = tilt;
    head.add(trunk);
  }
  for (const side of [-1, 1]) {
    const ear = box(0.12, 1.3, 1.1, hide);
    ear.position.set(side * 0.7, 0.05, -0.2);
    ear.rotation.y = side * 0.35;
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.8, 6), ivory);
    tusk.position.set(side * 0.3, -0.45, 0.75);
    tusk.rotation.x = Math.PI / 2 - 0.3;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), dark);
    eye.position.set(side * 0.45, 0.2, 0.5);
    head.add(ear, tusk, eye);
  }
  head.position.set(0, 2.9, 1.75);

  const tail = box(0.08, 0.9, 0.08, dark);
  tail.position.set(0, 2.4, -1.45);
  tail.rotation.x = 0.2;
  const legs = [
    leg(0.5, 1.75, hide, -0.55, 1.75, 0.95),
    leg(0.5, 1.75, hide, 0.55, 1.75, -0.95),
    leg(0.5, 1.75, hide, 0.55, 1.75, 0.95),
    leg(0.5, 1.75, hide, -0.55, 1.75, -0.95),
  ];
  root.add(body, head, tail, ...legs);
  return { root, legs, head };
}

export function poacher(): Model {
  const root = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: '#5d5a34', flatShading: true });
  const pants = new THREE.MeshStandardMaterial({ color: '#3b2f25', flatShading: true });
  const skin = new THREE.MeshStandardMaterial({ color: '#c68b59', flatShading: true });
  const mask = new THREE.MeshStandardMaterial({ color: '#222226', flatShading: true });
  const helmet = new THREE.MeshStandardMaterial({ color: '#e4d6ad', flatShading: true });
  const band = new THREE.MeshStandardMaterial({ color: '#5a3d22', flatShading: true });
  const wood = new THREE.MeshStandardMaterial({ color: '#6b4a2b', flatShading: true });
  const steel = new THREE.MeshStandardMaterial({ color: '#2b2d31', metalness: 0.6, roughness: 0.4, flatShading: true });
  const eyes = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.6 });

  const torso = box(0.6, 0.75, 0.36, shirt);
  torso.position.y = 1.3;
  const pack = box(0.45, 0.5, 0.25, pants);
  pack.position.set(0, 1.35, -0.3);

  const head = new THREE.Group();
  const face = box(0.36, 0.38, 0.34, skin);
  const bandana = box(0.38, 0.2, 0.36, mask); // masked "bad guy" face
  bandana.position.y = -0.08;
  // Pith helmet: rounded dome, dark band, and a brim that slopes down all round.
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), helmet);
  dome.scale.set(1, 1.05, 1.15);
  dome.position.y = 0.17;
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.42, 0.08, 14, 1, true),
    new THREE.MeshStandardMaterial({ color: '#e4d6ad', flatShading: true, side: THREE.DoubleSide }),
  );
  brim.scale.z = 1.15;
  brim.position.y = 0.15;
  const helmetBand = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.06, 12), band);
  helmetBand.scale.z = 1.15;
  helmetBand.position.y = 0.2;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), helmet);
  knob.position.y = 0.46;
  for (const m of [dome, brim, helmetBand, knob]) m.castShadow = true;
  head.add(face, bandana, dome, brim, helmetBand, knob);
  for (const x of [-0.08, 0.08]) {
    const eye = box(0.06, 0.04, 0.02, eyes);
    eye.position.set(x, 0.06, 0.18);
    head.add(eye);
  }
  head.position.y = 1.9;

  // Hunting rifle held at low ready across the chest. It's fixed to the body so it stays steady.
  // The model faces +z, so the poacher's right side is -x: stock on the right, muzzle angled left.
  const rifle = new THREE.Group();
  const stock = box(0.1, 0.16, 0.45, wood);
  stock.position.z = -0.15;
  const receiver = box(0.09, 0.12, 0.3, steel);
  receiver.position.z = 0.22;
  const forestock = box(0.09, 0.09, 0.4, wood);
  forestock.position.set(0, -0.04, 0.55);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6).rotateX(Math.PI / 2), steel);
  barrel.position.set(0, 0.02, 0.78);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 6).rotateX(Math.PI / 2), steel);
  scope.position.set(0, 0.11, 0.24);
  rifle.add(stock, receiver, forestock, barrel, scope);
  rifle.position.set(-0.1, 1.3, 0.28);
  rifle.rotation.set(0.05, 0.3, 0);
  rifle.scale.setScalar(1.3);
  rifle.updateMatrix();

  // Both hands on the gun: right hand on the grip behind the receiver, left hand under the forestock.
  // Each arm is aimed from its shoulder at its hand point and stretched to reach it exactly.
  const armTo = (shoulderX: number, gripLocal: THREE.Vector3) => {
    const arm = leg(0.16, 0.7, shirt, shoulderX, 1.65, 0);
    const hand = gripLocal.applyMatrix4(rifle.matrix);
    const reach = hand.sub(arm.position);
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), reach.clone().normalize());
    arm.scale.y = reach.length() / 0.7;
    return arm;
  };
  const rightArm = armTo(-0.38, new THREE.Vector3(0, -0.08, 0.05));
  const leftArm = armTo(0.38, new THREE.Vector3(0, -0.09, 0.48));

  const legL = leg(0.2, 0.92, pants, 0.15, 0.92, 0);
  const legR = leg(0.2, 0.92, pants, -0.15, 0.92, 0);

  root.add(torso, pack, head, legL, legR, rightArm, leftArm, rifle);
  root.scale.setScalar(1.15);
  // Arms stay on the rifle, so only the legs swing.
  return { root, legs: [legL, legR], head };
}

/**
 * The Chief Ranger: Aussie ranger in a khaki shirt with epaulettes and a red badge, shorts, long
 * socks and boots, a shoulder radio, and an Akubra-style hat with a Westpac-red band. Only used for
 * the portrait.
 */
export function ranger(): Model {
  const root = new THREE.Group();
  const mat = (color: string) => new THREE.MeshStandardMaterial({ color, flatShading: true });
  const shirt = mat('#c9b07a');
  const seam = mat('#b09658');
  const olive = mat('#4f5d2f');
  const shorts = mat('#8a7a4f');
  const skin = mat('#d39a6a');
  const hair = mat('#4a3426');
  const leather = mat('#4a3322');
  const boots = mat('#3a2a1c');
  const hatFelt = mat('#7a5634');
  const red = mat('#da1710');
  const gold = new THREE.MeshStandardMaterial({ color: '#e8b923', metalness: 0.6, roughness: 0.35, flatShading: true });
  const dark = mat('#1e1a17');
  const white = mat('#f4f1ea');

  // Shirt, tucked into a belt with a gold buckle.
  const torso = box(0.6, 0.75, 0.36, shirt);
  torso.position.y = 1.3;
  const neck = box(0.16, 0.1, 0.16, skin);
  neck.position.y = 1.72;
  const belt = box(0.62, 0.08, 0.38, leather);
  belt.position.y = 0.96;
  const buckle = box(0.11, 0.07, 0.02, gold);
  buckle.position.set(0, 0.96, 0.195);
  root.add(torso, neck, belt, buckle);
  for (const side of [-1, 1]) {
    const collar = box(0.16, 0.1, 0.04, shirt);
    collar.position.set(side * 0.09, 1.66, 0.19);
    collar.rotation.z = side * 0.55;
    const epaulette = box(0.18, 0.04, 0.3, olive);
    epaulette.position.set(side * 0.21, 1.685, 0);
    const pocket = box(0.16, 0.16, 0.02, seam);
    pocket.position.set(side * 0.15, 1.38, 0.19);
    const flap = box(0.17, 0.05, 0.03, seam);
    flap.position.set(side * 0.15, 1.47, 0.195);
    root.add(collar, epaulette, pocket, flap);
  }
  // Red badge with a gold rim on the left pocket, name tag over the right.
  const badgeRim = box(0.14, 0.16, 0.02, gold);
  badgeRim.position.set(0.15, 1.37, 0.205);
  const badge = box(0.1, 0.12, 0.02, red);
  badge.position.set(0.15, 1.37, 0.215);
  const nameTag = box(0.14, 0.04, 0.02, white);
  nameTag.position.set(-0.15, 1.53, 0.195);
  // Two-way radio clipped to the right shoulder.
  const radio = box(0.1, 0.16, 0.06, dark);
  radio.position.set(-0.2, 1.56, 0.21);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 4), dark);
  antenna.position.set(-0.23, 1.71, 0.21);
  root.add(badgeRim, badge, nameTag, radio, antenna);

  // Arms: short sleeves, bare forearms and hands, hanging slightly away from the body.
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    const sleeve = box(0.18, 0.28, 0.18, shirt);
    sleeve.position.y = -0.14;
    const forearm = box(0.13, 0.36, 0.13, skin);
    forearm.position.y = -0.46;
    const hand = box(0.14, 0.12, 0.14, skin);
    hand.position.y = -0.7;
    arm.add(sleeve, forearm, hand);
    arm.position.set(side * 0.39, 1.65, 0);
    arm.rotation.z = side * 0.08;
    return arm;
  });

  // Legs: shorts, knees, long socks and boots. Pivot at the hip like the other models.
  const legs = [1, -1].map((side) => {
    const leg = new THREE.Group();
    const short = box(0.24, 0.36, 0.26, shorts);
    short.position.y = -0.18;
    const knee = box(0.16, 0.14, 0.16, skin);
    knee.position.y = -0.43;
    const sock = box(0.18, 0.3, 0.18, shirt);
    sock.position.y = -0.65;
    const boot = box(0.2, 0.14, 0.3, boots);
    boot.position.set(0, -0.85, 0.04);
    leg.add(short, knee, sock, boot);
    leg.position.set(side * 0.15, 0.92, 0);
    return leg;
  });

  // Head: friendly face with eyebrows, sideburns and a moustache over a smile.
  const head = new THREE.Group();
  const face = box(0.36, 0.38, 0.34, skin);
  const nose = box(0.06, 0.08, 0.06, skin);
  nose.position.set(0, -0.02, 0.19);
  const moustache = box(0.18, 0.045, 0.03, hair);
  moustache.position.set(0, -0.08, 0.18);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 8, 2), dark);
  smile.rotation.z = -Math.PI / 2 - 1;
  smile.position.set(0, -0.08, 0.175);
  const backHair = box(0.37, 0.16, 0.05, hair);
  backHair.position.set(0, 0.08, -0.17);
  head.add(face, nose, moustache, smile, backHair);
  for (const side of [-1, 1]) {
    const eye = box(0.05, 0.05, 0.02, dark);
    eye.position.set(side * 0.08, 0.05, 0.175);
    const brow = box(0.09, 0.025, 0.02, hair);
    brow.position.set(side * 0.08, 0.11, 0.177);
    brow.rotation.z = side * -0.15;
    const ear = box(0.05, 0.1, 0.08, skin);
    ear.position.set(side * 0.2, 0.01, 0);
    const sideburn = box(0.03, 0.12, 0.08, hair);
    sideburn.position.set(side * 0.18, 0.06, 0.05);
    head.add(eye, brow, ear, sideburn);
  }
  // Akubra-style hat: oval crown with a crease on top, red band with a gold pin, wide brim tipped forward.
  const hat = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.03, 20), hatFelt);
  brim.scale.z = 1.1;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.24, 12), hatFelt);
  crown.scale.z = 1.15;
  crown.position.y = 0.13;
  const crease = box(0.05, 0.03, 0.3, seam);
  crease.position.y = 0.25;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.06, 12), red);
  band.scale.z = 1.15;
  band.position.y = 0.05;
  const pin = box(0.05, 0.05, 0.02, gold);
  pin.position.set(0.12, 0.05, 0.25);
  hat.add(brim, crown, crease, band, pin);
  hat.position.y = 0.2;
  hat.rotation.x = 0.06;
  head.add(hat);
  head.position.y = 1.9;

  root.add(head, ...legs, ...arms);
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  root.scale.setScalar(1.15);
  return { root, legs, head };
}

/** Just a hippo's head, origin at the waterline: it wallows in the pond with a big grin. */
export function hippo(): THREE.Group {
  const root = new THREE.Group();
  const hide = new THREE.MeshStandardMaterial({ color: '#8c7b8f', flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2026', flatShading: true });
  const white = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true });
  const blush = new THREE.MeshStandardMaterial({ color: '#f29bb0', flatShading: true });

  const skull = box(1.1, 0.5, 1.0, hide);
  skull.position.y = 0.1;
  const muzzle = box(1.3, 0.55, 0.8, hide);
  muzzle.position.set(0, 0.05, 0.75);
  root.add(skull, muzzle);
  for (const side of [-1, 1]) {
    // Eyes sit on raised bumps on top of the head, the way hippos peek out of the water.
    const bump = box(0.24, 0.2, 0.22, hide);
    bump.position.set(side * 0.33, 0.42, -0.1);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), white);
    eye.position.set(side * 0.33, 0.45, 0.02);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), dark);
    pupil.position.set(side * 0.33, 0.46, 0.09);
    const ear = box(0.12, 0.18, 0.08, hide);
    ear.position.set(side * 0.45, 0.42, -0.42);
    ear.rotation.z = side * -0.3;
    const nostril = box(0.12, 0.05, 0.1, dark);
    nostril.position.set(side * 0.28, 0.33, 1.0);
    const cheek = box(0.2, 0.12, 0.02, blush);
    cheek.position.set(side * 0.48, 0.2, 1.16);
    root.add(bump, eye, pupil, ear, nostril, cheek);
  }
  // Smile: an arc of a torus curving up at both ends, across the front of the muzzle.
  const arc = 2.0;
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 4, 12, arc), dark);
  smile.rotation.z = -Math.PI / 2 - arc / 2;
  smile.position.set(0, 0.5, 1.16);
  root.add(smile);
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  root.scale.setScalar(1.6);
  return root;
}
