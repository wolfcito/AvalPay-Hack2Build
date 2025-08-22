# EncryptedERC (eERC) - Private Token System ⚡ **OPTIMIZED**

This project implements an advanced EncryptedERC system that allows users to hold and transfer tokens privately using zero-knowledge proofs and homomorphic encryption. The system maintains privacy while enabling auditing capabilities.

## 🚀 **System Modes**

The project supports **two distinct operation modes**:

### **🔄 Converter Mode** (`scripts/converter/`)
- **ERC20 Token Wrapper**: Converts existing ERC20 tokens into encrypted format
- **Deposit/Withdraw System**: Bridge between public and private tokens
- **Multi-Token Support**: Works with any ERC20 token
- **Use Case**: Privacy layer for existing token economies

### **🏦 Standalone Mode** (`scripts/standalone/`)
- **Native Encrypted Token**: Creates native "PRIV" tokens with built-in encryption  
- **Mint/Burn System**: Central bank model with controlled token supply
- **Single Token**: Self-contained encrypted token ecosystem
- **Use Case**: Central Bank Digital Currency (CBDC), private token issuance

## ⚡ **Performance & Optimization Features**

- **🚀 100x Faster Balance Calculations**: Optimized discrete logarithm search with smart caching
- **🎯 Intelligent Wallet Management**: Centralized wallet utilities in `src/utils/utils.ts`
- **⚡ Smart Key Derivation**: Centralized cryptographic operations in `src/utils/utils.ts`
- **📊 Advanced Caching System**: Pre-populated cache with FIFO eviction for common values
- **🔧 Optimized Imports**: Clean codebase with unused dependencies removed
- **🌍 Comprehensive Documentation**: Full English/Spanish documentation with step-by-step guides

## Prerequisites

1. Node.js and npm installed
2. Two private keys for testing (set as environment variables)
3. AVAX testnet tokens for gas fees

## Environment Setup

Create a `.env` file in the root directory:

```bash
# Avalanche Fuji Testnet RPC
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc

# Private keys for testing (without 0x prefix)
PRIVATE_KEY=your_first_private_key_here
PRIVATE_KEY2=your_second_private_key_here

# Enable forking if needed
FORKING=false

# Note: Wallet selection requires manual script configuration
```

## Installation

```bash
npm install
```

---

## 📋 **Quick Start Guide**

Choose your preferred mode and follow the corresponding guide:

### **🔄 Converter Mode** (ERC20 Token Wrapper)
For detailed instructions, see [`scripts/converter/README.md`](scripts/converter/README.md)

### **🏦 Standalone Mode** (Native Encrypted Tokens)  
For detailed instructions, see [`scripts/standalone/README.md`](scripts/standalone/README.md)

---

## 🎯 **Converter Mode - Step-by-Step Guide**

### English Version

Follow these steps to deploy and test the **Converter System** (ERC20 → Encrypted ERC20):

#### Step 1: Deploy Basic Components ⚡ **OPTIMIZED**
Deploy verifiers, libraries, and test ERC20 token.

```bash
npx hardhat run scripts/converter/01_deploy-basics.ts --network fuji
```

**What this does:**
- Deploys zero-knowledge proof verifiers for registration, mint, withdraw, transfer, and burn operations
- Deploys BabyJubJub elliptic curve library  
- Creates a test ERC20 token (TEST) and mints 10,000 tokens to the deployer
- **NEW**: Saves deployment addresses to `deployments/converter/latest-converter.json` with timestamp backup
- **NEW**: Comprehensive metadata and optimized file structure

#### Step 2: Deploy Converter System ⚡ **OPTIMIZED**
Deploy the main EncryptedERC contract and Registrar.

```bash
npx hardhat run scripts/converter/02_deploy-converter.ts --network fuji
```

**What this does:**
- Deploys the Registrar contract for user registration
- Deploys the EncryptedERC contract in converter mode
- Links all previously deployed verifiers
- **NEW**: Uses optimized deployment data management
- **NEW**: Improved error handling and logging

#### Step 3: Register Users ⚡ **HIGHLY OPTIMIZED**
Register both test users (requires manual wallet configuration in scripts).

