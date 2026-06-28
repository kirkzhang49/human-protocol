import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { ConfigValidationIssue } from "../../game/config/ConfigValidator";
import { hasBuilderDraft, loadBuilderDraft, summarizeBuilderSaveProject } from "../BuilderStorage";
import { compileOfficialBuilderDocument } from "./compileOfficialBuilderProjectToLevel";
import { listOfficialBuilderLevelOptions, officialBuilderDocumentFromBuiltInLevel, officialBuilderDocumentFromProject } from "./officialBuilderDocuments";
import type { OfficialBuilderCompileReport } from "./OfficialBuilderTypes";

type OfficialBuilderSourceMode = "draft" | "canonical";

const officialRawRebuildCommand = "npm run build-official:level03:rebuild-raw";
const officialSourceQaCommand = "npm run qa:build-official";

export function OfficialBuilderPage() {
  const options = useMemo(() => listOfficialBuilderLevelOptions(), []);
  const [levelId, setLevelId] = useState(options.find((option) => option.levelId === "level_03_human_museum")?.levelId ?? options[0]?.levelId ?? "");
  const [draftRevision, setDraftRevision] = useState(0);
  const [sourceMode, setSourceMode] = useState<OfficialBuilderSourceMode>(() => (hasBuilderDraft() ? "draft" : "canonical"));
  const [writingSource, setWritingSource] = useState(false);
  const [writeStatus, setWriteStatus] = useState("");
  const localDraft = useMemo(() => {
    if (!hasBuilderDraft()) return null;
    return loadBuilderDraft();
  }, [draftRevision]);
  const canonicalDocument = useMemo(() => officialBuilderDocumentFromBuiltInLevel(levelId), [levelId]);
  const proposedDocument = useMemo(
    () => (localDraft ? officialBuilderDocumentFromProject(levelId, localDraft) : null),
    [levelId, localDraft],
  );
  const activeSourceMode = sourceMode === "draft" && proposedDocument ? "draft" : "canonical";
  const document = activeSourceMode === "draft" ? proposedDocument : canonicalDocument;
  const report = useMemo(() => (document ? compileOfficialBuilderDocument(document) : null), [document]);
  const draftSummary = localDraft ? summarizeBuilderSaveProject(localDraft) : null;
  const draftSourceLevelId = localDraft?.sourceLevel?.levelId ?? null;
  const draftMismatch = Boolean(draftSourceLevelId && draftSourceLevelId !== levelId);
  const canWriteSource = Boolean(
    document && report?.ok && activeSourceMode === "draft" && !draftMismatch && options.some((option) => option.levelId === document.campaign.levelId),
  );

  const writeOfficialSource = async () => {
    if (!document || !canWriteSource) return;
    setWritingSource(true);
    setWriteStatus("Writing official builder source...");
    try {
      const response = await fetch("/__hp_official_builder/write_source", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ levelId: document.campaign.levelId, document }),
      });
      if (!response.ok) throw new Error(await response.text());
      const result = (await response.json()) as { path?: string };
      setWriteStatus(
        `Wrote ${result.path ?? "official builder source"}. ${document.campaign.title} runtime now uses this JSON source. Run ${officialSourceQaCommand} -- --level=${document.campaign.levelId} before checking it in.`,
      );
    } catch (error) {
      setWriteStatus(`Write failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setWritingSource(false);
    }
  };

  if (!import.meta.env.DEV) return <OfficialBuilderShell title="Official Builder Unavailable">Dev-only route.</OfficialBuilderShell>;
  if (!document || !report) return <OfficialBuilderShell title="Official Builder">No formal official level found.</OfficialBuilderShell>;

  return (
    <OfficialBuilderShell title="/build-official">
      <div style={styles.toolbar}>
        <label style={styles.fieldLabel}>
          Level
          <select style={styles.select} value={levelId} onChange={(event) => setLevelId(event.target.value)}>
            {options.map((option) => (
              <option key={option.levelId} value={option.levelId}>
                L{option.ordinal} · {option.title}
              </option>
            ))}
          </select>
        </label>
        <button style={styles.button} type="button" onClick={() => downloadDocument(document)}>
          {activeSourceMode === "draft" ? "Export Proposed Official JSON" : "Export Canonical JSON"}
        </button>
        <button style={styles.button} type="button" onClick={() => setDraftRevision((value) => value + 1)}>
          Refresh /build Draft
        </button>
        <button
          style={styles.button}
          type="button"
          disabled={!localDraft}
          onClick={() => setSourceMode((value) => (value === "draft" ? "canonical" : "draft"))}
        >
          {activeSourceMode === "draft" ? "Use Canonical Source" : "Use /build Draft"}
        </button>
        <button style={styles.button} type="button" onClick={() => window.location.assign(`/build?fromLevel=${encodeURIComponent(levelId)}`)}>
          Open /build
        </button>
        <button
          style={{ ...styles.button, ...(canWriteSource ? {} : styles.disabledButton) }}
          type="button"
          disabled={!canWriteSource || writingSource}
          title={canWriteSource ? "Write this official builder JSON source in the local repo." : "Requires a valid matching /build local draft with passing validation."}
          onClick={() => void writeOfficialSource()}
        >
          {writingSource ? "Writing..." : "Write Source"}
        </button>
      </div>
      {writeStatus ? <p style={writeStatus.startsWith("Write failed") ? styles.warning : styles.writeStatus}>{writeStatus}</p> : null}

      <section style={styles.grid}>
        <Panel title="Source">
          <StatusPillWithLabel ok={activeSourceMode === "draft" ? report.ok && !draftMismatch : report.ok} label={activeSourceMode === "draft" ? "LOCAL DRAFT" : "CANONICAL"} />
          <Metric label="Mode" value={activeSourceMode === "draft" ? "Current /build localStorage" : "Repository JSON runtime source"} />
          <Metric label="Draft source" value={draftSourceLevelId ?? "none"} />
          <Metric label="Draft rooms" value={draftSummary?.rooms ?? 0} />
          <Metric label="Draft props" value={draftSummary?.props ?? 0} />
          {draftMismatch ? <p style={styles.warning}>Draft was imported from {draftSourceLevelId}; selected target is {levelId}.</p> : null}
          {!localDraft ? <p style={styles.hint}>No /build local draft found. Open /build, edit, then return here.</p> : null}
          <p style={styles.hint}>
            Default QA checks repository JSON against the runtime export for every formal official level. Legacy TS parity is optional: npm run qa:build-official -- --parity=legacy-ts.
          </p>
          <p style={styles.hint}>
            After Write Source, run <code style={styles.inlineCode}>{officialSourceQaCommand} -- --level={levelId}</code>. For Level 3 Raw bake changes, also run <code style={styles.inlineCode}>{officialRawRebuildCommand}</code>.
          </p>
        </Panel>

        <Panel title="Document">
          <Metric label="Schema" value={document.schemaVersion} />
          <Metric label="Level" value={document.campaign.levelId} />
          <Metric label="Profile" value={document.contract.profileId} />
          <Metric label="Next" value={document.campaign.nextLevelId ?? "none"} />
        </Panel>

        <Panel title="Compile Gate">
          <StatusPill ok={report.ok} />
          <Metric label="Rooms" value={report.summary.rooms} />
          <Metric label="Doors" value={report.summary.doors} />
          <Metric label="Props" value={report.summary.props} />
          <Metric label="Pickups" value={report.summary.pickups} />
          <Metric label="Robots" value={report.summary.robots} />
          <Metric label="Puzzles" value={report.summary.puzzles} />
        </Panel>

        <Panel title="Validation">
          <Metric label="Compile issues" value={report.compileIssues.length} />
          <Metric label="Config errors" value={report.summary.validationErrors} />
          <Metric label="Config warnings" value={report.validationReport?.warnings.length ?? 0} />
          <Metric label="Bridge errors" value={report.summary.bridgeErrors} />
          <Metric label="Bridge warnings" value={report.bridgeAudit?.warnings.length ?? 0} />
        </Panel>

        <Panel title="Contract Layers">
          <ChipList values={document.contract.globalRules ?? []} />
          <ChipList values={document.contract.roleRules ?? []} />
          <ChipList values={document.contract.levelOverrides ?? []} emptyLabel="No level overrides" />
        </Panel>
      </section>

      <section style={styles.issueGrid}>
        <IssuePanel title="Compile Issues" issues={report.compileIssues} />
        <IssuePanel title="Config Errors" issues={report.validationReport?.errors ?? []} />
        <IssuePanel title="Bridge Errors" issues={report.bridgeAudit?.errors ?? []} />
      </section>

      <pre style={styles.preview}>{JSON.stringify(publicReport(report), null, 2)}</pre>
    </OfficialBuilderShell>
  );
}

function OfficialBuilderShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Human Protocol dev authoring</p>
          <h1 style={styles.title}>{title}</h1>
        </div>
        <span style={styles.devBadge}>DEV ONLY</span>
      </header>
      {children}
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={styles.panel}>
      <h2 style={styles.panelTitle}>{title}</h2>
      <div style={styles.panelBody}>{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
    </div>
  );
}

function StatusPill({ ok }: { ok: boolean }) {
  return <StatusPillWithLabel ok={ok} label={ok ? "PASS" : "FAIL"} />;
}

function StatusPillWithLabel({ ok, label }: { ok: boolean; label: string }) {
  return <div style={{ ...styles.status, ...(ok ? styles.statusOk : styles.statusFail) }}>{label}</div>;
}

function ChipList({ values, emptyLabel = "None" }: { values: readonly string[]; emptyLabel?: string }) {
  if (values.length === 0) return <span style={styles.empty}>{emptyLabel}</span>;
  return (
    <div style={styles.chips}>
      {values.map((value) => (
        <span key={value} style={styles.chip}>
          {value}
        </span>
      ))}
    </div>
  );
}

function IssuePanel({
  title,
  issues,
}: {
  title: string;
  issues: readonly { path?: string; code?: string; message: string }[] | readonly ConfigValidationIssue[];
}) {
  return (
    <Panel title={title}>
      {issues.length === 0 ? (
        <span style={styles.empty}>No issues</span>
      ) : (
        <ol style={styles.issues}>
          {issues.slice(0, 8).map((issue, index) => (
            <li key={`${issue.path ?? issue.code ?? title}-${index}`} style={styles.issue}>
              <strong>{issue.path ?? issue.code ?? "issue"}</strong>
              <span>{issue.message}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function downloadDocument(document: unknown) {
  const blob = new Blob([`${JSON.stringify(document, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = documentCreateAnchor();
  link.href = url;
  link.download = "human-protocol.official-builder.json";
  link.click();
  URL.revokeObjectURL(url);
}

function documentCreateAnchor() {
  const link = window.document.createElement("a");
  link.style.display = "none";
  window.document.body.appendChild(link);
  window.setTimeout(() => link.remove(), 0);
  return link;
}

function publicReport(report: OfficialBuilderCompileReport) {
  return {
    ok: report.ok,
    document: report.document,
    summary: report.summary,
    compileIssues: report.compileIssues,
    validationErrors: report.validationReport?.errors ?? [],
    bridgeErrors: report.bridgeAudit?.errors ?? [],
  };
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    background: "#111316",
    color: "#edf1f7",
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "20px",
  },
  eyebrow: {
    margin: 0,
    color: "#8aa0b6",
    fontSize: "12px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
  },
  title: {
    margin: "4px 0 0",
    fontSize: "28px",
    letterSpacing: 0,
  },
  devBadge: {
    border: "1px solid #4f8cff",
    color: "#9ec1ff",
    padding: "6px 9px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 700,
  },
  toolbar: {
    display: "flex",
    alignItems: "end",
    gap: "10px",
    flexWrap: "wrap" as const,
    marginBottom: "18px",
  },
  fieldLabel: {
    display: "grid",
    gap: "6px",
    color: "#9fb2c8",
    fontSize: "12px",
  },
  select: {
    minWidth: "280px",
    height: "36px",
    borderRadius: "6px",
    border: "1px solid #334252",
    background: "#171c22",
    color: "#edf1f7",
    padding: "0 10px",
  },
  button: {
    height: "36px",
    borderRadius: "6px",
    border: "1px solid #3a4b5d",
    background: "#202936",
    color: "#edf1f7",
    padding: "0 12px",
    fontWeight: 700,
  },
  disabledButton: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "12px",
  },
  issueGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "12px",
    marginTop: "12px",
  },
  panel: {
    border: "1px solid #283542",
    borderRadius: "8px",
    background: "#171c22",
    overflow: "hidden",
  },
  panelTitle: {
    margin: 0,
    padding: "10px 12px",
    borderBottom: "1px solid #283542",
    fontSize: "14px",
    letterSpacing: 0,
  },
  panelBody: {
    display: "grid",
    gap: "8px",
    padding: "12px",
  },
  metric: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    fontSize: "13px",
  },
  metricLabel: {
    color: "#9fb2c8",
  },
  metricValue: {
    color: "#ffffff",
    textAlign: "right" as const,
  },
  status: {
    justifySelf: "start",
    padding: "5px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 800,
  },
  statusOk: {
    background: "#12351f",
    color: "#8ef0a8",
  },
  statusFail: {
    background: "#3a1717",
    color: "#ff9c9c",
  },
  chips: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "6px",
  },
  chip: {
    border: "1px solid #334252",
    borderRadius: "6px",
    padding: "4px 7px",
    color: "#c6d4e3",
    fontSize: "12px",
  },
  empty: {
    color: "#708399",
    fontSize: "13px",
  },
  warning: {
    margin: 0,
    color: "#ffc66d",
    fontSize: "12px",
    lineHeight: 1.4,
  },
  hint: {
    margin: 0,
    color: "#91a5ba",
    fontSize: "12px",
    lineHeight: 1.4,
  },
  inlineCode: {
    color: "#d7e8ff",
    background: "#0d1014",
    border: "1px solid #283542",
    borderRadius: "4px",
    padding: "1px 4px",
    wordBreak: "break-word" as const,
  },
  writeStatus: {
    margin: "-8px 0 14px",
    color: "#8ef0a8",
    fontSize: "13px",
    lineHeight: 1.4,
  },
  issues: {
    margin: 0,
    paddingLeft: "18px",
  },
  issue: {
    display: "grid",
    gap: "3px",
    marginBottom: "8px",
    color: "#d9e4ef",
    fontSize: "12px",
  },
  preview: {
    marginTop: "12px",
    padding: "12px",
    border: "1px solid #283542",
    borderRadius: "8px",
    background: "#0d1014",
    color: "#b8c9db",
    overflow: "auto",
    maxHeight: "360px",
    fontSize: "12px",
  },
} satisfies Record<string, CSSProperties>;
