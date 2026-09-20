const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const stage = document.querySelector('#stage');
const empty = document.querySelector('#emptyState');
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  density: 18000, size: 1.3, cohesion: 0.72, speed: 0.8,
  turbulence: 1.4, flowScale: 1.6, orbit: 0.35, tempo: 0.45,
  trail: 0.86, scatter: 0, hardwareActive: false,
  layers: [], assets: [], autoBlend: true, playlistIndex: -1,
  nextBlendAt: 0, loading: false,
  sensor: { proximity: 0.5, sound: 0.35, light: 0.62, touch: 0 }
};

let last = performance.now();
let frames = 0;
let fpsTime = last;
let db;
let serialReader;
let ws;
let folderAssets = [];
let thumbnailObserver;
let assetSequence = 0;

function resize() {
  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = Math.max(1, rect.width * dpr);
  canvas.height = Math.max(1, rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  $('#resolution').textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
  if (state.layers.length) rebuildAllLayers();
}
new ResizeObserver(resize).observe(stage);

async function getAssetBlob(asset) {
  return asset.handle ? asset.handle.getFile() : asset.blob;
}

async function decodeWorkingImage(asset) {
  const blob = await getAssetBlob(asset);
  try {
    return await createImageBitmap(blob, { resizeWidth: 1280, resizeQuality: 'high' });
  } catch {
    return readImage(blob);
  }
}

function readImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图像解码失败')); };
    image.src = url;
  });
}

function buildLayerParticles(layer, count) {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const image = layer.image;
  const temp = document.createElement('canvas');
  const tempCtx = temp.getContext('2d', { willReadFrequently: true });
  const scale = Math.min(width / image.width, height / image.height) * 0.88;
  const sourceWidth = Math.max(1, Math.round(image.width * scale));
  const sourceHeight = Math.max(1, Math.round(image.height * scale));
  temp.width = sourceWidth;
  temp.height = sourceHeight;
  tempCtx.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  const pixels = tempCtx.getImageData(0, 0, sourceWidth, sourceHeight).data;
  layer.particles = Array.from({ length: count }, () => {
    const sx = Math.floor(Math.random() * sourceWidth);
    const sy = Math.floor(Math.random() * sourceHeight);
    const index = (sy * sourceWidth + sx) * 4;
    return {
      x: Math.random() * width, y: Math.random() * height,
      tx: (width - sourceWidth) / 2 + sx, ty: (height - sourceHeight) / 2 + sy,
      vx: 0, vy: 0, r: pixels[index], g: pixels[index + 1],
      b: pixels[index + 2], a: pixels[index + 3] / 255,
      phase: Math.random() * Math.PI * 2,
      mass: 0.78 + Math.random() * 0.44,
      band: Math.floor(Math.random() * 3)
    };
  });
}

function rebuildAllLayers() {
  if (!state.layers.length) return;
  const count = Math.max(500, Math.floor(state.density / state.layers.length));
  for (const layer of state.layers) buildLayerParticles(layer, count);
  $('#particleReadout').textContent = `${(count * state.layers.length).toLocaleString()} PARTICLES · ${state.layers.length}/3 IMAGES`;
  empty.style.display = 'none';
}

function updateLayerTargets() {
  const targets = [0.16, 0.42, 1];
  const offset = 3 - state.layers.length;
  state.layers.forEach((layer, index) => { layer.targetWeight = targets[offset + index]; });
  const activeIds = new Set(state.layers.map(layer => layer.asset.uid));
  $$('.asset').forEach(button => button.classList.toggle('active', activeIds.has(button.dataset.uid)));
  $('#modeReadout').textContent = `FUSION ${state.layers.length}/3`;
}

