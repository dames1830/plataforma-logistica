import os
from datetime import datetime, date

root = r"C:\Users\dames\.gemini\antigravity"
today = date.today()

db_files = []
for dirpath, _, filenames in os.walk(root):
    for f in filenames:
        if f.endswith(".db") or f.endswith(".sqlite") or "backup" in f.lower():
            path = os.path.join(dirpath, f)
            try:
                mtime = os.path.getmtime(path)
                mdate = datetime.fromtimestamp(mtime).date()
                if mdate == today:
                    db_files.append((path, datetime.fromtimestamp(mtime), os.path.getsize(path)))
            except Exception:
                pass

print("Found DB or backup files modified today:")
for p, t, s in sorted(db_files, key=lambda x: x[1]):
    print(f"Path: {p} | Time: {t} | Size: {s} bytes")
