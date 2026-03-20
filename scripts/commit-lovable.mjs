import { execSync } from "node:child_process";

const rawArgs = process.argv.slice(2);
const message = rawArgs.join(" ").trim();

if (!message) {
  console.error("Uso: npm run commit:lovable -- <mensagem>");
  process.exit(1);
}

const commitMessage = `lovable: ${message}`;

try {
  execSync("git add -A", { stdio: "inherit" });
  execSync(`git commit -m \"${commitMessage.replace(/\"/g, '\\\"')}\"`, {
    stdio: "inherit",
  });
  console.log(`Commit criado com sucesso: ${commitMessage}`);
} catch (error) {
  process.exit(1);
}
