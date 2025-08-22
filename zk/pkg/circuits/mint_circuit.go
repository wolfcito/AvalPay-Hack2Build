package circuits

import (
	"github.com/ava-labs/EncryptedERC/pkg/babyjub"
	tedwards "github.com/consensys/gnark-crypto/ecc/twistededwards"
	"github.com/consensys/gnark/frontend"
)

type MintCircuit struct {
	Receiver      Receiver
	Auditor       Auditor
	MintNullifier MintNullifier
	ValueToMint   frontend.Variable
}

func (circuit *MintCircuit) Define(api frontend.API) error {
	// Initialize babyjub wrapper
	babyjub := babyjub.NewBjWrapper(api, tedwards.BN254)

	// Verify receiver's encrypted value is the mint amount
	CheckValue(api, babyjub, circuit.Receiver, circuit.ValueToMint)

	// Verify nullifier hash is not used
	CheckNullifierHash(api, circuit.Auditor, circuit.MintNullifier)

	// Verify receiver's encrypted summary includes the mint amount and is encrypted with the receiver's public key
	CheckPCTReceiver(api, babyjub, circuit.Receiver, circuit.ValueToMint)

	// Verify auditor's encrypted summary includes the mint amount and is encrypted with the auditor's public key
	CheckPCTAuditor(api, babyjub, circuit.Auditor, circuit.ValueToMint)

	return nil
}
