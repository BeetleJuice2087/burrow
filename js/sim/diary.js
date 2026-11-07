// Burrow sim · diary.js — The miner writes one page a day in stats.diary, from what actually happened that day.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
// Phrasing comes from a hash of the world and day, never g.rng, so keeping a diary can't change how a run plays out.
'use strict';

const DIARY_ROAD = ['Walked all day. My boots have opinions about it.', 'Nothing but new ground ahead. I could get used to this.', 'No roof tonight. The sky is bigger than I remembered.', 'Every hill has another hill behind it. Rude, really.'];
const DIARY_CAMP = {0: 'Made camp in the snow. Everything I own is cold.', 1: 'Made camp under the trees. Smells like home did.', 2: 'Made camp in the open meadow. The wind has nothing to bump into.', 3: 'Made camp in the dunes. There is sand in the soup.', 4: 'Made camp in the mire. Everything squelches, including me.', 5: 'Made camp in the Redlands. The rock looks like a very old cake.', 6: 'Made camp in the Amberwood. Leaves keep landing in my dinner.', 7: 'Made camp on the savanna. You can see tomorrow from here.'};
const DIARY_MILESTONES = {
  journey: ['Packed up the old house today. Left the fire burning for nobody. Time to see what’s east of everything.'],
  place_bench: ['Built a workbench. Felt like a real person for a moment.'], place_furnace: ['Got a furnace going. First warm thing I’ve had in days.'],
  c_wood_pick: ['Made a wood pickaxe. It’s bad, and I love it.'], c_stone_pick: ['Stone pickaxe! The wooden one and I have parted as friends.'],
  c_iron_pick: ['Iron pickaxe. Now the ground is scared of me.'], c_gem_pick: ['Finished the gem pickaxe. I stared at it for far too long.'],
  c_reinforced_pick: ['Reinforced the pickaxe. It might outlive me.'], c_torch: ['Made torches. The dark has been told.'],
  c_copper_armor: ['Copper armor. I clank a bit, but I’m a harder thing to hit.'], c_iron_armor: ['Iron armor. Heavy, and worth every step.'],
  c_gem_armor: ['Gem armor. Possibly too shiny for a hole in the ground.'], c_fishing_rod: ['Made a fishing rod. A hobby, at last.'],
  c_golden_apple: ['Made a golden apple. I don’t understand it, but I’d eat it.'],
  first_coal: ['Found coal. Light and heat, just lying around in the rock.'], first_raw_copper: ['First copper! It’s a nice colour.'], first_raw_iron: ['Found iron. Things are about to get serious.'],
  first_raw_gold: ['GOLD. I checked twice.'], first_gem: ['A gem. I held it up to the torch and forgot what I was doing.'], first_raw_cinderite: ['Found cinderite. It’s warm to the touch, which seems bad.'],
  first_kill: ['Won my first fight. My hands are still shaking.'], first_sleep: ['Slept in a real bed. Would recommend.'], first_fish: ['Caught a fish! It looked as surprised as I was.'],
  bed: ['Made a bed. I am now a person with a bed.'], hut: ['Built a hut. It’s small and crooked and it’s mine.'],
  deep: ['Dug down to the deep rock. It’s very quiet here.'], bottom: ['Reached the lava. That’s far enough, I think.'],
  chest: ['Found a chest someone left behind. Finders keepers.'], spawner: ['Smashed a monster spawner. It deserved it.'],
  stored: ['Put my spares in chests. I am extremely organised.'], repair: ['Fixed up my gear on the anvil. Good as new, mostly.'],
  workshop2: ['Finished the stone workshop. I may have a problem with building.'], decorate2: ['Decorated the homestead. It finally looks like someone lives here.'], finish: ['Furnished the house. Nowhere left to put anything.'],
  gate: ['Built a gate. It hums, and I can’t stop looking at it.'], underworld: ['Stepped through the gate. The air tastes like a campfire. Nobody should live here.'],
  keep: ['Built my first stone keep. Took one look at the pack and thought, well, why not.'], storage: ['Built a wall of chests. Everything has a place now.'], c_cinder_ingot: ['Forged my first cinder ingot. It glows like it\u2019s annoyed.'], c_cinder_sword: ['Made a cinder sword. Monsters, take note.'],
  farm: ['Planted my first crops. A hole I dug on purpose, for something other than ore.'], harvest: ['First harvest! I grew that. Me. On purpose.'], first_potato: ['Got my hands on a potato. I have big plans for this potato.'], c_bread: ['Baked bread. Actual bread. The whole hut smells like a person lives there.'], c_baked_potato: ['Baked a potato. Best thing I\u2019ve eaten in weeks.'],
  storm: ['Sat out my first real storm. The hut held.'], pet: ['A little burrowling turned up on the doorstep in a tiny hard hat. It won\u2019t leave. I\u2019m calling it #.'], trader: ['Traded with a wanderer called Odalin. Think I got a good deal. Odalin seemed to think so too.'],
  c_cinder_pick: ['Made a cinder pickaxe. It’s always a little warm.'], c_cinder_armor: ['Full cinder armor. I smell like burnt toast, but nothing can touch me.'],
  q_ember: ['Reached the Emberwood. Burnt trees, and they’re still glowing.'], q_fruit: ['Ate emberfruit. Spicy. My eyebrows may not recover.'], q_shard: ['Found the Shardfall. It’s beautiful, and I don’t trust it.'],
  q_glimmer: ['Dug out glimmer crystals. They hum if you hold them close.'], q_sea: ['Stood at the Cinder Sea. Lava as far as I could see. I did not go for a swim.'],
  q_ruins: ['Searched the old watchtowers. Someone else was down here once. I wonder what happened to them.'], q_vaults: ['Cleared the deep vaults. I’m getting good at this, and that worries me.'],
  q_wastes: ['Crossed the Hollow Wastes. Ribs taller than my house. I walked quickly.'], q_citadel: ['Found the Ashen Citadel. The door is shut, and I think it’s meant to stay that way.'],
  q_open: ['Opened the Citadel. Something inside noticed.'], q_warden: ['I beat the Ember Warden. I can’t believe that sentence is true. The crown fits.']
};
const DIARY_GRIT = ['Grit level #. I feel it in my knees, mostly.', 'Reached Grit level #. Nothing changed, except that I walked out of the tunnel like someone who had reached Grit level #.', 'Level # of Grit. The monsters seem to have noticed.', 'Grit #. Told Mote. Mote was not impressed.'];
const DIARY_KEEP = ['Finished a keep today. Nobody asked for one, but I had the stone.', 'Stacked up a whole keep out of what was in my pack. My back feels lighter. So does my conscience.', 'Built a keep. It\u2019ll still be here long after I\u2019ve gone, which is the idea.'];
const DIARY_CHEST = ['Left a chest behind for whoever comes along next. Mostly old tools. They\u2019ve got a lot of stories, if anyone asks.', 'Finally emptied out the pack. I had no idea I owned that many things.', 'Packed a chest with everything I\u2019ll never use, and closed the lid before I could change my mind.'];
const DIARY_STORM = ['Storm came through. Sat inside listening to the roof and feeling clever about having one.', 'Thunder all afternoon. I was indoors for every bit of it.', 'Waited out the storm by the door. Counted the seconds after each flash, then lost count.'];
const DIARY_RAIN = ['Rained, so I went in and looked at my things for a bit.', 'Wet out. Stayed in. Best decision of the week.'];
const DIARY_PET = ['# dug a very small hole next to my big one. I think we\u2019re colleagues now.', '# found a bug and brought it to me. I said thank you.', '# slept on my boots again.', 'I told # about my plans. No objections.'];
const DIARY_KO = {lava: 'Fell in lava. I would like that noted as a mistake.', hunger: 'Forgot to eat, and fainted. Very embarrassing.', 'long fall': 'Stepped off a ledge without looking. The ground was exactly where I left it.'};
const DIARY_FLAT = ['Got flattened by #. I\u2019ll be back.', 'Lost a fight with #. I blame the lighting.', 'Woke up in bed, sore all over. Thanks to # for that.', '# got me. Next time I\u2019m bringing more food.'];
const DIARY_QUIET = ['Watched a thistlehop for a while. It wasn\u2019t doing anything either.', 'A pondlet sat on my boot. Neither of us mentioned it.', 'Birds went over, heading somewhere better, probably.', 'Nothing much happened. I dug a hole. It was a good hole.', 'A quiet day. I talked to a rock. It’s a good listener.', 'Dug. Ate. Dug some more. A full life.', 'No monsters, no lava, no surprises. Suspicious.', 'Mostly walked about thinking about ore.'];
const DIARY_UNDER = ['No sun down here, so I can’t tell you if it was a nice day.', 'Everything is warm and nothing is friendly.', 'I miss the sky. And pudgeons, a bit.'];
const DIARY_FIGHT = ['Fought off # monsters. They keep coming, and I keep swinging.', 'Took down # monsters today. I\u2019d like them to stop now, please.', '# monsters. I\u2019ve started naming the bruises.'];
const DIARY_MINED = ['Broke # blocks today. I can see them when I close my eyes.', '# blocks dug. There is rock in my teeth.', 'Moved # blocks of the world from one place to another. Progress.'];
const DIARY_WALKED = ['Covered a lot of ground today. My boots have opinions about it.', 'Walked and walked. The map keeps getting bigger.', 'A long day on my feet. I\u2019d like a word with whoever made this place so wide.', 'Spent the day getting from here to there. It had better be worth it.'];
const DIARY_VILLAGE = ['Stopped in #. Someone gave me soup and asked nothing about the smell.', 'Reached #. I had forgotten what a chair was like. It was very good.', 'Spent an hour in #. People wave here, for no reason at all.', 'There are people in #. Actual people. I tried to remember how to talk.'];
const DIARY_RUIN = ['Nobody left in #. The tables were still laid.', 'Found # empty. Whatever is under the floor was not.', 'Walked through #. I would not have stayed the night even if it had a roof.', '# has been empty a long time. I took what was in the cellar and said sorry to the door.'];
const DIARY_RETIRED = ['Retired, and still digging. Old habits.', 'I told myself I’d stop. I found some gold instead.', 'The crown looks good on the wall. Went mining anyway.'];
const diaryPick = (g, list, salt) => list[Math.floor(mulberry(((g.seed * 31 + g.day * 97 + salt * 13) >>> 0))() * list.length)];
const koName = src => src === 'hunger' || src === 'lava' ? src : src === 'long fall' ? 'a long fall' : src === 'Ember Warden' ? 'the Ember Warden' : (/^[aeiou]/.test(src) ? 'an ' : 'a ') + src;
function diarySnap(g) {
  const s = g.stats;
  return {tick: g.tick, kills: s.kills, distance: s.distance || 0, mined: Object.values(s.mined).reduce((a, b) => a + b, 0)};
}
// the page for the day just gone. `last` is the final page of the story
function writeDiary(g, day, last) {
  const s = g.stats, now = diarySnap(g);
  const was = s.diarySnap || (day === 1 ? {tick: 0, kills: 0, distance: 0, mined: 0} : null);
  s.diary = s.diary || [];
  s.diarySnap = now;
  if (!was) { // a world from before the diary existed
    s.diary.push({day, text: 'Found this notebook at the bottom of my pack. I can’t remember much of the days before it, but I’m sure I was very brave.'});
    return;
  }
  const lines = [];
  if (day === 1) lines.push('Woke up here with no idea how. Nice trees, though. Better start punching one.');
  const events = s.milestones.filter(q => q.tick > was.tick && q.id !== 'night1' && q.id !== 'q_home');
  const pet = g.m.pet ? g.m.pet.name : '';
  for (const q of events.slice(0, 3)) lines.push((DIARY_MILESTONES[q.id] || [q.label + '.'])[0].replace('#', pet));
  if (events.length > 3) lines.push('Busiest day yet. My arms hurt.');
  for (const src of (s.dayKO || []).slice(0, 2)) lines.push(DIARY_KO[src] || diaryPick(g, DIARY_FLAT, 6).replace('#', koName(src)));
  if ((s.dayKO || []).length > 2) lines.push('That’s ' + s.dayKO.length + ' knockouts today. Not my finest work.');
  s.dayKO = [];
  if (s.dayCamp !== undefined && s.dayCamp !== null) { lines.push(DIARY_CAMP[s.dayCamp] || DIARY_CAMP[1]); s.dayCamp = null; }
  if (s.dayKeep) { lines.push((typeof s.dayKeep === 'string' ? 'My own design this time: a ' + s.dayKeep + '. ' : '') + diaryPick(g, DIARY_KEEP, 9)); s.dayKeep = false; }
  if (s.dayGrow) { lines.push('Added a ' + s.dayGrow + ' to the keep. It was only ever going to get bigger.'); s.dayGrow = null; }
  if (s.dayVillage) { lines.push(diaryPick(g, DIARY_VILLAGE, 19).replace('#', s.dayVillage)); s.dayVillage = null; }
  if (s.dayRuin) { lines.push(diaryPick(g, DIARY_RUIN, 21).replace('#', s.dayRuin)); s.dayRuin = null; }
  if (s.dayLevel) { lines.push(diaryPick(g, DIARY_GRIT, 14).replace('#', s.dayLevel)); s.dayLevel = 0; }
  if (s.dayChest) { lines.push(diaryPick(g, DIARY_CHEST, 10)); s.dayChest = false; }
  if (s.dayGateLost) { lines.push('The gate must have dropped behind the horizon by now. If my gear needs cinderite, I’ll have to build another. I don’t miss the smell.'); s.dayGateLost = false; }
  if (s.dayWet && lines.length < 3) lines.push(diaryPick(g, s.dayWet === 'storm' ? DIARY_STORM : DIARY_RAIN, 7));
  s.dayWet = null;
  const kills = now.kills - was.kills, mined = now.mined - was.mined, far = now.distance - was.distance;
  if (kills >= 8) lines.push(diaryPick(g, DIARY_FIGHT, 3).replace('#', kills));
  else if (lines.length < 2 && mined >= 150) lines.push(diaryPick(g, DIARY_MINED, 4).replace('#', mined));
  else if (!lines.length && far >= 300) lines.push(diaryPick(g, DIARY_WALKED, 5));
  if (last) lines.push('Carried the crown home and hung up my pickaxe. Last page. It was a good life, and only a little bit on fire.');
  else if (s.retired && !g.m.journey && !lines.length) lines.push(diaryPick(g, DIARY_RETIRED, 1));
  else if (pet && lines.length < 2 && mulberry((g.seed + g.day * 7) >>> 0)() < 0.3) lines.push(diaryPick(g, DIARY_PET, 8).replace('#', pet));
  else if (!lines.length) lines.push(diaryPick(g, inUnder(g) ? DIARY_UNDER : g.m.journey && g.m.journey.stage === 'travel' ? DIARY_ROAD : DIARY_QUIET, 2));
  const prev = s.diary[s.diary.length - 1];
  if (prev && prev.day === day) { // the day the crown came home: the story already ended on this page
    if (events.length || kills >= 8) s.diary.push({day: day, text: lines.join(' ')});
    return;
  }
  s.diary.push({day, text: lines.join(' ')});
  if (s.diary.length > 300) s.diary.shift();
}
