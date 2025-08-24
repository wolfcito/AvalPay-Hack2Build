import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

function App() {
  // Estados principales
  const [currentView, setCurrentView] = useState('landing');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOperations, setLoadingOperations] = useState(new Set());
  const [message, setMessage] = useState('');
  const [balance, setBalance] = useState('');
  const [privateBalance, setPrivateBalance] = useState('');
  const [amount, setAmount] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [operationHistory, setOperationHistory] = useState([]);
  
  // Estados para Builder
  const [builderStep, setBuilderStep] = useState(0);
  const [builderType, setBuilderType] = useState(''); // 'from-scratch' o 'migrate'
  const [contractConfig, setContractConfig] = useState({
    name: '',
    symbol: '',
    decimals: 18,
    initialSupply: '',
    owner: '',
    existingContract: '',
    network: 'fuji'
  });
  const [generatedContracts, setGeneratedContracts] = useState(null);
  const [registeringUser, setRegisteringUser] = useState(false);
  const [registerUserMessage, setRegisterUserMessage] = useState('');
  const [showDappBuilder, setShowDappBuilder] = useState(false);
  const [dappBuilderView, setDappBuilderView] = useState('form'); // 'form' o 'preview'
  const [dappConfig, setDappConfig] = useState({
    name: '',
    primaryColor: '#3B82F6',
    secondaryColor: '#1E40AF',
    logo: ''
  });
  const [generatingDapp, setGeneratingDapp] = useState(false);
  const [dappProgress, setDappProgress] = useState('');
  const [generatedDapp, setGeneratedDapp] = useState(null);
  const [dappPreviewUrl, setDappPreviewUrl] = useState('');
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);

  // Refs para mantener el foco en los inputs
  const depositInputRef = useRef(null);
  const transferAmountInputRef = useRef(null);
  const withdrawInputRef = useRef(null);
  const toAddressInputRef = useRef(null);

  // Función para manejar loading de operaciones específicas
  const setOperationLoading = useCallback((operation, isLoading) => {
    setLoadingOperations(prev => {
      const newSet = new Set(prev);
      if (isLoading) {
        newSet.add(operation);
      } else {
        newSet.delete(operation);
      }
      return newSet;
    });
  }, []);

  // Función para hacer peticiones con timeout extendido
  const fetchWithTimeout = useCallback(async (url, options, timeout = 60000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('La operación tardó demasiado tiempo. Por favor, inténtalo de nuevo.');
      }
      throw error;
    }
  }, []);

  // Cache utilities
  const cacheUtils = {
    setLocal: (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now() }));
      } catch (error) {
        console.warn('Error saving to localStorage:', error);
      }
    },
    
    getLocal: (key) => {
      try {
        const item = localStorage.getItem(key);
        if (!item) return null;
        const { value, timestamp } = JSON.parse(item);
        return { value, timestamp };
      } catch (error) {
        console.warn('Error reading from localStorage:', error);
        return null;
      }
    },
    
    setSession: (key, value) => {
      try {
        sessionStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now() }));
      } catch (error) {
        console.warn('Error saving to sessionStorage:', error);
      }
    },
    
    getSession: (key) => {
      try {
        const item = sessionStorage.getItem(key);
        if (!item) return null;
        const { value, timestamp } = JSON.parse(item);
        return { value, timestamp };
      } catch (error) {
        console.warn('Error reading from sessionStorage:', error);
        return null;
      }
    },
    
    setMemory: (key, value) => {
      if (!window.memoryCache) window.memoryCache = new Map();
      window.memoryCache.set(key, { value, timestamp: Date.now() });
    },
    
    getMemory: (key) => {
      if (!window.memoryCache) return null;
      return window.memoryCache.get(key);
    },
    
    clearCache: (key) => {
      if (window.memoryCache) window.memoryCache.delete(key);
      sessionStorage.removeItem(key);
    }
  };

  // Add to history (placed early to avoid TDZ in dependent hooks)
  const addToHistory = useCallback((operation, success) => {
    const historyItem = {
      id: Date.now(),
      operation,
      success,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setOperationHistory(prev => [historyItem, ...prev.slice(0, 9)]); // Keep last 10
    
    // Cache history
    cacheUtils.setLocal('operation_history', [historyItem, ...operationHistory.slice(0, 9)]);
  }, [operationHistory]);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const address = accounts[0];
        setWalletAddress(address);
        setIsConnected(true);
        setMessage('✅ Wallet conectada exitosamente');
        
        // Cache wallet connection
        cacheUtils.setLocal('wallet_address', address);
        cacheUtils.setSession('is_connected', true);
        
        // Check registration status for both systems
        checkRegistration(address);
        checkRegistrationStandalone(address);
        
        // Change to overview
        setCurrentView('overview');
      } catch (error) {
        setMessage('❌ Error conectando wallet: ' + error.message);
      }
    } else {
      setMessage('❌ MetaMask no está instalado');
    }
  }, []);

  // Check registration status
  const checkRegistration = useCallback(async (address) => {
    if (!address) return;
    
    const cacheKey = `registration_${address}`;
    const cached = cacheUtils.getMemory(cacheKey) || cacheUtils.getSession(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < 300000) { // 5 minutes
      setIsRegistered(cached.value);
      return;
    }
    
    try {
      const response = await fetch('/api/check-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      
      const data = await response.json();
      setIsRegistered(data.isRegistered);
      
      // Cache result
      cacheUtils.setMemory(cacheKey, data.isRegistered);
      cacheUtils.setSession(cacheKey, data.isRegistered);
    } catch (error) {
      console.error('Error checking registration:', error);
    }
  }, []);

  // Register user
  const registerUser = useCallback(async () => {
    if (!walletAddress) {
      setMessage('Conecta tu wallet primero');
      return;
    }
    
    setOperationLoading('register', true);
    setMessage('Registrando usuario...');
    
    try {
      const response = await fetchWithTimeout('/api/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress })
      }, 45000); // 45 segundos
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('✅ Usuario registrado exitosamente');
        setIsRegistered(true);
        addToHistory('Registro', true);
        
        // Invalidate registration cache
        const cacheKey = `registration_${walletAddress}`;
        if (window.memoryCache) window.memoryCache.delete(cacheKey);
        sessionStorage.removeItem(cacheKey);
      } else {
        setMessage('❌ Error: ' + data.message);
        addToHistory('Registro', false);
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
      addToHistory('Registro', false);
    } finally {
      setOperationLoading('register', false);
    }
  }, [walletAddress, setOperationLoading, fetchWithTimeout]);

  // Get faucet
  const getFaucet = useCallback(async () => {
    if (!walletAddress) {
      setMessage('Conecta tu wallet primero');
      return;
    }
    
    setOperationLoading('faucet', true);
    setMessage('Obteniendo tokens del faucet...');
    
    try {
      const response = await fetchWithTimeout('/api/get-faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress })
      }, 60000); // 60 segundos para faucet
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('✅ Tokens obtenidos exitosamente');
        addToHistory('Faucet', true);
        checkBalance(); // Refresh balance
      } else {
        setMessage('❌ Error: ' + data.message);
        addToHistory('Faucet', false);
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
      addToHistory('Faucet', false);
    } finally {
      setOperationLoading('faucet', false);
    }
  }, [walletAddress, setOperationLoading, fetchWithTimeout]);

  // Check balance
  const checkBalance = useCallback(async () => {
    if (!walletAddress) {
      setMessage('❌ Conecta tu wallet primero');
      return;
    }
    
    setOperationLoading('balance', true);
    setMessage('🔄 Actualizando balance...');
    
    try {
      const response = await fetchWithTimeout('/api/check-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress })
      }, 30000); // 30 segundos para balance
      
      const data = await response.json();
      
      if (data.success) {
        setBalance(data.balance);
        setPrivateBalance(data.privateBalance);
        setMessage('✅ Balance actualizado exitosamente');
        addToHistory('Verificar Balance', true);
      } else {
        setMessage('❌ Error: ' + data.message);
        addToHistory('Verificar Balance', false);
      }
    } catch (error) {
      console.error('Error checking balance:', error);
      setMessage('❌ Error al verificar balance: ' + error.message);
      addToHistory('Verificar Balance', false);
    } finally {
      setOperationLoading('balance', false);
    }
  }, [walletAddress, setOperationLoading, fetchWithTimeout]);

  // Make deposit
  const makeDeposit = useCallback(async () => {
    const depositAmount = depositInputRef.current?.value || '';
    if (!walletAddress || !depositAmount) {
      setMessage('Conecta tu wallet y especifica un monto');
      return;
    }
    
    setOperationLoading('deposit', true);
    setMessage('Haciendo depósito...');
    
    try {
      const response = await fetchWithTimeout('/api/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress, amount: depositAmount })
      }, 90000); // 90 segundos para depósitos
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('✅ Depósito realizado exitosamente');
        addToHistory('Depósito', true);
        if (depositInputRef.current) {
          depositInputRef.current.value = '';
        }
        checkBalance(); // Refresh balance
      } else {
        setMessage('❌ Error: ' + data.message);
        addToHistory('Depósito', false);
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
      addToHistory('Depósito', false);
    } finally {
      setOperationLoading('deposit', false);
    }
  }, [walletAddress, setOperationLoading, fetchWithTimeout]);

  // Transfer tokens
  const transferTokens = useCallback(async () => {
    const rawAmount = (transferAmountInputRef.current?.value || (document.getElementById('transfer-amount')?.value || '')).trim();
    const rawTo = (toAddressInputRef.current?.value || (document.getElementById('transfer-to')?.value || '')).trim();

    if (!walletAddress) {
      setMessage('❌ Conecta tu wallet primero');
      return;
    }

    const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(rawTo);
    if (rawTo && !isValidAddress) {
      setMessage('❌ Dirección destino inválida');
      return;
    }

    const isValidNumber = /^\d*\.?\d+$/.test(rawAmount) && parseFloat(rawAmount) > 0;
    if (rawAmount && !isValidNumber) {
      setMessage('❌ Monto inválido');
      return;
    }

    if (!rawTo || !rawAmount) {
      setMessage('❌ Dirección, monto y dirección destino requeridos');
      return;
    }

    setOperationLoading('transfer', true);
    setMessage('Transferiendo tokens...');
    
    try {
      const response = await fetchWithTimeout('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: walletAddress, to: rawTo, amount: rawAmount })
      }, 120000); // 2 minutos para transferencias
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('✅ Transferencia realizada exitosamente');
        addToHistory('Transferencia', true);
        if (transferAmountInputRef.current) {
          transferAmountInputRef.current.value = '';
        }
        if (toAddressInputRef.current) {
          toAddressInputRef.current.value = '';
        }
        checkBalance(); // Refresh balance
      } else {
        setMessage('❌ Error: ' + data.message);
        addToHistory('Transferencia', false);
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
      addToHistory('Transferencia', false);
    } finally {
      setOperationLoading('transfer', false);
    }
  }, [walletAddress, setOperationLoading, fetchWithTimeout]);

  // Withdraw tokens
  const withdrawTokens = useCallback(async () => {
    const withdrawAmount = withdrawInputRef.current?.value || '';
    if (!walletAddress || !withdrawAmount) {
      setMessage('Conecta tu wallet y especifica un monto');
      return;
    }
    
    setOperationLoading('withdraw', true);
    setMessage('Retirando tokens...');
    
    try {
      const response = await fetchWithTimeout('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress, amount: withdrawAmount })
      }, 90000); // 90 segundos para retiros
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('✅ Retiro realizado exitosamente');
        addToHistory('Retiro', true);
        if (withdrawInputRef.current) {
          withdrawInputRef.current.value = '';
        }
        checkBalance(); // Refresh balance
      } else {
        setMessage('❌ Error: ' + data.message);
        addToHistory('Retiro', false);
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
      addToHistory('Retiro', false);
    } finally {
      setOperationLoading('withdraw', false);
    }
  }, [walletAddress, setOperationLoading, fetchWithTimeout]);

  // ===== FUNCIONES STANDALONE =====
  
  // Check registration status (Standalone)
  const checkRegistrationStandalone = useCallback(async (address) => {
    if (!address) return;
    
    const cacheKey = `registration_standalone_${address}`;
    const cached = cacheUtils.getMemory(cacheKey) || cacheUtils.getSession(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < 300000) { // 5 minutes
      setIsRegistered(cached.value);
      return;
    }
    
    try {
      const response = await fetch('http://localhost:3002/api/check-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      
      const data = await response.json();
      setIsRegistered(data.isRegistered);
      
      // Cache result
      cacheUtils.setMemory(cacheKey, data.isRegistered);
      cacheUtils.setSession(cacheKey, data.isRegistered);
    } catch (error) {
      console.error('Error checking registration (standalone):', error);
    }
  }, []);

  // Register user (Standalone)
  const registerUserStandalone = useCallback(async () => {
    if (!walletAddress) {
      setMessage('Conecta tu wallet primero');
      return;
    }
    
    setOperationLoading('register-standalone', true);
    setMessage('Registrando usuario en sistema standalone...');
    
    try {
      const response = await fetchWithTimeout('http://localhost:3002/api/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress })
      }, 45000);
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('✅ Usuario registrado exitosamente en sistema standalone');
        setIsRegistered(true);
        addToHistory('Registro Standalone', true);
        
        // Invalidate registration cache
        const cacheKey = `registration_standalone_${walletAddress}`;
        if (window.memoryCache) window.memoryCache.delete(cacheKey);
        sessionStorage.removeItem(cacheKey);
      } else {
        setMessage('❌ Error: ' + data.message);
        addToHistory('Registro Standalone', false);
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
      addToHistory('Registro Standalone', false);
    } finally {
      setOperationLoading('register-standalone', false);
    }
  }, [walletAddress, setOperationLoading, fetchWithTimeout]);

  // Check balance (Standalone)
  const checkBalanceStandalone = useCallback(async () => {
    if (!walletAddress) {
      setMessage('❌ Conecta tu wallet primero');
      return;
    }
    
    setOperationLoading('balance-standalone', true);
    setMessage('🔄 Actualizando balance standalone...');
    
    try {
      const response = await fetchWithTimeout('http://localhost:3002/api/check-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress })
      }, 30000);
      
      const data = await response.json();
      
      if (data.success) {
        setPrivateBalance(data.balance);
        setMessage('✅ Balance standalone actualizado exitosamente');
        addToHistory('Verificar Balance Standalone', true);
      } else {
        setMessage('❌ Error: ' + data.message);
        addToHistory('Verificar Balance Standalone', false);
      }
    } catch (error) {
      console.error('Error checking balance (standalone):', error);
      setMessage('❌ Error al verificar balance standalone: ' + error.message);
      addToHistory('Verificar Balance Standalone', false);
    } finally {
      setOperationLoading('balance-standalone', false);
    }
  }, [walletAddress, setOperationLoading, fetchWithTimeout]);

  // Mint tokens (Standalone)
  const mintTokens = useCallback(async () => {
    const mintAmount = document.getElementById('mint-amount')?.value || '';
    if (!walletAddress || !mintAmount) {
      setMessage('Conecta tu wallet y especifica un monto');
      return;
    }
    
    setOperationLoading('mint', true);
    setMessage('Acuñando tokens...');
    
    try {
      const response = await fetchWithTimeout('http://localhost:3002/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress, amount: mintAmount })
      }, 90000);
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('✅ Tokens acuñados exitosamente');
        addToHistory('Mint', true);
        if (document.getElementById('mint-amount')) {
          document.getElementById('mint-amount').value = '';
        }
        
        checkBalanceStandalone(); // Refresh balance
      } else {
        setMessage('❌ Error: ' + data.message);
        addToHistory('Mint', false);
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
      addToHistory('Mint', false);
    } finally {
      setOperationLoading('mint', false);
    }
  }, [walletAddress, setOperationLoading, fetchWithTimeout]);

  // Transfer tokens (Standalone)
  const transferTokensStandalone = useCallback(async () => {
    const transferAmount = document.getElementById('transfer-amount-standalone')?.value || '';
    const toAddress = document.getElementById('transfer-to-standalone')?.value || '';
    
    if (!walletAddress || !transferAmount || !toAddress) {
      setMessage('❌ Completa todos los campos requeridos');
      return;
    }
    
    const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(toAddress);
    if (!isValidAddress) {
      setMessage('❌ Dirección destino inválida');
      return;
    }
    
    setOperationLoading('transfer-standalone', true);
    setMessage('Transferiendo tokens...');
    
    try {
      const response = await fetchWithTimeout('http://localhost:3002/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: walletAddress, to: toAddress, amount: transferAmount })
      }, 120000);
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('✅ Transferencia realizada exitosamente');
        addToHistory('Transferencia Standalone', true);
        if (document.getElementById('transfer-amount-standalone')) {
          document.getElementById('transfer-amount-standalone').value = '';
        }
        if (document.getElementById('transfer-to-standalone')) {
          document.getElementById('transfer-to-standalone').value = '';
        }
        
        checkBalanceStandalone(); // Refresh balance
      } else {
        setMessage('❌ Error: ' + data.message);
        addToHistory('Transferencia Standalone', false);
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
      addToHistory('Transferencia Standalone', false);
    } finally {
      setOperationLoading('transfer-standalone', false);
    }
  }, [walletAddress, setOperationLoading, fetchWithTimeout]);

  // Burn tokens (Standalone)
  const burnTokens = useCallback(async () => {
    const burnAmount = document.getElementById('burn-amount')?.value || '';
    if (!walletAddress || !burnAmount) {
      setMessage('Conecta tu wallet y especifica un monto');
      return;
    }
    
    setOperationLoading('burn', true);
    setMessage('Quemando tokens...');
    
    try {
      const response = await fetchWithTimeout('http://localhost:3002/api/burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress, amount: burnAmount })
      }, 90000);
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('✅ Tokens quemados exitosamente');
        addToHistory('Burn', true);
        if (document.getElementById('burn-amount')) {
          document.getElementById('burn-amount').value = '';
        }
        
        checkBalanceStandalone(); // Refresh balance
      } else {
        setMessage('❌ Error: ' + data.message);
        addToHistory('Burn', false);
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
      addToHistory('Burn', false);
    } finally {
      setOperationLoading('burn', false);
    }
  }, [walletAddress, setOperationLoading, fetchWithTimeout]);

  // Add to history (kept single definition; moved earlier above)

  // Clear cache function
  const clearCache = useCallback(() => {
    // Limpiar todos los caches
    if (window.memoryCache) {
      window.memoryCache.clear();
    }
    sessionStorage.clear();
    
    // Limpiar cache específico de balances
    if (walletAddress) {
      const balanceCacheKey = `balance_${walletAddress}`;
      const balanceStandaloneCacheKey = `balance_standalone_${walletAddress}`;
      const registrationCacheKey = `registration_${walletAddress}`;
      const registrationStandaloneCacheKey = `registration_standalone_${walletAddress}`;
      
      cacheUtils.clearCache(balanceCacheKey);
      cacheUtils.clearCache(balanceStandaloneCacheKey);
      cacheUtils.clearCache(registrationCacheKey);
      cacheUtils.clearCache(registrationStandaloneCacheKey);
    }
    
    setMessage('✅ Cache de registro limpiado');
  }, [walletAddress, setMessage]);

  // Builder functions
  const startBuilder = useCallback((type) => {
    setBuilderType(type);
    setBuilderStep(1);
    setCurrentView('builder');
    setContractConfig({
      name: '',
      symbol: '',
      decimals: 18,
      initialSupply: '',
      owner: walletAddress || '',
      existingContract: '',
      network: 'fuji'
    });
    setGeneratedContracts(null);
  }, [walletAddress]);

  const nextBuilderStep = useCallback(() => {
    setBuilderStep(prev => prev + 1);
  }, []);

  const prevBuilderStep = useCallback(() => {
    setBuilderStep(prev => Math.max(0, prev - 1));
  }, []);

  const updateContractConfig = useCallback((field, value) => {
    setContractConfig(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const generateContracts = useCallback(async () => {
    setLoading(true);
    setMessage('🚀 Iniciando despliegue de contratos eERC20 reales...');
    
    try {
      const response = await fetch('http://localhost:3002/api/generate-contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: builderType,
          config: contractConfig
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setGeneratedContracts(data.deploymentResults);
        setBuilderStep(4); // Mostrar resultados
        setMessage('✅ Contratos eERC20 desplegados exitosamente');
        addToHistory('Desplegar Contratos eERC20', true);
        
        // Extraer y guardar direcciones en localStorage
        const addresses = extractContractAddresses(data.deploymentResults);
        if (addresses.encryptedERC) {
          localStorage.setItem('lastContractAddress', addresses.encryptedERC);
          console.log('💾 Dirección guardada en localStorage:', addresses.encryptedERC);
        }
      } else {
        setMessage('❌ Error: ' + data.message);
        addToHistory('Desplegar Contratos eERC20', false);
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
      addToHistory('Desplegar Contratos eERC20', false);
    } finally {
      setLoading(false);
    }
  }, [builderType, contractConfig, addToHistory]);
  
  // Función para extraer direcciones de contratos
  const extractContractAddresses = useCallback((deploymentResults) => {
    const addresses = {};
    
    try {
      console.log('🔍 Extrayendo direcciones de contratos...');
      console.log('📋 Deployment results:', deploymentResults);
      
      // Buscar en todos los resultados de despliegue
      for (const [key, result] of Object.entries(deploymentResults)) {
        if (result.stdout && typeof result.stdout === 'string') {
          console.log(`🔍 Revisando ${key}...`);
          
          // Buscar dirección encryptedERC
          const encryptedERCMatch = result.stdout.match(/encryptedERC.*?['"](0x[a-fA-F0-9]{40})['"]/);
          if (encryptedERCMatch) {
            addresses.encryptedERC = encryptedERCMatch[1];
            console.log(`✅ Dirección encryptedERC encontrada en ${key}:`, addresses.encryptedERC);
          }
          
          // Buscar en formato de tabla
          const tableMatch = result.stdout.match(/\│\s*encryptedERC\s*\│\s*['"](0x[a-fA-F0-9]{40})['"]\s*\│/);
          if (tableMatch) {
            addresses.encryptedERC = tableMatch[1];
            console.log(`✅ Dirección encryptedERC encontrada en tabla de ${key}:`, addresses.encryptedERC);
          }
          
          // Buscar en formato de línea
          const lineMatch = result.stdout.match(/encryptedERC\s*['"](0x[a-fA-F0-9]{40})['"]/);
          if (lineMatch) {
            addresses.encryptedERC = lineMatch[1];
            console.log(`✅ Dirección encryptedERC encontrada en línea de ${key}:`, addresses.encryptedERC);
          }
        }
      }
    } catch (error) {
      console.error('Error extrayendo direcciones:', error);
    }
    
    console.log('📊 Direcciones extraídas:', addresses);
    return addresses;
  }, []);

  const downloadContracts = useCallback((format) => {
    if (!generatedContracts) return;
    
    let content = '';
    let filename = '';
    
    if (format === 'txt') {
      content = `# Logs de Despliegue eERC20\n\n`;
      content += `## Configuración\n`;
      content += `- Nombre: ${contractConfig.name}\n`;
      content += `- Símbolo: ${contractConfig.symbol}\n`;
      content += `- Decimales: ${contractConfig.decimals}\n`;
      content += `- Supply Inicial: ${contractConfig.initialSupply}\n`;
      content += `- Propietario: ${contractConfig.owner}\n`;
      content += `- Red: ${contractConfig.network}\n`;
      content += `- Fecha de despliegue: ${new Date().toLocaleString()}\n\n`;
      
      content += `## Logs de Despliegue\n\n`;
      Object.entries(generatedContracts).forEach(([step, result]) => {
        content += `### ${step.toUpperCase()}\n`;
        content += `- Script: ${result.script}\n`;
        content += `- Red: ${result.network}\n`;
        content += `- Estado: ${result.success ? '✅ Exitoso' : '❌ Falló'}\n`;
        content += `- Código de salida: ${result.exitCode}\n\n`;
        
        if (result.stdout) {
          content += `#### Output:\n\`\`\`\n${result.stdout}\n\`\`\`\n\n`;
        }
        
        if (result.stderr) {
          content += `#### Errores:\n\`\`\`\n${result.stderr}\n\`\`\`\n\n`;
        }
      });
      
      filename = `${contractConfig.symbol}_eERC20_deployment_logs.txt`;
    } else if (format === 'json') {
      content = JSON.stringify({
        config: contractConfig,
        deploymentResults: generatedContracts,
        deployedAt: new Date().toISOString()
      }, null, 2);
      filename = `${contractConfig.symbol}_eERC20_deployment_logs.json`;
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setMessage('✅ Logs de despliegue descargados exitosamente');
  }, [generatedContracts, contractConfig]);

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => {
      setMessage('✅ Código copiado al portapapeles');
    }).catch(() => {
      setMessage('❌ Error al copiar al portapapeles');
    });
  }, []);

  // ===== FUNCIONES AUXILIARES PARA EL BUILDER =====
  
  // Extraer dirección de contrato del stdout
  const extractContractAddress = useCallback((stdout) => {
    if (!stdout) return null;
    
    // Buscar patrones comunes de direcciones de contratos
    const addressPattern = /0x[a-fA-F0-9]{40}/g;
    const addresses = stdout.match(addressPattern);
    
    if (addresses && addresses.length > 0) {
      // Retornar la primera dirección encontrada
      return addresses[0];
    }
    
    return null;
  }, []);

  // Obtener nombre del contrato basado en el paso
  const getContractName = useCallback((step) => {
    const contractNames = {
      'contractValidation': 'Validación de Contrato',
      'converterSystem': 'Sistema Converter',
      'migrationScripts': 'Scripts de Migración',
      'basics': 'Contratos Básicos',
      'converter': 'Sistema Converter',
      'standalone': 'Sistema Standalone'
    };
    
    return contractNames[step] || step;
  }, []);

  // Obtener icono del contrato
  const getContractIcon = useCallback((step) => {
    const contractIcons = {
      'contractValidation': '🔍',
      'converterSystem': '🔄',
      'migrationScripts': '📝',
      'basics': '🏗️',
      'converter': '🔄',
      'standalone': '⚡'
    };
    
    return contractIcons[step] || '📄';
  }, []);

  // Obtener tipo de contrato
  const getContractType = useCallback((step) => {
    const contractTypes = {
      'contractValidation': 'Validación',
      'converterSystem': 'Sistema Principal',
      'migrationScripts': 'Scripts',
      'basics': 'Infraestructura',
      'converter': 'Sistema Principal',
      'standalone': 'Sistema Principal'
    };
    
    return contractTypes[step] || 'Contrato';
  }, []);

  const resetBuilder = useCallback(() => {
    setBuilderStep(0);
    setBuilderType('');
    setContractConfig({
      name: '',
      symbol: '',
      decimals: 18,
      initialSupply: '',
      owner: walletAddress || '',
      existingContract: '',
      network: 'fuji'
    });
    setGeneratedContracts(null);
    setRegisterUserMessage('');
  }, [walletAddress]);

  const handleRegisterUser = useCallback(async () => {
    if (!walletAddress) {
      setRegisterUserMessage('❌ No hay wallet conectada');
      return;
    }

    setRegisteringUser(true);
    setRegisterUserMessage('');

    try {
      const response = await fetchWithTimeout('http://localhost:3002/api/register-user-builder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: walletAddress }),
      }, 120000); // 2 minutos timeout

      const data = await response.json();

      if (data.success) {
        setRegisterUserMessage(data.message);
        // Limpiar cache de registro
        cacheUtils.setLocal('registration_status', { value: true, timestamp: Date.now() });
      } else {
        setRegisterUserMessage(data.message || '❌ Error al registrar usuario');
      }
    } catch (error) {
      console.error('Error registering user:', error);
      setRegisterUserMessage(`❌ Error: ${error.message}`);
    } finally {
      setRegisteringUser(false);
    }
  }, [walletAddress, fetchWithTimeout]);


  // Función simple para validar inputs numéricos sin re-renderizado
  const handleAmountChange = useCallback((e) => {
    const value = e.target.value;
    // Solo permitir números y punto decimal
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      // No hacer nada más, solo permitir el cambio
    } else {
      // Revertir el valor si no es válido
      e.target.value = value.replace(/[^\d.]/g, '');
    }
  }, []);

  // Auto-refresh balance
  useEffect(() => {
    if (isConnected && walletAddress) {
      // Solo verificar balance una vez al conectar
      checkBalance();
      checkBalanceStandalone();
      
      // Configurar intervalo solo para balance del converter
      const interval = setInterval(() => {
        checkBalance();
      }, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [isConnected, walletAddress, checkBalance, checkBalanceStandalone]);

  // Load cached data on mount
  useEffect(() => {
    const cachedAddress = cacheUtils.getLocal('wallet_address');
    const cachedConnected = cacheUtils.getSession('is_connected');
    const cachedHistory = cacheUtils.getLocal('operation_history');
    
    if (cachedAddress) {
      setWalletAddress(cachedAddress.value);
    }
    
    if (cachedConnected && cachedConnected.value) {
      setIsConnected(true);
      setCurrentView('overview');
      
      // Check registration status for both systems if wallet is cached
      if (cachedAddress) {
        checkRegistration(cachedAddress.value);
        checkRegistrationStandalone(cachedAddress.value);
      }
    }
    
    if (cachedHistory) {
      setOperationHistory(cachedHistory.value);
    }
  }, []);

  // Landing Page Component
  const LandingPage = () => (
    <div className="landing-page">
      <div className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="gradient-text">AVALTOOLKIT</span>
          </h1>
          <p className="hero-subtitle">
            La suite completa de herramientas para el ecosistema Avalanche. 
            Convierte, transfiere y gestiona tokens con privacidad total usando Zero-Knowledge Proofs.
          </p>
          <div className="hero-features">
            <div className="feature-item">
              <div className="feature-icon">🔒</div>
              <span>Privacidad completa con Zero-Knowledge Proofs</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon">⚡</div>
              <span>Transacciones instantáneas en Avalanche</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🛡️</div>
              <span>Seguridad de nivel empresarial</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🔧</div>
              <span>Herramientas avanzadas de conversión</span>
            </div>
          </div>
          <button className="cta-button" onClick={connectWallet}>
            <span className="cta-icon">🚀</span>
            Conectar Wallet
          </button>
        </div>
        <div className="hero-visual">
          <div className="floating-card">
            <div className="card-icon">🔄</div>
            <h3>eERC Converter</h3>
            <p>Convierte tokens públicos a privados con encriptación avanzada. Mantén tu privacidad mientras operas en la blockchain.</p>
          </div>
          <div className="floating-card">
            <div className="card-icon">⚡</div>
            <h3>eERC Standalone</h3>
            <p>Tokens nativos encriptados con capacidades completas de mint, transfer y burn. Control total sobre tus activos privados.</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Overview Page Component
  const OverviewPage = () => (
    <div className="overview-page">
      <div className="overview-header">
        <h2>Dashboard Overview</h2>
        <p>Bienvenido a AVALTOOLKIT - Tu centro de control para operaciones privadas en Avalanche</p>
      </div>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🔗</div>
          <div className="stat-content">
            <h3>Estado de Conexión</h3>
            <p className="stat-value">{isConnected ? 'Conectado' : 'Desconectado'}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Operaciones Realizadas</h3>
            <p className="stat-value">{operationHistory.length}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🛠️</div>
          <div className="stat-content">
            <h3>Herramientas Disponibles</h3>
            <p className="stat-value">2 Sistemas</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <h3>Rendimiento</h3>
            <p className="stat-value">Optimizado</p>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h3>Acciones Rápidas</h3>
        <div className="actions-grid">
          <button className="action-button primary" onClick={() => setCurrentView('converter')}>
            <span className="action-icon">🔄</span>
            Ir al Converter
          </button>
          <button className="action-button secondary" onClick={() => setCurrentView('standalone')}>
            <span className="action-icon">⚡</span>
            Ir al Standalone
          </button>
          <button className="action-button secondary" onClick={() => setCurrentView('builder')}>
            <span className="action-icon">🏗️</span>
            Contract Builder
          </button>
          <button className="action-button secondary" onClick={clearCache}>
            <span className="action-icon">🧹</span>
            Limpiar Cache
          </button>
        </div>
      </div>

      {operationHistory.length > 0 && (
        <div className="recent-activity">
          <h3>Actividad Reciente</h3>
          <div className="activity-list">
            {operationHistory.slice(0, 5).map((op, index) => (
              <div key={index} className={`activity-item ${op.success ? 'success' : 'error'}`}>
                <div className="activity-icon">
                  {op.success ? '✓' : '✗'}
                </div>
                <div className="activity-content">
                  <span className="activity-name">{op.operation}</span>
                  <span className="activity-time">{op.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Converter Page Component
  const ConverterPage = () => (
    <div className="converter-page">
      <div className="page-header">
        <h2>eERC Converter</h2>
        <p>Convierte tokens públicos a privados con encriptación Zero-Knowledge</p>
      </div>
      
      <div className="converter-content">
        {/* Registration */}
        <div className="operation-group">
          <h3>Registro</h3>
          {!isRegistered ? (
            <div className="operation-layout compact">
              <div className="input-group">
                <label>Estado de registro</label>
                <div className="input-field" style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}>
                  Usuario no registrado
                </div>
              </div>
              <button 
                onClick={registerUser} 
                disabled={loadingOperations.has('register')} 
                className={`operation-button primary ${loadingOperations.has('register') ? 'loading' : ''}`}
              >
                {loadingOperations.has('register') ? 'Registrando...' : 'Registrar Usuario'}
              </button>
            </div>
          ) : (
            <div className="status-success">Usuario registrado</div>
          )}
        </div>

        {/* Balance */}
        <div className="operation-group">
          <h3>Balance</h3>
          <div className="balance-info">
            <p>Balance público: {balance || '0'} AVAXTEST</p>
            <p>Balance privado: {privateBalance || '0'} eAVAXTEST</p>
          </div>
          <div className="operation-layout compact">
            <div className="input-group">
              <label>Última actualización</label>
              <div className="input-field" style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}>
                {new Date().toLocaleTimeString()}
              </div>
            </div>
            <button 
              onClick={checkBalance} 
              disabled={loadingOperations.has('balance')} 
              className={`operation-button secondary ${loadingOperations.has('balance') ? 'loading' : ''}`}
            >
              {loadingOperations.has('balance') ? 'Actualizando...' : 'Actualizar Balance'}
            </button>
          </div>
        </div>

        {/* Faucet */}
        <div className="operation-group">
          <h3>Faucet</h3>
          <div className="operation-layout compact">
            <div className="input-group">
              <label>Tokens disponibles</label>
              <div className="input-field" style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}>
                1000 AVAXTEST por solicitud
              </div>
            </div>
            <button 
              onClick={getFaucet} 
              disabled={loadingOperations.has('faucet')} 
              className={`operation-button primary ${loadingOperations.has('faucet') ? 'loading' : ''}`}
            >
              {loadingOperations.has('faucet') ? 'Obteniendo...' : 'Obtener Tokens'}
            </button>
          </div>
        </div>

        {/* Deposit */}
        <div className="operation-group">
          <h3>Depósito</h3>
          <div className="operation-layout horizontal">
            <div className="input-group">
              <label htmlFor="deposit-amount">Cantidad a depositar</label>
              <input
                id="deposit-amount"
                ref={depositInputRef}
                type="text"
                placeholder="Ej: 10.5"
                onChange={handleAmountChange}
                className="input-field"
                disabled={loadingOperations.has('deposit')}
              />
            </div>
            <button 
              onClick={makeDeposit} 
              disabled={loadingOperations.has('deposit')} 
              className={`operation-button primary ${loadingOperations.has('deposit') ? 'loading' : ''}`}
            >
              {loadingOperations.has('deposit') ? 'Depositando...' : 'Hacer Depósito'}
            </button>
          </div>
        </div>

        {/* Transfer */}
        <div className="operation-group">
          <h3>Transferencia Privada</h3>
          <div className="input-section double">
            <div className="input-group">
              <label htmlFor="transfer-to">Dirección destino</label>
              <input
                id="transfer-to"
                ref={toAddressInputRef}
                type="text"
                placeholder="0x..."
                className="input-field"
                disabled={loadingOperations.has('transfer')}
              />
            </div>
            <div className="input-group">
              <label htmlFor="transfer-amount">Cantidad</label>
              <input
                id="transfer-amount"
                ref={transferAmountInputRef}
                type="text"
                placeholder="Ej: 5.25"
                onChange={handleAmountChange}
                className="input-field"
                disabled={loadingOperations.has('transfer')}
              />
            </div>
          </div>
          <button 
            onClick={transferTokens} 
            disabled={loadingOperations.has('transfer')} 
            className={`operation-button primary ${loadingOperations.has('transfer') ? 'loading' : ''}`}
          >
            {loadingOperations.has('transfer') ? 'Transferiendo...' : 'Transferir'}
          </button>
        </div>

        {/* Withdraw */}
        <div className="operation-group">
          <h3>Retiro</h3>
          <div className="operation-layout horizontal">
            <div className="input-group">
              <label htmlFor="withdraw-amount">Cantidad a retirar</label>
              <input
                id="withdraw-amount"
                ref={withdrawInputRef}
                type="text"
                placeholder="Ej: 5.5"
                onChange={handleAmountChange}
                className="input-field"
                disabled={loadingOperations.has('withdraw')}
              />
            </div>
            <button 
              onClick={withdrawTokens} 
              disabled={loadingOperations.has('withdraw')} 
              className={`operation-button primary ${loadingOperations.has('withdraw') ? 'loading' : ''}`}
            >
              {loadingOperations.has('withdraw') ? 'Retirando...' : 'Retirar Tokens'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Standalone Page Component
  const StandalonePage = () => (
    <div className="standalone-page">
      <div className="page-header">
        <h2>eERC Standalone</h2>
        <p>Tokens nativos encriptados con capacidades de mint/burn</p>
      </div>
      
      <div className="standalone-content">
        {/* Registration */}
        <div className="operation-group">
          <h3>Registro</h3>
          {!isRegistered ? (
            <div className="operation-layout compact">
              <div className="input-group">
                <label>Estado de registro</label>
                <div className="input-field" style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}>
                  Usuario no registrado
                </div>
              </div>
              <button 
                onClick={registerUserStandalone} 
                disabled={loadingOperations.has('register-standalone')} 
                className={`operation-button primary ${loadingOperations.has('register-standalone') ? 'loading' : ''}`}
              >
                {loadingOperations.has('register-standalone') ? 'Registrando...' : 'Registrar Usuario'}
              </button>
            </div>
          ) : (
            <div className="status-success">Usuario registrado</div>
          )}
        </div>

        {/* Balance */}
        <div className="operation-group">
          <h3>Balance</h3>
          <div className="balance-info">
            <p>Balance PRIV: {privateBalance || '0'} PRIV</p>
          </div>
          <div className="operation-layout compact">
            <div className="input-group">
              <label>Última actualización</label>
              <div className="input-field" style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}>
                {new Date().toLocaleTimeString()}
              </div>
            </div>
            <button 
              onClick={checkBalanceStandalone} 
              disabled={loadingOperations.has('balance-standalone')} 
              className={`operation-button secondary ${loadingOperations.has('balance-standalone') ? 'loading' : ''}`}
            >
              {loadingOperations.has('balance-standalone') ? 'Actualizando...' : 'Actualizar Balance'}
            </button>
          </div>
        </div>

        {/* Mint */}
        <div className="operation-group">
          <h3>Mint Tokens</h3>
          <p className="operation-note">Solo el propietario del contrato puede acuñar tokens</p>
          <div className="operation-layout horizontal">
            <div className="input-group">
              <label htmlFor="mint-amount">Cantidad a acuñar</label>
              <input
                id="mint-amount"
                type="text"
                placeholder="Ej: 100"
                onChange={handleAmountChange}
                className="input-field"
                disabled={loadingOperations.has('mint')}
              />
            </div>
            <button 
              onClick={mintTokens} 
              disabled={loadingOperations.has('mint')} 
              className={`operation-button primary ${loadingOperations.has('mint') ? 'loading' : ''}`}
            >
              {loadingOperations.has('mint') ? 'Acuñando...' : 'Acuñar Tokens'}
            </button>
          </div>
        </div>

        {/* Transfer */}
        <div className="operation-group">
          <h3>Transferencia Privada</h3>
          <div className="input-section double">
            <div className="input-group">
              <label htmlFor="transfer-to-standalone">Dirección destino</label>
              <input
                id="transfer-to-standalone"
                type="text"
                placeholder="0x..."
                className="input-field"
                disabled={loadingOperations.has('transfer-standalone')}
              />
            </div>
            <div className="input-group">
              <label htmlFor="transfer-amount-standalone">Cantidad</label>
              <input
                id="transfer-amount-standalone"
                type="text"
                placeholder="Ej: 50"
                onChange={handleAmountChange}
                className="input-field"
                disabled={loadingOperations.has('transfer-standalone')}
              />
            </div>
          </div>
          <button 
            onClick={transferTokensStandalone} 
            disabled={loadingOperations.has('transfer-standalone')} 
            className={`operation-button primary ${loadingOperations.has('transfer-standalone') ? 'loading' : ''}`}
          >
            {loadingOperations.has('transfer-standalone') ? 'Transferiendo...' : 'Transferir'}
          </button>
        </div>

        {/* Burn */}
        <div className="operation-group">
          <h3>Burn Tokens</h3>
          <p className="operation-note danger">Quemar tokens los destruye permanentemente</p>
          <div className="operation-layout horizontal">
            <div className="input-group">
              <label htmlFor="burn-amount">Cantidad a quemar</label>
              <input
                id="burn-amount"
                type="text"
                placeholder="Ej: 25"
                onChange={handleAmountChange}
                className="input-field"
                disabled={loadingOperations.has('burn')}
              />
            </div>
            <button 
              onClick={burnTokens} 
              disabled={loadingOperations.has('burn')} 
              className={`operation-button danger ${loadingOperations.has('burn') ? 'loading' : ''}`}
            >
              {loadingOperations.has('burn') ? 'Quemando...' : 'Quemar Tokens'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Builder Input Components
  const BuilderInput = ({ label, type = "text", placeholder, value, onChange, required = false, options = null, small = null }) => {
    return (
      <div className="input-group">
        <label>{label} {required && '*'}</label>
        {type === "select" ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input-field"
          >
            {options}
          </select>
        ) : (
          <input
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input-field"
          />
        )}
        {small && <small>{small}</small>}
      </div>
    );
  };

  const BuilderStep1 = () => (
    <div className="builder-step">
      <div className="step-header">
        <h2>Paso 1: Configuración Básica</h2>
        <div className="step-indicator">1 de 3</div>
      </div>
      
      <div className="form-section">
        <BuilderInput
          label="Nombre del Token"
          placeholder="Mi Token Privado"
          value={contractConfig.name}
          onChange={(value) => updateContractConfig('name', value)}
          required={true}
        />
        
        <BuilderInput
          label="Símbolo del Token"
          placeholder="MTP"
          value={contractConfig.symbol}
          onChange={(value) => updateContractConfig('symbol', value)}
          required={true}
        />
        
        <BuilderInput
          label="Supply Inicial"
          placeholder="1000000"
          value={contractConfig.initialSupply}
          onChange={(value) => updateContractConfig('initialSupply', value)}
          required={true}
          small="Cantidad total de tokens a crear"
        />
      </div>
      
      <div className="step-actions">
        <button onClick={() => setCurrentView('overview')} className="operation-button secondary">
          Cancelar
        </button>
        <button 
          onClick={nextBuilderStep}
          disabled={!contractConfig.name || !contractConfig.symbol || !contractConfig.initialSupply}
          className="operation-button primary"
        >
          Siguiente
        </button>
      </div>
    </div>
  );

  const BuilderStep2 = () => (
    <div className="builder-step">
      <div className="step-header">
        <h2>Paso 2: {builderType === 'migrate' ? 'Contrato Existente' : 'Configuración Final'}</h2>
        <div className="step-indicator">2 de 3</div>
      </div>
      
      {builderType === 'migrate' ? (
        <div className="form-section">
          <BuilderInput
            label="Dirección del Contrato ERC20 Existente"
            placeholder="0x..."
            value={contractConfig.existingContract}
            onChange={(value) => updateContractConfig('existingContract', value)}
            required={true}
            small="Dirección del contrato ERC20 que quieres migrar"
          />
          
          <div className="migration-info">
            <h4>📋 Información de Migración</h4>
            <ul>
              <li>Se creará un nuevo contrato eERC20</li>
              <li>Los tokens existentes se pueden migrar gradualmente</li>
              <li>Se mantiene la funcionalidad original</li>
              <li>Se agregan capacidades de privacidad</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="form-section">
          <div className="config-summary">
            <h4>📋 Resumen de Configuración</h4>
            <div className="summary-grid">
              <div className="summary-item">
                <strong>Nombre:</strong> {contractConfig.name || 'No especificado'}
              </div>
              <div className="summary-item">
                <strong>Símbolo:</strong> {contractConfig.symbol || 'No especificado'}
              </div>
              <div className="summary-item">
                <strong>Supply:</strong> {contractConfig.initialSupply || '0'} tokens
              </div>
              <div className="summary-item">
                <strong>Red:</strong> Fuji Testnet
              </div>
              <div className="summary-item">
                <strong>Propietario:</strong> {walletAddress || 'Tu wallet'}
              </div>
            </div>
          </div>
          
          <div className="config-note">
            <p>✅ Configuración automática incluida:</p>
            <ul>
              <li>Funciones de auditoría</li>
              <li>Capacidades de pausado</li>
              <li>18 decimales (estándar)</li>
              <li>Scripts de despliegue completos</li>
            </ul>
          </div>
        </div>
      )}
      
      <div className="step-actions">
        <button onClick={prevBuilderStep} className="operation-button secondary">
          Anterior
        </button>
        <button 
          onClick={nextBuilderStep}
          disabled={builderType === 'migrate' && !contractConfig.existingContract}
          className="operation-button primary"
        >
          Siguiente
        </button>
      </div>
    </div>
  );



  // Builder Page Component
  const BuilderPage = useCallback(() => {
    const renderStep = useCallback(() => {
      switch (builderStep) {
        case 0:
          return (
            <div className="builder-welcome">
              <h2>🏗️ Contract Builder</h2>
              <p>Genera contratos eERC20 personalizados o migra contratos ERC20 existentes</p>
              
              <div className="builder-options">
                <div className="builder-option" onClick={() => startBuilder('from-scratch')}>
                  <div className="option-icon">🆕</div>
                  <h3>Crear desde Cero</h3>
                  <p>Genera un nuevo contrato eERC20 con configuración personalizada</p>
                  <ul>
                    <li>Token completamente nuevo</li>
                    <li>Configuración personalizada</li>
                    <li>Scripts de despliegue incluidos</li>
                  </ul>
                </div>
                
                <div className="builder-option" onClick={() => startBuilder('migrate')}>
                  <div className="option-icon">🔄</div>
                  <h3>Migrar ERC20 Existente</h3>
                  <p>Convierte un contrato ERC20 existente a eERC20 con privacidad</p>
                  <ul>
                    <li>Migración de tokens existentes</li>
                    <li>Mantiene funcionalidad original</li>
                    <li>Scripts de migración incluidos</li>
                  </ul>
                </div>
              </div>
            </div>
          );
          
        case 1:
          return <BuilderStep1 />;
          
                 case 2:
           return <BuilderStep2 />;
           
         case 3:
           return (
             <div className="builder-step">
               <div className="step-header">
                 <h2>Paso 3: {builderType === 'migrate' ? 'Revisar Migración' : 'Revisar y Generar'}</h2>
                 <div className="step-indicator">3 de 3</div>
               </div>
               
               {builderType === 'migrate' ? (
                 <div className="config-review">
                   <h4>📋 Resumen de Migración</h4>
                   <div className="review-grid">
                     <div className="review-item">
                       <strong>Contrato Existente:</strong> {contractConfig.existingContract}
                     </div>
                     <div className="review-item">
                       <strong>Red:</strong> {contractConfig.network}
                     </div>
                     <div className="review-item">
                       <strong>Propietario:</strong> {contractConfig.owner}
                     </div>
                   </div>
                   
                   <div className="migration-info">
                     <h4>🔄 Proceso de Migración</h4>
                     <ul>
                       <li>Se validará el contrato ERC20 existente</li>
                       <li>Se desplegará el sistema Converter</li>
                       <li>Se configurará la migración de tokens</li>
                       <li>Se generarán scripts personalizados para migrar tokens</li>
                       <li>Los tokens se convertirán de formato público a encriptado</li>
                     </ul>
                   </div>
                   
                   <div className="migration-benefits">
                     <h4>✅ Beneficios de la Migración</h4>
                     <ul>
                       <li>Mantiene el contrato ERC20 original intacto</li>
                       <li>Agrega capacidades de privacidad a los tokens</li>
                       <li>Permite transferencias privadas</li>
                       <li>Mantiene compatibilidad con el ecosistema existente</li>
                     </ul>
                   </div>
                 </div>
               ) : (
                 <div className="config-review">
                   <h4>📋 Resumen de Configuración</h4>
                   <div className="review-grid">
                     <div className="review-item">
                       <strong>Nombre:</strong> {contractConfig.name}
                     </div>
                     <div className="review-item">
                       <strong>Símbolo:</strong> {contractConfig.symbol}
                     </div>
                     <div className="review-item">
                       <strong>Decimales:</strong> {contractConfig.decimals}
                     </div>
                     <div className="review-item">
                       <strong>Supply Inicial:</strong> {contractConfig.initialSupply}
                     </div>
                     <div className="review-item">
                       <strong>Propietario:</strong> {contractConfig.owner}
                     </div>
                     <div className="review-item">
                       <strong>Red:</strong> {contractConfig.network}
                     </div>
                   </div>
                   
                   <div className="generation-info">
                     <h4>🔧 Lo que se generará:</h4>
                     <ul>
                       <li>Contrato principal eERC20</li>
                       <li>Contrato de registro de usuarios</li>
                       <li>Contrato verificador de ZK proofs</li>
                       <li>Scripts de despliegue</li>
                       <li>Scripts de configuración</li>
                       <li>Archivo de configuración Hardhat</li>
                       <li>Documentación de uso</li>
                     </ul>
                   </div>
                 </div>
               )}
               
               <div className="step-actions">
                 <button onClick={prevBuilderStep} className="operation-button secondary">
                   Anterior
                 </button>
                 <button 
                   onClick={generateContracts}
                   disabled={loading}
                   className="operation-button primary"
                 >
                   {loading ? 'Procesando...' : (builderType === 'migrate' ? 'Configurar Migración' : 'Generar Contratos')}
                 </button>
               </div>
             </div>
           );
          
        case 3:
          return (
            <div className="builder-step">
              <div className="step-header">
                <h2>Paso 3: Revisar y Generar</h2>
                <div className="step-indicator">3 de 3</div>
              </div>
              
              <div className="config-review">
                <h4>📋 Resumen de Configuración</h4>
                <div className="review-grid">
                  <div className="review-item">
                    <strong>Nombre:</strong> {contractConfig.name}
                  </div>
                  <div className="review-item">
                    <strong>Símbolo:</strong> {contractConfig.symbol}
                  </div>
                  <div className="review-item">
                    <strong>Decimales:</strong> {contractConfig.decimals}
                  </div>
                  <div className="review-item">
                    <strong>Supply Inicial:</strong> {contractConfig.initialSupply}
                  </div>
                  <div className="review-item">
                    <strong>Propietario:</strong> {contractConfig.owner}
                  </div>
                  <div className="review-item">
                    <strong>Red:</strong> {contractConfig.network}
                  </div>
                  {builderType === 'migrate' && (
                    <div className="review-item">
                      <strong>Contrato Existente:</strong> {contractConfig.existingContract}
                    </div>
                  )}
                </div>
                
                <div className="generation-info">
                  <h4>🔧 Lo que se generará:</h4>
                  <ul>
                    <li>Contrato principal eERC20</li>
                    <li>Contrato de registro de usuarios</li>
                    <li>Contrato verificador de ZK proofs</li>
                    <li>Scripts de despliegue</li>
                    <li>Scripts de configuración</li>
                    <li>Archivo de configuración Hardhat</li>
                    <li>Documentación de uso</li>
                  </ul>
                </div>
              </div>
              
              <div className="step-actions">
                <button onClick={prevBuilderStep} className="operation-button secondary">
                  Anterior
                </button>
                <button 
                  onClick={generateContracts}
                  disabled={loading}
                  className="operation-button primary"
                >
                  {loading ? 'Generando...' : 'Generar Contratos'}
                </button>
              </div>
            </div>
          );
          
                 case 4:
           return (
             <div className="builder-results">
               <div className="results-header">
                 <h2>✅ {builderType === 'migrate' ? 'Migración Configurada' : 'Contratos eERC20 Desplegados'}</h2>
                 <p>{builderType === 'migrate' 
                   ? `Migración de contrato ERC20 configurada exitosamente en ${contractConfig.network}`
                   : `Tus contratos eERC20 han sido desplegados exitosamente en ${contractConfig.network}`
                 }</p>
               </div>
               
               <div className="results-container">
                 <div className="results-sidebar">
                   <div className="sidebar-section">
                     <h4>🎯 Estado del Proceso</h4>
                     <div className="status-summary">
                       {generatedContracts && Object.entries(generatedContracts).map(([step, result]) => (
                         <div key={step} className={`status-item ${result.success ? 'success' : 'error'}`}>
                           <span className="status-icon">
                             {result.success ? '✅' : '❌'}
                           </span>
                           <span className="status-text">{step}</span>
                         </div>
                       ))}
                     </div>
                   </div>
                   
                   {builderType === 'migrate' && generatedContracts?.contractInfo && (
                     <div className="sidebar-section">
                       <h4>📋 Contrato Validado</h4>
                       <div className="contract-summary">
                         <div className="summary-item">
                           <span className="label">Nombre:</span>
                           <span className="value">{generatedContracts.contractInfo.name}</span>
                         </div>
                         <div className="summary-item">
                           <span className="label">Símbolo:</span>
                           <span className="value">{generatedContracts.contractInfo.symbol}</span>
                         </div>
                         <div className="summary-item">
                           <span className="label">Dirección:</span>
                           <span className="value address">{generatedContracts.contractInfo.address}</span>
                         </div>
                       </div>
                     </div>
                   )}
                   
                   <div className="sidebar-section">
                     <h4>🔧 Acciones Rápidas</h4>
                     <div className="quick-actions">
                       <button 
                         onClick={() => downloadContracts('json')}
                         className="quick-action-btn"
                       >
                         📊 Descargar Config
                       </button>
                       <button 
                         onClick={() => copyToClipboard(JSON.stringify(generatedContracts, null, 2))}
                         className="quick-action-btn"
                       >
                         📋 Copiar Todo
                       </button>
                     </div>
                   </div>
                 </div>
                 
                 <div className="results-main">
                   <div className="main-section">
                     <h4>🏗️ Contratos Desplegados</h4>
                     <div className="contracts-grid">
                       {generatedContracts && Object.entries(generatedContracts).map(([step, result]) => {
                         if (step === 'contractInfo' || step === 'migrationScripts') return null;
                         
                         // Extraer información relevante del stdout
                         const contractAddress = extractContractAddress(result.stdout);
                         const contractName = getContractName(step);
                         
                         return (
                           <div key={step} className="contract-card">
                             <div className="contract-header">
                               <div className="contract-icon">{getContractIcon(step)}</div>
                               <div className="contract-info">
                                 <h5>{contractName}</h5>
                                 <span className="contract-type">{getContractType(step)}</span>
                               </div>
                               <span className={`status-badge ${result.success ? 'success' : 'error'}`}>
                                 {result.success ? 'Desplegado' : 'Error'}
                               </span>
                             </div>
                             
                             {contractAddress && (
                               <div className="contract-address">
                                 <span className="label">Dirección:</span>
                                 <span className="address">{contractAddress}</span>
                                 <button 
                                   onClick={() => copyToClipboard(contractAddress)}
                                   className="copy-btn"
                                   title="Copiar dirección"
                                 >
                                   📋
                                 </button>
                               </div>
                             )}
                             
                             <div className="contract-details">
                               <div className="detail-row">
                                 <span className="detail-label">Script:</span>
                                 <span className="detail-value">{result.script}</span>
                               </div>
                               <div className="detail-row">
                                 <span className="detail-label">Red:</span>
                                 <span className="detail-value">{result.network}</span>
                               </div>
                               <div className="detail-row">
                                 <span className="detail-label">Estado:</span>
                                 <span className={`detail-value ${result.success ? 'success' : 'error'}`}>
                                   {result.success ? '✅ Exitoso' : '❌ Falló'}
                                 </span>
                               </div>
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                   
                   {builderType === 'migrate' && generatedContracts?.migrationScripts && (
                     <div className="main-section">
                       <h4>📝 Scripts de Migración</h4>
                       <p>Scripts personalizados generados para migrar tus tokens:</p>
                       <div className="scripts-grid">
                         {Object.entries(generatedContracts.migrationScripts).map(([filename, content]) => (
                           <div key={filename} className="script-card">
                             <div className="script-header">
                               <h5>{filename}</h5>
                               <button 
                                 onClick={() => copyToClipboard(content)}
                                 className="copy-button"
                               >
                                 📋 Copiar Script
                               </button>
                             </div>
                             <div className="script-preview">
                               <code>{content.substring(0, 200)}...</code>
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}
                   
                   <div className="main-section">
                     <h4>📋 Información Detallada</h4>
                     <div className="detailed-info">
                       {builderType === 'migrate' && generatedContracts?.contractInfo && (
                         <div className="info-card">
                           <h5>📋 Detalles del Contrato ERC20</h5>
                           <div className="info-grid">
                             <div className="info-item">
                               <span className="info-label">Nombre:</span>
                               <span className="info-value">{generatedContracts.contractInfo.name}</span>
                             </div>
                             <div className="info-item">
                               <span className="info-label">Símbolo:</span>
                               <span className="info-value">{generatedContracts.contractInfo.symbol}</span>
                             </div>
                             <div className="info-item">
                               <span className="info-label">Decimales:</span>
                               <span className="info-value">{generatedContracts.contractInfo.decimals}</span>
                             </div>
                             <div className="info-item">
                               <span className="info-label">Supply Total:</span>
                               <span className="info-value">{generatedContracts.contractInfo.totalSupply}</span>
                             </div>
                             <div className="info-item full-width">
                               <span className="info-label">Dirección:</span>
                               <span className="info-value address">{generatedContracts.contractInfo.address}</span>
                             </div>
                           </div>
                         </div>
                       )}
                       
                       <div className="info-card">
                         <h5>⚙️ Configuración del Sistema</h5>
                         <div className="info-grid">
                           <div className="info-item">
                             <span className="info-label">Red:</span>
                             <span className="info-value">{contractConfig.network}</span>
                           </div>
                           <div className="info-item">
                             <span className="info-label">Tipo:</span>
                             <span className="info-value">{builderType === 'migrate' ? 'Migración' : 'Desde Cero'}</span>
                           </div>
                           <div className="info-item">
                             <span className="info-label">Fecha:</span>
                             <span className="info-value">{new Date().toLocaleDateString()}</span>
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
               
               {/* Botón para registrar usuario */}
               {builderType === 'migrate' && (
                 <div className="register-user-section">
                   <h4>🔑 Registro de Usuario</h4>
                   <p>Registra tu wallet en el sistema Converter generado:</p>
                   <button 
                     className="register-user-btn"
                     onClick={handleRegisterUser}
                     disabled={registeringUser}
                   >
                     {registeringUser ? '🔄 Registrando...' : '🔑 Registrar Usuario'}
                   </button>
                   {registerUserMessage && (
                     <div className={`register-message ${registerUserMessage.includes('✅') ? 'success' : 'error'}`}>
                       {registerUserMessage}
                     </div>
                   )}
                 </div>
               )}
               
               {/* Botón para generar mini-dapp */}
               {generatedContracts && (
                 <div className="dapp-builder-section">
                   <h4>🚀 Generar Mini-Dapp</h4>
                   <p>Crea una aplicación de pagos privados personalizada con tus contratos:</p>
                   <button 
                     className="dapp-builder-btn"
                     onClick={() => {
                       setShowDappBuilder(true);
                       setDappBuilderView('form');
                       setCurrentView('dapp-builder');
                     }}
                   >
                     🎨 Crear Mini-Dapp
                   </button>
                   <button 
                     className="debug-btn"
                     onClick={() => {
                       const savedAddress = localStorage.getItem('lastContractAddress');
                       console.log('🔍 Debug - Dirección guardada:', savedAddress);
                       console.log('🔍 Debug - Contratos generados:', generatedContracts);
                       alert(`Dirección guardada: ${savedAddress || 'No encontrada'}\n\nRevisa la consola para más detalles`);
                     }}
                     style={{ marginLeft: '10px', fontSize: '12px', padding: '5px 10px', backgroundColor: '#ff6b6b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                   >
                     🐛 Debug
                   </button>
                 </div>
               )}
               
               <div className="next-steps">
                 <h4>🚀 Próximos Pasos</h4>
                 <p>{builderType === 'migrate' 
                   ? 'Ahora que la migración está configurada, puedes continuar con el proceso:'
                   : 'Ahora que tus contratos están desplegados, puedes continuar con la configuración:'
                 }</p>
                 <ol>
                   {builderType === 'migrate' ? (
                     <>
                       <li><strong>Registrar usuarios:</strong> npx hardhat run scripts/converter/03_register-user.ts --network {contractConfig.network}</li>
                       <li><strong>Configurar auditor:</strong> npx hardhat run scripts/converter/04_set-auditor.ts --network {contractConfig.network}</li>
                       <li><strong>Migrar tokens existentes:</strong> Usar el script generado migrate-tokens.js</li>
                       <li><strong>Verificar balances encriptados:</strong> Usar el script generado check-migrated-balance.js</li>
                       <li><strong>Realizar transferencias privadas:</strong> npx hardhat run scripts/converter/07_transfer.ts --network {contractConfig.network}</li>
                     </>
                   ) : (
                     <>
                       <li><strong>Registrar usuarios:</strong> npx hardhat run scripts/converter/03_register-user.ts --network {contractConfig.network}</li>
                       <li><strong>Configurar auditor:</strong> npx hardhat run scripts/converter/04_set-auditor.ts --network {contractConfig.network}</li>
                       <li><strong>Obtener tokens de prueba:</strong> npx hardhat run scripts/converter/05_get_faucet.ts --network {contractConfig.network}</li>
                       <li><strong>Hacer depósitos:</strong> npx hardhat run scripts/converter/06_deposit.ts --network {contractConfig.network}</li>
                       <li><strong>Verificar balances:</strong> npx hardhat run scripts/converter/08_check_balance.ts --network {contractConfig.network}</li>
                       <li><strong>Realizar transferencias privadas:</strong> npx hardhat run scripts/converter/07_transfer.ts --network {contractConfig.network}</li>
                     </>
                   )}
                 </ol>
               </div>
               
               {builderType === 'migrate' && generatedContracts?.migrationScripts && (
                 <div className="migration-scripts">
                   <h4>📝 Scripts de Migración Generados</h4>
                   <p>Se han generado scripts personalizados para migrar tus tokens:</p>
                   <div className="scripts-list">
                     {Object.entries(generatedContracts.migrationScripts).map(([filename, content]) => (
                       <div key={filename} className="script-item">
                         <div className="script-header">
                           <h5>{filename}</h5>
                           <button 
                             onClick={() => copyToClipboard(content)}
                             className="copy-button"
                           >
                             📋 Copiar
                           </button>
                         </div>
                         <pre className="script-preview">
                           <code>{content.substring(0, 300)}...</code>
                         </pre>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
               
               <div className="download-options">
                 <h4>📥 Descargar Logs</h4>
                 <div className="download-buttons">
                   <button 
                     onClick={() => downloadContracts('txt')}
                     className="operation-button secondary"
                   >
                     📄 Descargar Logs TXT
                   </button>
                   <button 
                     onClick={() => downloadContracts('json')}
                     className="operation-button secondary"
                   >
                     📊 Descargar Logs JSON
                   </button>
                 </div>
               </div>
               
               <div className="step-actions">
                 <button onClick={resetBuilder} className="operation-button secondary">
                   Desplegar Otros Contratos
                 </button>
                 <button onClick={() => setCurrentView('overview')} className="operation-button primary">
                   Volver al Dashboard
                 </button>
               </div>
             </div>
           );
          
        default:
          return null;
      }
    }, [builderStep, builderType, contractConfig, loading, generatedContracts, startBuilder, prevBuilderStep, generateContracts, downloadContracts, copyToClipboard, resetBuilder, extractContractAddress, getContractName, getContractIcon, getContractType, handleRegisterUser, showDappBuilder, dappConfig, generatingDapp, dappProgress, generatedDapp, dappPreviewUrl]);

    return (
      <div className="builder-page">
        <div className="page-header">
          <h2>Contract Builder</h2>
          <p>Genera contratos eERC20 personalizados paso a paso</p>
        </div>
        
        <div className="builder-content">
          {renderStep()}
        </div>
      </div>
    );
  }, [builderStep, builderType, contractConfig, loading, generatedContracts, startBuilder, prevBuilderStep, generateContracts, downloadContracts, copyToClipboard, resetBuilder, extractContractAddress, getContractName, getContractIcon, getContractType, handleRegisterUser, showDappBuilder, dappConfig, generatingDapp, dappProgress, generatedDapp, dappPreviewUrl]);

  // Generar mini-dapp
  const handleGenerateDapp = useCallback(async () => {
    if (!generatedContracts) {
      setRegisterUserMessage('❌ No hay contratos generados');
      return;
    }

    setGeneratingDapp(true);
    setDappProgress('�� Iniciando generación de mini-dapp...');

    try {
      const response = await fetchWithTimeout('http://localhost:3002/api/generate-dapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dappConfig,
          contracts: generatedContracts
        }),
      }, 300000); // 5 minutos timeout

      const data = await response.json();

      if (data.success) {
        setGeneratedDapp(data.dapp);
        setDappProgress('✅ Mini-dapp generada exitosamente');
        
        // Esperar un poco para que los servicios se inicien
        setTimeout(() => {
          setDappBuilderView('preview'); // Cambiar a vista de preview
        }, 5000); // Esperar 5 segundos para que los servicios se inicien
      } else {
        setDappProgress(`❌ Error: ${data.message}`);
      }
    } catch (error) {
      console.error('Error generating dapp:', error);
      setDappProgress(`❌ Error: ${error.message}`);
    } finally {
      setGeneratingDapp(false);
    }
  }, [dappConfig, generatedContracts, fetchWithTimeout]);

  // Descargar ZIP de la dapp
  const handleDownloadDapp = useCallback(async () => {
    if (!generatedDapp) return;

    try {
      const response = await fetch(`http://localhost:3002/api/download-dapp/${generatedDapp.id}`);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dappConfig.name || 'private-payments-dapp'}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Limpiar la dapp generada
      setGeneratedDapp(null);
      setDappPreviewUrl('');
      setShowDappBuilder(false);
    } catch (error) {
      console.error('Error downloading dapp:', error);
    }
  }, [generatedDapp, dappConfig.name]);

  // Limpiar dapp al salir
  const handleCleanupDapp = useCallback(async () => {
    if (generatedDapp) {
      try {
        await fetch(`http://localhost:3002/api/cleanup-dapp/${generatedDapp.id}`, { method: 'DELETE' });
      } catch (error) {
        console.error('Error cleaning up dapp:', error);
      }
    }
    setGeneratedDapp(null);
    setDappPreviewUrl('');
    setShowDappBuilder(false);
  }, [generatedDapp]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      handleCleanupDapp();
    };
  }, [handleCleanupDapp]);

  // Dapp Builder Page Component
  const DappBuilderPage = useCallback(() => {
    return (
      <div className="dapp-builder-page">
        <div className="page-header">
          <h2>🎨 Mini-Dapp Builder</h2>
          <p>Personaliza y genera tu aplicación de pagos privados</p>
        </div>

        {dappBuilderView === 'form' && (
          <div className="dapp-form-section">
            <div className="form-container">
              <h3>Configuración de la Dapp</h3>
              
              <div className="config-section">
                <label>Nombre de la aplicación:</label>
                <input
                  type="text"
                  value={dappConfig.name}
                  onChange={(e) => setDappConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Mi App de Pagos Privados"
                />
              </div>

              <div className="config-section">
                <label>Color principal:</label>
                <div className="color-input">
                  <input
                    type="color"
                    value={dappConfig.primaryColor}
                    onChange={(e) => setDappConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                  />
                  <input
                    type="text"
                    value={dappConfig.primaryColor}
                    onChange={(e) => setDappConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                    placeholder="#3B82F6"
                  />
                </div>
              </div>

              <div className="config-section">
                <label>Color secundario:</label>
                <div className="color-input">
                  <input
                    type="color"
                    value={dappConfig.secondaryColor}
                    onChange={(e) => setDappConfig(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  />
                  <input
                    type="text"
                    value={dappConfig.secondaryColor}
                    onChange={(e) => setDappConfig(prev => ({ ...prev, secondaryColor: e.target.value }))}
                    placeholder="#1E40AF"
                  />
                </div>
              </div>

              <div className="config-section">
                <label>Logo (URL):</label>
                <input
                  type="url"
                  value={dappConfig.logo}
                  onChange={(e) => setDappConfig(prev => ({ ...prev, logo: e.target.value }))}
                  placeholder="https://ejemplo.com/logo.png"
                />
              </div>

              <div className="form-actions">
                <button
                  className="generate-dapp-btn"
                  onClick={handleGenerateDapp}
                  disabled={generatingDapp || !dappConfig.name}
                >
                  {generatingDapp ? '🔄 Generando...' : '🚀 Generar Mini-Dapp'}
                </button>

                <button
                  className="back-btn"
                  onClick={() => setCurrentView('builder')}
                >
                  ← Volver al Builder
                </button>
              </div>

              {dappProgress && (
                <div className="progress-message">
                  {dappProgress}
                </div>
              )}
            </div>
          </div>
        )}

        {dappBuilderView === 'preview' && generatedDapp && (
          <div className="dapp-preview-section">
            <div className="preview-header">
              <h3>✅ ¡Mini-Dapp generada exitosamente!</h3>
              <p>Tu aplicación de pagos privados está lista para usar.</p>
            </div>

            <div className="preview-container">
              <div className="preview-actions">
                <button className="preview-dapp-btn" onClick={() => window.open(generatedDapp.urls?.frontend || `http://localhost:${generatedDapp.ports?.frontend}`, '_blank')}>
                  👁️ Ver Demo en Nueva Pestaña
                </button>
                <button className="download-dapp-btn" onClick={handleDownloadDapp}>
                  📦 Descargar ZIP
                </button>
                <button className="back-btn" onClick={() => setCurrentView('builder')}>
                  ← Volver al Builder
                </button>
              </div>

              <div className="embedded-preview">
                <h4>🎨 Tu Mini-Dapp Personalizada</h4>
                <div className="iframe-container">
                  <iframe
                    src={generatedDapp.urls?.frontend || `http://localhost:${generatedDapp.ports?.frontend}`}
                    title="Mini-Dapp Preview"
                    width="100%"
                    height="600px"
                    frameBorder="0"
                    allow="camera; microphone; geolocation"
                    onLoad={() => console.log('✅ Mini-dapp cargada en iframe')}
                    onError={() => console.error('❌ Error cargando mini-dapp en iframe')}
                  />
                  <div className="iframe-loading">
                    <p>🔄 Cargando mini-dapp...</p>
                    <p>Si no se carga automáticamente, haz clic en el enlace de arriba</p>
                  </div>
                </div>
              </div>

              <div className="dapp-info">
                <h5>Información de la aplicación:</h5>
                <ul>
                  <li><strong>Nombre:</strong> {dappConfig.name}</li>
                  <li><strong>Contrato eERC20:</strong> {generatedDapp.contractAddress}</li>
                  <li><strong>Frontend:</strong> <a href={generatedDapp.urls?.frontend || `http://localhost:${generatedDapp.ports?.frontend}`} target="_blank" rel="noopener noreferrer">http://localhost:{generatedDapp.ports?.frontend}</a></li>
                  <li><strong>Backend:</strong> <a href={generatedDapp.urls?.backend || `http://localhost:${generatedDapp.ports?.backend}`} target="_blank" rel="noopener noreferrer">http://localhost:{generatedDapp.ports?.backend}</a></li>
                  <li><strong>Funcionalidades:</strong> Mint, Transfer, Burn, Balance Check</li>
                  <li><strong>Tecnologías:</strong> React.js + Node.js + Express</li>
                  <li><strong>Colores personalizados:</strong> {dappConfig.primaryColor} / {dappConfig.secondaryColor}</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }, [dappBuilderView, dappConfig, generatingDapp, dappProgress, generatedDapp, dappPreviewUrl, handleGenerateDapp, handleDownloadDapp]);

  return (
    <div className="App">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">AT</div>
            <span className="logo-text">AVALTOOLKIT</span>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
            ✕
          </button>
        </div>
        
        <nav className="sidebar-nav">
          <div className="nav-section">
            <h3>Navegación</h3>
            <button 
              className={`nav-item ${currentView === 'overview' ? 'active' : ''}`}
              onClick={() => setCurrentView('overview')}
            >
              <span className="nav-icon">📊</span>
              Dashboard
            </button>
            <button 
              className={`nav-item ${currentView === 'converter' ? 'active' : ''}`}
              onClick={() => setCurrentView('converter')}
            >
              <span className="nav-icon">🔄</span>
              eERC Converter
            </button>
            <button 
              className={`nav-item ${currentView === 'standalone' ? 'active' : ''}`}
              onClick={() => setCurrentView('standalone')}
            >
              <span className="nav-icon">⚡</span>
              eERC Standalone
            </button>
            <button 
              className={`nav-item ${currentView === 'builder' ? 'active' : ''}`}
              onClick={() => setCurrentView('builder')}
            >
              <span className="nav-icon">🏗️</span>
              Contract Builder
            </button>
          </div>
          
          {isConnected && (
            <div className="nav-section">
              <h3>Wallet</h3>
              <div className="wallet-info">
                <span className="wallet-address">{walletAddress}</span>
                <span className="wallet-status registered">
                  ✓ Conectado
                </span>
              </div>
            </div>
          )}
          
          <div className="nav-section">
            <h3>Herramientas</h3>
            <button className="nav-item" onClick={clearCache}>
              <span className="nav-icon">🧹</span>
              Limpiar Cache
            </button>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="main-header">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)}>
            ☰
          </button>
          
          <div className="header-content">
            <h1 className="page-title">
              {currentView === 'landing' && 'AVALTOOLKIT'}
              {currentView === 'overview' && 'Dashboard'}
              {currentView === 'converter' && 'eERC Converter'}
              {currentView === 'standalone' && 'eERC Standalone'}
              {currentView === 'builder' && 'Contract Builder'}
              {currentView === 'dapp-builder' && 'Mini-Dapp Builder'}
            </h1>
            
            {!isConnected && currentView !== 'landing' && (
              <button className="connect-wallet-btn" onClick={connectWallet}>
                <span className="btn-icon">🔗</span>
                Conectar Wallet
              </button>
            )}
            
            {isConnected && (
              <div className="wallet-display">
                <span className="wallet-short">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                <span className="status-indicator registered">
                  ✅
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content">
          {currentView === 'landing' && <LandingPage />}
          {currentView === 'overview' && <OverviewPage />}
          {currentView === 'converter' && <ConverterPage />}
          {currentView === 'standalone' && <StandalonePage />}
          {currentView === 'builder' && <BuilderPage />}
          {currentView === 'dapp-builder' && <DappBuilderPage />}
        </main>

        {/* Message Display */}
        {message && (
          <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}

      {/* Modal de configuración avanzada */}
      {showAdvancedConfig && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>⚙️ Configuración Avanzada</h3>
              <button className="close-btn" onClick={() => setShowAdvancedConfig(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="config-grid">
                <div className="config-item">
                  <label>Decimals:</label>
                  <input
                    type="number"
                    value={contractConfig.decimals}
                    onChange={(e) => setContractConfig(prev => ({ ...prev, decimals: parseInt(e.target.value) }))}
                    min="0"
                    max="18"
                  />
                </div>
                <div className="config-item">
                  <label>Owner:</label>
                  <input
                    type="text"
                    value={contractConfig.owner}
                    onChange={(e) => setContractConfig(prev => ({ ...prev, owner: e.target.value }))}
                    placeholder="0x..."
                  />
                </div>
                <div className="config-item">
                  <label>Network:</label>
                  <select
                    value={contractConfig.network}
                    onChange={(e) => setContractConfig(prev => ({ ...prev, network: e.target.value }))}
                  >
                    <option value="fuji">Fuji Testnet</option>
                    <option value="mainnet">Avalanche Mainnet</option>
                    <option value="localhost">Localhost</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAdvancedConfig(false)}>Cancelar</button>
              <button onClick={() => setShowAdvancedConfig(false)}>Guardar</button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

export default App;
