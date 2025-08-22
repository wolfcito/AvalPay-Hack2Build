const { execSync } = require('child_process');

console.log('🚀 Starting automated auditor setup process...\n');

try {
  // Paso 1: Verificar y corregir imports si es necesario
  console.log('🔧 Step 1: Checking and fixing imports...');
  try {
    require('./fix-imports.js');
  } catch (error) {
    console.log('⚠️  Import fix not needed or failed, continuing...');
  }
  
  // Paso 2: Ejecutar el script de configuración del auditor
  console.log('👤 Step 2: Setting up auditor...');
  execSync('npx hardhat run scripts/converter/04_set-auditor.ts --network fuji', { stdio: 'inherit' });
  
  console.log('\n🎉 Auditor setup completed successfully!');
  console.log('You can now proceed with the next steps in the tutorial.');
  
} catch (error) {
  console.error('❌ Error during auditor setup:', error.message);
  console.log('\n💡 If you encounter import errors, try running: npm run zkit:setup');
  process.exit(1);
}
