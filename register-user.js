const { execSync } = require('child_process');

console.log('🚀 Starting automated user registration process...\n');

try {
  // Paso 1: Verificar y corregir imports si es necesario
  console.log('🔧 Step 1: Checking and fixing imports...');
  try {
    require('./fix-imports.js');
  } catch (error) {
    console.log('⚠️  Import fix not needed or failed, continuing...');
  }
  
  // Paso 2: Ejecutar el script de registro
  console.log('👤 Step 2: Registering user...');
  execSync('npx hardhat run scripts/converter/03_register-user.ts --network fuji', { stdio: 'inherit' });
  
  console.log('\n🎉 User registration completed successfully!');
  console.log('You can now proceed with the next steps in the tutorial.');
  
} catch (error) {
  console.error('❌ Error during user registration:', error.message);
  console.log('\n💡 If you encounter import errors, try running: npm run zkit:setup');
  process.exit(1);
}
