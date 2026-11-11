import * as THREE from 'three';

// ---------- 기본 설정 ----------
const canvas = document.getElementById('game');
const infoEl = document.getElementById('info');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 160);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);

scene.add(new THREE.HemisphereLight(0xffffff, 0x4a6b3a, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(50, 100, 30);
scene.add(sun);

// ---------- 월드 ----------
const WORLD_SIZE = 400;
const HALF = 190; // 이동 가능한 한계

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
  new THREE.MeshLambertMaterial({ color: 0x5a9e45 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// 같은 숫자(seed)면 항상 같은 결과가 나오는 난수 (멀티플레이에서 모두 같은 월드를 보기 위함)
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(12345);

const dummy = new THREE.Object3D();

// 나무 (줄기 + 잎, 인스턴싱으로 가볍게)
const TREE_COUNT = 250;
const trunks = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.3, 0.4, 2, 6),
  new THREE.MeshLambertMaterial({ color: 0x6b4423 }),
  TREE_COUNT
);
const leaves = new THREE.InstancedMesh(
  new THREE.ConeGeometry(1.6, 4, 7),
  new THREE.MeshLambertMaterial({ color: 0x2e7d32 }),
  TREE_COUNT
);
for (let i = 0; i < TREE_COUNT; i++) {
  let x, z;
  do {
    x = (rand() - 0.5) * 2 * HALF;
    z = (rand() - 0.5) * 2 * HALF;
  } while (Math.hypot(x, z) < 8); // 시작 지점 주변은 비워 둠
  const s = 0.8 + rand() * 0.9;
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(s, s, s);
  dummy.position.set(x, s * 1, z);
  dummy.updateMatrix();
  trunks.setMatrixAt(i, dummy.matrix);
  dummy.position.set(x, s * 4, z);
  dummy.updateMatrix();
  leaves.setMatrixAt(i, dummy.matrix);
}
scene.add(trunks, leaves);

// 바위
const ROCK_COUNT = 80;
const rocks = new THREE.InstancedMesh(
  new THREE.DodecahedronGeometry(1),
  new THREE.MeshLambertMaterial({ color: 0x888888 }),
  ROCK_COUNT
);
for (let i = 0; i < ROCK_COUNT; i++) {
  let x, z;
  do {
    x = (rand() - 0.5) * 2 * HALF;
    z = (rand() - 0.5) * 2 * HALF;
  } while (Math.hypot(x, z) < 6);
  const s = 0.5 + rand() * 1.5;
  dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
  dummy.scale.set(s, s * 0.7, s);
  dummy.position.set(x, s * 0.4, z);
  dummy.updateMatrix();
  rocks.setMatrixAt(i, dummy.matrix);
}
scene.add(rocks);

// ---------- 플레이어 ----------
const player = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.4, 0.8, 4, 8),
  new THREE.MeshLambertMaterial({ color: 0x3366cc })
);
body.position.y = 0.8;
player.add(body);
// 앞쪽 표시(노란 코): 캐릭터가 어느 쪽을 보는지 알려 줌
const nose = new THREE.Mesh(
  new THREE.BoxGeometry(0.2, 0.2, 0.3),
  new THREE.MeshLambertMaterial({ color: 0xffd54f })
);
nose.position.set(0, 1.25, 0.45);
player.add(nose);
scene.add(player);

// 바닥 그림자
const blob = new THREE.Mesh(
  new THREE.CircleGeometry(0.6, 16),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
);
blob.rotation.x = -Math.PI / 2;
blob.position.y = 0.02;
scene.add(blob);

// ---------- 입력 ----------
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// 가상 조이스틱
const joyEl = document.getElementById('joystick');
const knob = document.getElementById('knob');
const joy = { id: null, x: 0, y: 0 };
const JOY_R = 50;

function setJoy(e) {
  const r = joyEl.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2);
  let dy = e.clientY - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy);
  if (d > JOY_R) {
    dx = (dx / d) * JOY_R;
    dy = (dy / d) * JOY_R;
  }
  knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  joy.x = dx / JOY_R;
  joy.y = dy / JOY_R;
}
joyEl.addEventListener('pointerdown', (e) => {
  joy.id = e.pointerId;
  joyEl.setPointerCapture(e.pointerId);
  setJoy(e);
});
joyEl.addEventListener('pointermove', (e) => {
  if (e.pointerId === joy.id) setJoy(e);
});
function endJoy(e) {
  if (e.pointerId !== joy.id) return;
  joy.id = null;
  joy.x = 0;
  joy.y = 0;
  knob.style.transform = 'translate(0,0)';
}
joyEl.addEventListener('pointerup', endJoy);
joyEl.addEventListener('pointercancel', endJoy);

