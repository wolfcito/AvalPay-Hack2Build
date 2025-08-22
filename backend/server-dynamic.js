const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Cache para setup ZK
let zkSetupCompleted = false;
let zkSetupPromise = null;

// Cache para verificación de registro
const registrationCache = new Map();
const balanceCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
const BALANCE_CACHE_DURATION = 2 * 60 * 1000; // 2 minutos (balance cambia más frecuentemente)

// Middleware
app.use(cors());
app.use(express.json());

// Función para ejecutar setup ZK solo una vez
const ensureZKSetup = () => {
  if (zkSetupCompleted) {
    return Promise.resolve();
  }
  
  if (zkSetupPromise) {
    return zkSetupPromise;
  }
  
  zkSetupPromise = new Promise((resolve, reject) => {
    console.log('🔧 Ejecutando setup de ZK (primera vez)...');
    exec('npm run zkit:setup', { 
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    }, (error) => {
      if (error) {
        console.error('Error en setup ZK:', error);
        reject(error);
        return;
      }
      console.log('✅ Setup ZK completado y cacheado');
      zkSetupCompleted = true;
      resolve();
    });
  });
  
  return zkSetupPromise;
};

// Función para modificar temporalmente un script con datos del usuario
const modifyScriptForUser = (scriptPath, userData) => {
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');
  let modifiedContent = scriptContent;
  
  // Para scripts que usan getWallet(WALLET_NUMBER), reemplazar con búsqueda por dirección
  if (scriptPath.includes('03_register-user.ts') || scriptPath.includes('08_check_balance.ts') || scriptPath.includes('06_deposit.ts') || scriptPath.includes('09_withdraw.ts') || scriptPath.includes('05_get_faucet.ts')) {
    // Reemplazar la línea de WALLET_NUMBER con USER_ADDRESS
    modifiedContent = modifiedContent.replace(
      /const WALLET_NUMBER = \d+;/,
      `const USER_ADDRESS = "${userData.address}";`
    );
    
    // Reemplazar getWallet(WALLET_NUMBER) con búsqueda por dirección
    modifiedContent = modifiedContent.replace(
      /const wallet = await getWallet\(WALLET_NUMBER\);/,
      `const signers = await ethers.getSigners();
    const wallet = signers.find(signer => signer.address.toLowerCase() === USER_ADDRESS.toLowerCase()) || signers[0];`
    );
    
    // Reemplazar userAddress = await wallet.getAddress() con userAddress = USER_ADDRESS
    modifiedContent = modifiedContent.replace(
      /const userAddress = await wallet\.getAddress\(\);/,
      `const userAddress = USER_ADDRESS;`
    );
  } else if (scriptPath.includes('07_transfer.ts')) {
    // Caso especial para el script de transferencia que usa ethers.getSigners() directamente
    modifiedContent = modifiedContent.replace(
      /const \[wallet, wallet2 \] = await ethers\.getSigners\(\);/,
      `const signers = await ethers.getSigners();
    const wallet = signers.find(signer => signer.address.toLowerCase() === "${userData.address}".toLowerCase()) || signers[0];
    const wallet2 = signers[1] || signers[0];`
    );
    
    // Reemplazar senderAddress = await wallet.getAddress() con senderAddress = USER_ADDRESS
    modifiedContent = modifiedContent.replace(
      /const senderAddress = await wallet\.getAddress\(\);/,
      `const senderAddress = "${userData.address}";`
    );
    
    // Reemplazar montos fijos si se proporcionan
    if (userData.amount) {
      modifiedContent = modifiedContent.replace(
        /const transferAmountStr = "[^"]*";/,
        `const transferAmountStr = "${userData.amount}";`
      );
    }
  } else {
    // Para otros scripts, usar el enfoque original
    modifiedContent = modifiedContent.replace(
      /const WALLET_NUMBER = \d+;/,
      `const USER_ADDRESS = "${userData.address}";`
    );
    
    // Reemplazar montos fijos si se proporcionan
    if (userData.amount) {
      modifiedContent = modifiedContent.replace(
        /const depositAmountStr = "[^"]*";/,
        `const depositAmountStr = "${userData.amount}";`
      );
      modifiedContent = modifiedContent.replace(
        /const withdrawAmountStr = "[^"]*";/,
        `const withdrawAmountStr = "${userData.amount}";`
      );
      modifiedContent = modifiedContent.replace(
        /const transferAmountStr = "[^"]*";/,
        `const transferAmountStr = "${userData.amount}";`
      );
    }
    
    // Reemplazar getWallet() con ethers.getSigner()
    modifiedContent = modifiedContent.replace(
      /const wallet = await getWallet\(WALLET_NUMBER\);/g,
      `const wallet = await ethers.getSigner();`
    );
    modifiedContent = modifiedContent.replace(
      /const wallet = await getWallet\(USER_WALLET_NUMBER\);/g,
      `const wallet = await ethers.getSigner();`
    );
    modifiedContent = modifiedContent.replace(
      /const owner = await getWallet\(OWNER_WALLET_NUMBER\);/g,
      `const owner = await ethers.getSigner();`
    );
  }
  
  // Crear archivo temporal
  const tempPath = scriptPath.replace('.ts', '_temp.ts');
  fs.writeFileSync(tempPath, modifiedContent);
  
  return tempPath;
};

