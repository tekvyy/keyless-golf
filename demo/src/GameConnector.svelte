<script lang="ts">
    import { account, server } from "./lib/common";
    import { onMount } from "svelte";
    import base64url from "base64url";

    let isConnected = false;
    let walletAddress = "";
    
    onMount(async () => {
        checkConnection();
    });
    
    async function checkConnection() {
        if (localStorage.hasOwnProperty("sp:keyId")) {
            const keyId = localStorage.getItem("sp:keyId")!;
            try {
                const { contractId } = await account.connectWallet({
                    keyId: keyId,
                    getContractId: (keyId) => server.getContractId({ keyId }),
                });
                
                isConnected = true;
                walletAddress = contractId;
            } catch (err) {
                console.error("Failed to connect to wallet:", err);
                isConnected = false;
            }
        } else {
            isConnected = false;
        }
    }
    
    async function register() {
        const user = prompt("Give this passkey a name");
        if (!user) return;
        
        try {
            const { keyId, contractId, signedTx } = await account.createWallet("Passkey Golf", user);
            await server.send(signedTx);
            
            localStorage.setItem("sp:keyId", base64url(keyId));
            isConnected = true;
            walletAddress = contractId;
        } catch (err: any) {
            console.error(err);
            alert(err.message);
        }
    }
    
    async function connect() {
        try {
            const { keyId, contractId } = await account.connectWallet({
                getContractId: (keyId) => server.getContractId({ keyId }),
            });
            
            localStorage.setItem("sp:keyId", base64url(keyId));
            isConnected = true;
            walletAddress = contractId;
        } catch (err: any) {
            console.error(err);
            alert("Failed to connect: " + err.message);
        }
    }
    
    function goToDemoApp() {
        window.location.href = "/";
    }
</script>

<div class="connector">
    <h2>Passkey Wallet Status</h2>
    
    {#if isConnected}
        <div class="connected">
            <p>✅ Connected to wallet</p>
            <p class="address">Address: {walletAddress}</p>
        </div>
    {:else}
        <div class="not-connected">
            <p>❌ Not connected to a passkey wallet</p>
            <div class="buttons">
                <button on:click={register}>Register New Wallet</button>
                <button on:click={connect}>Connect Existing Wallet</button>
            </div>
        </div>
    {/if}
    
    <button class="demo-button" on:click={goToDemoApp}>Return to Demo App</button>
</div>

<style>
    .connector {
        background-color: #f5f5f5;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin: 20px auto;
        max-width: 500px;
        text-align: center;
    }
    
    .connected {
        background-color: #d4edda;
        padding: 15px;
        border-radius: 5px;
        margin-bottom: 15px;
    }
    
    .not-connected {
        background-color: #f8d7da;
        padding: 15px;
        border-radius: 5px;
        margin-bottom: 15px;
    }
    
    .address {
        font-family: monospace;
        word-break: break-all;
        background-color: rgba(255, 255, 255, 0.5);
        padding: 5px;
        border-radius: 3px;
    }
    
    .buttons {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 15px;
    }
    
    button {
        padding: 10px 15px;
        border: none;
        border-radius: 4px;
        background-color: #4CAF50;
        color: white;
        cursor: pointer;
        font-weight: bold;
    }
    
    button:hover {
        background-color: #45a049;
    }
    
    .demo-button {
        margin-top: 20px;
        background-color: #3498db;
    }
    
    .demo-button:hover {
        background-color: #2980b9;
    }
</style>