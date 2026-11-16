/** Banc d'écoute (sons.html) : déclenche chaque son du jalon 1 sans lancer le jeu. */
import { audio, type CrystalKind } from './audio';
import type { BusName } from './audio/engine';
import { VOICES } from './core/audio/astres';
import { CHAPTER_SPECS } from './core/audio/chapters';
import type { VoiceCue } from './core/audio/voice';

const app = document.getElementById('app') as HTMLElement;

function section(title: string): HTMLElement {
  const s = document.createElement('section');
  const h = document.createElement('h2');
  h.textContent = title;
  const grid = document.createElement('div');
  grid.className = 'grid';
  s.append(h, grid);
  app.append(s);
  return grid;
}

function button(
  parent: HTMLElement,
  label: string,
  action: (b: HTMLButtonElement) => void,
): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => {
    audio.unlock();
    action(b);
  });
  parent.append(b);
  return b;
}

// Musique
const music = section('Musique adaptative : chapitres');
let layerButtons: HTMLButtonElement[] = [];
const chapterTitles = ['Premier ciel (Pip)', ...CHAPTER_SPECS.map((c) => c.title)];
chapterTitles.forEach((title, i) =>
  button(music, `▶ ${i + 1}. ${title}`, () => {
    audio.levelStart(`ch${i + 1}`);
    refreshLayers();
  }),
);
button(music, '■ Stop', () => audio.music.stop());
const layersRow = section('Couches (pendant un chapitre)');
const states: [string, string][] = [
  ['Visée (couche 1)', 'fin_tir'],
  ['Tir (couches 1+2)', 'tir_lance'],
  ['Tension (dernier cœur)', 'dernier_coeur'],
];
layerButtons = states.map(([label, ev]) =>
  button(layersRow, label, () => {
    audio.onGameEvent(ev === 'fin_tir' ? 'cristaux_brises' : ev, { count: 0 });
    refreshLayers();
  }),
);
function refreshLayers(): void {
  const s = audio.musicState;
  layerButtons[0]?.classList.toggle('on', !s.shooting);
  layerButtons[1]?.classList.toggle('on', s.shooting);
  layerButtons[2]?.classList.toggle('on', s.tension);
}

// Modes (jalon 3)
const modes = section('Modes : Défis, Constellation du jour, Duel');
button(modes, '▶ Défi', () => audio.levelStart('defi'));
button(modes, '▶ Constellation du jour', () => {
  audio.modeJingle('quotidien_ouverture');
  audio.levelStart('quotidien');
});
button(modes, '▶ Duel', () => audio.levelStart('duel'));
button(modes, 'Tour joueur 1', () => audio.modeJingle('duel_tour_j1'));
button(modes, 'Tour joueur 2', () => audio.modeJingle('duel_tour_j2'));
button(modes, 'Fin de duel', () => audio.onGameEvent('duel_fin'));
button(modes, 'Défi réussi', () => audio.modeJingle('defi_reussi'));
button(modes, 'Défi raté', () => audio.modeJingle('defi_rate'));
button(modes, '■ Stop', () => audio.music.stop());

// Phare
const phare = section('Thème du phare : un instrument par Astre réveillé');
[
  'Boîte à musique seule',
  '+ Pip',
  '+ Bourdon',
  '+ Twi & Nkl',
  '+ Volte',
  '+ Mousse',
  '+ Horloge',
  '+ Grelot',
  '+ Nuage-Lune (complet)',
].forEach((label, n) => button(phare, label, () => audio.music.start('phare', { astres: n })));
button(phare, '■ Stop', () => audio.music.stop());

// Rebonds
const hits = section('Rebonds : chaîne pentatonique');
const chain = (kinds: CrystalKind[], spacing = 140): void => {
  audio.onGameEvent('tir_lance');
  kinds.forEach((k, i) =>
    setTimeout(
      () => (k === ('mur' as CrystalKind) ? audio.wallHit() : audio.crystalHit(k)),
      250 + i * spacing,
    ),
  );
  setTimeout(
    () => audio.onGameEvent('cristaux_brises', { count: kinds.length }),
    400 + kinds.length * spacing,
  );
};
button(hits, 'Petit tir (4)', () => chain(['common', 'common', 'heart', 'common']));
button(hits, 'Gros coup (8)', () =>
  chain(['common', 'heart', 'common', 'bonus', 'heart', 'common', 'heart', 'common']),
);
button(hits, 'Chaîne folle (20)', () =>
  chain(
    Array.from({ length: 20 }, (_, i) => (i % 4 === 1 ? 'heart' : i === 9 ? 'bonus' : 'common')),
    110,
  ),
);
button(hits, 'Cristal commun', () => audio.crystalHit('common'));
button(hits, 'Cristal-cœur', () => audio.crystalHit('heart'));
button(hits, 'Cristal bonus', () => audio.crystalHit('bonus'));
button(hits, 'Cristal pouvoir', () => audio.crystalHit('power'));
button(hits, 'Mur', () => audio.wallHit());
button(hits, 'Brisure ×12', () => audio.shatter(12));
button(hits, 'Orbe récupéré', () => audio.onGameEvent('orbe_recupere'));

