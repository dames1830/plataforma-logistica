import subprocess

cmd = ["git", "diff", "88e9f84", "234c78d", "--", "js/views/dashboard_v24.js"]
res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
print(res.stdout[:2000])
print("...")
print(res.stdout[-2000:])
