import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

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
    
    const testERC20Address = deploymentData.contracts.testERC20;
    
    console.log("🔧 Claiming tokens from testERC20 faucet...");
    console.log("Token address:", testERC20Address);
    console.log("User address:", userAddress);
    
    // Connect to the testERC20 contract using the wallet
    const testERC20 = await ethers.getContractAt("SimpleERC20", testERC20Address, wallet);
    
    try {
        // Get token details
        const name = await testERC20.name();
        const symbol = await testERC20.symbol();
        const decimals = await testERC20.decimals();
        const faucetAmount = await testERC20.FAUCET_AMOUNT();
        
        console.log("📋 Token Details:");
        console.log("- Name:", name);
        console.log("- Symbol:", symbol);
        console.log("- Decimals:", decimals.toString());
        console.log("- Faucet amount:", ethers.formatUnits(faucetAmount, decimals), symbol);
        
        // Check current token balance
        const currentBalance = await testERC20.balanceOf(userAddress);
        console.log("💰 Current token balance:", ethers.formatUnits(currentBalance, decimals), symbol);
        
        // Check if user can claim from faucet
        const canClaim = await testERC20.canClaimFromFaucet(userAddress);
        console.log("🚰 Can claim from faucet:", canClaim);
        
        if (!canClaim) {
            // Get next claim time
            const nextClaimTime = await testERC20.getNextFaucetClaimTime(userAddress);
            const now = Math.floor(Date.now() / 1000);
            const waitTime = Number(nextClaimTime) - now;
            
            if (waitTime > 0) {
                const hours = Math.floor(waitTime / 3600);
                const minutes = Math.floor((waitTime % 3600) / 60);
                console.log(`⏰ Next claim available in: ${hours}h ${minutes}m`);
                console.log(`⏰ Next claim time: ${new Date(Number(nextClaimTime) * 1000).toLocaleString()}`);
            } else {
                console.log("🤔 Claim should be available, trying anyway...");
            }
        }
        
        if (canClaim) {
            console.log("🚰 Claiming tokens from faucet...");
            
            // Claim from faucet
            const claimTx = await testERC20.claimFromFaucet();
            console.log("📝 Transaction sent:", claimTx.hash);
            
            const receipt = await claimTx.wait();
            console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);
            
            // Check new balance
            const newBalance = await testERC20.balanceOf(userAddress);
            const received = newBalance - currentBalance;
            
            console.log("🎉 Faucet claim successful!");
            console.log("💰 Previous balance:", ethers.formatUnits(currentBalance, decimals), symbol);
            console.log("💰 New balance:", ethers.formatUnits(newBalance, decimals), symbol);
            console.log("🎁 Tokens received:", ethers.formatUnits(received, decimals), symbol);
            
            // Show next claim time
            const nextClaimTime = await testERC20.getNextFaucetClaimTime(userAddress);
            console.log(`⏰ Next claim available at: ${new Date(Number(nextClaimTime) * 1000).toLocaleString()}`);
            
        } else {
            console.log("❌ Cannot claim from faucet at this time. Please wait for the cooldown period to end.");
        }
        
    } catch (error) {
        console.error("❌ Error during faucet claim:");
        
        // Show detailed error information
        if (error instanceof Error) {
            console.error("Error type:", error.constructor.name);
            console.error("Message:", error.message);
            
            // Handle specific errors
            if (error.message.includes("Faucet: Cooldown period not elapsed")) {
                console.error("💡 Hint: You need to wait 24 hours between faucet claims");
            } else if (error.message.includes("Faucet: Already claimed")) {
                console.error("💡 Hint: You have already claimed from the faucet");
            } else if (error.message.includes("Faucet: Not enough tokens")) {
                console.error("💡 Hint: The faucet is out of tokens");
            }
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
