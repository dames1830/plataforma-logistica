import os
import json

transcripts = [
    r"C:\Users\dames\.gemini\antigravity\brain\1b685fa5-6894-4664-b027-7a3b2feb285d\.system_generated\logs\transcript.jsonl",
    r"C:\Users\dames\.gemini\antigravity\brain\5eb2c809-30c6-403a-be2a-560d13271881\.system_generated\logs\transcript.jsonl",
    r"C:\Users\dames\.gemini\antigravity\brain\527affeb-726b-4661-a8a7-4eedb298a07f\.system_generated\logs\transcript.jsonl",
    r"C:\Users\dames\.gemini\antigravity\brain\9048cad6-73bb-4560-ba8b-06179b7e4362\.system_generated\logs\transcript.jsonl"
]

for t_path in transcripts:
    if not os.path.exists(t_path):
        continue
    print(f"\nScanning: {t_path}")
    with open(t_path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f, 1):
            if len(line) > 5000:
                print(f"  Line {idx} size: {len(line)}")
                # Try to see if it's a JSON line and print keys
                try:
                    obj = json.loads(line)
                    print(f"    Keys: {list(obj.keys())}")
                    if "tool_calls" in obj:
                        for tc in obj["tool_calls"]:
                            print(f"      Tool: {tc.get('name')}")
                            args = tc.get('args', {})
                            for k, v in args.items():
                                if isinstance(v, str) and len(v) > 200:
                                    print(f"        Arg {k} length: {len(v)} | Start: {v[:100]}")
                except Exception as e:
                    print(f"    Error parsing: {e}")