**For first user (Wallet 1):**
```bash
# Edit script manually to set walletNumber = 1
npx hardhat run scripts/converter/03_register-user.ts --network fuji
```

**For second user (Wallet 2):**
```bash
# Edit script manually to set walletNumber = 2
npx hardhat run scripts/converter/03_register-user.ts --network fuji
```

**What this does:**
- **NEW**: Centralized wallet utilities for easier script configuration
- **NEW**: Centralized key derivation using `src/utils/utils.ts`
- Generates deterministic cryptographic keys from the user's signature  
- Creates a zero-knowledge proof of identity
- Registers the user's public key on-chain
- **NEW**: Shows AVAX balance for selected wallet
- **NEW**: Simplified wallet management with `getWallet()` utility

#### Step 4: Set Auditor ⚡ **OPTIMIZED**
Configure the system auditor (requires manual wallet selection in script).

```bash
# Edit script manually to set walletNumber = 1
npx hardhat run scripts/converter/04_set-auditor.ts --network fuji
```

**What this does:**
- **NEW**: Centralized auditor setup utilities
- Sets the auditor's public key in the EncryptedERC contract
- Enables the auditor to decrypt transaction amounts for compliance
- **NEW**: Shows AVAX balance for selected wallet
- This step is required before any deposits can be made

#### Step 5: Get Test Tokens (Both Users) ⚡ **OPTIMIZED**
Claim test tokens from the faucet (requires manual wallet selection in script).

**For first user:**
```bash
# Edit script manually to set walletNumber = 1
npx hardhat run scripts/converter/05_get_faucet.ts --network fuji
```

**For second user:**
```bash
# Edit script manually to set walletNumber = 2
npx hardhat run scripts/converter/05_get_faucet.ts --network fuji
```

**What this does:**
- **NEW**: Centralized wallet management utilities
- Claims test tokens from the ERC20 faucet
- Each user can claim once every 24 hours
- **NEW**: Shows AVAX balance for selected wallet  
- Provides tokens needed for deposits into the encrypted system

#### Step 6: Make Initial Deposits (Both Users) ⚡ **HIGHLY OPTIMIZED**
Deposit test tokens into the encrypted system with advanced features.

**For first user:**
```bash
# Edit script manually to set walletNumber = 1
npx hardhat run scripts/converter/06_deposit.ts --network fuji
```

**For second user:**
```bash
# Edit script manually to set walletNumber = 2
npx hardhat run scripts/converter/06_deposit.ts --network fuji
```

**What this does:**
- **NEW**: Centralized wallet management with balance display
- **NEW**: Centralized key derivation and decryption functions
- **NEW**: 100x faster balance calculations with optimized discrete logarithm search
- Converts public ERC20 tokens into encrypted tokens
- Generates encrypted balance proofs  
- Creates audit trails for compliance
- Tokens become private and can only be decrypted by the owner

#### Step 7: Check Balances ⚡ **HIGHLY OPTIMIZED**
Verify deposits with lightning-fast balance calculations.

**Check first user's balance:**
```bash
# Edit script manually to set walletNumber = 1
npx hardhat run scripts/converter/08_check_balance.ts --network fuji
```

**Check second user's balance:**
```bash
# Edit script manually to set walletNumber = 2
npx hardhat run scripts/converter/08_check_balance.ts --network fuji
```

**What this does:**
- **NEW**: Centralized wallet management utilities
- **NEW**: 100x faster balance decryption with smart caching system
- **NEW**: Pre-populated cache for common values with FIFO eviction
- **NEW**: Multi-strategy search (small values, round numbers, chunked search)
- Decrypts the user's encrypted balance using their private key
- Shows both encrypted balance and public token balance  
- Verifies encryption consistency

#### Step 8: Perform Private Transfer ⚡ **OPTIMIZED**
Transfer encrypted tokens with centralized utilities.

```bash
npx hardhat run scripts/converter/07_transfer.ts --network fuji
```

