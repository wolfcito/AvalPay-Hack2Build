// Script temporal para solucionar el problema de la dirección del contrato
// Este script se ejecutará en el navegador para extraer y guardar la dirección

function extractAndSaveContractAddress() {
  console.log('🔍 Buscando dirección del contrato en los logs...');
  
  // Buscar en el DOM por logs de despliegue
  const logs = document.querySelectorAll('.log-output, .stdout, pre');
  let contractAddress = null;
  
  for (const log of logs) {
    const text = log.textContent || log.innerText;
    
    // Buscar patrón de dirección encryptedERC
    const match = text.match(/encryptedERC.*?['"](0x[a-fA-F0-9]{40})['"]/);
    if (match) {
      contractAddress = match[1];
      console.log('✅ Dirección encontrada:', contractAddress);
      break;
    }
  }
  
  if (contractAddress) {
    localStorage.setItem('lastContractAddress', contractAddress);
    console.log('💾 Dirección guardada en localStorage:', contractAddress);
    return contractAddress;
  } else {
    console.log('❌ No se encontró dirección del contrato');
    return null;
  }
}

// Ejecutar la función
extractAndSaveContractAddress();
