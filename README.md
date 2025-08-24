# EncryptedERC (eERC) - Private Token System ⚡ **AVALTOOLKIT**

Este proyecto implementa un sistema avanzado EncryptedERC que permite a los usuarios mantener y transferir tokens de forma privada usando pruebas zero-knowledge y encriptación homomórfica. El sistema mantiene la privacidad mientras habilita capacidades de auditoría.

## 🚀 **Inicio Rápido - AVALTOOLKIT**

### **📋 Prerrequisitos**
1. Node.js y npm instalados
2. Dos claves privadas para testing (configurar como variables de entorno)
3. Tokens AVAX testnet para gas fees

### **🔧 Configuración Inicial**

#### **1. Configurar Variables de Entorno**
Crea un archivo `.env` en la raíz del proyecto:

```bash
# Avalanche Fuji Testnet RPC
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc

# Private keys for testing (without 0x prefix)
PRIVATE_KEY=your_first_private_key_here
PRIVATE_KEY2=your_second_private_key_here

# Enable forking if needed
FORKING=false
```

#### **2. Instalar Dependencias**
```bash
npm install
```

#### **3. Compilar Circuitos y Configurar ZK**
```bash
# Compilar circuitos, generar claves y verificadores
npm run zkit:setup

# O ejecutar manualmente:
npx hardhat zkit compile
npx hardhat zkit setup
npx hardhat zkit verifiers
node fix-imports.js
```

### **🎯 Iniciar el Sistema AVALTOOLKIT**

#### **Opción 1: Sistema Optimizado (Recomendado)**
```bash
npm run optimized
```
**Esto inicia:**
- Frontend en `http://localhost:3000`
- Backend Converter en `http://localhost:3001`
- Backend Standalone en `http://localhost:3002`

#### **Opción 2: Sistema Simple**
```bash
npm run simple
```

#### **Opción 3: Sistema Dinámico**
```bash
npm run dynamic
```

#### **Opción 4: Solo Frontend**
```bash
npm run frontend-only
```

#### **Opción 5: Solo Backend Standalone**
```bash
node backend/server-standalone.js
```

---

## 🏗️ **Despliegue de Contratos**

### **¿Necesitas Desplegar Contratos?**

**Respuesta:** Depende de tu caso de uso:

- **Si quieres usar el sistema con contratos existentes**: Los contratos ya están desplegados y configurados
- **Si quieres desplegar tus propios contratos**: Sigue las instrucciones de despliegue abajo

### **🔄 Modo Converter - Despliegue Manual**

Si necesitas desplegar tus propios contratos:

#### **Paso 1: Desplegar Componentes Básicos**
```bash
npm run converter:init
# O manualmente:
npx hardhat run scripts/converter/01_deploy-basics.ts --network fuji
```

#### **Paso 2: Desplegar Sistema Converter**
```bash
npm run converter:core
# O manualmente:
npx hardhat run scripts/converter/02_deploy-converter.ts --network fuji
```

#### **Paso 3: Registrar Usuarios**
```bash
# Editar script para configurar walletNumber = 1
npm run converter:register
# Editar script para configurar walletNumber = 2
npm run converter:register
```

#### **Paso 4: Configurar Auditor**
```bash
# Editar script para configurar walletNumber = 1
npm run converter:auditor
```

### **🏦 Modo Standalone - Despliegue Manual**

#### **Paso 1: Desplegar Componentes Básicos**
```bash
npm run standalone:init
# O manualmente:
npx hardhat run scripts/standalone/01_deploy-basics.ts --network fuji
```

#### **Paso 2: Desplegar Sistema Standalone**
```bash
npm run standalone:core
# O manualmente:
npx hardhat run scripts/standalone/02_deploy-standalone.ts --network fuji
```

#### **Paso 3: Registrar Usuarios y Configurar Auditor**
```bash
# Registrar usuarios (editar scripts para walletNumber)
npm run standalone:register
npm run standalone:auditor
```

