#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

/**
 * Script to replace .select("*") with explicit column selections.
 * This improves performance and type-safety.
 *
 * Current replacements:
 * - clinicas: id, nome, cnpj, email, telefone, endereco, ativo, created_at
 * - clinic_subscriptions: id, clinic_id, plan_id, status, started_at, expires_at
 * - platform_plans: id, nome, valor_mensal, cor, ativo, created_at
 * - etc.
 */

const selectAllReplacements = {
  // Pattern: .select("*").from("clinicas")
  'select("*").order': 'select("id, nome, email, telefone, ativo, created_at").order',
  '.select("*").eq': '.select("id, nome, email, telefone, ativo, created_at").eq',
  '.select("*").where': '.select("id, nome, email, telefone, ativo, created_at").where',
  '.select("*")': '.select("id, nome, email, telefone, ativo, created_at")',
};

const columnsPerTable = {
  clinicas: 'id, nome, cnpj, email, telefone, endereco, numero, bairro, cidade, estado, cep, ativo, created_at, updated_at',
  profiles: 'id, user_id, nome, email, telefone, especialidade, registro_profissional, conselho_profissional, foto_url, created_at, updated_at',
  pacientes: 'id, clinic_id, user_id, nome, email, telefone, data_nascimento, cpf, ativo, created_at, updated_at',
  clinic_subscriptions: 'id, clinic_id, plan_id, status, started_at, expires_at, created_at, updated_at',
  platform_plans: 'id, nome, valor_mensal, cor, descricao, ativo, created_at',
  sessions: 'id, patient_id, professional_id, clinic_id, data, horario, duracao, status, created_at',
};

function getColumnsFor(tableName) {
  return columnsPerTable[tableName] || 'id, nome, email, created_at, updated_at';
}

function getTableNameFromContext(code, lineNum) {
  // Try to find from() call before or on current line
  const lines = code.split('\n');
  for (let i = Math.min(lineNum, lines.length - 1); i >= Math.max(0, lineNum - 10); i--) {
    const match = lines[i].match(/\.from\(['"]([^'"]+)['"]\)/);
    if (match) return match[1];
  }
  return null;
}

function cleanupSelectAll(content) {
  // Simple replacements - avoid select("*") without table context
  const lines = content.split('\n');
  return lines.map((line, idx) => {
    // Replace select("*") patterns
    if (line.includes('select("*")')) {
      const tableName = getTableNameFromContext(content, idx);
      if (tableName) {
        const cols = getColumnsFor(tableName);
        return line.replace(/\.select\("\*"\)/g, `.select("${cols}")`);
      }
    }
    return line;
  }).join('\n');
}

// Find and process files
const files = globSync('src/**/*.tsx', { cwd: projectRoot, absolute: true });

let processed = 0;
let modified = 0;

console.log(`Found ${files.length} .tsx files\n`);

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf-8');
    const original = content;

    // Apply cleanup
    content = cleanupSelectAll(content);

    if (content !== original) {
      fs.writeFileSync(file, content);
      modified++;
      const rel = path.relative(projectRoot, file);
      console.log(`✓ Modified: ${rel}`);
    }
    processed++;
  } catch (err) {
    console.error(`✗ Error processing ${file}:`, err.message);
  }
});

console.log(`\n─────────────────────────────────`);
console.log(`Processed: ${processed} files`);
console.log(`Modified: ${modified} files`);
console.log(`\nNote: Please review changes manually and add type-safe select() calls where needed.`);
