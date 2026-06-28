import type { DialogueLineState } from "../game/core/GameMode";
import { localizedCueLabel } from "../game/config/LevelLocalization";
import type { GameWorld } from "../game/core/GameWorld";
import { requestDesktopPointerLock } from "./desktopPointerLock";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface DialogueOverlayProps {
  world: GameWorld;
}

export function DialogueOverlay({ world }: DialogueOverlayProps) {
  const line = usePolledSnapshot(() => world.session.activeDialogue, 100, sameDialogueLine);

  if (!line) return null;

  const cue = localizedCueLabel(line.tone, world.settings.language);
  const showSpeaker = line.speaker !== cue;

  return (
    <button
      className={`dialogue-toast ${line.tone}`}
      type="button"
      onClick={() => {
        world.skipDialogue();
        requestDesktopPointerLock();
      }}
      aria-live="assertive"
    >
      <em>{cue}</em>
      {showSpeaker ? <span>{line.speaker}</span> : null}
      <strong>{line.line}</strong>
      <i style={{ "--dialogue-duration": `${line.total}s` } as React.CSSProperties} />
    </button>
  );
}

function sameDialogueLine(current: DialogueLineState | null, next: DialogueLineState | null) {
  return current?.id === next?.id;
}