async function activateAsset(asset) {
  if (state.loading) return;
  const existing = state.layers.find(layer => layer.asset.uid === asset.uid);
  if (existing) {
    state.layers = state.layers.filter(layer => layer !== existing).concat(existing);
    updateLayerTargets();
    return;
  }
  state.loading = true;
  try {
    const image = await decodeWorkingImage(asset);
    state.layers.push({ asset, image, particles: [], weight: 0, targetWeight: 1 });
    while (state.layers.length > 3) {
      const removed = state.layers.shift();
      if (typeof removed.image.close === 'function') removed.image.close();
    }
    rebuildAllLayers();
    updateLayerTargets();
    state.scatter = 0.7;
    state.nextBlendAt = performance.now() + 8500;
  } catch (error) {
    console.warn(error);
  } finally {
    state.loading = false;
  }
}

async function advancePlaylist() {
  if (!state.assets.length || state.loading) return;
  state.playlistIndex = (state.playlistIndex + 1) % state.assets.length;
  await activateAsset(state.assets[state.playlistIndex]);
}

function flowAt(x, y, time, particle, width, height) {
  const aspect = width / Math.max(1, height);
  const px = (x / width - 0.5) * aspect;
  const py = y / height - 0.5;
  const qx = px * Math.PI * 2 * state.flowScale;
  const qy = py * Math.PI * 2 * state.flowScale;
  const phase = time * state.tempo;

  // Two analytic stream functions create a coherent, divergence-free field.
  const a = qx + phase * 0.73 + particle.band * 1.7;
  const b = qy - phase * 0.51 + particle.phase;
  const primaryX = Math.sin(a) * Math.cos(b);
  const primaryY = -Math.cos(a) * Math.sin(b);
  const c = (qx + qy) * 0.57 - phase * 0.31 + particle.phase * 0.23;
  const d = (qy - qx) * 1.13 + phase * 0.47;
  const detailX = Math.sin(c) * Math.cos(d);
  const detailY = -Math.cos(c) * Math.sin(d);
  const complexity = Math.min(1, state.turbulence / 4);

  const radius = Math.max(0.08, Math.hypot(px, py));
  const orbitEnvelope = Math.exp(-radius * 1.25);
  const orbitX = (-py / radius) * state.orbit * orbitEnvelope;
  const orbitY = (px / radius) * state.orbit * orbitEnvelope;
  const breath = 0.78 + 0.22 * Math.sin(phase * 0.43);
  return {
    x: (primaryX * (1 - complexity * 0.55) + detailX * complexity + orbitX) * breath,
    y: (primaryY * (1 - complexity * 0.55) + detailY * complexity + orbitY) * breath
  };
}

function draw(now) {
  requestAnimationFrame(draw);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  frames++;
  if (now - fpsTime > 500) {
    $('#fps').textContent = `${Math.round(frames * 1000 / (now - fpsTime))} FPS`;
    frames = 0;
    fpsTime = now;
  }
  $('#clock').textContent = new Date().toLocaleTimeString('en-GB');
  if (state.autoBlend && state.assets.length > 1 && now > state.nextBlendAt) advancePlaylist();

  const width = stage.clientWidth;
  const height = stage.clientHeight;
  ctx.fillStyle = `rgba(5,5,5,${Math.max(0.025, 1 - state.trail)})`;
  ctx.fillRect(0, 0, width, height);
  const t = now * 0.00025;
  const cohesion = state.cohesion * (1 - state.scatter);

  for (const layer of state.layers) {
    layer.weight += (layer.targetWeight - layer.weight) * Math.min(1, dt * 0.75);
    for (const particle of layer.particles) {
      const field = flowAt(particle.x, particle.y, t, particle, width, height);
      const flowForce = state.speed * 38 / particle.mass;
      const warpAmount = (3 + state.turbulence * 5) * (1 - cohesion * 0.55);
      const targetX = particle.tx + Math.sin(t * state.tempo * 1.3 + particle.ty * 0.009 + particle.phase) * warpAmount;
      const targetY = particle.ty + Math.cos(t * state.tempo * 1.1 + particle.tx * 0.008 - particle.phase) * warpAmount;
      const spring = 1.2 + cohesion * cohesion * 8.5;
      const ax = field.x * flowForce + (targetX - particle.x) * spring * cohesion;
      const ay = field.y * flowForce + (targetY - particle.y) * spring * cohesion;
      const damping = Math.pow(0.945 - cohesion * 0.018, dt * 60);
      particle.vx = (particle.vx + ax * dt) * damping;
      particle.vy = (particle.vy + ay * dt) * damping;
      particle.x += particle.vx;
      particle.y += particle.vy;
      if (particle.x < -20) particle.x = width + 20;
      if (particle.x > width + 20) particle.x = -20;
      if (particle.y < -20) particle.y = height + 20;
      if (particle.y > height + 20) particle.y = -20;
      const alpha = Math.max(0.04, particle.a * 0.82 * layer.weight);
      ctx.fillStyle = `rgba(${particle.r},${particle.g},${particle.b},${alpha})`;
      ctx.fillRect(particle.x, particle.y, state.size, state.size);
    }
  }
  state.scatter = Math.max(0, state.scatter - dt * 0.18);
}
requestAnimationFrame(draw);

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('centopia-image-field', 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('assets')) request.result.createObjectStore('assets', { keyPath: 'id', autoIncrement: true });
      if (!request.result.objectStoreNames.contains('settings')) request.result.createObjectStore('settings');
    };
    request.onsuccess = () => { db = request.result; resolve(); };
    request.onerror = reject;
  });
}