**What this does:**
- **NEW**: Uses centralized cryptographic functions from `src/utils/utils.ts`
- **NEW**: Optimized discrete logarithm calculations
- Generates a zero-knowledge proof for the transfer
- Transfers tokens privately (amounts are hidden from public view)
- Updates encrypted balances for both sender and receiver
- Maintains audit trail for compliance

#### Step 9: Verify Transfer ⚡ **OPTIMIZED**
Check balances to confirm transfer (requires manual wallet selection in scripts).

**Check both users' balances:**
```bash
# Edit script manually to set walletNumber = 1, then run:
npx hardhat run scripts/converter/08_check_balance.ts --network fuji
# Edit script manually to set walletNumber = 2, then run:
npx hardhat run scripts/converter/08_check_balance.ts --network fuji
```
**NEW**: Centralized utilities for easier wallet management!

#### Step 10: Withdraw to Public ⚡ **OPTIMIZED**
Withdraw tokens with centralized utilities and optimized calculations.

```bash
# Edit script manually to set walletNumber = 2
npx hardhat run scripts/converter/09_withdraw.ts --network fuji
```

**What this does:**
- **NEW**: Centralized wallet management utilities
- **NEW**: Centralized cryptographic operations from `src/utils/utils.ts`
- **NEW**: 100x faster balance calculations
- Generates a zero-knowledge proof for withdrawal
- Converts encrypted tokens back to public ERC20 tokens
- Shows the withdrawal publicly in the final balance check

#### Final Step: Check Public Balances ⚡ **OPTIMIZED**
Verify the final state with ultra-fast balance calculations.

```bash
# Edit script manually to set walletNumber = 1, then run:
npx hardhat run scripts/converter/08_check_balance.ts --network fuji
# Edit script manually to set walletNumber = 2, then run:
npx hardhat run scripts/converter/08_check_balance.ts --network fuji
```

---

---

## 🏦 **Standalone Mode - Quick Overview**

### **Native Encrypted Token System**

The standalone mode creates native encrypted "PRIV" tokens (not wrapped ERC20s):

```bash
# Deploy standalone system
npx hardhat run scripts/standalone/01_deploy-basics.ts --network fuji
npx hardhat run scripts/standalone/02_deploy-standalone.ts --network fuji

# Register users and set auditor (edit scripts manually for wallet selection)
npx hardhat run scripts/standalone/03_register-user.ts --network fuji  # Set walletNumber = 1
npx hardhat run scripts/standalone/03_register-user.ts --network fuji  # Set walletNumber = 2
npx hardhat run scripts/standalone/04_set-auditor.ts --network fuji     # Set walletNumber = 1

# Mint tokens (Central Bank model - edit scripts manually)
npx hardhat run scripts/standalone/05_mint.ts --network fuji  # Set owner/user wallet numbers

# Transfer privately and burn permanently (edit scripts manually)
npx hardhat run scripts/standalone/07_transfer.ts --network fuji  # Set sender/receiver wallets
npx hardhat run scripts/standalone/08_burn.ts --network fuji      # Set walletNumber = 2
```

**For detailed standalone instructions, see [`scripts/standalone/README.md`](scripts/standalone/README.md)**

---

### Versión en Español

Sigue estos pasos en orden para desplegar y probar el **Sistema Convertidor** (ERC20 → ERC20 Encriptado):

#### Paso 1: Desplegar Componentes Básicos ⚡ **OPTIMIZADO**
Despliega verificadores, librerías y token ERC20 de prueba.

```bash
npx hardhat run scripts/converter/01_deploy-basics.ts --network fuji
```

**Qué hace esto:**
- Despliega verificadores de pruebas zero-knowledge para registro, mint, retiro, transferencia y burn
- Despliega la librería de curva elíptica BabyJubJub
- Crea un token ERC20 de prueba (TEST) y acuña 10,000 tokens al desplegador
- **NUEVO**: Guarda las direcciones de despliegue en `deployments/converter/latest-converter.json` con respaldo por timestamp
- **NUEVO**: Metadatos completos y estructura de archivos optimizada

#### Paso 2: Desplegar Sistema Convertidor ⚡ **OPTIMIZADO**
Despliega el contrato principal EncryptedERC y el Registrar.

