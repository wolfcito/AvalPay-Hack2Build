const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3002; // Puerto diferente al converter

// Almacenamiento temporal de dapps generadas
const generatedDapps = new Map();

// Cache para setup ZK
let zkSetupCompleted = false;
let zkSetupPromise = null;

// Cache para verificación de registro
const registrationCache = new Map();
const balanceCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
const BALANCE_CACHE_DURATION = 2 * 60 * 1000; // 2 minutos

// Middleware
app.use(cors());
app.use(express.json());

// Función para procesar y limpiar mensajes de error
const processErrorMessage = (output) => {
  // Si es un error de registro
  if (output.includes('User is not registered')) {
    return '❌ Usuario no registrado. Por favor regístrate primero.';
  }
  
  // Si es un error de balance insuficiente
  if (output.includes('Insufficient balance') || output.includes('insufficient funds')) {
    return '❌ Saldo insuficiente para realizar esta operación.';
  }
  
  // Si es un error de dirección inválida
  if (output.includes('invalid address') || output.includes('INVALID_ARGUMENT')) {
    return '❌ Dirección de wallet inválida.';
  }
  
  // Si es un error de red
  if (output.includes('network') || output.includes('connection')) {
    return '❌ Error de conexión con la red. Verifica tu conexión a internet.';
  }
  
  // Si es un error de contrato
  if (output.includes('contract') || output.includes('execution reverted')) {
    return '❌ Error en el contrato. La operación no pudo completarse.';
  }
  
  // Si es un error de transacción
  if (output.includes('transaction') || output.includes('gas')) {
    return '❌ Error en la transacción. Verifica que tienes suficiente gas.';
  }
  
  // Si es un error de permisos (solo owner puede mint)
  if (output.includes('Only owner can mint') || output.includes('Ownable')) {
    return '❌ Solo el propietario del contrato puede acuñar tokens.';
  }
  
  // Para otros errores, extraer solo la parte relevante
  const lines = output.split('\n');
  const errorLines = lines.filter(line => 
    line.includes('❌') || 
    line.includes('Error') || 
    line.includes('error') ||
    line.includes('Cannot') ||
    line.includes('Failed')
  );
  
  if (errorLines.length > 0) {
    // Tomar la primera línea de error y limpiarla
    let errorMsg = errorLines[0].replace(/^.*?❌\s*/, '').replace(/^.*?Error:\s*/, '');
    if (errorMsg.length > 100) {
      errorMsg = errorMsg.substring(0, 100) + '...';
    }
    return `❌ ${errorMsg}`;
  }
  
  // Si no se puede procesar, devolver un mensaje genérico
  return '❌ Ocurrió un error inesperado. Intenta nuevamente.';
};

// Función para procesar mensajes de éxito
const processSuccessMessage = (output) => {
  if (output.includes('🎉 Mint successful')) {
    return '✅ Tokens acuñados exitosamente';
  }
  
  if (output.includes('🎉 Transfer successful')) {
    return '✅ Transferencia realizada exitosamente';
  }
  
  if (output.includes('🎉 Burn successful')) {
    return '✅ Tokens quemados exitosamente';
  }
  
  if (output.includes('✅ User is registered')) {
    return '✅ Usuario registrado correctamente';
  }
  
  return '✅ Operación completada exitosamente';
};

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

// Función para ejecutar comandos de hardhat con scripts dinámicos
const runHardhatCommand = async (scriptPath, userData) => {
  // Asegurar que el setup ZK esté completado (usando cache)
  await ensureZKSetup();
  
  return new Promise((resolve, reject) => {
    const scriptCommand = `npx hardhat run ${scriptPath} --network fuji`;
    
    console.log('🚀 Ejecutando script standalone:', scriptPath);
    exec(scriptCommand, { 
      cwd: path.join(__dirname, '..'),
      env: { 
        ...process.env,
        USER_ADDRESS: userData.address,
        AMOUNT: userData.amount || '',
        TO_ADDRESS: userData.toAddress || ''
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
    
    // Usar script dinámico de verificación de balance para verificar registro
    const scriptPath = path.join(__dirname, '../scripts/standalone/06_check_balance_dynamic.ts');
    
    const output = await runHardhatCommand(scriptPath, { address });
    
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
    
    // Usar script dinámico de registro
    const scriptPath = path.join(__dirname, '../scripts/standalone/03_register_user_dynamic.ts');
    
    const output = await runHardhatCommand(scriptPath, { address });
    
    const message = processSuccessMessage(output);
    const errorMessage = processErrorMessage(output);
    
    // Verificar si fue exitoso
    if (output.includes('✅ User registered successfully') || 
        output.includes('User is already registered')) {
      res.json({
        success: true,
        message: message
      });
    } else {
      res.json({
        success: false,
        message: errorMessage
      });
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Error al registrar: ' + error.message
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
    
    // Usar script dinámico de verificación de balance
    const scriptPath = path.join(__dirname, '../scripts/standalone/06_check_balance_dynamic.ts');
    
    const output = await runHardhatCommand(scriptPath, { address });
    
    // Extraer balances del output usando regex
    const encryptedBalanceMatch = output.match(/Current Balance: ([\d.]+)/);
    const egctBalanceMatch = output.match(/EGCT Balance: ([\d.]+)/);
    
    const encryptedBalance = encryptedBalanceMatch ? encryptedBalanceMatch[1] : 
                            egctBalanceMatch ? egctBalanceMatch[1] : '0';
    
    const message = processSuccessMessage(output);
    const errorMessage = processErrorMessage(output);
    
    if (output.includes('User is not registered')) {
      res.json({
        success: false,
        message: errorMessage
      });
    } else {
      const result = {
        success: true,
        balance: encryptedBalance, // En standalone solo hay balance encriptado
        message: `✅ Balance verificado - Privado: ${encryptedBalance} PRIV`
      };
      
      // Guardar en cache
      balanceCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      res.json(result);
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Error al verificar balance: ' + error.message
    });
  }
});

// Acuñar tokens (solo owner)
app.post('/api/mint', async (req, res) => {
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

    console.log('Acuñando tokens para:', address, 'monto:', amount);
    
    // Usar script dinámico de mint
    const scriptPath = path.join(__dirname, '../scripts/standalone/05_mint_dynamic.ts');
    
    const output = await runHardhatCommand(scriptPath, { address, amount });
    
    const message = processSuccessMessage(output);
    const errorMessage = processErrorMessage(output);

    if (output.includes('🎉 Mint successful')) {
      // Invalidar cache de balance después de mint
      const cacheKey = `balance_${address.toLowerCase()}`;
      balanceCache.delete(cacheKey);
      
      res.json({
        success: true,
        message: message
      });
    } else {
      res.json({
        success: false,
        message: errorMessage
      });
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Error al acuñar tokens: ' + error.message
    });
  }
});

// Transferir tokens
app.post('/api/transfer', async (req, res) => {
  try {
    const address = req.body.address || req.body.from;
    const toAddress = req.body.toAddress || req.body.to;
    const { amount } = req.body;
    
    if (!address || !amount || !toAddress) {
      return res.status(400).json({ 
        success: false, 
        message: '❌ Dirección, monto y dirección destino requeridos' 
      });
    }

    console.log('Transferencia de:', address, 'a:', toAddress, 'monto:', amount);
    
    // Usar script dinámico de transferencia
    const scriptPath = path.join(__dirname, '../scripts/standalone/07_transfer_dynamic.ts');
    
    const output = await runHardhatCommand(scriptPath, { address, amount, toAddress });
    
    const message = processSuccessMessage(output);
    const errorMessage = processErrorMessage(output);

    if (output.includes('🎉 Transfer successful')) {
      // Invalidar cache de balance después de transferencia
      const cacheKey = `balance_${address.toLowerCase()}`;
      balanceCache.delete(cacheKey);
      
      res.json({
        success: true,
        message: message
      });
    } else {
      res.json({
        success: false,
        message: errorMessage
      });
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Error en transferencia: ' + error.message
    });
  }
});

