import type { ObstacleState } from "../entities/EntityTypes";

const cellKeyOffset = 32768;
const cellKeyStride = 65536;

export class ObstacleSpatialIndex {
  private readonly cells = new Map<number, ObstacleState[]>();
  private readonly querySet = new Set<ObstacleState>();
  private signature = 0;
  private obstacleCount = -1;

  constructor(private readonly cellSize = 4) {}

  sync(obstacles: readonly ObstacleState[]) {
    const signature = obstacleSignature(obstacles);
    if (this.obstacleCount === obstacles.length && this.signature === signature) return;

    this.signature = signature;
    this.obstacleCount = obstacles.length;
    this.cells.clear();

    for (const obstacle of obstacles) {
      // Oriented boxes bin by the extent of their rotated AABB so a long thin
      // angled wall still lands in every cell it spans.
      let extentX = obstacle.halfSize.x;
      let extentZ = obstacle.halfSize.z;
      if (obstacle.yaw) {
        const cos = Math.abs(Math.cos(obstacle.yaw));
        const sin = Math.abs(Math.sin(obstacle.yaw));
        extentX = obstacle.halfSize.x * cos + obstacle.halfSize.z * sin;
        extentZ = obstacle.halfSize.x * sin + obstacle.halfSize.z * cos;
      }
      const minCellX = this.cellCoord(obstacle.position.x - extentX);
      const maxCellX = this.cellCoord(obstacle.position.x + extentX);
      const minCellZ = this.cellCoord(obstacle.position.z - extentZ);
      const maxCellZ = this.cellCoord(obstacle.position.z + extentZ);
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
          this.push(this.cellKey(cellX, cellZ), obstacle);
        }
      }
    }
  }

  queryCircle(x: number, z: number, radius: number) {
    this.querySet.clear();
    const minCellX = this.cellCoord(x - radius);
    const maxCellX = this.cellCoord(x + radius);
    const minCellZ = this.cellCoord(z - radius);
    const maxCellZ = this.cellCoord(z + radius);
    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
        const obstacles = this.cells.get(this.cellKey(cellX, cellZ));
        if (!obstacles) continue;
        for (const obstacle of obstacles) this.querySet.add(obstacle);
      }
    }
    return this.querySet;
  }

  private push(key: number, obstacle: ObstacleState) {
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(obstacle);
    else this.cells.set(key, [obstacle]);
  }

  private cellCoord(value: number) {
    return Math.floor(value / this.cellSize);
  }

  private cellKey(x: number, z: number) {
    return (x + cellKeyOffset) * cellKeyStride + (z + cellKeyOffset);
  }
}

function obstacleSignature(obstacles: readonly ObstacleState[]) {
  let hash = 2166136261;
  for (const obstacle of obstacles) {
    hash = mixString(hash, obstacle.id);
    hash = mixNumber(hash, obstacle.position.x);
    hash = mixNumber(hash, obstacle.position.y);
    hash = mixNumber(hash, obstacle.position.z);
    hash = mixNumber(hash, obstacle.halfSize.x);
    hash = mixNumber(hash, obstacle.halfSize.y);
    hash = mixNumber(hash, obstacle.halfSize.z);
    hash = mixNumber(hash, obstacle.yaw ?? 0);
    hash = mixString(hash, obstacle.enemyNavigation ?? "solid");
  }
  return hash >>> 0;
}

function mixString(hash: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash;
}

function mixNumber(hash: number, value: number) {
  hash ^= Math.round(value * 1000);
  return Math.imul(hash, 16777619);
}
