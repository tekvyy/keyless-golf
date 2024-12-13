export STELLAR_NETWORK=testnet
export STELLAR_ACCOUNT=default
# export STELLAR_NETWORK=vc
# export STELLAR_ACCOUNT=live

# TESTNET
export SMART_WALLET_WASM=96047ff2acea358b6515e8fed2e5fbcfdddffb0f8bdac7852d5e5b3920ebaf6f

build:
	rm -rf out/
	rm -rf smart-wallet/target/wasm32-unknown-unknown/

	stellar contract build
		
	@cd smart-wallet && soroban contract build --package smart-wallet --out-dir ../out
	soroban contract optimize --wasm ./out/smart_wallet.wasm

install:
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