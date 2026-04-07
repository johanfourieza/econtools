// One-shot script to regenerate every Kabbo logo asset from a single source
// of truth (the parameters below). Edit numbers, rerun, commit the new assets.
//
// Outputs:
//   public/kabbo-logo.svg          — canonical vector source
//   public/favicon-16.png          — favicon (small)
//   public/favicon-32.png          — favicon (standard)
//   public/apple-touch-icon.png    — 180×180 apple touch icon
//   public/og-image.png            — 1200×630 social preview
//   kabbo-logo-preview.png         — 512×512 reference render (gitignored)
//   kabbo-logo-sizes.png           — multi-size preview grid (gitignored)
//
// Setup (one-time, sharp is intentionally NOT in package.json to keep the
// runtime install lean):
//   npm install --no-save sharp
//
// Then run:
//   node generate-logo.mjs
//
// If you tweak the geometry here, also update src/components/KabboLogo.tsx
// so the live React component matches the rasterised assets.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

// ─── Logo geometry (mirrors src/components/KabboLogo.tsx) ────────────────────
const cx = 24;
const cy = 24;
const petalCount = 32;
const STROKE = 0.9;
const DISC_R = 4.5;
const FG = '#1f2937'; // slate-800

const longPetals = Array.from({ length: petalCount }, (_, i) => {
  const a = (i * 2 * Math.PI) / petalCount;
  return {
    x1: cx + 8 * Math.cos(a),
    y1: cy + 8 * Math.sin(a),
    x2: cx + 23 * Math.cos(a),
    y2: cy + 23 * Math.sin(a),
  };
});

const shortPetals = Array.from({ length: petalCount }, (_, i) => {
  const a = ((i + 0.5) * 2 * Math.PI) / petalCount;
  return {
    x1: cx + 7.5 * Math.cos(a),
    y1: cy + 7.5 * Math.sin(a),
    x2: cx + 17.5 * Math.cos(a),
    y2: cy + 17.5 * Math.sin(a),
  };
});

const fmt = (n) => n.toFixed(3);
const lineEl = (p) =>
  `  <line x1="${fmt(p.x1)}" y1="${fmt(p.y1)}" x2="${fmt(p.x2)}" y2="${fmt(p.y2)}"/>`;

/**
 * Build the flower SVG body (without the outer <svg> wrapper) so it can be
 * embedded in larger compositions like the OG image.
 */
function flowerBody(color = FG) {
  return `<g stroke="${color}" stroke-width="${STROKE}" stroke-linecap="round" fill="none">
${[...longPetals, ...shortPetals].map(lineEl).join('\n')}
</g>
<circle cx="${cx}" cy="${cy}" r="${DISC_R}" fill="${color}"/>`;
}

function standaloneSvg(pixelSize = 512, color = FG) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${pixelSize}" height="${pixelSize}">
${flowerBody(color)}
</svg>
`;
}

// ─── Simplified flower for the 16×16 favicon ────────────────────────────────
// At 16px the dense 64-petal version blurs into a dot. This stripped-down
// variant uses 12 chunky petals and a larger center so the flower silhouette
// survives. Used only for favicon-16.png — every other asset uses the full
// 64-petal flower.
const TINY_PETALS = 12;
const TINY_STROKE = 3;
const TINY_DISC_R = 7;

const tinyPetalLines = Array.from({ length: TINY_PETALS }, (_, i) => {
  const a = (i * 2 * Math.PI) / TINY_PETALS;
  return {
    x1: cx + 10 * Math.cos(a),
    y1: cy + 10 * Math.sin(a),
    x2: cx + 23 * Math.cos(a),
    y2: cy + 23 * Math.sin(a),
  };
});

function tinyFlowerSvg(pixelSize) {
  const lines = tinyPetalLines.map(lineEl).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${pixelSize}" height="${pixelSize}">
<g stroke="${FG}" stroke-width="${TINY_STROKE}" stroke-linecap="round" fill="none">
${lines}
</g>
<circle cx="${cx}" cy="${cy}" r="${TINY_DISC_R}" fill="${FG}"/>
</svg>
`;
}

// ─── Write the canonical SVG ─────────────────────────────────────────────────
const svgPath = resolve('public/kabbo-logo.svg');
writeFileSync(svgPath, standaloneSvg(512));
console.log('Wrote', svgPath);

// ─── Render the 512×512 reference PNG ────────────────────────────────────────
async function renderToPng(svgString, outPath, w, h) {
  await sharp(Buffer.from(svgString)).resize(w, h).png().toFile(outPath);
  console.log('Wrote', outPath);
}

await renderToPng(
  standaloneSvg(512),
  resolve('kabbo-logo-preview.png'),
  512,
  512
);

// ─── Favicon PNGs ────────────────────────────────────────────────────────────
await renderToPng(tinyFlowerSvg(16), resolve('public/favicon-16.png'), 16, 16);
// Dev preview of the simplified favicon at a legible size (gitignored)
await renderToPng(tinyFlowerSvg(128), resolve('kabbo-favicon16-preview.png'), 128, 128);
await renderToPng(standaloneSvg(32), resolve('public/favicon-32.png'), 32, 32);
await renderToPng(
  standaloneSvg(180),
  resolve('public/apple-touch-icon.png'),
  180,
  180
);

// ─── Multi-size preview grid (dev artifact, helps verify legibility) ─────────
const sizes = [16, 28, 32, 40, 56, 96, 180];
const padding = 20;
const labelHeight = 24;
const cellWidth = 200;
const gridWidth = sizes.length * cellWidth + padding * 2;
const gridHeight = 200 + labelHeight + padding * 2;

const cells = sizes
  .map((s, i) => {
    const cellX = padding + i * cellWidth;
    const iconX = cellX + (cellWidth - s) / 2;
    const iconY = padding + (200 - s) / 2;
    const labelX = cellX + cellWidth / 2;
    const labelY = padding + 200 + 18;
    return `<g transform="translate(${iconX}, ${iconY})">
  <svg viewBox="0 0 48 48" width="${s}" height="${s}">${flowerBody()}</svg>
</g>
<text x="${labelX}" y="${labelY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#64748b">${s}px</text>`;
  })
  .join('\n');

const gridSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${gridWidth}" height="${gridHeight}" viewBox="0 0 ${gridWidth} ${gridHeight}">
<rect width="100%" height="100%" fill="#ffffff"/>
${cells}
</svg>`;

await renderToPng(
  gridSvg,
  resolve('kabbo-logo-sizes.png'),
  gridWidth,
  gridHeight
);

// ─── Open-Graph social card (1200×630) ───────────────────────────────────────
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <!-- Flower icon, left side -->
  <g transform="translate(150, 155) scale(7.92)">
    ${flowerBody()}
  </g>
  <!-- Wordmark + tagline, right side -->
  <text x="560" y="290" font-family="Georgia, 'Times New Roman', serif" font-size="140" font-weight="700" fill="#0f172a">Kabbo</text>
  <text x="563" y="350" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#475569">Academic publication pipeline</text>
  <text x="563" y="410" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#94a3b8">kabbo.app</text>
  <!-- Thin accent rule beneath the wordmark -->
  <line x1="563" y1="445" x2="780" y2="445" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>
</svg>`;

await renderToPng(ogSvg, resolve('public/og-image.png'), 1200, 630);

console.log('\nAll assets generated successfully.');
