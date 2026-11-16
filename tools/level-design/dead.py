import json, math, sys, sim
for f in sys.argv[1:]:
    lv=json.load(open(f)); p=lv['pegs']; dead=[]
    for k in range(165):
        a=8+k; h,_,_,_,_=sim.simulate_shot(p,set(range(len(p))),math.radians(a),440,1,motion=sim.group_motion(lv.get('decor')))
        if not [i for i in h if p[i].get('kind')!='wall']: dead.append(a)
    print(f.split('/')[-1], f"{100*len(dead)/165:.0f}%", dead[:8], dead[-8:])
