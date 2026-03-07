#!/usr/bin/env python3
import os
import sys
from urllib.parse import urlparse, parse_qs

# Install psycopg2 if needed
try:
    import psycopg2
except ImportError:
    print("[v0] Installing psycopg2-binary...")
    os.system("pip install psycopg2-binary -q")
    import psycopg2

# Get database URL from environment
postgres_url = os.environ.get("POSTGRES_URL")

if not postgres_url:
    print("[v0] ERROR: POSTGRES_URL environment variable not set")
    sys.exit(1)

print(f"[v0] Original URL (first 50 chars): {postgres_url[:50]}...")

try:
    # Parse the URL to extract components
    # The URL might be in format: supabase://username:password@host:port/database?param=value
    parsed = urlparse(postgres_url)
    
    print(f"[v0] Parsed scheme: {parsed.scheme}")
    print(f"[v0] Parsed hostname: {parsed.hostname}")
    print(f"[v0] Parsed port: {parsed.port}")
    print(f"[v0] Parsed database: {parsed.path}")
    
    # Extract connection parameters
    host = parsed.hostname or 'localhost'
    port = parsed.port or 5432
    database = parsed.path.lstrip('/') if parsed.path else 'postgres'
    user = parsed.username or 'postgres'
    password = parsed.password or ''
    
    print(f"[v0] Connecting with: user={user}, host={host}, port={port}, database={database}")
    
    # Connect to database
    conn = psycopg2.connect(
        host=host,
        port=port,
        database=database,
        user=user,
        password=password,
        sslmode='require'  # Supabase requires SSL
    )
    
    cursor = conn.cursor()
    print("[v0] Successfully connected to database!")
    
    # Read and execute migration 1
    migration_1_path = "/vercel/share/v0-project/supabase/migrations/20250301_base_tables.sql"
    if os.path.exists(migration_1_path):
        print(f"[v0] Executing migration 1: {migration_1_path}")
        with open(migration_1_path, 'r') as f:
            sql_1 = f.read()
        cursor.execute(sql_1)
        conn.commit()
        print("[v0] Migration 1 completed successfully!")
    else:
        print(f"[v0] WARNING: Migration 1 file not found at {migration_1_path}")
    
    # Read and execute migration 2
    migration_2_path = "/vercel/share/v0-project/supabase/migrations/20250302_add_codigo_acesso.sql"
    if os.path.exists(migration_2_path):
        print(f"[v0] Executing migration 2: {migration_2_path}")
        with open(migration_2_path, 'r') as f:
            sql_2 = f.read()
        cursor.execute(sql_2)
        conn.commit()
        print("[v0] Migration 2 completed successfully!")
    else:
        print(f"[v0] WARNING: Migration 2 file not found at {migration_2_path}")
    
    cursor.close()
    conn.close()
    print("[v0] All migrations completed successfully!")
    
except Exception as e:
    print(f"[v0] Error: {type(e).__name__}: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
