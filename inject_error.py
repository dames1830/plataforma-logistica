# -*- coding: utf-8 -*-
with open("index.html", "r", encoding="utf-8") as f:
    text = f.read()

injection = """<script>
window.addEventListener('error', function(e) {
    document.body.innerHTML += '<div style="position:fixed;top:0;left:0;z-index:9999;background:red;color:white;padding:20px;font-size:20px;">' + e.message + ' at ' + e.filename + ':' + e.lineno + '</div>';
});
window.addEventListener('unhandledrejection', function(e) {
    document.body.innerHTML += '<div style="position:fixed;top:50px;left:0;z-index:9999;background:orange;color:white;padding:20px;font-size:20px;">' + e.reason + '</div>';
});
</script>"""

if "<head>" in text and "window.addEventListener('error'" not in text:
    text = text.replace("<head>", "<head>\n" + injection)
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(text)
    print("Injected global error handler.")
else:
    print("Already injected or <head> not found.")
