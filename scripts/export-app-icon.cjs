const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const destination = path.resolve('files/farmerrr-app-icon.png');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  await sharp('src/app/icon.svg', { density: 2304 }).resize(1024, 1024).png().toFile(destination);
  const info = await sharp(destination).metadata();
  console.log(`${destination}: ${info.width}x${info.height}, ${fs.statSync(destination).size} bytes`);
}
main().catch(() => { console.error('Falha ao exportar o ícone.'); process.exitCode = 1; });
