// Burrow sim · data.js — Constants: tiles, items, recipes, pacing, and the seeded noise helpers.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
'use strict';

const W = 600, H = 128;
const TPS = 20;                // sim ticks per second at 1x
const DAY = 9600;              // ticks per full day (8 min at 1x)

// ---------- tiles ----------
const T = {AIR:0,GRASS:1,DIRT:2,STONE:3,DEEP:4,BEDROCK:5,SAND:6,SANDSTONE:7,SNOW:8,LOG:9,LEAVES:10,PINE:11,
  PLANKS:12,COBBLE:13,MOSSY:14,COAL:15,COPPER:16,IRON:17,GOLD:18,GEM:19,WATER:20,LAVA:21,TORCH:22,
  BENCH:23,FURNACE:24,CHEST:25,BED:26,DOOR:27,GRAVE:28,BUSH:29,BUSHE:30,TGRASS:31,FLOWER:32,CACTUS:33,OBSIDIAN:34};
const P = [];
function def(id, name, solid, base, tier, drop, mini) { P[id] = {name, solid, base, tier, drop, mini}; }
const INF = Infinity;
def(T.AIR,'air',0,0,0,null,null);
def(T.GRASS,'grass',1,12,0,'dirt','#5f9e3a');
def(T.DIRT,'dirt',1,11,0,'dirt','#7a5232');
def(T.STONE,'stone',1,30,1,'cobble','#7b7b80');
def(T.DEEP,'deep rock',1,44,2,'cobble','#4b4955');
def(T.BEDROCK,'bedrock',1,INF,9,null,'#232229');
def(T.SAND,'sand',1,10,0,'sand','#dccb8e');
def(T.SANDSTONE,'sandstone',1,26,1,'sandstone','#c9b277');
def(T.SNOW,'snowy grass',1,12,0,'dirt','#eef3f6');
def(T.LOG,'log',0,24,0,'log','#7a5530');
def(T.LEAVES,'leaves',0,5,0,'leaf','#3f7d31');
def(T.PINE,'pine needles',0,5,0,'leaf','#2d5a3e');
def(T.PLANKS,'planks',1,16,0,'planks','#b08850');
def(T.COBBLE,'cobble',1,30,1,'cobble','#6a6a70');
def(T.MOSSY,'mossy cobble',1,30,1,'cobble','#5d7058');
def(T.COAL,'coal ore',1,34,1,'coal','#2e2e33');
def(T.COPPER,'copper ore',1,40,2,'raw_copper','#c27a4a');
def(T.IRON,'iron ore',1,44,2,'raw_iron','#c9a98a');
def(T.GOLD,'gold ore',1,50,3,'raw_gold','#e8c13a');
def(T.GEM,'gem ore',1,56,3,'gem','#4fd6d0');
def(T.WATER,'water',0,INF,9,null,'#3a6fd8');
def(T.LAVA,'lava',0,INF,9,null,'#ff6a1a');
def(T.TORCH,'torch',0,2,0,'torch','#ffd27a');
def(T.BENCH,'workbench',0,INF,9,null,'#a0703a');
def(T.FURNACE,'furnace',0,INF,9,null,'#55555a');
def(T.CHEST,'chest',0,INF,9,null,'#b07a30');
def(T.BED,'bed',0,INF,9,null,'#c0392b');
def(T.DOOR,'door',0,INF,9,null,'#8a6036');
def(T.GRAVE,'dropped pack',0,INF,9,null,'#e0e0e0');
def(T.BUSH,'berry bush',0,4,0,null,'#356b2a');
def(T.BUSHE,'bush',0,4,0,null,'#356b2a');
def(T.TGRASS,'tall grass',0,1,0,null,null);
def(T.FLOWER,'flower',0,1,0,null,null);
def(T.CACTUS,'cactus',0,8,0,null,'#2f7d3a');
def(T.OBSIDIAN,'obsidian',1,300,4,'obsidian','#2a1d3a'); // gem pickaxe or better, and slow even then
// crafted building blocks and furniture (ids appended so older saves keep their tiles)
Object.assign(T, {STONE_BRICKS:35,GLASS:36,GLASS_PANE:37,IRON_BARS:38,IRON_DOOR:39,COAL_BLOCK:40,COPPER_BLOCK:41,IRON_BLOCK:42,GOLD_BLOCK:43,GEM_BLOCK:44,
  ANVIL:45,STONECUTTER:46,SMOKER:47,BLAST_FURNACE:48,CAULDRON:49,COPPER_CHEST:50,HOPPER:51,LANTERN:52,COPPER_LANTERN:53,CAMPFIRE:54,
  SIGN:55,FENCE:56,FENCE_GATE:57,RAIL:58,MINECART:59,WOOD_STAIRS:60,WOOD_SLAB:61,LADDER:62,SMOOTH_STONE:63,CUT_SANDSTONE:64,
  CHISELED_SANDSTONE:65,SMOOTH_SANDSTONE:66,TRAPDOOR:67,STONE_TILE:68,
  COBBLE_STAIRS:69,SANDSTONE_STAIRS:70,STONE_SLAB:71,SANDSTONE_SLAB:72,COBBLE_WALL:73,SANDSTONE_WALL:74,PRESSURE_PLATE:75,BUTTON:76,
  IRON_TRAPDOOR:77,BUCKET:78,BOAT:79,CHEST_BOAT:80,EXPEDITION_PACK:81,COPPER_TORCH:82,STORE_CHEST:83,SAPLING:84,SPAWNER:85,
  ASHROCK:86,CINDERITE:87,EMBERCAP:88,VAULT_BRICK:89,GATESTONE:90,GATE:91,CHARWOOD:92,EMBERLEAF:93,SHARDROCK:94,GLIMMER:95,BONE:96,WARDSTONE:97,WARD_DOOR:98,FARMLAND:99,WHEAT:100,POTATO_PLANT:101,WILD_POTATO:102});
