#!/usr/bin/env python3
"""
Kronos Web UI startup script
"""

import os
import sys
import subprocess
import webbrowser
import threading
from app.config import ROOT_DIR

def check_dependencies():
    """Check if dependencies are installed"""
    try:
        import flask
        import flask_cors
        import waitress
        import pandas
        import numpy
        import plotly
        import openai
        import dotenv
        print("✅ All dependencies installed")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Please run: pip install -r requirements.txt")
        return False

def install_dependencies():
    """Install dependencies"""
    print("Installing dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", str(ROOT_DIR / "requirements.txt")])
        print("✅ Dependencies installation completed")
        return True
    except subprocess.CalledProcessError:
        print("❌ Dependencies installation failed")
        return False

def main():
    """Main function"""
    print("🚀 Starting Financial Forecast...")
    print("=" * 50)

    # Check dependencies
    if not check_dependencies():
        print("\nAuto-install dependencies? (y/n): ", end="")
        if input().lower() == 'y':
            if not install_dependencies():
                return
        else:
            print("Please manually install dependencies and retry")
            return

    # Check model availability
    try:
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from model import Kronos, KronosTokenizer, KronosPredictor
        print("✅ Kronos model library available")
        model_available = True
    except ImportError:
        print("⚠️  Kronos model library not available, will use simulated prediction")
        model_available = False

    # Start Flask application
    print("\n🌐 Starting Web server...")

    # Set the application module for tooling that inspects the Flask app.
    os.environ['FLASK_APP'] = 'app.wsgi:app'

    # Start server
    try:
        from app.api import app
        print("🚀 Starting Waitress server...")
        print(f"🌐 Access URL: http://localhost:7070")
        print("💡 Tip: Press Ctrl+C to stop server")

        # Open one browser tab after the local server has had time to bind.
        if os.environ.get('FINANCIAL_ANALYTICS_OPEN_BROWSER', '1') != '0':
            threading.Timer(1.0, webbrowser.open, args=('http://localhost:7070',)).start()

        # Waitress serves the local Flask app without Flask's development
        # server warning or debug reloader.
        from waitress import serve
        serve(app, host='127.0.0.1', port=7070, threads=8)

    except Exception as e:
        print(f"❌ Startup failed: {e}")
        print("Please check if port 7070 is occupied")

if __name__ == "__main__":
    main()
