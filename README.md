# Keyless-Golf


# Setup Steps

## Deploy the event indexer

```bash
cd ./zephyr
cargo install mercury-cli
# Get a JWT from Mercury https://test.mercurydata.app
export MERCURY_JWT="<YOUR.MERCURY.JWT>"
# Make sure you're on Rust version 1.79.0 or newer
mercury-cli --jwt $MERCURY_JWT --local false --mainnet false deploy
```

To install dependencies:

```bash
pnpm i
```
To build:

```bash
pnpm run build
```

To run the game:

```bash
cd ./demo
pnpm i
pnpm run start
```
