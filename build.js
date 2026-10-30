import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWatch = process.argv.includes('--watch');
const distDir = path.join(__dirname, 'dist');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

async function build() {
  console.log('[ZoodSle] Starting extension build...');
  ensureDir(distDir);

  // 1. Compile background service worker (ESM)
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'src/background.ts')],
    outfile: path.join(distDir, 'background.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
    sourcemap: !isWatch ? false : 'inline',
    minify: !isWatch,
  });

  // 2. Compile content script (IIFE for safe isolated injection without modules)
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'src/content.ts')],
    outfile: path.join(distDir, 'content.js'),
    bundle: true,
    format: 'iife',
    target: 'es2022',
    sourcemap: !isWatch ? false : 'inline',
    minify: !isWatch,
  });

  // 3. Compile popup script (ESM)
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'src/popup.ts')],
    outfile: path.join(distDir, 'popup.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
    sourcemap: !isWatch ? false : 'inline',
    minify: !isWatch,
  });

  // 4. Compile options script (ESM)
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'src/options.ts')],
    outfile: path.join(distDir, 'options.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
    sourcemap: !isWatch ? false : 'inline',
    minify: !isWatch,
  });

  // 5. Copy static assets to dist/
  copyFile(path.join(__dirname, 'manifest.json'), path.join(distDir, 'manifest.json'));
  copyFile(path.join(__dirname, 'src/popup.html'), path.join(distDir, 'popup.html'));
  copyFile(path.join(__dirname, 'src/popup.css'), path.join(distDir, 'popup.css'));
  copyFile(path.join(__dirname, 'src/options.html'), path.join(distDir, 'options.html'));
  copyFile(path.join(__dirname, 'src/options.css'), path.join(distDir, 'options.css'));
  copyFile(path.join(__dirname, 'src/content.css'), path.join(distDir, 'content.css'));
  copyDir(path.join(__dirname, 'icons'), path.join(distDir, 'icons'));

  // Also mirror compiled assets to root so loading unpacked from either chromium/ or chromium/dist/ works
  copyFile(path.join(distDir, 'background.js'), path.join(__dirname, 'background.js'));
  copyFile(path.join(distDir, 'content.js'), path.join(__dirname, 'content.js'));
  copyFile(path.join(distDir, 'popup.js'), path.join(__dirname, 'popup.js'));
  copyFile(path.join(distDir, 'options.js'), path.join(__dirname, 'options.js'));
  copyFile(path.join(__dirname, 'src/popup.html'), path.join(__dirname, 'popup.html'));
  copyFile(path.join(__dirname, 'src/popup.css'), path.join(__dirname, 'popup.css'));
  copyFile(path.join(__dirname, 'src/options.html'), path.join(__dirname, 'options.html'));
  copyFile(path.join(__dirname, 'src/options.css'), path.join(__dirname, 'options.css'));
  copyFile(path.join(__dirname, 'src/content.css'), path.join(__dirname, 'content.css'));

  console.log('[ZoodSle] Build completed successfully into dist/ and chromium/ root!');
}

build().catch((err) => {
  console.error('[ZoodSle] Build failed:', err);
  process.exit(1);
});
