// 通用确认 modal —— 覆盖玩家手工密室前的二次确认。符合 build 暗色/青调 UI，内联样式不依赖任何现有 CSS。
import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { GameLanguage } from "../game/core/GameSettings";

interface Props {
  open: boolean;
  title: string;
  message: ReactNode;
  language?: GameLanguage;
  confirmLabel?: string;
  cancelLabel?: string;
  busyLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const S: Record<string, CSSProperties> = {
  overlay: { position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(4,8,12,.62)", backdropFilter: "blur(2px)" },
  card: { width: "min(420px, calc(100vw - 32px))", padding: "20px 22px", borderRadius: 16, border: "1px solid rgba(79,214,255,.3)", background: "linear-gradient(180deg, rgba(18,27,36,.99), rgba(11,17,24,.99))", boxShadow: "0 24px 70px -18px rgba(0,0,0,.8)", color: "#d4e3ed" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 10, letterSpacing: ".3px" },
  msg: { fontSize: 13.5, color: "#a9c0d2", lineHeight: 1.6, marginBottom: 20 },
  row: { display: "flex", gap: 10, justifyContent: "flex-end" },
  cancel: { cursor: "pointer", border: "1px solid rgba(79,214,255,.26)", background: "#0d1922", color: "#cfe0ea", borderRadius: 10, padding: "9px 18px", fontSize: 13.5, fontWeight: 600 },
  confirm: { cursor: "pointer", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 13.5, fontWeight: 700, color: "#1a1205", background: "linear-gradient(135deg,#ffb34f,#ff8f4f)", boxShadow: "0 8px 22px -8px rgba(255,143,79,.6)" },
};

export function BuilderConfirmModal({ open, title, message, language = "zh", confirmLabel, cancelLabel, busyLabel, busy, onConfirm, onCancel }: Props) {
  const en = language === "en";
  const resolvedConfirmLabel = confirmLabel ?? (en ? "Confirm" : "确定");
  const resolvedCancelLabel = cancelLabel ?? (en ? "Cancel" : "取消");
  const resolvedBusyLabel = busyLabel ?? (en ? "Working…" : "处理中…");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key === "Enter") onConfirm();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;
  return (
    <div style={S.overlay} onMouseDown={onCancel} role="dialog" aria-modal="true">
      <div style={S.card} onMouseDown={(event) => event.stopPropagation()}>
        <div style={S.title}>{title}</div>
        <div style={S.msg}>{message}</div>
        <div style={S.row}>
          <button type="button" style={S.cancel} disabled={busy} onClick={onCancel}>{resolvedCancelLabel}</button>
          <button type="button" style={S.confirm} disabled={busy} onClick={onConfirm}>{busy ? resolvedBusyLabel : resolvedConfirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
