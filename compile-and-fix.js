const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting compilation and import fix process...\n');

try {
  // Paso 1: Compilar los circuitos
  console.log('📦 Step 1: Compiling circuits...');
  execSync('npx hardhat zkit compile', { stdio: 'inherit' });
  console.log('✅ Circuits compiled successfully!\n');
  
  // Paso 2: Ejecutar setup si es necesario
  console.log('🔧 Step 2: Setting up circuit keys...');
  execSync('npx hardhat zkit setup', { stdio: 'inherit' });
  console.log('✅ Circuit keys setup completed!\n');
  
  // Paso 3: Corregir imports
  console.log('🔧 Step 3: Fixing import paths...');
  require('./fix-imports.js');
  console.log('✅ Import fixes completed!\n');
  
  console.log('🎉 All steps completed successfully!');
  console.log('You can now run your scripts without import errors.');
  
} catch (error) {
  console.error('❌ Error during compilation and fix process:', error.message);
  process.exit(1);
}
