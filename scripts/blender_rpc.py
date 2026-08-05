#!/usr/bin/env python3
"""Direct JSON-RPC to Blender MCP addon socket (default 127.0.0.1:9876)."""
from __future__ import annotations

import argparse
import json
import socket
import sys


def call(cmd_type: str, params: dict | None = None, host: str = "127.0.0.1", port: int = 9876, timeout: float = 10.0):
    payload = json.dumps({"type": cmd_type, "params": params or {}}).encode("utf-8")
    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.sendall(payload)
        sock.settimeout(timeout)
        chunks: list[bytes] = []
        while True:
            data = sock.recv(65536)
            if not data:
                break
            chunks.append(data)
            try:
                return json.loads(b"".join(chunks).decode("utf-8"))
            except json.JSONDecodeError:
                continue
    raise RuntimeError("empty response from Blender")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", help="Blender MCP command type, e.g. get_scene_info")
    parser.add_argument("--params", default="{}", help="JSON object of params")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9876)
    args = parser.parse_args()
    params = json.loads(args.params)
    result = call(args.command, params, host=args.host, port=args.port)
    json.dump(result, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0 if result.get("status") == "success" else 1


if __name__ == "__main__":
    raise SystemExit(main())
