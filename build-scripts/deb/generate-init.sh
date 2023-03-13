#!/bin/bash

#############################################################
# Create a systemd .service file for the CADT               #
# climate-warehouse application.                            #
#############################################################

# Determine what user this is run as
echo "Determining what user we are running as..."
this_user=$(whoami)
echo "Running as ${this_user}"

# Determine what the primary group of the user is
echo "Determining the primary group of this user..."
this_group=$(id -gn)
echo "Primary group is ${this_group}"

# See if this user has the CHIA_ROOT variable set or has a
# directory at ~/.chia
if [ -z "$CHIA_ROOT" ]
then
    echo "CHIA_ROOT variable not set, checking for ~/.chia/mainnet directory..."
    look_for_chia_here=~/.chia/mainnet
else
    echo "CHIA_ROOT variable found, validating Chia directory at ${CHIA_ROOT}..."
    look_for_chia_here=${CHIA_ROOT}
fi
# Check if the Chia directory exists
if [ -d "${look_for_chia_here}" ]
then
    echo "Found Chia directory $look_for_chia_here"
else
    echo ""
    echo "ERROR! Chia root directory at ${look_for_chia_here} not found for user ${this_user}"
    echo "This could be for the following reasons:"
    echo "   1.  Chia not installed"
    echo "   2.  'chia init' has not been run"
    echo "   3.  Chia root directory somewhere other than ~/.chia"
    echo "   4.  Script run as a user other than the one running Chia"
    echo "Please fix the issue and try again. If using a non-standard"
    echo "Chia root directory, set the CHIA_ROOT environment variable."
    exit 1
fi

# Check for Chia systemd files for node, wallet, and datalayer
chiaServices=(full-node wallet data-layer )
foundServices=()
for service in "${chiaServices[@]}"
do
    serviceFilename="/etc/systemd/system/chia-${service}.service"
    echo "checking for ${serviceFilename}..."
    if [ -f "${serviceFilename}" ]
    then
        echo "Found ${serviceFilename}"
        foundServices+=("${serviceFilename}")
    else
        echo "${serviceFilename} not found"
    fi
done

# Download CADT systemd template
echo "Downloading cadt.service template file..."
cadtServiceFile=$(wget -qO- https://raw.githubusercontent.com/Chia-Network/ansible-roles/main/cadt/templates/cadt.service.j2)

# Update the "Requires" and "After" section based on which Chia
# systemd files are available
for service in "${chiaServices[@]}"
do
    # If $foundServices array does not contain the service
    # we are looking for, comment out the line
    if [[ ! " ${foundServices[*]} " =~ " ${service} " ]]
    then
        echo "Removing requirement for ${service} systemd file..."
        cadtServiceFile=${cadtServiceFile/Requires=chia-${service}.service/#Requires=chia-${service}.service}
        cadtServiceFile=${cadtServiceFile/After=chia-${service}.service/#After=chia-${service}.service}
    fi
done

# Update cadt.service with the CHIA_ROOT we found
echo "Setting the CHIA_ROOT in the cadt.service file to $look_for_chia_here..."
cadtServiceFile=${cadtServiceFile/"{{ chia_root }}"/${look_for_chia_here}}

# Find the climate-warehouse executable
echo "Looking for climate-warehouse executable..."
if [ -f /opt/climate-warehouse/climate-warehouse ]
then
    echo "climate-warehouse executable found at /opt/climate-warehouse/climate-warehouse"
    climateWarehouseExec="/opt/climate-warehouse/climate-warehouse"
elif [ -f ~/cadt/linux-x64/climate-warehouse ]
then
    echo "climate-warehouse executable found at ~/cadt/linux-x64/climate-warehouse"
    climateWarehouseExec="/opt/climate-warehouse/climate-warehouse"
else
    echo ""
    echo "Can't find climate-warehouse executable! Please enter the full path to climate-warehouse:"
    read -r climateWarehouseExec
    if [ -f "${climateWarehouseExec}" ]
    then
        echo "climate-warehouse validated at ${climateWarehouseExec}"
    else
        echo "ERROR! Cannot find climate-warehouse executable at ${climateWarehouseExec}"
        exit 1
    fi
fi

# Set executable location in cadt.service file
echo "Setting the CADT executable location to ${climateWarehouseExec} in cadt.service..."
cadtServiceFile=${cadtServiceFile/'ExecStart=/home/{{ user }}/cadt/linux-x64/climate-warehouse'/ExecStart=${climateWarehouseExec}}

# Set user and group in cadt.service file
echo "Setting the user to be ${this_user} and the group to be ${this_group} in cadt.service..."
cadtServiceFile=${cadtServiceFile/'User={{ user }}'/User=${this_user}}
cadtServiceFile=${cadtServiceFile/'Group={{ group }}'/Group=${this_group}}

# Output the cadt.service file to /etc/systemd/system/cadt.service (needs sudo)
echo ""
echo "Writing file to ${HOME}/cadt.service"
printf "$cadtServiceFile" > "${HOME}"/cadt.service
echo ""
echo "************************************"
echo "* Your cadt.service file is ready! *"
echo "************************************"
echo ""
echo ""
echo "****************"
echo "* Instructions *"
echo "****************"
echo " 1.  Move ${HOME}/cadt.service to /etc/systemd/system/cadt.service with this command:"
echo "          sudo mv ${HOME}/cadt.service /etc/systemd/system/cadt.service"
echo " 2.  Reload systemd:"
echo "          sudo systemctl daemon-reload"
echo " 3.  You may now start the CADT service with the following command:"
echo "          sudo systemctl start cadt"
echo " 4.  Set CADT to start at boot:"
echo "          sudo systemctl enable cadt"
echo " 5.  To see the latest CADT log output:"
echo "          sudo journalctl -u cadt.service"



