import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { deriveKeysFromUser } from "../../src/utils";

const main = async () => {
    // Get user address from environment variable
    const USER_ADDRESS = process.env.USER_ADDRESS;
    
    if (!USER_ADDRESS) {
        console.error("❌ USER_ADDRESS environment variable is required");
        return;
    }
    
    // Find the signer that matches the user address
    const signers = await ethers.getSigners();
    const wallet = signers.find(signer => 
        signer.address.toLowerCase() === USER_ADDRESS.toLowerCase()
    ) || signers[0];
    
    const userAddress = USER_ADDRESS;
    
    // Read addresses from the latest deployment
    const deploymentPath = path.join(__dirname, "../../deployments/converter/latest-converter.json");
    const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    
    const registrarAddress = deploymentData.contracts.registrar;
    
    console.log("🔧 Registering user in EncryptedERC system...");
    console.log("User address:", userAddress);
    console.log("Registrar:", registrarAddress);
    
    // Connect to the registrar contract
    const registrar = await ethers.getContractAt("Registrar", registrarAddress, wallet);
    
    try {
        // Check if user is already registered
        const isRegistered = await registrar.isUserRegistered(userAddress);
        if (isRegistered) {
            console.log("✅ User is already registered");
            return;
        }
        
        console.log("📝 Registering user with");
        console.log(" Address:" + userAddress);
        
        // Generate keys using utility function
        const { publicKey: derivedPublicKey, signature } = await deriveKeysFromUser(userAddress, wallet);
        
        // Register user with the derived public key
        const registerTx = await registrar.registerUser(derivedPublicKey);
        console.log("📝 Registration transaction sent:", registerTx.hash);
        
        const receipt = await registerTx.wait();
        console.log("✅ Registration confirmed in block:", receipt?.blockNumber);
        
        console.log("✅ User registered successfully");
        console.log("🔑 Public key:", [derivedPublicKey[0].toString(), derivedPublicKey[1].toString()]);
        
    } catch (error) {
        console.error("❌ Error during user registration:");
        
        if (error instanceof Error) {
            console.error("Error type:", error.constructor.name);
            console.error("Message:", error.message);
        }
        
        throw error;
    }
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
