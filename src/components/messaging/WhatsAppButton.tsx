import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

interface WhatsAppButtonProps {
  phoneNumber?: string;
  message?: string;
  profissionalNome?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export const WhatsAppButton = ({
  phoneNumber,
  message = "Olá! Gostaria de entrar em contato.",
  profissionalNome = "Profissional",
  variant = "default",
  size = "default",
  className = "",
}: WhatsAppButtonProps) => {
  const handleWhatsApp = () => {
    // Formato: +55 11 99999-9999 ou 11 99999-9999
    let formattedPhone = phoneNumber || "";
    
    // Remove caracteres especiais
    formattedPhone = formattedPhone.replace(/\D/g, "");
    
    // Adiciona código de país se não tiver
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = "55" + formattedPhone;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappLink = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    
    window.open(whatsappLink, "_blank");
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleWhatsApp}
      className={`gap-2 ${className}`}
      title={`Enviar mensagem para ${profissionalNome}`}
    >
      <MessageCircle className="w-4 h-4" />
      {size !== "icon" && "WhatsApp"}
    </Button>
  );
};
