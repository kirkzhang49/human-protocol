import { Preload } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { PerspectiveCamera, Vector3, type Group } from "three";
import { modelKeyForEnemy, preloadEnemyModelAssets, type EnemyModelKey } from "../../assets/enemyModelAssets";
import { enemyArchetypes } from "../../game/config/enemyArchetypes";
import { playerConfig } from "../../game/config/playerConfig";
import type { GameWorld } from "../../game/core/GameWorld";
import type { EnemyState } from "../../game/entities/EnemyState";
import { EnemyModelInstance } from "./EnemyModelInstance";
import {
  enemyModelAltitude,
  enemyModelTargetHeight,
  enemyUsesBossMaterialFinish,
  isEnemyOccludedForThreeOracle,
  isEnemyRoomVisibleForThreeOracle,
  shouldRenderEnemyWithThreeOracle,
} from "./EnemyOraclePolicy";

interface EnemyThreeOracleProps {
  world: GameWorld;
  allEnemies?: boolean;
  showDebugUi?: boolean;
}

interface OracleEnemyEntry {
  id: number;
  enemy: GameWorld["enemies"][number];
  modelKey: EnemyModelKey;
}

export function EnemyThreeOracle({ world, allEnemies = false, showDebugUi = false }: EnemyThreeOracleProps) {
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    preloadEnemyModelAssets()
      .then(() => {
        if (!disposed) setReady(true);
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setFailure(error instanceof Error ? error.message : "Three enemy oracle failed to load.");
      });
    return () => {
      disposed = true;
    };
  }, []);

  return (
    <div className="raw-three-enemy-oracle" aria-hidden="true">
      {ready ? (
        <Canvas
          className="raw-three-enemy-oracle-canvas"
          dpr={[1, 1.25]}
          camera={{ position: [0, 1.45, 0], fov: 72, near: 0.05, far: 90 }}
          gl={{ alpha: true, antialias: true, depth: true, stencil: false, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <EnemyThreeOracleCamera world={world} />
          <ambientLight intensity={0.44} color="#d8d1c4" />
          <hemisphereLight args={["#ffe8c4", "#121716", 0.82]} />
          <directionalLight position={[-3.6, 5.2, 4.4]} intensity={1.22} color="#ffe2b5" />
          <directionalLight position={[3.4, 2.2, 3.1]} intensity={0.38} color="#c5d2cc" />
          <pointLight position={[0.2, 1.9, 2.8]} intensity={0.46} color="#ffd08a" distance={6.4} />
          <EnemyThreeOracleEnemies world={world} allEnemies={allEnemies} />
          <Preload all />
        </Canvas>
      ) : showDebugUi ? (
        <div className="raw-three-enemy-oracle-status">{failure ?? "Loading Three enemy oracle"}</div>
      ) : null}
      {showDebugUi ? (
        <div className="raw-three-enemy-oracle-label">
          <span>THREE ENEMY ORACLE</span>
          <strong>{allEnemies ? "all live enemies" : "authored complex enemies"}</strong>
        </div>
      ) : null}
    </div>
  );
}

function EnemyThreeOracleCamera({ world }: EnemyThreeOracleProps) {
  const { camera } = useThree();
  const lookTarget = useMemo(() => new Vector3(), []);
  const shakeOffset = useMemo(() => new Vector3(), []);
  const cameraPosition = useMemo(() => new Vector3(), []);

  useFrame((state, delta) => {
    const player = world.player;
    const shake = world.camera.shake;
    const rumble = world.camera.rumbleRemaining > 0 ? world.camera.rumble : 0;
    const rumbleEnvelope = rumble > 0 ? Math.min(1, world.camera.rumbleRemaining * 4) : 0;
    const seed = world.camera.shakeSeed;
    const recoil = player.weaponRecoil * 0.055;
    const elapsed = state.clock.elapsedTime;

    shakeOffset.set(
      Math.sin(elapsed * 55 + seed * 1.7) * shake * 0.1,
      Math.cos(elapsed * 45 + seed) * shake * 0.045,
      Math.sin(elapsed * 47 + seed * 2.4) * shake * 0.1 + recoil,
    );
    if (rumble > 0) {
      shakeOffset.x += Math.sin(elapsed * 17 + seed * 0.8) * rumble * rumbleEnvelope * 0.11;
      shakeOffset.y += Math.cos(elapsed * 13 + seed * 1.1) * rumble * rumbleEnvelope * 0.055;
      shakeOffset.z += Math.sin(elapsed * 11 + seed * 1.4) * rumble * rumbleEnvelope * 0.14;
    }

    cameraPosition.copy(player.position);
    cameraPosition.y += playerConfig.cockpitHeight;
    cameraPosition.add(shakeOffset);
    lookTarget.copy(cameraPosition).addScaledVector(player.aimDirection, 10);
    const combatFocus =
      world.camera.combatFocusTotal > 0
        ? Math.max(0, Math.min(1, world.camera.combatFocusRemaining / world.camera.combatFocusTotal)) * world.camera.combatFocusStrength
        : 0;
    if (combatFocus > 0.001) {
      lookTarget.lerp(world.camera.combatFocusTarget, Math.min(0.68, combatFocus));
      cameraPosition.addScaledVector(player.aimDirection, combatFocus * 0.18);
    }

    camera.position.lerp(cameraPosition, 1 - Math.exp(-18 * delta));
    camera.lookAt(lookTarget);
    if (camera instanceof PerspectiveCamera) {
      camera.fov = 72 + world.camera.fovKick;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

function EnemyThreeOracleEnemies({ world, allEnemies = false }: EnemyThreeOracleProps) {
  const [entries, setEntries] = useState<OracleEnemyEntry[]>(() => collectOracleEnemies(world, allEnemies));
  const lastSignatureRef = useRef("");

  useFrame(() => {
    const nextEntries = collectOracleEnemies(world, allEnemies);
    const signature = nextEntries.map((entry) => `${entry.id}:${entry.modelKey}`).join("|");
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;
    setEntries(nextEntries);
  });

  return (
    <>
      {entries.map((entry) => (
        <EnemyThreeOracleEnemy key={entry.id} entry={entry} />
      ))}
    </>
  );
}

function EnemyThreeOracleEnemy({ entry }: { entry: OracleEnemyEntry }) {
  const rootRef = useRef<Group>(null);
  const animationNameRef = useRef("idle");

  useFrame(() => {
    const enemy = entry.enemy;
    const root = rootRef.current;
    if (!root) return;
    root.visible = enemy.isAlive;
    if (!enemy.isAlive) return;
    root.position.copy(enemy.position);
    root.position.y += enemyModelAltitude(enemy);
    root.rotation.set(0, enemy.rotationY, 0);
    root.scale.setScalar(enemy.visualScaleMultiplier);
    animationNameRef.current = enemyModelAnimationName(enemy);
  });

  return (
    <group ref={rootRef}>
      <EnemyModelInstance
        modelKey={entry.modelKey}
        targetHeight={enemyModelTargetHeight(entry.enemy, entry.modelKey)}
        animationNameRef={animationNameRef}
        materialFinish={enemyUsesBossMaterialFinish(entry.enemy) ? "boss" : "matte"}
        castShadow={false}
        receiveShadow={false}
      />
    </group>
  );
}

function collectOracleEnemies(world: GameWorld, allEnemies: boolean) {
  const maxEnemies = rawThreeEnemyOracleMaxEnemies();
  const entries: OracleEnemyEntry[] = [];
  for (const enemy of world.enemies) {
    if (!enemy.isAlive) continue;
    const modelKey = modelKeyForEnemy(enemy);
    if (!modelKey) continue;
    if (!allEnemies && !shouldRenderEnemyWithThreeOracle(enemy, modelKey)) continue;
    if (!allEnemies && enemy.spawnRoomId && !isEnemyRoomVisibleForThreeOracle(world, enemy.spawnRoomId)) continue;
    if (!allEnemies && isEnemyOccludedForThreeOracle(world, enemy)) continue;
    entries.push({ id: enemy.id, enemy, modelKey });
    if (entries.length >= maxEnemies) break;
  }
  return entries;
}

function rawThreeEnemyOracleMaxEnemies() {
  const params = new URLSearchParams(window.location.search);
  const parsed = Number(params.get("enemyOracleMax") ?? 48);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(96, Math.floor(parsed))) : 48;
}

function enemyModelAnimationName(enemy: EnemyState) {
  if (!enemy.isAlive) return "death";
  if (enemy.spawnAge < 0.44) return "spawn_boot";
  if (enemy.staggerRemaining > 0) return "stagger";
  if (enemy.attackWindupRemaining > 0) return "attack_windup";
  const archetype = enemyArchetypes[enemy.archetypeId];
  const cooldown = archetype.attackCooldown * enemy.attackCooldownMultiplier;
  const sinceAttack = cooldown - enemy.attackCooldownRemaining;
  if (sinceAttack >= 0 && sinceAttack < 0.24) return "attack_windup";
  if (sinceAttack >= 0.24 && sinceAttack < 0.58) return "attack_strike";
  if (sinceAttack >= 0.58 && sinceAttack < 0.98) return "attack_recover";
  if (enemy.velocity.lengthSq() > 0.04) return "move";
  return "idle";
}
