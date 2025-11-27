# Stripe CLI Guide

## Installation

### macOS (using Homebrew)
```bash
brew install stripe/stripe-cli/stripe
```

### Linux
```bash
# Download and install
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_*_linux_x86_64.tar.gz
tar -xvf stripe_*_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

### Windows
Download from: https://github.com/stripe/stripe-cli/releases

## Login/Authentication

```bash
# Login to your Stripe account
stripe login

# Or use API key directly
export STRIPE_SECRET_KEY="sk_test_..." # or sk_live_...
```

## Common Commands

### List Products
```bash
# List all products
stripe products list

# List with limit
stripe products list --limit 100

# List only active products
stripe products list --limit 100 | jq '.data[] | select(.active == true)'
```

### Update Product
```bash
# Archive a product (set active=false)
stripe products update prod_xxxxx -d "active=false"

# Update product name
stripe products update prod_xxxxx -d "name=Starter Plan"

# Add metadata
stripe products update prod_xxxxx -d "metadata[tier]=starter"
```

### Delete Product (only if not in use)
```bash
stripe products delete prod_xxxxx
```

### List Prices
```bash
# List all prices
stripe prices list

# List prices for a specific product
stripe prices list --product prod_xxxxx
```

### Archive Multiple Products
```bash
# Archive products without tier metadata
stripe products list --limit 100 | jq -r '.data[] | select(.metadata.tier == null) | .id' | xargs -I {} stripe products update {} -d 'active=false'
```

## For Your Use Case (Cleanup 158 Products)

### Step 1: Find products with tier metadata
```bash
stripe products list --limit 100 | jq '.data[] | select(.metadata.tier == "starter" or .metadata.tier == "pro" or .metadata.tier == "enterprise")'
```

### Step 2: Archive products without correct tier metadata
```bash
# This will archive products that don't have tier=starter/pro/enterprise
stripe products list --limit 100 | jq -r '.data[] | select(.metadata.tier == null or (.metadata.tier != "starter" and .metadata.tier != "pro" and .metadata.tier != "enterprise")) | .id' | while read id; do 
  echo "Archiving $id"
  stripe products update $id -d 'active=false'
done
```

### Step 3: Verify only 3 products remain active
```bash
stripe products list --limit 100 | jq '.data[] | select(.active == true) | {id, name, metadata}'
```

## Using jq (JSON processor)

If you don't have `jq` installed:
```bash
# macOS
brew install jq

# Linux
sudo apt-get install jq  # or yum install jq
```

## Help

```bash
# Get help for any command
stripe products --help
stripe products list --help
stripe products update --help
```

