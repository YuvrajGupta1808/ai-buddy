"""Tunnel script to expose local FastAPI server to the internet."""
import os
import time
from pyngrok import ngrok
import uvicorn
from main import app

def start_tunnel(port=5000):
    """
    Start ngrok tunnel and FastAPI server.
    
    Args:
        port: Local port to tunnel (default: 5000)
    """
    print(f"🚀 Starting tunnel for port {port}...")
    
    # Check if ngrok auth token is set (optional but recommended)
    # Get your token from https://dashboard.ngrok.com/get-started/your-authtoken
    # Then set it: export NGROK_AUTHTOKEN=your_token_here
    auth_token = os.getenv("NGROK_AUTHTOKEN")
    if auth_token:
        ngrok.set_auth_token(auth_token)
        print("✅ Using ngrok auth token")
    else:
        print("⚠️  No NGROK_AUTHTOKEN found. Using anonymous tunnel (limited).")
        print("   Get a free token at: https://dashboard.ngrok.com/get-started/your-authtoken")
    
    # Start ngrok tunnel
    tunnel = ngrok.connect(port, bind_tls=True)
    public_url = tunnel.public_url
    
    print(f"\n{'='*60}")
    print(f"🌐 Public URL: {public_url}")
    print(f"📋 Local URL: http://localhost:{port}")
    print(f"{'='*60}\n")
    print(f"📝 API Documentation: {public_url}/docs")
    print(f"📝 Alternative docs: {public_url}/redoc")
    print(f"\n⚠️  Keep this terminal open to maintain the tunnel")
    print(f"Press Ctrl+C to stop\n")
    
    # Start FastAPI server
    try:
        uvicorn.run(app, host="0.0.0.0", port=port)
    except KeyboardInterrupt:
        print("\n\n🛑 Shutting down...")
        ngrok.disconnect(public_url)
        ngrok.kill()
        print("✅ Tunnel closed")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    start_tunnel(port)

