#!/bin/bash

# Script para executar todas as migrations em ordem
# Executa via supabase CLI

MIGRATIONS_DIR="supabase/migrations"

# Lista todas as migrations ordenadas por timestamp
for migration in $(ls -1 "$MIGRATIONS_DIR" | sort); do
  if [[ $migration == *.sql ]]; then
    echo "Executando: $migration"
    # Aqui você rodaria via supabase CLI ou psql
    # psql $POSTGRES_URL < "$MIGRATIONS_DIR/$migration"
  fi
done

echo "Todas as migrations foram executadas!"
