/**
 * AGE adapter smoke check.
 *
 * Converts the existing generated raw WebGPU render plans into AGE asset
 * bundles, render plans, and one synthetic runtime scene frame, then runs the
 * engine's schema/readiness/runtime validations and count parity assertions.
 * No GPU resources are created and no generated assets are modified.
 *
 * Run: npm run smoke:age-adapter
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AgeAssetRegistry,
  AgeGroundingPass,
  ageRoomLightBudgetFor,
  validateAgeAssetBundleSchema,
  validateAgePreBackportReadiness,
  type AgeDiagnostic,
} from "@age/render-webgpu";
import {
  createHumanAgeAssetBundle,
  createHumanAgeSceneFrame,
  humanAgeBaseLightingFrame,
  humanEscapeRoomVisualProfileFor,
  humanLevelToAgeRenderPlan,
  type HumanAgeWorldView,
} from "../../src/adapters/age";
import type { RawRenderPlan } from "../../src/render/raw-webgpu/RawWebGpuTypes";

const manifestDir = join(process.cwd(), "src/assets/manifests/generated/raw-webgpu");
const planFiles = readdirSync(manifestDir)
  .filter((file) => /^render_plan_.*\.json$/.test(file))
  .sort();

if (planFiles.length <= 0) {
  throw new Error(`No generated render plans found in ${manifestDir}.`);
}

const identityMat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
let failures = 0;
const summaries: Record<string, unknown>[] = [];

for (const planFile of planFiles) {
  const plan = JSON.parse(readFileSync(join(manifestDir, planFile), "utf8")) as RawRenderPlan;
  const problems: string[] = [];
  const warnings: string[] = [];

  const bundle = createHumanAgeAssetBundle(plan);
  const registry = new AgeAssetRegistry();
  registry.registerBundle(bundle);
  collectDiagnostics(validateAgeAssetBundleSchema(bundle), problems, warnings);

  const rawGeometryAssetCount = plan.geometry?.assets.length ?? 0;
  const rawTextureCount = (plan.geometry?.baseColorTextures?.length ?? 0) + (plan.geometry?.materialTextures?.length ?? 0);
  assertEqual(problems, "bundle geometry asset count", bundle.geometry?.assets.length ?? 0, rawGeometryAssetCount);
  assertEqual(problems, "bundle texture count", bundle.textures?.length ?? 0, rawTextureCount);

  const conversion = humanLevelToAgeRenderPlan(plan);
  warnings.push(...(conversion.warnings ?? []));
  const agePlan = conversion.value;
  assertEqual(problems, "plan instance count", agePlan.instances.length, plan.instances.length);
  assertEqual(problems, "plan material count", agePlan.materials.length, plan.geometry?.materials?.length ?? 0);
  assertEqual(problems, "plan room count", agePlan.rooms?.length ?? 0, plan.rooms.length);
  assertEqual(problems, "plan light count", agePlan.lights?.length ?? 0, plan.lights?.length ?? 0);
  assertEqual(
    problems,
    "plan visibility scenario count",
    agePlan.visibilityScenarios?.length ?? 0,
    plan.visibilityScenarios.length,
  );

  collectDiagnostics(validateAgePreBackportReadiness({ assets: registry, renderPlan: agePlan }), problems, warnings);

  const readyModelKey = plan.geometry?.assets.find((asset) => asset.status === "ready" && asset.vertexCount > 0)?.modelKey;
  const world = syntheticWorldView(plan.level.id, readyModelKey);
  const frameResult = createHumanAgeSceneFrame({
    world,
    camera: {
      viewMatrix: identityMat4,
      projectionMatrix: identityMat4,
      viewProjectionMatrix: identityMat4,
      position: { x: 0, y: 1.6, z: 4 },
    },
    viewport: { width: 1280, height: 720, pixelRatio: 1 },
    deltaSeconds: 1 / 60,
    elapsedSeconds: 2,
    lighting: humanAgeBaseLightingFrame(plan),
    assets: registry,
  });
  warnings.push(...(frameResult.warnings ?? []));
  const frame = frameResult.value;

  const expectedDynamicInstances = world.enemies.length + world.pickups.filter((pickup) => !pickup.collected).length;
  assertEqual(problems, "frame dynamic instance count", frame.instances.length, expectedDynamicInstances);
  assertEqual(problems, "frame contact count", frame.contacts?.length ?? 0, expectedDynamicInstances);
  assertEqual(problems, "frame portal count", frame.portalStates?.length ?? 0, world.level.map?.doors.length ?? 0);
  assertEqual(problems, "frame projectile count", frame.projectiles?.length ?? 0, world.projectiles.length);
  assertEqual(problems, "frame emitter count", frame.particleEmitters?.length ?? 0, world.effects.length);
  if (readyModelKey && !frame.drawBatches.some((batch) => batch.vertexBufferId === "geometry")) {
    problems.push(`No frame draw batch resolved packed geometry for modelKey "${readyModelKey}".`);
  }
  for (const warning of frameResult.warnings ?? []) {
    if (warning.includes("age.frame.")) {
      problems.push(`Runtime frame validation flagged: ${warning}`);
    }
  }

  const profile = humanEscapeRoomVisualProfileFor(plan);
  assertEqual(problems, "visual profile room count", Object.keys(profile.rooms).length, plan.lightingProfiles?.length ?? 0);
  for (const roomId of Object.keys(profile.rooms)) {
    for (const tier of ["high", "balanced", "rescue"] as const) {
      const budget = ageRoomLightBudgetFor(profile, roomId, tier);
      if (budget < 1 || budget > 10) {
        problems.push(`visual profile light budget out of range for ${roomId}/${tier}: ${budget}.`);
      }
    }
  }
  if (profile.grounding.strengthScale < 0.6 || profile.grounding.strengthScale > 1.6) {
    problems.push(`visual profile grounding strength out of range: ${profile.grounding.strengthScale}.`);
  }
  if (!profile.roleTuning.some((tuning) => tuning.emissiveBoost > 1)) {
    problems.push("visual profile must boost at least one emissive role.");
  }

  const groundingPass = new AgeGroundingPass();
  const quads = groundingPass.planQuads(frame.contacts ?? [], profile.grounding);
  if (quads.length <= 0 || quads.length > (frame.contacts?.length ?? 0)) {
    problems.push(`grounding pass planned ${quads.length} quads from ${frame.contacts?.length ?? 0} contacts.`);
  }
  if (quads.some((quad) => quad.opacity <= 0 || quad.opacity > 0.42 || quad.halfExtents[0] > profile.grounding.maxRadius)) {
    problems.push("grounding quads violate opacity/radius policy.");
  }

  if (problems.length > 0) failures += 1;
  summaries.push({
    plan: planFile,
    levelId: plan.level.id,
    instances: agePlan.instances.length,
    materials: agePlan.materials.length,
    geometryAssets: bundle.geometry?.assets.length ?? 0,
    textures: bundle.textures?.length ?? 0,
    frameInstances: frame.instances.length,
    profileRooms: Object.keys(profile.rooms).length,
    groundingQuads: quads.length,
    warnings: warnings.length,
    problems,
  });
}

console.log(JSON.stringify({ checkedPlans: planFiles.length, failures, levels: summaries }, null, 2));
if (failures > 0) {
  console.error(`AGE adapter smoke failed for ${failures} of ${planFiles.length} plans.`);
  process.exit(1);
}
console.log("AGE adapter smoke passed.");

function collectDiagnostics(diagnostics: readonly AgeDiagnostic[], problems: string[], warnings: string[]) {
  for (const diagnostic of diagnostics) {
    const line = `[${diagnostic.code}] ${diagnostic.message}`;
    if (diagnostic.severity === "error") problems.push(line);
    else warnings.push(line);
  }
}

function assertEqual(problems: string[], label: string, actual: number, expected: number) {
  if (actual !== expected) {
    problems.push(`${label}: expected ${expected}, got ${actual}.`);
  }
}

function syntheticWorldView(levelId: string, enemyModelKey: string | undefined): HumanAgeWorldView {
  const openDoorIds = new Set(["age_smoke_door_open"]);
  return {
    frameIndex: 120,
    level: {
      id: levelId,
      map: { doors: [{ id: "age_smoke_door_open" }, { id: "age_smoke_door_closed" }] },
    },
    player: { position: { x: 0, y: 0, z: 0 } },
    enemies: [
      {
        id: 1,
        archetypeId: "sentinel",
        position: { x: 2, y: 0, z: -3 },
        velocity: { x: 0.8, y: 0, z: 0 },
        radius: 0.5,
        rotationY: 0.7,
        isAlive: true,
        spawnAge: 3.2,
        hitReact: 0,
        deathAge: 0,
        visualScaleMultiplier: 1,
        modelKey: enemyModelKey,
      },
      {
        id: 2,
        archetypeId: "repair_drone",
        position: { x: -1.5, y: 1.2, z: 1 },
        velocity: { x: 0, y: 0, z: 0 },
        radius: 0.35,
        rotationY: -1.1,
        isAlive: false,
        spawnAge: 6,
        hitReact: 0,
        deathAge: 0.4,
        visualScaleMultiplier: 0.9,
      },
    ],
    pickups: [
      { id: 10, type: "coreCell", position: { x: 1, y: 0.4, z: 2 }, age: 1.5, collected: false },
      { id: 11, type: "repairKit", position: { x: -2, y: 0.4, z: -1 }, age: 0.4, collected: false },
      { id: 12, type: "ironRod", position: { x: 0, y: 0.4, z: 0 }, age: 0.2, collected: true },
    ],
    projectiles: [
      {
        id: 20,
        weaponId: "pulseRifle",
        position: { x: 0.4, y: 1.2, z: -1 },
        direction: { x: 0, y: 0, z: -1 },
        radius: 0.08,
        age: 0.1,
        lifetime: 1.2,
        damage: 12,
      },
    ],
    effects: [
      {
        id: 30,
        type: "muzzleFlash",
        position: { x: 0.4, y: 1.2, z: -0.6 },
        direction: { x: 0, y: 0, z: -1 },
        age: 0.02,
        lifetime: 0.12,
        intensity: 1.4,
      },
    ],
    renderPerformance: { quality: { tier: "balanced" } },
    isDoorOpen: (doorId: string) => openDoorIds.has(doorId),
  };
}