// Función para restaurar script original
const restoreScript = (tempPath) => {
  if (fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
  }
};

// Función para ejecutar comandos de hardhat con setup automático
const runHardhatCommand = async (scriptPath, userData) => {
  // Asegurar que el setup ZK esté completado (usando cache)
  await ensureZKSetup();
  
  return new Promise((resolve, reject) => {
    const scriptCommand = `npx hardhat run ${scriptPath} --network fuji`;
    
    console.log('🚀 Ejecutando script:', scriptPath);
    exec(scriptCommand, { 
      cwd: path.join(__dirname, '..'),
      env: { 
        ...process.env,
        USER_ADDRESS: userData.address 
      }
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('Error:', error);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.error('Stderr:', stderr);
      }
      
      console.log('Stdout:', stdout);
      resolve(stdout);
    });
  });
};

// API Endpoints

// Verificar registro
app.post('/api/check-registration', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ 
        success: false, 
        message: '❌ Dirección requerida' 
      });
    }

    // Verificar cache primero
    const cacheKey = `registration_${address.toLowerCase()}`;
    const cached = registrationCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log('📋 Usando cache para verificación de registro:', address);
      return res.json(cached.data);
    }

    console.log('Verificando registro para:', address);
    
    // Modificar script de verificación de balance para verificar registro
    const scriptPath = path.join(__dirname, '../scripts/converter/08_check_balance.ts');
    const tempPath = modifyScriptForUser(scriptPath, { address });
    
    try {
      const output = await runHardhatCommand(tempPath, { address });
      
      // Verificar si el usuario está registrado basado en el output
      const isRegistered = !output.includes('User is not registered') && 
                          !output.includes('User not registered');
      
      const result = {
        success: true,
        isRegistered,
        message: isRegistered ? 
          '✅ Usuario registrado' : 
          '❌ Usuario no registrado'
      };
      
      // Guardar en cache
      registrationCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      res.json(result);
      
    } finally {
      restoreScript(tempPath);
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Error al verificar registro: ' + error.message
    });
  }
});

// Registrar usuario
app.post('/api/register-user', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ 
        success: false, 
        message: '❌ Dirección requerida' 
      });
    }

    console.log('Registrando usuario:', address);
    
    // Modificar script de registro
    const scriptPath = path.join(__dirname, '../scripts/converter/03_register-user.ts');
    const tempPath = modifyScriptForUser(scriptPath, { address });
    
    try {
      const output = await runHardhatCommand(tempPath, { address });
      
      // Verificar si fue exitoso
      if (output.includes('✅ User registered successfully') || 
          output.includes('User is already registered')) {
        res.json({
          success: true,
          message: '✅ Usuario registrado exitosamente'
        });
      } else {
        res.json({
          success: false,
          message: '❌ Error en el registro: ' + output
        });
      }
      
    } finally {
      restoreScript(tempPath);
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Error al registrar: ' + error.message
    });
  }
});

