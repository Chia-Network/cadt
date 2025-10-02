#!/bin/bash

# Exit on undefined variable
set -u

### Variables

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global variable to track if any test failed
TEST_FAILED=0
# Variable to store error message
ERROR_MESSAGE=""
# Global variables for home organization details
HOME_ORG_UID=""
HOME_REGISTRY_ID=""

# Set DEBUG and TRACE variables based on LOG_LEVEL
if [[ "${LOG_LEVEL:-}" == "TRACE" ]]; then
    TRACE=true
    DEBUG=true
elif [[ "${LOG_LEVEL:-}" == "DEBUG" ]]; then
    TRACE=false
    DEBUG=true
else
    TRACE=false
    DEBUG=false
fi

# Test tracking arrays
PASSED_TESTS=()
FAILED_TESTS=()

expected_subscription_ids=(
    "29fe490bde0186cb7a592450d12e78162a353b866beec3e51bd67394257e4f4f"
    "68ac700af4c9a8c937029114a0fbbdbd3be282ad2aaec4ebe8485efa1426d38f"
    "a32e8ba6f67a8c95a785b01f86f4c2604cf703318e223142fac3831478c3b089"
    "11f7e8eb5a2a32dd373c14a172d55f62608a3e240cdf01362ce9fa398d2ca378"
)

### Functions

# Check if Chia wallet is synced. Do not proceed unless wallet is synced.
is_wallet_synced () {
    local TIMEOUT_SECONDS=300  # 5 minutes
    local CHECK_INTERVAL=5
    local MAX_ATTEMPTS=$((TIMEOUT_SECONDS / CHECK_INTERVAL))

    i=0
    while true; do
        if [[ "$DEBUG" == "true" ]]; then
            echo "[DEBUG] Running wallet sync status check..."
        fi
        local response=$(chia rpc wallet get_sync_status)
        if [[ "$TRACE" == "true" ]]; then
            echo "[DEBUG] Raw wallet sync response:"
            echo "$response"
        fi

        # Check if wallet is synced by comparing the synced field to true
        if echo "$response" | jq -e '.synced == true' > /dev/null; then
            echo -e "${GREEN}●${NC} Chia wallet is synced - proceeding"
            return 0
        else
            echo -e "${RED}●${NC} Chia wallet is not synced - trying again in $CHECK_INTERVAL seconds"
            sleep "$CHECK_INTERVAL"
            if (( i >= MAX_ATTEMPTS )); then
                fail_test "Wallet sync timeout of $TIMEOUT_SECONDS seconds exceeded."
                return 1
            fi
            ((i++))
        fi
    done
}

# Function to wait for transaction confirmation
wait_for_transaction() {
    local transaction_id="$1"
    local TIMEOUT_SECONDS=300  # 5 minutes
    local CHECK_INTERVAL=5     # 5 seconds
    local MAX_ATTEMPTS=$((TIMEOUT_SECONDS / CHECK_INTERVAL))

    i=0
    while true; do
        if [[ "$DEBUG" == "true" ]]; then
            echo "[DEBUG] Check attempt $((i+1)) of $MAX_ATTEMPTS"
        fi

        # Get transaction status
        local response
        response=$(chia rpc wallet get_transaction "{\"transaction_id\": \"$transaction_id\"}")

        if [[ $? -ne 0 ]]; then
            if [[ "$DEBUG" == "true" ]]; then
                echo "[DEBUG] Failed to get transaction status"
                echo "[DEBUG] Response: $response"
            fi
            fail_test "Failed to get transaction status. This usually means the transaction ID is invalid or empty."
            return 1
        fi

        if [[ "$TRACE" == "true" ]]; then
            echo "[DEBUG] Transaction response:"
            echo "$response"
        fi

        # Check if transaction is confirmed
        if echo "$response" | jq -e '.transaction.confirmed == true' > /dev/null; then
            echo -e "${GREEN}●${NC} Transaction $transaction_id confirmed successfully"
            return 0
        fi

        if (( i >= MAX_ATTEMPTS )); then
            fail_test "Transaction confirmation timeout of $TIMEOUT_SECONDS seconds exceeded. Transaction ID: $transaction_id"
            return 1
        fi

        echo -e "${RED}●${NC} Transaction not yet confirmed - checking again in $CHECK_INTERVAL seconds"
        sleep "$CHECK_INTERVAL"
        ((i++))
    done
}

# Function to check if wallet has sufficient balance
check_wallet_balance() {
    local wallet_id="$1"
    local min_balance="$2"
    local TIMEOUT_SECONDS=300  # 5 minutes
    local CHECK_INTERVAL=5     # 5 seconds
    local MAX_ATTEMPTS=$((TIMEOUT_SECONDS / CHECK_INTERVAL))

    echo "Checking wallet $wallet_id balance (will retry for up to $TIMEOUT_SECONDS seconds)..."

    i=0
    while true; do
        if [[ "$DEBUG" == "true" ]]; then
            echo "[DEBUG] Balance check attempt $((i+1)) of $MAX_ATTEMPTS"
        fi

        local balance_response
        balance_response=$(chia rpc wallet get_wallet_balances "{\"wallet_ids\": [$wallet_id]}")
        if [[ $? -ne 0 ]]; then
            if [[ "$DEBUG" == "true" ]]; then
                echo "[DEBUG] Failed to get wallet balance, will retry..."
            fi
            sleep "$CHECK_INTERVAL"
            if (( i >= MAX_ATTEMPTS )); then
                fail_test "Failed to get wallet balance after $TIMEOUT_SECONDS seconds"
                return
            fi
            ((i++))
            continue
        fi

        if [[ "$TRACE" == "true" ]]; then
            echo "[DEBUG] Balance response:"
            echo "$balance_response"
        fi

        # Extract the confirmed wallet balance
        local confirmed_balance
        confirmed_balance=$(echo "$balance_response" | jq -r ".wallet_balances[\"$wallet_id\"].confirmed_wallet_balance")
        if [[ $? -ne 0 ]]; then
            if [[ "$DEBUG" == "true" ]]; then
                echo "[DEBUG] Failed to parse wallet balance, will retry..."
            fi
            sleep "$CHECK_INTERVAL"
            if (( i >= MAX_ATTEMPTS )); then
                fail_test "Failed to parse wallet balance after $TIMEOUT_SECONDS seconds"
                return
            fi
            ((i++))
            continue
        fi

        echo "Wallet $wallet_id confirmed balance: $confirmed_balance mojos"

        # Check if balance is sufficient
        if (( confirmed_balance >= min_balance )); then
            echo -e "${GREEN}●${NC} Wallet $wallet_id has sufficient balance ($confirmed_balance mojos)"
            return 0
        fi

        if (( i >= MAX_ATTEMPTS )); then
            fail_test "Wallet $wallet_id balance ($confirmed_balance mojos) is insufficient after $TIMEOUT_SECONDS seconds. Need at least $min_balance mojos."
            return
        fi

        echo -e "${RED}●${NC} Wallet $wallet_id balance ($confirmed_balance mojos) insufficient - checking again in $CHECK_INTERVAL seconds"
        sleep "$CHECK_INTERVAL"
        ((i++))
    done
}

# Check if any mirrors owned by us still exist. Wait until they're gone.
check_mirrors_removed () {
    i=0
    while true; do
        # Get all subscription IDs
        subscription_ids=$(chia rpc data_layer subscriptions | jq -r '.store_ids[]')
        total_mirrors=0

        # Check mirrors for each subscription
        for id in $subscription_ids; do
            mirror_count=$(chia rpc data_layer get_mirrors "{\"id\":\"$id\"}" | jq '[.mirrors[] | select(.ours == true)] | length')
            total_mirrors=$((total_mirrors + mirror_count))
        done

        if (( total_mirrors == 0 )); then
            echo -e "${GREEN}●${NC} No mirrors owned by us found - proceeding"
            break
        fi

        echo -e "${RED}●${NC} Found $total_mirrors mirrors owned by us across all subscriptions - waiting 10 seconds before checking again"
        sleep 10

        if (( $i > 29 )); then
            fail_test "Mirror removal timeout of 300 seconds exceeded."
            return
        fi
        ((i++))
    done
}

