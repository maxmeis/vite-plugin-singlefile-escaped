import { rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
await rm(resolve(root, 'dist'), { recursive: true, force: true });

const compiler = resolve(root, 'node_modules/typescript/bin/tsc');
const result = spawnSync(process.execPath, [compiler, '-p', resolve(root, 'tsconfig.build.json')], {
  cwd: root,
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
