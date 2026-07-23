with open('js/views/dashboard_v24.js', 'r', encoding='utf-8') as f:
    text = f.read()

orig_valid = '''                        } else if (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02') {
                            if (temporadaClean === 'ACTUAL') {
                                if (col >= 4 && col <= 11) isValid = true;
                                else if (col >= 12 && col <= 21) isValid = true;
                                else if (col === 24) isValid = true;
                                else if (isSaldo && ((col >= 1 && col <= 3) || (col >= 22 && col <= 23))) isValid = true;
                            } else if (temporadaClean === 'ANTERIOR') {
                                if (col >= 1 && col <= 3) isValid = true;
                                else if (col >= 22 && col <= 23) isValid = true;
                            }
                        } else {'''

repl_valid = '''                        } else if (currentLayoutZona === 'MZN01') {
                            if (temporadaClean === 'ACTUAL') {
                                if (col >= 4 && col <= 11) isValid = true;
                                else if (col >= 12 && col <= 21) isValid = true;
                                else if (col === 24) isValid = true;
                                else if (isSaldo && ((col >= 1 && col <= 3) || (col >= 22 && col <= 23))) isValid = true;
                            } else if (temporadaClean === 'ANTERIOR') {
                                if (col >= 1 && col <= 3) isValid = true;
                                else if (col >= 22 && col <= 23) isValid = true;
                            }
                        } else if (currentLayoutZona === 'MZN02') {
                            if (temporadaClean === 'ACTUAL') {
                                if (col >= 8 && col <= 24) isValid = true;
                                else if (isSaldo && (col >= 1 && col <= 3)) isValid = true;
                            } else if (temporadaClean === 'ANTERIOR') {
                                if (col >= 4 && col <= 7) isValid = true;
                                else if (isSaldo && (col >= 1 && col <= 3)) isValid = true;
                            } else if (isSaldo) {
                                if (col >= 1 && col <= 3) isValid = true;
                            }
                        } else {'''

text = text.replace(orig_valid, repl_valid)

with open('js/views/dashboard_v24.js', 'w', encoding='utf-8') as f:
    f.write(text)