// 버튼
let runToggle = false;
let jumpPressed = false;
const btnRun = document.getElementById('btn-run');
const btnJump = document.getElementById('btn-jump');
btnRun.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  runToggle = !runToggle;
  btnRun.classList.toggle('on', runToggle);
});
btnJump.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  jumpPressed = true;
});

// 카메라 회전 (화면 빈 곳을 손가락으로 드래그)
let yaw = 0;
let pitch = 0.4;
const camDrag = { id: null, x: 0, y: 0 };
canvas.addEventListener('pointerdown', (e) => {
  if (camDrag.id !== null) return;
  camDrag.id = e.pointerId;
  camDrag.x = e.clientX;
  camDrag.y = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== camDrag.id) return;
  const dx = e.clientX - camDrag.x;
  const dy = e.clientY - camDrag.y;
  camDrag.x = e.clientX;
  camDrag.y = e.clientY;
  yaw -= dx * 0.006;
  pitch = Math.min(1.3, Math.max(0.05, pitch + dy * 0.006));
});
function endCam(e) {
  if (e.pointerId === camDrag.id) camDrag.id = null;
}
canvas.addEventListener('pointerup', endCam);
canvas.addEventListener('pointercancel', endCam);

// ---------- 게임 루프 ----------
const WALK_SPEED = 5;
const RUN_SPEED = 9;
const GRAVITY = 25;
const JUMP_SPEED = 9;
const CAM_DIST = 7;

let vy = 0;
let onGround = true;

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

const clock = new THREE.Clock();
let fpsTimer = 0;
let fpsFrames = 0;
let fps = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  // 입력 합치기 (조이스틱 + 키보드)
  let ix = Math.abs(joy.x) < 0.1 ? 0 : joy.x;
  let fwd = Math.abs(joy.y) < 0.1 ? 0 : -joy.y;
  if (keys.KeyD || keys.ArrowRight) ix += 1;
  if (keys.KeyA || keys.ArrowLeft) ix -= 1;
  if (keys.KeyW || keys.ArrowUp) fwd += 1;
  if (keys.KeyS || keys.ArrowDown) fwd -= 1;
  const len = Math.hypot(ix, fwd);
  if (len > 1) {
    ix /= len;
    fwd /= len;
  }

  // 카메라 방향 기준으로 이동 방향 계산
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  const mx = cosY * ix + -sinY * fwd;
  const mz = -sinY * ix + -cosY * fwd;

  const running = runToggle || keys.ShiftLeft || keys.ShiftRight;
  const speed = running ? RUN_SPEED : WALK_SPEED;

  if (Math.hypot(mx, mz) > 0.01) {
    player.position.x += mx * speed * dt;
    player.position.z += mz * speed * dt;
    const target = Math.atan2(mx, mz);
    player.rotation.y += angleDiff(player.rotation.y, target) * Math.min(1, dt * 12);
  }

  // 월드 경계
  player.position.x = Math.max(-HALF, Math.min(HALF, player.position.x));
  player.position.z = Math.max(-HALF, Math.min(HALF, player.position.z));

  // 점프와 중력
  if ((jumpPressed || keys.Space) && onGround) {
    vy = JUMP_SPEED;
    onGround = false;
  }
  jumpPressed = false;
  vy -= GRAVITY * dt;
  player.position.y += vy * dt;
  if (player.position.y <= 0) {
    player.position.y = 0;
    vy = 0;
    onGround = true;
  }

  blob.position.x = player.position.x;
  blob.position.z = player.position.z;

  // 3인칭 카메라
  const cp = Math.cos(pitch);
  camera.position.set(
    player.position.x + sinY * cp * CAM_DIST,
    player.position.y + 1.5 + Math.sin(pitch) * CAM_DIST,
    player.position.z + cosY * cp * CAM_DIST
  );
  camera.lookAt(player.position.x, player.position.y + 1.3, player.position.z);

  renderer.render(scene, camera);

  // FPS 표시
  fpsFrames++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    fps = Math.round(fpsFrames / fpsTimer);
    fpsFrames = 0;
    fpsTimer = 0;
    infoEl.textContent =
      'FPS ' + fps + ' | 위치 ' +
      player.position.x.toFixed(0) + ', ' + player.position.z.toFixed(0);
  }
}
animate();

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);