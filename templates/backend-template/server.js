const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar fetch para Node.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3003;

// Configuración de la aplicación
const APP_CONFIG = {
  contractAddress: '{{CONTRACT_ADDRESS}}',
  network: '{{NETWORK}}',
  rpcUrl: '{{RPC_URL}}'
};

// Middleware
app.use(cors());
app.use(express.json());

// Función para hacer peticiones al backend principal
const callMainBackend = async (endpoint, data = {}) => {
  try {
    const response = await fetch(`http://localhost:3002${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        contractAddress: APP_CONFIG.contractAddress,
        network: APP_CONFIG.network
      })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    throw new Error(`Error calling main backend: ${error.message}`);
  }
};

// Función para procesar mensajes de éxito
const processSuccessMessage = (output) => {
  const successPatterns = [
    /✅.*/g,
    /Success.*/gi,
    /Balance.*/gi,
    /Minted.*/gi,
    /Transferred.*/gi,
    /Burned.*/gi
  ];

  for (const pattern of successPatterns) {
    const matches = output.match(pattern);
    if (matches && matches.length > 0) {
      return matches[matches.length - 1];
    }
  }

  return '✅ Operación completada exitosamente';
};

// Función para procesar mensajes de error
const processErrorMessage = (output) => {
  const errorPatterns = [
    /❌.*/g,
    /Error.*/gi,
    /Failed.*/gi,
    /Cannot.*/gi
  ];

  for (const pattern of errorPatterns) {
    const matches = output.match(pattern);
    if (matches && matches.length > 0) {
      return matches[matches.length - 1];
    }
  }

  return '❌ Error desconocido';
};

// Rutas API

// Verificar registro de usuario
app.post('/api/check-registration', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: '❌ Dirección requerida'
      });
    }

    console.log('🔍 Verificando registro para:', address);

    const result = await callMainBackend('/api/check-registration', { address });

    res.json(result);

  } catch (error) {
    console.error('Error checking registration:', error);
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

    console.log('📝 Registrando usuario:', address);

    const result = await callMainBackend('/api/register-user', { address });

    res.json(result);

  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error al registrar usuario: ' + error.message
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

    console.log('💰 Verificando balance para:', address);

    const result = await callMainBackend('/api/check-balance', { address });

    res.json(result);

  } catch (error) {
    console.error('Error checking balance:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error al verificar balance: ' + error.message
    });
  }
});

// Mint tokens
app.post('/api/mint', async (req, res) => {
  try {
    const { address, amount } = req.body;

    if (!address || !amount) {
      return res.status(400).json({
        success: false,
        message: '❌ Dirección y cantidad requeridas'
      });
    }

    console.log('🪙 Minteando tokens para:', address, 'Cantidad:', amount);

    const result = await callMainBackend('/api/mint', { address, amount });

    res.json(result);

  } catch (error) {
    console.error('Error minting tokens:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error al mintear tokens: ' + error.message
    });
  }
});

// Transferir tokens
app.post('/api/transfer', async (req, res) => {
  try {
    const { from, to, amount } = req.body;

    if (!from || !to || !amount) {
      return res.status(400).json({
        success: false,
        message: '❌ Direcciones y cantidad requeridas'
      });
    }

    console.log('💸 Transferiendo tokens de:', from, 'a:', to, 'Cantidad:', amount);

    const result = await callMainBackend('/api/transfer', { from, to, amount });

    res.json(result);

  } catch (error) {
    console.error('Error transferring tokens:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error al transferir tokens: ' + error.message
    });
  }
});

// Burn tokens
app.post('/api/burn', async (req, res) => {
  try {
    const { address, amount } = req.body;

    if (!address || !amount) {
      return res.status(400).json({
        success: false,
        message: '❌ Dirección y cantidad requeridas'
      });
    }

    console.log('🔥 Quemando tokens para:', address, 'Cantidad:', amount);

    const result = await callMainBackend('/api/burn', { address, amount });

    res.json(result);

  } catch (error) {
    console.error('Error burning tokens:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error al quemar tokens: ' + error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '✅ Backend funcionando correctamente',
    config: {
      contractAddress: APP_CONFIG.contractAddress,
      network: APP_CONFIG.network
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Backend de pagos privados iniciado en puerto ${PORT}`);
  console.log(`📋 Configuración:`);
  console.log(`   - Contrato: ${APP_CONFIG.contractAddress}`);
  console.log(`   - Red: ${APP_CONFIG.network}`);
  console.log(`   - RPC: ${APP_CONFIG.rpcUrl}`);
});

module.exports = app;
