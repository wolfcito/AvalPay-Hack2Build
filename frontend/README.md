# 🔐 eERC Frontend

Frontend simple y moderno para el sistema de tokens encriptados eERC.

## 🚀 Características

- **UI Simple**: Interfaz intuitiva y fácil de usar
- **MetaMask Integration**: Conexión directa con MetaMask
- **Operaciones Dinámicas**: Todas las operaciones del sistema eERC
- **Zero-Knowledge**: Mantiene la privacidad completa
- **Responsive**: Funciona en desktop y móvil

## 📋 Operaciones Disponibles

1. **🔗 Conectar Wallet**: Conexión con MetaMask
2. **🔍 Verificar Registro**: Comprobar si el usuario está registrado
3. **📝 Registrar Usuario**: Registrar nuevo usuario en el sistema
4. **🚰 Obtener Tokens**: Reclamar tokens del faucet
5. **💰 Hacer Depósito**: Convertir tokens públicos a privados
6. **📊 Verificar Balance**: Ver balances públicos y privados

## 🛠️ Instalación

### Opción 1: Inicio Automático (Recomendado)
```bash
# Desde el directorio raíz del proyecto
npm run frontend
```

### Opción 2: Instalación Manual
```bash
# Instalar dependencias
cd frontend
npm install

# Iniciar frontend
npm start
```

## 🌐 Uso

1. **Abrir navegador**: http://localhost:3000
2. **Conectar MetaMask**: Hacer clic en "Conectar MetaMask"
3. **Seleccionar red**: Asegurarse de estar en Avalanche Fuji Testnet
4. **Usar operaciones**: Hacer clic en los botones para cada operación

## 🔧 Configuración

### Redes Soportadas
- **Avalanche Fuji Testnet**: Para pruebas
- **Avalanche Mainnet**: Para producción

### Requisitos
- MetaMask instalado
- Cuenta con AVAX para gas fees
- Conexión a internet

## 🎨 Diseño

- **Tema**: Gradiente morado-azul moderno
- **Componentes**: Glassmorphism con efectos blur
- **Responsive**: Adaptable a diferentes tamaños de pantalla
- **Animaciones**: Transiciones suaves y feedback visual

## 🔐 Seguridad

- **Claves Dinámicas**: Cada usuario genera sus propias claves
- **Sin Almacenamiento**: Las claves privadas nunca se almacenan
- **MetaMask**: Todas las transacciones se firman con MetaMask
- **Zero-Knowledge**: Privacidad completa en todas las operaciones

## 🚀 Próximas Funcionalidades

- [ ] Transferencias privadas entre usuarios
- [ ] Retiros de tokens privados
- [ ] Historial de transacciones
- [ ] Dashboard avanzado
- [ ] Notificaciones push

## 📞 Soporte

Si encuentras algún problema:
1. Verifica que MetaMask esté conectado
2. Asegúrate de estar en la red correcta
3. Revisa que tengas AVAX para gas fees
4. Consulta la consola del navegador para errores

## 🎯 Ventajas de este Enfoque

- **Simplicidad**: No reescribe la lógica ZK existente
- **Confiabilidad**: Usa los scripts que ya funcionan
- **Mantenibilidad**: Fácil de actualizar y mantener
- **Escalabilidad**: Puede agregar nuevas funcionalidades fácilmente