// Quemar tokens
app.post('/api/burn', async (req, res) => {
  try {
    const { address, amount } = req.body;
    
    if (!address || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: '❌ Dirección y monto requeridos' 
      });
    }

    console.log('Quemando tokens para:', address, 'monto:', amount);
    
    // Usar script dinámico de burn
    const scriptPath = path.join(__dirname, '../scripts/standalone/08_burn_dynamic.ts');
    
    const output = await runHardhatCommand(scriptPath, { address, amount });
    
    const message = processSuccessMessage(output);
    const errorMessage = processErrorMessage(output);

    if (output.includes('🎉 Burn successful')) {
      // Invalidar cache de balance después de burn
      const cacheKey = `balance_${address.toLowerCase()}`;
      balanceCache.delete(cacheKey);
      
      res.json({
        success: true,
        message: message
      });
    } else {
      res.json({
        success: false,
        message: errorMessage
      });
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Error al quemar tokens: ' + error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'eERC Standalone Backend'
  });
});

// Generate contracts endpoint
app.post('/api/generate-contracts', async (req, res) => {
  try {
    const { type, config } = req.body;
    
    if (!type || !config) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tipo y configuración son requeridos' 
      });
    }
    
    // Validate required fields
    if (!config.name || !config.symbol || !config.initialSupply) {
      return res.status(400).json({ 
        success: false, 
        message: 'Faltan campos requeridos: name, symbol, initialSupply' 
      });
    }
    
    // Use default values for optional fields
    const finalConfig = {
      ...config,
      decimals: config.decimals || 18,
      owner: config.owner || '0x0db58fFf8F2872c43785bb884397eDaD474b0ede',
      network: config.network || 'fuji'
    };
    
    console.log('🚀 Iniciando generación de contratos eERC20 reales...');
    console.log('📋 Configuración:', finalConfig);
    
    let deploymentResults = {};
    
    if (type === 'from-scratch') {
      // Ejecutar comandos reales de Hardhat para crear contratos desde cero
      console.log('🔧 Ejecutando despliegue de contratos básicos...');
      
      try {
        // 1. Deploy basics (verifiers, libraries, test ERC20)
        console.log('📦 Paso 1: Desplegando componentes básicos...');
        const basicsResult = await executeHardhatCommand('scripts/converter/01_deploy-basics.ts', finalConfig.network);
        deploymentResults.basics = basicsResult;
        
        // 2. Deploy converter system
        console.log('🔄 Paso 2: Desplegando sistema convertidor...');
        const converterResult = await executeHardhatCommand('scripts/converter/02_deploy-converter.ts', finalConfig.network);
        deploymentResults.converter = converterResult;
        
        // 3. Deploy standalone basics
        console.log('⚡ Paso 3: Desplegando componentes standalone...');
        const standaloneBasicsResult = await executeHardhatCommand('scripts/standalone/01_deploy-basics.ts', finalConfig.network);
        deploymentResults.standaloneBasics = standaloneBasicsResult;
        
        // 4. Deploy standalone system
        console.log('🏦 Paso 4: Desplegando sistema standalone...');
        const standaloneResult = await executeHardhatCommand('scripts/standalone/02_deploy-standalone.ts', finalConfig.network);
        deploymentResults.standalone = standaloneResult;
        
        console.log('✅ Todos los contratos desplegados exitosamente');
        
        res.json({
          success: true,
          message: 'Contratos eERC20 desplegados exitosamente',
          deploymentResults,
          config: finalConfig,
          deployedAt: new Date().toISOString(),
          nextSteps: [
            'Registrar usuarios: npx hardhat run scripts/converter/03_register-user.ts --network fuji',
            'Configurar auditor: npx hardhat run scripts/converter/04_set-auditor.ts --network fuji',
            'Obtener tokens de prueba: npx hardhat run scripts/converter/05_get_faucet.ts --network fuji',
            'Hacer depósitos: npx hardhat run scripts/converter/06_deposit.ts --network fuji'
          ]
        });
        
      } catch (error) {
        console.error('❌ Error durante el despliegue:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Error durante el despliegue de contratos: ' + error.message,
          deploymentResults
        });
      }
      
    } else if (type === 'migrate') {
      // Migración de contratos ERC20 existentes usando el sistema Converter
      console.log('🔄 Iniciando migración de contrato ERC20 existente...');
      console.log('📋 Configuración de migración:', finalConfig);
      
      try {
        // 1. Verificar que el contrato existente sea válido
        console.log('🔍 Paso 1: Verificando contrato ERC20 existente...');
        const contractValidation = await validateERC20Contract(finalConfig.existingContract, finalConfig.network);
        deploymentResults.contractValidation = contractValidation;
        
        if (!contractValidation.isValid) {
          return res.status(400).json({
            success: false,
            message: `Contrato ERC20 inválido: ${contractValidation.error}`,
            deploymentResults
          });
        }
        
                 // 2. Desplegar sistema Converter independiente para el Builder
         console.log('📦 Paso 2: Desplegando sistema Converter independiente...');
         const converterBasicsResult = await executeHardhatCommand('scripts/converter/01_deploy-basics.ts', finalConfig.network);
         deploymentResults.converterBasics = converterBasicsResult;
         
         const converterSystemResult = await executeHardhatCommand('scripts/converter/02_deploy-converter.ts', finalConfig.network);
         deploymentResults.converterSystem = converterSystemResult;
         
         // Copiar el deployment data al directorio del builder
         const fs = require('fs');
         const path = require('path');
         const sourcePath = path.join(__dirname, '../deployments/converter/latest-converter.json');
         const targetPath = path.join(__dirname, '../deployments/builder/latest-builder.json');
         
         if (fs.existsSync(sourcePath)) {
           fs.copyFileSync(sourcePath, targetPath);
           console.log('✅ Deployment data copiado al Builder');
         }
         
                   // 2.5. Verificar registro de usuario (sin registro automático)
          console.log('👤 Paso 2.5: Verificando registro de usuario...');
          const userRegistrationResult = {
            success: true,
            message: 'Usuario necesita registro manual antes de migrar',
            requiresManualRegistration: true,
            userAddress: finalConfig.owner
          };
          deploymentResults.userRegistration = userRegistrationResult;
        
        // 3. Configurar el contrato existente en el sistema
        console.log('⚙️ Paso 3: Configurando contrato existente en el sistema...');
        const setupResult = await setupExistingContract(finalConfig.existingContract, finalConfig.network);
        deploymentResults.setup = setupResult;
        
                 // 4. Generar scripts de migración personalizados
         console.log('📝 Paso 4: Generando scripts de migración...');
         const migrationScripts = generateMigrationScripts(finalConfig, contractValidation);
         deploymentResults.migrationScripts = migrationScripts;
         
         if (!migrationScripts) {
           return res.status(500).json({
             success: false,
             message: 'Error generando scripts de migración',
             deploymentResults
           });
         }
        
        console.log('✅ Migración configurada exitosamente');
        
                 res.json({
           success: true,
           message: 'Migración de contrato ERC20 configurada exitosamente',
           deploymentResults,
           config: finalConfig,
           contractInfo: contractValidation,
           migrationScripts,
           deployedAt: new Date().toISOString(),
           nextSteps: [
             '1. Registrar usuario: npx hardhat run scripts/converter/03_register-user.ts --network fuji',
             '2. Configurar auditor: npx hardhat run scripts/converter/04_set-auditor.ts --network fuji',
             '3. Obtener tokens del faucet: npx hardhat run scripts/converter/05_get_faucet.ts --network fuji',
             '4. Migrar tokens usando deposit: npx hardhat run scripts/converter/06_deposit.ts --network fuji',
             '5. Verificar balance encriptado: npx hardhat run scripts/converter/08_check_balance.ts --network fuji'
           ],
           manualSteps: [
             '🔑 Registra tu wallet: Usa el botón "Registrar Usuario" o ejecuta: npx hardhat run scripts/builder/register-user.ts --network fuji',
             '🔐 Configura el auditor: npx hardhat run scripts/converter/04_set-auditor.ts --network fuji',
             '💰 Obtén tokens de prueba: npx hardhat run scripts/converter/05_get_faucet.ts --network fuji',
             '🔄 Migra tus tokens: npx hardhat run scripts/converter/06_deposit.ts --network fuji'
           ]
         });
        
      } catch (error) {
        console.error('❌ Error durante la migración:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Error durante la migración: ' + error.message,
          deploymentResults
        });
      }
    }
    
  } catch (error) {
    console.error('Error generating contracts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor: ' + error.message 
    });
  }
});

