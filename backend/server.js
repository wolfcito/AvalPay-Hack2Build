const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Función para ejecutar comandos de hardhat
const runHardhatCommand = (scriptPath, address) => {
  return new Promise((resolve, reject) => {
    // Primero compilar y arreglar imports si es necesario
    const setupCommand = 'npm run zkit:setup';
    const scriptCommand = `npx hardhat run ${scriptPath} --network fuji`;
    
    console.log('🔧 Ejecutando setup de ZK...');
    exec(setupCommand, { 
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    }, (setupError) => {
      if (setupError) {
        console.error('Error en setup:', setupError);
        // Continuar de todas formas
      }
      
      console.log('🚀 Ejecutando script:', scriptPath);
      exec(scriptCommand, { 
        cwd: path.join(__dirname, '..'),
        env: { 
          ...process.env,
          USER_ADDRESS: address 
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
  });
};

// Función para modificar temporalmente el script con la dirección del usuario
const modifyScriptForUser = (scriptPath, address) => {
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');
  const modifiedContent = scriptContent.replace(
    /const WALLET_NUMBER = \d+;/,
    `const USER_ADDRESS = "${address}";`
  );
  fs.writeFileSync(scriptPath, modifiedContent);
};

// Función para restaurar el script original
const restoreScript = (scriptPath, originalContent) => {
  fs.writeFileSync(scriptPath, originalContent);
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

    // Aquí podrías verificar directamente en el contrato
    // Por ahora, simulamos la verificación
    const isRegistered = Math.random() > 0.5; // Simulación
    
    res.json({
      success: true,
      isRegistered,
      message: isRegistered ? 
        '✅ Usuario registrado' : 
        '❌ Usuario no registrado'
    });
    
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
    
    // Ejecutar el script de registro
    const output = await runHardhatCommand('scripts/converter/03_register-user.ts', address);
    
    // Verificar si fue exitoso
    if (output.includes('✅ User registered successfully')) {
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
    
    // Ejecutar el script del faucet
    const output = await runHardhatCommand('scripts/converter/05_get_faucet.ts', address);
    
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
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ 
        success: false, 
        message: '❌ Dirección requerida' 
      });
    }

    console.log('Haciendo depósito para:', address);
    
    // Ejecutar el script de depósito
    const output = await runHardhatCommand('scripts/converter/06_deposit.ts', address);
    
    if (output.includes('🎉 Deposit successful')) {
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

    console.log('Verificando balance para:', address);
    
    // Ejecutar el script de verificación de balance
    const output = await runHardhatCommand('scripts/converter/08_check_balance.ts', address);
    
    // Extraer el balance del output
    const balanceMatch = output.match(/Balance: ([\d.]+)/);
    const balance = balanceMatch ? balanceMatch[1] : '0';
    
    res.json({
      success: true,
      balance,
      message: '✅ Balance verificado: ' + balance + ' AVAXTEST'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Error al verificar balance: ' + error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'eERC Backend funcionando' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 eERC Backend corriendo en puerto ${PORT}`);
  console.log(`📡 API disponible en http://localhost:${PORT}`);
});
