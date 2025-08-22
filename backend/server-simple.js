const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Simular datos de usuarios registrados
const registeredUsers = new Set();

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

    const isRegistered = registeredUsers.has(address.toLowerCase());
    
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
    
    // Simular proceso de registro
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simular delay
    
    registeredUsers.add(address.toLowerCase());
    
    res.json({
      success: true,
      message: '✅ Usuario registrado exitosamente'
    });
    
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
    
    // Simular proceso de faucet
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simular delay
    
    res.json({
      success: true,
      message: '✅ Tokens obtenidos exitosamente (100 AVAXTEST)'
    });
    
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

    if (!registeredUsers.has(address.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: '❌ Usuario no registrado. Regístrate primero.'
      });
    }

    console.log('Haciendo depósito para:', address);
    
    // Simular proceso de depósito
    await new Promise(resolve => setTimeout(resolve, 3000)); // Simular delay
    
    res.json({
      success: true,
      message: '✅ Depósito realizado exitosamente (50 tokens convertidos a privados)'
    });
    
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
    
    // Simular verificación de balance
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simular delay
    
    const publicBalance = Math.floor(Math.random() * 1000) + 100;
    const privateBalance = registeredUsers.has(address.toLowerCase()) ? 
      Math.floor(Math.random() * 500) + 50 : 0;
    
    res.json({
      success: true,
      balance: publicBalance.toString(),
      privateBalance: privateBalance.toString(),
      message: `✅ Balance verificado - Público: ${publicBalance} AVAXTEST, Privado: ${privateBalance} AVAXTEST`
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
  res.json({ 
    status: 'OK', 
    message: 'eERC Backend funcionando (modo simulación)',
    registeredUsers: Array.from(registeredUsers)
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 eERC Backend (Simulación) corriendo en puerto ${PORT}`);
  console.log(`📡 API disponible en http://localhost:${PORT}`);
  console.log(`🔧 Modo: Simulación - No ejecuta scripts de Hardhat`);
});
