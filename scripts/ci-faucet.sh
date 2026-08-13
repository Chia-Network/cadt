#!/usr/bin/env bash
# Request testneta faucet funds for the current wallet. If coins never arrive,
# delete the key and start over — the faucet will not pay the same address twice.
set -euo pipefail

FAUCET_URL="${TESTNETA_FAUCET:?TESTNETA_FAUCET is required}"
KEY_LABEL="${CHIA_KEY_LABEL:-ci_faucet}"
WALLET_RETRY_LIMIT="${WALLET_RETRY_LIMIT:-3}"
BALANCE_MAX_ATTEMPTS="${BALANCE_MAX_ATTEMPTS:-60}"
BALANCE_POLL_SECONDS="${BALANCE_POLL_SECONDS:-10}"
FAUCET_HTTP_ATTEMPTS="${FAUCET_HTTP_ATTEMPTS:-5}"
WALLET_READY_ATTEMPTS="${WALLET_READY_ATTEMPTS:-30}"

wait_for_wallet_ready() {
  echo "Waiting for wallet RPC to accept get_address..."
  local i
  for i in $(seq 1 "$WALLET_READY_ATTEMPTS"); do
    if ADDRESS=$(chia wallet get_address 2>/dev/null) && [ -n "$ADDRESS" ]; then
      echo "Wallet is ready (address: $ADDRESS)"
      return 0
    fi
    echo "  Wallet not ready yet (attempt $i/$WALLET_READY_ATTEMPTS)"
    sleep 2
  done
  echo "ERROR: Wallet did not become ready in time"
  return 1
}

wait_for_service_ports() {
  local port name i
  for port in 9256 8562 8575; do
    case "$port" in
      9256) name="wallet" ;;
      8562) name="data_layer" ;;
      8575) name="data_layer_http" ;;
    esac
    for i in $(seq 1 30); do
      if (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1; then
        echo "$name is listening on $port"
        break
      fi
      if [ "$i" -eq 30 ]; then
        echo "WARNING: $name did not listen on $port in time"
      else
        sleep 2
      fi
    done
  done
}

recreate_wallet() {
  echo "Stopping wallet, data, and data_layer_http..."
  chia stop wallet data data_layer_http || true

  local i rpc_down=false
  for i in $(seq 1 30); do
    if ! chia rpc wallet get_sync_status >/dev/null 2>&1; then
      echo "Wallet RPC is down"
      rpc_down=true
      break
    fi
    sleep 1
  done
  if [ "$rpc_down" = "false" ]; then
    echo "Wallet RPC still up; retrying stop..."
    chia stop wallet data data_layer_http || true
    sleep 5
    if chia rpc wallet get_sync_status >/dev/null 2>&1; then
      echo "ERROR: Wallet RPC did not stop; refusing to delete keys while it is still running"
      return 1
    fi
    echo "Wallet RPC is down"
  fi

  echo "Deleting all keys and generating a new wallet (label: $KEY_LABEL)..."
  chia keys delete_all
  chia keys generate -l "$KEY_LABEL"

  echo "Starting wallet, data, and data_layer_http..."
  chia start wallet data data_layer_http
  wait_for_wallet_ready
  wait_for_service_ports
}

request_faucet() {
  local address="$1"
  echo "Requesting funds from faucet for address: $address"
  local faucet_success=false
  local attempt response http_code body
  for attempt in $(seq 1 "$FAUCET_HTTP_ATTEMPTS"); do
    echo "Faucet request attempt $attempt/$FAUCET_HTTP_ATTEMPTS..."
    response=$(curl -s -w "\n%{http_code}" --max-time 30 -X POST \
      -H "Content-Type: application/json" \
      -d '{"address":"'"$address"'","amount":0.0001}' \
      "$FAUCET_URL" 2>&1) || true
    http_code=$(printf '%s\n' "$response" | tail -1)
    body=$(printf '%s\n' "$response" | head -n -1)
    echo "  Response (HTTP $http_code): $body"
    if [ -n "$http_code" ] && [ "$http_code" -ge 200 ] 2>/dev/null && [ "$http_code" -lt 300 ] 2>/dev/null; then
      echo "Faucet request succeeded on attempt $attempt"
      faucet_success=true
      break
    fi
    if [ "$attempt" -lt "$FAUCET_HTTP_ATTEMPTS" ]; then
      echo "  Faucet request failed, retrying in 15 seconds..."
      sleep 15
    fi
  done
  if [ "$faucet_success" = "false" ]; then
    echo "WARNING: All $FAUCET_HTTP_ATTEMPTS faucet attempts failed or returned empty response. Proceeding to balance polling in case a request was queued."
  fi
}

wait_for_funds() {
  echo "Waiting for wallet to receive funds..."
  local attempt=0
  local balance xch
  while true; do
    balance=$(chia rpc wallet get_wallet_balance '{"wallet_id": 1}' 2>/dev/null | jq -r '.wallet_balance.confirmed_wallet_balance // empty') || true
    echo "Current balance: ${balance:-unknown} (attempt $((attempt + 1))/$BALANCE_MAX_ATTEMPTS)"
    if [ -n "${balance:-}" ] && [ "$balance" != "0" ] && [ "$balance" != "null" ]; then
      xch=$(echo "scale=12; $balance / 1000000000000" | bc)
      echo "Wallet funded! Balance: $balance mojos ($xch XCH)"
      return 0
    fi
    attempt=$((attempt + 1))
    if [ "$attempt" -ge "$BALANCE_MAX_ATTEMPTS" ]; then
      echo "Wallet was not funded after $BALANCE_MAX_ATTEMPTS attempts"
      return 1
    fi
    echo "Balance still zero, waiting $BALANCE_POLL_SECONDS seconds..."
    sleep "$BALANCE_POLL_SECONDS"
  done
}

wallet_try=1
while [ "$wallet_try" -le "$WALLET_RETRY_LIMIT" ]; do
  echo "=== Wallet funding attempt $wallet_try/$WALLET_RETRY_LIMIT ==="
  if [ "$wallet_try" -gt 1 ]; then
    recreate_wallet
  else
    wait_for_wallet_ready
  fi

  CHIA_WALLET_ADDRESS=$(chia wallet get_address)
  request_faucet "$CHIA_WALLET_ADDRESS"
  if wait_for_funds; then
    exit 0
  fi

  if [ "$wallet_try" -lt "$WALLET_RETRY_LIMIT" ]; then
    echo "Funding failed for this wallet. Deleting it and starting over with a new key."
  fi
  wallet_try=$((wallet_try + 1))
done

echo "ERROR: Wallet was not funded after $WALLET_RETRY_LIMIT wallets"
exit 1
