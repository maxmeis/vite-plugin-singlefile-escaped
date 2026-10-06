import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'vite';
import jsesc from 'jsesc';
import viteSingleFileEscaped from '../src/index.js';

function run(
  bundle: Record<string, unknown>,
  ...args: Parameters<typeof viteSingleFileEscaped>
): void {
  const plugin = viteSingleFileEscaped(...args);
  const hook = plugin.generateBundle;
  if (!hook || typeof hook === 'function')
    throw new Error('Expected an ordered generateBundle hook');
  const error = vi.fn((message: string): never => {
    throw new Error(message);
  });
  hook.handler.call({ error } as never, {} as never, bundle as never, true);
}

describe('viteSingleFileEscaped', () => {
  it('is a post plugin and escapes a string HTML asset once', () => {
    const bundle: Record<string, unknown> = {
      'index.html': {
        type: 'asset',
        fileName: 'index.html',
        name: undefined,
        source: '<p>é\n</p>',
      },
    };
    run(bundle);
    expect(bundle['index.html']).toMatchObject({ source: '<p>\\xE9\\n</p>' });
    const plugin: Plugin = viteSingleFileEscaped();
    expect(plugin).toMatchObject({
      name: 'vite-plugin-singlefile-escaped',
      enforce: 'post',
      apply: 'build',
    });
  });

  it('applies wrappers and jsesc options', () => {
    const bundle: Record<string, unknown> = {
      'index.html': { type: 'asset', fileName: 'index.html', name: undefined, source: '<b>é</b>' },
    };
    run(bundle, 'start(', ')end', { quotes: 'double', minimal: true });
    expect(bundle['index.html']).toMatchObject({
      source: `start(${jsesc('<b>é</b>', { quotes: 'double', minimal: true })})end`,
    });
  });

  it('supports empty HTML content', () => {
    const bundle: Record<string, unknown> = {
      'index.html': { type: 'asset', fileName: 'index.html', name: undefined, source: '' },
    };
    run(bundle, 'before', 'after');
    expect(bundle['index.html']).toMatchObject({ source: 'beforeafter' });
  });

  it('decodes byte assets and ignores chunks and other assets', () => {
    const bundle: Record<string, unknown> = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        name: 'app',
        code: 'x',
        map: null,
        isEntry: true,
        isDynamicEntry: false,
        facadeModuleId: null,
        modules: {},
        imports: [],
        dynamicImports: [],
        implicitlyLoadedBefore: [],
        importedBindings: {},
      },
      'style.css': { type: 'asset', fileName: 'style.css', name: undefined, source: 'body{}' },
      'index.html': {
        type: 'asset',
        fileName: 'index.html',
        name: undefined,
        source: new TextEncoder().encode('<main>é</main>'),
      },
    };
    run(bundle);
    expect(bundle['index.html']).toMatchObject({ source: jsesc('<main>é</main>') });
    expect(bundle['style.css']).toMatchObject({ source: 'body{}' });
  });

  it('reports a missing HTML asset', () => {
    expect(() =>
      run({
        'app.js': {
          type: 'chunk',
          fileName: 'app.js',
          name: 'app',
          code: '',
          map: null,
          isEntry: true,
          isDynamicEntry: false,
          facadeModuleId: null,
          modules: {},
          imports: [],
          dynamicImports: [],
          implicitlyLoadedBefore: [],
          importedBindings: {},
        },
      }),
    ).toThrow(/no HTML asset/);
  });

  it('reports multiple HTML assets', () => {
    expect(() =>
      run({
        'a.html': { type: 'asset', fileName: 'a.html', name: undefined, source: 'a' },
        'b.html': { type: 'asset', fileName: 'b.html', name: undefined, source: 'b' },
      }),
    ).toThrow(/expected one HTML asset, found 2/);
  });

  it('runs after vite-plugin-singlefile and writes escaped HTML to a custom output directory', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'singlefile-escaped-'));
    const root = await realpath(temporaryRoot);
    const baselineDir = join(root, 'baseline');
    const outDir = join(root, 'custom-output');
    try {
      await mkdir(join(root, 'src'));
      await writeFile(
        join(root, 'index.html'),
        '<html><head><link rel="stylesheet" href="/src/style.css"></head><body><script type="module" src="/src/main.js"></script></body></html>',
      );
      await writeFile(join(root, 'src/main.js'), 'document.body.dataset.value = "quoted";');
      await writeFile(join(root, 'src/style.css'), 'body { color: red; }');

      await build({
        configFile: false,
        root,
        logLevel: 'silent',
        plugins: [viteSingleFile()],
        build: { outDir: baselineDir, emptyOutDir: true },
      });
      const baseline = await readFile(join(baselineDir, 'index.html'), 'utf8');

      await build({
        configFile: false,
        root,
        logLevel: 'silent',
        plugins: [viteSingleFile(), viteSingleFileEscaped('<wrapped>', '</wrapped>')],
        build: { outDir, emptyOutDir: true },
      });

      const output = await readFile(join(outDir, 'index.html'), 'utf8');
      expect(output).toBe(`<wrapped>${jsesc(baseline)}</wrapped>`);
      expect(output).not.toContain('src="/assets/');
      expect(output).not.toContain('href="/assets/');

      const inMemory = await build({
        configFile: false,
        root,
        logLevel: 'silent',
        plugins: [viteSingleFile(), viteSingleFileEscaped('<wrapped>', '</wrapped>')],
        build: { outDir: join(root, 'memory-output'), write: false },
      });
      const outputBundle = Array.isArray(inMemory) ? inMemory[0] : inMemory;
      if (!outputBundle || !('output' in outputBundle)) throw new Error('Expected a build output');
      const html = outputBundle?.output.find(
        (item) => item.type === 'asset' && item.fileName === 'index.html',
      );
      expect(html?.type).toBe('asset');
      if (html?.type === 'asset') {
        expect(html.source).toBe(`<wrapped>${jsesc(baseline)}</wrapped>`);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
