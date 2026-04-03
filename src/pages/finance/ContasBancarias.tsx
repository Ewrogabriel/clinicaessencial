import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Landmark, Pencil, Trash2 } from "lucide-react";
import { useBankAccounts } from "@/modules/finance/hooks/useBankAccounts";
import { BankAccountDialog } from "@/components/financial/BankAccountDialog";
import { toast } from "@/modules/shared/hooks/use-toast";
import type { BankAccount } from "@/modules/finance/types";

export default function ContasBancarias() {
  const { accounts, isLoading, deleteAccount, isDeleting } = useBankAccounts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<BankAccount | undefined>(
    undefined
  );

  const handleEdit = (account: BankAccount) => {
    setEditAccount(account);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditAccount(undefined);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAccount(id);
      toast({ title: "✓ Conta bancária removida" });
    } catch {
      toast({ title: "Erro ao remover conta", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contas Bancárias</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas contas bancárias cadastradas
          </p>
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Conta
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Contas Cadastradas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma conta bancária cadastrada. Clique em &quot;Nova Conta&quot; para
              começar.
            </div>
          ) : (
            <div className="divide-y">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Landmark className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {account.apelido ?? account.banco_nome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {account.banco_nome}
                        {account.agencia ? ` • Ag. ${account.agencia}` : ""}
                        {account.conta ? ` • Cc. ${account.conta}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={account.ativo ? "default" : "secondary"}>
                      {account.ativo ? "Ativa" : "Inativa"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(account)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(account.id)}
                      disabled={isDeleting}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <BankAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editAccount}
      />
    </div>
  );
}
