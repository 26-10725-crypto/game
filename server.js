const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const THREE_DIR = path.join(__dirname, 'node_modules', 'three');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.ico': 'image/x-icon'
};

// 폴더 밖으로 나가는 경로(../)를 막는 안전 장치
function safeJoin(base, relPath) {
  const target = path.normalize(path.join(base, relPath));
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }
  if (urlPath === '/') urlPath = '/index.html';

  let filePath;
  if (urlPath.startsWith('/lib/three/')) {
    filePath = safeJoin(THREE_DIR, urlPath.slice('/lib/three/'.length));
  } else {
    filePath = safeJoin(PUBLIC_DIR, urlPath);
  }
  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

function getIPs() {
  const list = [];
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const n of nets[name]) {
        if (n.family === 'IPv4' && !n.internal) list.push(n.address);
      }
    }
  } catch (e) {
    // Termux에서 주소를 못 읽는 경우가 있음 → 아래 안내 문구 사용
  }
  return list;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('서버 시작!');
  console.log('이 기기 크롬에서: http://localhost:' + PORT);
  const ips = getIPs();
  if (ips.length) {
    ips.forEach((ip) => console.log('친구들은: http://' + ip + ':' + PORT));
  } else {
    console.log('IP 주소를 자동으로 못 찾았습니다. Wi-Fi 설정에서 이 기기의 IP를 확인하세요.');
  }
});