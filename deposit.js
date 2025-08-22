const { execSync } = require('child_process');

console.log('🚀 Starting automated deposit process...\n');

try {
  // Paso 1: Verificar y corregir imports si es necesario
  console.log('🔧 Step 1: Checking and fixing imports...');
  try {
    require('./fix-imports.js');
  } catch (error) {
    console.log('⚠️  Import fix not needed or failed, continuing...');
  }
  
  // Paso 2: Ejecutar el script de depósito
  console.log('💰 Step 2: Making deposit...');
  execSync('npx hardhat run scripts/converter/06_deposit.ts --network fuji', { stdio: 'inherit' });
  
  console.log('\n🎉 Deposit completed successfully!');
  console.log('You can now proceed with transfers and balance checks.');
  
} catch (error) {
  console.error('❌ Error during deposit:', error.message);
  console.log('\n💡 If you encounter import errors, try running: npm run zkit:setup');
  process.exit(1);
}
