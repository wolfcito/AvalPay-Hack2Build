# Backend de Pagos Privados

Este es el backend para la aplicación de pagos privados generada por AVALTOOLKIT.

## Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
PORT=3003
CONTRACT_ADDRESS={{CONTRACT_ADDRESS}}
NETWORK={{NETWORK}}
RPC_URL={{RPC_URL}}
```

### Instalación

1. Instala las dependencias:
```bash
npm install
```

2. Asegúrate de que el proyecto principal de AVALTOOLKIT esté configurado y funcionando.

3. Inicia el servidor:
```bash
npm start
```

Para desarrollo con auto-reload:
```bash
npm run dev
```

## Endpoints

### POST /api/check-balance
Verifica el balance de tokens privados de una dirección.

**Body:**
```json
{
  "address": "0x..."
}
```

### POST /api/mint
Mintea tokens privados para una dirección.

**Body:**
```json
{
  "address": "0x...",
  "amount": 100
}
```

### POST /api/transfer
Transfiere tokens privados entre direcciones.

**Body:**
```json
{
  "from": "0x...",
  "to": "0x...",
  "amount": 50
}
```

### POST /api/burn
Quema tokens privados de una dirección.

**Body:**
```json
{
  "address": "0x...",
  "amount": 25
}
```

### GET /api/health
Verifica el estado del servidor.

## Funcionalidades

- ✅ Verificación de balance de tokens privados
- ✅ Mint de tokens privados
- ✅ Transferencia privada entre wallets
- ✅ Burn de tokens privados
- ✅ Integración con contratos eERC20
- ✅ Soporte para múltiples redes (Fuji, Mainnet, Localhost)

## Tecnologías

- Node.js
- Express.js
- Ethers.js
- Hardhat
- Zero-Knowledge Proofs (ZKP)

## Notas

- Este backend requiere que el proyecto principal de AVALTOOLKIT esté configurado
- Los scripts de Hardhat deben estar disponibles en la carpeta `scripts/standalone/`
- El contrato eERC20 debe estar desplegado en la red especificada
