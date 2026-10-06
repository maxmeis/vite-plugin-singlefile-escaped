import jsesc from 'jsesc';
import type { Plugin } from 'vite';

/** Options accepted by jsesc when escaping generated HTML. */
export interface JsescOptions {
  numbers?: 'binary' | 'octal' | 'decimal' | 'hexadecimal';
  quotes?: 'single' | 'double' | 'backtick';
  wrap?: boolean;
  es6?: boolean;
  escapeEverything?: boolean;
  minimal?: boolean;
  isScriptContext?: boolean;
  compact?: boolean;
  indent?: string;
  indentLevel?: number;
  json?: boolean;
  lowercaseHex?: boolean;
}

/** Escape the single HTML output emitted by vite-plugin-singlefile. */
export default function viteSingleFileEscaped(
  wrapBefore = '',
  wrapAfter = '',
  jsescConfig: JsescOptions = {},
): Plugin {
  return {
    name: 'vite-plugin-singlefile-escaped',
    apply: 'build',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_options, bundle): void {
        const htmlAssets = Object.values(bundle).filter(
          (item) => item.type === 'asset' && item.fileName.endsWith('.html'),
        );
        const html = htmlAssets[0];
        if (!html || html.type !== 'asset') {
          this.error('vite-plugin-singlefile-escaped: no HTML asset found in the bundle.');
        }
        if (htmlAssets.length > 1) {
          this.error(
            `vite-plugin-singlefile-escaped: expected one HTML asset, found ${htmlAssets.length}.`,
          );
        }

        const source =
          typeof html.source === 'string' ? html.source : new TextDecoder().decode(html.source);
        html.source = `${wrapBefore}${jsesc(source, jsescConfig)}${wrapAfter}`;
      },
    },
  };
}
