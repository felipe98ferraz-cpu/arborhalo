# Cooud checkout

Deploy this repository to Vercel as an Other project with the repository root as the output directory. The storefront is static and Vercel runs `api/cooud.mjs` as a serverless function. A static-only host cannot run that function.

Set these environment variables in the deployment dashboard:

- `CHECKOUT_ORIGIN` — exact public HTTPS storefront origin, with no trailing slash.
- `COOUD_API_KEY` — secret Cooud v2 key. Start with a sandbox key.
- `COOUD_ACCOUNT` — connected store/subaccount ID only when required by a platform key.

The store must accept USD and support custom checkout sessions with dynamic line items. Confirm eligibility with Cooud if the account is on Cooud LLC. The existing catalog is the source of prices. This implementation sends the displayed merchandise total, with no separate shipping or tax lines. Configure the applicable shipping and tax rules before enabling live payments.

Test a US delivery address and the Cooud sandbox card. Confirm the payment and the shipping metadata in Cooud before fulfilling an order. The browser confirmation is for customer feedback. Use the Cooud dashboard or verified paid events for fulfillment. Keep shipping metadata access restricted. The application never receives card number or security code.