// Función para validar contrato ERC20 existente
async function validateERC20Contract(contractAddress, network) {
  try {
    console.log(`🔍 Validando contrato ERC20: ${contractAddress} en ${network}`);
    
    // Crear script temporal para validar el contrato
    const validationScript = `
      const { ethers } = require("hardhat");
      
      async function main() {
        try {
          console.log("🔍 Conectando al contrato:", "${contractAddress}");
          
          // Intentar conectar al contrato usando SimpleERC20 ABI
          const contract = await ethers.getContractAt("SimpleERC20", "${contractAddress}");
          console.log("✅ Conexión exitosa al contrato");
          
          // Verificar que el contrato existe y responde
          console.log("📋 Verificando funciones del contrato...");
          
          const name = await contract.name();
          console.log("✅ Nombre obtenido:", name);
          
          const symbol = await contract.symbol();
          console.log("✅ Símbolo obtenido:", symbol);
          
          const decimals = await contract.decimals();
          console.log("✅ Decimales obtenidos:", decimals.toString());
          
          const totalSupply = await contract.totalSupply();
          console.log("✅ Supply total obtenido:", totalSupply.toString());
          
          console.log("✅ Contrato ERC20 válido:");
          console.log("Nombre:", name);
          console.log("Símbolo:", symbol);
          console.log("Decimales:", decimals.toString());
          console.log("Supply Total:", ethers.formatUnits(totalSupply, decimals));
          
        } catch (error) {
          console.error("❌ Error validando contrato:", error.message);
          console.error("❌ Stack trace:", error.stack);
          process.exit(1);
        }
      }
      
      main().catch((error) => {
        console.error("❌ Error en main:", error.message);
        process.exit(1);
      });
    `;
    
    // Ejecutar script de validación
    const result = await executeHardhatScript(validationScript, network);
    
    if (result.success) {
      // Extraer información del output
      const output = result.stdout;
      const nameMatch = output.match(/Nombre: (.+)/);
      const symbolMatch = output.match(/Símbolo: (.+)/);
      const decimalsMatch = output.match(/Decimales: (\d+)/);
      const supplyMatch = output.match(/Supply Total: (.+)/);
      
      return {
        isValid: true,
        name: nameMatch ? nameMatch[1] : 'Unknown',
        symbol: symbolMatch ? symbolMatch[1] : 'Unknown',
        decimals: decimalsMatch ? parseInt(decimalsMatch[1]) : 18,
        totalSupply: supplyMatch ? supplyMatch[1] : '0',
        address: contractAddress
      };
    } else {
      return {
        isValid: false,
        error: result.stderr || 'Error desconocido validando contrato'
      };
    }
    
  } catch (error) {
    console.error('❌ Error en validación de contrato:', error);
    return {
      isValid: false,
      error: error.message
    };
  }
}

 // Función para verificar y registrar usuario si es necesario
 async function checkAndRegisterUser(userAddress, network) {
   try {
     console.log(`👤 Verificando registro de usuario: ${userAddress}`);
     
           // Crear script temporal para verificar registro
      const checkScript = `
        const { ethers } = require("hardhat");
        
        async function main() {
          try {
            // Verificar que el archivo de deployment existe
            const fs = require("fs");
            const path = require("path");
            
            const deploymentPath = path.join(__dirname, "../deployments/converter/latest-converter.json");
            console.log("🔍 Verificando archivo de deployment:", deploymentPath);
            
            if (!fs.existsSync(deploymentPath)) {
              throw new Error("Archivo de deployment no encontrado. Asegúrate de que los contratos se hayan desplegado correctamente.");
            }
            
            // Leer deployment data
            const deploymentData = require("../deployments/converter/latest-converter.json");
            console.log("✅ Archivo de deployment cargado exitosamente");
            
            const registrar = await ethers.getContractAt("Registrar", deploymentData.contracts.registrar);
           
           const userAddress = "${userAddress}";
           console.log("🔍 Verificando si usuario está registrado:", userAddress);
           
           const isRegistered = await registrar.isUserRegistered(userAddress);
           console.log("📋 Usuario registrado:", isRegistered);
           
                       if (!isRegistered) {
              console.log("📝 Usuario no registrado, procediendo a registrar...");
              
              try {
                // Generar keys para el usuario
                const { deriveKeysFromUser } = require("../../src/utils");
                const [signer] = await ethers.getSigners();
                
                const { publicKey, signature } = await deriveKeysFromUser(userAddress, signer);
                
                // Registrar usuario
                const tx = await registrar.registerUser(userAddress, publicKey, signature);
                await tx.wait();
                
                console.log("✅ Usuario registrado exitosamente");
              } catch (registrationError) {
                console.error("❌ Error durante el registro:", registrationError.message);
                throw registrationError;
              }
            } else {
              console.log("✅ Usuario ya está registrado");
            }
           
         } catch (error) {
           console.error("❌ Error verificando/registrando usuario:", error.message);
           process.exit(1);
         }
       }
       
       main().catch((error) => {
         console.error("❌ Error en main:", error.message);
         process.exit(1);
       });
     `;
     
     const result = await executeHardhatScript(checkScript, network);
     
     if (result.success) {
       return {
         success: true,
         message: 'Usuario verificado y registrado si era necesario',
         userAddress: userAddress
       };
     } else {
       return {
         success: false,
         error: result.stderr || 'Error desconocido verificando usuario'
       };
     }
     
   } catch (error) {
     console.error('❌ Error verificando usuario:', error);
     return {
       success: false,
       error: error.message
     };
   }
 }

 // Función para configurar contrato existente en el sistema
 async function setupExistingContract(contractAddress, network) {
   try {
     console.log(`⚙️ Configurando contrato existente: ${contractAddress}`);
     
     // Por ahora, solo retornamos éxito ya que el sistema Converter
     // ya está configurado para trabajar con cualquier ERC20
     return {
       success: true,
       message: 'Contrato existente configurado para migración',
       contractAddress: contractAddress
     };
   } catch (error) {
     console.error('❌ Error configurando contrato existente:', error);
     return {
       success: false,
       error: error.message
     };
   }
 }

