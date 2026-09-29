const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const root = path.resolve(__dirname, '..');
const phaser = path.join(root, 'pixel-office/node_modules/phaser/src');
const Phaser = {
  Math: { Vector2: require(phaser + '/math/Vector2'), Clamp: (n, a, b) => Math.max(a, Math.min(n, b)),
    Linear: (a, b, t) => a + (b-a)*t, Distance: { Between: (x,y,a,b) => Math.hypot(x-a,y-b) } },
  Geom: { Polygon: require(phaser + '/geom/polygon/Polygon') }
};
function load(name) {
  let source = fs.readFileSync(path.join(root, 'pixel-office/src/game/systems', name + '.ts'), 'utf8');
  source = stripTypeScriptTypes(source, {mode:'transform'}).replace(/import Phaser from 'phaser';/, '').replace('export class', 'class');
  return vm.runInNewContext(source + '\n' + name, { Phaser });
}
const NavigationSystem = load('NavigationSystem');
const Movement = load('CharacterMovementSystem');
const graphics = new Proxy({}, {get: () => () => graphics});
const scene = {add: {graphics: () => graphics}};
const point = (p) => new Phaser.Math.Vector2(p.x, p.y);
const map = JSON.parse(fs.readFileSync(path.join(root, 'pixel-office/public/assets/game/maps/office-navigation-latest-20260827.json')));
// Apply the same map augmentation as the scene without starting the renderer.
let sceneSource = fs.readFileSync(path.join(root, 'pixel-office/src/game/scenes/OfficeScene.ts'), 'utf8');
const augmentation = sceneSource.slice(sceneSource.indexOf('  private ensureExecutiveAnchors('), sceneSource.indexOf('  private addEmployeeToWorld('));
const Augment = vm.runInNewContext(stripTypeScriptTypes('class Augment {\n' + augmentation + '\n}\nAugment', {mode:'transform'}));
new Augment().ensureExecutiveAnchors(map);
const nav = new NavigationSystem(scene, map, 1920, 1080);
let count = 0;
const started = performance.now();
for (const anchor of [...map.interactionAnchors, ...map.seats, ...map.spawns, ...map.waypoints]) {
  if (process.argv[2] && anchor.id !== process.argv[2]) continue;
  const start = point({x:960,y:450});
  const route = nav.findPath(start, point(anchor.position), 140);
  assert.ok(route, 'No route to ' + anchor.id + ' resolved=' + JSON.stringify(nav.resolveDestination(point(anchor.position))));
  let arrived = false;
  const character = {container: {x:start.x,y:start.y,setPosition(x,y){this.x=x;this.y=y;}}, setMoving(){}, face(){}};
  const movement = new Movement(character, (x,y) => {
    const valid = nav.canOccupy(x,y);
    if (!valid) console.error({anchor:anchor.id, x,y, route});
    return valid;
  }, () => assert.fail('Blocked: '+anchor.id));
  movement.follow(route, () => arrived = true);
  for(let frame=0;frame<10000 && !arrived;frame++) movement.update(frame % 17 === 0 ? 1000 : 16);
  assert.ok(arrived, 'Timed out: '+anchor.id);
  assert.ok(nav.findPath(point(character.container), start), 'No return route: ' + anchor.id);
  count++;
}
// A long frame and the last snap must not tunnel through an obstacle.
let blocked = false;
const character = {container: {x:0,y:0,setPosition(x,y){this.x=x;this.y=y;}},setMoving(){},face(){}};
const movement = new Movement(character, (x) => x < 5 || x > 10, () => blocked = true);
movement.follow([point({x:15,y:0})], () => assert.fail('Crossed wall'));
movement.update(1000);
assert.ok(blocked);
assert.ok(character.container.x < 5);
console.log(`PASS: ${count} office destinations, return routes, delayed-frame movement and wall collision (${Math.round(performance.now()-started)} ms)`);
