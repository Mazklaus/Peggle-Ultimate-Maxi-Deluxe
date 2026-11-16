/** Banc d'écoute (sons.html) : déclenche chaque son du jalon 1 sans lancer le jeu. */
import { audio, type CrystalKind } from './audio';
import type { BusName } from './audio/engine';
import { PIP_VOICE, type VoiceCue } from './core/audio/voice';

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
const music = section('Musique adaptative');
let layerButtons: HTMLButtonElement[] = [];
button(music, '▶ Chapitre 1', () => {
  audio.levelStart('ch1');
  refreshLayers();
});
button(music, '▶ Phare (boîte à musique seule)', () => audio.music.start('phare'));
button(music, '▶ Phare + Pip', () => audio.music.start('phare', { astres: 1 }));
button(music, '■ Stop', () => audio.music.stop());
const states: [string, string][] = [
  ['Visée (couche 1)', 'fin_tir'],
  ['Tir (couches 1+2)', 'tir_lance'],
  ['Tension (dernier cœur)', 'dernier_coeur'],
];
layerButtons = states.map(([label, ev]) =>
  button(music, label, () => {
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

// Voix de Pip
const groups: [string, VoiceCue[]][] = [
  [
    'Pip · avant le tir (idles)',
    [
      'idle_court',
      'idle_fredonne',
      'idle_mouche',
      'idle_jongle',
      'inactivite',
      'sommeil',
      'reveil',
    ],
  ],
  [
    'Pip · pendant le vol',
    [
      'tir_lance',
      'cristal',
      'orbe_descend',
      'orbe_proche_coeur',
      'presque',
      'dernier_coeur',
      'dernier_orbe',
      'pouvoir_active',
      'final_ralenti',
    ],
  ],
  [
    'Pip · après le tir (bilan)',
    ['tir_moyen', 'gros_coup', 'chaine_longue', 'rate', 'orbe_recupere', 'victoire', 'echec'],
  ],
];
for (const [title, cues] of groups) {
  const g = section(title);
  for (const cue of cues) {
    PIP_VOICE.phrases[cue].forEach((_, i, all) =>
      button(g, all.length > 1 ? `${cue} · V${i + 1}` : cue, () => {
        // Le banc d'écoute rejoue toujours, sans l'arbitre anti-saturation.
        audio.preview(cue, i);
      }),
    );
  }
}

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
button(opts, 'Mode doux', (b) => {
  soft = !soft;
  audio.setSoftMode(soft);
  b.classList.toggle('on', soft);
});
