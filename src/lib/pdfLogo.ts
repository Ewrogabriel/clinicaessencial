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
  email: string | null;
  telefone: string | null;
}

let cachedSettings: ClinicSettings | null = null;

export async function getClinicSettings(): Promise<ClinicSettings> {
  if (cachedSettings) return cachedSettings;
  
  const { data } = await supabase
    .from("clinic_settings")
    .select("logo_url, nome, cnpj, endereco, numero, bairro, cidade, estado, whatsapp, instagram, email, telefone")
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
    email: null,
    telefone: null,
  };
  
  return cachedSettings;
}

export function clearSettingsCache() {
  cachedSettings = null;
}

// Cache logo base64 to avoid refetching
let cachedLogoBase64: string | null = null;
let cachedLogoFormat: string = "PNG";

async function loadLogoBase64(logoUrl: string): Promise<{ base64: string; format: string } | null> {
  if (cachedLogoBase64) return { base64: cachedLogoBase64, format: cachedLogoFormat };
  try {
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);
    const format = blob.type.includes("png") ? "PNG" : "JPEG";
    cachedLogoBase64 = base64;
    cachedLogoFormat = format;
    return { base64, format };
  } catch {
    return null;
  }
}

/**
 * Adds a full-page watermark with clinic logo and contact info to every page.
 * Call AFTER all content has been added to the document.
 */
export async function addWatermarkToAllPages(doc: any): Promise<void> {
  const settings = await getClinicSettings();
  const pageCount = doc.getNumberOfPages();
  
  let logoData: { base64: string; format: string } | null = null;
  if (settings.logo_url) {
    logoData = await loadLogoBase64(settings.logo_url);
  }

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Save current state
    doc.saveGraphicsState();

    // Draw logo as centered watermark with low opacity
    if (logoData) {
      try {
        const img = new Image();
        img.src = logoData.base64;
        await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });

        // Size: ~60% of page width, maintain aspect ratio
        const maxW = pageWidth * 0.55;
        let w = maxW;
        let h = (img.height / img.width) * w;
        if (h > pageHeight * 0.4) {
          h = pageHeight * 0.4;
          w = (img.width / img.height) * h;
        }

        const x = (pageWidth - w) / 2;
        const y = (pageHeight - h) / 2 - 15;

        // Set very low opacity for watermark
        doc.setGState(new doc.GState({ opacity: 0.06 }));
        doc.addImage(logoData.base64, logoData.format, x, y, w, h);
      } catch (err) {
        console.error("Watermark logo error:", err);
      }
    }

    // Contact info at bottom with low opacity
    doc.setGState(new doc.GState({ opacity: 0.15 }));
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);

    const contactParts: string[] = [];
    if (settings.nome) contactParts.push(settings.nome);
    if (settings.cnpj) contactParts.push(`CNPJ: ${settings.cnpj}`);
    const contactLine1 = contactParts.join(" • ");

    const contactParts2: string[] = [];
    if (settings.email) contactParts2.push(settings.email);
    if (settings.telefone) contactParts2.push(settings.telefone);
    if (settings.whatsapp) contactParts2.push(`WhatsApp: ${settings.whatsapp}`);
    if (settings.instagram) contactParts2.push(settings.instagram);
    const contactLine2 = contactParts2.join(" • ");

    const addrLine = formatClinicAddress(settings);

    const bottomY = pageHeight - 8;
    if (contactLine1) doc.text(contactLine1, pageWidth / 2, bottomY - 8, { align: "center" });
    if (addrLine) doc.text(addrLine, pageWidth / 2, bottomY - 4, { align: "center" });
    if (contactLine2) doc.text(contactLine2, pageWidth / 2, bottomY, { align: "center" });

    // Restore state
    doc.restoreGraphicsState();
    doc.setTextColor(0, 0, 0);
  }
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
    const logoData = await loadLogoBase64(settings.logo_url);
    if (!logoData) return y;
    
    const img = new Image();
    img.src = logoData.base64;
    
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
    
    let width = maxWidth;
    let height = (img.height / img.width) * width;
    
    if (height > maxHeight) {
      height = maxHeight;
      width = (img.width / img.height) * height;
    }
    
    doc.addImage(logoData.base64, logoData.format, x, y, width, height);
    
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