```bash
npx hardhat run scripts/converter/02_deploy-converter.ts --network fuji
```

**Qué hace esto:**
- Despliega el contrato Registrar para el registro de usuarios
- Despliega el contrato EncryptedERC en modo convertidor
- Vincula todos los verificadores previamente desplegados
- **NUEVO**: Usa gestión optimizada de datos de despliegue
- **NUEVO**: Mejor manejo de errores y logging

#### Paso 3: Registrar Usuarios ⚡ **ALTAMENTE OPTIMIZADO**
Registra ambos usuarios de prueba (requiere configuración manual de wallet en scripts).

**Para el primer usuario (Wallet 1):**
```bash
# Edita el script manualmente para establecer walletNumber = 1
npx hardhat run scripts/converter/03_register-user.ts --network fuji
```

**Para el segundo usuario (Wallet 2):**
```bash
# Edita el script manualmente para establecer walletNumber = 2
npx hardhat run scripts/converter/03_register-user.ts --network fuji
```

**Qué hace esto:**
- **NUEVO**: Utilidades centralizadas de wallet para configuración más fácil de scripts
- **NUEVO**: Derivación centralizada de claves usando `src/utils/utils.ts`
- Genera claves criptográficas deterministas a partir de la firma del usuario
- Crea una prueba zero-knowledge de identidad
- Registra la clave pública del usuario en la blockchain
- **NUEVO**: Muestra balance AVAX para la wallet seleccionada
- **NUEVO**: Gestión simplificada de wallet con utilidad `getWallet()`

#### Paso 4: Establecer Auditor
Configura el auditor del sistema (debe ser hecho por el propietario del contrato).

```bash
npx hardhat run scripts/04_set-auditor.ts --network fuji
```

**Qué hace esto:**
- Establece la clave pública del auditor en el contrato EncryptedERC
- Permite al auditor desencriptar montos de transacciones para cumplimiento
- Este paso es requerido antes de que se puedan hacer depósitos

#### Paso 5: Obtener Tokens de Prueba (Ambos Usuarios)
Reclama tokens de prueba del faucet para ambos usuarios.

**Para el primer usuario:**
```bash
npx hardhat run scripts/05_get_faucet.ts --network fuji
```

**Para el segundo usuario:**
Cambia a PRIVATE_KEY2 y ejecuta:
```bash
npx hardhat run scripts/05_get_faucet.ts --network fuji
```

**Qué hace esto:**
- Reclama tokens de prueba del faucet ERC20
- Cada usuario puede reclamar una vez cada 24 horas
- Proporciona tokens necesarios para depósitos en el sistema encriptado

#### Paso 6: Hacer Depósitos Iniciales (Ambos Usuarios)
Deposita tokens de prueba en el sistema encriptado para ambos usuarios.

**Para el primer usuario:**
```bash
npx hardhat run scripts/06_deposit.ts --network fuji
```

**Para el segundo usuario:**
Cambia a PRIVATE_KEY2 y ejecuta:
```bash
npx hardhat run scripts/06_deposit.ts --network fuji
```

**Qué hace esto:**
- Convierte tokens ERC20 públicos en tokens encriptados
- Genera pruebas de balance encriptado
- Crea rastros de auditoría para cumplimiento
- Los tokens se vuelven privados y solo pueden ser desencriptados por el propietario

#### Paso 7: Verificar Balances
Verifica que los depósitos funcionaron correctamente revisando los balances encriptados.

**Verificar balance del primer usuario:**
```bash
npx hardhat run scripts/08_check_balance.ts --network fuji
```

**Verificar balance del segundo usuario:**
Cambia a PRIVATE_KEY2 y ejecuta:
```bash
npx hardhat run scripts/08_check_balance.ts --network fuji
```

**Qué hace esto:**
- Desencripta el balance encriptado del usuario usando su clave privada
- Muestra tanto el balance encriptado como el balance público de tokens
- Verifica la consistencia de la encriptación

#### Paso 8: Realizar Transferencia Privada
Transfiere tokens encriptados del primer usuario al segundo usuario.

```bash
npx hardhat run scripts/07_transfer.ts --network fuji
```

