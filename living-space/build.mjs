import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, 'src');
const assets = path.resolve(process.env.PET_LIVING_ASSETS || path.join(root, 'assets'));
const output = path.resolve(process.env.PET_WEB_OUTPUT || path.join(root, '../web/home'));
const required = ['room.glb', 'actor.png', 'armchair.png', 'yard.glb', 'front.png', 'back.png', 'sit.png'];
const sheets = ['room-bed-sit.png', 'room-lying.png', 'room-rise.png', 'room-stretch.png', 'room-walk.png'];
const missing = required.filter(name => !fs.existsSync(path.join(assets, name)));
if (missing.length) {
    console.error('Provide rights-cleared assets in PET_LIVING_ASSETS. Missing ' + missing.join(', '));
    process.exit(1);
}

function asset(name, mime) {
    return 'data:' + mime + ';base64,' + fs.readFileSync(path.join(assets, name)).toString('base64');
}

function image(name) {
    return asset(name, 'image/png');
}

function model(name) {
    return asset(name, 'model/gltf-binary');
}

async function bundle(name) {
    const entry = path.join(source, name + '.mjs');
    const executable = process.env.ESBUILD_BINARY_PATH;
    let code;
    if (executable) {
        const result = spawnSync(executable, [entry, '--bundle', '--format=iife', '--target=es2022'], {
            encoding: 'utf8', cwd: root, maxBuffer: 16 * 1024 * 1024,
        });
        if (result.error) throw result.error;
        if (result.status !== 0) throw Error(result.stderr || 'esbuild failed');
        code = result.stdout;
    } else {
        const { build } = await import('esbuild');
        const result = await build({ entryPoints: [entry], bundle: true, format: 'iife', target: 'es2022', write: false });
        code = result.outputFiles[0].text;
    }
    return code.replaceAll('</script', '<\\/script');
}

const read = name => fs.readFileSync(path.join(source, name), 'utf8');
const css = names => names.map(name => read(name + '.css')).join('\n');
const roomAssets = { room: model('room.glb'), actor: image('actor.png'), armchair: image('armchair.png') };
for (const name of sheets) {
    if (fs.existsSync(path.join(assets, name))) roomAssets[name] = image(name);
}
const yardActors = { front: image('front.png'), back: image('back.png'), sit: image('sit.png') };
if (roomAssets['room-walk.png']) yardActors.walk = roomAssets['room-walk.png'];

const [roomCode, yardCode] = await Promise.all([bundle('pose-room'), bundle('yard-scene')]);
const room = read('pure-room.template.html')
    .replace('__GAME_STYLES__', () => css(['room-games', 'handheld-games', 'device-games', 'game-colors',
        'switch-shell', 'cottage-ui', 'computer-apps', 'moon-theme', 'room-moon-menu', 'room-town-transitions']))
    .replace('__ASSETS__', () => JSON.stringify(roomAssets))
    .replace('__BUNDLE__', () => roomCode);
const yard = read('yard-scene.template.html')
    .replace('__TOWN_TOOL_STYLES__', '')
    .replace('__COTTAGE_STYLES__', () => css(['moon-theme', 'town-ui']))
    .replace('__ACTOR_ASSETS__', () => JSON.stringify(yardActors))
    .replace('__MODEL__', () => JSON.stringify(model('yard.glb')))
    .replace('__BUNDLE__', () => yardCode);

fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'room3d.html'), room);
for (const dir of ['yard', 'town/yard']) {
    fs.mkdirSync(path.join(output, dir), { recursive: true });
    fs.writeFileSync(path.join(output, dir, 'index.html'), yard);
}
console.log('Built the room and both yard pages.');
