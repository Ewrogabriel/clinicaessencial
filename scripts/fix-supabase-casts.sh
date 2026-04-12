#!/bin/bash

# Script para remover casts "as any" dos supabase queries
# Uso: bash scripts/fix-supabase-casts.sh

echo "🔍 Removendo supabase(...) as any casts..."

# Remover padrões específicos de supabase
find src -name "*.tsx" -o -name "*.ts" | while read file; do
  # Remover (supabase.from(...) as any)
  sed -i 's/(supabase\.from(/supabase.from(/g' "$file"
  sed -i 's/) as any)/)/' "$file" 2>/dev/null || true
  sed -i 's/as any//g' "$file"
done

echo "✅ Refatoração completa!"
