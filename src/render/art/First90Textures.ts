import { useTexture } from "@react-three/drei";
import { useMemo } from "react";
import { ClampToEdgeWrapping, SRGBColorSpace, Texture } from "three";
import clampBotUrl from "../../assets/first90/clamp-bot.jpg";
import cockpitWeaponBoardUrl from "../../assets/first90/cockpit-weapon-board.jpg";
import clampBotAtlasUrl from "../../assets/enemy-atlas/clamp-bot-atlas.jpg";
import custodianBossAtlasUrl from "../../assets/enemy-atlas/custodian-boss-atlas.jpg";
import environmentTrimSheetUrl from "../../assets/environment/environment-trim-sheet-01.jpg";
import floorWallSurfaceAtlasUrl from "../../assets/environment/floor-wall-surface-atlas-01.jpg";
import maintenancePanelsUrl from "../../assets/first90/maintenance-bay-panels.jpg";
import propsDecalAtlasUrl from "../../assets/environment/props-decal-atlas-01.jpg";
import repairDroneAtlasUrl from "../../assets/enemy-atlas/repair-drone-atlas.jpg";
import repairDroneUrl from "../../assets/first90/repair-drone.jpg";
import roomBackdropsUrl from "../../assets/environment/room-backdrops-01.jpg";
import shieldTechUrl from "../../assets/first90/shield-tech.jpg";

export interface First90Textures {
  maintenancePanels: Texture;
  cockpitWeaponBoard: Texture;
  repairDrone: Texture;
  clampBot: Texture;
  shieldTech: Texture;
  repairDroneAtlas: Texture;
  clampBotAtlas: Texture;
  custodianBossAtlas: Texture;
  environmentTrimSheet: Texture;
  floorWallSurfaceAtlas: Texture;
  roomBackdrops: Texture;
  propsDecalAtlas: Texture;
}

export function useFirst90Textures(): First90Textures {
  const textures = useTexture({
    maintenancePanels: maintenancePanelsUrl,
    cockpitWeaponBoard: cockpitWeaponBoardUrl,
    repairDrone: repairDroneUrl,
    clampBot: clampBotUrl,
    shieldTech: shieldTechUrl,
    repairDroneAtlas: repairDroneAtlasUrl,
    clampBotAtlas: clampBotAtlasUrl,
    custodianBossAtlas: custodianBossAtlasUrl,
    environmentTrimSheet: environmentTrimSheetUrl,
    floorWallSurfaceAtlas: floorWallSurfaceAtlasUrl,
    roomBackdrops: roomBackdropsUrl,
    propsDecalAtlas: propsDecalAtlasUrl,
  }) as First90Textures;

  return useMemo(() => {
    Object.values(textures).forEach((texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = ClampToEdgeWrapping;
      texture.wrapT = ClampToEdgeWrapping;
      texture.anisotropy = 4;
    });
    return textures;
  }, [textures]);
}