def(T.STONE_BRICKS,'stone bricks',1,34,1,'stone_bricks','#77777d');
def(T.GLASS,'glass',1,6,0,null,'#b8dce8');
def(T.GLASS_PANE,'glass pane',1,5,0,null,'#b8dce8');
def(T.IRON_BARS,'iron bars',1,40,1,'iron_bars','#8d9099');
def(T.IRON_DOOR,'iron door',0,INF,9,null,'#b8bcc6');
def(T.COAL_BLOCK,'coal block',1,40,1,'coal_block','#1d1d22');
def(T.COPPER_BLOCK,'copper block',1,46,1,'copper_block','#d9844a');
def(T.IRON_BLOCK,'iron block',1,50,1,'iron_block','#dcdee4');
def(T.GOLD_BLOCK,'gold block',1,50,1,'gold_block','#f5cd45');
def(T.GEM_BLOCK,'gem block',1,56,1,'gem_block','#4fe0d6');
def(T.ANVIL,'anvil',0,INF,9,null,'#4a4a52');
def(T.STONECUTTER,'stonecutter',0,INF,9,null,'#7b7b80');
def(T.SMOKER,'smoker',0,INF,9,null,'#5a4a3a');
def(T.BLAST_FURNACE,'blast furnace',0,INF,9,null,'#55555f');
def(T.CAULDRON,'cauldron',0,INF,9,null,'#3a3a42');
def(T.COPPER_CHEST,'copper chest',0,INF,9,null,'#c87a3a');
def(T.HOPPER,'hopper',0,INF,9,null,'#45454d');
def(T.LANTERN,'lantern',0,INF,9,null,'#ffd27a');
def(T.COPPER_LANTERN,'copper lantern',0,INF,9,null,'#9fe0c0');
def(T.CAMPFIRE,'campfire',0,INF,9,null,'#ff8a2a');
def(T.SIGN,'sign',0,INF,9,null,'#b08850');
def(T.FENCE,'fence',0,INF,9,null,'#a07a48');
def(T.FENCE_GATE,'fence gate',0,INF,9,null,'#a07a48');
def(T.RAIL,'rail',0,INF,9,null,'#8a8a90');
def(T.MINECART,'minecart',0,INF,9,null,'#6a6a72');
def(T.WOOD_STAIRS,'wood stairs',0,INF,9,null,'#b08850');
def(T.WOOD_SLAB,'wood slab',0,INF,9,null,'#b08850');
def(T.LADDER,'ladder',0,INF,9,null,'#9a6a3a');
def(T.SMOOTH_STONE,'smooth stone',1,32,1,'smooth_stone','#9a9aa0');
def(T.CUT_SANDSTONE,'cut sandstone',1,26,1,'cut_sandstone','#d2bb80');
def(T.CHISELED_SANDSTONE,'chiseled sandstone',1,26,1,'chiseled_sandstone','#c9ae6e');
def(T.SMOOTH_SANDSTONE,'smooth sandstone',1,26,1,'smooth_sandstone','#dcc68a');
def(T.TRAPDOOR,'trapdoor',0,INF,9,null,'#9a6a3a');
def(T.STONE_TILE,'stone',1,30,1,'stone','#8a8a90');
def(T.COBBLE_STAIRS,'cobble stairs',0,INF,9,null,'#77777d');
def(T.SANDSTONE_STAIRS,'sandstone stairs',0,INF,9,null,'#d2bb80');
def(T.STONE_SLAB,'stone slab',0,INF,9,null,'#8a8a90');
def(T.SANDSTONE_SLAB,'sandstone slab',0,INF,9,null,'#d2bb80');
def(T.COBBLE_WALL,'cobble wall',0,INF,9,null,'#77777d');
def(T.SANDSTONE_WALL,'sandstone wall',0,INF,9,null,'#d2bb80');
def(T.PRESSURE_PLATE,'pressure plate',0,INF,9,null,'#8a8a90');
def(T.BUTTON,'button',0,INF,9,null,'#8a8a90');
def(T.IRON_TRAPDOOR,'iron trapdoor',0,INF,9,null,'#b8bcc6');
def(T.BUCKET,'bucket',0,INF,9,null,'#b8bcc6');
def(T.BOAT,'boat',0,INF,9,null,'#8a6036');
def(T.CHEST_BOAT,'chest boat',0,INF,9,null,'#8a6036');
def(T.EXPEDITION_PACK,'expedition pack',0,INF,9,null,'#8a6036');
def(T.COPPER_TORCH,'copper torch',0,INF,9,null,'#9fe0c0');
def(T.ASHROCK,'ashrock',1,34,1,'cobble','#4a2c2c');
def(T.CINDERITE,'cinderite ore',1,70,4,'raw_cinderite','#ff6a2a');
def(T.EMBERCAP,'embercap',0,INF,9,null,'#ff8a3a');
def(T.VAULT_BRICK,'vault brick',1,80,3,null,'#3a2436');
def(T.GATESTONE,'gatestone',1,INF,9,null,'#2c2238');
def(T.GATE,'Underworld gate',0,INF,9,null,'#e0502a');
def(T.CHARWOOD,'charwood',0,24,0,'coal','#3a2420'); // burnt right through: it splits into coal
def(T.EMBERLEAF,'ember leaves',0,5,0,'emberfruit','#e0602a');
def(T.SHARDROCK,'shardrock',1,34,1,'cobble','#5a4e86');
def(T.GLIMMER,'glimmer crystal',1,60,6,'glimmer','#c8b4ff'); // takes a cinder pickaxe
def(T.BONE,'old bone',1,30,1,null,'#d8ccb0');
def(T.WARDSTONE,'wardstone',1,INF,9,null,'#241a30');
def(T.WARD_DOOR,'Citadel door',1,INF,9,null,'#8a5ae0');
def(T.SPAWNER,'monster spawner',1,60,3,null,'#2f4a7a'); // tier 3: takes an iron pickaxe
def(T.SAPLING,'sapling',0,INF,9,null,'#5a9a3a');
def(T.STORE_CHEST,'storage chest',0,INF,9,null,'#b07a30'); // placed by the miner, so there's nothing in it to loot

