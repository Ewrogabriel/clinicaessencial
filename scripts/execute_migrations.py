#!/usr/bin/env python3
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import psycopg2
    from psycopg2 import sql
except ImportError:
    print("[v0] Installing psycopg2...")
    os.system("uv pip install psycopg2-binary")
    import psycopg2
    from psycopg2 import sql

# Get database URL from environment
postgres_url = os.environ.get("POSTGRES_URL") or os.environ.get("POSTGRES_URL_NON_POOLING")

if not postgres_url:
    print("[v0] ERROR: POSTGRES_URL environment variable not set")
    sys.exit(1)

migrations_dir = Path(__file__).parent.parent / "supabase" / "migrations"

if not migrations_dir.exists():
    print(f"[v0] ERROR: Migrations directory not found at {migrations_dir}")
    sys.exit(1)

migration_files = sorted([f for f in migrations_dir.glob("*.sql")])

if not migration_files:
    print("[v0] No migration files found")
    sys.exit(0)

print(f"[v0] Found {len(migration_files)} migrations to execute")

try:
    conn = psycopg2.connect(postgres_url)
    cursor = conn.cursor()
    
    for migration_file in migration_files:
        print(f"[v0] Executing: {migration_file.name}")
        with open(migration_file, 'r') as f:
            sql_content = f.read()
        
        try:
            cursor.execute(sql_content)
            conn.commit()
            print(f"[v0] ✓ Executed: {migration_file.name}")
        except Exception as e:
            conn.rollback()
            print(f"[v0] ✗ Error executing {migration_file.name}: {str(e)}")
            # Continue with next migration on error
    
    cursor.close()
    conn.close()
    print("[v0] All migrations completed")
    
except Exception as e:
    print(f"[v0] Database connection error: {str(e)}")
    sys.exit(1)
