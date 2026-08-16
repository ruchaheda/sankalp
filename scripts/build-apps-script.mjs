import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const distDir = resolve(projectRoot, 'dist-apps-script');
const sourceHtml = await readFile(resolve(distDir, 'index.html'), 'utf8');

const scriptMatch = sourceHtml.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/);
if (!scriptMatch) throw new Error('Could not find the Vite JavaScript bundle.');

const cssMatch = sourceHtml.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/);
const assetPath = (value) => resolve(distDir, value.replace(/^\.?\//, ''));
const script = await readFile(assetPath(scriptMatch[1]), 'utf8');
const css = cssMatch ? await readFile(assetPath(cssMatch[1]), 'utf8') : '';

const diagnosticScript = `<script>
window.addEventListener('error', function (event) {
  var root = document.getElementById('root');
  if (root) {
    root.innerHTML = '<div style="padding:24px;font-family:sans-serif;color:#991b1b">' +
      '<h2>Sankalp failed to start</h2><pre style="white-space:pre-wrap"></pre></div>';
    root.querySelector('pre').textContent = event.message || 'Unknown JavaScript error';
  }
});
window.addEventListener('unhandledrejection', function (event) {
  var root = document.getElementById('root');
  if (root) {
    root.innerHTML = '<div style="padding:24px;font-family:sans-serif;color:#991b1b">' +
      '<h2>Sankalp failed to start</h2><pre style="white-space:pre-wrap"></pre></div>';
    var reason = event.reason;
    root.querySelector('pre').textContent = reason && reason.message ? reason.message : String(reason);
  }
});
</script>`;

const bundledHtml = sourceHtml
  // Callback replacements keep bundle sequences such as `$&` literal. Passing
  // the bundle as a replacement string would expand them as replacement tokens.
  // Remove Vite's head script and put the classic inline bundle after #root.
  // Module scripts are deferred automatically; classic inline scripts are not.
  .replace(scriptMatch[0], () => '')
  .replace(cssMatch?.[0] || '', () => (css ? `<style>${css}</style>` : ''))
  .replace('<head>', () => `<head>\n    <base target="_top">\n    ${diagnosticScript}`)
  .replace('<div id="root"></div>', () =>
    '<div id="root"><p style="padding:24px;font-family:sans-serif">Loading Sankalp…</p></div>',
  )
  .replace('</body>', () => `<script>${script}</script>\n  </body>`);

await Promise.all([
  writeFile(resolve(projectRoot, 'appsscript', 'Index.html'), bundledHtml),
  writeFile(resolve(projectRoot, 'appsscript', 'Index.source.txt'), bundledHtml),
  writeFile(resolve(projectRoot, 'appsscript', 'IndexSource.js'), bundledHtml),
]);
console.log('Built Apps Script HTML and copyable source files');
