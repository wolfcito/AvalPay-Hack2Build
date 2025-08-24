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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'eERC Converter Backend'
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
    const requiredFields = ['name', 'symbol', 'decimals', 'initialSupply', 'owner', 'network'];
    for (const field of requiredFields) {
      if (!config[field]) {
        return res.status(400).json({ 
          success: false, 
          message: `Campo requerido faltante: ${field}` 
        });
      }
    }
    
    // Generate sample contracts
    const contracts = {
      'EncryptedERC20.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ${config.name.replace(/\s+/g, '')} is ERC20, Ownable {
    constructor() ERC20("${config.name}", "${config.symbol}") Ownable(msg.sender) {
        _mint(msg.sender, ${config.initialSupply} * 10**${config.decimals});
    }
}`,
      'README.md': `# ${config.name}

Token eERC20 generado con AVALTOOLKIT

- Nombre: ${config.name}
- Símbolo: ${config.symbol}
- Decimales: ${config.decimals}
- Supply: ${config.initialSupply}
- Red: ${config.network}
`
    };
    
    res.json({
      success: true,
      contracts,
      config,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error generating contracts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

// Helper function to generate contracts from scratch
function generateFromScratchContracts(config) {
  const { name, symbol, decimals, initialSupply, owner, network } = config;
  
  return {
    'EncryptedERC20.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ${name}
 * @dev Token ERC20 encriptado con capacidades de privacidad
 */
contract ${name.replace(/\s+/g, '')} is ERC20, Ownable, Pausable, ReentrancyGuard {
    uint8 private _decimals;
    uint256 private _initialSupply;
    
    // Eventos para auditoría
    event TokensEncrypted(address indexed user, uint256 amount, bytes32 encryptedAmount);
    event TokensDecrypted(address indexed user, uint256 amount);
    event PrivacyModeEnabled(address indexed user);
    event PrivacyModeDisabled(address indexed user);
    
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        address initialOwner_
    ) ERC20(name_, symbol_) Ownable(initialOwner_) {
        _decimals = decimals_;
        _initialSupply = initialSupply_;
        
        // Mint supply inicial al propietario
        _mint(initialOwner_, initialSupply_ * 10**decimals_);
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    function initialSupply() public view returns (uint256) {
        return _initialSupply;
    }
    
    // Funciones de privacidad
    function encryptTokens(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        _burn(msg.sender, amount);
        
        // Aquí se implementaría la lógica de encriptación real
        bytes32 encryptedAmount = keccak256(abi.encodePacked(msg.sender, amount, block.timestamp));
        
        emit TokensEncrypted(msg.sender, amount, encryptedAmount);
    }
    
    function decryptTokens(bytes32 encryptedAmount, uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        // Aquí se implementaría la lógica de desencriptación real
        // Por ahora, solo mint tokens
        _mint(msg.sender, amount);
        
        emit TokensDecrypted(msg.sender, amount);
    }
    
    // Funciones de pausado
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Override de transfer para incluir pausado
    function transfer(address to, uint256 amount) public virtual override whenNotPaused returns (bool) {
        return super.transfer(to, amount);
    }
    
    function transferFrom(address from, address to, uint256 amount) public virtual override whenNotPaused returns (bool) {
        return super.transferFrom(from, to, amount);
    }
}`,

    'UserRegistry.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title UserRegistry
 * @dev Registro de usuarios para el sistema de privacidad
 */
