#!/bin/bash
# Property Site Generator deploy script
# Usage: ./deploy.sh [all|module|template|functions|card]
# Pulls the latest from GitHub, then uploads to the ONE canonical location
# for each component in the production account (NickMain / 242109586).
set -e

ACCOUNT="NickMain"
BRANCH="claude/debug-project-errors-UB8Uq"
cd "$(dirname "$0")"

echo "==> Pulling latest from GitHub ($BRANCH)..."
git pull origin "$BRANCH"

deploy_module()    { echo "==> Uploading generator module...";  hs cms upload hubspot/modules modules --account="$ACCOUNT"; }
deploy_template()  { echo "==> Uploading page template...";     hs cms upload hubspot/templates templates --account="$ACCOUNT"; }
deploy_functions() { echo "==> Uploading API functions...";     hs cms upload hubspot/fresh.functions fresh.functions --account="$ACCOUNT"; }
deploy_card()      { echo "==> Deploying CRM card project...";  (cd property-generator-app && hs project upload --account="$ACCOUNT"); }

case "${1:-all}" in
  module|modules)     deploy_module ;;
  template|templates) deploy_template ;;
  functions)          deploy_functions ;;
  card)               deploy_card ;;
  all)
    deploy_module
    deploy_template
    deploy_functions
    deploy_card
    ;;
  *)
    echo "Usage: ./deploy.sh [all|module|template|functions|card]"
    exit 1
    ;;
esac

echo ""
echo "==> Done. Hard refresh (Cmd+Shift+R) the generator page / Contact record"
echo "    and confirm the version number in the header."
