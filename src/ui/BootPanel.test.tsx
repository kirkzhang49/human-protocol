import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BootPanel } from "../App";

describe("BootPanel", () => {
  it("renders the circular boot spinner before game assets finish loading", () => {
    const html = renderToStaticMarkup(<BootPanel progress={0.42} language="zh" />);

    expect(html).toContain('class="boot-spinner"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("42%");
  });
});
