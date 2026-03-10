import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = resolve(root, 'release');

execSync('npm run build', { cwd: root, stdio: 'inherit', shell: true });

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const artifacts = ['main.js', 'manifest.json', 'styles.css'];
for (const name of artifacts) {
  const src = resolve(root, name);
  if (!existsSync(src)) {
    throw new Error(`Missing artifact: ${name}. Did the build succeed?`);
  }
  copyFileSync(src, resolve(outDir, name));
}

console.log(`Release artifacts written to: ${outDir}`);

