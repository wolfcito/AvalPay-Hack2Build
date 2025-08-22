const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Iniciando eERC System (Modo Simple)...\n');

// Verificar que existan los directorios
if (!fs.existsSync(path.join(__dirname, 'frontend'))) {
  console.error('❌ Directorio frontend no encontrado');
  process.exit(1);
}
if (!fs.existsSync(path.join(__dirname, 'backend'))) {
  console.error('❌ Directorio backend no encontrado');
  process.exit(1);
}

// Función para ejecutar comandos
function runCommand(command, args, cwd, name) {
  return new Promise((resolve, reject) => {
    console.log(`📦 ${name}...`);
    
    const process = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${name} completado`);
        resolve();
      } else {
        console.error(`❌ ${name} falló con código ${code}`);
        reject(new Error(`${name} falló con código ${code}`));
      }
    });

    process.on('error', (error) => {
      console.error(`❌ Error en ${name}:`, error);
      reject(error);
    });
  });
}

// Función principal
async function startSimpleSystem() {
  try {
    // Instalar dependencias del backend
    console.log('📦 Instalando dependencias del backend...');
    await runCommand('npm', ['install'], path.join(__dirname, 'backend'), 'Backend Dependencies');
    
    // Instalar dependencias del frontend
    console.log('📦 Instalando dependencias del frontend...');
    await runCommand('npm', ['install'], path.join(__dirname, 'frontend'), 'Frontend Dependencies');
    
    // Iniciar backend simplificado
    console.log('🚀 Iniciando backend (modo simulación)...');
    const backend = spawn('npm', ['run', 'simple'], {
      cwd: path.join(__dirname, 'backend'),
      stdio: 'inherit',
      shell: true
    });
    
    // Esperar un poco para que el backend inicie
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Iniciar frontend
    console.log('🚀 Iniciando frontend...');
    const frontend = spawn('npm', ['start'], {
      cwd: path.join(__dirname, 'frontend'),
      stdio: 'inherit',
      shell: true
    });
    
    console.log('\n🎉 Sistema iniciado exitosamente!');
    console.log('📡 Backend: http://localhost:3001 (modo simulación)');
    console.log('🌐 Frontend: http://localhost:3000');
    console.log('\n💡 Presiona Ctrl+C para detener ambos servicios');
    
    // Manejar cierre
    process.on('SIGINT', () => {
      console.log('\n🛑 Deteniendo servicios...');
      backend.kill();
      frontend.kill();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error iniciando el sistema:', error);
    process.exit(1);
  }
}

// Iniciar el sistema
startSimpleSystem();
