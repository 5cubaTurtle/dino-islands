# 🦖 Dino Island

A free-roam 3D dinosaur game that runs in your web browser. Pick a dinosaur,
explore three islands, find food and water, fight wild animals, and defeat
three bosses to become the **Ruler of Dino Island**.

Built with plain JavaScript and [Three.js](https://threejs.org/). There's no build step and nothing to install.

## Play

You need Python 3 and a modern browser (Firefox or Chrome).

```bash
git clone <this-repo-url>
cd dino-island
./run.sh            # or: ./run.sh 9000  to use another port
```

Then open <http://localhost:8080>.

The game uses JavaScript modules, so you can't open `index.html` by double-clicking it.
It has to be served by a web server. `run.sh` starts a small one with caching off, and
any other static file server works too.

## Controls

| Action | Keys |
|---|---|
| Move | **W A S D** |
| Look around | **Mouse** (click the game to lock the pointer) |
| Attack | **Left click** or **J** |
| Special move | **Right click** or **K** |
| Jump / run | **Space** / **Shift** |
| Fly up / down (flyers) | **Space** / **Shift** |
| Eat or drink | **E** |
| Pause | **P** |

## The dinosaurs

| Dinosaur | Attack | Special | Eats |
|---|---|---|---|
| T-Rex | Chomp | Roar | Meat |
| Triceratops | Horn jab | Charge | Plants |
| Velociraptor | Claw swipe | Pounce | Meat |
| Pteranodon | Beak peck | Dive-bomb | Fish |
| Ankylosaurus | Tail club | Armour up | Plants |
| Pachycephalosaurus | Head butt | Ram | Plants |
| Brachiosaurus | Stomp | Big stomp | Tree leaves |
| Quetzalcoatlus | Beak stab | Wing gust | Fish |
| Mosasaurus | Big bite | Breach | Fish (lives in the sea) |

Your dinosaur has the same health and bite strength as a wild one of the same kind.
Animals of the same species won't attack each other.

## The world

- **Three islands:** Dino Island (jungle, plains, a lake and a volcano), Fern Island, and Sky Rock.
- **Survival:** watch your ❤️ health, 🍖 hunger and 💧 thirst. Starving, going thirsty,
  lava, and big falls will knock you out, and you'll wake up back at your nest.
  Seawater is salty and makes you thirstier.
- **Food:** meat-eaters eat drumsticks left by knocked-out dinosaurs, plant-eaters munch
  berry bushes, the Brachiosaurus reaches into tall trees, and flyers and the Mosasaurus catch fish.
- **Trees:** the Triceratops and Pachycephalosaurus can knock trees down. A tree that falls
  across a river becomes a log bridge that light dinosaurs can walk over.
- **Bosses:** the **Raptor Queen** calls her pack, **Old Three-Horn** charges, and
  **King Rex** stomps. Beat each one to win a 👑 crown.

Your crowns and your chosen dinosaur are saved in the browser. Use **Start over** on the
menu to reset them.

## Project layout

```
index.html        page, HUD and menus
style.css         styling
run.sh            local web server (no caching)
vendor/           Three.js (bundled, so no npm install needed)
src/
  main.js         game loop, menus, naps and waking up
  world.js        islands, terrain, water, lava, trees
  species.js      stats for every dinosaur
  player.js       player movement and moves
  ai.js           wild animal behaviour
  bosses.js       the three bosses
  combat.js       damage and knock-outs
  survival.js     health, hunger, thirst, food and drink
  dinoModels.js,
  models2.js      low-poly dinosaur models
  camera.js, hud.js, input.js, audio.js, save.js, entity.js, geom.js
```

To tweak the balance, edit `src/species.js` (speed, health, damage, cooldowns)
or `src/bosses.js`, then reload the page.
