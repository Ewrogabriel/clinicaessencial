#!/usr/bin/env node

/**
 * Script para remover "as any" de forma segura
 * 
 * Este script procura por padrões comuns de "as any" e tenta removê-los
 * enquanto mantém a integridade do código.
 * 
 * Uso: node scripts/remove-as-any.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Padrões a remover
const patterns = [
  // Remover " as any" simples
  { regex: / as any(\))/g, replacement: '$1' },
  // Remover casts em parenteses (supabase.from(...) as any)
  { regex: /\(supabase\.from\((.*?)\) as any\)/g, replacement: 'supabase.from($1)' },
  // Remover casts em array access
  { regex: /(\w+)\s+as any\[/g, replacement: '$1[' },
  // Remover casts antes de propriedades com optional chaining
  { regex: /\(([\w.]+)\s+as any\)\?/g, replacement: '($1)?' },
];

let filesProcessed = 0;
let changesCount = 0;

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Aplicar cada padrão
    patterns.forEach(({ regex, replacement }) => {
      content = content.replace(regex, replacement);
    });
    
    // Se houve mudanças, salvar
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      const changes = (originalContent.match(/as any/g) || []).length - 
                     (content.match(/as any/g) || []).length;
      if (changes > 0) {
        console.log(`✓ ${filePath.replace(projectRoot, '')}: ${changes} removido(s)`);
        changesCount += changes;
      }
    }
    filesProcessed++;
  } catch (err) {
    console.error(`✗ Erro ao processar ${filePath}:`, err.message);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Ignorar node_modules, .git, etc
      if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(file)) {
        walkDir(filePath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      processFile(filePath);
    }
  });
}

console.log('🔍 Removendo "as any" do projeto...\n');
walkDir(path.join(projectRoot, 'src'));

console.log(`\n✨ Concluído!`);
console.log(`   Arquivos processados: ${filesProcessed}`);
console.log(`   "as any" removidos: ${changesCount}`);
