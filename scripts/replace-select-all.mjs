#!/usr/bin/env node

/**
 * Script para substituir select("*") por colunas explícitas
 * 
 * Uso: node scripts/replace-select-all.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Mapa de tabelas e suas colunas
const COLUMN_MAPS = {
  'clinicas': 'id,nome,cnpj,email,telefone,whatsapp,endereco,numero,bairro,cidade,estado,cep,instagram,ativo,created_at,updated_at',
  'pacientes': 'id,nome,cpf,email,data_nascimento,genero,telefone,celular,endereco,numero,complemento,bairro,cidade,estado,cep,profissao,estado_civil,mae_nome,referencia_como_chegou,ativo,clinic_id,created_at,updated_at',
  'profissionais': 'id,nome,cpf,email,telefone,especialidade,numero_conselho,conselho_profissional,registro_conselho,ativo,clinic_id,created_at,updated_at',
  'agendamentos': 'id,paciente_id,profissional_id,clinic_id,data_horario,duracao_minutos,tipo_sessao,tipo_atendimento,status,confirmacao_presenca,checkin_paciente,checkin_profissional,observacoes,enrollment_id,valor_sessao,valor_mensal,forma_pagamento,data_vencimento,recorrente,recorrencia_fim,recorrencia_grupo_id,dias_semana,frequencia_semanal,confirmacao_enviada_at,confirmacao_respondida_at,checkin_paciente_at,checkin_profissional_at,created_at,updated_at,created_by',
  'matriculas': 'id,paciente_id,clinic_id,data_inicio,data_fim,tipo_sessao,tipo_atendimento,valor_mensal,status,ativo,observacoes,data_termino,created_at,updated_at',
  'pagamentos_mensalidade': 'id,matricula_id,paciente_id,clinic_id,valor,mes_referencia,status,data_pagamento,forma_pagamento_id,observacoes,created_at,updated_at',
  'weekly_schedules': 'id,enrollment_id,weekday,time,professional_id,session_duration,created_at,updated_at',
  'sessoes': 'id,enrollment_id,paciente_id,profissional_id,clinic_id,data_horario,duracao_minutos,status,comparecimento,created_at,updated_at',
  'clinic_subscriptions': 'id,clinic_id,plan_id,status,data_vencimento,responsavel_nome,responsavel_email,responsavel_telefone,observacoes,created_at,updated_at',
  'platform_plans': 'id,nome,descricao,valor_mensal,recursos_disponiveis,ativo,cor,created_at,updated_at',
  'bloqueios_profissional': 'id,profissional_id,data,hora_inicio,hora_fim,dia_inteiro,motivo,clinic_id,created_at,updated_at',
  'agenda_extra': 'id,profissional_id,data,hora_inicio,hora_fim,max_pacientes,motivo,clinic_id,created_at,updated_at',
  'disponibilidade_profissional': 'id,profissional_id,dia_semana,hora_inicio,hora_fim,intervalo_minutos,max_pacientes,clinic_id,created_at,updated_at',
  'feriados': 'id,data,descricao,clinic_id,created_at,updated_at',
  'clinic_groups': 'id,nome,descricao,clinic_id,created_at,updated_at',
  'clinic_group_members': 'id,group_id,clinic_id,cross_booking_enabled,created_at,updated_at',
};

let filesProcessed = 0;
let replacementsCount = 0;

function replaceSelectAll(content, filePath) {
  let updatedContent = content;
  let count = 0;

  // Padrão: .select("*")
  const patterns = [
    /.select\("?\*"?\)/g,  // .select("*") ou .select(*)
  ];

  // Para cada padrão encontrado
  updatedContent = updatedContent.replace(/\.from\("([^"]+)"\)\.select\("?\*"?\)/g, (match, tableName) => {
    const columns = COLUMN_MAPS[tableName];
    if (columns) {
      count++;
      return `.from("${tableName}").select("${columns}")`;
    }
    return match; // Se tabela não encontrada, deixar como está
  });

  // Padrão alternativo com backticks
  updatedContent = updatedContent.replace(/\.from\(`([^`]+)`\)\.select\("?\*"?\)/g, (match, tableName) => {
    const columns = COLUMN_MAPS[tableName];
    if (columns) {
      count++;
      return `.from(\`${tableName}\`).select("${columns}")`;
    }
    return match;
  });

  if (count > 0) {
    console.log(`✓ ${filePath.replace(projectRoot, '')}: ${count} select(*) substituído(s)`);
    replacementsCount += count;
  }

  return updatedContent;
}

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const newContent = replaceSelectAll(content, filePath);

    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf8');
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
      if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(file)) {
        walkDir(filePath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      processFile(filePath);
    }
  });
}

console.log('🔍 Substituindo select("*") por colunas explícitas...\n');
walkDir(path.join(projectRoot, 'src'));

console.log(`\n✨ Concluído!`);
console.log(`   Arquivos processados: ${filesProcessed}`);
console.log(`   select(*) substituídos: ${replacementsCount}`);