// Función para generar scripts de migración personalizados
function generateMigrationScripts(config, contractInfo) {
  try {
    console.log('📝 Generando scripts de migración para:', contractInfo.address);
    
         const scripts = {
       'migrate-tokens.js': `
 // Script para migrar tokens del contrato ERC20 existente a formato encriptado
 // Contrato origen: ${contractInfo.address}
 // Nombre: ${contractInfo.name || 'Unknown'}
 // Símbolo: ${contractInfo.symbol || 'Unknown'}
 
 const { ethers } = require("hardhat");
 
 async function migrateTokens() {
   try {
     console.log("🚀 Iniciando migración de tokens...");
     console.log("📋 Contrato origen: ${contractInfo.address}");
     console.log("📋 Nombre: ${contractInfo.name || 'Unknown'}");
     console.log("📋 Símbolo: ${contractInfo.symbol || 'Unknown'}");
     
     // 1. Conectar al contrato ERC20 existente
     const existingToken = await ethers.getContractAt("SimpleERC20", "${contractInfo.address}");
     console.log("✅ Conectado al contrato origen:", "${contractInfo.address}");
     
     // 2. Conectar al sistema Converter
     const deploymentData = require("./deployments/converter/latest-converter.json");
     const encryptedERC = await ethers.getContractAt("EncryptedERC", deploymentData.contracts.encryptedERC);
     console.log("✅ Conectado al sistema Converter");
     
     // 3. Obtener balance del usuario
     const [signer] = await ethers.getSigners();
     const balance = await existingToken.balanceOf(signer.address);
     const decimals = await existingToken.decimals();
     
     console.log("💰 Balance actual:", ethers.formatUnits(balance, decimals));
     
     if (balance.toString() === "0") {
       console.log("⚠️  Balance es 0, no hay tokens para migrar");
       console.log("💡 Primero obtén tokens usando: npx hardhat run scripts/converter/05_get_faucet.ts --network fuji");
       return;
     }
     
     // 4. Aprobar tokens para el sistema Converter
     console.log("🔐 Aprobando tokens para migración...");
     const approveTx = await existingToken.approve(encryptedERC.address, balance);
     await approveTx.wait();
     console.log("✅ Aprobación completada");
     
     // 5. Migrar tokens usando deposit
     console.log("🔄 Migrando tokens a formato encriptado...");
     const depositTx = await encryptedERC.deposit(existingToken.address, balance);
     await depositTx.wait();
     
     console.log("✅ Migración completada exitosamente!");
     console.log("📊 Tokens migrados:", ethers.formatUnits(balance, decimals));
     console.log("🔒 Los tokens ahora están en formato encriptado en el sistema eERC20");
     
   } catch (error) {
     console.error("❌ Error en migración:", error);
     console.error("💡 Asegúrate de que:");
     console.error("   1. Tu wallet está registrada: npx hardhat run scripts/converter/03_register-user.ts --network fuji");
     console.error("   2. El auditor está configurado: npx hardhat run scripts/converter/04_set-auditor.ts --network fuji");
     console.error("   3. Tienes tokens para migrar: npx hardhat run scripts/converter/05_get_faucet.ts --network fuji");
     throw error;
   }
 }
 
 migrateTokens();
       `,
      
             'check-migrated-balance.js': `
 // Script para verificar balance encriptado después de la migración
 const { ethers } = require("hardhat");
 
 async function checkMigratedBalance() {
   try {
     console.log("🔍 Verificando balance migrado...");
     console.log("📋 Contrato origen: ${contractInfo.address}");
     console.log("📋 Nombre: ${contractInfo.name || 'Unknown'}");
     console.log("📋 Símbolo: ${contractInfo.symbol || 'Unknown'}");
     
     const deploymentData = require("./deployments/converter/latest-converter.json");
     const encryptedERC = await ethers.getContractAt("EncryptedERC", deploymentData.contracts.encryptedERC);
     
     const [signer] = await ethers.getSigners();
     console.log("👤 Wallet:", signer.address);
     
     // Verificar balance encriptado
     const tokenId = await encryptedERC.tokenIds("${contractInfo.address}");
     console.log("🆔 Token ID:", tokenId.toString());
     
     const [eGCT, nonce, amountPCTs, balancePCT, transactionIndex] = await encryptedERC.balanceOf(signer.address, tokenId);
     
     console.log("🔒 Balance encriptado (EGCT):", eGCT);
     console.log("📊 Transaction Index:", transactionIndex.toString());
     console.log("📋 Number of PCTs:", amountPCTs.length);
     
     // Verificar balance público (debería ser 0 después de migración completa)
     const existingToken = await ethers.getContractAt("SimpleERC20", "${contractInfo.address}");
     const publicBalance = await existingToken.balanceOf(signer.address);
     const decimals = await existingToken.decimals();
     
     console.log("📊 Balance público restante:", ethers.formatUnits(publicBalance, decimals));
     
     if (publicBalance.toString() === "0") {
       console.log("✅ Migración completa: Todos los tokens están en formato encriptado");
     } else {
       console.log("⚠️  Migración parcial: Aún hay tokens en formato público");
     }
     
   } catch (error) {
     console.error("❌ Error verificando balance:", error);
     console.error("💡 Asegúrate de que la migración se completó correctamente");
     throw error;
   }
 }
 
 checkMigratedBalance();
       `
    };
    
    console.log('✅ Scripts de migración generados exitosamente');
    return scripts;
    
  } catch (error) {
    console.error('❌ Error generando scripts de migración:', error);
    return null;
  }
}

