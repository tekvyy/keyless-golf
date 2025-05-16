<script lang="ts">
	import base64url from "base64url";
	import { Buffer } from "buffer";
	import {
		account,
		fundPubkey,
		fundSigner,
		native,
		server,
	} from "./lib/common";
	import { Keypair } from "@stellar/stellar-sdk/minimal";
    import { SignerStore, SignerKey, type SignerLimits, type Signer } from "passkey-kit";
    import Game from "./Game.svelte";
    import AuthPage from "./AuthPage.svelte";

	// TODO need to support two toggles:
	// - between temp and persistent
	// - and admin, basic and policy
	// - full visual support for admin, basic and policy keys

	const ADMIN_KEY = "AAAAEAAAAAEAAAABAAAAAQ=="; // TODO very rough until we're actually parsing the limits object
	const NATIVE_SAC =
		"CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
	const SAMPLE_POLICY =
		"CBJQC7FVOAJTBMOOSRUTAED3JVHGNHPKSKPXSREOWFHL7O6LW2ATQZAU";
	const SECRET = "SBEIDWQVWNLPCP35EYQ6GLWKFQ2MDY7APRLOQ3AJNU6KSE7FXGA7C55W";
	const PUBLIC = "GBVQMKYWGELU6IKLK2U6EIIHTNW5LIUYJE7FUQPG4FAB3QQ3KAINFVYS";

	let keyId: string;
	let contractId: string;
	let adminSigner: string | undefined;
	let balance: string;
	let signers: Signer[] = [];

	let keyName: string = "";
    let showGame = false;
    let showAuth = true;  // Show auth page by default

	// Try to auto-connect when the component is loaded
	(async () => {
		if (localStorage.hasOwnProperty("sp:keyId")) {
			keyId = localStorage.getItem("sp:keyId")!;
			try {
				await connect(keyId);
			} catch (error) {
				console.error("Auto-connect failed:", error);
				// If auto-connect fails, show auth page
				showAuth = true;
			}
		}
	})();

	async function register() {
		const user = prompt("Give this passkey a name");

		if (!user) return;

		try {
			const {
				keyId: kid,
				contractId: cid,
				signedTx,
			} = await account.createWallet("Super Peach", user);
			
			const res = await server.send(signedTx);

			console.log(res);

			keyId = base64url(kid);
			localStorage.setItem("sp:keyId", keyId);

			contractId = cid;
			console.log("register", cid);

			await getWalletSigners();
			await fundWallet();
		} catch (err: any) {
			console.error(err);
			alert(err.message);
		}
	}
	async function connect(keyId_?: string) {
		try {
			const { keyId: kid, contractId: cid } = await account.connectWallet(
				{
					keyId: keyId_,
					getContractId: (keyId) => server.getContractId({ keyId }),
				},
			);

			keyId = base64url(kid);
			localStorage.setItem("sp:keyId", keyId);

			contractId = cid;
			console.log("connect", cid);

			await getWalletBalance();
			await getWalletSigners();
			
			showAuth = false;  // Hide auth page after successful connection
			return true; // Connection successful
		} catch (err: any) {
			console.error("Connection error:", err);
			// Re-throw the error so caller can handle it
			throw err;
		}
	}
	async function reset() {
		localStorage.removeItem("sp:keyId");
		location.reload();
	}
	
	async function handleRegister(cid?: string) {
		// Set contract ID if received from AuthPage
		if (cid) {
			contractId = cid;
			// Get wallet balance and signers
			await getWalletBalance();
			await getWalletSigners();
		}
		// Otherwise try to connect using localStorage
		else if (localStorage.hasOwnProperty("sp:keyId")) {
			keyId = localStorage.getItem("sp:keyId")!;
			await connect(keyId);
		}
		showAuth = false;  // Hide auth page
	}
	
	async function handleSignIn(cid?: string) {
		// Set contract ID if received from AuthPage
		if (cid) {
			contractId = cid;
			// Get wallet balance and signers
			await getWalletBalance();
			await getWalletSigners();
		}
		// Otherwise try to connect using localStorage
		else if (localStorage.hasOwnProperty("sp:keyId")) {
			keyId = localStorage.getItem("sp:keyId")!;
			await connect(keyId);
		}
		showAuth = false;  // Hide auth page
	}
	
	function handleReset() {
		// The reset function will handle the actual reset
		localStorage.removeItem("sp:keyId");
		location.reload();
	}

	async function addSigner(publicKey?: string) {
		try {
			let id: Buffer;
			let pk: Buffer;

			if (publicKey && keyId) {
				id = base64url.toBuffer(keyId);
				pk = base64url.toBuffer(publicKey);
				// keyAdmin = false;
			} else {
				if (!keyName) return;

				const { keyId: kid, publicKey } = await account.createKey(
					"Super Peach",
					keyName,
				);

				id = kid;
				pk = publicKey;
			}

			const { sequence } = await account.rpc.getLatestLedger()
			const at = await account.addSecp256r1(id, pk, undefined, SignerStore.Temporary, sequence + 518_400);

			await account.sign(at, { keyId: adminSigner });
			const res = await server.send(at.built!);

			console.log(res);

			await getWalletSigners();

			keyName = "";
			// keyAdmin = false;
		} catch (err: any) {
			console.error(err);
			alert(err.message);
		}
	}
	async function addEd25519Signer() {
		const pubkey = PUBLIC; // prompt('Enter public key');

		if (pubkey) {
			const signer_limits = undefined;

			// const signer_limits: SignerLimits = new Map();
			// const signer_keys: SignerKey[] = [];

			// signer_keys.push(SignerKey.Policy(SAMPLE_POLICY));

			// signer_limits.set(NATIVE_SAC, signer_keys);

			const at = await account.addEd25519(pubkey, signer_limits, SignerStore.Temporary);

			await account.sign(at, { keyId: adminSigner });
			const res = await server.send(at.built!);

			console.log(res);

			await getWalletSigners();
		}
	}
	async function addPolicySigner() {
		const signer_limits: SignerLimits = new Map();
		const signer_keys: SignerKey[] = [];

		signer_keys.push(SignerKey.Ed25519(PUBLIC));

		signer_limits.set(NATIVE_SAC, signer_keys);

		const at = await account.addPolicy(SAMPLE_POLICY, signer_limits, SignerStore.Temporary);

		await account.sign(at, { keyId: adminSigner });
		const res = await server.send(at.built!);

		console.log(res);

		await getWalletSigners();
	}
	async function removeSigner(signer: string, type: string) {
		try {
			let key: SignerKey;

			switch (type) {
				case "Policy":
					key = SignerKey.Policy(signer);
					break;
				case "Ed25519":
					key = SignerKey.Ed25519(signer);
					break;
				case "Secp256r1":
					key = SignerKey.Secp256r1(signer);
					break;
				default:
					throw new Error("Invalid signer type");
			}

			const at = await account.remove(key);

			await account.sign(at, { keyId: adminSigner });
			const res = await server.send(at.built!);

			console.log(res);

			await getWalletSigners();
		} catch (err: any) {
			console.error(err);
			alert(err.message);
		}
	}
	async function fundWallet() {
		const { built, ...transfer } = await native.transfer({
			to: contractId,
			from: fundPubkey,
			amount: BigInt(100 * 10_000_000),
		});

		await transfer.signAuthEntries({
			address: fundPubkey,
			signAuthEntry: fundSigner.signAuthEntry,
		});

		const res = await server.send(built!);

		console.log(res);

		await getWalletBalance();
	}

	////
	async function multisigTransfer() {
		const keypair = Keypair.fromSecret(SECRET);

		const at = await native.transfer({
			to: fundPubkey,
			from: contractId,
			amount: BigInt(10_000_000),
		});

		await account.sign(at, { keyId: adminSigner });
		await account.sign(at, { keypair });
		await account.sign(at, { policy: SAMPLE_POLICY });

		console.log(at.built!.toXDR());

		const res = await server.send(at);

		console.log(res);

		await getWalletBalance();
	}
	////

	async function ed25519Transfer() {
		const secret = SECRET; // prompt('Enter secret key');

		if (secret) {
			const keypair = Keypair.fromSecret(secret);
			const at = await native.transfer({
				to: fundPubkey,
				from: contractId,
				amount: BigInt(10_000_000),
			});

			await account.sign(at, { keypair });

			// NOTE won't work if the ed25519 signer has a policy signer_key restriction
			// If you want this to work you need to remove the policy restriction from the ed25519 signer first
			// (though that will make the policy transfer less interesting)
			const res = await server.send(at.built!);

			console.log(res);

			await getWalletBalance();
		}
	}

	////
	async function policyTransfer() {
		const keypair = Keypair.fromSecret(SECRET);

		let at = await native.transfer({
			to: fundPubkey,
			from: contractId,
			amount: BigInt(10_000_000),
		});

		await account.sign(at, { keypair });
		await account.sign(at, { policy: SAMPLE_POLICY });

		console.log(at.built!.toXDR());

		const res = await server.send(at.built!);

		console.log(res);

		await getWalletBalance();
	}
	////

	async function walletTransfer(signer: string, kind: string) {
		if (kind === "Policy") {
			return policyTransfer();
		} else if (kind === "Ed25519") {
			return ed25519Transfer();
		}

		const at = await native.transfer({
			to: fundPubkey,
			from: contractId,
			amount: BigInt(10_000_000),
		});

		await account.sign(at, { keyId: signer });
		const res = await server.send(at.built!);

		console.log(res);

		await getWalletBalance();
	}
	async function getWalletBalance() {
		const { result } = await native.balance({ id: contractId });

		balance = result.toString();
		console.log(balance);
	}
	async function getWalletSigners() {
		signers = await server.getSigners(contractId);
		console.log(signers);

		const adminKeys = signers.filter(({ limits }) => limits === ADMIN_KEY);

		adminSigner = (
			adminKeys.find(({ key }) => keyId === key) || adminKeys[0]
		).key;
	}
	
	function goToGame() {
		showGame = true;
	}
	
	function returnFromGame() {
	    showGame = false;
	}
