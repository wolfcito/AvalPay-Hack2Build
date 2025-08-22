const { execSync } = require('child_process');

console.log('🚀 Starting automated registration for both users...\n');

try {
  // Paso 1: Verificar y corregir imports si es necesario
  console.log('🔧 Step 1: Checking and fixing imports...');
  try {
    require('./fix-imports.js');
  } catch (error) {
    console.log('⚠️  Import fix not needed or failed, continuing...');
  }
  
  // Paso 2: Registrar wallet 1
  console.log('👤 Step 2: Registering wallet 1...');
  execSync('npx hardhat run scripts/converter/03_register-user.ts --network fuji', { stdio: 'inherit' });
  
  // Paso 3: Cambiar a wallet 2 y registrar
  console.log('\n👤 Step 3: Registering wallet 2...');
  // Modificar temporalmente el script para usar wallet 2
  const fs = require('fs');
  const scriptPath = './scripts/converter/03_register-user.ts';
  let scriptContent = fs.readFileSync(scriptPath, 'utf8');
  
  // Cambiar WALLET_NUMBER a 2
  scriptContent = scriptContent.replace(/const WALLET_NUMBER = 1;/, 'const WALLET_NUMBER = 2;');
  fs.writeFileSync(scriptPath, scriptContent);
  
  // Ejecutar el script modificado
  execSync('npx hardhat run scripts/converter/03_register-user.ts --network fuji', { stdio: 'inherit' });
  
  // Restaurar el script original
  scriptContent = scriptContent.replace(/const WALLET_NUMBER = 2;/, 'const WALLET_NUMBER = 1;');
  fs.writeFileSync(scriptPath, scriptContent);
  
  console.log('\n🎉 Both users registered successfully!');
  console.log('You can now proceed with deposits and transfers.');
  
} catch (error) {
  console.error('❌ Error during user registration:', error.message);
  console.log('\n💡 If you encounter import errors, try running: npm run zkit:setup');
  process.exit(1);
}
