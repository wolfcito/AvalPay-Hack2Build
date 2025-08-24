import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

// Configuración de la aplicación
const APP_CONFIG = {
  name: '{{APP_NAME}}',
  primaryColor: '{{PRIMARY_COLOR}}',
  secondaryColor: '{{SECONDARY_COLOR}}',
  logo: '{{LOGO_URL}}',
  contractAddress: '{{CONTRACT_ADDRESS}}',
  backendUrl: 'http://localhost:{{BACKEND_PORT}}'
};

function App() {
  const [walletAddress, setWalletAddress] = useState('');
  const [balance, setBalance] = useState('0');
  const [amount, setAmount] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Conectar wallet
  const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setWalletAddress(accounts[0]);
        setMessage('✅ Wallet conectada exitosamente');
      } else {
        setMessage('❌ MetaMask no está instalado');
      }
    } catch (error) {
      setMessage('❌ Error al conectar wallet: ' + error.message);
    }
  };

  // Verificar registro de usuario
  const checkRegistration = async () => {
    if (!walletAddress) {
      setMessage('❌ Conecta tu wallet primero');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${APP_CONFIG.backendUrl}/api/check-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress })
      });

      const data = await response.json();
      if (data.success) {
        if (data.isRegistered) {
          setMessage('✅ Usuario registrado');
        } else {
          setMessage('❌ Usuario no registrado. Usa el botón "Registrar Usuario"');
        }
      } else {
        setMessage('❌ Error: ' + data.message);
      }
    } catch (error) {
      setMessage('❌ Error al verificar registro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Registrar usuario
  const registerUser = async () => {
    if (!walletAddress) {
      setMessage('❌ Conecta tu wallet primero');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${APP_CONFIG.backendUrl}/api/register-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress })
      });

      const data = await response.json();
      if (data.success) {
        setMessage('✅ Usuario registrado exitosamente');
      } else {
        setMessage('❌ Error: ' + data.message);
      }
    } catch (error) {
      setMessage('❌ Error al registrar usuario: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Verificar balance
  const checkBalance = async () => {
    if (!walletAddress) {
      setMessage('❌ Conecta tu wallet primero');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${APP_CONFIG.backendUrl}/api/check-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress })
      });

      const data = await response.json();
      if (data.success) {
        setBalance(data.balance);
        setMessage('✅ Balance actualizado');
      } else {
        setMessage('❌ Error: ' + data.message);
      }
    } catch (error) {
      setMessage('❌ Error al verificar balance: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Mint tokens
  const mintTokens = async () => {
    if (!walletAddress || !amount) {
      setMessage('❌ Completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${APP_CONFIG.backendUrl}/api/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address: walletAddress,
          amount: parseFloat(amount)
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessage('✅ Tokens minteados exitosamente');
        setAmount('');
        checkBalance();
      } else {
        setMessage('❌ Error: ' + data.message);
      }
    } catch (error) {
      setMessage('❌ Error al mintear: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Transferir tokens
  const transferTokens = async () => {
    if (!walletAddress || !toAddress || !amount) {
      setMessage('❌ Completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${APP_CONFIG.backendUrl}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          from: walletAddress,
          to: toAddress,
          amount: parseFloat(amount)
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessage('✅ Transferencia exitosa');
        setAmount('');
        setToAddress('');
        checkBalance();
      } else {
        setMessage('❌ Error: ' + data.message);
      }
    } catch (error) {
      setMessage('❌ Error al transferir: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Burn tokens
  const burnTokens = async () => {
    if (!walletAddress || !amount) {
      setMessage('❌ Completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${APP_CONFIG.backendUrl}/api/burn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address: walletAddress,
          amount: parseFloat(amount)
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessage('✅ Tokens quemados exitosamente');
        setAmount('');
        checkBalance();
      } else {
        setMessage('❌ Error: ' + data.message);
      }
    } catch (error) {
      setMessage('❌ Error al quemar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App" style={{
      '--primary-color': APP_CONFIG.primaryColor,
      '--secondary-color': APP_CONFIG.secondaryColor
    }}>
      <header className="App-header">
        {APP_CONFIG.logo && (
          <img src={APP_CONFIG.logo} alt="Logo" className="App-logo" />
        )}
        <h1>{APP_CONFIG.name}</h1>
        <p>✨ Pagos privados con tecnología ZK</p>
      </header>

      <main className="App-main">
        {!walletAddress ? (
          <div className="connect-section">
            <h2>Conecta tu Wallet</h2>
            <p>Para usar esta aplicación de pagos privados, necesitas conectar tu wallet.</p>
            <button className="connect-btn" onClick={connectWallet}>
              🔗 Conectar MetaMask
            </button>
          </div>
        ) : (
          <div className="wallet-section">
            <div className="wallet-info">
              <h3>Wallet Conectada</h3>
              <p className="address">{walletAddress}</p>
              <div className="balance-section">
                <h4>Balance: {balance} PRIV</h4>
                <button 
                  className="refresh-btn" 
                  onClick={checkBalance}
                  disabled={loading}
                >
                  🔄 Actualizar
                </button>
              </div>
              
              <div className="registration-section">
                <h4>Registro de Usuario</h4>
                <div className="registration-buttons">
                  <button 
                    className="check-registration-btn" 
                    onClick={checkRegistration}
                    disabled={loading}
                  >
                    🔍 Verificar Registro
                  </button>
                  <button 
                    className="register-btn" 
                    onClick={registerUser}
                    disabled={loading}
                  >
                    📝 Registrar Usuario
                  </button>
                </div>
              </div>
            </div>

            <div className="operations">
              <div className="operation-card">
                <h3>🪙 Mint Tokens</h3>
                <input
                  type="number"
                  placeholder="Cantidad"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading}
                />
                <button 
                  className="mint-btn"
                  onClick={mintTokens}
                  disabled={loading}
                >
                  {loading ? '⏳ Procesando...' : 'Mint'}
                </button>
              </div>

              <div className="operation-card">
                <h3>💸 Transferir</h3>
                <input
                  type="text"
                  placeholder="Dirección destino"
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                  disabled={loading}
                />
                <input
                  type="number"
                  placeholder="Cantidad"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading}
                />
                <button 
                  className="transfer-btn"
                  onClick={transferTokens}
                  disabled={loading}
                >
                  {loading ? '⏳ Procesando...' : 'Transferir'}
                </button>
              </div>

              <div className="operation-card">
                <h3>🔥 Burn Tokens</h3>
                <input
                  type="number"
                  placeholder="Cantidad"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading}
                />
                <button 
                  className="burn-btn"
                  onClick={burnTokens}
                  disabled={loading}
                >
                  {loading ? '⏳ Procesando...' : 'Burn'}
                </button>
              </div>
            </div>
          </div>
        )}

        {message && (
          <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
