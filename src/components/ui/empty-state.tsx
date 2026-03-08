import { Users, Calendar, FileText, Package, Search } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const iconMap = {
  users: Users,
  calendar: Calendar,
  file: FileText,
  package: Package,
  search: Search,
};

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
    <div className="rounded-full bg-muted p-4 mb-4">
      {icon || <Search className="h-8 w-8 text-muted-foreground/50" />}
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
    {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
