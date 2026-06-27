const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  const pngToIco = (await import('png-to-ico')).default;
  const pngPath = path.join(__dirname, '../build/icon.png');
  const squarePath = path.join(__dirname, '../build/icon-square.png');
  const icoPath = path.join(__dirname, '../build/icon.ico');

  const meta = await sharp(pngPath).metadata();
  if (meta.width !== meta.height) {
    const size = Math.min(meta.width ?? 512, meta.height ?? 512);
    await sharp(pngPath)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .png()
      .toFile(squarePath);
  } else {
    fs.copyFileSync(pngPath, squarePath);
  }

  const buf = await pngToIco(squarePath);
  fs.writeFileSync(icoPath, buf);
  console.log('Wrote', icoPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
