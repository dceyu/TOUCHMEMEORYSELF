"""Serial-to-WebSocket bridge for Raspberry Pi.
Install: python -m pip install pyserial websockets
Run:     python pi_bridge.py --serial /dev/ttyACM0
"""
import argparse, asyncio, json, serial
from websockets.asyncio.server import serve

clients = set()

async def handler(websocket):
    clients.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        clients.discard(websocket)

async def serial_loop(device, baud):
    port = serial.Serial(device, baud, timeout=0.05)
    while True:
        line = await asyncio.to_thread(port.readline)
        if line:
            try:
                message = json.dumps(json.loads(line.decode().strip()))
                await asyncio.gather(*(c.send(message) for c in list(clients)))
            except (ValueError, UnicodeDecodeError):
                pass
        await asyncio.sleep(0)

async def main(args):
    async with serve(handler, args.host, args.port):
        print(f"Bridge: ws://{args.host}:{args.port} ← {args.serial}")
        await serial_loop(args.serial, args.baud)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--serial", default="/dev/ttyACM0")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    asyncio.run(main(parser.parse_args()))
