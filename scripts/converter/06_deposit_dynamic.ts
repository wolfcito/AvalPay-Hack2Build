import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { processPoseidonEncryption } from "../../src/poseidon";
import { deriveKeysFromUser, getDecryptedBalance } from "../../src/utils";

const main = async () => {
    // Get user address and amount from environment variables
    const USER_ADDRESS = process.env.USER_ADDRESS;
    const depositAmountStr = process.env.AMOUNT || "50"; // Amount to Deposit
    
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
    
    console.log("🔧 Depositing", depositAmountStr, "TEST token into EncryptedERC...");
    console.log("User address:", userAddress);
    console.log("EncryptedERC:", encryptedERCAddress);
    console.log("TestERC20:", testERC20Address);
    
    // Connect to contracts using the wallet
    const testERC20 = await ethers.getContractAt("SimpleERC20", testERC20Address, wallet);
    const encryptedERC = await ethers.getContractAt("EncryptedERC", encryptedERCAddress, wallet);
    const registrar = await ethers.getContractAt("Registrar", registrarAddress, wallet);
    
    try {
        // 1. Check if user is registered
        const isRegistered = await registrar.isUserRegistered(userAddress);
        if (!isRegistered) {
            console.error("❌ User is not registered. Please run the registration script first.");
            console.log("💡 Run: npx hardhat run scripts/03_register-user.ts --network fuji");
            return;
        }
        console.log("✅ User is registered");
        
        // 2. Generate keys using utility function
        const { privateKey: userPrivateKey, formattedPrivateKey, publicKey: derivedPublicKey, signature } = await deriveKeysFromUser(userAddress, wallet);
        
        // 3. Get user's public key for PCT generation
        const userPublicKey = await registrar.getUserPublicKey(userAddress);
        console.log("🔑 User public key:", [userPublicKey[0].toString(), userPublicKey[1].toString()]);
        
        // Verify public keys match (they should be the same)
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
        
        console.log(`💰 Current ${tokenSymbol} balance:`, ethers.formatUnits(tokenBalance, tokenDecimals), tokenSymbol);
        
        // 5. Check current encrypted balance before deposit
        console.log("🔍 Checking current encrypted balance...");
        try {
            // Get token ID for testERC20 (0 if not registered, or actual ID if registered)
            let tokenId = 0n;
            try {
                tokenId = await encryptedERC.tokenIds(testERC20Address);
                if (tokenId === 0n) {
                    console.log("📋 Token not yet registered in EncryptedERC (will be registered on first deposit)");
                }
            } catch (error) {
                console.log("📋 Token not yet registered in EncryptedERC");
            }
            
            // Get encrypted balance components using balanceOf function
            const [eGCT, nonce, amountPCTs, balancePCT, transactionIndex] = await encryptedERC.balanceOf(userAddress, tokenId);
            const encryptedBalance = [
                [BigInt(eGCT.c1.x.toString()), BigInt(eGCT.c1.y.toString())],
                [BigInt(eGCT.c2.x.toString()), BigInt(eGCT.c2.y.toString())]
            ];
            console.log({encryptedBalance})
            const balancePCTArray = balancePCT.map((x: any) => BigInt(x.toString()));
            
            // Decrypt and calculate total balance
            const decryptedBalance = await getDecryptedBalance(
                userPrivateKey,
                amountPCTs,
                balancePCTArray,
                encryptedBalance
            );
            console.log({decryptedBalance})
            
            // Convert to display units (the encrypted system uses 2 decimals as per constants)
            const encryptedSystemDecimals = 2;
            console.log(`🔒 Current encrypted balance: ${ethers.formatUnits(decryptedBalance, encryptedSystemDecimals)} (encrypted units)`);
            
        } catch (error) {
            console.log("📋 No previous encrypted balance found (first deposit)");
        }
        
        // 6. Convert deposit amount to wei
        const depositAmount = ethers.parseUnits(depositAmountStr, tokenDecimals);
        console.log(`💰 Deposit amount: ${depositAmountStr} ${tokenSymbol} (${depositAmount.toString()} wei)`);
        
        // 7. Check if user has enough tokens
        if (tokenBalance < depositAmount) {
            console.error(`❌ Insufficient ${tokenSymbol} balance. Need ${depositAmountStr} ${tokenSymbol}, but have ${ethers.formatUnits(tokenBalance, tokenDecimals)} ${tokenSymbol}`);
            return;
        }
        
        // 8. Approve testERC20 tokens for EncryptedERC
        console.log("🔐 Approving tokens for EncryptedERC...");
        const approveTx = await testERC20.approve(encryptedERCAddress, depositAmount);
        console.log("📝 Approval transaction sent:", approveTx.hash);
        
        const approveReceipt = await approveTx.wait();
        console.log("✅ Approval confirmed in block:", approveReceipt?.blockNumber);
        
        // 9. Encrypt the deposit amount using Poseidon
        console.log("🔐 Encrypting deposit amount...");
        const encryptedAmount = await processPoseidonEncryption([depositAmount], derivedPublicKey);
        console.log("🔐 Encrypted amount:", encryptedAmount);
        
        // 10. Create PCT (Proof of Correct Transfer) for the deposit
        console.log("📋 Creating PCT for deposit...");
        
        // Format amountPCT as [ciphertext (5 elements), authKey (2 elements), nonce (1 element)] = 7 elements total
        const amountPCT: [bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
            ...encryptedAmount.ciphertext,
            ...encryptedAmount.authKey,
            encryptedAmount.nonce
        ] as [bigint, bigint, bigint, bigint, bigint, bigint, bigint];
        
        console.log("📋 PCT created with 7 elements:", amountPCT.length);
        
        // 11. Deposit tokens into EncryptedERC
        console.log("💰 Depositing tokens into EncryptedERC...");
        const depositTx = await encryptedERC.deposit(
            depositAmount,
            testERC20Address,
            amountPCT
        );
        console.log("📝 Deposit transaction sent:", depositTx.hash);
        
        const depositReceipt = await depositTx.wait();
        console.log("✅ Deposit confirmed in block:", depositReceipt?.blockNumber);
        
        // 12. Check new balances
        console.log("🔍 Checking new balances...");
        
        // Check new testERC20 balance
        const newTokenBalance = await testERC20.balanceOf(userAddress);
        const tokenDifference = tokenBalance - newTokenBalance;
        console.log(`💰 New ${tokenSymbol} balance: ${ethers.formatUnits(newTokenBalance, tokenDecimals)} ${tokenSymbol}`);
        console.log(`💰 Tokens spent: ${ethers.formatUnits(tokenDifference, tokenDecimals)} ${tokenSymbol}`);
        
        // Check new encrypted balance
        try {
            const [newEGCT, newNonce, newAmountPCTs, newBalancePCT, newTransactionIndex] = await encryptedERC.balanceOf(userAddress, tokenId);
            const newEncryptedBalance = [
                [BigInt(newEGCT.c1.x.toString()), BigInt(newEGCT.c1.y.toString())],
                [BigInt(newEGCT.c2.x.toString()), BigInt(newEGCT.c2.y.toString())]
            ];
            const newBalancePCTArray = newBalancePCT.map((x: any) => BigInt(x.toString()));
            
            const newDecryptedBalance = await getDecryptedBalance(
                userPrivateKey,
                newAmountPCTs,
                newBalancePCTArray,
                newEncryptedBalance
            );
            
            console.log(`🔒 New encrypted balance: ${ethers.formatUnits(newDecryptedBalance, 2)} (encrypted units)`);
            
        } catch (error) {
            console.log("📋 Could not retrieve new encrypted balance");
        }
        
        console.log("🎉 Deposit successful!");
        console.log(`💰 Deposited ${depositAmountStr} ${tokenSymbol} into encrypted system`);
        
    } catch (error) {
        console.error("❌ Error during deposit:");
        
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
