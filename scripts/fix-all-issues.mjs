#!/usr/bin/env node
/**
 * Script para corrigir automaticamente todos os problemas identificados:
 * 1. Remove (supabase.from(...) as any) patterns
 * 2. Mantém type safety onde possível
 * 
 * Uso: node scripts/fix-all-issues.mjs
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, extname } from 'path';

const SRC_DIR = './src';
const EXTENSIONS = ['.ts', '.tsx'];

// Patterns to fix
const PATTERNS = [
  // Remove (supabase.from("table") as any) -> supabase.from("table")
  {
    pattern: /\(supabase\.from\(([^)]+)\)\s*as\s*any\)/g,
    replacement: 'supabase.from($1)'
  },
  // Remove (supabase.from("table").select() as any) -> supabase.from("table").select()
  {
    pattern: /\(supabase\.from\(([^)]+)\)\.([^)]+)\)\s*as\s*any\)/g,
    replacement: 'supabase.from($1).$2)'
  },
  // Remove await (supabase... as any) -> await supabase...
  {
    pattern: /await\s*\(supabase\.from\(([^)]+)\)\s*as\s*any\)/g,
    replacement: 'await supabase.from($1)'
  }
];

let totalFilesProcessed = 0;
let totalFilesModified = 0;
let totalReplacements = 0;

async function processFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    let newContent = content;
    let fileReplacements = 0;

    for (const { pattern, replacement } of PATTERNS) {
      const matches = newContent.match(pattern);
      if (matches) {
        fileReplacements += matches.length;
        newContent = newContent.replace(pattern, replacement);
      }
    }

    if (newContent !== content) {
      await writeFile(filePath, newContent, 'utf-8');
      totalFilesModified++;
      totalReplacements += fileReplacements;
      console.log(`  [FIXED] ${filePath} (${fileReplacements} replacements)`);
    }

    totalFilesProcessed++;
  } catch (error) {
    console.error(`  [ERROR] ${filePath}: ${error.message}`);
  }
}

async function walkDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules, .git, etc
      if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
        await walkDir(fullPath);
      }
    } else if (entry.isFile() && EXTENSIONS.includes(extname(entry.name))) {
      await processFile(fullPath);
    }
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('  ESSENCIAL CLINICAS - AUTO FIX SCRIPT');
  console.log('='.repeat(60));
  console.log('');
  console.log('Processing files in:', SRC_DIR);
  console.log('');

  const startTime = Date.now();
  await walkDir(SRC_DIR);
  const endTime = Date.now();

  console.log('');
  console.log('='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Files processed: ${totalFilesProcessed}`);
  console.log(`  Files modified:  ${totalFilesModified}`);
  console.log(`  Total fixes:     ${totalReplacements}`);
  console.log(`  Time elapsed:    ${(endTime - startTime) / 1000}s`);
  console.log('='.repeat(60));
}

main().catch(console.error);
