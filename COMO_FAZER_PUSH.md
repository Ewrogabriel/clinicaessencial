# Como Fazer Push para GitHub no v0

## Opção 1: Via Interface do v0 (MAIS FÁCIL)

1. No canto **inferior esquerdo** da tela do v0, procure por um ícone de **"Código"** ou **"Git"**
2. Você verá uma lista de arquivos modificados
3. Clique em **"Commit & Push"** ou **"Create Pull Request"**
4. Escreva uma mensagem: `fix: Corrigir conflito de gerenciador de pacotes (bun vs npm)`
5. Clique em **Push**

## Opção 2: Via GitHub Web (Se v0 não funcionar)

1. Vá para **github.com/Ewrogabriel/app-essencial**
2. Clique no ícone de **GitHub Desktop** ou em **Code**
3. Clone a branch `sistema-de-agendamento-aprimorado`
4. Faça as mudanças no seu computador
5. Commit e push

## Opção 3: Via Git (Se tiver terminal)

```bash
cd seu-projeto
git add .npmrc .gitignore .gitattributes .nvmrc
git commit -m "fix: Resolver conflito de gerenciador de pacotes"
git push origin sistema-de-agendamento-aprimorado
```

## Arquivos que foram alterados:

- `.npmrc` - Configuração para npm
- `.gitignore` - Adicionado lock files
- `.gitattributes` - Ignorar lock files do git
- `.nvmrc` - Versão do Node
- Imports corrigidos (Indicadores, HistoricoSessoes, Aniversariantes)

Após fazer push, o Vercel fará deploy automaticamente!