---

## 🎯 **Sistema Modes**

El proyecto soporta **dos modos de operación distintos**:

### **🔄 Converter Mode** (`scripts/converter/`)
- **ERC20 Token Wrapper**: Convierte tokens ERC20 existentes en formato encriptado
- **Sistema Deposit/Withdraw**: Puente entre tokens públicos y privados
- **Soporte Multi-Token**: Funciona con cualquier token ERC20
- **Caso de Uso**: Capa de privacidad para economías de tokens existentes

### **🏦 Standalone Mode** (`scripts/standalone/`)
- **Token Encriptado Nativo**: Crea tokens "PRIV" nativos con encriptación integrada
- **Sistema Mint/Burn**: Modelo de banco central con suministro controlado
- **Token Único**: Ecosistema de tokens encriptados autocontenido
- **Caso de Uso**: Moneda Digital del Banco Central (CBDC), emisión de tokens privados

---

## ⚡ **Características de Rendimiento y Optimización**

- **🚀 100x Más Rápido en Cálculos de Balance**: Búsqueda optimizada de logaritmo discreto con caché inteligente
- **🎯 Gestión Inteligente de Wallets**: Utilidades centralizadas de wallet en `src/utils/utils.ts`
- **⚡ Derivación Inteligente de Claves**: Operaciones criptográficas centralizadas en `src/utils/utils.ts`
- **📊 Sistema de Caché Avanzado**: Caché pre-poblado con expulsión FIFO para valores comunes
- **🔧 Imports Optimizados**: Codebase limpio con dependencias no utilizadas removidas
- **🌍 Documentación Completa**: Guías completas en inglés/español con tutoriales paso a paso

---

## 📋 **Guía Completa - Modo Converter**

### **Versión en Inglés**

Sigue estos pasos para desplegar y probar el **Sistema Convertidor** (ERC20 → ERC20 Encriptado):

#### **Paso 1: Desplegar Componentes Básicos** ⚡ **OPTIMIZADO**
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

#### **Paso 2: Desplegar Sistema Convertidor** ⚡ **OPTIMIZADO**
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

#### **Paso 3: Registrar Usuarios** ⚡ **ALTAMENTE OPTIMIZADO**
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

#### **Paso 4: Establecer Auditor** ⚡ **OPTIMIZADO**
Configura el auditor del sistema (requiere configuración manual de wallet en script).

```bash
# Edita el script manualmente para establecer walletNumber = 1
npx hardhat run scripts/converter/04_set-auditor.ts --network fuji
```

**Qué hace esto:**
- **NUEVO**: Utilidades centralizadas de configuración de auditor
- Establece la clave pública del auditor en el contrato EncryptedERC
- Permite al auditor desencriptar montos de transacciones para cumplimiento
- **NUEVO**: Muestra balance AVAX para la wallet seleccionada
- Este paso es requerido antes de que se puedan hacer depósitos

#### **Paso 5: Obtener Tokens de Prueba (Ambos Usuarios)** ⚡ **OPTIMIZADO**
Reclama tokens de prueba del faucet (requiere configuración manual de wallet en script).

**Para el primer usuario:**
```bash
# Edita el script manualmente para establecer walletNumber = 1
npx hardhat run scripts/converter/05_get_faucet.ts --network fuji
```

**Para el segundo usuario:**
```bash
# Edita el script manualmente para establecer walletNumber = 2
npx hardhat run scripts/converter/05_get_faucet.ts --network fuji
```

**Qué hace esto:**
- **NUEVO**: Utilidades centralizadas de gestión de wallet
- Reclama tokens de prueba del faucet ERC20
- Cada usuario puede reclamar una vez cada 24 horas
- **NUEVO**: Muestra balance AVAX para la wallet seleccionada
- Proporciona tokens necesarios para depósitos en el sistema encriptado

