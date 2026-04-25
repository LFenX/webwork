const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const publicDir = path.join(__dirname, '..', 'public');

// SVG template for the icon
function iconSvg(size) {
  const fontSize = Math.max(Math.floor(size / 4), 20);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4A90D9"/>
      <stop offset="100%" style="stop-color:#357ABD"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <rect x="${size*0.1}" y="${size*0.1}" width="${size*0.8}" height="${size*0.8}" 
        rx="${size/5}" ry="${size/5}" fill="#357ABD"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#FFFFFF">LP</text>
</svg>`;
}

const sizes = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-384.png', size: 384 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

async function generateIcons() {
  for (const { file, size } of sizes) {
    const outputPath = path.join(publicDir, file);
    await sharp(Buffer.from(iconSvg(size)))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Created ${file} (${size}x${size})`);
  }
  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