// Final
const fin = section('Final et fins de niveau');
button(fin, 'Final au ralenti → victoire', () => {
  audio.levelStart('ch1');
  setTimeout(() => audio.onGameEvent('final_ralenti'), 1500);
  setTimeout(() => audio.onGameEvent('victoire'), 5000);
});
button(fin, 'Victoire seule', () => audio.onGameEvent('victoire'));
button(fin, 'Échec', () => audio.onGameEvent('echec'));
button(fin, 'Déblocage', () => audio.jingle('deblocage'));
button(fin, '✦ Final de l’aventure : réveil de la Veilleuse (~45 s)', () => audio.finale());

// Voix des Astres
const who = section('Astre actif (voix-instrument)');
const names: Record<string, string> = {
  pip: 'Pip · piccolo',
  bourdon: 'Bourdon · tuba',
  twi_nkl: 'Twi & Nkl · 2 clarinettes',
  volte: 'Volte · banjo',
  mousse: 'Mousse · vibraphone',
  horloge: 'Horloge · marimba + tic-tac',
  grelot: 'Grelot · clochettes',
  nuage_lune: 'Nuage-Lune · harpe + chœur',
};
const astreButtons = Object.keys(VOICES).map((id) =>
  button(who, names[id] ?? id, () => {
    audio.setAstre(id);
    renderVoices();
  }),
);
const groups: [string, VoiceCue[]][] = [
  ['Avant le tir (idles)', ['idle_court', 'idle_long', 'inactivite', 'sommeil', 'reveil']],
  [
    'Pendant le vol',
    [
      'tir_lance',
      'cristal',
      'orbe_descend',
      'orbe_proche_coeur',
      'presque',
      'dernier_coeur',
      'dernier_orbe',
      'pouvoir_active',
      'orbe_coincee',
      'orbe_debloquee',
      'final_ralenti',
    ],
  ],
  [
    'Après le tir (bilan)',
    ['tir_moyen', 'gros_coup', 'chaine_longue', 'rate', 'orbe_recupere', 'victoire', 'echec'],
  ],
];
const voiceGrids = groups.map(([title]) => section(title));
function renderVoices(): void {
  const voice = VOICES[audio.astre] ?? VOICES.pip;
  Object.keys(VOICES).forEach((id, i) =>
    astreButtons[i]?.classList.toggle('on', id === audio.astre),
  );
  groups.forEach(([, cues], gi) => {
    const g = voiceGrids[gi];
    if (!g || !voice) return;
    g.replaceChildren();
    for (const cue of cues) {
      voice.phrases[cue].forEach((_, i, all) =>
        // Le banc d'écoute rejoue toujours, sans l'arbitre anti-saturation.
        button(g, all.length > 1 ? `${cue} · V${i + 1}` : cue, () => audio.preview(cue, i)),
      );
    }
  });
}
renderVoices();

// Réglages
const opts = section('Réglages (accessibilité)');
for (const bus of ['music', 'sfx', 'voice'] as BusName[]) {
  const l = document.createElement('label');
  const names: Record<BusName, string> = { music: 'Musique', sfx: 'Effets', voice: 'Voix' };
  l.textContent = names[bus];
  const r = document.createElement('input');
  r.type = 'range';
  r.min = '0';
  r.max = '1';
  r.step = '0.05';
  r.value = String(audio.engine.getVolume(bus));
  r.addEventListener('input', () => audio.setVolume(bus, Number(r.value)));
  l.append(r);
  opts.append(l);
}
let soft = false;
button(opts, 'Son doux', (b) => {
  soft = !soft;
  audio.applySettings({ soft });
  b.classList.toggle('on', soft);
});
let mono = false;
button(opts, 'Son mono', (b) => {
  mono = !mono;
  audio.applySettings({ mono });
  b.classList.toggle('on', mono);
});