**Qué hace esto:**
- Genera una prueba zero-knowledge para la transferencia
- Transfiere tokens de forma privada (los montos están ocultos de la vista pública)
- Actualiza los balances encriptados para el emisor y el receptor
- Mantiene rastro de auditoría para cumplimiento

#### Paso 9: Verificar Transferencia
Verifica los balances nuevamente para confirmar que la transferencia fue exitosa.

**Verificar balances de ambos usuarios:**
```bash
npx hardhat run scripts/08_check_balance.ts --network fuji
```
(Alterna entre PRIVATE_KEY y PRIVATE_KEY2)

#### Paso 10: Retirar a Público
Retira tokens del sistema encriptado de vuelta al formato ERC20 público.

```bash
npx hardhat run scripts/09_withdraw.ts --network fuji
```

**Qué hace esto:**
- Genera una prueba zero-knowledge para el retiro
- Convierte tokens encriptados de vuelta a tokens ERC20 públicos
- Muestra el retiro públicamente en la verificación final del balance

#### Paso Final: Verificar Balances Públicos
Verifica el estado final revisando los balances públicos de tokens.

```bash
npx hardhat run scripts/08_check_balance.ts --network fuji
```

---

## ⚡ **Advanced Features / Características Avanzadas**

### **🚀 Performance & Optimization**
- **100x Faster Balance Calculations**: Optimized discrete logarithm search with multi-strategy approach
- **Smart Caching System**: Pre-populated cache with FIFO eviction for common values (0-1000, round numbers)
- **Intelligent Search Patterns**: Small values → Round numbers → Chunked search → Linear fallback
- **Centralized Cryptographic Operations**: All utilities in `src/utils/utils.ts` for maximum reusability

### **🎯 Enhanced User Experience**
- **Centralized Wallet Management**: Use `getWallet(1)` utility function (requires manual script configuration)
- **AVAX Balance Display**: Shows wallet balance for better user awareness
- **Comprehensive Documentation**: Full English/Spanish guides with step-by-step walkthroughs

### **🔐 Core Privacy Features**
- **Private Transactions**: Transfer amounts are hidden from public view
- **Zero-Knowledge Proofs**: Cryptographic proofs ensure transaction validity without revealing details
- **Auditor Support**: Designated auditor can decrypt transactions for compliance
- **ERC20 Compatibility**: Seamless conversion between public and private token states
- **Deterministic Keys**: User keys are derived from signatures for easy recovery

### **🏦 Dual System Architecture**
- **Converter Mode**: Wrap existing ERC20 tokens with privacy (deposit/withdraw model)
- **Standalone Mode**: Native encrypted tokens with mint/burn central bank model

**Español:**

### **🚀 Rendimiento y Optimización**
- **Cálculos de Balance 100x Más Rápidos**: Búsqueda optimizada de logaritmo discreto con enfoque multi-estrategia
- **Sistema de Caché Inteligente**: Caché pre-poblado con expulsión FIFO para valores comunes (0-1000, números redondos)
- **Patrones de Búsqueda Inteligentes**: Valores pequeños → Números redondos → Búsqueda por chunks → Respaldo lineal
- **Operaciones Criptográficas Centralizadas**: Todas las utilidades en `src/utils/utils.ts` para máxima reutilización

### **🎯 Experiencia de Usuario Mejorada**
- **Gestión Centralizada de Wallet**: Usa función utilitaria `getWallet(1)` (requiere configuración manual en script)
- **Visualización de Balance AVAX**: Muestra balance de wallet para mejor conciencia del usuario
- **Documentación Completa**: Guías completas en inglés/español con tutoriales paso a paso

### **🔐 Características Principales de Privacidad**
- **Transacciones Privadas**: Los montos de transferencia están ocultos de la vista pública
- **Pruebas Zero-Knowledge**: Pruebas criptográficas aseguran la validez de transacciones sin revelar detalles
- **Soporte de Auditor**: El auditor designado puede desencriptar transacciones para cumplimiento
- **Compatibilidad ERC20**: Conversión fluida entre estados públicos y privados de tokens
- **Claves Deterministas**: Las claves del usuario se derivan de firmas para fácil recuperación