#### **Paso 6: Hacer Depósitos Iniciales (Ambos Usuarios)** ⚡ **ALTAMENTE OPTIMIZADO**
Deposita tokens de prueba en el sistema encriptado con características avanzadas.

**Para el primer usuario:**
```bash
# Edita el script manualmente para establecer walletNumber = 1
npx hardhat run scripts/converter/06_deposit.ts --network fuji
```

**Para el segundo usuario:**
```bash
# Edita el script manualmente para establecer walletNumber = 2
npx hardhat run scripts/converter/06_deposit.ts --network fuji
```

**Qué hace esto:**
- **NUEVO**: Gestión centralizada de wallet con visualización de balance
- **NUEVO**: Derivación centralizada de claves y funciones de desencriptación
- **NUEVO**: Cálculos de balance 100x más rápidos con búsqueda optimizada de logaritmo discreto
- Convierte tokens ERC20 públicos en tokens encriptados
- Genera pruebas de balance encriptado
- Crea rastros de auditoría para cumplimiento
- Los tokens se vuelven privados y solo pueden ser desencriptados por el propietario

#### **Paso 7: Verificar Balances** ⚡ **ALTAMENTE OPTIMIZADO**
Verifica depósitos con cálculos de balance ultra-rápidos.

**Verificar balance del primer usuario:**
```bash
# Edita el script manualmente para establecer walletNumber = 1
npx hardhat run scripts/converter/08_check_balance.ts --network fuji
```

**Verificar balance del segundo usuario:**
```bash
# Edita el script manualmente para establecer walletNumber = 2
npx hardhat run scripts/converter/08_check_balance.ts --network fuji
```

**Qué hace esto:**
- **NUEVO**: Utilidades centralizadas de gestión de wallet
- **NUEVO**: Desencriptación de balance 100x más rápida con sistema de caché inteligente
- **NUEVO**: Caché pre-poblado para valores comunes con expulsión FIFO
- **NUEVO**: Búsqueda multi-estrategia (valores pequeños, números redondos, búsqueda por chunks)
- Desencripta el balance encriptado del usuario usando su clave privada
- Muestra tanto el balance encriptado como el balance público de tokens
- Verifica la consistencia de la encriptación

#### **Paso 8: Realizar Transferencia Privada** ⚡ **OPTIMIZADO**
Transfiere tokens encriptados con utilidades centralizadas.

```bash
npx hardhat run scripts/converter/07_transfer.ts --network fuji
```

**Qué hace esto:**
- **NUEVO**: Usa funciones criptográficas centralizadas de `src/utils/utils.ts`
- **NUEVO**: Cálculos optimizados de logaritmo discreto
- Genera una prueba zero-knowledge para la transferencia
- Transfiere tokens de forma privada (los montos están ocultos de la vista pública)
- Actualiza los balances encriptados para el emisor y el receptor
- Mantiene rastro de auditoría para cumplimiento

#### **Paso 9: Verificar Transferencia** ⚡ **OPTIMIZADO**
Verifica balances para confirmar transferencia (requiere configuración manual de wallet en scripts).

**Verificar balances de ambos usuarios:**
```bash
# Edita el script manualmente para establecer walletNumber = 1, luego ejecuta:
npx hardhat run scripts/converter/08_check_balance.ts --network fuji
# Edita el script manualmente para establecer walletNumber = 2, luego ejecuta:
npx hardhat run scripts/converter/08_check_balance.ts --network fuji
```
**NUEVO**: Utilidades centralizadas para gestión más fácil de wallet!

#### **Paso 10: Retirar a Público** ⚡ **OPTIMIZADO**
Retira tokens con utilidades centralizadas y cálculos optimizados.

```bash
# Edita el script manualmente para establecer walletNumber = 2
npx hardhat run scripts/converter/09_withdraw.ts --network fuji
```