function store(mode = 'readonly') { return db.transaction('assets', mode).objectStore('assets'); }
function settings(mode = 'readonly') { return db.transaction('settings', mode).objectStore('settings'); }

async function importFiles(files) {
  for (const file of files) {
    if (file.type.startsWith('image/')) store('readwrite').add({ name: file.name, blob: file, created: Date.now() });
  }
  setTimeout(loadAssets, 150);
}

function loadAssets() {
  const request = store().getAll();
  request.onsuccess = () => {
    const imported = request.result.map(item => ({ name: item.name, blob: item.blob }));
    renderAssets([...folderAssets, ...imported]);
  };
}

function observeThumbnail(button, asset) {
  button._asset = asset;
  thumbnailObserver.observe(button);
}

async function loadThumbnail(button) {
  if (button.dataset.loaded) return;
  button.dataset.loaded = '1';
  try {
    const blob = await getAssetBlob(button._asset);
    const bitmap = await createImageBitmap(blob, { resizeWidth: 220, resizeHeight: 220, resizeQuality: 'medium' });
    const thumb = document.createElement('canvas');
    thumb.width = 110;
    thumb.height = 110;
    thumb.getContext('2d').drawImage(bitmap, 0, 0, 110, 110);
    bitmap.close();
    const thumbBlob = await new Promise(resolve => thumb.toBlob(resolve, 'image/jpeg', 0.72));
    const url = URL.createObjectURL(thumbBlob);
    const image = button.querySelector('img');
    image.onload = () => URL.revokeObjectURL(url);
    image.src = url;
  } catch {
    button.classList.add('broken');
  }
}

function renderAssets(assets) {
  state.assets = assets.map(asset => ({ ...asset, uid: asset.uid || `asset-${++assetSequence}` }));
  $('#assetCount').textContent = `${state.assets.length} 项素材 · 最多融合 3 张`;
  const grid = $('#assetGrid');
  thumbnailObserver?.disconnect();
  thumbnailObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      thumbnailObserver.unobserve(entry.target);
      loadThumbnail(entry.target);
    }
  }, { root: grid, rootMargin: '160px' });
  grid.replaceChildren();
  state.assets.forEach((asset, index) => {
    const button = document.createElement('button');
    button.className = 'asset';
    button.dataset.uid = asset.uid;
    button.title = asset.name;
    button.innerHTML = `<img alt=""><span>${String(index + 1).padStart(2, '0')}</span>`;
    button.onclick = () => activateAsset(asset);
    grid.append(button);
    observeThumbnail(button, asset);
  });
  updateLayerTargets();
  if (state.assets.length && !state.layers.length) advancePlaylist();
}

