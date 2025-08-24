import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { deriveKeysFromUser, getDecryptedBalance } from "../../src/utils";

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
    
    const encryptedERCAddress = deploymentData.contracts.encryptedERC;
    const testERC20Address = deploymentData.contracts.testERC20;
    const registrarAddress = deploymentData.contracts.registrar;
    
    console.log("🔍 Checking encrypted balance for user...");
    console.log("User address:", userAddress);
    console.log("EncryptedERC:", encryptedERCAddress);
    console.log("TestERC20:", testERC20Address);
    
    // Connect to contracts
    const encryptedERC = await ethers.getContractAt("EncryptedERC", encryptedERCAddress);
    const testERC20 = await ethers.getContractAt("SimpleERC20", testERC20Address);
    const registrar = await ethers.getContractAt("Registrar", registrarAddress);
    
    try {
        // 1. Check if user is registered
        const isRegistered = await registrar.isUserRegistered(userAddress);
        if (!isRegistered) {
            console.error("❌ User is not registered. Please run the registration script first.");
            return;
        }
        console.log("✅ User is registered");
        
        // 2. Generate keys using utility function
        const { privateKey: userPrivateKey, formattedPrivateKey, publicKey: derivedPublicKey, signature } = await deriveKeysFromUser(userAddress, wallet);
        
        // 3. Get user's public key for verification
        const userPublicKey = await registrar.getUserPublicKey(userAddress);
        console.log("🔑 User public key:", [userPublicKey[0].toString(), userPublicKey[1].toString()]);
        
        // Verify public keys match
        const publicKeysMatch = derivedPublicKey[0] === BigInt(userPublicKey[0].toString()) && 
                               derivedPublicKey[1] === BigInt(userPublicKey[1].toString());
        if (publicKeysMatch) {
            console.log("✅ Derived public key matches registered public key");
        } else {
            console.log("⚠️  Derived public key doesn't match registered key - this may cause decryption issues");
        }
        
        // 4. Check testERC20 balance
        const tokenBalance = await testERC20.balanceOf(userAddress);
        const tokenDecimals = await testERC20.decimals();
        const tokenSymbol = await testERC20.symbol();
        
        console.log(`💰 Public ${tokenSymbol} balance: ${ethers.formatUnits(tokenBalance, tokenDecimals)} ${tokenSymbol}`);
        
        // 5. Get token ID for testERC20
        let tokenId = 0n;
        try {
            tokenId = await encryptedERC.tokenIds(testERC20Address);
            console.log("📋 Token ID in EncryptedERC:", tokenId.toString());
        } catch (error) {
            console.log("📋 Token not yet registered in EncryptedERC");
        }
        
        // 6. Get encrypted balance from contract
        console.log("🔍 Reading encrypted balance from contract...");
        const [eGCT, nonce, amountPCTs, balancePCT, transactionIndex] = await encryptedERC.balanceOf(userAddress, tokenId);
        
        console.log("📋 Balance Details:");
        console.log("  - Transaction Index:", transactionIndex.toString());
        console.log("  - Nonce:", nonce.toString());
        console.log("  - Number of Amount PCTs:", amountPCTs.length);
        
        // 7. Decrypt the balance
        console.log("🔐 Decrypting EGCT using ElGamal...");
        const encryptedBalance = [
            [BigInt(eGCT.c1.x.toString()), BigInt(eGCT.c1.y.toString())],
            [BigInt(eGCT.c2.x.toString()), BigInt(eGCT.c2.y.toString())]
        ];
        
        console.log("  - EGCT C1:", [
            encryptedBalance[0][0].toString(),
            encryptedBalance[0][1].toString()
        ]);
        console.log("  - EGCT C2:", [
            encryptedBalance[1][0].toString(),
            encryptedBalance[1][1].toString()
        ]);
        
        const balancePCTArray = balancePCT.map((x: any) => BigInt(x.toString()));
        
        // Decrypt and calculate total balance
        const decryptedBalance = await getDecryptedBalance(
            userPrivateKey,
            amountPCTs,
            balancePCTArray,
            encryptedBalance
        );
        
        // Convert to display units (the encrypted system uses 2 decimals as per constants)
        const encryptedSystemDecimals = 2;
        console.log("💰 EGCT Balance (raw):", decryptedBalance.toString());
        console.log("🔒 EGCT Balance:", ethers.formatUnits(decryptedBalance, encryptedSystemDecimals), "encrypted units");
        
        // 8. Calculate total from PCTs
        let totalFromPCTs = 0n;
        if (amountPCTs.length > 0) {
            console.log("📋 Processing Amount PCTs...");
            for (let i = 0; i < amountPCTs.length; i++) {
                const pct = amountPCTs[i];
                if (pct && pct.amount) {
                    const pctAmount = BigInt(pct.amount.toString());
                    totalFromPCTs += pctAmount;
                    console.log(`  - PCT ${i}: ${ethers.formatUnits(pctAmount, encryptedSystemDecimals)} encrypted units`);
                } else {
                    console.log(`  - PCT ${i}: Skipped (no amount data)`);
                }
            }
        }
        
        console.log("💰 Balance PCT (decrypted):", totalFromPCTs.toString());
        
        // 9. Display summary
        console.log("📊 Balance Summary:");
        console.log("   EGCT Balance (main):", ethers.formatUnits(decryptedBalance, encryptedSystemDecimals), "encrypted units");
        console.log("   Total from PCTs:", ethers.formatUnits(totalFromPCTs, encryptedSystemDecimals), "encrypted units");
        console.log("   Public", tokenSymbol, "Balance:", ethers.formatUnits(tokenBalance, tokenDecimals), tokenSymbol);
        
        console.log("💡 Balance Explanation:");
        console.log("   • EGCT Balance: Your main encrypted balance stored on-chain");
        console.log("   • Amount PCTs: Transaction history for auditing purposes");
        console.log("   • Public Balance: Your regular", tokenSymbol, "tokens (not encrypted)");
        console.log("   • Encrypted System: Uses", encryptedSystemDecimals, "decimal places internally");
        
        // 10. Verify consistency
        if (decryptedBalance === totalFromPCTs) {
            console.log("✅ EGCT balance matches PCT total - encryption is consistent");
        } else {
            console.log("⚠️  EGCT balance doesn't match PCT total - there may be an issue");
        }
        
    } catch (error) {
        console.error("❌ Error during balance check:");
        
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