**Qué hace esto:**
- **NUEVO**: Utilidades centralizadas de gestión de wallet
- **NUEVO**: Operaciones criptográficas centralizadas de `src/utils/utils.ts`
- **NUEVO**: Cálculos de balance 100x más rápidos
- Genera una prueba zero-knowledge para el retiro
- Convierte tokens encriptados de vuelta a tokens ERC20 públicos
- Muestra el retiro públicamente en la verificación final del balance

#### **Paso Final: Verificar Balances Públicos** ⚡ **OPTIMIZADO**
Verifica el estado final con cálculos de balance ultra-rápidos.

```bash
# Edita el script manualmente para establecer walletNumber = 1, luego ejecuta:
npx hardhat run scripts/converter/08_check_balance.ts --network fuji
# Edita el script manualmente para establecer walletNumber = 2, luego ejecuta:
npx hardhat run scripts/converter/08_check_balance.ts --network fuji
```

---

## 🏦 **Modo Standalone - Vista General Rápida**

### **Sistema de Tokens Encriptados Nativos**

El modo standalone crea tokens encriptados "PRIV" nativos (no tokens ERC20 envueltos):

```bash
# Desplegar sistema standalone
npx hardhat run scripts/standalone/01_deploy-basics.ts --network fuji
npx hardhat run scripts/standalone/02_deploy-standalone.ts --network fuji

# Registrar usuarios y configurar auditor (editar scripts manualmente para selección de wallet)
npx hardhat run scripts/standalone/03_register-user.ts --network fuji  # Establecer walletNumber = 1
npx hardhat run scripts/standalone/03_register-user.ts --network fuji  # Establecer walletNumber = 2
npx hardhat run scripts/standalone/04_set-auditor.ts --network fuji     # Establecer walletNumber = 1

# Acuñar tokens (Modelo Banco Central - editar scripts manualmente)
npx hardhat run scripts/standalone/05_mint.ts --network fuji  # Establecer números de wallet de propietario/usuario

# Transferir privadamente y quemar permanentemente (editar scripts manualmente)
npx hardhat run scripts/standalone/07_transfer.ts --network fuji  # Establecer wallets de emisor/receptor
npx hardhat run scripts/standalone/08_burn.ts --network fuji      # Establecer walletNumber = 2
```

**Para instrucciones detalladas de standalone, ver [`scripts/standalone/README.md`](scripts/standalone/README.md)**

---

## ⚡ **Características Avanzadas / Características Avanzadas**

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

## 🔧 **Solución de Problemas / Solución de Problemas**

### **Problemas Comunes / Problemas Comunes**

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

#### **⚡ Problemas de Rendimiento**
1. **Cálculos de balance lentos** → Asegúrate de usar scripts optimizados con caché (todos los scripts en carpetas `converter/` y `standalone/`)
2. **Problemas de memoria** → El caché está limitado a 1000 entradas con expulsión FIFO
3. **Desencriptación de balance grande falla** → Incrementa `maxValue` en función `findDiscreteLogOptimized` si es necesario

#### **🔧 Problemas de Entorno**
1. **Selección de wallet no funciona** → Configura manualmente el número de wallet en el script usando `getWallet(1)` o `getWallet(2)`
2. **Archivo de despliegue incorrecto** → Verifica `deployments/converter/latest-converter.json` o `deployments/standalone/latest-standalone.json`
3. **Dependencias faltantes** → Ejecuta `npm install` para asegurar que todos los paquetes estén instalados

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

## 📚 **Documentación Adicional**

- **Frontend README**: [`FRONTEND-README.md`](FRONTEND-README.md)
- **Standalone README**: [`STANDALONE-README.md`](STANDALONE-README.md)
- **Optimizaciones Completas**: [`OPTIMIZACIONES-COMPLETAS.md`](OPTIMIZACIONES-COMPLETAS.md)
- **Solución de Errores**: [`SOLUCION-COMPLETA-ERRORES.md`](SOLUCION-COMPLETA-ERRORES.md)
- **Solución Error Registro**: [`SOLUCION-ERROR-REGISTRO.md`](SOLUCION-ERROR-REGISTRO.md)