def(T.FARMLAND,'farmland',1,INF,9,null,'#5a3a22'); // the miner leaves these alone, and so do its routes
def(T.WHEAT,'wheat',0,INF,9,null,'#c8b04a');
def(T.POTATO_PLANT,'potato plant',0,INF,9,null,'#5a9a3a');
def(T.WILD_POTATO,'wild potato',0,3,0,'potato','#6aa83e');
// home comforts (comforts.js): furniture the miner puts about its keep
Object.assign(T, {WEATHERVANE: 103, TROPHY_SHELF: 104, MAP_TABLE: 105, RAIN_BARREL: 106, WIND_CHIMES: 107, PET_BED: 108});
def(T.WEATHERVANE,'weathervane',0,INF,9,null,'#c88a4a');
def(T.TROPHY_SHELF,'trophy shelf',0,INF,9,null,'#8a6036');
def(T.MAP_TABLE,'map table',0,INF,9,null,'#b08850');
def(T.RAIN_BARREL,'rain barrel',0,INF,9,null,'#7a5232');
def(T.WIND_CHIMES,'wind chimes',0,INF,9,null,'#c88a4a');
def(T.PET_BED,'pet bed',0,INF,9,null,'#a8503a');
const isSolid = t => P[t].solid === 1;
const passable = t => !P[t].solid && t !== T.LAVA; // the miner can wade through water
const monPass = t => passable(t) && t !== T.DOOR && t !== T.IRON_DOOR && t !== T.FENCE_GATE;
const stopsShot = t => isSolid(t) || t === T.DOOR || t === T.IRON_DOOR; // arrows pass furniture and fences, not doors
const SPEED = [1, 2, 3, 4.5, 7, 9, 12];
const PACE_DIG = 2.3, PACE_MOVE = 1.5;
const ORE_TILES = [T.COAL, T.COPPER, T.IRON, T.GOLD, T.GEM, T.CINDERITE, T.GLIMMER, T.OBSIDIAN];
const DECOR = new Set([T.TGRASS, T.FLOWER, T.SAPLING, T.EMBERCAP, T.WILD_POTATO]);
const LIGHT_TILES = new Set([T.TORCH, T.LANTERN, T.COPPER_LANTERN, T.COPPER_TORCH, T.CAMPFIRE, T.EMBERCAP, T.GATE, T.GLIMMER, T.WARD_DOOR]); // keep monsters from spawning nearby

