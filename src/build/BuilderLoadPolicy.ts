import type { BuilderProject } from "./BuilderTypes";
import { normalizeOfficialBuilderProject } from "./BuilderLevelImport";

export function normalizeBuilderProjectForBoot(
  project: BuilderProject,
  options: { officialImport: boolean },
): BuilderProject {
  return options.officialImport ? normalizeOfficialBuilderProject(project) : stripCompiledWaveEchoRobots(project);
}

function stripCompiledWaveEchoRobots(project: BuilderProject): BuilderProject {
  const removedRobotIds = new Set<string>();
  const removedWaveIds = new Set<string>();
  const robots = project.robots.filter((robot) => {
    if (!isCompiledWaveEchoRobot(robot)) return true;
    removedRobotIds.add(robot.id);
    if (robot.wave?.id) removedWaveIds.add(robot.wave.id);
    return false;
  });
  if (robots.length === project.robots.length) return project;
  return {
    ...project,
    robots,
    doors: project.doors.map((door) => {
      const surviveRobotIds = door.surviveRobotIds?.filter((robotId) => !removedRobotIds.has(robotId));
      const waveIds = door.waveIds?.filter((waveId) => !removedWaveIds.has(waveId));
      return {
        ...door,
        surviveRobotId: door.surviveRobotId && removedRobotIds.has(door.surviveRobotId) ? surviveRobotIds?.[0] : door.surviveRobotId,
        ...(door.surviveRobotIds ? { surviveRobotIds } : {}),
        waveId: door.waveId && removedWaveIds.has(door.waveId) ? waveIds?.[0] : door.waveId,
        ...(door.waveIds ? { waveIds } : {}),
      };
    }),
  };
}

function isCompiledWaveEchoRobot(robot: BuilderProject["robots"][number]) {
  return Boolean(robot.wave?.id?.startsWith("wave_") && robot.id.startsWith("robot_wave_"));
}
