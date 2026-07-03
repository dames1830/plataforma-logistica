import os
import json

transcripts = [
    r"C:\Users\dames\.gemini\antigravity\brain\1b685fa5-6894-4664-b027-7a3b2feb285d\.system_generated\logs\transcript.jsonl",
    r"C:\Users\dames\.gemini\antigravity\brain\527affeb-726b-4661-a8a7-4eedb298a07f\.system_generated\logs\transcript.jsonl"
]

for t_path in transcripts:
    if os.path.exists(t_path):
        print(f"Scanning: {t_path}")
        with open(t_path, "r", encoding="utf-8") as f:
            for idx, line in enumerate(f, 1):
                if "attendance" in line or "performance" in line:
                    try:
                        obj = json.loads(line)
                        output = obj.get("output", "") or obj.get("content", "")
                        if output and ("attendance" in output or "performance" in output or "2026-06" in output):
                            print(f"  Line {idx} matches! Size: {len(output)}")
                            if len(output) > 200:
                                print(f"    Snippet: {output[:300]}")
                            else:
                                print(f"    Full: {output}")
                    except Exception as e:
                        pass
