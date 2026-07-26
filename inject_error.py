with open('reportes.html', 'r', encoding='utf-8') as f:
    html = f.read()

script = """
<script>
window.onerror = function(msg, url, lineNo, columnNo, error) {
  alert('ERROR: ' + msg + '\\nLine: ' + lineNo + '\\nCol: ' + columnNo);
  document.body.innerHTML += '<div style="position:fixed;top:0;left:0;background:red;color:white;z-index:9999;padding:20px;font-size:20px;width:100%;">ERROR: ' + msg + ' <br> Line: ' + lineNo + '</div>';
  return false;
};
window.addEventListener('unhandledrejection', function(event) {
  alert('PROMISE ERROR: ' + event.reason);
  document.body.innerHTML += '<div style="position:fixed;top:100px;left:0;background:orange;color:white;z-index:9999;padding:20px;font-size:20px;width:100%;">PROMISE ERROR: ' + event.reason + '</div>';
});
</script>
"""

if '<script>\nwindow.onerror' not in html:
    html = html.replace('<head>', '<head>\n' + script)
    with open('reportes.html', 'w', encoding='utf-8') as f:
        f.write(html)
