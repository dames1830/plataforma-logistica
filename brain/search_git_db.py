import subprocess
import os

root = r"C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app"
os.chdir(root)

# Run git log to find all commits that touched .db files
cmd = ["git", "log", "--all", "--name-status", "--format=%H %cd"]
res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")

commits_touching_db = []
current_commit = None

for line in res.stdout.splitlines():
    if not line:
        continue
    if len(line.split()) > 1 and not line.startswith("A\t") and not line.startswith("M\t") and not line.startswith("D\t"):
        current_commit = line
    else:
        if ".db" in line or ".json" in line:
            commits_touching_db.append((current_commit, line))

print("Commits touching DB or JSON files:")
for c, f in commits_touching_db:
    print(f"Commit: {c} | File: {f}")
