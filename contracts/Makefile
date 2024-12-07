export STELLAR_NETWORK=testnet
export STELLAR_ACCOUNT=default
# export STELLAR_NETWORK=vc
# export STELLAR_ACCOUNT=live

export NATIVE_CONTRACT=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
# export NATIVE_CONTRACT=CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA

# TESTNET
export SMART_WALLET_WASM=68edf5f67d8b3ca36a5fe2b1842af19cfd1aeadef7725a996fdf22d3271376d3
# MAINNET
# export SMART_WALLET_WASM=0c0a264d4cc0b3e79b8533e2a2e1f0ed21501a5a3f9f2455d2f18c232940b865

build:
	rm -rf out/
	rm -rf smart-wallet/target/wasm32-unknown-unknown/

	stellar contract build
		
	@cd smart-wallet && soroban contract build --package smart-wallet --out-dir ../out
	soroban contract optimize --wasm ./out/smart_wallet.wasm

deploy:
	soroban contract install --wasm ./out/smart_wallet.optimized.wasm --source $(STELLAR_ACCOUNT)

bindings:
	soroban contract bindings typescript --id CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC --network $(STELLAR_NETWORK) --output-dir ./out/sac-sdk --overwrite
	soroban contract bindings typescript --id NIL --wasm ./target/wasm32-unknown-unknown/release/smart_wallet.wasm --network $(STELLAR_NETWORK) --output-dir ./out/passkey-kit-sdk --overwrite

fmt:
	@cd smart-wallet && cargo fmt --all

clean:
	rm -rf out/
	rm -rf smart-wallet/target/
	@cd smart-wallet && cargo clean