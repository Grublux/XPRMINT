#!/usr/bin/env python3
"""
Browse on-chain item images and metadata from the Stabilization System V1.

This script:
1. Reads token URIs for all 64 items
2. Extracts and saves PNG images from base64 data
3. Displays metadata for each item
4. Creates an HTML gallery for easy browsing
"""

import json
import base64
import subprocess
import os
from pathlib import Path

# Configuration
ITEM_V1 = os.getenv("ITEM_V1", "0x9c4216d7b56a25b4b8a8eddefebaba389e05a01e")
RPC = os.getenv("RPC", "https://apechain.calderachain.xyz/http")
OUTPUT_DIR = Path("onchain_images")
OUTPUT_DIR.mkdir(exist_ok=True)

def get_token_uri(token_id):
    """Fetch token URI from contract."""
    cmd = [
        "cast", "call", ITEM_V1,
        "uri(uint256)(string)", str(token_id),
        "--rpc-url", RPC
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        uri = result.stdout.strip().strip('"')
        return uri
    except subprocess.CalledProcessError as e:
        print(f"Error fetching URI for token {token_id}: {e.stderr}")
        return None

def decode_uri(uri):
    """Decode base64 JSON from token URI."""
    if not uri.startswith("data:application/json;base64,"):
        print(f"Unexpected URI format: {uri[:50]}...")
        return None
    
    base64_data = uri.replace("data:application/json;base64,", "")
    try:
        json_data = base64.b64decode(base64_data).decode('utf-8')
        return json.loads(json_data)
    except Exception as e:
        print(f"Error decoding URI: {e}")
        return None

def extract_image(metadata):
    """Extract PNG image from metadata and save to disk."""
    image_data = metadata.get("image", "")
    if not image_data.startswith("data:image/png;base64,"):
        return None
    
    base64_image = image_data.replace("data:image/png;base64,", "")
    try:
        image_bytes = base64.b64decode(base64_image)
        return image_bytes
    except Exception as e:
        print(f"Error decoding image: {e}")
        return None

def create_html_gallery(items_data):
    """Create an HTML gallery for browsing items."""
    html = """<!DOCTYPE html>
<html>
<head>
    <title>Stabilization Items - On-Chain Gallery</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            background: #1a1a1a;
            color: #e0e0e0;
        }
        h1 {
            text-align: center;
            color: #fff;
        }
        .items-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }
        .item-card {
            background: #2a2a2a;
            border-radius: 8px;
            padding: 15px;
            border: 1px solid #3a3a3a;
        }
        .item-image {
            width: 100%;
            height: 300px;
            object-fit: contain;
            background: #1a1a1a;
            border-radius: 4px;
            margin-bottom: 10px;
        }
        .item-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 8px;
            color: #fff;
        }
        .item-description {
            font-size: 14px;
            color: #b0b0b0;
            margin-bottom: 10px;
            line-height: 1.4;
        }
        .item-attributes {
            font-size: 12px;
            color: #888;
        }
        .attribute {
            margin: 4px 0;
        }
        .attribute-label {
            font-weight: 600;
            color: #aaa;
        }
    </style>
</head>
<body>
    <h1>Stabilization Items V1 - On-Chain Gallery</h1>
    <div class="items-grid">
"""
    
    for item in items_data:
        image_path = f"images/item_{item['id']}.png"
        html += f"""
        <div class="item-card">
            <img src="{image_path}" alt="{item['name']}" class="item-image">
            <div class="item-name">#{item['id']}: {item['name']}</div>
            <div class="item-description">{item['description']}</div>
            <div class="item-attributes">
"""
        for attr in item.get('attributes', []):
            html += f'                <div class="attribute"><span class="attribute-label">{attr["trait_type"]}:</span> {attr["value"]}</div>\n'
        
        html += """            </div>
        </div>
"""
    
    html += """    </div>
</body>
</html>
"""
    
    return html

def main():
    print("=== On-Chain Image Browser ===\n")
    print(f"Contract: {ITEM_V1}")
    print(f"RPC: {RPC}\n")
    
    # Create images subdirectory
    images_dir = OUTPUT_DIR / "images"
    images_dir.mkdir(exist_ok=True)
    
    items_data = []
    successful = 0
    failed = 0
    
    print("Fetching token URIs and extracting images...")
    print("-" * 60)
    
    for token_id in range(64):
        print(f"Processing item {token_id}...", end=" ", flush=True)
        
        # Get token URI
        uri = get_token_uri(token_id)
        if not uri:
            print("❌ Failed to fetch URI")
            failed += 1
            continue
        
        # Decode metadata
        metadata = decode_uri(uri)
        if not metadata:
            print("❌ Failed to decode metadata")
            failed += 1
            continue
        
        # Extract and save image
        image_bytes = extract_image(metadata)
        if image_bytes:
            image_path = images_dir / f"item_{token_id}.png"
            image_path.write_bytes(image_bytes)
            print(f"✅ Saved ({len(image_bytes)} bytes)")
        else:
            print("⚠️  No image found")
        
        # Store metadata
        items_data.append({
            "id": token_id,
            "name": metadata.get("name", "Unknown"),
            "description": metadata.get("description", ""),
            "attributes": metadata.get("attributes", []),
            "image_path": f"images/item_{token_id}.png" if image_bytes else None
        })
        
        successful += 1
    
    print("-" * 60)
    print(f"\n✅ Successfully processed: {successful}/64")
    if failed > 0:
        print(f"❌ Failed: {failed}/64")
    
    # Create HTML gallery
    html_path = OUTPUT_DIR / "gallery.html"
    html_content = create_html_gallery(items_data)
    html_path.write_text(html_content)
    
    print(f"\n📁 Images saved to: {images_dir}")
    print(f"🌐 Gallery HTML: {html_path}")
    print(f"\nOpen {html_path} in your browser to view all items!")
    
    # Print summary
    print("\n=== Item Summary ===")
    for item in items_data[:10]:  # Show first 10
        print(f"#{item['id']}: {item['name']}")
    if len(items_data) > 10:
        print(f"... and {len(items_data) - 10} more")

if __name__ == "__main__":
    main()



