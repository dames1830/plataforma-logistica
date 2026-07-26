with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    text = f.read()

def check_braces(s):
    stack = []
    in_string = False
    string_char = ''
    in_single_comment = False
    in_multi_comment = False
    escaped = False

    i = 0
    while i < len(s):
        c = s[i]
        if in_single_comment:
            if c == '\n': in_single_comment = False
            i += 1
            continue
        if in_multi_comment:
            if c == '*' and i+1 < len(s) and s[i+1] == '/':
                in_multi_comment = False
                i += 1
            i += 1
            continue
        if in_string:
            if escaped:
                escaped = False
            elif c == '\\':
                escaped = True
            elif c == string_char:
                in_string = False
            i += 1
            continue

        if c in '\"\'`':
            in_string = True
            string_char = c
        elif c == '/' and i+1 < len(s):
            if s[i+1] == '/':
                in_single_comment = True
                i += 1
            elif s[i+1] == '*':
                in_multi_comment = True
                i += 1
        elif c == '{':
            stack.append(('{', i))
        elif c == '}':
            if not stack or stack[-1][0] != '{':
                print(f'Unmatched }} at index {i}')
                print(s[max(0, i-50):i+50])
                return
            stack.pop()
        i += 1
    if stack:
        print('Unmatched left braces:', len(stack))
        for _, idx in stack[-5:]:
            print('... ' + s[max(0, idx-50):idx+50] + ' ...')
    else:
        print('Braces match!')

check_braces(text)
