with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    text = f.read()

def check_syntax_manually(s):
    # A simple regex for unmatched backticks
    b_count = s.count('`')
    if b_count % 2 != 0:
        print(f"Unmatched backticks! Count: {b_count}")
    else:
        print("Backticks match.")
        
    s_count = s.count("'")
    if s_count % 2 != 0:
        print(f"Unmatched single quotes! Count: {s_count}")
    
    d_count = s.count('"')
    if d_count % 2 != 0:
        print(f"Unmatched double quotes! Count: {d_count}")
        
    # count async functions vs brackets
    
check_syntax_manually(text)
