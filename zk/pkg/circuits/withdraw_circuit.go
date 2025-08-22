package circuits

import (
	"github.com/ava-labs/EncryptedERC/pkg/babyjub"
	tedwards "github.com/consensys/gnark-crypto/ecc/twistededwards"
	"github.com/consensys/gnark/frontend"
)

type WithdrawCircuit struct {
	Sender      WithdrawSender
	Auditor     Auditor
	ValueToBurn frontend.Variable `gnark:",public"`
}

func (circuit *WithdrawCircuit) Define(api frontend.API) error {
	// Initialize babyjub wrapper
	babyjub := babyjub.NewBjWrapper(api, tedwards.BN254)

	// Verify the transfer amount is less than or equal to the sender's balance
	api.AssertIsLessOrEqual(circuit.ValueToBurn, circuit.Sender.Balance)

	// Verify sender's public key is well-formed
	CheckPublicKey(api, babyjub, Sender{
		PrivateKey: circuit.Sender.PrivateKey,
		PublicKey:  circuit.Sender.PublicKey,
	})

	// Verify sender's encrypted balance is well-formed
	CheckBalance(api, babyjub, Sender{
		PrivateKey:  circuit.Sender.PrivateKey,
		PublicKey:   circuit.Sender.PublicKey,
		Balance:     circuit.Sender.Balance,
		BalanceEGCT: circuit.Sender.BalanceEGCT,
	})

	// Verify auditor's encrypted summary includes the burn amount and is encrypted with the auditor's public key
	CheckPCTAuditor(api, babyjub, circuit.Auditor, circuit.ValueToBurn)

	return nil
}
