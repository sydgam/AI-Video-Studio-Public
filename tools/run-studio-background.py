"""Start the local server without interactive setup or opening a browser."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server
server.load_env_file()
server.SingleInstanceHTTPServer((server.HOST, server.PORT), server.AppHandler).serve_forever()
