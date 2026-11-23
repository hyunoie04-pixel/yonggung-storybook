/* 선택 사항: 스토리북을 이 PC에서 주소(http://127.0.0.1:8765/)로 여는 작은 서버.
   index.html을 더블클릭해도 똑같이 동작한다(챗봇은 외부 API 없이 브라우저 안에서 답한다).
   실행: node server.js  또는  실행.bat */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8765);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8' };

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method');
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname); if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(ROOT, rel));
  const base = path.basename(file);
  if (!file.startsWith(ROOT) || base.startsWith('.') || base === 'server.js') return send(res, 404, 'not found');
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'not found');
    if (type !== 'video/mp4') {
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'no-store' });
      return fs.createReadStream(file).pipe(res);
    }
    // 영상은 구간 요청(Range)을 받아야 재생 위치를 옮길 수 있다
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (!m) { res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }); return fs.createReadStream(file).pipe(res); }
    const a = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2])), b = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
    if (a > b || a >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
    res.writeHead(206, { 'Content-Type': type, 'Content-Length': b - a + 1, 'Content-Range': 'bytes ' + a + '-' + b + '/' + st.size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file, { start: a, end: b }).pipe(res);
  });
}).listen(PORT, '127.0.0.1', () => console.log('스토리북: http://127.0.0.1:' + PORT + '/'));
