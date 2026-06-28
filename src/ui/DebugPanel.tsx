import { useEffect, useState } from "react";
import type { GameWorld } from "../game/core/GameWorld";
import { robotSkins } from "../game/skins/robotSkins";

interface DebugPanelProps {
  world: GameWorld;
}

interface DebugSnapshot {
  frameMs: string;
  fps: string;
  position: string;
  projectiles: number;
  mode: string;
  wave: string;
  enemies: string;
  skinName: string;
  profileRuns: number;
  profileLevel: string;
  profileUpgradePicks: number;
}

export function DebugPanel({ world }: DebugPanelProps) {
  const [snapshot, setSnapshot] = useState(() => readDebug(world));

  useEffect(() => {
    const id = window.setInterval(() => setSnapshot(readDebug(world)), 160);
    return () => window.clearInterval(id);
  }, [world]);

  return (
    <aside className="debug-panel" aria-label="调试面板">
      <div className="debug-title">
        <span>遥测</span>
        <span>原型</span>
      </div>
      <dl className="debug-grid">
        <dt>帧耗时</dt>
        <dd>{snapshot.frameMs} ms</dd>
        <dt>FPS</dt>
        <dd>{snapshot.fps}</dd>
        <dt>位置</dt>
        <dd>{snapshot.position}</dd>
        <dt>模式</dt>
        <dd>{snapshot.mode}</dd>
        <dt>波次</dt>
        <dd>{snapshot.wave}</dd>
        <dt>敌人</dt>
        <dd>{snapshot.enemies}</dd>
        <dt>弹体</dt>
        <dd>{snapshot.projectiles}</dd>
        <dt>机体</dt>
        <dd>{snapshot.skinName}</dd>
        <dt>本地局数</dt>
        <dd>{snapshot.profileRuns}</dd>
        <dt>关卡档案</dt>
        <dd>{snapshot.profileLevel}</dd>
        <dt>升级选择</dt>
        <dd>{snapshot.profileUpgradePicks}</dd>
      </dl>
    </aside>
  );
}

function readDebug(world: GameWorld): DebugSnapshot {
  const position = world.player.position;
  const frameMs = Math.max(0.1, world.frameTimeMs);
  let aliveEnemies = 0;
  for (const enemy of world.enemies) {
    if (enemy.isAlive) aliveEnemies += 1;
  }
  const levelRecord = world.userProfile.levels[world.session.levelId];
  let profileUpgradePicks = 0;
  for (const upgrade of Object.values(world.userProfile.upgrades)) {
    profileUpgradePicks += upgrade.picked;
  }
  return {
    frameMs: frameMs.toFixed(1),
    fps: Math.round(1000 / frameMs).toString(),
    position: `${position.x.toFixed(1)}, ${position.z.toFixed(1)}`,
    projectiles: world.projectiles.length,
    mode: world.session.mode,
    wave: world.session.activeWaveId ?? `${world.session.waveIndex}`,
    enemies: `${aliveEnemies}/${world.enemies.length}`,
    skinName: robotSkins[world.player.skinId].displayName,
    profileRuns: world.userProfile.runsStarted,
    profileLevel: levelRecord ? `${levelRecord.attempts}/${levelRecord.completions}` : "0/0",
    profileUpgradePicks,
  };
}
