import { supabase } from "@/integrations/supabase/client";

interface ClinicSettings {
  logo_url: string | null;
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  whatsapp: string | null;
  instagram: string | null;
}

let cachedSettings: ClinicSettings | null = null;

export async function getClinicSettings(): Promise<ClinicSettings> {
  if (cachedSettings) return cachedSettings;
  
  const { data } = await supabase
    .from("clinic_settings")
    .select("logo_url, nome, cnpj, endereco, numero, bairro, cidade, estado, whatsapp, instagram")
    .limit(1)
    .single();
  
  cachedSettings = data || {
    logo_url: null,
    nome: "Essencial Fisio Pilates",
    cnpj: "61.080.977/0001-50",
    endereco: "Rua Capitão Antônio Ferreira Campos",
    numero: "46",
    bairro: "Carmo",
    cidade: "Barbacena",
    estado: "MG",
    whatsapp: "(32) 98415-2802",
    instagram: "@essencialfisiopilatesbq",
  };
  
  return cachedSettings;
}

export function clearSettingsCache() {
  cachedSettings = null;
}

export async function addLogoToPDF(
  doc: any, 
  x: number, 
  y: number, 
  maxWidth: number = 30,
  maxHeight: number = 20
): Promise<number> {
  const settings = await getClinicSettings();
  
  if (!settings.logo_url) {
    return y;
  }
  
  try {
    const response = await fetch(settings.logo_url);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);
    
    // Determine format from blob type
    const format = blob.type.includes("png") ? "PNG" : "JPEG";
    
    // Add image centered
    const img = new Image();
    img.src = base64;
    
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
    
    // Calculate dimensions maintaining aspect ratio
    let width = maxWidth;
    let height = (img.height / img.width) * width;
    
    if (height > maxHeight) {
      height = maxHeight;
      width = (img.width / img.height) * height;
    }
    
    doc.addImage(base64, format, x, y, width, height);
    
    return y + height + 4;
  } catch (error) {
    console.error("Error adding logo to PDF:", error);
    return y;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function formatClinicAddress(settings: ClinicSettings): string {
  const parts = [];
  if (settings.endereco) {
    let addr = settings.endereco;
    if (settings.numero) addr += `, nº ${settings.numero}`;
    if (settings.bairro) addr += ` – ${settings.bairro}`;
    if (settings.cidade && settings.estado) addr += ` – ${settings.cidade}/${settings.estado}`;
    parts.push(addr);
  }
  return parts.join("");
}
