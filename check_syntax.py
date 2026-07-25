import re

def check_brackets(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    # Remove comments and strings to avoid false positives
    text = re.sub(r'//.*', '', text)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    text = re.sub(r'[\s\S]*?', '', text, flags=re.DOTALL)
    text = re.sub(r"'[^']*'", '', text)
    text = re.sub(r'"[^"]*"', '', text)

    stack = []
    lines = text.split('\n')
    for i, line in enumerate(lines):
        for char in line:
            if char in '({[':
                stack.append((char, i+1))
            elif char in ')}]':
                if not stack:
                    print(f"Unmatched closing '{char}' at line {i+1}")
                    return
                last, _ = stack.pop()
                if (char == ')' and last != '(') or \
                   (char == '}' and last != '{') or \
                   (char == ']' and last != '['):
                    print(f"Mismatched closing '{char}' at line {i+1}. Expected to close '{last}'")
                    return

    if stack:
        print("Unclosed brackets:")
        for bracket, line in stack:
            print(f"  '{bracket}' from line {line}")
    else:
        print("Brackets are perfectly balanced!")

check_brackets('js/views/dashboard_v24.js')
