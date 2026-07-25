import re

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

# Make flex-direction always column, and always width 100% for the heatmap vs report layout.
# This prevents SEL from being shrunk.
text = re.sub(
    r"flex-direction:\$\{isMZN \? 'column' : 'row'\};",
    r"flex-direction:column;",
    text
)

text = re.sub(
    r"\$\{isMZN \? 'width:100%' : 'flex:2'\};",
    r"width:100%;",
    text
)

# Fix reports occupying full page width and side-by-side
# We need to make the container flex-direction:row for the reports.
# Wait, if we change the top container to flex-direction:column, the reports container will span the full width automatically.
# Let's check the container that holds the 3 reports.
# `flex:1; min-width:0; display:flex; flex-direction:column; gap:20px;`
# We want it to be flex-direction:row so the 3 reports are side-by-side!
# But wait, we can just replace that specific line if we find it.

with open("js/views/dashboard_v24.js", "w", encoding="utf-8") as f:
    f.write(text)