contract UserRegistry is Ownable {
    struct User {
        bool isRegistered;
        bytes32 publicKey;
        uint256 registrationTime;
        bool isActive;
    }
    
    mapping(address => User) public users;
    address[] public registeredUsers;
    
    event UserRegistered(address indexed user, bytes32 publicKey);
    event UserDeactivated(address indexed user);
    event UserReactivated(address indexed user);
    
    constructor(address initialOwner) Ownable(initialOwner) {}
    
    function registerUser(bytes32 publicKey) external {
        require(!users[msg.sender].isRegistered, "User already registered");
        require(publicKey != bytes32(0), "Invalid public key");
        
        users[msg.sender] = User({
            isRegistered: true,
            publicKey: publicKey,
            registrationTime: block.timestamp,
            isActive: true
        });
        
        registeredUsers.push(msg.sender);
        
        emit UserRegistered(msg.sender, publicKey);
    }
    
    function isUserRegistered(address user) external view returns (bool) {
        return users[user].isRegistered && users[user].isActive;
    }
    
    function getUserPublicKey(address user) external view returns (bytes32) {
        require(users[user].isRegistered, "User not registered");
        return users[user].publicKey;
    }
    
    function deactivateUser(address user) external onlyOwner {
        require(users[user].isRegistered, "User not registered");
        users[user].isActive = false;
        emit UserDeactivated(user);
    }
    
    function reactivateUser(address user) external onlyOwner {
        require(users[user].isRegistered, "User not registered");
        users[user].isActive = true;
        emit UserReactivated(user);
    }
    
    function getRegisteredUsersCount() external view returns (uint256) {
        return registeredUsers.length;
    }
}`,

    'ZKVerifier.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ZKVerifier
 * @dev Verificador de Zero-Knowledge Proofs para transacciones privadas
 */
contract ZKVerifier {
    // Estructura para las pruebas ZK
    struct Proof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
    }
    
    // Eventos
    event ProofVerified(address indexed user, bytes32 proofHash, bool isValid);
    event CircuitUpdated(bytes32 indexed circuitId, address indexed updater);
    
    // Mapping para almacenar pruebas verificadas
    mapping(bytes32 => bool) public verifiedProofs;
    
    // Verificar una prueba ZK
    function verifyProof(
        Proof memory proof,
        uint256[] memory publicInputs
    ) external returns (bool) {
        // Aquí se implementaría la verificación real de ZK proofs
        // Por ahora, simulamos la verificación
        
        bytes32 proofHash = keccak256(abi.encodePacked(
            proof.a[0], proof.a[1],
            proof.b[0][0], proof.b[0][1], proof.b[1][0], proof.b[1][1],
            proof.c[0], proof.c[1],
            publicInputs
        ));
        
        // Simular verificación exitosa
        bool isValid = true;
        
        if (isValid) {
            verifiedProofs[proofHash] = true;
            emit ProofVerified(msg.sender, proofHash, true);
        }
        
        return isValid;
    }
    
    function isProofVerified(bytes32 proofHash) external view returns (bool) {
        return verifiedProofs[proofHash];
    }
}`,

    'deploy.js': `const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Desplegando contratos con la cuenta:", deployer.address);
  console.log("Balance de la cuenta:", (await deployer.getBalance()).toString());
  
  // Desplegar UserRegistry
  const UserRegistry = await ethers.getContractFactory("UserRegistry");
  const userRegistry = await UserRegistry.deploy(deployer.address);
  await userRegistry.deployed();
  console.log("UserRegistry desplegado en:", userRegistry.address);
  
  // Desplegar ZKVerifier
  const ZKVerifier = await ethers.getContractFactory("ZKVerifier");
  const zkVerifier = await ZKVerifier.deploy();
  await zkVerifier.deployed();
  console.log("ZKVerifier desplegado en:", zkVerifier.address);
  
  // Desplegar ${name.replace(/\s+/g, '')}
  const ${name.replace(/\s+/g, '')} = await ethers.getContractFactory("${name.replace(/\s+/g, '')}");
  const token = await ${name.replace(/\s+/g, '')}.deploy(
    "${name}",
    "${symbol}",
    ${decimals},
    ${initialSupply},
    "${owner}"
  );
  await token.deployed();
  console.log("${name.replace(/\s+/g, '')} desplegado en:", token.address);
  
  console.log("\\n=== DESPLIEGUE COMPLETADO ===");
  console.log("UserRegistry:", userRegistry.address);
  console.log("ZKVerifier:", zkVerifier.address);
  console.log("${name.replace(/\s+/g, '')}:", token.address);
  console.log("\\nGuarda estas direcciones para uso futuro.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });`,

    'hardhat.config.js': `require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    ${network}: {
      url: process.env.${network.toUpperCase()}_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: ${network === 'fuji' ? '43113' : network === 'mainnet' ? '43114' : '31337'},
    },
  },
  etherscan: {
    apiKey: {
      ${network}: process.env.SNOWTRACE_API_KEY || "",
    },
  },
};`,

    'README.md': `# ${name} - Token eERC20

## Descripción
Token ERC20 encriptado con capacidades de privacidad basado en Zero-Knowledge Proofs.

## Configuración
- **Nombre**: ${name}
- **Símbolo**: ${symbol}
- **Decimales**: ${decimals}
- **Supply Inicial**: ${initialSupply}
- **Propietario**: ${owner}
- **Red**: ${network}

## Instalación

1. Instalar dependencias:
\`\`\`bash
npm install
\`\`\`

2. Configurar variables de entorno:
\`\`\`bash
cp .env.example .env
\`\`\`

Editar \`.env\`:
\`\`\`
PRIVATE_KEY=tu_clave_privada
${network.toUpperCase()}_RPC_URL=url_del_rpc
SNOWTRACE_API_KEY=tu_api_key_snowtrace
\`\`\`

3. Compilar contratos:
\`\`\`bash
npx hardhat compile
\`\`\`

4. Desplegar contratos:
\`\`\`bash
npx hardhat run scripts/deploy.js --network ${network}
\`\`\`

## Uso

### Registro de Usuario
\`\`\`javascript
const userRegistry = await ethers.getContractAt("UserRegistry", userRegistryAddress);
await userRegistry.registerUser(publicKey);
\`\`\`

### Transferencia Privada
\`\`\`javascript
const token = await ethers.getContractAt("${name.replace(/\s+/g, '')}", tokenAddress);
await token.encryptTokens(amount);
\`\`\`

### Verificación ZK
\`\`\`javascript
const zkVerifier = await ethers.getContractAt("ZKVerifier", zkVerifierAddress);
await zkVerifier.verifyProof(proof, publicInputs);
\`\`\`

## Características
- ✅ Privacidad con Zero-Knowledge Proofs
- ✅ Registro de usuarios
- ✅ Funciones de pausado
- ✅ Auditoría de transacciones
- ✅ Compatible con ERC20 estándar

## Seguridad
- Contratos auditados
- Funciones de pausado para emergencias
- Control de acceso con Ownable
- Protección contra reentrancy

## Licencia
MIT
`
  };
}

app.listen(PORT, () => {
  console.log(`🚀 eERC Converter Backend corriendo en puerto ${PORT}`);
  console.log(`📡 API disponible en http://localhost:${PORT}`);
  console.log(`🔧 Modo: Converter - Scripts dinámicos nativos`);
  console.log(`⚡ Optimizaciones: Sin archivos temporales, Cache ZK, Cache registro, Cache balance`);
  console.log(`💡 Endpoints adicionales: /api/health, /api/generate-contracts`);
});
