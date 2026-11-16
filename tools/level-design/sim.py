"""Simulateur approximatif (pas Matter) pour estimer jouabilité et paliers d'étoiles."""
import math, random, json, sys

W, H = 880, 656
G = 0.001 * (1000/60)**2 * 0.75**2   # PR 20 : orbe ralenti
SPEED = 11.0 * 0.75
ORB_R = 8
REST = 0.75       # cristaux
WALL_REST = 0.9   # murs (PR 20)
CANNON = (440, 0)
MUZZLE = 36
BUCKET_W, BUCKET_Y = 100, H - 14
BUCKET_CROSS_S = 4
PTS = {'common': 10, 'heart': 100, 'bonus': 500, 'power': 50}
STEPS = [1, 2, 3, 5, 10]; TH = [0.25, 0.5, 0.75, 0.9]
FREE_ORB = 5000
SUB = 4  # sous-pas

def brick_closest(p, b, px, py):
    a = math.radians(b.get('angle', 0)); c, s = math.cos(a), math.sin(a)
    dx, dy = px - b['x'], py - b['y']
    lx, ly = dx*c + dy*s, -dx*s + dy*c
    hw, hh = b['w']/2, b['h']/2
    qx, qy = max(-hw, min(hw, lx)), max(-hh, min(hh, ly))
    return b['x'] + qx*c - qy*s, b['y'] + qx*s + qy*c

def group_motion(decor):
    """id -> fonction (x0, y0, t_s) -> (x, y) pour les groupes en rotation / orbite."""
    out = {}
    for d in decor or []:
        if d.get('type') in ('rotate', 'orbit'):
            cx, cy = d['cx'], d['cy']; w = 2*math.pi*d.get('dir', 1)/d['periodS']
            def f(x0, y0, t, cx=cx, cy=cy, w=w):
                a = w*t; c, s = math.cos(a), math.sin(a)
                return cx + (x0-cx)*c - (y0-cy)*s, cy + (x0-cx)*s + (y0-cy)*c
            out[d['id']] = f
    return out

LAST_POWER = {}  # état de l'orbe au 1er contact avec un cristal pouvoir (x, y, vx, vy, t)

VOLTE_REST, VOLTE_VMAX, VOLTE_FRAMES = 1.10, 675/60, 10*60      # Volte : rebond fou
MOUSSE_R, MOUSSE_A, MOUSSE_DEAD = 220, 900/3600, 20                             # Mousse : aimant à cœurs (px/frame²)
CLOCK_FRAMES, CLOCK_W = int(10*60*0.5), 2.0                      # Horloge : tout le tir, plafond 10 s réelles à x0,5
GRELOT_K, GRELOT_N = 1.15, 3                                     # Grelot : éclair
NUAGE_VY, NUAGE_W = 450/60, 2.0                                              # Nuage-Lune : vy min
MAGNET_A, MAGNET_DEAD = 300*0.75**2/3600, 20                     # aimants (decor.ts) : px/frame² pour strength 1
PORTALS = []  # portails du niveau en cours (ax, ay, bx, by), rayon 18, réentrée 0,3 s
PORTAL_R, PORTAL_RE = 18, 18
MAGNETS = []  # aimants du niveau en cours (x, y, radius, strength)
SHOT = {}  # infos du dernier tir : relance Nuage-Lune consommée

