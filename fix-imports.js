const fs = require('fs');
const path = require('path');

// Función para corregir imports en un archivo
function fixImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Buscar y reemplazar imports con rutas incorrectas usando barras invertidas
    const importRegex = /from\s+["']([^"']*\\([^"']*))["']/g;
    const matches = content.match(importRegex);
    
    if (matches) {
      content = content.replace(importRegex, (match, fullPath) => {
        // Convertir barras invertidas a barras normales
        const correctedPath = fullPath.replace(/\\/g, '/');
        return match.replace(fullPath, correctedPath);
      });
      modified = true;
    }
    
    // Buscar específicamente el patrón problemático '..helpers'
    if (content.includes('..\\helpers')) {
      content = content.replace(/\.\.\\helpers/g, '../helpers');
      modified = true;
    }
    
    // Buscar también el patrón sin barra final
    if (content.includes('..helpers')) {
      content = content.replace(/\.\.helpers/g, '../helpers');
      modified = true;
    }
    
    // Buscar otros patrones problemáticos comunes
    const problematicPatterns = [
      { from: /\.\.\\/g, to: '../' },
      { from: /\.\.\\\.\./g, to: '../../' },
      { from: /\.\.\\\.\.\\/g, to: '../../' }
    ];
    
    problematicPatterns.forEach(pattern => {
      if (content.match(pattern.from)) {
        content = content.replace(pattern.from, pattern.to);
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed imports in: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error fixing imports in ${filePath}:`, error.message);
  }
}

// Función recursiva para procesar directorios
function processDirectory(dirPath) {
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        processDirectory(fullPath);
      } else if (item.endsWith('.ts') || item.endsWith('.js')) {
        fixImportsInFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`❌ Error processing directory ${dirPath}:`, error.message);
  }
}

// Directorio principal a procesar
const targetDir = './generated-types/zkit';

console.log('🔧 Starting import path fixes...');
console.log(`📁 Processing directory: ${targetDir}`);

if (fs.existsSync(targetDir)) {
  processDirectory(targetDir);
  console.log('✅ Import fixes completed!');
} else {
  console.log('❌ Target directory not found. Make sure to run zkit compile first.');
}
