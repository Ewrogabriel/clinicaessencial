#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('[v0] Iniciando verificação de build...');
console.log('[v0] Contando instâncias de "as any" restantes...');

try {
  // Count remaining "as any" instances
  const result = execSync(`grep -r " as any" src/ 2>/dev/null | wc -l`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'ignore']
  });
  
  const count = parseInt(result.trim());
  console.log(`[v0] Instâncias de "as any" encontradas: ${count}`);
  
  if (count === 0) {
    console.log('[v0] ✓ Nenhuma instância de "as any" encontrada!');
  }
  
} catch (e) {
  console.log('[v0] Erro ao verificar "as any":', e.message);
}

console.log('[v0] Verificação concluída!');
