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

def simulate_shot(pegs, alive, angle, bucket_x0, bucket_dir, max_steps=4000, motion=None, t0=0.0, max_contacts=None):
    x = CANNON[0] + math.cos(angle)*MUZZLE; y = CANNON[1] + math.sin(angle)*MUZZLE
    vx, vy = math.cos(angle)*SPEED, math.sin(angle)*SPEED
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
        for _ in range(SUB):
            vy += G / SUB
            x += vx / SUB; y += vy / SUB
            if x < ORB_R: x = ORB_R; vx = abs(vx)*WALL_REST
            if x > W-ORB_R: x = W-ORB_R; vx = -abs(vx)*WALL_REST
            if y < ORB_R: y = ORB_R; vy = abs(vy)*WALL_REST
            for i in list(grid.get((int(x//40), int(y//40)), ())) + movers:
                if i not in alive: continue
                p = pegs[i]
                if p.get('shape') == 'brick':
                    cx, cy = brick_closest(None, p, x, y); rr = ORB_R
                else:
                    cx, cy = p['x'], p['y']; rr = ORB_R + p.get('r', 10)
                dx, dy = x-cx, y-cy; d2 = dx*dx+dy*dy
                if d2 < rr*rr:
                    d = math.sqrt(d2) or 0.001; nx, ny = dx/d, dy/d
                    x, y = cx + nx*rr, cy + ny*rr
                    vn = vx*nx + vy*ny
                    if vn < 0:
                        vx -= (1+REST)*vn*nx; vy -= (1+REST)*vn*ny
                    if i not in hitset and p.get('kind') != 'wall':
                        hitset.add(i); hits.append(i)
                        if max_contacts and len(hits) >= max_contacts: return hits, False, bx, bd, t/60
        if y + ORB_R >= BUCKET_Y - 9 and y < H and abs(x - bx) <= BUCKET_W/2:
            return hits, True, bx, bd, t/60
        if y > H + 16:
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
    comp = level.get('companion')
    free = [i for i, p in enumerate(pegs) if 'kind' not in p]
    rng.shuffle(free)
    a = level['assign']; k = 0
    for kind, n in (('heart', a.get('hearts', 0)), ('power', a.get('power', 0))):
        for _ in range(n): pegs[free[k]]['kind'] = kind; k += 1
    for i in free[k:]: pegs[i]['kind'] = 'common'
    alive = set(range(len(pegs)))
    hearts_total = sum(1 for p in pegs if p['kind'] == 'heart')
    orbs = level.get('orbs', 10); score = 0; bx, bd = W/2, 1; shots = 0
    def place_bonus():
        for p in pegs:
            if p['kind'] == 'bonus': p['kind'] = 'common'
        commons = [i for i in alive if pegs[i]['kind'] == 'common']
        for _ in range(a.get('bonus', 1)):
            if commons: pegs[commons.pop(rng.randrange(len(commons)))]['kind'] = 'bonus'
    place_bonus(); pip = 0
    while orbs > 0:
        orbs -= 1; shots += 1
        if policy == 'random':
            ang = math.radians(rng.uniform(8, 172))
        else:
            best = None
            left = sum(1 for i in alive if pegs[i]['kind'] == 'heart')
            # joueur « correct » : il ne voit que le guide de visée (1er contact), ou 3 contacts avec Pip
            cands = [math.radians(8 + 0.5*k) for k in range(329)]
            seen = 3 if pip else 1
            for ang_c in cands:
                h, c, _, _, _ = simulate_shot(pegs, set(alive), ang_c, bx, bd, motion=motion, t0=T, max_contacts=seen)
                val = sum((6 if pegs[i]['kind'] == 'heart' else 1) for i in h) + rng.random()*0.5
                if best is None or val > best[0]: best = (val, ang_c)
            ang = best[1] + math.radians(rng.gauss(0, 0.3))  # imprécision humaine
            if pip: pip -= 1
        hits, caught, bx, bd, dt = simulate_shot(pegs, alive, ang, bx, bd, motion=motion, t0=T)
        T += dt + 1.5
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
        if comp == 'pip' and any(pegs[i]['kind'] == 'power' for i in hits if i in alive): pip = 2
        for i in hits: alive.discard(i)
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
