import sys
with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    text = f.read()

def check_js_syntax(s):
    in_str = False
    str_char = ''
    in_comment = False
    in_block_comment = False
    in_regex = False
    
    stack = []
    i = 0
    while i < len(s):
        c = s[i]
        
        if in_comment:
            if c == '\n':
                in_comment = False
            i += 1
            continue
            
        if in_block_comment:
            if c == '*' and i+1 < len(s) and s[i+1] == '/':
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue
            
        if in_str:
            if c == '\\':
                i += 2
                continue
            if c == str_char:
                # If we are inside a template literal and encounter ${, we go into a JS context.
                # BUT this requires a recursive stack. For now just treat ` as a normal string.
                # ACTUALLY, template literals can contain ${...} which has its own string.
                # This is too complex for a simple loop without a real lexer.
                in_str = False
            i += 1
            continue
            
        # check for comments
        if c == '/' and i+1 < len(s):
            if s[i+1] == '/':
                in_comment = True
                i += 2
                continue
            elif s[i+1] == '*':
                in_block_comment = True
                i += 2
                continue
                
        # check for strings
        if c in ["'", '"', '`']:
            in_str = True
            str_char = c
            i += 1
            continue
            
        if c == '{':
            stack.append(('{', i))
        elif c == '}':
            if not stack:
                print(f'Unmatched }} at {i}')
                print(s[i-50:i+50])
                return
            stack.pop()
        
        i += 1
        
    if stack:
        print(f'Unmatched {{ at {stack[-1][1]}')
        print(s[stack[-1][1]-50:stack[-1][1]+50])
    else:
        print('Syntax looks clean regarding braces!')

check_js_syntax(text)
