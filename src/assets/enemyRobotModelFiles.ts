import hpEnemyClampRepairHorrorUrl from "./models-cooked/enemies/hp_enemy_clamp_repair_horror.glb?url";
import hpEnemyCustodianForemanHorrorUrl from "./models-cooked/enemies/hp_enemy_custodian_foreman_horror.glb?url";
import hpEnemyReclamationMotherFinalHorrorUrl from "./models-cooked/enemies/hp_enemy_reclamation_mother_final_horror.glb?url";
import hpEnemyRepairDroneHorrorUrl from "./models-cooked/enemies/hp_enemy_repair_drone_horror.glb?url";
import hpEnemyShieldTechnicianHorrorUrl from "./models-cooked/enemies/hp_enemy_shield_technician_horror.glb?url";

export const enemyRobotModelFiles = {
  hp_enemy_repair_drone_horror: hpEnemyRepairDroneHorrorUrl,
  hp_enemy_clamp_repair_horror: hpEnemyClampRepairHorrorUrl,
  hp_enemy_shield_technician_horror: hpEnemyShieldTechnicianHorrorUrl,
  hp_enemy_custodian_foreman_horror: hpEnemyCustodianForemanHorrorUrl,
  hp_enemy_reclamation_mother_final_horror: hpEnemyReclamationMotherFinalHorrorUrl,
} as const;
