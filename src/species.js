// Stats for the four dinosaur species. Player values are generous; wild
// dinosaurs use the weaker `npc` block so fights stay forgiving.
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
};

export const SPECIES_ORDER = ['trex', 'trike', 'raptor', 'ptera'];

export const FOOD_HINT = {
  meat: 'Knock out a dinosaur and eat the drumstick!',
  plant: 'Find a berry bush to munch!',
  fish: 'Swoop over the jumping fish in the lake!',
};
