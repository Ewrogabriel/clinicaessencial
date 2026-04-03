import { supabase } from "@/integrations/supabase/client";

/**
 * Uploads a receipt PDF blob to public storage and returns the public URL.
 */
export async function uploadReceiptToStorage(
  blob: Blob,
  receiptNumber: string
): Promise<string> {
  const fileName = `recibos/${receiptNumber}_${Date.now()}.pdf`;

  const { error } = await supabase.storage
    .from("clinic-uploads")
    .upload(fileName, blob, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) throw new Error(`Falha ao enviar recibo: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from("clinic-uploads")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}