// Obtener tokens del faucet
app.post('/api/get-faucet', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ 
        success: false, 
        message: '❌ Dirección requerida' 
      });
    }

    console.log('Obteniendo tokens para:', address);
    
    // Modificar script del faucet
    const scriptPath = path.join(__dirname, '../scripts/converter/05_get_faucet.ts');
    const tempPath = modifyScriptForUser(scriptPath, { address });
    
    try {
      const output = await runHardhatCommand(tempPath, { address });
      
      if (output.includes('🎉 Faucet claim successful')) {
        res.json({
          success: true,
          message: '✅ Tokens obtenidos exitosamente'
        });
      } else {
        res.json({
          success: false,
          message: '❌ Error al obtener tokens: ' + output
        });
      }
      
    } finally {
      restoreScript(tempPath);
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Error al obtener tokens: ' + error.message
    });
  }
});

// Hacer depósito
app.post('/api/deposit', async (req, res) => {
  try {
    const { address, amount } = req.body;
    
    if (!address) {
      return res.status(400).json({ 
        success: false, 
        message: '❌ Dirección requerida' 
      });
    }

    if (!amount) {
      return res.status(400).json({ 
        success: false, 
        message: '❌ Monto requerido' 
      });
    }

    console.log('Haciendo depósito para:', address, 'monto:', amount);
    
    // Modificar script de depósito
    const scriptPath = path.join(__dirname, '../scripts/converter/06_deposit.ts');
    const tempPath = modifyScriptForUser(scriptPath, { address, amount });
    
    try {
      const output = await runHardhatCommand(tempPath, { address, amount });
      
      if (output.includes('🎉 Deposit successful')) {
        // Invalidar cache de balance después de depósito
        const cacheKey = `balance_${address.toLowerCase()}`;
        balanceCache.delete(cacheKey);
        
        res.json({
          success: true,
          message: '✅ Depósito realizado exitosamente'
        });
      } else {
        res.json({
          success: false,
          message: '❌ Error al hacer depósito: ' + output
        });
      }
      
    } finally {
      restoreScript(tempPath);
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Error al hacer depósito: ' + error.message
    });
  }
});

// Verificar balance
app.post('/api/check-balance', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ 
        success: false, 
        message: '❌ Dirección requerida' 
      });
    }

    // Verificar cache primero
    const cacheKey = `balance_${address.toLowerCase()}`;
    const cached = balanceCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < BALANCE_CACHE_DURATION) {
      console.log('📋 Usando cache para verificación de balance:', address);
      return res.json(cached.data);
    }

    console.log('Verificando balance para:', address);
    
    // Modificar script de verificación de balance
    const scriptPath = path.join(__dirname, '../scripts/converter/08_check_balance.ts');
    const tempPath = modifyScriptForUser(scriptPath, { address });
    
    try {
      const output = await runHardhatCommand(tempPath, { address });
      
      // Extraer balances del output usando regex
      const publicBalanceMatch = output.match(/Public [A-Z]+ Balance: ([\d.]+)/);
      const encryptedBalanceMatch = output.match(/Current Balance: ([\d.]+)/);
      const egctBalanceMatch = output.match(/EGCT Balance: ([\d.]+)/);
      
      const publicBalance = publicBalanceMatch ? publicBalanceMatch[1] : '0';
      const encryptedBalance = encryptedBalanceMatch ? encryptedBalanceMatch[1] : 
                              egctBalanceMatch ? egctBalanceMatch[1] : '0';
      
      const result = {
        success: true,
        balance: publicBalance,
        privateBalance: encryptedBalance,
        message: `✅ Balance verificado - Público: ${publicBalance} AVAXTEST, Privado: ${encryptedBalance} AVAXTEST`
      };
      
      // Guardar en cache
      balanceCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      res.json(result);
      
    } finally {
      restoreScript(tempPath);
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Error al verificar balance: ' + error.message
    });
  }
});

