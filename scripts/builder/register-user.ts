import { ethers } from "hardhat";

async function main() {
  try {
    console.log("🔑 Registrando usuario en el sistema Converter generado...");
    
    // Obtener el signer actual
    const [signer] = await ethers.getSigners();
    console.log("👤 Wallet:", signer.address);
    
    // Leer el deployment data del Builder (Converter generado)
    const deploymentData = require("../../deployments/builder/latest-builder.json");
    console.log("📋 Deployment data cargado:", deploymentData.contracts.registrar);
    
    // Conectar al contrato Registrar
    const registrar = await ethers.getContractAt("Registrar", deploymentData.contracts.registrar);
    console.log("✅ Conectado al contrato Registrar");
    
    // Verificar si el usuario ya está registrado
    const isRegistered = await registrar.isUserRegistered(signer.address);
    console.log("📋 Usuario registrado:", isRegistered);
    
    if (isRegistered) {
      console.log("✅ Usuario ya está registrado en el sistema");
      return;
    }
    
    // Generar keys para el usuario usando el patrón correcto
    const { deriveKeysFromUser } = require("../../src/utils");
    const { publicKey, signature } = await deriveKeysFromUser(signer.address, signer);
    
    console.log("🔐 Keys generadas:");
    console.log("   Public Key:", publicKey);
    console.log("   Signature:", signature);
    
    // Registrar usuario usando el patrón correcto
    console.log("📝 Registrando usuario...");
    const tx = await registrar.registerUser(publicKey);
    await tx.wait();
    
    console.log("✅ Usuario registrado exitosamente en el sistema Converter");
    console.log("🎉 Ahora puedes usar las funciones de migración");
    
  } catch (error) {
    console.error("❌ Error registrando usuario:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error("❌ Error en main:", error);
  process.exit(1);
});
