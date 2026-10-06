import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const temporary = await mkdtemp(join(tmpdir(), 'singlefile-escaped-package-'));
const npmCli = process.env.npm_execpath;

function run(args, cwd = repo) {
  const result = npmCli
    ? spawnSync(process.execPath, [npmCli, ...args], { cwd, encoding: 'utf8' })
    : spawnSync('npm', args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

try {
  const packed = JSON.parse(
    run(['pack', '--json', '--ignore-scripts', '--pack-destination', temporary]),
  );
  const archive = join(temporary, packed[0].filename);
  await writeFile(
    join(temporary, 'package.json'),
    JSON.stringify({
      name: 'package-smoke-consumer',
      version: '1.0.0',
      private: true,
      type: 'module',
    }),
  );
  run(
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-save',
      archive,
      '@types/node@^22',
    ],
    temporary,
  );

  const runtimeConsumer = join(temporary, 'consumer.mjs');
  await writeFile(
    runtimeConsumer,
    `import escaped from 'vite-plugin-singlefile-escaped';\nif (typeof escaped !== 'function') process.exit(1);\n`,
  );
  const runtime = spawnSync(process.execPath, [runtimeConsumer], {
    cwd: temporary,
    encoding: 'utf8',
  });
  assert.equal(runtime.status, 0, `JavaScript package import failed: ${runtime.stderr}`);

  const typeConsumer = join(temporary, 'consumer.ts');
  await writeFile(
    typeConsumer,
    `import escaped, { type JsescOptions } from 'vite-plugin-singlefile-escaped';\nimport type { Plugin } from 'vite';\nconst options: JsescOptions = { quotes: 'double', minimal: true };\nconst plugin: Plugin = escaped('before', 'after', options);\nvoid plugin;\n// @ts-expect-error invalid jsesc option\nescaped('', '', { quotes: 'triple' });\n`,
  );
  const typecheck = spawnSync(
    process.execPath,
    [
      resolve(repo, 'node_modules/typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--target',
      'ESNext',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      typeConsumer,
    ],
    { cwd: temporary, encoding: 'utf8' },
  );
  assert.equal(
    typecheck.status,
    0,
    `TypeScript package import failed: ${typecheck.stdout}\n${typecheck.stderr}`,
  );
  console.log('Packed JavaScript and TypeScript consumer smoke tests passed.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