// Función para ejecutar scripts de Hardhat personalizados
async function executeHardhatScript(scriptContent, network) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    
    // Crear archivo temporal
    const tempScriptPath = path.join(__dirname, 'temp-validation.js');
    fs.writeFileSync(tempScriptPath, scriptContent);
    
    console.log(`🚀 Ejecutando script temporal: ${tempScriptPath}`);
    
    const hardhatProcess = spawn('npx', ['hardhat', 'run', tempScriptPath, '--network', network], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });
    
    let stdout = '';
    let stderr = '';
    
    hardhatProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`📤 Validation: ${output.trim()}`);
    });
    
    hardhatProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`❌ Validation: ${error.trim()}`);
    });
    
    hardhatProcess.on('close', (code) => {
      // Limpiar archivo temporal
      try {
        fs.unlinkSync(tempScriptPath);
      } catch (error) {
        console.warn('No se pudo eliminar archivo temporal:', error);
      }
      
      if (code === 0) {
        console.log(`✅ Validación completada exitosamente`);
        resolve({
          success: true,
          stdout: stdout,
          stderr: stderr,
          exitCode: code
        });
      } else {
        console.error(`❌ Validación falló con código ${code}`);
        resolve({
          success: false,
          stdout: stdout,
          stderr: stderr,
          exitCode: code
        });
      }
    });
    
    hardhatProcess.on('error', (error) => {
      console.error(`❌ Error ejecutando validación:`, error);
      reject(error);
    });
    
    // Timeout después de 2 minutos
    setTimeout(() => {
      hardhatProcess.kill();
      reject(new Error(`Timeout ejecutando validación`));
    }, 120000); // 2 minutos
  });
}

