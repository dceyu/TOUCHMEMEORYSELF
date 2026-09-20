import { app, BrowserWindow, dialog, ipcMain, net, protocol, screen } from 'electron';
import { existsSync } from 'node:fs';
import { extname, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SerialService } from './serial-service';
import { ArduinoService } from './arduino-service';
import { ProjectService } from './project-service';
import type { OutputSnapshot, PerformanceInfo, StudioProject } from '../src/shared/types';

protocol.registerSchemesAsPrivileged([{ scheme: 'centopia-media', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }]);

let controlWindow: BrowserWindow | null = null;
let outputWindow: BrowserWindow | null = null;
let lastSnapshot: OutputSnapshot | undefined;
let performance: PerformanceInfo = { fps: 0, frameMs: 0, quality: 'high', serialConnected: false, globalState: 'standby' };
const serial = new SerialService();
const projects = new ProjectService();
const arduino = new ArduinoService(serial);
const supportedMedia = new Set(['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm']);

function rendererUrl(hash = '') {
  const dev = process.env.VITE_DEV_SERVER_URL;
  return dev ? `${dev}${hash}` : pathToFileURL(join(__dirname, '../../dist/index.html')).toString() + hash;
}

function createControlWindow() {
  controlWindow = new BrowserWindow({ width: 1600, height: 980, minWidth: 1180, minHeight: 720, backgroundColor: '#070807', title: 'CENTOPIA Mapping Studio', webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  controlWindow.loadURL(rendererUrl());
  controlWindow.on('closed', () => { controlWindow = null; outputWindow?.close(); });
}

function createOutputWindow(displayId?: number) {
  outputWindow?.close();
  const displays = screen.getAllDisplays();
  const display = displays.find(item => item.id === displayId) ?? displays.find(item => !item.bounds.x && !item.bounds.y) ?? displays[0];
  const nextWindow = new BrowserWindow({ ...display.bounds, frame: false, fullscreen: true, kiosk: false, autoHideMenuBar: true, backgroundColor: '#000000', show: false, webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  outputWindow=nextWindow;
  nextWindow.loadURL(rendererUrl('#/output'));
  nextWindow.once('ready-to-show', () => { if(nextWindow.isDestroyed())return;nextWindow.showInactive(); if (lastSnapshot) nextWindow.webContents.send('output:state', lastSnapshot); controlWindow?.webContents.send('output:status',{open:true,displayId:display.id}); });
  nextWindow.on('closed', () => { if(outputWindow!==nextWindow)return;outputWindow = null; controlWindow?.webContents.send('output:status',{open:false}); });
}

app.whenReady().then(() => {
  protocol.handle('centopia-media', request => {
    const encoded = new URL(request.url).pathname.slice(1);
    const path = decodeURIComponent(encoded);
    if (!isAbsolute(path) || !existsSync(path) || !supportedMedia.has(extname(path).toLowerCase())) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(path).toString());
  });
  createControlWindow();
  app.on('activate', () => { if (!controlWindow) createControlWindow(); });
});
app.on('window-all-closed', () => { serial.disconnect(); app.quit(); });

serial.on('frame', frame => { controlWindow?.webContents.send('serial:frame', frame); });
serial.on('status', status => { controlWindow?.webContents.send('serial:status', status); performance.serialConnected = Boolean((status as { connected?: boolean }).connected); });

ipcMain.handle('serial:list', () => serial.list());
ipcMain.handle('serial:connect', (_event, path: string) => {if(arduino.busy)throw new Error('Arduino upload in progress');return serial.connect(path);});
ipcMain.handle('serial:disconnect', () => serial.disconnect());
ipcMain.handle('serial:status', () => serial.getStatus());
ipcMain.handle('arduino:run', (_event, wiring, port, touch) => arduino.run(wiring,port,touch));
ipcMain.handle('arduino:touch-config', (event, config) => {if(event.sender!==controlWindow?.webContents)throw new Error('Control window only');return serial.configureTouch(config);});
ipcMain.handle('arduino:touch-calibrate', event => {if(event.sender!==controlWindow?.webContents||arduino.busy)throw new Error('Unavailable');return serial.calibrateTouch();});
ipcMain.handle('project:export', (_event, project) => projects.exportPortable(project));
ipcMain.handle('project:open', () => projects.open());
ipcMain.handle('project:save', (_event, project: StudioProject) => projects.save(project));
ipcMain.handle('project:save-as', (_event, project: StudioProject) => projects.save(project, true));
ipcMain.handle('media:import', () => projects.importMedia());
ipcMain.handle('media:locate', (_event, asset) => projects.locateMedia(asset));
ipcMain.handle('media:url', (_event, path: string) => {
  if (!isAbsolute(path) || !supportedMedia.has(extname(path).toLowerCase())) throw new Error('Unsupported media path');
  return `centopia-media://local/${encodeURIComponent(path)}`;
});
ipcMain.handle('output:list-displays', () => screen.getAllDisplays().map((display, index) => ({ id: display.id, label: `${index + 1} · ${display.size.width}×${display.size.height}`, bounds: display.bounds, primary: display.id === screen.getPrimaryDisplay().id })));
ipcMain.handle('output:open', (_event, displayId?: number) => createOutputWindow(displayId));
ipcMain.handle('output:close', () => outputWindow?.close());
ipcMain.handle('output:refresh', () => { if(outputWindow&&!outputWindow.isDestroyed()){outputWindow.webContents.reload();return true;}return false; });
ipcMain.handle('output:blackout', (_event, value: boolean) => { if (lastSnapshot) { lastSnapshot.project.mapping.blackout = value; outputWindow?.webContents.send('output:state', lastSnapshot); } });
ipcMain.on('output:state', (_event, snapshot: OutputSnapshot) => { lastSnapshot = snapshot; outputWindow?.webContents.send('output:state', snapshot); });
ipcMain.on('runtime:final', () => controlWindow?.webContents.send('runtime:command', 'final'));
ipcMain.on('runtime:reset', () => controlWindow?.webContents.send('runtime:command', 'reset'));
ipcMain.on('runtime:performance', (_event, info: PerformanceInfo) => { performance = { ...info, serialConnected: performance.serialConnected }; });
ipcMain.handle('runtime:get-performance', () => performance);

app.on('before-quit', event => {
  if (controlWindow?.webContents && !(controlWindow as BrowserWindow & { allowClose?: boolean }).allowClose) {
    const choice = dialog.showMessageBoxSync(controlWindow, { type: 'question', buttons: ['退出', '取消'], defaultId: 1, title: '退出 CENTOPIA', message: '请确认项目已经保存。是否退出？' });
    if (choice === 1) event.preventDefault();
    else (controlWindow as BrowserWindow & { allowClose?: boolean }).allowClose = true;
  }
});
