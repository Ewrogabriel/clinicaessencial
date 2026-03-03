#!/bin/bash

# Remove bun lock file
rm -f bun.lockb

# Remove pnpm lock file  
rm -f pnpm-lock.yaml

# Create .npmrc to force npm
cat > .npmrc << EOF
engine-strict=false
strict-peer-dependencies=false
EOF

echo "Cleanup complete - Project configured to use npm"
