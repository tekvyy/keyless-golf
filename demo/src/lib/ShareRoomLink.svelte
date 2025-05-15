<script lang="ts">
  import { onMount } from 'svelte';
  
  export let roomId: string;
  export let showQR: boolean = false;
  
  let shareUrl: string = '';
  let isLinkCopied: boolean = false;
  let qrCodeUrl: string = '';
  
  onMount(() => {
    const baseUrl = window.location.origin + window.location.pathname;
    shareUrl = `${baseUrl}?join=${roomId}`;
    
    // Generate QR code if requested
    if (showQR) {
      // Using Google Charts API to generate QR code
      qrCodeUrl = `https://chart.googleapis.com/chart?cht=qr&chl=${encodeURIComponent(shareUrl)}&chs=200x200&choe=UTF-8&chld=L|2`;
    }
  });
  
  function copyLinkToClipboard() {
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        isLinkCopied = true;
        setTimeout(() => {
          isLinkCopied = false;
        }, 3000);
      })
      .catch(err => {
        console.error('Could not copy text: ', err);
      });
  }
</script>

<div class="share-room">
  <h3>Share Room</h3>
  
  <div class="share-link">
    <input
      type="text"
      value={shareUrl}
      readonly
    />
    <button on:click={copyLinkToClipboard}>
      {isLinkCopied ? '✓ Copied!' : 'Copy Link'}
    </button>
  </div>
  
  {#if showQR && qrCodeUrl}
    <div class="qr-code">
      <img src={qrCodeUrl} alt="QR Code for Room" />
      <p>Scan to join room</p>
    </div>
  {/if}
  
  <div class="share-info">
    <p>Send this link to friends so they can join your room!</p>
  </div>
</div>

<style>
  .share-room {
    margin-top: 20px;
    padding: 15px;
    background-color: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #eee;
  }
  
  h3 {
    margin-top: 0;
    color: #2c3e50;
    font-size: 18px;
    margin-bottom: 15px;
  }
  
  .share-link {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
  }
  
  input {
    flex: 1;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: monospace;
    font-size: 14px;
    color: #333;
    background-color: white;
  }
  
  button {
    background-color: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 12px;
    cursor: pointer;
    font-weight: bold;
  }
  
  button:hover {
    background-color: #218838;
  }
  
  .qr-code {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 15px 0;
  }
  
  .qr-code img {
    max-width: 200px;
    border: 1px solid #ddd;
    padding: 10px;
    background-color: white;
  }
  
  .qr-code p {
    margin-top: 5px;
    font-size: 14px;
    color: #666;
  }
  
  .share-info {
    text-align: center;
    font-size: 14px;
    color: #666;
  }
</style>