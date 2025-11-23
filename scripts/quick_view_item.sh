#!/bin/bash
# Quick view a single item's image and metadata

ITEM_V1=${ITEM_V1:-0x9c4216d7b56a25b4b8a8eddefebaba389e05a01e}
RPC=${RPC:-https://apechain.calderachain.xyz/http}
ITEM_ID=${1:-0}

echo "=== Item #$ITEM_ID ==="
echo ""

# Get token URI
URI=$(cast call $ITEM_V1 "uri(uint256)(string)" $ITEM_ID --rpc-url $RPC 2>/dev/null | sed 's/^"//;s/"$//')

# Decode and show metadata
echo "Metadata:"
echo "$URI" | sed 's/data:application\/json;base64,//' | base64 -d | python3 -m json.tool

echo ""
echo "Extracting image..."

# Extract image
IMAGE_B64=$(echo "$URI" | sed 's/data:application\/json;base64,//' | base64 -d | python3 -c "import json, sys; data = json.load(sys.stdin); print(data.get('image', '').replace('data:image/png;base64,', ''))" 2>/dev/null)

if [ -n "$IMAGE_B64" ]; then
    echo "$IMAGE_B64" | base64 -d > "/tmp/item_${ITEM_ID}.png"
    echo "✅ Image saved to /tmp/item_${ITEM_ID}.png"
    echo ""
    echo "To view: open /tmp/item_${ITEM_ID}.png"
    
    # Try to open on macOS
    if command -v open > /dev/null; then
        open "/tmp/item_${ITEM_ID}.png"
    fi
else
    echo "❌ No image found"
fi
