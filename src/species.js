// Stats for the four dinosaur species. Player values are generous; wild
// dinosaurs use the weaker `npc` block so fights stay forgiving.
// (Mosasaurus and Quetzalcoatlus are not dinosaurs, but they live here too.)
// `climb` is the steepest slope a species can walk up, as rise per metre
// (0.8 is about 39 degrees, 1.15 about 49). The volcano is mostly 0.8 to 1.2.
export const SPECIES = {
  trex: {
    name: 'T-Rex', blurb: 'Huge and strong. A bit slow.',
    speed: 9, sprint: 14, jump: 7, climb: 0.8, stride: 0.42,
    hp: 220, dmg: 40, range: 4.2, atkCd: 1.4, radius: 2.0,
    diet: 'meat', camDist: 16, camH: 4.6, headH: 5.2,
    attackName: 'Chomp', special: 'roar', specialName: 'Roar', specialCd: 12,
    npc: { hp: 160, dmg: 34 },
  },
  trike: {
    name: 'Triceratops', blurb: 'Tough tank with a mighty charge.',
    speed: 10, sprint: 15, jump: 6, climb: 0.8, stride: 0.55,
    hp: 240, dmg: 26, range: 3.6, atkCd: 0.6, radius: 2.0,
    diet: 'plant', camDist: 14, camH: 3.6, headH: 4.0,
    attackName: 'Horn jab', special: 'charge', specialName: 'Charge', specialCd: 4,
    npc: { hp: 130, dmg: 19 },
  },
  raptor: {
    name: 'Velociraptor', blurb: 'Super fast. Leaps on its prey.',
    speed: 14, sprint: 21, jump: 11, climb: 1.15, stride: 1.0,
    hp: 110, dmg: 15, range: 2.4, atkCd: 0.35, radius: 0.8,
    diet: 'meat', camDist: 7.5, camH: 2.0, headH: 2.3,
    attackName: 'Claw swipe', special: 'pounce', specialName: 'Pounce', specialCd: 2.5,
    npc: { hp: 85, dmg: 15 },
  },
  ptera: {
    name: 'Pteranodon', blurb: 'Flies! Dive-bomb from the sky.',
    speed: 8, sprint: 11, fly: 22, jump: 0, climb: 0.8, stride: 1.0,
    hp: 100, dmg: 14, range: 2.8, atkCd: 0.4, radius: 1.0,
    diet: 'fish', camDist: 10, camH: 1.8, headH: 2.0,
    attackName: 'Beak peck', special: 'dive', specialName: 'Dive-bomb', specialCd: 2,
    npc: { hp: 35, dmg: 15 },
  },
  anky: {
    name: 'Ankylosaurus', blurb: 'Armoured tank with a bone-club tail.',
    speed: 7, sprint: 10.5, jump: 4, climb: 0.75, stride: 0.5,
    hp: 300, dmg: 28, range: 3.6, atkCd: 0.9, radius: 2.0, knock: 14, allAround: true,
    diet: 'plant', camDist: 13, camH: 3.2, headH: 2.2, home: 5,
    attackName: 'Tail club', special: 'armor', specialName: 'Armour up', specialCd: 10,
    npc: { hp: 150, dmg: 14 },
  },
  pachy: {
    name: 'Pachycephalo\u00ADsaurus', blurb: 'Quick and hard-headed. Rams anything.',
    speed: 12, sprint: 18, jump: 8, climb: 1.0, stride: 0.75,
    hp: 150, dmg: 20, range: 2.6, atkCd: 0.5, radius: 1.0, knock: 9,
    diet: 'plant', camDist: 9, camH: 2.6, headH: 2.6, home: 5,
    attackName: 'Head butt', special: 'ram', specialName: 'Ram', specialCd: 3.5,
    npc: { hp: 80, dmg: 10 },
  },
  brachio: {
    name: 'Brachiosaurus', blurb: 'A giant! Eats leaves from tall trees.',
    speed: 7, sprint: 10, jump: 0, climb: 0.6, stride: 0.22,
    hp: 420, dmg: 30, range: 4.5, atkCd: 1.2, radius: 3.2, knock: 16,
    diet: 'leaves', camDist: 28, camH: 9, headH: 13, home: 6,
    attackName: 'Stomp', special: 'quake', specialName: 'Big stomp', specialCd: 9,
    npc: { hp: 300, dmg: 18 },
  },
  quetz: {
    name: 'Quetzalcoatlus', blurb: 'Giant flyer with a huge beak.',
    speed: 7, sprint: 10, fly: 26, jump: 0, climb: 0.8, stride: 0.6,
    hp: 160, dmg: 22, range: 3.8, atkCd: 0.6, radius: 1.6, knock: 8,
    diet: 'fish', camDist: 14, camH: 4, headH: 5.0, home: 7,
    foodHint: 'Swoop over the fish, or eat a drumstick!',
    attackName: 'Beak stab', special: 'gust', specialName: 'Wing gust', specialCd: 6,
    npc: { hp: 70, dmg: 10 },
  },
  mosa: {
    name: 'Mosasaurus', blurb: 'Sea monster! Fast swimmer, stays in the water.',
    speed: 11, sprint: 17, jump: 0, stride: 0.3, swim: true,
    hp: 260, dmg: 36, range: 4.2, atkCd: 0.8, radius: 2.2, knock: 12, pounceDmg: 45,
    diet: 'fish', camDist: 18, camH: 3.5, headH: 1.6,
    foodHint: 'Swim through the fish in the sea to eat them!',
    attackName: 'Big bite', special: 'pounce', specialName: 'Breach', specialCd: 4,
    npc: { hp: 180, dmg: 20 },
  },
};

export const SPECIES_ORDER = ['trex', 'trike', 'raptor', 'ptera', 'anky', 'pachy', 'brachio', 'quetz', 'mosa'];

export const FOOD_HINT = {
  meat: 'Knock out a dinosaur and eat the drumstick!',
  plant: 'Find a berry bush to munch!',
  fish: 'Swoop over the jumping fish in the lake!',
  leaves: 'Reach up into a tall tree and press E!',
};
