import re

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

# 1. cellExists structure (holes)
text = re.sub(
    r"if \(\!isReserva && currentLayoutZona === 'MZN01'\) \{\s*if \(\(c === 2 \|\| c === 3\) && r <= 3\) cellExists = false;\s*if \(\(c === 22 \|\| c === 23\) && r <= 3\) cellExists = false;\s*\}",
    r"if (!isReserva && (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02')) {\n                        if ((c === 2 || c === 3) && r <= 3) cellExists = false;\n                        if ((c === 22 || c === 23) && r <= 3) cellExists = false;\n                    }",
    text
)

# 2. logicalR
text = re.sub(
    r"if \(\!isReserva && currentLayoutZona === 'MZN01'\) \{\s*if \(c === 2 \|\| c === 3 \|\| c === 22 \|\| c === 23\) \{\s*logicalR = r - 3;\s*\}\s*\}",
    r"if (!isReserva && (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02')) {\n                        if (c === 2 || c === 3 || c === 22 || c === 23) {\n                            logicalR = r - 3;\n                        }\n                    }",
    text
)

# 3. ACTUAL_TOTAL_CELLS
text = re.sub(
    r"\} else if \(\!isReserva && currentLayoutZona === 'MZN01'\) \{\s*let count = 0;",
    r"} else if (!isReserva && (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02')) {\n                let count = 0;",
    text
)

with open("js/views/dashboard_v24.js", "w", encoding="utf-8") as f:
    f.write(text)
