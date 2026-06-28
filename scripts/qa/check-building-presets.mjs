// Standalone validation: every building-preset door must land on a real shared
// edge (sharedEdge replica: doorWidth 3.2 → minOverlap 3.4, touch tol 0.6), for
// all four 90° rotations. Mirrors src/build/BuilderBuildingPresets.ts geometry.
const minOverlap = 3.4;
const tol = 0.6;

const presets = {
  residential_l: {
    rooms: { living: [-5, 4, 10, 8], bedroom: [-5, -4, 10, 8], kitchen: [4, -4, 8, 8] },
    doors: [["living", "bedroom"], ["bedroom", "kitchen"]],
  },
  central_court: {
    rooms: { court: [0, 0, 12, 12], north: [0, 9, 12, 6], east: [9, 0, 6, 12] },
    doors: [["court", "north"], ["court", "east"]],
  },
  twin_clinic: {
    rooms: { corridor: [0, 0, 6, 14], left: [-7, 4, 8, 6], right: [7, 4, 8, 6] },
    doors: [["corridor", "left"], ["corridor", "right"]],
  },
  industrial_loop: {
    rooms: { control: [-5, 5, 10, 8], mech: [5, 5, 10, 8], dist: [0, -3, 20, 8] },
    doors: [["control", "mech"], ["control", "dist"], ["mech", "dist"]],
  },
  museum_atrium: {
    rooms: { atrium: [0, 3, 14, 10], west: [-10, 3, 6, 10], eastWing: [10, 3, 6, 10] },
    doors: [["atrium", "west"], ["atrium", "eastWing"]],
  },
};

function rot([cx, cz, w, d], k) {
  let x = cx, z = cz;
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) { const nx = z, nz = -x; x = nx; z = nz; }
  const odd = ((((k % 4) + 4) % 4) % 2) === 1;
  return [x, z, odd ? d : w, odd ? w : d];
}

function shares(a, b) {
  const [ax, az, aw, ad] = a, [bx, bz, bw, bd] = b;
  const ax0 = ax - aw / 2, ax1 = ax + aw / 2, az0 = az - ad / 2, az1 = az + ad / 2;
  const bx0 = bx - bw / 2, bx1 = bx + bw / 2, bz0 = bz - bd / 2, bz1 = bz + bd / 2;
  const xOv = Math.min(ax1, bx1) - Math.max(ax0, bx0);
  const zOv = Math.min(az1, bz1) - Math.max(az0, bz0);
  if (xOv >= minOverlap && (Math.abs(az0 - bz1) <= tol || Math.abs(az1 - bz0) <= tol)) return true;
  if (zOv >= minOverlap && (Math.abs(ax0 - bx1) <= tol || Math.abs(ax1 - bx0) <= tol)) return true;
  return false;
}

let fails = 0;
for (const [name, preset] of Object.entries(presets)) {
  for (let k = 0; k < 4; k++) {
    const rooms = Object.fromEntries(Object.entries(preset.rooms).map(([key, r]) => [key, rot(r, k)]));
    for (const [from, to] of preset.doors) {
      if (!shares(rooms[from], rooms[to])) {
        console.error(`FAIL ${name} @${k * 90}°: ${from} ↔ ${to} has no shared edge`);
        fails++;
      }
    }
    // No two rooms may overlap (touching edges only).
    const keys = Object.keys(rooms);
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const a = rooms[keys[i]], b = rooms[keys[j]];
      const xOv = Math.min(a[0] + a[2] / 2, b[0] + b[2] / 2) - Math.max(a[0] - a[2] / 2, b[0] - b[2] / 2);
      const zOv = Math.min(a[1] + a[3] / 2, b[1] + b[3] / 2) - Math.max(a[1] - a[3] / 2, b[1] - b[3] / 2);
      if (xOv > 0.01 && zOv > 0.01) { console.error(`FAIL ${name} @${k * 90}°: ${keys[i]} overlaps ${keys[j]}`); fails++; }
    }
  }
}

// --- Drop placement: a stamped cluster must land clear of existing rooms ----
// Replicates suggestBuildingDropCenter (gap 4, offset by the rotated cluster's
// own left/center extent) against the real starter project (BuilderTypes.ts).
const starter = [
  [0, 10, 10, 6], [0, 3, 8, 8], [-9, 3, 10, 6], [0, -5, 12, 8], [0, -11.5, 6, 5],
];
const gap = 4;
let maxX = -Infinity, sumZ = 0;
for (const r of starter) { maxX = Math.max(maxX, r[0] + r[2] / 2); sumZ += r[1]; }
const avgZ = sumZ / starter.length;

function overlaps(a, b) {
  const xOv = Math.min(a[0] + a[2] / 2, b[0] + b[2] / 2) - Math.max(a[0] - a[2] / 2, b[0] - b[2] / 2);
  const zOv = Math.min(a[1] + a[3] / 2, b[1] + b[3] / 2) - Math.max(a[1] - a[3] / 2, b[1] - b[3] / 2);
  return xOv > 0.01 && zOv > 0.01;
}

for (const [name, preset] of Object.entries(presets)) {
  for (let k = 0; k < 4; k++) {
    const rotated = Object.values(preset.rooms).map((r) => rot(r, k));
    let minX = Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const r of rotated) {
      minX = Math.min(minX, r[0] - r[2] / 2);
      minZ = Math.min(minZ, r[1] - r[3] / 2);
      maxZ = Math.max(maxZ, r[1] + r[3] / 2);
    }
    const dropX = maxX + gap - minX;
    const dropZ = avgZ - (minZ + maxZ) / 2;
    const placed = rotated.map((r) => [r[0] + dropX, r[1] + dropZ, r[2], r[3]]);
    for (const pr of placed) for (const sr of starter) {
      if (overlaps(pr, sr)) { console.error(`FAIL ${name} @${k * 90}°: stamped room overlaps a starter room`); fails++; }
    }
  }
}

if (fails === 0) console.log("ALL PASS — every preset door shares an edge, no internal overlaps, and stamped clusters land clear of the starter project (×4 rotations).");
else { console.error(`${fails} issue(s).`); process.exit(1); }
