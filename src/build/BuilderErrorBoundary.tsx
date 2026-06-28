import { Component, type ErrorInfo, type ReactNode } from "react";
import type { GameLanguage } from "../game/core/GameSettings";

interface BuilderErrorBoundaryProps {
  /** Short label for what failed, shown in the fallback. */
  label: string;
  /** Editor chrome language; defaults to zh (class component can't read context). */
  language?: GameLanguage;
  children: ReactNode;
}

interface BuilderErrorBoundaryState {
  error: Error | null;
}

/**
 * Isolates a crash-prone subtree (the r3f 3D stage in particular) so one bad
 * mesh / asset / overlay throw renders a recoverable fallback instead of
 * blanking the whole editor. The user can retry without losing their project.
 */
export class BuilderErrorBoundary extends Component<BuilderErrorBoundaryProps, BuilderErrorBoundaryState> {
  state: BuilderErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BuilderErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[builder] ${this.props.label} crashed`, error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      const en = this.props.language === "en";
      return (
        <div className="builder-error-fallback" role="alert">
          <strong>{en ? `${this.props.label} failed` : `${this.props.label}出错了`}</strong>
          <p>{this.state.error.message || (en ? "An unknown rendering error occurred." : "渲染时发生未知错误。")}</p>
          <button type="button" onClick={this.reset}>
            {en ? "↻ Retry" : "↻ 重试"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
