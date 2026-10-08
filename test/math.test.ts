import { expect, it } from "vitest";
import { renderFormula } from "../src/markdown/math";

it("рендерит TeX в SVG", () => {
  const f = renderFormula("e=mc^2", false);
  expect(f?.src).toContain("data:image/svg+xml");
  expect(f?.width).toMatch(/ex$/);
});