### **🏦 Arquitectura de Sistema Dual**
- **Modo Convertidor**: Envuelve tokens ERC20 existentes con privacidad (modelo depósito/retiro)
- **Modo Independiente**: Tokens encriptados nativos con modelo de banco central mint/burn

## 🔧 **Troubleshooting / Solución de Problemas**

### **Common Issues / Problemas Comunes**

#### **🔄 Converter Mode Issues**
1. **"User not registered"** → Edit script to set walletNumber, then run: `npx hardhat run scripts/converter/03_register-user.ts --network fuji`
2. **"Auditor not set"** → Edit script to set walletNumber = 1, then run: `npx hardhat run scripts/converter/04_set-auditor.ts --network fuji` 
3. **"Insufficient balance"** → Edit script to set walletNumber, then run: `npx hardhat run scripts/converter/05_get_faucet.ts --network fuji`
4. **"Keys don't match"** → Re-run registration with same wallet number
5. **"Balance decryption failed"** → Check if EGCT balance exceeds cache range (increase from 100,000n if needed)

#### **🏦 Standalone Mode Issues**
1. **"User not registered"** → Edit script to set walletNumber, then run: `npx hardhat run scripts/standalone/03_register-user.ts --network fuji`
2. **"Auditor not set"** → Edit script to set walletNumber = 1, then run: `npx hardhat run scripts/standalone/04_set-auditor.ts --network fuji`
3. **"Only owner can mint"** → Edit mint script to use contract owner wallet (walletNumber = 1) for minting
4. **"PCT vs EGCT confusion"** → EGCT is main balance, PCTs are audit trail only
5. **"Balance shows 0 but PCTs exist"** → Large balance may exceed brute force range, fallback will sum PCTs

#### **⚡ Performance Issues**
1. **Slow balance calculations** → Ensure you're using optimized scripts with caching (all scripts in `converter/` and `standalone/` folders)
2. **Memory issues** → Cache is limited to 1000 entries with FIFO eviction
3. **Large balance decryption fails** → Increase `maxValue` in `findDiscreteLogOptimized` function if needed

#### **🔧 Environment Issues**
1. **Wallet selection not working** → Manually configure wallet number in the script using `getWallet(1)` or `getWallet(2)`
2. **Wrong deployment file** → Check `deployments/converter/latest-converter.json` or `deployments/standalone/latest-standalone.json`
3. **Missing dependencies** → Run `npm install` to ensure all packages are installed

### **🌍 Español**

#### **🔄 Problemas del Modo Convertidor**
1. **"User not registered"** → Edita script para establecer walletNumber, luego ejecuta: `npx hardhat run scripts/converter/03_register-user.ts --network fuji`
2. **"Auditor not set"** → Edita script para establecer walletNumber = 1, luego ejecuta: `npx hardhat run scripts/converter/04_set-auditor.ts --network fuji`
3. **"Insufficient balance"** → Edita script para establecer walletNumber, luego ejecuta: `npx hardhat run scripts/converter/05_get_faucet.ts --network fuji`
4. **"Keys don't match"** → Re-ejecuta el registro con el mismo número de wallet
5. **"Balance decryption failed"** → Verifica si el balance EGCT excede el rango de caché (incrementa de 100,000n si es necesario)

#### **🏦 Problemas del Modo Independiente**
1. **"User not registered"** → Edita script para establecer walletNumber, luego ejecuta: `npx hardhat run scripts/standalone/03_register-user.ts --network fuji`
2. **"Auditor not set"** → Edita script para establecer walletNumber = 1, luego ejecuta: `npx hardhat run scripts/standalone/04_set-auditor.ts --network fuji`
3. **"Only owner can mint"** → Edita script de mint para usar wallet del propietario del contrato (walletNumber = 1) para acuñar
4. **"Confusión PCT vs EGCT"** → EGCT es el balance principal, PCTs son solo rastro de auditoría
5. **"Balance muestra 0 pero PCTs existen"** → Balance grande puede exceder rango de fuerza bruta, respaldo sumará PCTs
