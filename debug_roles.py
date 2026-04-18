import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

MONGO_URI = "mongodb://raunak:Raunak%40123@156.67.111.95:27017/admin?authSource=admin"

async def debug():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client["crm_database"]

    all_users_list = await db.users.find({}, {"first_name": 1, "last_name": 1, "username": 1, "role_id": 1, "employee_status": 1, "is_active": 1}).to_list(None)
    print(f"Total users: {len(all_users_list)}")
    
    karan_candidates = [u for u in all_users_list if "karan" in f"{u.get('first_name','')} {u.get('last_name','')} {u.get('username','')}".lower()]
    print(f"\nUsers matching 'karan': {len(karan_candidates)}")
    for u in karan_candidates:
        print(f"  {u.get('first_name','')} {u.get('last_name','')} (user={u.get('username','')}, role={u.get('role_id','')}, id={u['_id']})")

    all_roles = await db.roles.find({}, {"name": 1, "reporting_ids": 1, "reporting_id": 1}).to_list(None)
    rn = {str(r["_id"]): r.get("name", "?") for r in all_roles}
    print(f"\n=== ALL ROLES ({len(all_roles)}) ===")
    for r in all_roles:
        rid = str(r["_id"])
        rids = r.get("reporting_ids", [])
        old = r.get("reporting_id", "")
        tgt = []
        if rids:
            tgt = [f"{rn.get(str(x),'?')}({x})" for x in rids]
        elif old:
            tgt = [f"{rn.get(str(old),'?')}({old})"]
        print(f"  {r.get('name')} ({rid}) -> {tgt}")

    tm_role = None
    for r in all_roles:
        if "team manager" in r.get("name","").lower():
            tm_role = r
            break
    
    if tm_role:
        tm_rid = str(tm_role["_id"])
        print(f"\n=== TEAM MANAGER: {tm_rid} ===")
        full = await db.roles.find_one({"_id": tm_role["_id"]})
        for p in full.get("permissions",[]):
            print(f"  perm: page={p.get('page')}, actions={p.get('actions')}")
        
        tmu = [u for u in all_users_list if u.get("role_id") == tm_rid]
        print(f"  Users with this role: {len(tmu)}")
        for u in tmu:
            print(f"    {u.get('first_name','')} {u.get('last_name','')} ({u['_id']})")
        
        print(f"\n=== Roles reporting to TM ({tm_rid}) ===")
        for rr in all_roles:
            rids = rr.get("reporting_ids", [])
            old = rr.get("reporting_id", "")
            match = any(str(x) == tm_rid for x in rids) if rids else (str(old) == tm_rid if old else False)
            if match:
                print(f"  {rr.get('name')} ({rr['_id']})")
        
        # BFS subordinates
        visited = set()
        queue = [tm_rid]
        allsub = []
        while queue:
            cur = queue.pop(0)
            if cur in visited: continue
            visited.add(cur)
            for rr in all_roles:
                cid = str(rr["_id"])
                rids = rr.get("reporting_ids", [])
                old = rr.get("reporting_id", "")
                match = any(str(x) == cur for x in rids) if rids else (str(old) == cur if old else False)
                if match and cid not in visited:
                    allsub.append(rr)
                    queue.append(cid)
        print(f"\n=== RECURSIVE subs: {len(allsub)} ===")
        for s in allsub:
            print(f"  {s.get('name')} ({s['_id']})")
        if allsub:
            sub_rids = {str(s["_id"]) for s in allsub}
            sub_u = [u for u in all_users_list if u.get("role_id") in sub_rids]
            print(f"\n=== Users in sub roles: {len(sub_u)} ===")
            for u in sub_u:
                print(f"  {u.get('first_name','')} {u.get('last_name','')} role={rn.get(u.get('role_id',''),'?')} active={u.get('is_active')} status={u.get('employee_status')}")
    else:
        print("NO TEAM MANAGER role")

    print("\n=== DEPARTMENTS ===")
    depts = await db.departments.find({}, {"name": 1}).to_list(None)
    for d in depts:
        print(f"  {d.get('name')} ({d['_id']})")
    
    client.close()

asyncio.run(debug())
