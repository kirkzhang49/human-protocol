import { Component, type ErrorInfo, type ReactNode } from "react";
import { loadGameSettings } from "../game/core/GameSettings";

interface GameErrorBoundaryProps {
  children: ReactNode;
}

interface GameErrorBoundaryState {
  error: Error | null;
}

/**
 * Isolates the game experience and gameplay subtree so that a runtime error
 * renders a recoverable fallback instead of blanking the entire app.
 * Users can retry or reload to return to the main menu.
 */
export class GameErrorBoundary extends Component<GameErrorBoundaryProps, GameErrorBoundaryState> {
  state: GameErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): GameErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[GameErrorBoundary] Game render crashed", error, info.componentStack);
  }

  private retry = () => this.setState({ error: null });

  private reload = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.error) {
      const en = loadGameSettings().language === "en";
      return (
        <div
          className="game-error-fallback"
          role="alert"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100vh",
            backgroundColor: "#1a1a1a",
            color: "#fff",
            padding: "32px",
            textAlign: "center",
            gap: "20px",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ maxWidth: "480px" }}>
            <strong
              style={{
                display: "block",
                fontSize: "24px",
                marginBottom: "12px",
              }}
            >
              {en ? "Game crashed" : "游戏崩溃了"}
            </strong>
            <p
              style={{
                fontSize: "14px",
                opacity: 0.7,
                margin: "0 0 16px 0",
                lineHeight: 1.5,
              }}
            >
              {this.state.error.message || (en ? "An unknown render error occurred." : "渲染时发生未知错误。")}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={this.retry}
              style={{
                padding: "10px 20px",
                fontSize: "14px",
                backgroundColor: "#4a9eff",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: 500,
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#3a8eef")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#4a9eff")}
            >
              {en ? "Retry" : "↻ 重试"}
            </button>
            <button
              type="button"
              onClick={this.reload}
              style={{
                padding: "10px 20px",
                fontSize: "14px",
                backgroundColor: "#666",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: 500,
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#555")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#666")}
            >
              {en ? "Main menu" : "↲ 回主菜单"}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