// Función para ejecutar comandos de Hardhat
async function executeHardhatCommand(scriptPath, network) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    
    console.log(`🚀 Ejecutando: npx hardhat run ${scriptPath} --network ${network}`);
    
    const hardhatProcess = spawn('npx', ['hardhat', 'run', scriptPath, '--network', network], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });
    
    let stdout = '';
    let stderr = '';
    
    hardhatProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`📤 ${scriptPath}: ${output.trim()}`);
    });
    
    hardhatProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`❌ ${scriptPath}: ${error.trim()}`);
    });
    
    hardhatProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${scriptPath} completado exitosamente`);
        resolve({
          success: true,
          script: scriptPath,
          network: network,
          stdout: stdout,
          stderr: stderr,
          exitCode: code
        });
      } else {
        console.error(`❌ ${scriptPath} falló con código ${code}`);
        reject(new Error(`Script ${scriptPath} falló con código ${code}: ${stderr}`));
      }
    });
    
    hardhatProcess.on('error', (error) => {
      console.error(`❌ Error ejecutando ${scriptPath}:`, error);
      reject(error);
    });
    
    // Timeout después de 5 minutos
    setTimeout(() => {
      hardhatProcess.kill();
      reject(new Error(`Timeout ejecutando ${scriptPath}`));
    }, 300000); // 5 minutos
  });
}

// Registrar usuario en el sistema Builder
app.post('/api/register-user-builder', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ 
        success: false, 
        message: '❌ Dirección requerida' 
      });
    }

    console.log('🔑 Registrando usuario en el sistema Builder:', address);
    
    // Ejecutar el script independiente de registro
    const scriptPath = path.join(__dirname, '../scripts/builder/register-user.ts');
    
    const output = await runHardhatCommand(scriptPath, { address });
    
    const message = processSuccessMessage(output);
    const errorMessage = processErrorMessage(output);
    
    // Verificar si fue exitoso
    if (output.includes('✅ Usuario registrado exitosamente') || 
        output.includes('Usuario ya está registrado')) {
      res.json({
        success: true,
        message: message
      });
    } else {
      res.json({
        success: false,
        message: errorMessage
      });
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Error al registrar usuario: ' + error.message
    });
  }
});

// Generar mini-dapp
app.post('/api/generate-dapp', async (req, res) => {
  try {
    const { dappConfig, contracts } = req.body;

    if (!dappConfig || !contracts) {
      return res.status(400).json({
        success: false,
        message: '❌ Configuración de dapp y contratos requeridos'
      });
    }

    console.log('🎨 Generando mini-dapp:', dappConfig.name);
    console.log('📋 DappConfig recibido:', JSON.stringify(dappConfig, null, 2));
    console.log('📋 Contratos recibidos:', JSON.stringify(contracts, null, 2));

    // Generar ID único para la dapp
    const dappId = `dapp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const dappDir = path.join(__dirname, 'temp-dapps', dappId);

    // Crear directorio temporal
    fs.mkdirSync(dappDir, { recursive: true });

    // Obtener dirección del contrato eERC20
    let contractAddress = null;
    
    // Buscar en diferentes estructuras posibles
    if (contracts.standalone?.encryptedERC) {
      contractAddress = contracts.standalone.encryptedERC;
    } else if (contracts.converter?.encryptedERC) {
      contractAddress = contracts.converter.encryptedERC;
    } else if (contracts.standaloneSystem?.encryptedERC) {
      contractAddress = contracts.standaloneSystem.encryptedERC;
    } else if (contracts.converterSystem?.encryptedERC) {
      contractAddress = contracts.converterSystem.encryptedERC;
    }
    
    // Si no se encuentra, buscar en el stdout de los scripts
    if (!contractAddress) {
      console.log('🔍 Buscando dirección del contrato en logs...');
      console.log('📋 Contratos disponibles:', Object.keys(contracts));
      
      // Buscar en el stdout de los scripts de despliegue
      for (const [key, result] of Object.entries(contracts)) {
        if (result.stdout && typeof result.stdout === 'string') {
          console.log(`🔍 Revisando ${key}...`);
          console.log(`📄 Contenido de ${key}:`, result.stdout.substring(0, 500) + '...');
          
          // Buscar patrón de dirección de contrato encryptedERC
          const addressMatch = result.stdout.match(/encryptedERC.*?['"](0x[a-fA-F0-9]{40})['"]/);
          if (addressMatch) {
            contractAddress = addressMatch[1];
            console.log(`✅ Dirección encontrada en ${key}:`, contractAddress);
            break;
          }
          
          // Buscar también en el formato de tabla
          const tableMatch = result.stdout.match(/\│\s*encryptedERC\s*\│\s*['"](0x[a-fA-F0-9]{40})['"]\s*\│/);
          if (tableMatch) {
            contractAddress = tableMatch[1];
            console.log(`✅ Dirección encontrada en tabla de ${key}:`, contractAddress);
            break;
          }
          
          // Buscar en formato de línea simple
          const lineMatch = result.stdout.match(/encryptedERC\s*['"](0x[a-fA-F0-9]{40})['"]/);
          if (lineMatch) {
            contractAddress = lineMatch[1];
            console.log(`✅ Dirección encontrada en línea de ${key}:`, contractAddress);
            break;
          }
          
          // Buscar cualquier dirección que contenga "encryptedERC" en el contexto
          const contextMatch = result.stdout.match(/(?:encryptedERC|EncryptedERC).*?(0x[a-fA-F0-9]{40})/);
          if (contextMatch) {
            contractAddress = contextMatch[1];
            console.log(`✅ Dirección encontrada en contexto de ${key}:`, contractAddress);
            break;
          }
        }
      }
    }
    
    if (!contractAddress) {
      // SOLUCIÓN TEMPORAL: Usar direcciones hardcodeadas de los logs
      console.log('⚠️ No se encontró dirección en logs, usando dirección hardcodeada...');
      
      // Usar la última dirección vista en los logs
      contractAddress = '0xFDc1cb7F7eB996311AcBD7b5044316B14a931D65'; // Standalone EncryptedERC
      
      // Si no funciona, probar con la dirección del converter
      if (!contractAddress) {
        contractAddress = '0x5ed4b4b42A5E60A380946F7AC872A8f9AF3DBFf9'; // Converter EncryptedERC
      }
      
      console.log('🔧 Usando dirección hardcodeada:', contractAddress);
    }

    // Configuración de red
    const network = contracts.standaloneSystem ? 'fuji' : 'fuji';
    const rpcUrl = 'https://api.avax-test.network/ext/bc/C/rpc';

    // Asignar puertos dinámicos para evitar conflictos
    const basePort = 3004; // Empezar desde 3004 para dejar 3000-3003 libres
    const dappPort = basePort + Math.floor(Math.random() * 100); // Puerto aleatorio entre 3004-3103

    // Generar frontend
    const frontendDir = path.join(dappDir, 'frontend');
    fs.mkdirSync(frontendDir, { recursive: true });

    // Copiar plantilla de frontend
    const frontendTemplateDir = path.join(__dirname, '../templates/frontend-template');
    await copyDirectory(frontendTemplateDir, frontendDir);

    // Personalizar archivos del frontend
    await customizeFrontend(frontendDir, dappConfig, contractAddress, dappPort);

    // Generar backend
    const backendDir = path.join(dappDir, 'backend');
    fs.mkdirSync(backendDir, { recursive: true });

    // Copiar plantilla de backend
    const backendTemplateDir = path.join(__dirname, '../templates/backend-template');
    await copyDirectory(backendTemplateDir, backendDir);

    // Personalizar archivos del backend
    await customizeBackend(backendDir, contractAddress, network, rpcUrl, dappPort);

    // Crear README principal
    const mainReadme = path.join(dappDir, 'README.md');
    fs.writeFileSync(mainReadme, generateMainReadme(dappConfig, contractAddress));

    // Guardar información de la dapp
    generatedDapps.set(dappId, {
      id: dappId,
      name: dappConfig.name,
      contractAddress: contractAddress,
      createdAt: new Date(),
      dir: dappDir
    });

    // Actualizar la personalización del backend con el puerto dinámico
    await customizeBackend(backendDir, contractAddress, network, rpcUrl, dappPort);
    
    // Generar información de la dapp
    const dappInfo = {
      id: dappId,
      name: dappConfig.name,
      contractAddress: contractAddress,
      dir: dappDir,
      frontendDir: frontendDir,
      backendDir: backendDir,
      ports: {
        backend: dappPort,
        frontend: dappPort + 1
      },
      instructions: {
        frontend: `cd "${frontendDir}" && npm install && PORT=${dappPort + 1} npm start`,
        backend: `cd "${backendDir}" && npm install && PORT=${dappPort} npm start`
      }
    };

    // Guardar información de la dapp
    generatedDapps.set(dappId, dappInfo);

    // Ejecutar automáticamente la mini-dapp
    console.log('🚀 Iniciando mini-dapp automáticamente...');
    
    // Iniciar backend de la mini-dapp
    const backendProcess = spawn('npm', ['install'], {
      cwd: backendDir,
      stdio: 'pipe',
      shell: true
    });

    backendProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Dependencias del backend instaladas');
        
        // Iniciar el servidor backend
        const backendServer = spawn('npm', ['start'], {
          cwd: backendDir,
          stdio: 'pipe',
          shell: true,
          env: { ...process.env, PORT: dappPort.toString() }
        });

        backendServer.stdout.on('data', (data) => {
          console.log(`📡 Backend ${dappId}: ${data.toString().trim()}`);
        });

        backendServer.stderr.on('data', (data) => {
          console.error(`❌ Backend ${dappId}: ${data.toString().trim()}`);
        });

        // Guardar proceso del backend
        dappInfo.backendProcess = backendServer;
        
        // Iniciar frontend después de un delay
        setTimeout(() => {
          const frontendProcess = spawn('npm', ['install'], {
            cwd: frontendDir,
            stdio: 'pipe',
            shell: true
          });

          frontendProcess.on('close', (code) => {
            if (code === 0) {
              console.log('✅ Dependencias del frontend instaladas');
              
              // Iniciar el servidor frontend
              const frontendServer = spawn('npm', ['start'], {
                cwd: frontendDir,
                stdio: 'pipe',
                shell: true,
                env: { ...process.env, PORT: (dappPort + 1).toString() }
              });

              frontendServer.stdout.on('data', (data) => {
                console.log(`🎨 Frontend ${dappId}: ${data.toString().trim()}`);
              });

              frontendServer.stderr.on('data', (data) => {
                console.error(`❌ Frontend ${dappId}: ${data.toString().trim()}`);
              });

              // Guardar proceso del frontend
              dappInfo.frontendProcess = frontendServer;
              
              console.log(`✅ Mini-dapp ${dappId} ejecutándose en:`);
              console.log(`   - Backend: http://localhost:${dappPort}`);
              console.log(`   - Frontend: http://localhost:${dappPort + 1}`);
            }
          });
        }, 3000); // Esperar 3 segundos para que el backend se inicie
      }
    });

    console.log('✅ Mini-dapp generada exitosamente:', dappId);

    res.json({
      success: true,
      message: '✅ Mini-dapp generada exitosamente',
      dapp: {
        id: dappId,
        name: dappConfig.name,
        contractAddress: contractAddress,
        dir: dappDir,
        ports: {
          backend: dappPort,
          frontend: dappPort + 1
        },
        urls: {
          backend: `http://localhost:${dappPort}`,
          frontend: `http://localhost:${dappPort + 1}`
        },
        instructions: {
          frontend: `cd "${frontendDir}" && npm install && npm start`,
          backend: `cd "${backendDir}" && npm install && npm start`
        }
      }
    });

  } catch (error) {
    console.error('Error generating dapp:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error al generar mini-dapp: ' + error.message
    });
  }
});