</script>

{#if showAuth}
    <AuthPage 
        onRegister={handleRegister}
        onSignIn={handleSignIn}
        onReset={handleReset}
    />
{:else if showGame}
    <Game 
        walletConnected={!!contractId} 
        contractId={contractId || ""} 
        onReturn={returnFromGame} 
    />
{:else}
<main>
    <header class="game-header">
        <h1>Passkey Golf</h1>
        <button on:click={goToGame} class="play-button">Play Game!</button>
    </header>

	{#if contractId}
		<div class="wallet-info">
            <h2>Your Wallet</h2>
            <p class="wallet-id">ID: {contractId}</p>

            {#if balance}
                <p class="wallet-balance">Balance: {parseFloat((Number(balance) / 10_000_000).toFixed(7))} XLM</p>
            {/if}

            <div class="button-group">
                <button on:click={fundWallet} class="wallet-action">Add Funds</button>
                <button on:click={getWalletBalance} class="wallet-action">Get Balance</button>
            </div>
        </div>

        <div class="signers-section">
            <h2>Manage Signers</h2>
            <div class="button-group">
                <button on:click={addEd25519Signer} class="signer-action">Add Ed25519 Signer</button>
                <button on:click={ed25519Transfer} class="signer-action">Ed25519 Transfer</button>
                <button on:click={addPolicySigner} class="signer-action">Add Policy Signer</button>
                <button on:click={policyTransfer} class="signer-action">Policy Transfer</button>
                <button on:click={multisigTransfer} class="signer-action">Multisig Transfer</button>
            </div>

            <form on:submit|preventDefault class="add-signer-form">
                <input
                    type="text"
                    placeholder="Signer name"
                    bind:value={keyName}
                />
                <button on:click={() => addSigner()} class="add-btn">Add Signer</button>
            </form>
        </div>

        <div class="signers-list">
            <h3>Your Signers</h3>
            <ul>
                {#each signers as { kind, key, val, expiration, limits, evicted }}
                    <li>
                        <div class="signer-badge">
                            {#if adminSigner === key}
                                {#if keyId === key}◉{:else}◎{/if}&nbsp;
                            {:else if keyId === key}
                                ●&nbsp;
                            {/if}
                            {#if limits === ADMIN_KEY}
                                ADMIN
                            {:else}
                                SESSION
                            {/if}
                        </div>

                        <span class="signer-key">{key}</span>

                        <div class="signer-actions">
                            <button on:click={() => walletTransfer(key, kind)} class="transfer-btn">
                                Transfer 1 XLM
                            </button>
                            <button on:click={() => removeSigner(key, kind)} class="remove-btn">
                                Remove
                            </button>
                        </div>
                    </li>
                {/each}
            </ul>
        </div>
	{:else}
        <div class="no-wallet">
            <p>No wallet connected. Please register or sign in.</p>
            <div class="button-group">
                <button on:click={() => showAuth = true} class="auth-btn">Register/Sign In</button>
            </div>
        </div>
    {/if}
</main>
{/if}

<style>
    main {
        padding: 20px;
        max-width: 1000px;
        margin: 0 auto;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .game-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid #3498db;
    }
    
    .game-header h1 {
        margin: 0;
        color: #2c3e50;
        font-size: 2rem;
    }
    
    .play-button {
        background-color: #ff8c00;
        color: white;
        font-weight: bold;
        padding: 10px 20px;
        border: none;
        border-radius: 30px;
        cursor: pointer;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
    }
    
    .play-button:hover {
        background-color: #e67e00;
        transform: translateY(-2px);
    }
    
    .wallet-info, .signers-section, .signers-list, .no-wallet {
        margin-bottom: 30px;
        padding: 20px;
        background-color: #f9f9f9;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    
    .wallet-info h2, .signers-section h2, .signers-list h3 {
        margin-top: 0;
        color: #2c3e50;
    }
    
    .wallet-id, .wallet-balance {
        font-family: monospace;
        background-color: #f0f0f0;
        padding: 8px;
        border-radius: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .button-group {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 15px 0;
    }
    
    button {
        padding: 8px 12px;
        margin: 5px;
        border: none;
        border-radius: 4px;
        background-color: #3498db;
        color: white;
        cursor: pointer;
        font-weight: 500;
        transition: background-color 0.2s;
    }
    
    button:hover {
        background-color: #2980b9;
    }
    
    .wallet-action {
        background-color: #3498db;
    }
    
    .signer-action {
        background-color: #9b59b6;
    }
    
    .add-signer-form {
        display: flex;
        gap: 10px;
        margin-top: 15px;
    }
    
    input {
        padding: 8px;
        flex: 1;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: white;
        color: #333;
    }
    
    .add-btn {
        background-color: #2ecc71;
    }
    
    .signers-list ul {
        padding: 0;
        list-style-type: none;
    }
    
    .signers-list li {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
        padding: 10px;
        border: 1px solid #eee;
        border-radius: 4px;
        background-color: white;
    }
    
    .signer-badge {
        background-color: #95a5a6;
        color: white;
        padding: 5px 8px;
        border-radius: 4px;
        margin-right: 10px;
        font-size: 0.8rem;
        white-space: nowrap;
    }
    
    .signer-key {
        flex: 1;
        font-family: monospace;
        font-size: 0.9rem;
        overflow: hidden;
        text-overflow: ellipsis;
        padding: 0 10px;
    }
    
    .signer-actions {
        display: flex;
        gap: 5px;
    }
    
    .transfer-btn {
        background-color: #f39c12;
    }
    
    .remove-btn {
        background-color: #e74c3c;
    }
    
    .no-wallet {
        text-align: center;
        padding: 40px 20px;
    }
    
    .auth-btn {
        background-color: #3498db;
        font-size: 1rem;
        padding: 10px 20px;
    }
    
    p {
        color: #333;
    }
    
    @media (max-width: 768px) {
        .game-header {
            flex-direction: column;
            gap: 15px;
            align-items: flex-start;
        }
        
        .signers-list li {
            flex-direction: column;
            align-items: flex-start;
        }
        
        .signer-key {
            margin: 10px 0;
        }
        
        .signer-actions {
            width: 100%;
        }
    }
</style>