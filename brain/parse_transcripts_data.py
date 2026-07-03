import os
import json
import re

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
            if "no_retail" in line or "no-retail" in line:
                # Find matching lines and print surrounding context
                try:
                    obj = json.loads(line)
                    # Look at tool calls or content
                    content = obj.get("content", "")
                    tool_calls = obj.get("tool_calls", [])
                    
                    if tool_calls:
                        for tc in tool_calls:
                            name = tc.get("name")
                            args = tc.get("args", {})
                            args_str = str(args)
                            if len(args_str) > 100:
                                args_str = args_str[:150] + "..."
                            print(f"  Line {idx} | Tool Call: {name} | Args: {args_str}")
                    
                    if "no_retail" in str(obj.get("output", "")) or "no_retail" in str(obj.get("result", "")):
                        out = str(obj.get("output", "")) or str(obj.get("result", ""))
                        if len(out) > 100:
                            out = out[:150] + "..."
                        print(f"  Line {idx} | Tool Output: {out}")
                except Exception as e:
                    pass
