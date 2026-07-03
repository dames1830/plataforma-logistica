import os
import json
from datetime import datetime, date

root = r"C:\Users\dames\.gemini\antigravity\brain"
today = date.today()

transcript_files = []
for dirpath, _, filenames in os.walk(root):
    for f in filenames:
        if f == "transcript.jsonl":
            path = os.path.join(dirpath, f)
            try:
                mtime = os.path.getmtime(path)
                mdate = datetime.fromtimestamp(mtime).date()
                if mdate == today:
                    transcript_files.append((path, datetime.fromtimestamp(mtime)))
            except Exception:
                pass

print(f"Found {len(transcript_files)} transcripts modified today:")
for p, t in sorted(transcript_files, key=lambda x: x[1]):
    # Let's count how many lines it has
    with open(p, "r", encoding="utf-8") as file:
        lines = file.readlines()
    print(f"  Path: {p} | Time: {t} | Lines: {len(lines)}")