// Transferir tokens (nuevo endpoint)
app.post('/api/transfer', async (req, res) => {
  try {
    const { address, amount, toAddress } = req.body;
    
    if (!address || !amount || !toAddress) {
      return res.status(400).json({ 
        success: false, 
        message: '❌ Dirección, monto y dirección destino requeridos' 
      });
    }

    console.log('Transferencia de:', address, 'a:', toAddress, 'monto:', amount);
    
    // Modificar script de transferencia
    const scriptPath = path.join(__dirname, '../scripts/converter/07_transfer.ts');
    const tempPath = modifyScriptForUser(scriptPath, { address, amount, toAddress });
    
    try {
      const output = await runHardhatCommand(tempPath, { address, amount, toAddress });
      
      if (output.includes('🎉 Private transfer completed successfully')) {
        // Invalidar cache de balance después de transferencia
        const cacheKey = `balance_${address.toLowerCase()}`;
        balanceCache.delete(cacheKey);
        
        res.json({
          success: true,
          message: '✅ Transferencia privada completada exitosamente'
        });
      } else {
        res.json({
          success: false,
          message: '❌ Error en transferencia: ' + output
        });
      }
      
    } finally {
      restoreScript(tempPath);
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Error en transferencia: ' + error.message
    });
  }
});

// Retirar tokens (nuevo endpoint)
app.post('/api/withdraw', async (req, res) => {
  try {
    const { address, amount } = req.body;
    
    if (!address || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: '❌ Dirección y monto requeridos' 
      });
    }

    console.log('Retirando tokens para:', address, 'monto:', amount);
    
    // Modificar script de retiro
    const scriptPath = path.join(__dirname, '../scripts/converter/09_withdraw.ts');
    const tempPath = modifyScriptForUser(scriptPath, { address, amount });
    
    try {
      const output = await runHardhatCommand(tempPath, { address, amount });
      
      if (output.includes('🎉 Private withdrawal completed successfully')) {
        // Invalidar cache de balance después de retiro
        const cacheKey = `balance_${address.toLowerCase()}`;
        balanceCache.delete(cacheKey);
        
        res.json({
          success: true,
          message: '✅ Retiro privado completado exitosamente'
        });
      } else {
        res.json({
          success: false,
          message: '❌ Error en retiro: ' + output
        });
      }
      
    } finally {
      restoreScript(tempPath);
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Error en retiro: ' + error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'eERC Backend funcionando (modo dinámico optimizado)',
    features: [
      'Scripts modificados dinámicamente',
      'Montos personalizables',
      'Direcciones de MetaMask',
      'Operaciones reales de Hardhat',
      'Cache de setup ZK',
      'Cache de verificación de registro',
      'Cache de verificación de balance'
    ],
    cache: {
      registrationCacheSize: registrationCache.size,
      balanceCacheSize: balanceCache.size,
      zkSetupCompleted
    }
  });
});

// Limpiar cache
app.post('/api/clear-cache', (req, res) => {
  registrationCache.clear();
  balanceCache.clear();
  zkSetupCompleted = false;
  zkSetupPromise = null;
  
  res.json({
    success: true,
    message: '✅ Cache limpiado exitosamente'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 eERC Backend (Dinámico Optimizado) corriendo en puerto ${PORT}`);
  console.log(`📡 API disponible en http://localhost:${PORT}`);
  console.log(`🔧 Modo: Dinámico - Modifica scripts en tiempo real`);
  console.log(`⚡ Optimizaciones: Cache ZK, Cache registro, Cache balance`);
  console.log(`💡 Endpoints adicionales: /api/health, /api/clear-cache`);
});
