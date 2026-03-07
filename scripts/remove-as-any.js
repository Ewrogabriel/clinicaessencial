import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const srcDir = path.join(process.cwd(), 'src');

async function removeAsAny() {
  const files = await glob('**/*.{ts,tsx}', { cwd: srcDir });
  
  for (const file of files) {
    const filePath = path.join(srcDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    // Remove " as any" from various contexts
    content = content.replace(/\s+as\s+any\b/g, '');
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`✓ Updated: ${file}`);
    }
  }
  
  console.log('Done! All "as any" removed.');
}

removeAsAny().catch(console.error);