// ---------- items ----------
const ITEMS = {
  log:'Log', planks:'Planks', stick:'Stick', leaf:'Leaf bundle', dirt:'Dirt', cobble:'Cobble', sand:'Sand', sandstone:'Sandstone',
  coal:'Coal', raw_copper:'Raw copper', raw_iron:'Raw iron', raw_gold:'Raw gold', gem:'Gem',
  copper_ingot:'Copper ingot', iron_ingot:'Iron ingot', gold_ingot:'Gold ingot',
  torch:'Torch', bench:'Workbench', furnace:'Furnace', bed:'Bed', door:'Door', chest:'Chest',
  wood_pick:'Wood pickaxe', stone_pick:'Stone pickaxe', iron_pick:'Iron pickaxe', gem_pick:'Gem pickaxe',
  wood_sword:'Wood sword', stone_sword:'Stone sword', iron_sword:'Iron sword',
  copper_armor:'Copper armor', iron_armor:'Iron armor',
  berries:'Berries', apple:'Apple', raw_meat:'Raw meat', cooked_meat:'Cooked meat', bread:'Bread',
  fishing_rod:'Fishing rod', raw_fish:'Raw fish', cooked_fish:'Cooked fish', old_boot:'Old boot'
};
const RECIPES = {
  planks:{out:4,in:{log:1}},
  stick:{out:4,in:{planks:2}},
  bench:{out:1,in:{planks:4}},
  torch:{out:4,in:{coal:1,stick:1}},
  wood_pick:{out:1,in:{planks:3,stick:2},st:'bench'},
  wood_sword:{out:1,in:{planks:2,stick:1},st:'bench'},
  stone_pick:{out:1,in:{cobble:3,stick:2},st:'bench'},
  stone_sword:{out:1,in:{cobble:2,stick:1},st:'bench'},
  furnace:{out:1,in:{cobble:8},st:'bench'},
  bed:{out:1,in:{planks:3,leaf:3},st:'bench'},
  door:{out:2,in:{planks:4},st:'bench'},
  chest:{out:1,in:{planks:8},st:'bench'},
  copper_ingot:{out:2,in:{raw_copper:2,coal:1},st:'furnace'},
  iron_ingot:{out:2,in:{raw_iron:2,coal:1},st:'furnace'},
  gold_ingot:{out:2,in:{raw_gold:2,coal:1},st:'furnace'},
  cooked_meat:{out:1,in:{raw_meat:1,coal:1},st:'furnace'},
  cooked_fish:{out:1,in:{raw_fish:1,coal:1},st:'furnace'},
  fishing_rod:{out:1,in:{stick:3,leaf:4}},
  sand:{out:1,in:{cobble:1},st:'bench'}, // ground down, because not every world has a desert
  copper_armor:{out:1,in:{copper_ingot:5},st:'bench'},
  iron_pick:{out:1,in:{iron_ingot:3,stick:2},st:'bench'},
  iron_sword:{out:1,in:{iron_ingot:2,stick:1},st:'bench'},
  iron_armor:{out:1,in:{iron_ingot:8},st:'bench'},
  gem_pick:{out:1,in:{gem:3,gold_ingot:2,stick:2},st:'bench'}
};
// ---------- the bigger crafting set ----------
// tools and weapons in every material: [key prefix, display name, ingredient, durability]
const MATS = [['wood', 'Wood', 'planks', 60], ['stone', 'Stone', 'cobble', 260], ['copper', 'Copper', 'copper_ingot', 190],
  ['iron', 'Iron', 'iron_ingot', 320], ['gold', 'Gold', 'gold_ingot', 40], ['gem', 'Gem', 'gem', 1200], ['cinder', 'Cinder', 'cinder_ingot', 2600]];
const DUR = {fishing_rod: 40}; // uses before an item breaks
// weakest first. spare is how much of the metal stays back for tools and armor
const ARROWS = [
  {id: 'copper_arrow', name: 'Copper arrow', mat: 'copper_ingot', raw: 'raw_copper', dmg: 5, spare: 6},
  {id: 'iron_arrow', name: 'Iron arrow', mat: 'iron_ingot', raw: 'raw_iron', dmg: 7, spare: 8},
  {id: 'gold_arrow', name: 'Gold arrow', mat: 'gold_ingot', raw: 'raw_gold', dmg: 9, spare: 8},
  {id: 'gem_arrow', name: 'Gem arrow', mat: 'gem', raw: null, dmg: 12, spare: 8},
  {id: 'cinder_arrow', name: 'Cinder arrow', mat: 'cinder_ingot', raw: 'raw_cinderite', dmg: 16, spare: 6}];