# Check if the required Chia services are running and cadt is healthy
check_health_endpoint () {
    echo "Checking health of required Chia services and cadt..."

    local services=("chia_wallet" "chia_data_layer" "chia_data_layer_http")
    local max_attempts=6
    local attempt=0

    while (( attempt < max_attempts )); do
        local all_services_running=true
        local cadt_healthy=false

        if [[ "$DEBUG" == "true" ]]; then
            echo "[DEBUG] Health check attempt $((attempt + 1)) of $max_attempts"
        fi

        # Check Chia services
        for service in "${services[@]}"; do
            if [[ "$DEBUG" == "true" ]]; then
                echo "[DEBUG] Checking if $service is running..."
            fi

            # Use the Chia daemon RPC is_running endpoint
            local response=$(chia rpc daemon is_running "{\"service\": \"$service\"}" 2>/dev/null)

            if [[ $? -eq 0 ]] && echo "$response" | jq -e '.is_running == true' > /dev/null 2>&1; then
                if [[ "$DEBUG" == "true" ]]; then
                    echo "[DEBUG] ✓ $service is running"
                fi
            else
                if [[ "$DEBUG" == "true" ]]; then
                    echo "[DEBUG] ✗ $service is not running"
                fi
                all_services_running=false
            fi
        done

        # Check cadt health endpoint
        if [[ "$all_services_running" == "true" ]]; then
            if [[ "$DEBUG" == "true" ]]; then
                echo "[DEBUG] Checking cadt health endpoint..."
            fi
            local health_response=$(curl -s http://127.0.0.1:31310/health 2>/dev/null)

            if [[ $? -eq 0 ]] && echo "$health_response" | jq -e '.message == "OK"' > /dev/null 2>&1; then
                if [[ "$DEBUG" == "true" ]]; then
                    echo "[DEBUG] ✓ cadt health endpoint responding OK"
                fi
                cadt_healthy=true
            else
                if [[ "$DEBUG" == "true" ]]; then
                    echo "[DEBUG] ✗ cadt health endpoint not responding OK"
                    echo "[DEBUG] Health response: $health_response"
                fi
            fi
        fi

        if [[ "$all_services_running" == "true" && "$cadt_healthy" == "true" ]]; then
            echo -e "\n${GREEN}=========================================="
            echo -e "✓ All required Chia services are running"
            echo -e "✓ cadt health endpoint is responding"
            echo -e "===========================================${NC}\n"
            return 0
        fi

        echo -e "\n${RED}Health check incomplete - waiting 10 seconds before checking again${NC}"
        if [[ "$all_services_running" != "true" ]]; then
            echo "Chia services not all running"
        fi
        if [[ "$cadt_healthy" != "true" ]]; then
            echo "cadt health endpoint not responding"
        fi
        sleep 10
        ((attempt++))
    done

    echo -e "\n${RED}Health check timeout of 60 seconds exceeded.${NC}"
    echo "Required Chia services: ${services[*]}"
    echo "Required cadt health endpoint: http://127.0.0.1:31310/health"
    exit 1
}

# Check if we are unsubscribed from all stores
check_unsubscribed () {
    i=0
    while true; do
        subscription_count=$(chia rpc data_layer subscriptions | jq '.store_ids | length')

        if (( subscription_count == 0 )); then
            echo -e "${GREEN}●${NC} Successfully unsubscribed from all stores"
            break
        fi

        echo -e "${RED}●${NC} Found $subscription_count remaining subscriptions - waiting 5 seconds before checking again"
        sleep 5

        if (( $i > 59 )); then
            fail_test "Unsubscribe timeout of 300 seconds exceeded. Still have $subscription_count subscriptions."
            return
        fi
        ((i++))
    done
}

# Cleanup function to ensure proper shutdown
cleanup () {
    echo -e "\n${GREEN}Running cleanup tasks...${NC}"

    # Save pm2 logs to file regardless of test outcome
    echo "Saving pm2 logs to file..."
    local log_file="cadt.log"

    # Clear the log file first
    > "$log_file"

    # Get the full log history by reading the log files directly
    if pm2 describe cadt > /dev/null 2>&1; then
        echo "PM2 process found, collecting all available logs..."

        # Get both stdout and error log paths
        local pm2_out_log=$(pm2 describe cadt | grep -o '/.*out\.log' | head -1)
        local pm2_error_log=$(pm2 describe cadt | grep -o '/.*error\.log' | head -1)

        if [[ -n "$pm2_out_log" && -f "$pm2_out_log" ]]; then
            echo "Copying stdout log from: $pm2_out_log"
            echo "=== STDOUT LOG ===" >> "$log_file"
            cat "$pm2_out_log" >> "$log_file"
            echo "" >> "$log_file"
        fi

        if [[ -n "$pm2_error_log" && -f "$pm2_error_log" ]]; then
            echo "Copying error log from: $pm2_error_log"
            echo "=== ERROR LOG ===" >> "$log_file"
            cat "$pm2_error_log" >> "$log_file"
            echo "" >> "$log_file"
        fi

        # Also try to get recent logs from pm2 logs command
        echo "=== RECENT PM2 LOGS ===" >> "$log_file"
        pm2 logs cadt --nostream --lines 100 >> "$log_file" 2>&1
        echo "" >> "$log_file"

    else
        echo "PM2 process not found, getting recent logs only"
        echo "=== PM2 LOGS (PROCESS NOT FOUND) ===" >> "$log_file"
        pm2 logs cadt --nostream --lines 100 >> "$log_file" 2>&1
    fi

    # Also capture any application logs from the CADT directory
    local cadt_log_dir="$HOME/.chia/mainnet/core-registry/cadt"
    if [[ -d "$cadt_log_dir" ]]; then
        echo "=== CADT APPLICATION LOGS ===" >> "$log_file"
        find "$cadt_log_dir" -name "*.log" -type f -exec cat {} \; >> "$log_file" 2>/dev/null || true
        echo "" >> "$log_file"
    fi

    echo "PM2 logs saved to: $log_file"

    # Stop the cadt
    pm2 stop cadt

    # Remove mirrors and subscriptions
    echo "Removing mirrors and subscriptions..."
    chia-tools data delete-mirrors --all
    chia-tools data unsub-all
    check_mirrors_removed
    check_unsubscribed

    # Stop chia
    echo "Stopping Chia..."
    chia stop all -d

    # If there was a test failure, output error and exit with error code
    if (( TEST_FAILED == 1 )); then
        echo -e "\n${RED}Test failed: $ERROR_MESSAGE${NC}\n"
        exit 1
    fi
}

# Function to handle test failures
fail_test () {
    TEST_FAILED=1
    ERROR_MESSAGE="$1"
    cleanup
}

# Function to track test results
track_test_result() {
    local test_name="$1"
    local test_result="$2"  # "PASS" or "FAIL"

    if [[ "$test_result" == "PASS" ]]; then
        PASSED_TESTS+=("$test_name")
    else
        FAILED_TESTS+=("$test_name")
    fi
}

# Function to display test summary
display_test_summary() {
    echo -e "\n${BLUE}=========================================="
    echo -e "TEST SUMMARY"
    echo -e "===========================================${NC}\n"

    local total_tests=$((${#PASSED_TESTS[@]} + ${#FAILED_TESTS[@]}))
    local passed_count=${#PASSED_TESTS[@]}
    local failed_count=${#FAILED_TESTS[@]}

    echo -e "${BLUE}Total Tests: $total_tests${NC}"
    echo -e "${GREEN}Passed: $passed_count${NC}"
    echo -e "${RED}Failed: $failed_count${NC}\n"

    if [[ ${#PASSED_TESTS[@]} -gt 0 ]]; then
        echo -e "${GREEN}✓ PASSED TESTS:${NC}"
        for test in "${PASSED_TESTS[@]}"; do
            echo -e "${GREEN}  • $test${NC}"
        done
        echo ""
    fi

    if [[ ${#FAILED_TESTS[@]} -gt 0 ]]; then
        echo -e "${RED}✗ FAILED TESTS:${NC}"
        for test in "${FAILED_TESTS[@]}"; do
            echo -e "${RED}  • $test${NC}"
        done
        echo ""
    fi

    if [[ $failed_count -eq 0 ]]; then
        echo -e "${GREEN}=========================================="
        echo -e "🎉 ALL TESTS PASSED! 🎉"
        echo -e "===========================================${NC}\n"
    else
        echo -e "${RED}=========================================="
        echo -e "❌ SOME TESTS FAILED ❌"
        echo -e "===========================================${NC}\n"
    fi
}

# Test if we are subscribed to all expected store IDs
test_subscriptions () {
    local TIMEOUT_SECONDS=600
    local CHECK_INTERVAL=10
    local MAX_ATTEMPTS=$((TIMEOUT_SECONDS / CHECK_INTERVAL))

    echo "Testing DataLayer subscriptions... (this can take up to $TIMEOUT_SECONDS seconds)"
    if [[ "$DEBUG" == "true" ]]; then
        echo "[DEBUG] Will check every $CHECK_INTERVAL seconds, up to $MAX_ATTEMPTS times"
    fi

    # Print out the expected subscription IDs we're looking for
    echo -e "\n${BLUE}Looking for these expected subscription IDs:${NC}"
    for id in "${expected_subscription_ids[@]}"; do
        echo -e "${BLUE}  - $id${NC}"
    done
    echo ""

    #check_health_endpoint

    i=0
    while true; do
        if [[ "$DEBUG" == "true" ]]; then
            echo "[DEBUG] Check attempt $((i+1)) of $MAX_ATTEMPTS"
        fi

        # Get current subscriptions
        current_subscriptions=$(chia rpc data_layer subscriptions | jq -r '.store_ids[]')
        if [[ "$TRACE" == "true" ]]; then
            echo "[DEBUG] Current subscriptions response:"
            echo "$current_subscriptions"
        fi

        missing_subs=0
        found_ids=()
        missing_ids=()

        # Check each expected subscription
        for expected_id in "${expected_subscription_ids[@]}"; do
            if echo "$current_subscriptions" | grep -q "^$expected_id$"; then
                found_ids+=("$expected_id")
            else
                missing_ids+=("$expected_id")
                missing_subs=1
            fi
        done

        if [[ "$DEBUG" == "true" ]]; then
            echo "[DEBUG] Found ${#found_ids[@]} subscriptions, missing ${#missing_ids[@]} subscriptions"
        fi

        if (( missing_subs == 0 )); then
            echo -e "\n${GREEN}=========================================="
            echo -e "✓ All expected subscriptions found - TEST PASSED"
            echo -e "===========================================${NC}\n"
            track_test_result "DataLayer Subscriptions" "PASS"
            break
        fi

        if (( $i >= $MAX_ATTEMPTS )); then
            echo -e "\n${RED}Subscription test results after $TIMEOUT_SECONDS seconds:${NC}"
            echo -e "${GREEN}Found subscriptions:${NC}"
            for id in "${found_ids[@]}"; do
                echo -e "${GREEN}✓${NC} $id"
            done
            echo -e "\n${RED}Missing subscriptions:${NC}"
            for id in "${missing_ids[@]}"; do
                echo -e "${RED}✗${NC} $id"
            done
            track_test_result "DataLayer Subscriptions" "FAIL"
            fail_test "Subscription test timeout of $TIMEOUT_SECONDS seconds exceeded."
            return
        fi

        ((i++))
        sleep $CHECK_INTERVAL
    done
}

# Check if any home organizations exist
check_home_org () {
    local ENDPOINT="http://localhost:31310/v1/organizations"
    local response
    local home_orgs

    if [[ "$DEBUG" == "true" ]]; then
        echo "[DEBUG] Checking for home organizations..."
    fi

    # Get organizations and store response
    response=$(make_api_call "curl -s --location --request GET '$ENDPOINT' --header 'Content-Type: application/json'")
    if [[ $? -ne 0 ]]; then
        if [[ "$DEBUG" == "true" ]]; then
            echo "[DEBUG] curl request failed"
        fi
        fail_test "Failed to fetch organizations from $ENDPOINT"
        return 1
    fi

    if [[ "$TRACE" == "true" ]]; then
        echo "[DEBUG] Organizations response:"
        echo "$response"
    fi

    # If response is empty or just {}, no organizations exist
    if [[ -z "$response" ]] || [[ "$response" == "{}" ]]; then
        echo -e "${GREEN}●${NC} No home organizations found"
        return 0
    fi

    # Count organizations with isHome=true
    home_orgs=$(echo "$response" | jq '[.[] | select(.isHome == true)] | length')
    if [[ $? -ne 0 ]]; then
        if [[ "$DEBUG" == "true" ]]; then
            echo "[DEBUG] Failed to parse organizations response with jq"
        fi
        fail_test "Failed to parse organizations response"
        return 1
    fi

    if (( home_orgs == 0 )); then
        echo -e "${GREEN}●${NC} No home organizations found"
        return 0
    else
        echo -e "${RED}●${NC} Found $home_orgs home organization(s)"
        # Get the orgUids of home orgs for debugging
        if [[ "$DEBUG" == "true" ]]; then
            echo "[DEBUG] Home organization UIDs:"
            echo "$response" | jq -r '.[] | select(.isHome == true) | .orgUid'
        fi
        return 1
    fi
}

# Test 2: Create a home organization
test_create_home_org () {
    # First verify wallet is synced
    if ! is_wallet_synced; then
        return
    fi

    local TIMEOUT_SECONDS=1800   # 30 minutes
    local CHECK_INTERVAL=30
    local MAX_ATTEMPTS=60
    local CREATE_ENDPOINT="http://localhost:31310/v1/organizations/create"

    echo "Testing home organization creation... (this can take up to 30 minutes)"

    # First verify no home org exists
    if ! check_home_org; then
        fail_test "Found existing home organization when none should exist"
        return
    fi

    # Create home organization
    if [[ "$DEBUG" == "true" ]]; then
        echo "[DEBUG] Creating home organization..."
    fi
    local response
    response=$(make_api_call "curl -s --location -g --request POST '$CREATE_ENDPOINT' \
        --header 'Content-Type: application/json' \
        --data-raw '{
            \"name\": \"Automated Testing CI Org\",
            \"icon\": \"https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg\"
        }'")

    if [[ "$TRACE" == "true" ]]; then
        echo "[DEBUG] Create organization response:"
        echo "$response"
    fi

    # Check if creation was successful
    if ! echo "$response" | jq -e '.success == true' > /dev/null; then
        fail_test "Failed to create organization: $(echo "$response" | jq -r '.message // "Unknown error"')"
        return
    fi

    # Wait for organization to be set as home org
    echo "Waiting for organization to be set as home organization..."
    i=0
    while true; do
        if [[ "$DEBUG" == "true" ]]; then
            echo "[DEBUG] Check attempt $((i+1)) of $MAX_ATTEMPTS"
        fi

        # Show owned stores status
        if [[ "$DEBUG" == "true" ]]; then
            echo "[DEBUG] Current owned stores:"
            chia data get_owned_stores
        fi

        # Get current organizations
        response=$(make_api_call "curl -s --location --request GET 'http://localhost:31310/v1/organizations' \
            --header 'Content-Type: application/json'")
        if [[ $? -ne 0 ]]; then
            fail_test "Failed to get organizations"
            return
        fi

        if [[ "$TRACE" == "true" ]]; then
            echo "[DEBUG] Organizations check response:"
            echo "$response" | jq '.'
        fi

        # Check if response is valid JSON
        if ! echo "$response" | jq empty > /dev/null 2>&1; then
            if [[ "$DEBUG" == "true" ]]; then
                echo "[DEBUG] Invalid JSON response received"
                echo "[DEBUG] Response content: $response"
            fi
            sleep "$CHECK_INTERVAL"
            ((i++))
            continue
        fi

        # Count home organizations
        local home_org_count
        home_org_count=$(echo "$response" | jq '[to_entries[] | select(.value.isHome == true)] | length')

        # Check if there's more than one home org
        if (( home_org_count > 1 )); then
            fail_test "Multiple home organizations found. This should not happen."
            return
        fi

                # Find the home organization (if any)
        local home_org
        home_org=$(echo "$response" | jq -r 'to_entries[] | select(.value.isHome == true) | .key')

        # If no home organization is found, fail immediately
        if [[ -z "$home_org" || "$home_org" == "null" ]]; then
            echo -e "\n${RED}No home organization found in response${NC}"
            echo "Current organizations state:"
            echo "$response" | jq '.'
            fail_test "No home organization found. Organization creation may have failed."
            return
        fi

        # Check if it's still pending
        if [[ "$home_org" == "PENDING" ]]; then
            echo -e "${RED}●${NC} Home organization creation is still pending - checking again in $CHECK_INTERVAL seconds"
            sleep "$CHECK_INTERVAL"
            ((i++))

            # Check timeout after incrementing counter
            if (( $i >= $MAX_ATTEMPTS )); then
                echo -e "\n${RED}Organization creation results after $TIMEOUT_SECONDS seconds:${NC}"
                echo "Current organizations state:"
                echo "$response" | jq '.'
                fail_test "Organization creation verification timeout of $TIMEOUT_SECONDS seconds exceeded."
                return
            fi
            continue
        fi

        # Check if the home org is fully ready
        local is_subscribed
        local is_synced
        local org_uid
        local registry_id

        is_subscribed=$(echo "$response" | jq -r ".[\"$home_org\"].subscribed")
        is_synced=$(echo "$response" | jq -r ".[\"$home_org\"].synced")
        org_uid=$(echo "$response" | jq -r ".[\"$home_org\"].orgUid")
        registry_id=$(echo "$response" | jq -r ".[\"$home_org\"].registryId")

        if [[ "$is_subscribed" == "true" && "$is_synced" == "true" ]]; then
            echo -e "\n${GREEN}=========================================="
            echo -e "✓ Home organization successfully created and verified - TEST PASSED"
            echo -e "===========================================${NC}\n"
            echo "Home organization details:"
            echo "  orgUid: $org_uid"
            echo "  registryId: $registry_id"

            # Store these values in global variables for use outside the function
            HOME_ORG_UID="$org_uid"
            HOME_REGISTRY_ID="$registry_id"

            track_test_result "Home Organization Creation" "PASS"
            break
        else
            echo -e "${RED}●${NC} Home organization exists but not ready (subscribed: $is_subscribed, synced: $is_synced) - checking again in $CHECK_INTERVAL seconds"
            sleep "$CHECK_INTERVAL"
            ((i++))

            # Check timeout after incrementing counter
            if (( $i >= $MAX_ATTEMPTS )); then
                echo -e "\n${RED}Organization creation results after $TIMEOUT_SECONDS seconds:${NC}"
                echo "Current organizations state:"
                echo "$response" | jq '.'
                track_test_result "Home Organization Creation" "FAIL"
                fail_test "Organization creation verification timeout of $TIMEOUT_SECONDS seconds exceeded."
                return
            fi
            continue
        fi
    done
}

# Test 3: Create and verify a project
test_create_project () {
    # First verify wallet is synced
    if ! is_wallet_synced; then
        return
    fi

    local TIMEOUT_SECONDS=60
    local CHECK_INTERVAL=10
    local MAX_ATTEMPTS=$((TIMEOUT_SECONDS / CHECK_INTERVAL))
    local PROJECTS_ENDPOINT="http://localhost:31310/v1/projects"
    local STAGING_ENDPOINT="http://localhost:31310/v1/staging"
    local response
    local project_uuid

    echo "Testing project creation... (this can take up to $TIMEOUT_SECONDS seconds)"

    # Create project
    if [[ "$DEBUG" == "true" ]]; then
        echo "[DEBUG] Creating new project..."
    fi
    response=$(make_api_call "curl -s --location -g --request POST '$PROJECTS_ENDPOINT' \
        --header 'Content-Type: application/json' \
        --data-raw '{
            \"projectName\": \"Automated Testing Project\",
            \"projectId\": \"ATP1\",
            \"projectDeveloper\": \"functional-tests.sh\",
            \"program\": null,
            \"projectLink\": \"https://observer.climateactiondata.org/\",
            \"sector\": \"Agriculture; forestry and fishing\",
            \"projectType\": \"Agriculture, Forestry and other land use (AFOLU)\",
            \"projectStatus\": \"Completed\",
            \"projectStatusDate\": \"2025-01-28T05:00:00.000Z\",
            \"coveredByNDC\": \"Outside NDC\",
            \"ndcInformation\": null,
            \"currentRegistry\": \"American Carbon Registry (ACR)\",
            \"registryOfOrigin\": \"American Carbon Registry (ACR)\",
            \"originProjectId\": \"ATP1\",
            \"unitMetric\": \"tCO2e\",
            \"methodology\": \"ACR - Afforestation and Reforestation of Degraded Lands\",
            \"validationBody\": null,
            \"validationDate\": null,
            \"projectTags\": null,
            \"issuances\": [
                {
                    \"startDate\": \"2025-02-03T05:00:00.000Z\",
                    \"endDate\": \"2025-02-28T05:00:00.000Z\",
                    \"verificationApproach\": \"ATP-TEST\",
                    \"verificationBody\": \"ATP-Verification\",
                    \"verificationReportDate\": \"2025-02-14T05:00:00.000Z\"
                }
            ],
            \"projectLocations\": [
                {
                    \"country\": \"Zambia\",
                    \"geographicIdentifier\": \"123 Testing Ave\",
                    \"inCountryRegion\": \"\",
                    \"fileId\": \"\"
                }
            ]
        }'")

    if [[ "$TRACE" == "true" ]]; then
        echo "[DEBUG] Create project response:"
        echo "$response"
    fi

    # Check if creation was successful
    if ! echo "$response" | jq -e '.success == true' > /dev/null; then
        fail_test "Failed to create project: $(echo "$response" | jq -r '.message // "Unknown error"')"
        return
    fi

    # Store the UUID
    project_uuid=$(echo "$response" | jq -r '.uuid')
    echo "[DEBUG] Project created with UUID: $project_uuid"

    # Verify project appears in staging
    echo "Verifying project appears in staging..."
    i=0
    while true; do
        if [[ "$DEBUG" == "true" ]]; then
        echo "[DEBUG] Check attempt $((i+1)) of $MAX_ATTEMPTS"
        fi

                # Get staging entries
        response=$(make_api_call "curl -s --location --request GET '$STAGING_ENDPOINT' \
            --header 'Content-Type: application/json'")
        if [[ $? -ne 0 ]]; then
            fail_test "Failed to get staging entries"
            return
        fi

        # Check if our project UUID exists in staging
        if echo "$response" | jq -e --arg uuid "$project_uuid" '.[] | select(.uuid == $uuid)' > /dev/null; then
            echo -e "\n${GREEN}=========================================="
            echo -e "✓ Project successfully created and found in staging - TEST PASSED"
            echo -e "===========================================${NC}\n"
            track_test_result "Project Creation" "PASS"
            break
        fi

        if (( i >= MAX_ATTEMPTS )); then
            echo -e "\n${RED}Project creation results after $TIMEOUT_SECONDS seconds:${NC}"
            echo "Expected project UUID: $project_uuid"
            echo "Current staging state:"
            echo "$response" | jq '.'
            track_test_result "Project Creation" "FAIL"
            fail_test "Project staging verification timeout of $TIMEOUT_SECONDS seconds exceeded."
            return
        fi

        echo -e "${RED}●${NC} Project not yet found in staging - checking again in $CHECK_INTERVAL seconds"
        sleep "$CHECK_INTERVAL"
        ((i++))
    done
}

# Test 4: Add a Project
test_add_project () {
    # First verify wallet is synced
    if ! is_wallet_synced; then
        return
    fi

    local TIMEOUT_SECONDS=60
    local CHECK_INTERVAL=10
    local MAX_ATTEMPTS=$((TIMEOUT_SECONDS / CHECK_INTERVAL))
    local PROJECTS_ENDPOINT="http://localhost:31310/v1/projects"
    local STAGING_ENDPOINT="http://localhost:31310/v1/staging"
    local response
    local project_uuid

    echo "Testing project addition... (this can take up to $TIMEOUT_SECONDS seconds)"

    # Create project with "Temporary Auto-created Test Data" name
    if [[ "$DEBUG" == "true" ]]; then
        echo "[DEBUG] Creating new project with temporary test data..."
    fi
    response=$(make_api_call "curl -s --location -g --request POST '$PROJECTS_ENDPOINT' \
        --header 'Content-Type: application/json' \
        --data-raw '{
            \"projectName\": \"Temporary Auto-created Test Data\",
            \"projectId\": \"TEMP-AUTO-001\",
            \"projectDeveloper\": \"Temporary Auto-created Test Data\",
            \"program\": null,
            \"projectLink\": \"https://observer.climateactiondata.org/\",
            \"sector\": \"Agriculture; forestry and fishing\",
            \"projectType\": \"Afforestation\",
            \"projectStatus\": \"Registered\",
            \"projectStatusDate\": \"2025-01-28T05:00:00.000Z\",
            \"coveredByNDC\": \"Outside NDC\",
            \"ndcInformation\": \"Temporary Auto-created Test Data\",
            \"currentRegistry\": \"American Carbon Registry (ACR)\",
            \"registryOfOrigin\": \"American Carbon Registry (ACR)\",
            \"originProjectId\": \"TEMP-AUTO-001\",
            \"unitMetric\": \"tCO2e\",
            \"methodology\": \"ACR - Afforestation and Reforestation of Degraded Lands\",
            \"validationBody\": null,
            \"validationDate\": null,
            \"projectTags\": null,
            \"issuances\": [
                {
                    \"startDate\": \"2025-02-03T05:00:00.000Z\",
                    \"endDate\": \"2025-02-28T05:00:00.000Z\",
                    \"verificationApproach\": \"Temporary Auto-created Test Data\",
                    \"verificationBody\": \"Temporary Auto-created Test Data\",
                    \"verificationReportDate\": \"2025-02-14T05:00:00.000Z\"
                }
            ],
            \"projectLocations\": [
                {
                    \"country\": \"Canada\",
                    \"geographicIdentifier\": \"Temporary Auto-created Test Data Location\",
                    \"inCountryRegion\": \"Ontario\",
                    \"fileId\": \"\"
                }
            ]
        }'")

    if [[ "$TRACE" == "true" ]]; then
        echo "[DEBUG] Create project response:"
        echo "$response"
    fi

    # Check if creation was successful
    if ! echo "$response" | jq -e '.success == true' > /dev/null; then
        fail_test "Failed to create project: $(echo "$response" | jq -r '.message // "Unknown error"')"
        return
    fi

    # Store the UUID
    project_uuid=$(echo "$response" | jq -r '.uuid')
    echo "[DEBUG] Project created with UUID: $project_uuid"

    # Verify project appears in staging
    echo "Verifying project appears in staging..."
    i=0
    while true; do
        if [[ "$DEBUG" == "true" ]]; then
            echo "[DEBUG] Check attempt $((i+1)) of $MAX_ATTEMPTS"
        fi

        # Get staging entries
        response=$(make_api_call "curl -s --location --request GET '$STAGING_ENDPOINT' \
            --header 'Content-Type: application/json'")
        if [[ $? -ne 0 ]]; then
            fail_test "Failed to get staging entries"
            return
        fi

        # Check if our project UUID exists in staging
        if echo "$response" | jq -e --arg uuid "$project_uuid" '.[] | select(.uuid == $uuid)' > /dev/null; then
            echo -e "\n${GREEN}=========================================="
            echo -e "✓ Project successfully created and found in staging - TEST PASSED"
            echo -e "===========================================${NC}\n"
            track_test_result "Project Addition" "PASS"
            break
        fi

        if (( i >= MAX_ATTEMPTS )); then
            echo -e "\n${RED}Project creation results after $TIMEOUT_SECONDS seconds:${NC}"
            echo "Expected project UUID: $project_uuid"
            echo "Current staging state:"
            echo "$response" | jq '.'
            track_test_result "Project Addition" "FAIL"
            fail_test "Project staging verification timeout of $TIMEOUT_SECONDS seconds exceeded."
            return
        fi

        echo -e "${RED}●${NC} Project not yet found in staging - checking again in $CHECK_INTERVAL seconds"
        sleep "$CHECK_INTERVAL"
        ((i++))
    done
}

# Test 5: Add a Unit
test_add_unit () {
    # First verify wallet is synced
    if ! is_wallet_synced; then
        return
    fi

    local TIMEOUT_SECONDS=60
    local CHECK_INTERVAL=10
    local MAX_ATTEMPTS=$((TIMEOUT_SECONDS / CHECK_INTERVAL))
    local UNITS_ENDPOINT="http://localhost:31310/v1/units"
    local STAGING_ENDPOINT="http://localhost:31310/v1/staging"
    local response
    local unit_uuid

    echo "Testing unit addition... (this can take up to $TIMEOUT_SECONDS seconds)"

    # Create unit with "Temporary Auto-created Test Data" name
    if [[ "$DEBUG" == "true" ]]; then
        echo "[DEBUG] Creating new unit with temporary test data..."
    fi
    response=$(make_api_call "curl -s --location -g --request POST '$UNITS_ENDPOINT' \
        --header 'Content-Type: application/json' \
        --data-raw '{
            \"projectLocationId\": \"TEMP-AUTO-LOC-001\",
            \"unitOwner\": \"Temporary Auto-created Test Data\",
            \"countryJurisdictionOfOwner\": \"Canada\",
            \"inCountryJurisdictionOfOwner\": \"Ontario\",
            \"vintageYear\": 2024,
            \"unitType\": \"Removal - technical\",
            \"marketplace\": \"Temporary Auto-created Test Data Marketplace\",
            \"marketplaceLink\": \"https://observer.climateactiondata.org/\",
            \"marketplaceIdentifier\": \"TEMP-AUTO-001\",
            \"unitTags\": \"Temporary Auto-created Test Data\",
            \"unitStatus\": \"Held\",
            \"unitStatusReason\": null,
            \"unitCount\": 100,
            \"unitRegistryLink\": \"https://observer.climateactiondata.org/\",
            \"correspondingAdjustmentDeclaration\": \"Unknown\",
            \"correspondingAdjustmentStatus\": \"Not Started\"
        }'")

    if [[ "$TRACE" == "true" ]]; then
        echo "[DEBUG] Create unit response:"
        echo "$response"
    fi

    # Check if creation was successful
    if ! echo "$response" | jq -e '.success == true' > /dev/null; then
        fail_test "Failed to create unit: $(echo "$response" | jq -r '.message // "Unknown error"')"
        return
    fi

    # Store the UUID
    unit_uuid=$(echo "$response" | jq -r '.uuid')
    echo "[DEBUG] Unit created with UUID: $unit_uuid"

    # Verify unit appears in staging
    echo "Verifying unit appears in staging..."
    i=0
    while true; do
        if [[ "$DEBUG" == "true" ]]; then
            echo "[DEBUG] Check attempt $((i+1)) of $MAX_ATTEMPTS"
        fi

        # Get staging entries
        response=$(make_api_call "curl -s --location --request GET '$STAGING_ENDPOINT' \
            --header 'Content-Type: application/json'")
        if [[ $? -ne 0 ]]; then
            fail_test "Failed to get staging entries"
            return
        fi

        # Check if our unit UUID exists in staging
        if echo "$response" | jq -e --arg uuid "$unit_uuid" '.[] | select(.uuid == $uuid)' > /dev/null; then
            echo -e "\n${GREEN}=========================================="
            echo -e "✓ Unit successfully created and found in staging - TEST PASSED"
            echo -e "===========================================${NC}\n"
            track_test_result "Unit Addition" "PASS"
            break
        fi

        if (( i >= MAX_ATTEMPTS )); then
            echo -e "\n${RED}Unit creation results after $TIMEOUT_SECONDS seconds:${NC}"
            echo "Expected unit UUID: $unit_uuid"
            echo "Current staging state:"
            echo "$response" | jq '.'
            track_test_result "Unit Addition" "FAIL"
            fail_test "Unit staging verification timeout of $TIMEOUT_SECONDS seconds exceeded."
            return
        fi

        echo -e "${RED}●${NC} Unit not yet found in staging - checking again in $CHECK_INTERVAL seconds"
        sleep "$CHECK_INTERVAL"
        ((i++))
    done
}

# Test 2: Read Organizations and Validate Specific Org
test_read_orgs () {
    # First verify wallet is synced
    if ! is_wallet_synced; then
        return
    fi

    local ORGANIZATIONS_ENDPOINT="http://localhost:31310/v1/organizations"
    local response
    local expected_org_uid="11f7e8eb5a2a32dd373c14a172d55f62608a3e240cdf01362ce9fa398d2ca378"
    local TIMEOUT_SECONDS=300  # 5 minutes
    local CHECK_INTERVAL=10    # 10 seconds
    local MAX_ATTEMPTS=$((TIMEOUT_SECONDS / CHECK_INTERVAL))

    echo "Testing organizations read and validation... (this can take up to $TIMEOUT_SECONDS seconds)"

    # Wait for organization to be synced
    local i=0
    while true; do
        if [[ "$DEBUG" == "true" ]]; then
            echo "[DEBUG] Organization sync check attempt $((i+1)) of $MAX_ATTEMPTS"
        fi

        # Get organizations
        response=$(make_api_call "curl -s --location --request GET '$ORGANIZATIONS_ENDPOINT' \
            --header 'Content-Type: application/json'")

        if [[ $? -ne 0 ]]; then
            fail_test "Failed to get organizations"
            return
        fi

        if [[ "$TRACE" == "true" ]]; then
            echo "[DEBUG] Organizations response:"
            echo "$response" | jq '.'
        fi

        # Check if the expected organization exists
        if ! echo "$response" | jq -e --arg uid "$expected_org_uid" '.[$uid]' > /dev/null; then
            fail_test "Expected organization $expected_org_uid not found in response"
            return
        fi

        # Get the organization data
        local org_data
        org_data=$(echo "$response" | jq --arg uid "$expected_org_uid" '.[$uid]')

        # Check if organization is synced
        local is_synced
        local sync_remaining
        is_synced=$(echo "$org_data" | jq -r '.synced')
        sync_remaining=$(echo "$org_data" | jq -r '.sync_remaining')

        echo "Organization sync status: synced=$is_synced, sync_remaining=$sync_remaining"

        if [[ "$is_synced" == "true" ]]; then
            echo -e "${GREEN}●${NC} Organization is synced - proceeding with validation"
            break
        fi

        if (( i >= MAX_ATTEMPTS )); then
            echo -e "\n${RED}Organization sync timeout of $TIMEOUT_SECONDS seconds exceeded.${NC}"
            echo "Final organization state:"
            echo "$org_data" | jq '.'
            track_test_result "Organizations Read and Validation" "FAIL"
            fail_test "Organization sync timeout exceeded"
            return
        fi

        echo -e "${RED}●${NC} Organization not yet synced - checking again in $CHECK_INTERVAL seconds"
        sleep "$CHECK_INTERVAL"
        ((i++))
    done

    # Now validate the specific organization has the expected values
    local org_data
    org_data=$(echo "$response" | jq --arg uid "$expected_org_uid" '.[$uid]')

    # Validate each field
    local validation_errors=()

    # Check orgUid
    if [[ $(echo "$org_data" | jq -r '.orgUid') != "$expected_org_uid" ]]; then
        validation_errors+=("orgUid mismatch")
    fi

    # Check orgHash
    if [[ $(echo "$org_data" | jq -r '.orgHash') != "0x022f1fe0b02fc9e0929a012d09439e63289828b8964c488d9e16864031d35b0e" ]]; then
        validation_errors+=("orgHash mismatch")
    fi

    # Check name
    if [[ $(echo "$org_data" | jq -r '.name') != "Automated Testing Participant Data" ]]; then
        validation_errors+=("name mismatch")
    fi

    # Check icon
    if [[ $(echo "$org_data" | jq -r '.icon') != "https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg" ]]; then
        validation_errors+=("icon mismatch")
    fi

    # Check prefix
    if [[ $(echo "$org_data" | jq -r '.prefix') != "0" ]]; then
        validation_errors+=("prefix mismatch")
    fi

    # Check isHome
    if [[ $(echo "$org_data" | jq -r '.isHome') != "false" ]]; then
        validation_errors+=("isHome mismatch")
    fi

    # Check subscribed
    if [[ $(echo "$org_data" | jq -r '.subscribed') != "true" ]]; then
        validation_errors+=("subscribed mismatch")
    fi

    # Check synced
    if [[ $(echo "$org_data" | jq -r '.synced') != "true" ]]; then
        validation_errors+=("synced mismatch")
    fi

    # Check fileStoreSubscribed
    if [[ $(echo "$org_data" | jq -r '.fileStoreSubscribed') != "0" ]]; then
        validation_errors+=("fileStoreSubscribed mismatch")
    fi

    # Check registryId
    if [[ $(echo "$org_data" | jq -r '.registryId') != "cdcd3e377fbf9c75b4bbd4f1e65ab366be8f886e4fbdf20ff9926503cb30038c" ]]; then
        validation_errors+=("registryId mismatch")
    fi

    # Check registryHash
    if [[ $(echo "$org_data" | jq -r '.registryHash') != "0xe04062baca202d4cfdbb5ed26115c3b98fc952b293c35b167c4db2ad57905e96" ]]; then
        validation_errors+=("registryHash mismatch")
    fi

    # Check sync_remaining
    if [[ $(echo "$org_data" | jq -r '.sync_remaining') != "0" ]]; then
        validation_errors+=("sync_remaining mismatch")
    fi

    # Check dataModelVersionStoreId
    if [[ $(echo "$org_data" | jq -r '.dataModelVersionStoreId') != "a32e8ba6f67a8c95a785b01f86f4c2604cf703318e223142fac3831478c3b089" ]]; then
        validation_errors+=("dataModelVersionStoreId mismatch")
    fi

    # Check dataModelVersionStoreHash
    if [[ $(echo "$org_data" | jq -r '.dataModelVersionStoreHash') != "null" ]]; then
        validation_errors+=("dataModelVersionStoreHash mismatch")
    fi

    # Report validation results
    if [[ ${#validation_errors[@]} -gt 0 ]]; then
        echo -e "\n${RED}Organization validation failed:${NC}"
        for error in "${validation_errors[@]}"; do
            echo -e "${RED}  • $error${NC}"
        done
        echo -e "\n${RED}Expected organization data:${NC}"
        echo "$org_data" | jq '.'
        track_test_result "Organizations Read and Validation" "FAIL"
        fail_test "Organization validation failed"
        return
    fi

    echo -e "\n${GREEN}=========================================="
    echo -e "✓ Organizations successfully read and validated - TEST PASSED"
    echo -e "===========================================${NC}\n"
    track_test_result "Organizations Read and Validation" "PASS"
}



# Test 7: Read Projects - Success Tests
test_read_projects_success () {
    # First verify wallet is synced
    if ! is_wallet_synced; then
        return
    fi

    local PROJECTS_ENDPOINT="http://localhost:31310/v1/projects"
    local response

    echo "Testing projects read success scenarios..."

    # Test 1: Basic projects read with page and limit
    if [[ "$DEBUG" == "true" ]]; then
        echo "[DEBUG] Testing basic projects read with page=1&limit=10..."
    fi
    response=$(make_api_call "curl -s --location --request GET '$PROJECTS_ENDPOINT?page=1&limit=10' \
        --header 'Content-Type: application/json'")

    if [[ $? -ne 0 ]]; then
        fail_test "Failed to make API call for basic projects read"
        return
    fi

    if [[ "$TRACE" == "true" ]]; then
        echo "[DEBUG] Basic projects read response:"
        echo "$response" | jq '.'
    fi

    # Check if we got a successful response
    if echo "$response" | jq -e 'has("page")' > /dev/null && \
       echo "$response" | jq -e 'has("pageCount")' > /dev/null && \
       echo "$response" | jq -e 'has("data")' > /dev/null; then
        echo -e "\n${GREEN}✓ Basic projects read test PASSED${NC}"
    else
        echo -e "\n${RED}✗ Basic projects read test FAILED${NC}"
        track_test_result "Projects Read Success - Basic" "FAIL"
        return
    fi

    # Test 2: Search for projects containing "Temporary"
    if [[ "$DEBUG" == "true" ]]; then
        echo "[DEBUG] Testing search for projects containing 'Temporary'..."
    fi
    response=$(make_api_call "curl -s --location --request GET '$PROJECTS_ENDPOINT?search=Temporary&page=1&limit=10' \
        --header 'Content-Type: application/json'")

    if [[ $? -ne 0 ]]; then
        fail_test "Failed to make API call for projects search"
        return
    fi

    if [[ "$TRACE" == "true" ]]; then
        echo "[DEBUG] Projects search response:"
        echo "$response" | jq '.'
    fi

    # Check if we got a successful response
    if echo "$response" | jq -e 'has("page")' > /dev/null && \
       echo "$response" | jq -e 'has("pageCount")' > /dev/null && \
       echo "$response" | jq -e 'has("data")' > /dev/null; then
        echo -e "\n${GREEN}✓ Projects search test PASSED${NC}"
    else
        echo -e "\n${RED}✗ Projects search test FAILED${NC}"
        track_test_result "Projects Read Success - Search" "FAIL"
        return
    fi

    # Test 3: Get projects with specific columns
    if [[ "$DEBUG" == "true" ]]; then
        echo "[DEBUG] Testing projects read with specific columns..."
    fi
    response=$(make_api_call "curl -s --location --request GET '$PROJECTS_ENDPOINT?page=1&limit=5&columns=projectName&columns=projectDeveloper&columns=sector' \
        --header 'Content-Type: application/json'")

    if [[ $? -ne 0 ]]; then
        fail_test "Failed to make API call for projects with columns"
        return
    fi

    if [[ "$TRACE" == "true" ]]; then
        echo "[DEBUG] Projects with columns response:"
        echo "$response" | jq '.'
    fi

    # Check if we got a successful response
    if echo "$response" | jq -e 'has("page")' > /dev/null && \
       echo "$response" | jq -e 'has("pageCount")' > /dev/null && \
       echo "$response" | jq -e 'has("data")' > /dev/null; then
        echo -e "\n${GREEN}✓ Projects with columns test PASSED${NC}"
    else
        echo -e "\n${RED}✗ Projects with columns test FAILED${NC}"
        track_test_result "Projects Read Success - Columns" "FAIL"
        return
    fi

    echo -e "\n${GREEN}=========================================="
    echo -e "✓ All projects read success tests PASSED"
    echo -e "===========================================${NC}\n"
    track_test_result "Projects Read Success" "PASS"
}

# Test 8: Delete home organization
test_delete_home_org () {
    # First verify wallet is synced
    if ! is_wallet_synced; then
        return
    fi

    local TIMEOUT_SECONDS=300
    local CHECK_INTERVAL=15
    local MAX_ATTEMPTS=$((TIMEOUT_SECONDS / CHECK_INTERVAL))
    local DELETE_ENDPOINT="http://localhost:31310/v1/organizations"
    local response
    local org_uid

    echo "Testing home organization deletion... (this can take up to 5 minutes)"

    # First get the current home org UID
    response=$(make_api_call "curl -s --location --request GET '$DELETE_ENDPOINT' \
        --header 'Content-Type: application/json'")
    if [[ $? -ne 0 ]]; then
        fail_test "Failed to get organizations"
        return
    fi

    # Find any home org that exists
    org_uid=$(echo "$response" | jq -r 'to_entries[] | select(.value.isHome == true) | .key')

    if [[ -z "$org_uid" ]]; then
        fail_test "No home organization found to delete"
        return
    fi

    echo "[DEBUG] Found home organization with UID: $org_uid"

    # Delete the home organization
    if [[ "$DEBUG" == "true" ]]; then
        echo "[DEBUG] Deleting home organization..."
    fi
    response=$(make_api_call "curl -s --location --request DELETE '$DELETE_ENDPOINT/$org_uid'")

    if [[ "$TRACE" == "true" ]]; then
        echo "[DEBUG] Delete organization response:"
        echo "$response"
    fi

    # Check if deletion was successful
    if ! echo "$response" | jq -e '.success == true' > /dev/null; then
        fail_test "Failed to delete organization: $(echo "$response" | jq -r '.message // "Unknown error"')"
        return
    fi

    # Verify organization is actually deleted
    echo "Verifying organization deletion..."
    i=0
    while true; do
        if [[ "$DEBUG" == "true" ]]; then
            echo "[DEBUG] Check attempt $((i+1)) of $MAX_ATTEMPTS"
        fi

        # Get current organizations
        response=$(make_api_call "curl -s --location --request GET '$DELETE_ENDPOINT' \
            --header 'Content-Type: application/json'")
        if [[ $? -ne 0 ]]; then
            fail_test "Failed to get organizations"
            return
        fi

        # Check if any home orgs exist
        if echo "$response" | jq -e '[to_entries[] | select(.value.isHome == true)] | length == 0' > /dev/null; then
            echo -e "\n${GREEN}=========================================="
            echo -e "✓ Home organization successfully deleted and verified - TEST PASSED"
            echo -e "===========================================${NC}\n"
            track_test_result "Home Organization Deletion" "PASS"
            break
        fi

        if (( $i >= $MAX_ATTEMPTS )); then
            echo -e "\n${RED}Organization deletion results after $TIMEOUT_SECONDS seconds:${NC}"
            echo "Attempted to delete orgUid: $org_uid"
            echo "Current organizations state:"
            echo "$response" | jq '.'
            track_test_result "Home Organization Deletion" "FAIL"
            fail_test "Organization deletion verification timeout of $TIMEOUT_SECONDS seconds exceeded."
            return
        fi

        echo -e "${RED}●${NC} Organization still exists - checking again in $CHECK_INTERVAL seconds"
        sleep "$CHECK_INTERVAL"
        ((i++))
    done
}

# Helper function to make API calls with wallet sync check
make_api_call() {
    local TIMEOUT_SECONDS=300  # 5 minutes
    local CHECK_INTERVAL=5
    local MAX_ATTEMPTS=$((TIMEOUT_SECONDS / CHECK_INTERVAL))
    local i=0
    local response

    while true; do
        response=$(eval "$1")

        # First check if we got a response with the wallet error message
        if echo "$response" | grep -q "Your wallet is not available"; then
            echo "[DEBUG] Wallet not available, checking sync status..."
            if ! is_wallet_synced; then
                return 1
            fi

            if (( i >= MAX_ATTEMPTS )); then
                echo "[DEBUG] API call timeout after $TIMEOUT_SECONDS seconds"
                echo "$response"
                return 1
            fi

            ((i++))
            continue
        fi

        # If we get here, we got a response that wasn't the wallet error
        echo "$response"
        return 0
    done
}

# Function to split coins in the wallet
split_coins() {
    echo "=== Splitting coins in wallet ==="

    # First verify wallet is synced
    if ! is_wallet_synced; then
        return
    fi

    echo "Splitting largest coin into 30 coins of 0.000035 TXCH each..."

    # Run the chia-tools split command
    local split_result
    split_result=$(chia-tools coins split-largest -m 0 -n 30 -a 0.0003)
    if [[ $? -ne 0 ]]; then
        track_test_result "Coin Split" "FAIL"
        fail_test "Failed to split coins: $split_result"
        return
    fi

    echo "[DEBUG] Split coins response:"
    echo "$split_result"

    # Extract transaction ID from the log output
    # The output format is: TRANSACTION_ID=0eccadc2c16437df8d5047606b126e5e8d19cd8486b687471ae425a9779f568f
    local transaction_id
    transaction_id=$(echo "$split_result" | grep -o 'TRANSACTION_ID=[a-f0-9]*' | cut -d'=' -f2)
    if [[ $? -ne 0 ]]; then
        track_test_result "Coin Split" "FAIL"
        fail_test "Failed to parse transaction ID from split response"
        return
    fi

    if [[ -z "$transaction_id" ]]; then
        track_test_result "Coin Split" "FAIL"
        fail_test "No transaction ID found in split response"
        return
    fi

    # Add 0x prefix if not already present
    if [[ ! "$transaction_id" =~ ^0x ]]; then
        transaction_id="0x$transaction_id"
    fi

    echo "Split transaction ID: $transaction_id"

    # Wait for the split transaction to be confirmed
    wait_for_transaction "$transaction_id"

    # Show wallet balance after split
    echo "Showing wallet balance after coin split:"
    chia wallet show

    echo "=== Coin split completed successfully ==="
    track_test_result "Coin Split" "PASS"
}

# Function to transfer funds to test wallet
transfer_funds_to_test_wallet() {
    echo "=== Transferring funds to test wallet ==="

    # Get wallet address and store it in test_wallet_address variable
    test_wallet_address=$(chia wallet get_address)
    if [[ $? -ne 0 ]]; then
        track_test_result "Funds Transfer" "FAIL"
        fail_test "Failed to get wallet address"
        return
    fi
    echo "Test wallet address: $test_wallet_address"

    # Get wallet fingerprint
    test_wallet_fingerprint=$(chia rpc wallet get_logged_in_fingerprint | jq -r '.fingerprint')
    if [[ $? -ne 0 ]]; then
        fail_test "Failed to get wallet fingerprint"
        return
    fi
    echo "Test wallet fingerprint: $test_wallet_fingerprint"

    # Create mnemonic.txt file with TXCH_MNEMONIC environment variable
    if [[ -z "$TXCH_MNEMONIC" ]]; then
        fail_test "TXCH_MNEMONIC environment variable is not set. Please set it with a valid 24-word mnemonic phrase containing TXCH funds for testing."
        return
    fi

    echo "$TXCH_MNEMONIC" > mnemonic.txt

    # Import wallet with TXCH
    chia keys add -f mnemonic.txt -l "txch-funds"
    if [[ $? -ne 0 ]]; then
        fail_test "Failed to import TXCH wallet. Check that TXCH_MNEMONIC contains a valid 24-word mnemonic phrase."
        return
    fi

    # Remove mnemonic.txt file
    rm -f mnemonic.txt

    # Get wallet fingerprints and store the one for the txch funds in txch_funds_wallet variable
    if [[ "$DEBUG" == "true" ]]; then
        echo "[DEBUG] Getting all wallet fingerprints..."
    fi
    all_fingerprints_response=$(chia rpc wallet get_public_keys)
    if [[ $? -ne 0 ]]; then
        fail_test "Failed to get wallet fingerprints"
        return
    fi

    if [[ "$TRACE" == "true" ]]; then
        echo "[DEBUG] All fingerprints response:"
        echo "$all_fingerprints_response"
    fi

    # Check if response is empty or invalid
    if [[ -z "$all_fingerprints_response" ]]; then
        fail_test "Empty response from chia rpc wallet get_public_keys"
        return
    fi

    # Extract the fingerprint that doesn't match test_wallet_fingerprint
    txch_funds_fingerprint=$(echo "$all_fingerprints_response" | jq -r --arg exclude "$test_wallet_fingerprint" '.public_key_fingerprints[] | select(. != ($exclude | tonumber))')
    if [[ $? -ne 0 ]]; then
        fail_test "Failed to parse wallet fingerprints with jq"
        return
    fi

    # Check if we got a valid fingerprint
    if [[ -z "$txch_funds_fingerprint" ]]; then
        fail_test "No TXCH funds wallet fingerprint found"
        return
    fi

    echo "TXCH funds wallet fingerprint: $txch_funds_fingerprint"

    # Show balance of txch funds wallet
    echo "Showing wallet to switch to txch funds wallet"
    chia wallet show -f $txch_funds_fingerprint

    # call function to check if wallet it synced
    is_wallet_synced

    # Show balance of txch funds wallet
    echo "Showing balance now that we're sure the wallet is synced"
    chia wallet show -f $txch_funds_fingerprint

    # Transfer funds to test wallet
    echo "Sending transaction to transfer 0.001 TXCH to test wallet ${test_wallet_address}"
    transaction_id=$(chia rpc wallet send_transaction "{\"wallet_id\": 1, \"amount\": 9000000000, \"fee\": 0, \"memos\":[\"transfer to test wallet\"], \"address\": \"$test_wallet_address\"}" | jq -r '.transaction_id')
    if [[ $? -ne 0 ]]; then
        track_test_result "Funds Transfer" "FAIL"
        fail_test "Failed to send transaction"
        return
    fi

    echo "Transaction ID: $transaction_id"

    # Wait for the transaction to be confirmed
    wait_for_transaction "$transaction_id"

    # Show balance of txch funds wallet
    echo "Showing balance of txch funds wallet after transfer"
    chia wallet show -f $txch_funds_fingerprint

    # Show balance of test wallet
    echo "Showing balance of test wallet after transfer - may need to wait for sync"
    chia wallet show -f $test_wallet_fingerprint

    # Check if wallet balance is greater than 100000000 mojos
    check_wallet_balance 1 100000000

    # call function to check if wallet it synced
    is_wallet_synced

    # Show balance of test wallet
    echo "Showing balance of test wallet after sync"
    chia wallet show -f $test_wallet_fingerprint

    # Delete keys for txch funds wallet
    chia keys delete -f $txch_funds_fingerprint
    if [[ $? -ne 0 ]]; then
        fail_test "Failed to delete TXCH funds wallet keys"
        return
    fi

    echo "=== Funds transfer completed successfully ==="
    track_test_result "Funds Transfer" "PASS"
}

get_txch_from_faucet() {

    request_amount=0.005
    # Checking wallet balance before faucet request
    echo "Getting current wallet balance..."

    local balance_response
    balance_response=$(chia rpc wallet get_wallet_balance '{"wallet_id": 1}')
    if [[ $? -ne 0 ]]; then
        echo "Failed to get wallet balance"
        return 1
    fi

    if [[ "$TRACE" == "true" ]]; then
        echo "[DEBUG] Balance response:"
        echo "$balance_response"
    fi

    # Extract the confirmed wallet balance in mojos
    local current_balance
    current_balance=$(echo "$balance_response" | jq -r '.confirmed_wallet_balance')
    if [[ $? -ne 0 ]]; then
        echo "Failed to parse wallet balance"
        return 1
    fi

    echo "Current wallet balance: $current_balance mojos"

    # Get the current wallet address
    echo "Getting current wallet address..."
    local wallet_address
    wallet_address=$(chia wallet get_address)
    if [[ $? -ne 0 ]]; then
        echo "Failed to get wallet address"
        return 1
    fi

    echo "Current wallet address: $wallet_address"

    echo "Getting TXCH from faucet"
    curl -X POST -H "Content-Type: application/json" -d "{\"address\":\"$wallet_address\",\"amount\":\"$request_amount\"}" https://testneta-faucet.chia.net/api/request

    # Wait for the funds to show up in the wallet
    local TIMEOUT_SECONDS=600  # 10 minutes
    local CHECK_INTERVAL=15    # 15 seconds
    local MAX_ATTEMPTS=$((TIMEOUT_SECONDS / CHECK_INTERVAL))
    local request_amount_mojos

    # Convert request amount from TXCH to mojos (1 TXCH = 1 trillion mojos)
    request_amount_mojos=$(echo "$request_amount * 1000000000000" | bc)
    local expected_balance=$((current_balance + request_amount_mojos))

    echo "Waiting for funds to appear in wallet (up to $TIMEOUT_SECONDS seconds)..."
    echo "Expected balance increase: $request_amount_mojos mojos"
    echo "Expected final balance: $expected_balance mojos"

    local i=0
    while true; do
        if [[ "$DEBUG" == "true" ]]; then
            echo "[DEBUG] Balance check attempt $((i+1)) of $MAX_ATTEMPTS"
        fi

        # Get current wallet balance
        balance_response=$(chia rpc wallet get_wallet_balance '{"wallet_id": 1}')
        if [[ $? -ne 0 ]]; then
            echo "Failed to get wallet balance, will retry..."
            sleep "$CHECK_INTERVAL"
            ((i++))
            continue
        fi

        # Extract the confirmed wallet balance
        local new_balance
        new_balance=$(echo "$balance_response" | jq -r '.confirmed_wallet_balance')
        if [[ $? -ne 0 ]]; then
            echo "Failed to parse wallet balance, will retry..."
            sleep "$CHECK_INTERVAL"
            ((i++))
            continue
        fi

        echo "Current balance: $new_balance mojos (started with: $current_balance mojos)"

        # Check if balance has increased by at least the request amount
        if (( new_balance >= expected_balance )); then
            local actual_increase=$((new_balance - current_balance))
            echo -e "${GREEN}●${NC} Funds received! Balance increased by $actual_increase mojos"
            echo "Final wallet balance: $new_balance mojos"
            return 0
        fi

        if (( i >= MAX_ATTEMPTS )); then
            echo -e "${RED}●${NC} Timeout waiting for funds from faucet after $TIMEOUT_SECONDS seconds"
            echo "Final balance: $new_balance mojos (expected at least: $expected_balance mojos)"
            return 1
        fi

        echo -e "${RED}●${NC} Funds not yet received - checking again in $CHECK_INTERVAL seconds"
        sleep "$CHECK_INTERVAL"
        ((i++))
    done
}


#~~~              ~~~ #
#~~~ Main Program ~~~ #
#~~~              ~~~ #

# Start Chia
chia start wallet data data_layer_http
sleep 5
is_wallet_synced

# Display wallet
chia wallet show

# Transfer funds to test wallet
#transfer_funds_to_test_wallet
get_txch_from_faucet

# Split coins
split_coins

# Display datalayer subscriptions
echo "Displaying datalayer subscriptions before starting cadt"
chia data get_subscriptions

# start cadt in the background
pm2 start npm --no-autorestart --name "cadt" -- start

#~~~ Run Tests ~~~ #

# Test 1: Verify that we are subscribed to all required DataLayer stores
test_subscriptions

# Test 2: Create a home organization
test_create_home_org

# Test 3: Create and verify a project
test_create_project

# Test 4: Add a Project
test_add_project

# Test 5: Add a Unit
test_add_unit

# Test 6: Read Organizations and Validate Specific Org
test_read_orgs

# Test 7: Read Projects - Success Tests
test_read_projects_success

# Test 8: Delete home organization (do this last)
test_delete_home_org

# If we got here with no failures, run cleanup and exit successfully
cleanup

# Display test summary
display_test_summary

#~~~~ upload logs to artifacts here ~~~~#
#cat ~/.chia/mainnet/log/debug.log
