import re

file_path = r"C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\views\dashboard_v24.js"

with open(file_path, "r", encoding="utf-8") as f:
    code = f.read()

# Simple tokenizer that tracks braces and brackets, ignoring strings and comments
pos = 0
length = len(code)
line = 1
col = 1

stack = []

def get_line_col(p):
    l = code[:p].count('\n') + 1
    last_nl = code[:p].rfind('\n')
    c = p - last_nl if last_nl != -1 else p + 1
    return l, c

while pos < length:
    char = code[pos]
    if char == '\n':
        line += 1
        col = 1
        pos += 1
        continue
    
    # Check for comments
    if char == '/' and pos + 1 < length:
        if code[pos+1] == '/':
            # Single line comment
            pos = code.find('\n', pos)
            if pos == -1:
                break
            continue
        elif code[pos+1] == '*':
            # Multi line comment
            end_pos = code.find('*/', pos + 2)
            if end_pos == -1:
                pos = length
            else:
                # Count lines in comment
                comment_text = code[pos:end_pos+2]
                line += comment_text.count('\n')
                pos = end_pos + 2
            continue

    # Check for strings
    if char in ("'", '"', '`'):
        quote = char
        escaped = False
        pos += 1
        while pos < length:
            c = code[pos]
            if c == '\n' and quote != '`':
                # Unescaped newline in single/double quote is a syntax error in JS, but let's handle it
                line += 1
            if escaped:
                escaped = False
            elif c == '\\':
                escaped = True
            elif c == quote:
                pos += 1
                break
            elif c == '$' and quote == '`' and pos + 1 < length and code[pos+1] == '{':
                # Template literal placeholder ${
                stack.append(('${', get_line_col(pos)))
                pos += 2
                break
            pos += 1
        continue

    if char == '{':
        stack.append(('{', get_line_col(pos)))
    elif char == '}':
        if not stack:
            print(f"Extra closing brace '}}' at line {line}, col {col}")
        else:
            top, loc = stack.pop()
            if top != '{' and top != '${':
                print(f"Mismatched closing brace '}}' at line {line}, col {col} (expected match for '{top}' from line {loc[0]}, col {loc[1]})")
    elif char == '[':
        stack.append(('[', get_line_col(pos)))
    elif char == ']':
        if not stack:
            print(f"Extra closing bracket ']' at line {line}, col {col}")
        else:
            top, loc = stack.pop()
            if top != '[':
                print(f"Mismatched closing bracket ']' at line {line}, col {col} (expected match for '{top}' from line {loc[0]}, col {loc[1]})")
    elif char == '(':
        stack.append(('(', get_line_col(pos)))
    elif char == ')':
        if not stack:
            print(f"Extra closing paren ')' at line {line}, col {col}")
        else:
            top, loc = stack.pop()
            if top != '(':
                print(f"Mismatched closing paren ')' at line {line}, col {col} (expected match for '{top}' from line {loc[0]}, col {loc[1]})")

    pos += 1
    col += 1

print("Remaining open elements on stack:", len(stack))
for item, loc in stack[-10:]:
    print(f"  '{item}' opened at line {loc[0]}, col {loc[1]}")
