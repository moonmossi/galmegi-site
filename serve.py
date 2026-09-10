"""홈페이지 미리보기 + 글쓰기 도구를 켠다. 열기.bat 이 이 파일을 실행한다."""
import http.server
import os
import socketserver
import sys
import threading
import webbrowser

PORT = 8000
URL = f"http://localhost:{PORT}/write.html"

os.chdir(os.path.dirname(os.path.abspath(__file__)))

try:
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), http.server.SimpleHTTPRequestHandler)
except OSError:
    print("이미 켜져 있습니다. 브라우저만 엽니다.")
    webbrowser.open(URL)
    sys.exit()

threading.Timer(0.6, lambda: webbrowser.open(URL)).start()

print()
print("  Galmegi 홈페이지")
print()
print(f"  글쓰기   {URL}")
print(f"  사이트   http://localhost:{PORT}/")
print()
print("  이 창은 켜 둔 채로 두세요. 창을 닫으면 미리보기가 꺼집니다.")
print()

try:
    httpd.serve_forever()
except KeyboardInterrupt:
    pass
