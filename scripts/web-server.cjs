const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const port = 8080;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml'
};

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const requested = pathname === '/' ? '/web/index.html' : pathname;
  const filename = path.resolve(root, `.${requested}`);
  if (!filename.startsWith(root + path.sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(filename, (statError, stat) => {
    const target = !statError && stat.isDirectory() ? path.join(filename, 'index.html') : filename;
    fs.readFile(target, (error, data) => {
      if (error) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
        return;
      }
      response.writeHead(200, { 'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(data);
    });
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`CENTOPIA 原始网页版已启动：http://localhost:${port}/web/`);
  console.log('保持此窗口开启；按 Ctrl+C 停止服务器。');
  if (process.platform === 'win32' && process.env.CENTOPIA_OPEN_BROWSER === '1') {
    const opener = spawn('cmd', ['/c', 'start', '', `http://localhost:${port}/web/`], { detached: true, stdio: 'ignore', windowsHide: true });
    opener.unref();
  }
});

process.on('uncaughtException', error => {
  if (error.code === 'EADDRINUSE') {
    console.error('8080 端口已被占用。请关闭旧服务器后重新启动。');
    process.exit(1);
  }
  throw error;
});
