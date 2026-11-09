// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "./svg";
const wrap = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120">${body}</svg>`;
describe("SVG import boundary", () => {
  it("preserves paths, gradients, clips and intrinsic dimensions deterministically", () => {
    const source = wrap(
      '<defs><linearGradient id="paint"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient><clipPath id="clip"><rect width="100" height="100"/></clipPath></defs><path d="M0 0h240v120z" fill="url(#paint)" clip-path="url(#clip)"/>',
    );
    const safe = sanitizeSvg(source);
    expect(safe).toMatchObject({ width: 240, height: 120, removed: 0 });
    expect(safe.svg).toContain("linearGradient");
    expect(safe.svg).toContain("url(#paint)");
    expect(sanitizeSvg(source).svg).toBe(safe.svg);
  });
  it("removes executable content and external URLs and reports the change", () => {
    const safe = sanitizeSvg(
      wrap(
        '<script>alert(1)</script><rect width="100" height="100" onload="alert(2)" fill="url(https://evil.test/x)"/>',
      ),
    );
    expect(safe.svg).not.toMatch(/script|onload|https:\/\/evil/);
    expect(safe.removed).toBeGreaterThanOrEqual(3);
  });
  it.each([
    "<text>Hello</text>",
    "<foreignObject/>",
    '<image href="x"/>',
    '<use href="#x"/>',
    "<animate/>",
    '<rect style="fill:red"/>',
    '<rect filter="url(#f)"/>',
    '<rect mask="url(#m)"/>',
  ])(
    "rejects unsupported visual feature %s rather than silently flattening it",
    (body) => {
      expect(() => sanitizeSvg(wrap(body))).toThrow("svgUnsupported");
    },
  );
  it("rejects XML entities, invalid markup and huge surfaces", () => {
    expect(() =>
      sanitizeSvg(
        '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + wrap(""),
      ),
    ).toThrow();
    expect(() => sanitizeSvg("<svg>")).toThrow();
    expect(() =>
      sanitizeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" width="9000" height="10"/>',
      ),
    ).toThrow();
  });
});
