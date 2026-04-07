const { execSync } = require('child_process');
const fs = require('fs');

try {
  const result = execSync('npx prisma generate', {
    encoding: 'utf-8',
    cwd: __dirname,
  });
  fs.writeFileSync('prisma-result.json', JSON.stringify({ ok: true, stdout: result }), 'utf-8');
} catch (e) {
  fs.writeFileSync('prisma-result.json', JSON.stringify({
    ok: false,
    stderr: e.stderr,
    stdout: e.stdout,
    status: e.status,
  }, null, 2), 'utf-8');
}
console.log('done');
