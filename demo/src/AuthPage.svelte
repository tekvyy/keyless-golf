<script lang="ts">
    import { onMount } from 'svelte';
    import base64url from "base64url";
    import { account, server } from "./lib/common";

    // Updated callback types to allow passing contractId
    export let onRegister: (contractId?: string) => void = () => {};
    export let onSignIn: (contractId?: string) => void = () => {};
    export let onReset: () => void = () => {};

    let isLoading = false;
    let message = "";
    let showMessage = false;
    let messageType: 'success' | 'error' = 'success';

    let keyId: string;
    let contractId: string;

    onMount(() => {
        // Check if user already has a key in localStorage
        if (localStorage.hasOwnProperty("sp:keyId")) {
            keyId = localStorage.getItem("sp:keyId")!;
        }
    });

    async function register() {
        isLoading = true;
        showMessage = false;
        
        try {
            const user = prompt("Give this passkey a name");
            if (!user) {
                isLoading = false;
                return;
            }

            const {
                keyId: kid,
                contractId: cid,
                signedTx,
            } = await account.createWallet("Passkey Golf", user);
            
            const res = await server.send(signedTx);

            keyId = base64url(kid);
            localStorage.setItem("sp:keyId", keyId);

            contractId = cid;
            
            displayMessage("Successfully registered! Welcome to Passkey Golf!", "success");
            
            // Callback to parent component with contractId
            onRegister(contractId);
        } catch (err: any) {
            console.error(err);
            displayMessage(err.message || "Registration failed. Please try again.", "error");
        } finally {
            isLoading = false;
        }
    }

    async function signIn() {
        isLoading = true;
        showMessage = false;
        
        try {
            const { keyId: kid, contractId: cid } = await account.connectWallet({
                keyId,
                getContractId: (keyId) => server.getContractId({ keyId }),
            });

            keyId = base64url(kid);
            localStorage.setItem("sp:keyId", keyId);

            contractId = cid;
            
            displayMessage("Successfully signed in!", "success");
            
            // Callback to parent component with contractId
            onSignIn(contractId);
        } catch (err: any) {
            console.error(err);
            displayMessage(err.message || "Sign in failed. Please try again.", "error");
        } finally {
            isLoading = false;
        }
    }

    function reset() {
        localStorage.removeItem("sp:keyId");
        displayMessage("Account reset complete. You can now register a new account.", "success");
        onReset();
    }

    function displayMessage(msg: string, type: 'success' | 'error') {
        message = msg;
        messageType = type;
        showMessage = true;
        
        // Auto-hide message after 5 seconds
        setTimeout(() => {
            showMessage = false;
        }, 5000);
    }
</script>

<main class="auth-container">
    <div class="auth-card">
        <div class="game-logo">
            <h1>Passkey Golf</h1>
            <div class="golf-ball"></div>
            <div class="golf-club"></div>
        </div>
        
        <div class="button-container">
            <button 
                class="auth-button register-button" 
                on:click={register}
                disabled={isLoading}
            >
                {#if isLoading}Loading...{:else}Register{/if}
            </button>
            
            <button 
                class="auth-button signin-button" 
                on:click={signIn}
                disabled={isLoading}
            >
                {#if isLoading}Loading...{:else}Sign In{/if}
            </button>
            
            <button 
                class="auth-button reset-button" 
                on:click={reset}
                disabled={isLoading}
            >
                {#if isLoading}Loading...{:else}Reset{/if}
            </button>
        </div>
        
        {#if showMessage}
            <div class="message-container {messageType}">
                {message}
            </div>
        {/if}
        
        <div class="info-panel">
            <h3>Welcome to Passkey Golf!</h3>
            <p>A secure blockchain game powered by passkeys.</p>
            <ul>
                <li>Register to create a new passkey wallet</li>
                <li>Sign in with your existing passkey</li>
                <li>Earn XLM tokens for perfect shots!</li>
            </ul>
        </div>
    </div>
</main>

<style>
    .auth-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background-color: #a8e6cf;
        background-image: linear-gradient(to bottom, #a8e6cf, #8ed1fc);
    }
    
    .auth-card {
        width: 100%;
        max-width: 500px;
        padding: 30px;
        background-color: white;
        border-radius: 10px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        text-align: center;
    }
    
    .game-logo {
        position: relative;
        margin-bottom: 30px;
        height: 120px;
    }
    
    .game-logo h1 {
        margin: 0;
        color: #2c3e50;
        font-size: 2.5rem;
        text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.1);
    }
    
    .golf-ball {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        width: 20px;
        height: 20px;
        background-color: white;
        border: 1px solid #ccc;
        border-radius: 50%;
        box-shadow: inset -3px -3px 8px rgba(0, 0, 0, 0.2);
    }
    
    .golf-club {
        position: absolute;
        bottom: 30px;
        left: 55%;
        width: 8px;
        height: 60px;
        background-color: #8B4513;
        transform: rotate(-45deg);
        transform-origin: bottom center;
    }
    
    .golf-club:before {
        content: '';
        position: absolute;
        bottom: -2px;
        left: -10px;
        width: 25px;
        height: 12px;
        background-color: #666;
        border-radius: 4px;
    }
    
    .button-container {
        display: flex;
        flex-direction: column;
        gap: 15px;
        margin-bottom: 20px;
    }
    
    .auth-button {
        padding: 14px 20px;
        border: none;
        border-radius: 30px;
        font-size: 1.1rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .auth-button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
    
    .register-button {
        background-color: #4CAF50;
        color: white;
    }
    
    .register-button:hover:not(:disabled) {
        background-color: #45a049;
        transform: translateY(-2px);
    }
    
    .signin-button {
        background-color: #3498db;
        color: white;
    }
    
    .signin-button:hover:not(:disabled) {
        background-color: #2980b9;
        transform: translateY(-2px);
    }
    
    .reset-button {
        background-color: #95a5a6;
        color: white;
    }
    
    .reset-button:hover:not(:disabled) {
        background-color: #7f8c8d;
        transform: translateY(-2px);
    }
    
    .message-container {
        margin: 15px 0;
        padding: 10px;
        border-radius: 4px;
        animation: fadeIn 0.3s ease;
    }
    
    .message-container.success {
        background-color: #d4edda;
        color: #155724;
    }
    
    .message-container.error {
        background-color: #f8d7da;
        color: #721c24;
    }
    
    .info-panel {
        margin-top: 30px;
        padding: 15px;
        background-color: #f5f5f5;
        border-radius: 8px;
        text-align: left;
    }
    
    .info-panel h3 {
        margin-top: 0;
        color: #2c3e50;
    }
    
    .info-panel ul {
        padding-left: 20px;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
</style>