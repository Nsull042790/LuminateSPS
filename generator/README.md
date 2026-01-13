# Luminate Property Site Generator

A web-based tool for loan officers to create co-branded property websites with realtors.

## Quick Start with GitHub Codespaces

1. Click the green **Code** button on the repository
2. Select **Codespaces** tab
3. Click **Create codespace on main**
4. Wait for it to build (~2 minutes)
5. The app will auto-start and open in your browser!

## Features

- **Easy Web Form** - Enter property details, upload photos, add contact info
- **Photo Upload** - Drag & drop up to 20 property photos
- **Live Preview** - See the site before publishing
- **Auto-Publish** - Publishes directly to GitHub Pages
- **Co-Branding** - Features both realtor and loan officer prominently

## Configuration

To enable auto-publishing to GitHub Pages, you need a GitHub Personal Access Token:

1. Go to [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Name it "Luminate Property Sites"
4. Select the `repo` scope
5. Generate and copy the token

### In Codespaces:
The token will be requested when you first create the codespace, or you can add it in:
- Codespace Settings > Secrets > `GITHUB_TOKEN`

### Running Locally:
Create a `.env` file in the `generator` folder:
```
GITHUB_TOKEN=your_token_here
GITHUB_OWNER=Nsull042790
GITHUB_REPO=LuminateSPS
GITHUB_BRANCH=main
PORT=3000
```

## Local Development

```bash
cd generator
npm install
npm start
```

Then open http://localhost:3000

## How It Works

1. Loan officer fills out the property form
2. Uploads property photos and contact headshots
3. Clicks "Generate & Publish"
4. Generator creates HTML and pushes to GitHub
5. Site is live on GitHub Pages in ~1 minute

## Generated Site Features

- Hero section with property photo and price
- Photo gallery with lightbox
- Property details and features
- Interactive mortgage calculator
- Realtor and Loan Officer contact cards
- Testimonials section
- Share buttons and QR code
- Print-friendly styling
- Mobile responsive design
- Equal Housing compliance footer