async function filesFromDirectory(handle) {
  const found = [];
  async function walk(directory, prefix = '') {
    for await (const entry of directory.values()) {
      if (entry.kind === 'directory') await walk(entry, `${prefix}${entry.name}/`);
      else if (/\.(jpe?g|png|webp|gif|bmp)$/i.test(entry.name)) found.push({ name: `${prefix}${entry.name}`, handle: entry });
    }
  }
  await walk(handle);
  return found;
}

async function connectFolder() {
  if (!window.showDirectoryPicker) return $('#folderFallback').click();
  try {
    const handle = await window.showDirectoryPicker({ id: 'centopia-street-assets', mode: 'read' });
    settings('readwrite').put(handle, 'assetFolder');
    await activateFolder(handle);
  } catch (error) {
    if (error.name !== 'AbortError') alert(`无法读取文件夹：${error.message}`);
  }
}

async function activateFolder(handle) {
  folderAssets = await filesFromDirectory(handle);
  const button = $('#folderBtn');
  button.classList.add('connected');
  button.innerHTML = `<span>●</span> ${handle.name} · ${folderAssets.length} 张`;
  loadAssets();
}

function restoreFolder() {
  const request = settings().get('assetFolder');
  request.onsuccess = async () => {
    const handle = request.result;
    if (!handle) return;
    try {
      if (await handle.queryPermission({ mode: 'read' }) === 'granted') await activateFolder(handle);
      else $('#folderBtn').textContent = `重新连接 ${handle.name}`;
    } catch {}
  };
}

$('#fileInput').onchange = event => importFiles(event.target.files);
['dragenter', 'dragover'].forEach(name => stage.addEventListener(name, event => event.preventDefault()));
stage.addEventListener('drop', event => { event.preventDefault(); importFiles(event.dataTransfer.files); });
const dropzone = $('#dropzone');
['dragenter', 'dragover'].forEach(name => dropzone.addEventListener(name, event => { event.preventDefault(); dropzone.classList.add('drag'); }));
['dragleave', 'drop'].forEach(name => dropzone.addEventListener(name, () => dropzone.classList.remove('drag')));
dropzone.addEventListener('drop', event => { event.preventDefault(); importFiles(event.dataTransfer.files); });
$('#folderBtn').onclick = connectFolder;
$('#folderFallback').onchange = event => {
  folderAssets = [...event.target.files].filter(file => file.type.startsWith('image/')).map(blob => ({ name: blob.webkitRelativePath || blob.name, blob }));
  $('#folderBtn').classList.add('connected');
  $('#folderBtn').innerHTML = `<span>●</span> 已连接 · ${folderAssets.length} 张`;
  loadAssets();
};
$('#clearAssets').onclick = () => {
  if (confirm('清空此浏览器中单独导入的图像素材？文件夹原图不会受到影响。')) {
    store('readwrite').clear();
    setTimeout(loadAssets, 100);
  }
};

const controls = {
  density: { parse: value => +value, show: value => (+value).toLocaleString(), apply: value => { state.density = +value; rebuildAllLayers(); } },
  size: { parse: value => +value, show: value => (+value).toFixed(1) },
  cohesion: { parse: value => +value / 100, show: value => `${value}%` },
  speed: { parse: value => +value, show: value => (+value).toFixed(1) },
  turbulence: { parse: value => +value, show: value => (+value).toFixed(1) },
  flowScale: { parse: value => +value, show: value => (+value).toFixed(1) },
  orbit: { parse: value => +value, show: value => (+value).toFixed(2) },
  tempo: { parse: value => +value, show: value => (+value).toFixed(2) },
  trail: { parse: value => +value / 100, show: value => `${value}%` }
};
for (const [id, control] of Object.entries(controls)) {
  const element = $(`#${id}`);
  element.oninput = () => { state[id] = control.parse(element.value); $(`#${id}Out`).textContent = control.show(element.value); };
  element.onchange = () => control.apply?.(element.value);
}

