import { createBuilderId, type BuilderProject, type BuilderRobotGroup, type BuilderWaveChainMeta } from "./BuilderTypes";

export function builderWaveChainOrdersForRoom(project: Pick<BuilderProject, "robots">, roomId: string) {
  return [...new Set(project.robots
    .filter((entry) => entry.roomId === roomId)
    .map((entry) => entry.waveChain?.order)
    .filter((order): order is number => typeof order === "number"))]
    .sort((a, b) => a - b);
}

export function builderWaveChainWithOrder(
  project: Pick<BuilderProject, "robots">,
  robot: BuilderRobotGroup,
  order: number,
): BuilderWaveChainMeta {
  const waveChain = robot.waveChain;
  const existing = project.robots.find((entry) =>
    entry.id !== robot.id &&
    entry.roomId === robot.roomId &&
    entry.waveChain?.order === order
  )?.waveChain;
  const sameWave = waveChain?.order === order;
  return {
    ...(sameWave ? waveChain : {}),
    ...(existing ? { waveId: existing.waveId } : {}),
    waveId: existing?.waveId ?? (sameWave ? waveChain?.waveId : undefined) ?? createBuilderId("wave"),
    order,
    label: existing?.label ?? waveChain?.label ?? `波次 ${order}`,
  };
}
