import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { withdraw } from "../../test/helpers";
import { i0, decryptEGCTBalance, createUserFromPrivateKey } from "../../src/utils";
import { formatPrivKeyForBabyJub } from "maci-crypto";
import { mulPointEscalar, Base8 } from "@zk-kit/baby-jubjub";

const main = async () => {
    // Get user address and amount from environment variables
    const USER_ADDRESS = process.env.USER_ADDRESS;
    const withdrawAmountStr = process.env.AMOUNT || "5"; // Amount to withdraw
    
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
    
    console.log("💸 Withdrawing encrypted tokens to regular ERC20...");
    console.log("User address:", userAddress);
    console.log("Withdraw amount:", withdrawAmountStr);
    
    // Read addresses from the latest deployment
    const deploymentPath = path.join(__dirname, "../../deployments/converter/latest-converter.json");
    const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    
    const encryptedERCAddress = deploymentData.contracts.encryptedERC;
    const testERC20Address = deploymentData.contracts.testERC20;
    const registrarAddress = deploymentData.contracts.registrar;
    
    console.log("EncryptedERC:", encryptedERCAddress);
    console.log("TestERC20:", testERC20Address);
    
    // Connect to contracts
    const testERC20 = await ethers.getContractAt("SimpleERC20", testERC20Address, wallet);
    const encryptedERC = await ethers.getContractAt("EncryptedERC", encryptedERCAddress, wallet);
    const registrar = await ethers.getContractAt("Registrar", registrarAddress, wallet);
    
    try {
        // Check if user is registered
        const isUserRegistered = await registrar.isUserRegistered(userAddress);
        if (!isUserRegistered) {
            console.error("❌ User is not registered. Please run the registration script first.");
            return;
        }
        console.log("✅ User is registered");
        
        // Generate user's keys
        console.log("🔐 Generating signature for withdrawal...");
        const message = `eERC
Registering user with
 Address:${userAddress.toLowerCase()}`;
        const signature = await wallet.signMessage(message);
        const userPrivateKey = i0(signature);
        
        // Create user object for proof generation
        const user = createUserFromPrivateKey(userPrivateKey, wallet);
        
        // Get public keys
        const userPublicKey = await registrar.getUserPublicKey(userAddress);
        const auditorPublicKey = await encryptedERC.auditorPublicKey();
        
        console.log("🔑 User public key:", [userPublicKey[0].toString(), userPublicKey[1].toString()]);
        console.log("🔑 Auditor public key:", [auditorPublicKey[0].toString(), auditorPublicKey[1].toString()]);
        
        // Verify user's keys match
        const derivedPublicKey = user.publicKey;
        const keysMatch = derivedPublicKey[0] === BigInt(userPublicKey[0].toString()) && 
                         derivedPublicKey[1] === BigInt(userPublicKey[1].toString());
        
        if (!keysMatch) {
            console.error("❌ User's private key doesn't match registered public key!");
            return;
        }
        console.log("✅ User keys verified");
        
        // Get token ID for testERC20
        const tokenId = await encryptedERC.tokenIds(testERC20Address);
        console.log("📋 Token ID:", tokenId.toString());
        
        // Check current balances
        const tokenBalance = await testERC20.balanceOf(userAddress);
        const tokenDecimals = await testERC20.decimals();
        const tokenSymbol = await testERC20.symbol();
        
        console.log(`💰 Current ${tokenSymbol} balance: ${ethers.formatUnits(tokenBalance, tokenDecimals)} ${tokenSymbol}`);
        
        // Get current encrypted balance
        const [eGCT, nonce, amountPCTs, balancePCT, transactionIndex] = await encryptedERC.balanceOf(userAddress, tokenId);
        
        // Decrypt user's balance using EGCT
        const c1: [bigint, bigint] = [BigInt(eGCT.c1.x.toString()), BigInt(eGCT.c1.y.toString())];
        const c2: [bigint, bigint] = [BigInt(eGCT.c2.x.toString()), BigInt(eGCT.c2.y.toString())];
        
        const isEGCTEmpty = c1[0] === 0n && c1[1] === 0n && c2[0] === 0n && c2[1] === 0n;
        if (isEGCTEmpty) {
            console.error("❌ User has no encrypted balance to withdraw");
            return;
        }
        
        const currentEncryptedBalance = decryptEGCTBalance(userPrivateKey, c1, c2);
        console.log(`🔒 Current encrypted balance: ${ethers.formatUnits(currentEncryptedBalance, 2)} encrypted units`);
        
        // Convert withdrawal amount to encrypted units
        const withdrawAmount = ethers.parseUnits(withdrawAmountStr, tokenDecimals);
        const withdrawAmountEncrypted = ethers.parseUnits(withdrawAmountStr, 2); // Encrypted system uses 2 decimals
        
        console.log(`💸 Withdrawing ${withdrawAmountStr} ${tokenSymbol} (${withdrawAmountEncrypted.toString()} encrypted units)`);
        
        // Check if user has enough encrypted balance
        if (currentEncryptedBalance < withdrawAmountEncrypted) {
            console.error(`❌ Insufficient encrypted balance. Need ${withdrawAmountStr} ${tokenSymbol}, but have ${ethers.formatUnits(currentEncryptedBalance, 2)} encrypted units`);
            return;
        }
        
        // Prepare data for withdrawal proof generation
        const userEncryptedBalance = [c1[0], c1[1], c2[0], c2[1]];
        const auditorPublicKeyArray = [BigInt(auditorPublicKey[0].toString()), BigInt(auditorPublicKey[1].toString())];
        
        console.log("🔐 Generating withdrawal proof...");
        console.log("This may take a while...");
        
        // Generate withdrawal proof using the helper function
        const { proof, userBalancePCT } = await withdraw(
            withdrawAmountEncrypted,
            user,
            userEncryptedBalance,
            currentEncryptedBalance,
            auditorPublicKeyArray
        );
        
        console.log("✅ Withdrawal proof generated successfully");
        
        // Perform the withdrawal
        console.log("💸 Executing withdrawal...");
        const withdrawTx = await encryptedERC.withdraw(
            tokenId,
            proof,
            userBalancePCT
        );
        
        console.log("📝 Withdrawal transaction sent:", withdrawTx.hash);
        const receipt = await withdrawTx.wait();
        console.log("✅ Withdrawal confirmed in block:", receipt?.blockNumber);
        
        // Check new balances
        const newTokenBalance = await testERC20.balanceOf(userAddress);
        const tokensReceived = newTokenBalance - tokenBalance;
        
        console.log("🎉 Withdrawal successful!");
        console.log(`💰 Previous ${tokenSymbol} balance: ${ethers.formatUnits(tokenBalance, tokenDecimals)} ${tokenSymbol}`);
        console.log(`💰 New ${tokenSymbol} balance: ${ethers.formatUnits(newTokenBalance, tokenDecimals)} ${tokenSymbol}`);
        console.log(`📦 Tokens received: ${ethers.formatUnits(tokensReceived, tokenDecimals)} ${tokenSymbol}`);
        
        // Check new encrypted balance
        const [newEGCT] = await encryptedERC.balanceOf(userAddress, tokenId);
        const newC1: [bigint, bigint] = [BigInt(newEGCT.c1.x.toString()), BigInt(newEGCT.c1.y.toString())];
        const newC2: [bigint, bigint] = [BigInt(newEGCT.c2.x.toString()), BigInt(newEGCT.c2.y.toString())];
        
        let newDecryptedBalance = 0n;
        const isNewEGCTEmpty = newC1[0] === 0n && newC1[1] === 0n && newC2[0] === 0n && newC2[1] === 0n;
        if (!isNewEGCTEmpty) {
            newDecryptedBalance = decryptEGCTBalance(userPrivateKey, newC1, newC2);
        }
        
        console.log(`🔒 New encrypted balance: ${ethers.formatUnits(newDecryptedBalance, 2)} encrypted units`);
        
        console.log("\n📊 Final Summary:");
        console.log(`   Public ${tokenSymbol}: ${ethers.formatUnits(tokenBalance, tokenDecimals)} → ${ethers.formatUnits(newTokenBalance, tokenDecimals)}`);
        console.log(`   Encrypted Balance: ${ethers.formatUnits(currentEncryptedBalance, 2)} → ${ethers.formatUnits(newDecryptedBalance, 2)} encrypted units`);
        
    } catch (error) {
        console.error("❌ Error during withdrawal:");
        
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
