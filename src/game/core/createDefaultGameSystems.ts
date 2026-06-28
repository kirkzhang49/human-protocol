import type { GameSystem } from "./GameLoop";
import { AimSystem } from "../systems/AimSystem";
import { AudioSystem } from "../systems/AudioSystem";
import { AutoFireSystem } from "../systems/AutoFireSystem";
import { CameraFollowSystem } from "../systems/CameraFollowSystem";
import { DeathReviveSystem } from "../systems/DeathReviveSystem";
import { DialogueSystem } from "../systems/DialogueSystem";
import { DoorSystem } from "../systems/DoorSystem";
import { EnemyAISystem } from "../systems/EnemyAISystem";
import { EnvironmentStateSystem } from "../systems/EnvironmentStateSystem";
import { EffectsSystem } from "../systems/EffectsSystem";
import { ExitFlowSystem } from "../systems/ExitFlowSystem";
import { FocusRevealSystem } from "../systems/FocusRevealSystem";
import { HandInteractionSystem } from "../systems/HandInteractionSystem";
import { InputSystem } from "../systems/InputSystem";
import { InteractionSystem } from "../systems/InteractionSystem";
import { MobileAssistSystem } from "../systems/MobileAssistSystem";
import { ObjectiveTrackerSystem } from "../systems/ObjectiveTrackerSystem";
import { PickupSystem } from "../systems/PickupSystem";
import { PlayerMovementSystem } from "../systems/PlayerMovementSystem";
import { ProjectileSystem } from "../systems/ProjectileSystem";
import { PuzzleSystem } from "../systems/PuzzleSystem";
import { RoomDirectorSystem } from "../systems/RoomDirectorSystem";
import { SceneFlowSystem } from "../systems/SceneFlowSystem";
import { WaveDirectorSystem } from "../systems/WaveDirectorSystem";
import { WaveTriggerBridgeSystem } from "../systems/WaveTriggerBridgeSystem";
import { WeaponSystem } from "../systems/WeaponSystem";

export function createDefaultGameSystems(): GameSystem[] {
  return [
    new InputSystem(),
    new AimSystem(),
    new MobileAssistSystem(),
    new DoorSystem(),
    new PlayerMovementSystem(),
    new RoomDirectorSystem(),
    new ObjectiveTrackerSystem(),
    new InteractionSystem(),
    new HandInteractionSystem(),
    new PickupSystem(),
    new WaveTriggerBridgeSystem(),
    new EnvironmentStateSystem(),
    new WaveDirectorSystem(),
    new EnemyAISystem(),
    new AutoFireSystem(),
    new WeaponSystem(),
    new ProjectileSystem(),
    new PuzzleSystem(),
    new DeathReviveSystem(),
    new DialogueSystem(),
    new ExitFlowSystem(),
    new SceneFlowSystem(),
    new FocusRevealSystem(),
    new AudioSystem(),
    new EffectsSystem(),
    new CameraFollowSystem(),
  ];
}
