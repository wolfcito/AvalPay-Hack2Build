// (c) 2025, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

// SPDX-License-Identifier: Ecosystem
pragma solidity 0.8.27;

// contracts
import {TokenTracker} from "./tokens/TokenTracker.sol";
import {EncryptedUserBalances} from "./EncryptedUserBalances.sol";
import {AuditorManager} from "./auditor/AuditorManager.sol";

// libraries
import {BabyJubJub} from "./libraries/BabyJubJub.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// types
import {CreateEncryptedERCParams, Point, EGCT, EncryptedBalance, AmountPCT, MintProof, TransferProof, WithdrawProof, BurnProof, TransferInputs} from "./types/Types.sol";

// errors
import {UserNotRegistered, InvalidProof, TransferFailed, UnknownToken, InvalidChainId, InvalidNullifier, ZeroAddress} from "./errors/Errors.sol";

// interfaces
import {IRegistrar} from "./interfaces/IRegistrar.sol";
import {IMintVerifier} from "./interfaces/verifiers/IMintVerifier.sol";
import {IWithdrawVerifier} from "./interfaces/verifiers/IWithdrawVerifier.sol";
import {ITransferVerifier} from "./interfaces/verifiers/ITransferVerifier.sol";
import {IBurnVerifier} from "./interfaces/verifiers/IBurnVerifier.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

//             /$$$$$$$$ /$$$$$$$   /$$$$$$
//            | $$_____/| $$__  $$ /$$__  $$
//    /$$$$$$ | $$      | $$  \ $$| $$  \__/
//   /$$__  $$| $$$$$   | $$$$$$$/| $$  | $$
//  | $$_____/| $$      | $$  \ $$| $$  | $$
//  |  $$$$$$$| $$$$$$$$| $$  | $$|  $$$$$$/
//   \_______/|________/|__/  |__/ \______/
//
/**
 * @title EncryptedERC
 * @notice A privacy-preserving ERC20 token implementation that uses zero-knowledge proofs for managing balances in encrypted manner.
 * @dev This contract implements Encrypted ERC operations using zero-knowledge proofs.
 *
 * Key features:
 * - Encrypted ERC has 2 modes:
 *   - Standalone Mode: Act like a standalone ERC20 token (mint, burn, transfer)
 *   - Converter Mode: Wraps existing ERC20 tokens and encrypted ERC20 tokens (deposit, withdraw, transfer)
 * - Auditor Manager: Manages auditor's public key
 * - Token Tracker: Manages ERC20 token registration for deposit and withdrawal
 * - Encrypted User Balances: Manages encrypted balances for users in encrypted manner
 *
 * The contract uses three main components:
 * 1. TokenTracker: Manages token registration and tracking
 * 2. EncryptedUserBalances: Handles encrypted balance storage and updates
 * 3. AuditorManager: Manages auditor-related functionality
 */
