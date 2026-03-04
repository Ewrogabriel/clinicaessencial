import { Button } from "@/components/ui/button";
import { Instagram } from "lucide-react";

interface InstagramButtonProps {
  username: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showLabel?: boolean;
}

export const InstagramButton = ({
  username,
  variant = "outline",
  size = "default",
  className = "",
  showLabel = true,
}: InstagramButtonProps) => {
  const handleInstagram = () => {
    // Remove @ se começar com it
    const cleanUsername = username.startsWith("@") ? username.slice(1) : username;
    const instagramLink = `https://instagram.com/${cleanUsername}`;
    window.open(instagramLink, "_blank");
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleInstagram}
      className={`gap-2 hover:text-pink-600 ${className}`}
      title={`Visitar Instagram: @${username}`}
    >
      <Instagram className="w-4 h-4" />
      {showLabel && size !== "icon" && "Instagram"}
    </Button>
  );
};