def simulate_shot(pegs, alive, angle, bucket_x0, bucket_dir, max_steps=4000, motion=None, t0=0.0, max_contacts=None, start=None, mode=None):
    """mode : {'volte', 'mousse', 'clock', 'grelot', 'relaunch'} (pouvoirs actifs pendant ce tir)."""
    mode = mode or {}
    x = CANNON[0] + math.cos(angle)*MUZZLE; y = CANNON[1] + math.sin(angle)*MUZZLE
    vx, vy = math.cos(angle)*SPEED, math.sin(angle)*SPEED
    if start: x, y, vx, vy = start
    LAST_POWER.clear(); SHOT.clear()
    volte_until = -1; wide = 1.0; p_inside = None; p_ready = 0; bolt = GRELOT_N if mode.get('grelot') else 0; relaunch = bool(mode.get('relaunch'))
    if bolt: vx, vy = vx*GRELOT_K, vy*GRELOT_K
    hits = []; hitset = set(); bx, bd = bucket_x0, bucket_dir
    bspeed = W / BUCKET_CROSS_S / 60
    stuck_ref = (x, y, 0); t = 0
    motion = motion or {}
    movers = [i for i in alive if pegs[i].get('group') in motion]
    home = {i: (pegs[i].get('x0', pegs[i]['x']), pegs[i].get('y0', pegs[i]['y'])) for i in movers}
    grid = {}
    for i in alive:
        if i in home: continue
        p = pegs[i]; ext = (p['w']/2 + 10) if p.get('shape') == 'brick' else 20
        for gx in range(int((p['x']-ext)//40), int((p['x']+ext)//40)+1):
            for gy in range(int((p['y']-ext)//40), int((p['y']+ext)//40)+1):
                grid.setdefault((gx, gy), []).append(i)
    for step in range(max_steps):
        t += 1
        bx += bd*bspeed
        if bx > W - BUCKET_W/2: bd = -1
        if bx < BUCKET_W/2: bd = 1
        for i in movers:
            pegs[i]['x'], pegs[i]['y'] = motion[pegs[i]['group']](*home[i], t0 + t/60)
        clock = mode.get('clock') and t <= CLOCK_FRAMES
        if clock: bx = max(BUCKET_W*CLOCK_W/2, min(W - BUCKET_W*CLOCK_W/2, x))  # le réceptacle suit le pointeur
        for mx, my, mr, ms in MAGNETS:
            ddx, ddy = mx - x, my - y; dd = math.hypot(ddx, ddy)
            if MAGNET_DEAD < dd < mr:
                a = MAGNET_A*ms*(1 - (dd - MAGNET_DEAD)/max(1, mr - MAGNET_DEAD)); vx += a*ddx/dd; vy += a*ddy/dd
        if mode.get('mousse'):
            tgt = [(math.hypot(pegs[i]['x']-x, pegs[i]['y']-y), i) for i in alive
                   if pegs[i].get('kind') == 'heart' and i not in hitset]
            tgt = [c for c in tgt if c[0] < MOUSSE_R]
            if tgt:
                d, i = min(tgt); a = MOUSSE_A*(1 - d/MOUSSE_R) if d > MOUSSE_DEAD else 0; d = d or 1
                vx += a*(pegs[i]['x']-x)/d; vy += a*(pegs[i]['y']-y)/d
        rest = VOLTE_REST if t <= volte_until else REST
        for _ in range(SUB):
            if not bolt: vy += G / SUB
            x += vx / SUB; y += vy / SUB
            if x < ORB_R: x = ORB_R; vx = abs(vx)*WALL_REST
            if x > W-ORB_R: x = W-ORB_R; vx = -abs(vx)*WALL_REST
            if y < ORB_R: y = ORB_R; vy = abs(vy)*WALL_REST
            if PORTALS:
                mouth = None
                for k, (ax, ay, bx_, by_) in enumerate(PORTALS):
                    if (x-ax)**2 + (y-ay)**2 <= PORTAL_R**2: mouth = (k, 0, ax, ay, bx_, by_); break
                    if (x-bx_)**2 + (y-by_)**2 <= PORTAL_R**2: mouth = (k, 1, bx_, by_, ax, ay); break
                if not mouth: p_inside = None
                elif (mouth[0], mouth[1]) != p_inside and t >= p_ready:
                    k, side, fx, fy, ex, ey = mouth
                    x, y = ex + (x - fx), ey + (y - fy); p_inside = (k, 1 - side); p_ready = t + PORTAL_RE
                else: p_inside = (mouth[0], mouth[1])
            for i in list(grid.get((int(x//40), int(y//40)), ())) + movers:
                if i not in alive: continue
                p = pegs[i]
                if p.get('shape') == 'brick':
                    cx, cy = brick_closest(None, p, x, y); rr = ORB_R
                else:
                    cx, cy = p['x'], p['y']; rr = ORB_R + p.get('r', 10)
                dx, dy = x-cx, y-cy; d2 = dx*dx+dy*dy
                if d2 < rr*rr:
                    if bolt and p.get('kind') != 'wall':  # l'éclair perce sans rebondir
                        if i not in hitset:
                            hitset.add(i); hits.append(i); bolt -= 1
                            if p.get('kind') == 'power' and not LAST_POWER: LAST_POWER.update(x=x, y=y, vx=vx, vy=vy, t=t)
                            if max_contacts and len(hits) >= max_contacts: return hits, False, bx, bd, t/60
                        continue
                    d = math.sqrt(d2) or 0.001; nx, ny = dx/d, dy/d
                    x, y = cx + nx*rr, cy + ny*rr
                    vn = vx*nx + vy*ny
                    if vn < 0:
                        vx -= (1+rest)*vn*nx; vy -= (1+rest)*vn*ny
                        if rest > 1:
                            sp = math.hypot(vx, vy)
                            if sp > VOLTE_VMAX: vx, vy = vx*VOLTE_VMAX/sp, vy*VOLTE_VMAX/sp
                    if i not in hitset and p.get('kind') != 'wall':
                        hitset.add(i); hits.append(i)
                        if p.get('kind') == 'power' and not LAST_POWER: LAST_POWER.update(x=x, y=y, vx=vx, vy=vy, t=t)
                        if p.get('kind') == 'power' and mode.get('volte') and volte_until < 0: volte_until = t + VOLTE_FRAMES
                        if max_contacts and len(hits) >= max_contacts: return hits, False, bx, bd, t/60
        bw = BUCKET_W*max(CLOCK_W if clock else 1.0, wide)
        if y + ORB_R >= BUCKET_Y - 9 and y < H and abs(x - bx) <= bw/2:
            return hits, True, bx, bd, t/60
        if y > H + 16:
            if relaunch:  # Nuage-Lune : l'orbe remonte du bas
                relaunch = False; SHOT['relaunched'] = True
                y = H; wide = NUAGE_W
                hs = [pegs[i] for i in alive if pegs[i].get('kind') == 'heart' and i not in hitset]
                if hs:  # remontée calée sur le cœur restant le plus bas
                    hp = max(hs, key=lambda p: p['y'])
                    vy = -max(math.sqrt(2*G*max(1, H - hp['y'] + 10)), NUAGE_VY); tt = -vy/G
                    vx = (hp['x'] - x)/tt
                else: vy = -max(0.8*abs(vy), NUAGE_VY)
                continue
            return hits, False, bx, bd, t/60
        if math.hypot(x-stuck_ref[0], y-stuck_ref[1]) > 12: stuck_ref = (x, y, t)
        elif t - stuck_ref[2] > 180:
            near = [i for i in hitset if i in alive and pegs[i].get('shape') != 'brick' and math.hypot(pegs[i]['x']-x, pegs[i]['y']-y) < 30]
            for i in near: alive.discard(i)
            stuck_ref = (x, y, t)
            if not near: vy += 1  # coup de pouce
    return hits, False, bx, bd, t/60

def play(level, policy='greedy', rng=None, samples=48):
    rng = rng or random.Random()
    pegs = [dict(p) for p in level['pegs']]
    for p in pegs: p['x0'], p['y0'] = p['x'], p['y']
    motion = group_motion(level.get('decor')); T = 0.0
    PORTALS[:] = [(d['a']['x'], d['a']['y'], d['b']['x'], d['b']['y']) for d in level.get('decor') or [] if d.get('type') == 'portal']
    MAGNETS[:] = [(d['x'], d['y'], d['radius'], d['strength']) for d in level.get('decor') or [] if d.get('type') == 'magnet']
    comp = level.get('companion')
    free = [i for i, p in enumerate(pegs) if 'kind' not in p]
    rng.shuffle(free)
    a = level['assign']; k = 0
    for kind, n in (('heart', a.get('hearts', 0)), ('power', a.get('power', 0))):
        for _ in range(n): pegs[free[k]]['kind'] = kind; k += 1
    for i in free[k:]: pegs[i]['kind'] = 'common'
    alive = set(range(len(pegs)))
    regen = {d['id']: d.get('shots', 2) for d in level.get('decor') or [] if d.get('type') == 'regen'}
    for p in pegs:
        if p.get('group') in regen: p['kind'] = 'common'  # régénération : toujours communs
    back = {}  # peg -> numéro du tir où il réapparaît
    hearts_total = sum(1 for p in pegs if p['kind'] == 'heart')
    orbs = level.get('orbs', 10); score = 0; bx, bd = W/2, 1; shots = 0
    def place_bonus():
        for p in pegs:
            if p['kind'] == 'bonus': p['kind'] = 'common'
        commons = [i for i in alive if pegs[i]['kind'] == 'common']
        for _ in range(a.get('bonus', 1)):
            if commons: pegs[commons.pop(rng.randrange(len(commons)))]['kind'] = 'bonus'
    place_bonus(); pip = 0; charge = 0; reserve = 0
    while orbs > 0:
        orbs -= 1; shots += 1
        for i in [i for i, k in back.items() if k <= shots]: alive.add(i); del back[i]
        if policy == 'random':
            ang = math.radians(rng.uniform(8, 172))
        else:
            best = None
            left = sum(1 for i in alive if pegs[i]['kind'] == 'heart')
            # joueur « correct » : il ne voit que le guide de visée (1er contact), ou 3 contacts avec Pip
            cands = [math.radians(8 + 0.5*k) for k in range(329)]
            seen = 3 if (pip or (comp == 'grelot' and charge)) else 1
            gm = {'grelot': True} if (comp == 'grelot' and charge) else None  # le guide montre la ligne de l'éclair
            for ang_c in cands:
                h, c, _, _, _ = simulate_shot(pegs, set(alive), ang_c, bx, bd, motion=motion, t0=T, max_contacts=seen, mode=gm)
                val = sum((6 if pegs[i]['kind'] == 'heart' else 1) for i in h) + rng.random()*0.5
                if best is None or val > best[0]: best = (val, ang_c)
            ang = best[1] + math.radians(rng.gauss(0, 0.3))  # imprécision humaine
            if pip: pip -= 1
        mode = {}
        if comp == 'volte': mode['volte'] = True
        if comp in ('mousse', 'horloge', 'grelot') and charge:
            mode[{'mousse': 'mousse', 'horloge': 'clock', 'grelot': 'grelot'}[comp]] = True; charge -= 1
        if comp == 'nuage-lune' and reserve: mode['relaunch'] = True
        hits, caught, bx, bd, dt = simulate_shot(pegs, alive, ang, bx, bd, motion=motion, t0=T, mode=mode)
        if SHOT.get('relaunched'): reserve -= 1
        T += dt + 1.5
        if comp == 'jumelles' and LAST_POWER:
            # Twi & Nkl : 2e orbe au point d'impact, vitesse horizontale inversée à 90 %
            lp = dict(LAST_POWER)
            h2, c2, _, _, _ = simulate_shot(pegs, alive - set(hits), 0, bx, bd, motion=motion, t0=T - dt - 1.5 + lp['t']/60,
                                            start=(lp['x'], lp['y'], -lp['vx']*0.9, lp['vy']*0.9))
            hits += [i for i in h2 if i not in hits]
            if c2: orbs += 1
        if comp == 'bourdon':
            for i in [i for i in hits if i in alive and pegs[i]['kind'] == 'power']:
                for j in alive:
                    if j not in hits and pegs[j].get('kind') != 'wall' and pegs[j].get('shape') != 'brick' \
                            and math.hypot(pegs[j]['x']-pegs[i]['x'], pegs[j]['y']-pegs[i]['y']) <= 110:
                        hits.append(j)
        shot = 0; lit = 0; free_given = False
        hearts_lit_before = hearts_total - sum(1 for i in alive if pegs[i]['kind'] == 'heart')
        hl = hearts_lit_before
        for i in hits:
            if i not in alive: continue
            if pegs[i]['kind'] == 'heart': hl += 1
            broken = hl / hearts_total
            m = STEPS[0]
            for j, t in enumerate(TH):
                if broken >= t: m = STEPS[j+1]
            g = PTS[pegs[i]['kind']] * m; shot += g
            if not free_given and shot >= FREE_ORB: free_given = True; orbs += 1
        shot = int(shot * (1 + min(1.0, max(0, len(hits)-10)*0.1)))
        score += shot
        got = any(pegs[i]['kind'] == 'power' for i in hits if i in alive)
        if comp == 'pip' and got: pip = min(4, pip + 2)
        if comp in ('mousse', 'horloge', 'grelot') and got: charge = min(2, charge + 1)
        if comp == 'nuage-lune' and got: reserve = min(2, reserve + 1)
        for i in hits:
            if i in alive and pegs[i].get('group') in regen: back[i] = shots + 1 + regen[pegs[i]['group']]
            alive.discard(i)
        if caught: orbs += 1
        if not any(pegs[i]['kind'] == 'heart' for i in alive):
            score += orbs * 1000 + 2500
            return True, score, shots
        place_bonus()
    return False, score, shots

def evaluate(level, runs=40, policy='greedy', seed=1):
    rng = random.Random(seed); res = [play(level, policy, rng) for _ in range(runs)]
    wins = [r for r in res if r[0]]
    scores = sorted(r[1] for r in wins) or [0]
    q = lambda f: scores[min(len(scores)-1, int(f*len(scores)))]
    return {'win': len(wins)/runs, 'p50': q(0.5), 'p80': q(0.8), 'shots': sum(r[2] for r in res)/runs}

def one(f):
    lv = json.load(open(f)); return f.split('/')[-1], evaluate(lv, 30)

if __name__ == '__main__':
    from multiprocessing import Pool
    with Pool() as pool:
        for name, r in pool.map(one, sys.argv[1:]): print(name, r, flush=True)
