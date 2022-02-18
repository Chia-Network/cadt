#!/bin/bash

#Configuration Variables and Parameters

#Parameters
SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
TARGET_DIRECTORY="$SCRIPTPATH/target"
PRODUCT=${1}
DATE=`date +%Y-%m-%d`
TIME=`date +%H:%M:%S`
LOG_PREFIX="[$DATE $TIME]"

function printUsage() {
  echo -e "\033[1mUsage:\033[0m"
  echo "$0 [APPLICATION_NAME]"
  echo
  echo -e "\033[1mOptions:\033[0m"
  echo "  -h (--help)"
  echo
  echo -e "\033[1mExample::\033[0m"
  echo "$0 wso2am 2.6.0"

}

#Argument validation
if [[ "$1" == "-h" ||  "$1" == "--help" ]]; then
    printUsage
    exit 1
fi
if [ -z "$1" ]; then
    echo "Please enter a valid application name for your application"
    echo
    printUsage
    exit 1
else
    echo "Application Name : $1"
fi

#Functions
go_to_dir() {
    pushd $1 >/dev/null 2>&1
}

log_info() {
    echo "${LOG_PREFIX}[INFO]" $1
}

log_warn() {
    echo "${LOG_PREFIX}[WARN]" $1
}

log_error() {
    echo "${LOG_PREFIX}[ERROR]" $1
}

deleteInstallationDirectory() {
    log_info "Cleaning $TARGET_DIRECTORY directory."
    rm -rf "$TARGET_DIRECTORY"

    if [[ $? != 0 ]]; then
        log_error "Failed to clean $TARGET_DIRECTORY directory" $?
        exit 1
    fi
}

createInstallationDirectory() {
    if [ -d "${TARGET_DIRECTORY}" ]; then
        deleteInstallationDirectory
    fi
    mkdir -pv "$TARGET_DIRECTORY"

    if [[ $? != 0 ]]; then
        log_error "Failed to create $TARGET_DIRECTORY directory" $?
        exit 1
    fi
}

copyDarwinDirectory(){
  createInstallationDirectory
  cp -r "$SCRIPTPATH/darwin" "${TARGET_DIRECTORY}/"
  chmod -R 755 "${TARGET_DIRECTORY}/darwin/scripts"
  chmod -R 755 "${TARGET_DIRECTORY}/darwin/Resources"
  chmod 755 "${TARGET_DIRECTORY}/darwin/Distribution"
}

copyBuildDirectory() {
    sed -i '' -e 's/__PRODUCT__/'${PRODUCT}'/g' "${TARGET_DIRECTORY}/darwin/scripts/postinstall"
    chmod -R 755 "${TARGET_DIRECTORY}/darwin/scripts/postinstall"

    sed -i '' -e 's/__PRODUCT__/'${PRODUCT}'/g' "${TARGET_DIRECTORY}/darwin/Distribution"
    chmod -R 755 "${TARGET_DIRECTORY}/darwin/Distribution"

    sed -i '' -e 's/__PRODUCT__/'${PRODUCT}'/g' "${TARGET_DIRECTORY}"/darwin/Resources/*.html
    chmod -R 755 "${TARGET_DIRECTORY}/darwin/Resources/"

    rm -rf "${TARGET_DIRECTORY}/darwinpkg"
    mkdir -p "${TARGET_DIRECTORY}/darwinpkg"

    # Copy application files into correct directory structure
    mkdir -p "${TARGET_DIRECTORY}/darwinpkg/${PRODUCT}"
    cp -a "$SCRIPTPATH"/application/. "${TARGET_DIRECTORY}/darwinpkg/${PRODUCT}"
    chmod -R 755 "${TARGET_DIRECTORY}/darwinpkg/${PRODUCT}"

    rm -rf "${TARGET_DIRECTORY}/package"
    mkdir -p "${TARGET_DIRECTORY}/package"
    chmod -R 755 "${TARGET_DIRECTORY}/package"

    rm -rf "${TARGET_DIRECTORY}/pkg"
    mkdir -p "${TARGET_DIRECTORY}/pkg"
    chmod -R 755 "${TARGET_DIRECTORY}/pkg"
}

function buildPackage() {
    log_info "Application installer package building started.(1/3)"
    pkgbuild --identifier "org.${PRODUCT}" \
    --version "main" \
    --scripts "${TARGET_DIRECTORY}/darwin/scripts" \
    --root "${TARGET_DIRECTORY}/darwinpkg" \
    "${TARGET_DIRECTORY}/package/${PRODUCT}.pkg" > /dev/null 2>&1
}

function buildProduct() {
    log_info "Application installer product building started.(2/3)"
    productbuild --distribution "${TARGET_DIRECTORY}/darwin/Distribution" \
    --resources "${TARGET_DIRECTORY}/darwin/Resources" \
    --package-path "${TARGET_DIRECTORY}/package" \
    "${TARGET_DIRECTORY}/pkg/$1" > /dev/null 2>&1
}

function createInstaller() {
    log_info "Application installer generation process started.(3 Steps)"
    buildPackage
    buildProduct ${PRODUCT}-macos-installer-x64.pkg
    log_info "Application installer generation steps finished."
}

function createUninstaller(){
    cp "$SCRIPTPATH/darwin/Resources/uninstall.sh" "${TARGET_DIRECTORY}/darwinpkg/${PRODUCT}"
    sed -i '' -e "s/__PRODUCT__/${PRODUCT}/g" "${TARGET_DIRECTORY}/darwinpkg/${PRODUCT}/uninstall.sh"
}

#Main script
log_info "Installer generating process started."

copyDarwinDirectory
copyBuildDirectory
createUninstaller
createInstaller

log_info "Installer generating process finished"
exit 0