const presets = {
  silk: { density: 18000, size: 1.3, cohesion: 72, speed: 0.8, turbulence: 1.4, flowScale: 1.6, orbit: 0.35, tempo: 0.45, trail: 86 },
  dust: { density: 26000, size: 0.7, cohesion: 38, speed: 1.2, turbulence: 2.6, flowScale: 2.7, orbit: 0.15, tempo: 0.8, trail: 92 },
  storm: { density: 12000, size: 2.2, cohesion: 24, speed: 2.1, turbulence: 3.4, flowScale: 1.1, orbit: 0.95, tempo: 1.15, trail: 78 }
};
$$('.preset').forEach(button => button.onclick = () => {
  $$('.preset').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  Object.entries(presets[button.dataset.preset]).forEach(([id, value]) => {
    const element = $(`#${id}`);
    element.value = value;
    element.oninput();
    element.onchange();
  });
});

$('#autoBlendBtn').onclick = event => {
  state.autoBlend = !state.autoBlend;
  event.currentTarget.textContent = `自动融合 · ${state.autoBlend ? '开' : '关'}`;
  event.currentTarget.classList.toggle('off', !state.autoBlend);
  state.nextBlendAt = performance.now() + 1200;
};
$('#shuffleBtn').onclick = () => {
  state.scatter = 1;
  for (const layer of state.layers) for (const particle of layer.particles) {
    particle.vx += (Math.random() - 0.5) * 18;
    particle.vy += (Math.random() - 0.5) * 18;
  }
};
$('#fullscreenBtn').onclick = () => stage.requestFullscreen();

function ingest(data, source = 'HARDWARE', applyMapping = true) {
  for (const key of Object.keys(state.sensor)) if (data[key] != null) state.sensor[key] = Math.max(0, Math.min(1, +data[key]));
  $$('.sensor').forEach(element => {
    const value = state.sensor[element.dataset.key];
    element.querySelector('i').style.width = `${value * 100}%`;
    element.querySelector('output').textContent = value.toFixed(2);
  });
  $('#inputSource').textContent = source;
  if (!applyMapping) return;
  for (const select of $$('[data-map]')) {
    const value = state.sensor[select.dataset.map];
    const slider = $(`#${select.value}`);
    if (!slider) continue;
    slider.value = +slider.min + value * (+slider.max - +slider.min);
    slider.oninput();
  }
}

setInterval(() => {
  if (!state.hardwareActive) ingest({ proximity: 0.5 + 0.35 * Math.sin(Date.now() / 1800), sound: 0.3 + 0.18 * Math.sin(Date.now() / 650), light: 0.62, touch: 0 }, 'SIMULATION', false);
}, 80);

async function readLines(reader, source) {
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) try { ingest(JSON.parse(line), source); } catch {}
  }
}

$('#serialBtn').onclick = async () => {
  if (!('serial' in navigator)) return alert('请使用 Chrome / Edge 的 HTTPS 或 localhost 页面开启 Web Serial');
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    serialReader = port.readable.getReader();
    state.hardwareActive = true;
    $('#hardwareStatus').textContent = 'Arduino 已连接';
    $('#connectionDot').classList.add('on');
    readLines(serialReader, 'ARDUINO / USB');
  } catch (error) { $('#hardwareStatus').textContent = error.message; }
};

$('#wsBtn').onclick = () => {
  try {
    ws?.close();
    ws = new WebSocket($('#wsUrl').value);
    ws.onopen = () => { state.hardwareActive = true; $('#hardwareStatus').textContent = 'Raspberry Pi 已连接'; $('#connectionDot').classList.add('on'); };
    ws.onmessage = event => { try { ingest(JSON.parse(event.data), 'RASPBERRY PI'); } catch {} };
    ws.onclose = () => { state.hardwareActive = false; $('#inputSource').textContent = 'SIMULATION'; $('#hardwareStatus').textContent = '连接已断开'; $('#connectionDot').classList.remove('on'); };
  } catch (error) { $('#hardwareStatus').textContent = error.message; }
};

openDB().then(() => { loadAssets(); restoreFolder(); });
window.addEventListener('keydown', event => {
  if (event.key === 'f') stage.requestFullscreen();
  if (event.key === ' ') { event.preventDefault(); $('#shuffleBtn').click(); }
});