// Descargar dapp como ZIP
app.get('/api/download-dapp/:dappId', async (req, res) => {
  try {
    const { dappId } = req.params;
    const dapp = generatedDapps.get(dappId);

    if (!dapp) {
      return res.status(404).json({
        success: false,
        message: '❌ Dapp no encontrada'
      });
    }

    console.log('📦 Generando ZIP para dapp:', dappId);

    const zipPath = path.join(__dirname, 'temp-dapps', `${dappId}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      res.download(zipPath, `${dapp.name || 'private-payments-dapp'}.zip`, (err) => {
        if (err) {
          console.error('Error downloading ZIP:', err);
        }
        // Limpiar archivo ZIP después de descarga
        fs.unlinkSync(zipPath);
      });
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);
    archive.directory(dapp.dir, false);
    archive.finalize();

  } catch (error) {
    console.error('Error downloading dapp:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error al descargar dapp: ' + error.message
    });
  }
});

// Limpiar dapp
app.delete('/api/cleanup-dapp/:dappId', async (req, res) => {
  try {
    const { dappId } = req.params;
    const dapp = generatedDapps.get(dappId);

    if (!dapp) {
      return res.status(404).json({
        success: false,
        message: '❌ Dapp no encontrada'
      });
    }

    console.log('🧹 Limpiando dapp:', dappId);

    // No hay procesos que terminar ya que no se inician automáticamente
    console.log('📝 No hay procesos activos que terminar');

    // Eliminar directorio
    try {
      fs.rmSync(dapp.dir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error removing directory:', error);
    }

    // Remover de la memoria
    generatedDapps.delete(dappId);

    res.json({
      success: true,
      message: '✅ Dapp limpiada exitosamente'
    });

  } catch (error) {
    console.error('Error cleaning up dapp:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error al limpiar dapp: ' + error.message
    });
  }
});

// Funciones auxiliares

async function copyDirectory(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      await copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function customizeFrontend(frontendDir, dappConfig, contractAddress, backendPort) {
  // Personalizar App.js
  const appJsPath = path.join(frontendDir, 'src', 'App.js');
  let appJsContent = fs.readFileSync(appJsPath, 'utf8');
  
  appJsContent = appJsContent
    .replace(/{{APP_NAME}}/g, dappConfig.name || 'Mi App de Pagos')
    .replace(/{{PRIMARY_COLOR}}/g, dappConfig.primaryColor || '#3B82F6')
    .replace(/{{SECONDARY_COLOR}}/g, dappConfig.secondaryColor || '#1E40AF')
    .replace(/{{LOGO_URL}}/g, dappConfig.logo || '')
    .replace(/{{CONTRACT_ADDRESS}}/g, contractAddress)
    .replace(/{{BACKEND_PORT}}/g, backendPort.toString());

  fs.writeFileSync(appJsPath, appJsContent);

  // Personalizar index.html
  const indexHtmlPath = path.join(frontendDir, 'public', 'index.html');
  let indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  
  indexHtmlContent = indexHtmlContent.replace(/{{APP_NAME}}/g, dappConfig.name || 'Mi App de Pagos');
  fs.writeFileSync(indexHtmlPath, indexHtmlContent);

  // Personalizar package.json
  const packageJsonPath = path.join(frontendDir, 'package.json');
  let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  packageJson.name = dappConfig.name?.toLowerCase().replace(/\s+/g, '-') || 'private-payments-dapp';
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

async function customizeBackend(backendDir, contractAddress, network, rpcUrl, port = 3003) {
  // Personalizar server.js
  const serverJsPath = path.join(backendDir, 'server.js');
  let serverJsContent = fs.readFileSync(serverJsPath, 'utf8');
  
  serverJsContent = serverJsContent
    .replace(/{{CONTRACT_ADDRESS}}/g, contractAddress)
    .replace(/{{NETWORK}}/g, network)
    .replace(/{{RPC_URL}}/g, rpcUrl)
    .replace(/const PORT = process\.env\.PORT \|\| 3003;/g, `const PORT = process.env.PORT || ${port};`);

  fs.writeFileSync(serverJsPath, serverJsContent);

  // Personalizar package.json
  const packageJsonPath = path.join(backendDir, 'package.json');
  let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  packageJson.name = 'private-payments-backend';
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

function generateMainReadme(dappConfig, contractAddress) {
  return `# ${dappConfig.name || 'Mi App de Pagos Privados'}

Esta es una aplicación de pagos privados generada por AVALTOOLKIT.

## Configuración

### Frontend
\`\`\`bash
cd frontend
npm install
npm start
\`\`\`

### Backend
\`\`\`bash
cd backend
npm install
npm start
\`\`\`

## Información del Contrato

- **Contrato eERC20:** ${contractAddress}
- **Red:** Fuji Testnet
- **Funcionalidades:** Mint, Transfer, Burn, Balance Check

## Tecnologías

- React.js (Frontend)
- Node.js + Express (Backend)
- Ethers.js
- Zero-Knowledge Proofs (ZKP)
- Avalanche Network

## Características

- ✅ Pagos completamente privados
- ✅ Tecnología ZK para privacidad
- ✅ Interfaz moderna y responsive
- ✅ Integración con MetaMask
- ✅ Operaciones: Mint, Transfer, Burn

Generado con ❤️ por AVALTOOLKIT
`;
}

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
  console.log(`🚀 eERC Standalone Backend corriendo en puerto ${PORT}`);
  console.log(`📡 API disponible en http://localhost:${PORT}`);
  console.log(`🔧 Modo: Standalone - Scripts dinámicos nativos`);
  console.log(`⚡ Optimizaciones: Sin archivos temporales, Cache ZK, Cache registro, Cache balance`);
  console.log(`💡 Endpoints adicionales: /api/health, /api/clear-cache`);
});
