#!/usr/bin/env python3
# T13 wire E2E — hostile + honest probes against the live /api/ink route.
import json, subprocess, urllib.request, sqlite3, uuid, sys

BASE = "http://127.0.0.1:3030"
DB = "/home/z/my-project/db/assize.db"
fails = []

def post(path, body):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(),
                                 headers={"content-type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))
    if not cond: fails.append(name)

def db_row(acc_id):
    c = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    r = c.execute("SELECT ink, ink_ledger FROM accounts WHERE id=?", (acc_id,)).fetchone()
    c.close()
    return r

uid = lambda: uuid.uuid4().hex

# --- 1. auth gate -------------------------------------------------------------
s, r = post("/api/ink", {})
check("ink: no auth -> 401", s == 401 and r.get("ok") is False, f"{s} {r}")

# --- 2. account + honest solo award -------------------------------------------
A, secret = uid(), uid()
s, r = post("/api/auth", {"id": A, "secret": secret, "name": "Ledger Probe"})
check("auth: create returns ink 0", s == 200 and r.get("ink") == 0, f"{s} {r}")
s, r = post("/api/ink", {"id": A, "secret": secret, "entries": [{"duelId": "practice-abc", "mode": "practice", "delta": 45}]})
res = r.get("results", [{}])[0]
check("ink: honest practice award bounded@45", s == 200 and res.get("verdict") == "bounded" and res.get("applied") == 45, f"{s} {r}")
check("ink: server balance echoes 45", r.get("ink") == 45, f"{r.get('ink')}")
row = db_row(A)
check("db: ink column = 45", row and row[0] == 45, str(row))
ledger = json.loads(row[1]) if row else []
check("db: ledger row recorded (bounded)", len(ledger) == 1 and ledger[0]["v"] == "bounded" and ledger[0]["d"] == 45, str(ledger))

# --- 3. hostile shapes ----------------------------------------------------------
s, r = post("/api/ink", {"id": A, "secret": secret, "entries": "not-an-array"})
check("ink: non-array entries -> ok, zero results", s == 200 and r.get("results") == [] and r.get("ink") == 45, f"{r}")
s, r = post("/api/ink", {"id": A, "secret": secret, "entries": [
    {"duelId": "", "mode": "ranked", "delta": 30},
    {"duelId": "x", "mode": "galaxy", "delta": 30},
    {"duelId": "y", "mode": "ranked", "delta": 1e9},
    {"duelId": "z", "mode": "spend", "delta": 700},
    None, 42, "junk",
]})
# a positive spend is LEGAL input shape but dropped by the settle law: verdicts are
# visible per entry, applied 0, and the balance never moved
check("ink: hostile batch all dropped", all(x.get("verdict") == "dropped" and x.get("applied") == 0 for x in r.get("results", [])) and r.get("ink") == 45, f"{r}")

# --- 4. fabricated PvP id is dropped; real duel-log row is verified ---------------
s, r = post("/api/ink", {"id": A, "secret": secret, "entries": [{"duelId": "fabricated-uuid", "mode": "ranked", "delta": 111}]})
check("ink: fabricated ranked id dropped", r.get("results", [{}])[0].get("verdict") == "dropped" and r.get("ink") == 45, f"{r}")

duel_id = "e2e-" + uid()
c = sqlite3.connect(DB)  # simulate what finishRoom itself writes after a ranked win
c.execute("INSERT INTO duels (id, mode, p0, p1, seed, tier, winner, reason, rating0, rating1, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          (duel_id, "ranked", A, "opponent", "pvp-seed", "Medium", "0", "seals", 10, -10, 1790860000000))
c.commit(); c.close()
s, r = post("/api/ink", {"id": A, "secret": secret, "entries": [
    {"duelId": duel_id, "mode": "ranked", "delta": 111},   # exact cap -> verified
]})
check("ink: proven ranked win verified @111", r.get("results", [{}])[0].get("verdict") == "verified" and r.get("results", [{}])[0].get("applied") == 111, f"{r}")
check("ink: balance 156", r.get("ink") == 156, f"{r.get('ink')}")

# over-cap claim on the same win (fresh duel row, dishonest magnitude)
duel2 = "e2e-" + uid()
c = sqlite3.connect(DB)
c.execute("INSERT INTO duels (id, mode, p0, p1, seed, tier, winner, reason, rating0, rating1, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          (duel2, "ranked", A, "opponent", "pvp-seed", "Medium", "0", "seals", 10, -10, 1790860000000))
c.commit(); c.close()
s, r = post("/api/ink", {"id": A, "secret": secret, "entries": [{"duelId": duel2, "mode": "ranked", "delta": 500}]})
check("ink: over-cap win bounded to 111", r.get("results", [{}])[0] == {"duelId": duel2, "verdict": "bounded", "applied": 111}, f"{r}")

# --- 5. replay idempotence -------------------------------------------------------
s, r = post("/api/ink", {"id": A, "secret": secret, "entries": [{"duelId": duel2, "mode": "ranked", "delta": 500}]})
check("ink: replayed id dropped, balance stable", r.get("results", [{}])[0].get("verdict") == "dropped" and r.get("ink") == 267, f"{r}")

# --- 6. spend floors the balance -------------------------------------------------
s, r = post("/api/ink", {"id": A, "secret": secret, "entries": [{"duelId": "spend-board-bone-1", "mode": "spend", "delta": -700}]})
check("ink: spend -700 applied", r.get("results", [{}])[0].get("applied") == -700 and r.get("ink") == 0, f"{r}")  # 267-700 floors at 0

# --- 7. flood cap ----------------------------------------------------------------
flood = [{"duelId": f"flood-{i}", "mode": "practice", "delta": 1} for i in range(60)]
s, r = post("/api/ink", {"id": A, "secret": secret, "entries": flood})
check("ink: flood capped at 50", len(r.get("results", [])) == 50 and r.get("ink") == 50, f"{len(r.get('results', []))} {r.get('ink')}")
row = db_row(A)
check("db: ledger capped at newest rows", len(json.loads(row[1])) <= 200, str(len(json.loads(row[1]))))

# --- 8. recovery restores the server-known Ink ------------------------------------
donor, dsecret, recip, rsecret = uid(), uid(), uid(), uid()
import hashlib
code = "ash-bell-cinder-doyle-07"
digest = subprocess.run(["bun", "-e", f"console.log(new Bun.CryptoHasher('sha256').update('assize:{code}').digest('hex'))"],
                        capture_output=True, text=True).stdout.strip()
post("/api/auth", {"id": donor, "secret": dsecret, "name": "Donor Clerk", "recoveryHash": digest})
# 321 needs three legal entries — practice caps at 111 per entry (the law held even here:
# a single 321 probe above was bounded to 111, which is why this E2E posts 3 × 107)
post("/api/ink", {"id": donor, "secret": dsecret, "entries": [
    {"duelId": "donor-practice-1", "mode": "practice", "delta": 107},
    {"duelId": "donor-practice-2", "mode": "practice", "delta": 107},
    {"duelId": "donor-practice-3", "mode": "practice", "delta": 107},
]})
check("donor: ink 321 server-known", db_row(donor)[0] == 321, str(db_row(donor)))
post("/api/auth", {"id": recip, "secret": rsecret, "name": "Recipient Clerk"})
s, r = post("/api/recovery", {"code": code, "id": recip, "secret": rsecret})
check("recovery: returns donor ink", s == 200 and r.get("ok") is True and r.get("ink") == 321, f"{s} {r}")
check("recovery: recipient ink set to 321", db_row(recip)[0] == 321, str(db_row(recip)))
recip_ledger = json.loads(db_row(recip)[1])
check("recovery: audit row mode=recovery on recipient", any(l.get("mode") == "recovery" for l in recip_ledger), str(recip_ledger))
s, r = post("/api/recovery", {"code": code, "id": recip, "secret": rsecret})
check("recovery: code consumed (second use fails)", r.get("ok") is False, f"{r}")

# --- 9. /api/auth returns the ledger ink -------------------------------------------
s, r = post("/api/auth", {"id": recip, "secret": rsecret, "name": "Recipient Clerk"})
check("auth: existing account returns ink", r.get("ink") == 321, f"{r}")

print()
print("T13 wire E2E:", "ALL PASS" if not fails else f"{len(fails)} FAILURES: {fails}")
sys.exit(1 if fails else 0)
