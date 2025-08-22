const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando eERC System (Modo Optimizado)...');

// Función para instalar dependencias
const installDependencies = (directory, name) => {
  return new Promise((resolve, reject) => {
    console.log(`📦 Instalando dependencias de ${name}...`);
    const install = spawn('npm', ['install'], { 
      cwd: directory, 
      stdio: 'inherit',
      shell: true 
    });
    
    install.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${name} Dependencies completado`);
        resolve();
      } else {
        reject(new Error(`${name} installation failed with code ${code}`));
      }
    });
  });
};

// Función para iniciar servicios
const startService = (command, args, cwd, name) => {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Iniciando ${name}...`);
    const service = spawn(command, args, { 
      cwd, 
      stdio: 'inherit',
      shell: true 
    });
    
    service.on('error', (error) => {
      console.error(`❌ Error starting ${name}:`, error);
      reject(error);
    });
    
    // Dar tiempo para que el servicio se inicie
    setTimeout(() => {
      console.log(`✅ ${name} iniciado exitosamente`);
      resolve(service);
    }, 3000);
  });
};

// Función principal
const main = async () => {
  try {
    // Instalar dependencias del backend
    await installDependencies(path.join(__dirname, 'backend'), 'backend');
    
    // Instalar dependencias del frontend
    await installDependencies(path.join(__dirname, 'frontend'), 'frontend');
    
    // Iniciar backend optimizado
    const backend = await startService('npm', ['run', 'optimized'], path.join(__dirname, 'backend'), 'backend (modo optimizado)');
    
    // Iniciar frontend
    const frontend = await startService('npm', ['start'], path.join(__dirname, 'frontend'), 'frontend');
    
    console.log('🎉 Sistema optimizado iniciado exitosamente!');
    console.log('📡 Backend: http://localhost:3001 (modo optimizado)');
    console.log('🌐 Frontend: http://localhost:3000');
    console.log('');
    console.log('⚡ Optimizaciones aplicadas:');
    console.log('   • Scripts dinámicos nativos (sin archivos temporales)');
    console.log('   • Cache de setup ZK');
    console.log('   • Cache de verificación de registro');
    console.log('   • Cache de verificación de balance');
    console.log('   • Variables de entorno para datos dinámicos');
    
    // Manejar cierre graceful
    const cleanup = () => {
      console.log('\n🛑 Cerrando sistema...');
      backend.kill();
      frontend.kill();
      process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
  } catch (error) {
    console.error('❌ Error al iniciar el sistema:', error);
    process.exit(1);
  }
};

main();
