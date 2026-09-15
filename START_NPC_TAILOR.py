"""Optional offline-source launcher. Python 3.9+; no third-party dependencies."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser

def main():
    root=Path(__file__).resolve().parent
    if not (root/'npc-tailor.html').is_file():
        raise SystemExit('Please extract the complete source archive first.')
    handler=partial(SimpleHTTPRequestHandler,directory=str(root))
    with ThreadingHTTPServer(('127.0.0.1',0),handler) as server:
        url=f'http://127.0.0.1:{server.server_port}/npc-tailor.html'
        print('NPC Tailor R1:',url,'\nKeep this terminal open. Ctrl+C stops the server.',flush=True)
        threading.Timer(0.5,lambda:webbrowser.open(url)).start()
        try: server.serve_forever()
        except KeyboardInterrupt: pass
if __name__=='__main__': main()
