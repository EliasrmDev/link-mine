import sharp from 'sharp';
import { writeFileSync } from 'fs';

// SVG source for SavePath icon — bookmark ribbon with a path/dot accent
const svgTemplate = (size) => {
  const s = size;
  const pad = Math.round(s * 0.08);
  const w = s - pad * 2;
  const h = s - pad * 2;
  const bx = pad + Math.round(w * 0.18);
  const bw = Math.round(w * 0.64);
  const bh = Math.round(h * 0.82);
  const notch = Math.round(bw * 0.42);
  const r = Math.round(s * 0.09);
  const dotR = Math.round(s * 0.085);
  const dotCx = Math.round(s / 2);
  const dotCy = bx + Math.round(bh * 0.36);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
    <linearGradient id="bm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="100%" stop-color="#e0e7ff" stop-opacity="1"/>
    </linearGradient>
  </defs>
  <!-- background rounded rect -->
  <rect width="${s}" height="${s}" rx="${r}" ry="${r}" fill="url(#bg)"/>
  <!-- bookmark shape -->
  <path d="M${bx},${pad} h${bw} a2,2 0 0 1 2,2 v${bh} l-${notch},-${Math.round(notch * 0.7)} l-${bw - notch},${Math.round(notch * 0.7)} v-${bh} a2,2 0 0 1 2,-2 z"
        fill="url(#bm)" opacity="0.92"/>
  <!-- accent dot -->
  <circle cx="${dotCx}" cy="${dotCy}" r="${dotR}" fill="#6366f1"/>
</svg>`;
};

const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  const svg = Buffer.from(svgTemplate(size));
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(`icon${size}.png`);
  console.log(`✓ icon${size}.png`);
}

console.log('Done!');