ITEMS.bow = 'Bow';
RECIPES.bow = {out: 1, in: {stick: 3, leaf: 4}, st: 'bench'}; // a twist of leaf fibre, like the fishing line
for (const a of ARROWS) { ITEMS[a.id] = a.name; RECIPES[a.id] = {out: 4, in: {stick: 1, [a.mat]: 1}, st: 'bench'}; }
const TOOL_KIND = {}; // item -> 'pick' | 'axe' | 'shovel' | 'hoe' | 'sword'
const TOOL_MAT = {};  // item -> material prefix
for (const [k, name, mat, dur] of MATS) {
  for (const [kind, label, n] of [['pick', 'pickaxe', 3], ['axe', 'axe', 3], ['shovel', 'shovel', 1], ['hoe', 'hoe', 2], ['sword', 'sword', 2]]) {
    const id = k + '_' + kind;
    ITEMS[id] = name + ' ' + label;
    if (!RECIPES[id]) RECIPES[id] = {out: 1, in: {[mat]: n, stick: kind === 'sword' ? 1 : 2}, st: 'bench'};
    DUR[id] = kind === 'sword' ? Math.round(dur * 0.6) : dur;
    TOOL_KIND[id] = kind; TOOL_MAT[id] = k;
  }
}
ITEMS.reinforced_pick = 'Reinforced pickaxe'; RECIPES.reinforced_pick = {out: 1, in: {gem: 2, iron_ingot: 3, stick: 2}, st: 'bench'};
DUR.reinforced_pick = 2400; TOOL_KIND.reinforced_pick = 'pick'; TOOL_MAT.reinforced_pick = 'gem';
// armor: four slots. The chestplates keep the old copper_armor / iron_armor keys so older saves still fit.
const ARMOR_SLOTS = ['helmet', 'chest', 'legs', 'boots'];
const ARMOR = {}; // item -> {slot, def: share of damage blocked}
const ARMOR_DEF = {copper: [0.05, 0.25, 0.08, 0.04], iron: [0.07, 0.45, 0.12, 0.06], gold: [0.05, 0.3, 0.08, 0.04], gem: [0.1, 0.5, 0.14, 0.08], cinder: [0.11, 0.55, 0.15, 0.09]};
const ARMOR_DUR = {copper: 80, iron: 120, gold: 50, gem: 300, cinder: 520};
const ARMOR_COST = {copper: [5, 8, 7, 4], iron: [5, 8, 7, 4], gold: [4, 6, 5, 3], gem: [3, 5, 4, 2], cinder: [3, 5, 4, 2]}; // the rare stuff costs less of it
for (const k of ['copper', 'iron', 'gold', 'gem', 'cinder']) {
  const name = k[0].toUpperCase() + k.slice(1), mat = k === 'gem' ? 'gem' : k + '_ingot';
  ARMOR_SLOTS.forEach((slot, i) => {
    const id = slot === 'chest' ? k + '_armor' : k + '_' + slot;
    ITEMS[id] = name + ' ' + ['helmet', 'chestplate', 'leggings', 'boots'][i];
    if (!RECIPES[id]) RECIPES[id] = {out: 1, in: {[mat]: ARMOR_COST[k][i]}, st: 'bench'};
    ARMOR[id] = {slot, def: ARMOR_DEF[k][i]};
    DUR[id] = Math.round(ARMOR_DUR[k] * [0.7, 1, 0.9, 0.8][i]);
  });
}
// the Underworld's materials, and the gate that gets there
Object.assign(ITEMS, {obsidian: 'Obsidian', emberfruit: 'Emberfruit', glimmer: 'Glimmer', ward_key: 'Warden key', ember_crown: 'Ember crown', raw_cinderite: 'Raw cinderite', cinder_ingot: 'Cinder ingot', gatestone: 'Gatestone', gate_core: 'Gate core'});
ARMOR.ember_crown = {slot: 'helmet', def: 0.16}; DUR.ember_crown = 9000; // no recipe: the Warden wears it
Object.assign(ITEMS, {wheat_seeds: 'Wheat seeds', wheat: 'Wheat', potato: 'Potato', baked_potato: 'Baked potato'});
Object.assign(RECIPES, {bread: {out: 1, in: {wheat: 3}, st: 'bench'}, baked_potato: {out: 1, in: {potato: 1, coal: 1}, st: 'furnace'}, ward_key: {out: 1, in: {glimmer: 6, gold_ingot: 2}, st: 'bench'}, cinder_ingot: {out: 1, in: {raw_cinderite: 2, coal: 1}, st: 'furnace'}, gate_core: {out: 1, in: {gem: 1, gold_ingot: 1}, st: 'bench'}});
Object.assign(ITEMS, {
  shield: 'Shield', bucket: 'Bucket', shears: 'Shears', campfire: 'Campfire', golden_apple: 'Golden apple',
  iron_nugget: 'Iron nugget', copper_nugget: 'Copper nugget', lantern: 'Lantern', copper_torch: 'Copper torch', copper_lantern: 'Copper lantern',
  cauldron: 'Cauldron', anvil: 'Anvil', stonecutter: 'Stonecutter', smoker: 'Smoker', blast_furnace: 'Blast furnace',
  wood_slab: 'Wood slab', wood_stairs: 'Wood stairs', fence: 'Fence', fence_gate: 'Fence gate', ladder: 'Ladder', trapdoor: 'Trapdoor',
  pressure_plate: 'Pressure plate', button: 'Button', sign: 'Sign', boat: 'Boat', chest_boat: 'Boat with chest', hopper: 'Hopper',
  minecart: 'Minecart', rail: 'Rail', iron_bars: 'Iron bars', iron_door: 'Iron door', iron_trapdoor: 'Iron trapdoor', copper_chest: 'Copper chest',
  glass: 'Glass', glass_pane: 'Glass pane', stone: 'Stone', smooth_stone: 'Smooth stone', stone_bricks: 'Stone bricks', stone_slab: 'Stone slab',
  cobble_stairs: 'Cobble stairs', cobble_wall: 'Cobble wall', sandstone_stairs: 'Sandstone stairs', sandstone_slab: 'Sandstone slab',
  sandstone_wall: 'Sandstone wall', chiseled_sandstone: 'Chiseled sandstone', cut_sandstone: 'Cut sandstone', smooth_sandstone: 'Smooth sandstone',
  copper_block: 'Copper block', iron_block: 'Iron block', gold_block: 'Gold block', coal_block: 'Coal block', gem_block: 'Gem block',
  fruit_pie: 'Fruit pie', leaf_cloak: 'Leaf cloak', expedition_pack: 'Expedition pack', mining_lantern: 'Mining lantern'
});
ITEMS.copper_armor = 'Copper chestplate'; ITEMS.iron_armor = 'Iron chestplate';
Object.assign(RECIPES, {
  shield: {out: 1, in: {planks: 6, iron_ingot: 1}, st: 'bench'},
  bucket: {out: 1, in: {iron_ingot: 3}, st: 'bench'},
  shears: {out: 1, in: {iron_ingot: 2}, st: 'bench'},
  campfire: {out: 1, in: {log: 3, stick: 3, coal: 1}, st: 'bench'},
  golden_apple: {out: 1, in: {apple: 1, gold_ingot: 8}, st: 'bench'},
  iron_nugget: {out: 9, in: {iron_ingot: 1}},
  copper_nugget: {out: 9, in: {copper_ingot: 1}},
  lantern: {out: 1, in: {torch: 1, iron_nugget: 8}, st: 'bench'},
  copper_torch: {out: 4, in: {copper_nugget: 1, coal: 1, stick: 1}},
  copper_lantern: {out: 1, in: {copper_torch: 1, copper_nugget: 8}, st: 'bench'},
  cauldron: {out: 1, in: {iron_ingot: 7}, st: 'bench'},
  anvil: {out: 1, in: {iron_block: 3, iron_ingot: 4}, st: 'bench'},
  stonecutter: {out: 1, in: {stone: 3, iron_ingot: 1}, st: 'bench'},
  smoker: {out: 1, in: {furnace: 1, log: 4}, st: 'bench'},
  blast_furnace: {out: 1, in: {furnace: 1, iron_ingot: 5, smooth_stone: 3}, st: 'bench'},
  wood_slab: {out: 6, in: {planks: 3}, st: 'bench'},
  wood_stairs: {out: 4, in: {planks: 6}, st: 'bench'},
  fence: {out: 3, in: {planks: 4, stick: 2}, st: 'bench'},
  fence_gate: {out: 1, in: {planks: 2, stick: 4}, st: 'bench'},
  ladder: {out: 3, in: {stick: 7}, st: 'bench'},
  trapdoor: {out: 2, in: {planks: 6}, st: 'bench'},
  pressure_plate: {out: 1, in: {planks: 2}, st: 'bench'},
  button: {out: 1, in: {planks: 1}},
  sign: {out: 3, in: {planks: 6, stick: 1}, st: 'bench'},
  boat: {out: 1, in: {planks: 5}, st: 'bench'},
  chest_boat: {out: 1, in: {boat: 1, chest: 1}},
  hopper: {out: 1, in: {iron_ingot: 5, chest: 1}, st: 'bench'},
  minecart: {out: 1, in: {iron_ingot: 5}, st: 'bench'},
  rail: {out: 16, in: {iron_ingot: 6, stick: 1}, st: 'bench'},
  iron_bars: {out: 16, in: {iron_ingot: 6}, st: 'bench'},
  iron_door: {out: 3, in: {iron_ingot: 6}, st: 'bench'},
  iron_trapdoor: {out: 1, in: {iron_ingot: 4}, st: 'bench'},
  copper_chest: {out: 1, in: {copper_ingot: 8, chest: 1}, st: 'bench'},
  sandstone: {out: 1, in: {sand: 4}},
  glass: {out: 2, in: {sand: 2, coal: 1}, st: 'furnace'},
  glass_pane: {out: 16, in: {glass: 6}, st: 'bench'},
  stone: {out: 2, in: {cobble: 2, coal: 1}, st: 'furnace'},
  smooth_stone: {out: 2, in: {stone: 2, coal: 1}, st: 'furnace'},
  smooth_sandstone: {out: 2, in: {sandstone: 2, coal: 1}, st: 'furnace'},
  stone_bricks: {out: 4, in: {stone: 4}},
  stone_slab: {out: 6, in: {stone: 3}, st: 'bench'},
  cobble_stairs: {out: 4, in: {cobble: 6}, st: 'bench'},
  cobble_wall: {out: 6, in: {cobble: 6}, st: 'bench'},
  sandstone_stairs: {out: 4, in: {sandstone: 6}, st: 'bench'},
  sandstone_slab: {out: 6, in: {sandstone: 3}, st: 'bench'},
  sandstone_wall: {out: 6, in: {sandstone: 6}, st: 'bench'},
  chiseled_sandstone: {out: 1, in: {sandstone_slab: 2}},
  cut_sandstone: {out: 4, in: {sandstone: 4}},
  copper_block: {out: 1, in: {copper_ingot: 9}},
  iron_block: {out: 1, in: {iron_ingot: 9}},
  gold_block: {out: 1, in: {gold_ingot: 4}},
  coal_block: {out: 1, in: {coal: 9}},
  gem_block: {out: 1, in: {gem: 4}},
  fruit_pie: {out: 1, in: {berries: 3, apple: 1, coal: 1}, st: 'furnace'},
  leaf_cloak: {out: 1, in: {leaf: 4}},
  expedition_pack: {out: 1, in: {chest: 1, leaf: 4}, st: 'bench'},
  mining_lantern: {out: 1, in: {lantern: 1, iron_ingot: 2}, st: 'bench'}
});
// the adventuring kit (kit.js): silk comes off spiders and powder off beaten blastcaps
Object.assign(ITEMS, {silk: 'Spider silk', blast_powder: 'Blast powder', grapple: 'Grapple line', ember_treads: 'Ember treads', silk_net: 'Silk net', blast_charge: 'Blast charge'});
Object.assign(RECIPES, {
  grapple: {out: 1, in: {silk: 3, iron_ingot: 2, stick: 1}, st: 'bench'},
  ember_treads: {out: 1, in: {obsidian: 4, gold_ingot: 2}, st: 'bench'},
  silk_net: {out: 1, in: {silk: 3}},
  blast_charge: {out: 3, in: {blast_powder: 1, sand: 1, coal: 1}, st: 'bench'}
});
Object.assign(ITEMS, {weathervane: 'Weathervane', trophy_shelf: 'Trophy shelf', map_table: 'Map table', rain_barrel: 'Rain barrel', wind_chimes: 'Wind chimes', pet_bed: 'Pet bed', kite: 'Kite'});
Object.assign(RECIPES, {
  weathervane: {out: 1, in: {copper_ingot: 2, stick: 1}, st: 'bench'},
  trophy_shelf: {out: 1, in: {planks: 4, gold_ingot: 1}, st: 'bench'},
  map_table: {out: 1, in: {planks: 5, coal: 1}, st: 'bench'},
  rain_barrel: {out: 1, in: {planks: 6, iron_nugget: 4}, st: 'bench'},
  wind_chimes: {out: 1, in: {copper_nugget: 6, stick: 1}},
  pet_bed: {out: 1, in: {planks: 3, leaf: 6}},
  kite: {out: 1, in: {stick: 3, leaf: 4}}
});
// food and charms (kit.js): brews drunk when they're wanted, a stew for camp, and a charm that finds a little more ore
Object.assign(ITEMS, {glow_broth: 'Glow broth', firewalk_tea: 'Firewalk tea', camp_stew: 'Camp stew', lucky_charm: 'Lucky charm'});
Object.assign(RECIPES, {
  glow_broth: {out: 2, in: {glimmer: 1, baked_potato: 1}, st: 'furnace'},
  firewalk_tea: {out: 2, in: {emberfruit: 1, wheat: 1}, st: 'furnace'},
  camp_stew: {out: 2, in: {raw_meat: 1, potato: 2, wheat: 1}, st: 'furnace'},
  lucky_charm: {out: 1, in: {gem: 1, gold_ingot: 1}, st: 'bench'}
});
Object.assign(DUR, {shield: 150, shears: 200});
const FOOD = {camp_stew:12, cooked_meat:8, cooked_fish:7, emberfruit:6, fruit_pie:7, bread:6, baked_potato:5, potato:2, golden_apple:4, apple:4, berries:3, raw_meat:2, raw_fish:2};
const RAW_SOURCE = {coal:T.COAL, raw_copper:T.COPPER, raw_iron:T.IRON, raw_gold:T.GOLD, gem:T.GEM, raw_cinderite:T.CINDERITE, glimmer:T.GLIMMER, obsidian:T.OBSIDIAN};
const STRIP_BAND = {coal:[52, 112], raw_copper:[66, 104], raw_iron:[78, 116], raw_gold:[98, 122], gem:[104, 123], raw_cinderite:[94, 120], obsidian:[100, 120]};
const PICK_FOR_TIER = [null, 'wood_pick', 'stone_pick', 'iron_pick', 'gem_pick', 'reinforced_pick', 'cinder_pick'];
const PICK_TIER = {wood_pick: 1, gold_pick: 1, stone_pick: 2, copper_pick: 2, iron_pick: 3, gem_pick: 4, reinforced_pick: 5, cinder_pick: 6};
const PLACE_TILE = {dirt:T.DIRT, cobble:T.COBBLE, sand:T.SAND, sandstone:T.SANDSTONE, planks:T.PLANKS};
// item -> tile it becomes when the miner builds with it
const BUILD_TILE = {obsidian: T.OBSIDIAN, gate_core: T.GATE, stone_bricks: T.STONE_BRICKS, glass: T.GLASS, glass_pane: T.GLASS_PANE, iron_bars: T.IRON_BARS, iron_door: T.IRON_DOOR,
  coal_block: T.COAL_BLOCK, copper_block: T.COPPER_BLOCK, iron_block: T.IRON_BLOCK, gold_block: T.GOLD_BLOCK, gem_block: T.GEM_BLOCK,
  anvil: T.ANVIL, stonecutter: T.STONECUTTER, smoker: T.SMOKER, blast_furnace: T.BLAST_FURNACE, cauldron: T.CAULDRON, copper_chest: T.COPPER_CHEST,
  hopper: T.HOPPER, lantern: T.LANTERN, copper_lantern: T.COPPER_LANTERN, campfire: T.CAMPFIRE, sign: T.SIGN, fence: T.FENCE, fence_gate: T.FENCE_GATE,
  rail: T.RAIL, minecart: T.MINECART, wood_stairs: T.WOOD_STAIRS, wood_slab: T.WOOD_SLAB, ladder: T.LADDER, smooth_stone: T.SMOOTH_STONE,
  cut_sandstone: T.CUT_SANDSTONE, chiseled_sandstone: T.CHISELED_SANDSTONE, smooth_sandstone: T.SMOOTH_SANDSTONE, trapdoor: T.TRAPDOOR,
  cobble_stairs: T.COBBLE_STAIRS, sandstone_stairs: T.SANDSTONE_STAIRS, stone_slab: T.STONE_SLAB, sandstone_slab: T.SANDSTONE_SLAB,
  cobble_wall: T.COBBLE_WALL, sandstone_wall: T.SANDSTONE_WALL, pressure_plate: T.PRESSURE_PLATE, button: T.BUTTON, iron_trapdoor: T.IRON_TRAPDOOR,
  bucket: T.BUCKET, boat: T.BOAT, chest_boat: T.CHEST_BOAT, expedition_pack: T.EXPEDITION_PACK, copper_torch: T.COPPER_TORCH,
  stone: T.STONE_TILE, planks: T.PLANKS, cobble: T.COBBLE, sandstone: T.SANDSTONE, door: T.DOOR, torch: T.TORCH, chest: T.CHEST};
Object.assign(BUILD_TILE, {weathervane: T.WEATHERVANE, trophy_shelf: T.TROPHY_SHELF, map_table: T.MAP_TABLE, rain_barrel: T.RAIN_BARREL, wind_chimes: T.WIND_CHIMES, pet_bed: T.PET_BED});

// ---------- rng / noise ----------
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y, s) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1013904223)) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vn1(x, s) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash2(i, 0, s) * (1 - u) + hash2(i + 1, 0, s) * u; }
function vn2(x, y, s) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