contract EncryptedERC is TokenTracker, EncryptedUserBalances, AuditorManager {
    ///////////////////////////////////////////////////
    ///                   State Variables           ///
    ///////////////////////////////////////////////////

    /// @notice Address of the registrar contract that manages user registration
    IRegistrar public registrar;

    /// @notice Verifier contracts for each operation
    IMintVerifier public mintVerifier;
    IWithdrawVerifier public withdrawVerifier;
    ITransferVerifier public transferVerifier;
    IBurnVerifier public burnVerifier;

    /// @notice Token metadata
    string public name;
    string public symbol;
    uint8 public immutable decimals;

    /// @notice Mapping to track used mint nullifiers to prevent double-minting
    mapping(uint256 mintNullifier => bool isUsed) public alreadyMinted;

    ///////////////////////////////////////////////////
    ///                    Events                   ///
    ///////////////////////////////////////////////////

    /**
     * @notice Emitted when a private mint operation occurs
     * @param user Address of the user receiving the minted tokens
     * @param auditorPCT Auditor PCT values for compliance tracking
     * @param auditorAddress Address of the auditor
     * @dev This event is emitted when tokens are privately minted to a user
     */
    event PrivateMint(
        address indexed user,
        uint256[7] auditorPCT,
        address indexed auditorAddress
    );

    /**
     * @notice Emitted when a private burn operation occurs
     * @param user Address of the user burning the tokens
     * @param auditorPCT Auditor PCT values for compliance tracking
     * @param auditorAddress Address of the auditor
     * @dev This event is emitted when tokens are privately burned by a user
     */
    event PrivateBurn(
        address indexed user,
        uint256[7] auditorPCT,
        address indexed auditorAddress
    );

    /**
     * @notice Emitted when a private transfer operation occurs
     * @param from Address of the sender
     * @param to Address of the receiver
     * @param auditorPCT Auditor PCT values for compliance tracking
     * @param auditorAddress Address of the auditor
     * @dev This event is emitted when tokens are privately transferred between users
     */
    event PrivateTransfer(
        address indexed from,
        address indexed to,
        uint256[7] auditorPCT,
        address indexed auditorAddress
    );

    /**
     * @notice Emitted when a deposit operation occurs
     * @param user Address of the user making the deposit
     * @param amount Amount of tokens deposited
     * @param dust Amount of dust (remainder) from the deposit
     * @param tokenId ID of the token being deposited
     * @dev This event is emitted when a user deposits tokens into the contract
     */
    event Deposit(
        address indexed user,
        uint256 amount,
        uint256 dust,
        uint256 tokenId
    );

    /**
     * @notice Emitted when a withdrawal operation occurs
     * @param user Address of the user making the withdrawal
     * @param amount Amount of tokens withdrawn
     * @param tokenId ID of the token being withdrawn
     * @param auditorPCT Auditor PCT values for compliance tracking
     * @param auditorAddress Address of the auditor
     * @dev This event is emitted when a user withdraws tokens from the contract
     */
    event Withdraw(
        address indexed user,
        uint256 amount,
        uint256 tokenId,
        uint256[7] auditorPCT,
        address indexed auditorAddress
    );

    ///////////////////////////////////////////////////
    ///                   Modifiers                 ///
    ///////////////////////////////////////////////////
    modifier onlyIfUserRegistered(address user) {
        bool isRegistered = registrar.isUserRegistered(user);
        if (!isRegistered) {
            revert UserNotRegistered();
        }
        _;
    }

    ///////////////////////////////////////////////////
    ///                   Constructor               ///
    ///////////////////////////////////////////////////

    /**
     * @notice Initializes the EncryptedERC contract with the given parameters
     * @param params The initialization parameters containing contract addresses and token metadata
     * @dev This constructor sets up the contract with necessary verifiers, registrar, and token metadata.
     *      It also determines whether the contract will function as a converter or standalone token.
     */
    constructor(
        CreateEncryptedERCParams memory params
    ) TokenTracker(params.isConverter) {
        // Validate contract addresses
        if (
            params.registrar == address(0) ||
            params.mintVerifier == address(0) ||
            params.withdrawVerifier == address(0) ||
            params.transferVerifier == address(0) ||
            params.burnVerifier == address(0)
        ) {
            revert ZeroAddress();
        }

        // Initialize contracts
        registrar = IRegistrar(params.registrar);
        mintVerifier = IMintVerifier(params.mintVerifier);
        withdrawVerifier = IWithdrawVerifier(params.withdrawVerifier);
        transferVerifier = ITransferVerifier(params.transferVerifier);
        burnVerifier = IBurnVerifier(params.burnVerifier);

        // if contract is not a converter, then set the name and symbol
        if (!params.isConverter) {
            name = params.name;
            symbol = params.symbol;
        }

        decimals = params.decimals;
    }

    ///////////////////////////////////////////////////
    ///                   External                  ///
    ///////////////////////////////////////////////////

    /**
     * @notice Sets the auditor's public key for a registered user
     * @param user Address of the user to set as auditor
     * @dev This function:
     *      1. Verifies the user is registered
     *      2. Retrieves the user's public key
     *      3. Updates the auditor's information
     *
     * Requirements:
     * - Caller must be the contract owner
     * - User must be registered
     */
    function setAuditorPublicKey(
        address user
    ) external onlyOwner onlyIfUserRegistered(user) {
        uint256[2] memory publicKey_ = registrar.getUserPublicKey(user);
        _updateAuditor(user, publicKey_);
    }

    /**
     * @notice Performs a private mint operation for a registered user
     * @param user The address of the user to mint tokens to
     * @param proof The zero-knowledge proof proving the validity of the mint operation
     * @dev This function:
     *      1. Validates the chain ID and user registration
     *      2. Verifies the user's public key matches the proof
     *      3. Verifies the auditor's public key matches the proof
     *      4. Checks the mint nullifier hasn't been used
     *      5. Verifies the zero-knowledge proof
     *      6. Updates the user's encrypted balance
     *
     * Requirements:
     * - Caller must be the contract owner
     * - Auditor must be set
     * - Contract must be in standalone mode
     * - User must be registered
     * - Proof must be valid
     */
    function privateMint(
        address user,
        MintProof calldata proof
    )
        external
        onlyOwner
        onlyIfAuditorSet
        onlyForStandalone
        onlyIfUserRegistered(user)
    {
        uint256[24] memory publicInputs = proof.publicSignals;

        // Validate chain ID
        if (block.chainid != publicInputs[0]) {
            revert InvalidChainId();
        }

        // validate public keys
        _validatePublicKey(user, [publicInputs[2], publicInputs[3]]);
        _validateAuditorPublicKey([publicInputs[15], publicInputs[16]]);

        // Validate and check mint nullifier
        uint256 mintNullifier = publicInputs[1];
        if (mintNullifier >= BabyJubJub.Q) {
            revert InvalidNullifier();
        }
        if (alreadyMinted[mintNullifier]) {
            revert InvalidProof();
        }

        // Verify the zero-knowledge proof
        bool isVerified = mintVerifier.verifyProof(
            proof.proofPoints.a,
            proof.proofPoints.b,
            proof.proofPoints.c,
            proof.publicSignals
        );
        if (!isVerified) {
            revert InvalidProof();
        }

        {
            // Extract the encrypted amount from the proof
            EGCT memory encryptedAmount = EGCT({
                c1: Point({x: publicInputs[4], y: publicInputs[5]}),
                c2: Point({x: publicInputs[6], y: publicInputs[7]})
            });

            // Extract amount PCT
            uint256[7] memory amountPCT;
            for (uint256 i = 0; i < 7; i++) {
                amountPCT[i] = publicInputs[8 + i];
            }

            // Perform the private mint operation
            _privateMint(user, encryptedAmount, amountPCT);
        }

        // mark the mint nullifier as used
        alreadyMinted[mintNullifier] = true;

        uint256[7] memory auditorPCT;
        for (uint256 i = 0; i < auditorPCT.length; i++) {
            auditorPCT[i] = publicInputs[17 + i];
        }

        emit PrivateMint(user, auditorPCT, auditor);
    }

    /**
     * @notice Performs a private burn operation
     * @param proof The transfer proof proving the validity of the burn operation
     * @param balancePCT The balance PCT for the sender after the burn
     * @dev This function:
     *      1. Validates the sender is registered
     *      2. Verifies the sender's public key matches the proof
     *      3. Verifies the burn address's public key matches the proof
     *      4. Verifies the auditor's public key matches the proof
     *      5. Verifies the zero-knowledge proof
     *      6. Transfers the encrypted amount to the burn address
     *
     * Requirements:
     * - Auditor must be set
     * - Contract must be in standalone mode
     * - Sender must be registered
     * - Proof must be valid
     */
    function privateBurn(
        BurnProof calldata proof,
        uint256[7] calldata balancePCT
    )
        external
        onlyIfAuditorSet
        onlyForStandalone
        onlyIfUserRegistered(msg.sender)
    {
        uint256[19] calldata publicInputs = proof.publicSignals;
        address from = msg.sender;

        // validate public key
        _validatePublicKey(from, [publicInputs[0], publicInputs[1]]);

        // validate auditor public key
        _validateAuditorPublicKey([publicInputs[10], publicInputs[11]]);

        // Verify the zero-knowledge proof
        bool isVerified = burnVerifier.verifyProof(
            proof.proofPoints.a,
            proof.proofPoints.b,
            proof.proofPoints.c,
            proof.publicSignals
        );
        if (!isVerified) {
            revert InvalidProof();
        }

        // provided encrypted balance
        EGCT memory providedBalance = EGCT({
            c1: Point({x: publicInputs[2], y: publicInputs[3]}),
            c2: Point({x: publicInputs[4], y: publicInputs[5]})
        });

        // extract encrypted burn amount
        EGCT memory encryptedBurnAmount = EGCT({
            c1: Point({x: publicInputs[6], y: publicInputs[7]}),
            c2: Point({x: publicInputs[8], y: publicInputs[9]})
        });

        // perform the burn (since burn is only for Standalone, always passing tokenId as 0)
        _privateBurn(from, 0, providedBalance, encryptedBurnAmount, balancePCT);

        // extract auditor PCT
        uint256[7] memory auditorPCT;
        for (uint256 i = 0; i < auditorPCT.length; i++) {
            auditorPCT[i] = publicInputs[12 + i];
        }

        emit PrivateBurn(from, auditorPCT, auditor);
    }

    /**
     * @notice Performs a private transfer between two users
     * @param to Address of the receiver
     * @param tokenId ID of the token to transfer
     * @param proof The transfer proof proving the validity of the transfer
     * @param balancePCT The balance PCT for the sender after the transfer
     * @dev This function:
     *      1. Validates both sender and receiver are registered
     *      2. Verifies both public keys match the proof
     *      3. Verifies the auditor's public key matches the proof
     *      4. Verifies the zero-knowledge proof
     *      5. Updates both users' encrypted balances
     *
     * Requirements:
     * - Auditor must be set
     * - Both sender and receiver must be registered
     * - Proof must be valid
     */
    function transfer(
        address to,
        uint256 tokenId,
        TransferProof memory proof,
        uint256[7] calldata balancePCT
    )
        public
        onlyIfAuditorSet
        onlyIfUserRegistered(msg.sender)
        onlyIfUserRegistered(to)
    {
        uint256[32] memory publicInputs = proof.publicSignals;

        // validate user's public key
        _validatePublicKey(msg.sender, [publicInputs[0], publicInputs[1]]);
        _validatePublicKey(to, [publicInputs[10], publicInputs[11]]);

        _validateAuditorPublicKey([publicInputs[23], publicInputs[24]]);

        // Verify the zero-knowledge proof
        bool isVerified = transferVerifier.verifyProof(
            proof.proofPoints.a,
            proof.proofPoints.b,
            proof.proofPoints.c,
            proof.publicSignals
        );
        if (!isVerified) {
            revert InvalidProof();
        }

        // Extract the inputs for the transfer operation
        TransferInputs memory transferInputs = _extractTransferInputs(
            publicInputs
        );

        // Perform the transfer
        _transfer({
            from: msg.sender,
            to: to,
            tokenId: tokenId,
            providedBalance: transferInputs.providedBalance,
            senderEncryptedAmount: transferInputs.senderEncryptedAmount,
            receiverEncryptedAmount: transferInputs.receiverEncryptedAmount,
            balancePCT: balancePCT,
            amountPCT: transferInputs.amountPCT
        });

        // Extract auditor PCT and emit event
        {
            uint256[7] memory auditorPCT;
            for (uint256 i = 0; i < 7; i++) {
                auditorPCT[i] = publicInputs[25 + i];
            }

            emit PrivateTransfer(msg.sender, to, auditorPCT, auditor);
        }
    }

    /**
     * @notice Deposits an existing ERC20 token into the contract
     * @param amount Amount of tokens to deposit
     * @param tokenAddress Address of the token to deposit
     * @param amountPCT Amount PCT for the deposit
     * @dev This function:
     *      1. Validates the user is registered
     *      2. Transfers the tokens from the user to the contract
     *      3. Converts the tokens to encrypted tokens
     *      4. Adds the encrypted amount to the user's balance
     *      5. Returns any dust (remainder) to the user
     *
     * Requirements:
     * - Auditor must be set
     * - Contract must be in converter mode
     * - Token must not be blacklisted
     * - User must be registered
     */
    function deposit(
        uint256 amount,
        address tokenAddress,
        uint256[7] memory amountPCT
    )
        public
        onlyIfAuditorSet
        onlyForConverter
        revertIfBlacklisted(tokenAddress)
        onlyIfUserRegistered(msg.sender)
    {
        IERC20 token = IERC20(tokenAddress);
        uint256 dust;
        uint256 tokenId;
        address to = msg.sender;

        // Get the contract's balance before the transfer
        uint256 balanceBefore = token.balanceOf(address(this));

        // Transfer tokens from user to contract
        SafeERC20.safeTransferFrom(token, to, address(this), amount);

        // Get the contract's balance after the transfer
        uint256 balanceAfter = token.balanceOf(address(this));

        // Verify that the actual transferred amount matches the expected amount
        uint256 actualTransferred = balanceAfter - balanceBefore;
        if (actualTransferred != amount) {
            revert TransferFailed();
        }

        // Convert tokens to encrypted tokens
        (dust, tokenId) = _convertFrom(to, amount, tokenAddress, amountPCT);

        // Return dust to user, if any
        if (dust > 0) {
            SafeERC20.safeTransfer(token, to, dust);
        }

        // Emit deposit event
        emit Deposit(to, amount, dust, tokenId);
    }

    /**
     * @notice Withdraws encrypted tokens as regular ERC20 tokens
     * @param tokenId ID of the token to withdraw
     * @param proof The withdraw proof proving the validity of the withdrawal
     * @param balancePCT The balance PCT for the user after the withdrawal
     * @dev This function:
     *      1. Validates the user is registered
     *      2. Verifies the user's public key matches the proof
     *      3. Verifies the auditor's public key matches the proof
     *      4. Verifies the zero-knowledge proof
     *      5. Subtracts the encrypted amount from the user's balance
     *      6. Converts the tokens to regular ERC20 tokens
     *
     * Requirements:
     * - Auditor must be set
     * - Contract must be in converter mode
     * - User must be registered
     * - Proof must be valid
     */
    function withdraw(
        uint256 tokenId,
        WithdrawProof memory proof,
        uint256[7] memory balancePCT
    )
        public
        onlyIfAuditorSet
        onlyForConverter
        onlyIfUserRegistered(msg.sender)
    {
        address from = msg.sender;
        uint256[16] memory publicInputs = proof.publicSignals;
        uint256 amount = publicInputs[0];

        // validate public keys
        _validatePublicKey(from, [publicInputs[1], publicInputs[2]]);
        _validateAuditorPublicKey([publicInputs[7], publicInputs[8]]);

        // Verify the zero-knowledge proof
        bool isVerified = withdrawVerifier.verifyProof(
            proof.proofPoints.a,
            proof.proofPoints.b,
            proof.proofPoints.c,
            proof.publicSignals
        );
        if (!isVerified) {
            revert InvalidProof();
        }

        // Perform the withdrawal
        _withdraw(from, amount, tokenId, publicInputs, balancePCT);

        // Extract auditor PCT and emit event
        {
            uint256[7] memory auditorPCT;
            for (uint256 i = 0; i < 7; i++) {
                auditorPCT[i] = publicInputs[9 + i];
            }

            emit Withdraw(from, amount, tokenId, auditorPCT, auditor);
        }
    }

    /**
     * @notice Gets the encrypted balance for a token address
     * @param user Address of the user
     * @param tokenAddress Address of the token
     * @return eGCT The ElGamal ciphertext representing the encrypted balance
     * @return nonce The current nonce used for balance validation
     * @return amountPCTs Array of amount PCTs for transaction history
     * @return balancePCT The current balance PCT
     * @return transactionIndex The current transaction index
     * @dev This is a convenience function that looks up the token ID and calls balanceOf
     */
    function getBalanceFromTokenAddress(
        address user,
        address tokenAddress
    )
        public
        view
        returns (
            EGCT memory eGCT,
            uint256 nonce,
            AmountPCT[] memory amountPCTs,
            uint256[7] memory balancePCT,
            uint256 transactionIndex
        )
    {
        uint256 tokenId = tokenIds[tokenAddress];
        return balanceOf(user, tokenId);
    }

    ///////////////////////////////////////////////////
    ///                   Internal                  ///
    ///////////////////////////////////////////////////

    /**
     * @notice Performs the internal logic for a private withdrawal
     * @param from Address of the user withdrawing tokens
     * @param amount Amount of tokens to withdraw
     * @param tokenId ID of the token to withdraw
     * @param publicInputs Public inputs from the proof
     * @param balancePCT The balance PCT for the user after the withdrawal
     * @dev This function:
     *      1. Validates the token exists
     *      2. Verifies the provided balance is valid
     *      3. Subtracts the encrypted amount from the user's balance
     *      4. Converts the tokens to regular ERC20 tokens
     */
    function _withdraw(
        address from,
        uint256 amount,
        uint256 tokenId,
        uint256[16] memory publicInputs,
        uint256[7] memory balancePCT
    ) internal {
        address tokenAddress = tokenAddresses[tokenId];
        if (tokenAddress == address(0)) {
            revert UnknownToken();
        }

        {
            // Extract the provided balance from the proof
            EGCT memory providedBalance = EGCT({
                c1: Point({x: publicInputs[3], y: publicInputs[4]}),
                c2: Point({x: publicInputs[5], y: publicInputs[6]})
            });

            // Encrypt the withdrawn amount
            EGCT memory encryptedWithdrawnAmount = BabyJubJub.encrypt(
                Point({x: publicInputs[1], y: publicInputs[2]}),
                amount
            );

            _privateBurn(
                from,
                tokenId,
                providedBalance,
                encryptedWithdrawnAmount,
                balancePCT
            );
        }

        // Convert and transfer the tokens
        _convertTo(from, amount, tokenAddress);
    }

    /**
     * @notice Converts regular ERC20 tokens to encrypted tokens
     * @param to Address of the receiver
     * @param amount Amount of tokens to convert
     * @param tokenAddress Address of the token to convert
     * @param amountPCT Amount PCT for the conversion
     * @return dust The dust (remainder) from the conversion
     * @return tokenId The ID of the token
     * @dev This function:
     *      1. Handles decimal scaling between tokens
     *      2. Registers the token if it's new
     *      3. Encrypts the amount with the receiver's public key
     *      4. Adds the encrypted amount to the receiver's balance
     */
    function _convertFrom(
        address to,
        uint256 amount,
        address tokenAddress,
        uint256[7] memory amountPCT
    ) internal returns (uint256 dust, uint256 tokenId) {
        // Get token decimals and handle scaling
        uint8 tokenDecimals = IERC20Metadata(tokenAddress).decimals();

        uint256 value = amount;
        dust = 0;

        // Scale down if token has more decimals
        if (tokenDecimals > decimals) {
            uint256 scalingFactor = 10 ** (tokenDecimals - decimals);
            value = amount / scalingFactor;
            dust = amount % scalingFactor;
        }
        // Scale up if token has fewer decimals
        else if (tokenDecimals < decimals) {
            uint256 scalingFactor = 10 ** (decimals - tokenDecimals);
            value = amount * scalingFactor;
            dust = 0;
        }

        // Register the token if it's new
        if (tokenIds[tokenAddress] == 0) {
            _addToken(tokenAddress);
        }
        tokenId = tokenIds[tokenAddress];

        // Return early if the scaled value is zero
        if (value == 0) {
            return (dust, tokenId);
        }

        // Encrypt and add to balance
        {
            // Get the receiver's public key
            uint256[2] memory publicKey = registrar.getUserPublicKey(to);

            // Encrypt the value with the receiver's public key
            EGCT memory eGCT = BabyJubJub.encrypt(
                Point({x: publicKey[0], y: publicKey[1]}),
                value
            );

            // Add to the receiver's balance
            EncryptedBalance storage balance = balances[to][tokenId];

            if (balance.eGCT.c1.x == 0 && balance.eGCT.c1.y == 0) {
                balance.eGCT = eGCT;
            } else {
                balance.eGCT.c1 = BabyJubJub._add(balance.eGCT.c1, eGCT.c1);
                balance.eGCT.c2 = BabyJubJub._add(balance.eGCT.c2, eGCT.c2);
            }

            // Update transaction history
            balance.amountPCTs.push(
                AmountPCT({pct: amountPCT, index: balance.transactionIndex})
            );
            balance.transactionIndex++;

            // Commit the new balance
            _commitUserBalance(to, tokenId);
        }

        return (dust, tokenId);
    }

    /**
     * @notice Converts encrypted tokens to regular ERC20 tokens
     * @param to Address of the receiver
     * @param amount Amount of tokens to convert
     * @param tokenAddress Address of the token to convert to
     * @dev This function:
     *      1. Handles decimal scaling between tokens
     *      2. Transfers the tokens to the receiver
     */
    function _convertTo(
        address to,
        uint256 amount,
        address tokenAddress
    ) internal {
        // Get token decimals and handle scaling
        uint256 tokenDecimals = IERC20Metadata(tokenAddress).decimals();

        uint256 value = amount;
        uint256 scalingFactor = 0;

        // Scale up if token has more decimals
        if (tokenDecimals > decimals) {
            scalingFactor = 10 ** (tokenDecimals - decimals);
            value = amount * scalingFactor;
        }
        // Scale down if token has fewer decimals
        else if (tokenDecimals < decimals) {
            scalingFactor = 10 ** (decimals - tokenDecimals);
            value = amount / scalingFactor;
        }

        // Transfer the tokens to the receiver
        IERC20 token = IERC20(tokenAddress);
        SafeERC20.safeTransfer(token, to, value);
    }

    /**
     * @notice Performs the internal logic for a private mint
     * @param user Address of the user to mint tokens to
     * @param encryptedAmount The encrypted amount to mint
     * @param amountPCT The amount PCT for the mint
     * @dev This function:
     *      1. Adds the encrypted amount to the user's balance
     *      2. Emits a PrivateMint event
     */
    function _privateMint(
        address user,
        EGCT memory encryptedAmount,
        uint256[7] memory amountPCT
    ) internal {
        // since private mint is only for the standalone ERC, tokenId is always 0
        _addToUserBalance(user, 0, encryptedAmount, amountPCT);
    }

    /**
     * @notice Performs the internal logic for a private transfer
     * @param from address The address of the sender
     * @param to address The address of the receiver
     * @param tokenId uint256 The ID of the token to transfer
     * @param providedBalance EGCT The provided balance from the proof
     * @param senderEncryptedAmount EGCT The encrypted amount to subtract from the sender's balance
     * @param receiverEncryptedAmount EGCT The encrypted amount to add to the receiver's balance
     * @param balancePCT uint256[7] The balance PCT for the sender after the transfer
     * @param amountPCT uint256[7] The amount PCT for the transfer
     * @dev This function:
     *      1. Verifies the sender's balance is valid
     *      2. Subtracts the encrypted amount from the sender's balance
     *      3. Adds the encrypted amount to the receiver's balance
     */
    function _transfer(
        address from,
        address to,
        uint256 tokenId,
        EGCT memory providedBalance,
        EGCT memory senderEncryptedAmount,
        EGCT memory receiverEncryptedAmount,
        uint256[7] memory balancePCT,
        uint256[7] memory amountPCT
    ) internal {
        {
            // 1. for sender operation is very similar to the private burn
            _privateBurn(
                from,
                tokenId,
                providedBalance,
                senderEncryptedAmount,
                balancePCT
            );
        }

        {
            // 2. for receiver operation is very similar to the private mint
            _addToUserBalance(to, tokenId, receiverEncryptedAmount, amountPCT);
        }
    }

    /**
     * @notice Performs the internal logic for a private burn
     * @param from Address of the user to burn tokens from
     * @param tokenId ID of the token to burn
     * @param providedBalance The provided balance from the proof
     * @param encryptedAmount The encrypted amount to subtract
     * @param balancePCT The balance PCT for the user after the burn
     * @dev This function:
     *      1. Verifies the user's balance is valid
     *      2. Subtracts the encrypted amount from the user's balance
     */
    function _privateBurn(
        address from,
        uint256 tokenId,
        EGCT memory providedBalance,
        EGCT memory encryptedAmount,
        uint256[7] memory balancePCT
    ) internal {
        // verify user encrypted balance
        uint256 transactionIndex = _verifyUserBalance(
            from,
            tokenId,
            providedBalance
        );

        // subtract from user's balance
        _subtractFromUserBalance(
            from,
            tokenId,
            encryptedAmount,
            balancePCT,
            transactionIndex
        );
    }

    /**
     * @notice Validates a user's public key
     * @param user The address of the user
     * @param providedPublicKey The public key to validate
     * @dev Function fetches the user's public key from the registrar contract
     * @dev If the public key is not valid, it reverts with InvalidProof error
     */
    function _validatePublicKey(
        address user,
        uint256[2] memory providedPublicKey
    ) internal view {
        uint256[2] memory userPublicKey = registrar.getUserPublicKey(user);

        if (
            userPublicKey[0] != providedPublicKey[0] ||
            userPublicKey[1] != providedPublicKey[1]
        ) {
            revert InvalidProof();
        }
    }

    /**
     * @notice Validates the auditor's public key
     * @param providedPublicKey The public key to validate
     * @dev If the public key is not match with the auditor's public key, it reverts with InvalidProof error
     */
    function _validateAuditorPublicKey(
        uint256[2] memory providedPublicKey
    ) internal view {
        if (
            auditorPublicKey.x != providedPublicKey[0] ||
            auditorPublicKey.y != providedPublicKey[1]
        ) {
            revert InvalidProof();
        }
    }

    /**
     * @notice Extracts the inputs for a transfer operation
     * @param input The input array containing the transfer data
     * @return transferInputs TransferInputs struct containing:
     *         - providedBalance (EGCT): The provided balance from the proof
     *         - senderEncryptedAmount (EGCT): The encrypted amount to subtract from sender
     *         - receiverEncryptedAmount (EGCT): The encrypted amount to add to receiver
     *         - amountPCT (uint256[7]): The amount PCT for the transfer
     */
    function _extractTransferInputs(
        uint256[32] memory input
    ) internal pure returns (TransferInputs memory transferInputs) {
        transferInputs.providedBalance = EGCT({
            c1: Point({x: input[2], y: input[3]}),
            c2: Point({x: input[4], y: input[5]})
        });

        transferInputs.senderEncryptedAmount = EGCT({
            c1: Point({x: input[6], y: input[7]}),
            c2: Point({x: input[8], y: input[9]})
        });

        transferInputs.receiverEncryptedAmount = EGCT({
            c1: Point({x: input[12], y: input[13]}),
            c2: Point({x: input[14], y: input[15]})
        });

        for (uint256 i = 0; i < 7; i++) {
            transferInputs.amountPCT[i] = input[16 + i];
        }
    }
}
