/**
 * remove-bg.js
 * Converte logo.jpg → logo.png removendo pixels brancos/quase-brancos
 * para gerar fundo transparente. Roda sem dependências externas via
 * módulo nativo Canvas do Node (se disponível) ou via Jimp se instalado.
 *
 * Uso: node remove-bg.js
 */

const fs   = require("fs");
const path = require("path");

const srcPath = path.join(__dirname, "logo.jpg");
const dstPath = path.join(__dirname, "logo.png");

// Tenta usar jimp se disponível
let jimp;
try { jimp = require("jimp"); } catch (_) {}

if (jimp) {
  runJimp();
} else {
  // Fallback: instala jimp on-the-fly e roda
  const { execSync } = require("child_process");
  console.log("Instalando jimp...");
  execSync("npm install jimp --save-dev", { stdio: "inherit", cwd: __dirname });
  jimp = require("jimp");
  runJimp();
}

async function runJimp() {
  const image = await jimp.read(srcPath);

  const THRESHOLD = 30; // tolerância de branco (0 = só branco puro)

  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];

    // Pixel é "branco" se todos os canais estão próximos de 255
    const isWhiteish = r > 255 - THRESHOLD && g > 255 - THRESHOLD && b > 255 - THRESHOLD;
    if (isWhiteish) {
      this.bitmap.data[idx + 3] = 0; // alfa = transparente
    }
  });

  await image.writeAsync(dstPath);
  console.log(`✓ Logo salva com fundo transparente em: ${dstPath}`);
}
