const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Iniciando solo el Frontend para pruebas...\n');

// Verificar que exista el directorio frontend
if (!fs.existsSync(path.join(__dirname, 'frontend'))) {
  console.error('❌ Directorio frontend no encontrado');
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
async function startFrontendOnly() {
  try {
    // Instalar dependencias del frontend
    console.log('📦 Instalando dependencias del frontend...');
    await runCommand('npm', ['install'], path.join(__dirname, 'frontend'), 'Instalación de dependencias');
    
    // Iniciar frontend
    console.log('🚀 Iniciando frontend...');
    const frontend = spawn('npm', ['start'], {
      cwd: path.join(__dirname, 'frontend'),
      stdio: 'inherit',
      shell: true
    });
    
    console.log('\n🎉 Frontend iniciado exitosamente!');
    console.log('🌐 Frontend: http://localhost:3000');
    console.log('\n💡 Presiona Ctrl+C para detener el servicio');
    
    // Manejar cierre
    process.on('SIGINT', () => {
      console.log('\n🛑 Deteniendo frontend...');
      frontend.kill();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error iniciando el frontend:', error);
    process.exit(1);
  }
}

// Iniciar el frontend
startFrontendOnly();
