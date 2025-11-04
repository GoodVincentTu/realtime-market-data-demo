const fs = require('fs');
const path = require('path');

function renameLatest() {
  const dir = path.resolve(__dirname, '../migrations');
  if (!fs.existsSync(dir)) {
    console.error('[migrate] migrations/ not found');
    process.exit(1);
  }
  const jsFiles = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  if (!jsFiles.length) {
    console.error('[migrate] no .js migrations found to rename.');
    process.exit(1);
  }
  const abs = jsFiles.map(f => path.join(dir, f));
  abs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  const from = abs[0];
  const to = from.replace(/\.js$/i, '.cjs');
  fs.renameSync(from, to);
  console.log(`[migrate] renamed ${path.basename(from)} -> ${path.basename(to)}`);
}

// Allow both: require() and CLI
if (require.main === module) renameLatest();
module.exports = { renameLatest };